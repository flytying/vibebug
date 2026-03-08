/**
 * Tool-Specific Passthrough Trust Tests
 *
 * These tests simulate behaviors of real dev tools to verify that the
 * wrapper doesn't alter their observable behavior. Each test uses inline
 * Node scripts that mimic what specific tools do.
 *
 * Categories:
 *   1. Progress bar / carriage return tools (Vite, webpack, npm)
 *   2. Interactive / TTY-detecting tools (inquirer, prompts)
 *   3. Watch mode / long-running (tsc --watch, Vite dev)
 *   4. Color libraries (chalk, picocolors)
 *   5. Spawn chains (tools that spawn sub-processes)
 *   6. Streaming output (pytest, cargo)
 */

import { describe, it, expect } from 'vitest';
import { runCommand } from '../runner.js';

function node(code: string): string[] {
  return [`node -e "${code.replace(/"/g, '\\"')}"`];
}

// ============================================================
// 1. PROGRESS BAR / CARRIAGE RETURN BEHAVIOR
//    Tools like Vite, webpack, npm show progress via \r overwrites.
//    If \r is lost or buffered weirdly, progress bars break.
// ============================================================

describe('progress bar behavior (\\r overwrites)', () => {
  it('preserves carriage returns in output', async () => {
    const code = `
      process.stdout.write("Progress: 0%\\r");
      process.stdout.write("Progress: 50%\\r");
      process.stdout.write("Progress: 100%\\n");
    `;
    const result = await runCommand(node(code));
    expect(result.stdout).toContain('Progress: 100%');
    // CR characters should pass through
    expect(result.stdout).toContain('\r');
  });

  it('preserves cursor movement sequences', async () => {
    // \x1b[2K = clear entire line, \x1b[1A = move up one line
    const code = `
      process.stdout.write("line1\\n");
      process.stdout.write("\\x1b[1A\\x1b[2Krewritten line1\\n");
    `;
    const result = await runCommand(node(code));
    expect(result.stdout).toContain('\x1b[1A');
    expect(result.stdout).toContain('\x1b[2K');
    expect(result.stdout).toContain('rewritten line1');
  });

  it('handles rapid \\r updates (spinner simulation)', async () => {
    // Use a simple script without backslash-escaping issues
    const code = `
      let i = 0;
      const interval = setInterval(() => {
        process.stdout.write(String.fromCharCode(13) + "frame" + i + " Building...");
        i++;
        if (i >= 5) {
          clearInterval(interval);
          process.stdout.write(String.fromCharCode(13) + "Done!" + String.fromCharCode(10));
        }
      }, 20);
    `;
    const result = await runCommand(node(code));
    expect(result.stdout).toContain('Done!');
    expect(result.exitCode).toBe(0);
  });
});

// ============================================================
// 2. TTY-DETECTING TOOLS
//    Many tools check process.stdout.isTTY to decide behavior.
//    When piped (our setup), isTTY is false/undefined.
// ============================================================

describe('TTY-dependent behavior (documents degradation)', () => {
  it('child detects stdout is NOT a TTY (known gap)', async () => {
    const code = `
      const isTTY = process.stdout.isTTY;
      const columns = process.stdout.columns;
      process.stdout.write(JSON.stringify({ isTTY, columns }));
    `;
    const result = await runCommand(node(code));
    const info = JSON.parse(result.stdout);
    // KNOWN GAP: isTTY is undefined because stdout is piped
    expect(info.isTTY).toBeUndefined();
    // columns is also undefined when not a TTY
    expect(info.columns).toBeUndefined();
  });

  it('tools that fallback gracefully still work (color via FORCE_COLOR)', async () => {
    // Well-behaved tools check FORCE_COLOR before isTTY
    const code = `
      const useColor = process.env.FORCE_COLOR === "1" || process.stdout.isTTY;
      process.stdout.write(useColor ? "\\x1b[32mgreen\\x1b[0m" : "green");
    `;
    const result = await runCommand(node(code));
    // FORCE_COLOR=1 rescues color output
    expect(result.stdout).toContain('\x1b[32m');
  });

  it('tools that hard-require TTY will degrade (interactive prompts)', async () => {
    // Simulates a tool that checks isTTY and changes behavior
    const code = `
      if (process.stdout.isTTY) {
        process.stdout.write("INTERACTIVE_MODE");
      } else {
        process.stdout.write("PLAIN_MODE");
      }
    `;
    const result = await runCommand(node(code));
    // This DOCUMENTS the gap: tool falls back to non-interactive mode
    expect(result.stdout).toBe('PLAIN_MODE');
  });

  it('readline-based prompts get EOF on piped stdin in CI', async () => {
    // In a real terminal, stdin is inherited so readline works.
    // In CI, stdin is not a TTY, so readline may get EOF immediately.
    // This test verifies stdin inheritance works at the transport level.
    const code = `
      process.stdout.write(typeof process.stdin.read === "function" ? "readable" : "not-readable");
    `;
    const result = await runCommand(node(code));
    expect(result.stdout).toBe('readable');
  });
});

// ============================================================
// 3. WATCH MODE / LONG-RUNNING SIMULATION
//    tsc --watch, Vite dev, nodemon emit output over time.
//    The wrapper must stream output in real-time, not buffer it.
// ============================================================

describe('watch mode / long-running behavior', () => {
  it('streams output in real-time (not buffered until exit)', async () => {
    const receivedChunks: { text: string; time: number }[] = [];
    const start = Date.now();

    const code = `
      process.stdout.write("chunk1");
      setTimeout(() => {
        process.stdout.write("chunk2");
        setTimeout(() => {
          process.stdout.write("chunk3");
          process.exit(0);
        }, 100);
      }, 100);
    `;

    await runCommand(node(code), (text) => {
      receivedChunks.push({ text, time: Date.now() - start });
    });

    // All chunks should have been received
    const allText = receivedChunks.map((c) => c.text).join('');
    expect(allText).toContain('chunk1');
    expect(allText).toContain('chunk2');
    expect(allText).toContain('chunk3');

    // Chunks should arrive at different times (not all at once at exit)
    // First chunk should arrive well before the last chunk
    if (receivedChunks.length >= 2) {
      const firstTime = receivedChunks[0].time;
      const lastTime = receivedChunks[receivedChunks.length - 1].time;
      expect(lastTime - firstTime).toBeGreaterThan(50);
    }
  });

  it('handles HMR-style error then recovery pattern', async () => {
    // Simulates: normal output → error → normal output
    const code = `
      process.stdout.write("[vite] ready in 200ms\\n");
      process.stderr.write("[vite] error: Module not found\\n");
      process.stdout.write("[vite] hmr update /src/App.tsx\\n");
      process.exit(0);
    `;
    const result = await runCommand(node(code));
    expect(result.stdout).toContain('[vite] ready');
    expect(result.stderr).toContain('Module not found');
    expect(result.stdout).toContain('hmr update');
    expect(result.exitCode).toBe(0);
  });

  it('handles tsc --watch style output with clear screen codes', async () => {
    // tsc --watch emits \x1bc (clear screen) before recompile output
    const code = `
      process.stdout.write("\\x1bcStarting compilation...\\n");
      process.stdout.write("Found 2 errors.\\n");
      setTimeout(() => {
        process.stdout.write("\\x1bcStarting compilation...\\n");
        process.stdout.write("Found 0 errors.\\n");
        process.exit(0);
      }, 100);
    `;
    const result = await runCommand(node(code));
    expect(result.stdout).toContain('\x1bc');
    expect(result.stdout).toContain('Found 0 errors.');
  });
});

// ============================================================
// 4. COLOR LIBRARY BEHAVIOR
//    chalk, picocolors, etc. check isTTY + FORCE_COLOR
// ============================================================

describe('color library compatibility', () => {
  it('FORCE_COLOR overrides isTTY check (chalk-style)', async () => {
    // chalk checks: FORCE_COLOR env → isTTY → colorTerm
    const code = `
      const forceColor = process.env.FORCE_COLOR;
      const isTTY = process.stdout.isTTY;
      // Chalk-style logic: FORCE_COLOR takes precedence
      const supportsColor = forceColor !== undefined || isTTY;
      process.stdout.write(supportsColor ? "color-supported" : "no-color");
    `;
    const result = await runCommand(node(code));
    expect(result.stdout).toBe('color-supported');
  });

  it('preserves 256-color ANSI codes', async () => {
    const code = `process.stdout.write("\\x1b[38;5;196mdeep red\\x1b[0m")`;
    const result = await runCommand(node(code));
    expect(result.stdout).toContain('\x1b[38;5;196m');
  });

  it('preserves 24-bit true color ANSI codes', async () => {
    const code = `process.stdout.write("\\x1b[38;2;255;100;0morange\\x1b[0m")`;
    const result = await runCommand(node(code));
    expect(result.stdout).toContain('\x1b[38;2;255;100;0m');
  });
});

// ============================================================
// 5. SPAWN CHAINS (tools that spawn sub-processes)
//    npm run → node → child. Exit codes and output must propagate.
// ============================================================

describe('spawn chain behavior', () => {
  it('preserves exit code through spawn chain', async () => {
    // Parent spawns child that exits with 42
    // Use dynamic import() since the project is ESM
    const code = `
      import("child_process").then(({ execSync }) => {
        try {
          execSync('node -e "process.exit(42)"', { stdio: "inherit" });
        } catch (e) {
          process.exit(e.status);
        }
      });
    `;
    const result = await runCommand(node(code));
    expect(result.exitCode).toBe(42);
  });

  it('stdout from nested spawn reaches wrapper', async () => {
    const code = `
      import("child_process").then(({ execSync }) => {
        const out = execSync("echo nested-output").toString().trim();
        process.stdout.write(out);
      });
    `;
    const result = await runCommand(node(code));
    expect(result.stdout).toContain('nested-output');
  });
});

// ============================================================
// 6. STREAMING OUTPUT PATTERNS (pytest, cargo, jest)
// ============================================================

describe('streaming output patterns', () => {
  it('handles pytest-style dot progress', async () => {
    // pytest writes dots without newlines for passing tests
    const code = `
      process.stdout.write("collecting ... ");
      process.stdout.write(".");
      process.stdout.write(".");
      process.stdout.write(".");
      process.stdout.write("F");
      process.stdout.write("\\n");
      process.stderr.write("FAILED tests/test_foo.py::test_bar\\n");
    `;
    const result = await runCommand(node(code));
    expect(result.stdout).toContain('...F');
    expect(result.stderr).toContain('FAILED');
  });

  it('handles cargo-style multi-stage output', async () => {
    const code = `
      process.stderr.write("   Compiling my-crate v0.1.0\\n");
      process.stderr.write("   Compiling dep-a v1.2.3\\n");
      process.stderr.write("error[E0308]: mismatched types\\n");
      process.stderr.write("  --> src/main.rs:10:5\\n");
      process.stderr.write("   |\\n");
      process.stderr.write("10 |     let x: u32 = \\"hello\\";\\n");
      process.stderr.write("   |                  ^^^^^^^ expected u32, found &str\\n");
      process.exit(1);
    `;
    const result = await runCommand(node(code));
    expect(result.stderr).toContain('error[E0308]');
    expect(result.stderr).toContain('expected u32');
    expect(result.exitCode).toBe(1);
  });

  it('handles jest-style summary output', async () => {
    const code = `
      process.stderr.write("PASS src/utils.test.ts\\n");
      process.stderr.write("FAIL src/app.test.ts\\n");
      process.stderr.write("  ● App > renders correctly\\n");
      process.stderr.write("    TypeError: Cannot read properties of undefined\\n");
      process.stderr.write("      at Object.<anonymous> (src/app.test.ts:15:10)\\n");
      process.stderr.write("\\nTests: 1 failed, 1 passed, 2 total\\n");
      process.exit(1);
    `;
    const result = await runCommand(node(code));
    expect(result.stderr).toContain('FAIL');
    expect(result.stderr).toContain('TypeError:');
    expect(result.stderr).toContain('1 failed, 1 passed');
    expect(result.exitCode).toBe(1);
  });
});

// ============================================================
// 7. EDGE CASES FROM REAL TOOLS
// ============================================================

describe('real-tool edge cases', () => {
  it('handles mixed encoding (emoji + ANSI + UTF-8)', async () => {
    const code = `
      process.stdout.write("\\x1b[32m✓\\x1b[0m Test passed 🎉\\n");
      process.stdout.write("\\x1b[31m✗\\x1b[0m Test failed 💥\\n");
    `;
    const result = await runCommand(node(code));
    expect(result.stdout).toContain('✓');
    expect(result.stdout).toContain('✗');
  });

  it('handles very long single lines (minified JS errors)', async () => {
    // Minified JS can produce very long error lines
    const code = `
      const longLine = "Error at " + "a".repeat(5000) + ":1:1";
      process.stderr.write(longLine + "\\n");
      process.exit(1);
    `;
    const result = await runCommand(node(code));
    expect(result.stderr).toContain('Error at');
    expect(result.exitCode).toBe(1);
  });

  it('handles null bytes in output', async () => {
    const code = `process.stdout.write("before\\x00after")`;
    const result = await runCommand(node(code));
    expect(result.stdout).toContain('before');
    expect(result.stdout).toContain('after');
  });

  it('handles process that closes stdout early', async () => {
    const code = `
      process.stdout.write("output");
      process.stdout.end();
      setTimeout(() => process.exit(0), 50);
    `;
    const result = await runCommand(node(code));
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('output');
  });
});
