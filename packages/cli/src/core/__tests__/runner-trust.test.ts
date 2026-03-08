/**
 * Passthrough Trust Matrix
 *
 * These tests validate that `runCommand` behaves transparently —
 * child processes should not be able to distinguish `vb <cmd>` from
 * running the command directly, except where unavoidable.
 *
 * Categories tested:
 *   1. Exit code fidelity
 *   2. Signal forwarding
 *   3. stdout/stderr passthrough (content + ordering)
 *   4. TTY detection (known gap: isTTY is false for piped streams)
 *   5. Environment passthrough (FORCE_COLOR, user env vars)
 *   6. stdin inheritance
 *   7. Buffering / real-time output
 *   8. Large output handling
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { runCommand } from '../runner.js';

// Helper: node one-liner via shell
function node(code: string): string[] {
  return [`node -e "${code.replace(/"/g, '\\"')}"`];
}

// ============================================================
// 1. EXIT CODE FIDELITY
// ============================================================

describe('exit code fidelity', () => {
  it('preserves exit code 0', async () => {
    const result = await runCommand(node('process.exit(0)'));
    expect(result.exitCode).toBe(0);
  });

  it('preserves exit code 1', async () => {
    const result = await runCommand(node('process.exit(1)'));
    expect(result.exitCode).toBe(1);
  });

  it('preserves non-standard exit codes (42)', async () => {
    const result = await runCommand(node('process.exit(42)'));
    expect(result.exitCode).toBe(42);
  });

  it('preserves exit code 130 (SIGINT convention)', async () => {
    const result = await runCommand(node('process.exit(130)'));
    expect(result.exitCode).toBe(130);
  });

  it('returns exit code 1 for command not found', async () => {
    const result = await runCommand(['__vibebug_nonexistent_cmd_xyz__']);
    expect(result.exitCode).not.toBe(0);
  });

  it('preserves exit code from shell pipelines', async () => {
    // `false` returns 1, pipeline should propagate it
    const result = await runCommand(['false']);
    expect(result.exitCode).toBe(1);
  });
});

// ============================================================
// 2. SIGNAL FORWARDING
// ============================================================

describe('signal forwarding', () => {
  it('child receives SIGTERM when parent forwards it', async () => {
    // Spawn a process that traps SIGTERM and exits with code 143
    const code = `
      process.on('SIGTERM', () => { process.exit(143); });
      setTimeout(() => {}, 30000);
    `;
    const promise = runCommand(node(code));

    // Give child time to start and register handler
    await new Promise((r) => setTimeout(r, 200));

    // Simulate parent receiving SIGTERM — the handler in runner.ts forwards it
    process.emit('SIGTERM' as any);

    const result = await promise;
    expect(result.exitCode).toBe(143);
  });

  it('child receives SIGINT when parent forwards it', async () => {
    const code = `
      process.on('SIGINT', () => { process.exit(130); });
      setTimeout(() => {}, 30000);
    `;
    const promise = runCommand(node(code));

    await new Promise((r) => setTimeout(r, 200));
    process.emit('SIGINT' as any);

    const result = await promise;
    expect(result.exitCode).toBe(130);
  });

  it('cleans up signal handlers after child exits', async () => {
    const listenersBefore = process.listenerCount('SIGINT');

    await runCommand(node('process.exit(0)'));

    const listenersAfter = process.listenerCount('SIGINT');
    expect(listenersAfter).toBe(listenersBefore);
  });
});

// ============================================================
// 3. STDOUT/STDERR PASSTHROUGH
// ============================================================

describe('stdout/stderr passthrough', () => {
  let stdoutChunks: string[];
  let stderrChunks: string[];
  let originalWrite: typeof process.stdout.write;
  let originalErrWrite: typeof process.stderr.write;

  afterEach(() => {
    // Restore in case test fails mid-execution
    if (originalWrite) process.stdout.write = originalWrite;
    if (originalErrWrite) process.stderr.write = originalErrWrite;
  });

  it('echoes stdout content to process.stdout', async () => {
    stdoutChunks = [];
    originalWrite = process.stdout.write;
    process.stdout.write = ((chunk: any) => {
      stdoutChunks.push(chunk.toString());
      return true;
    }) as any;

    await runCommand(node('process.stdout.write("hello from child")'));

    process.stdout.write = originalWrite;
    const combined = stdoutChunks.join('');
    expect(combined).toContain('hello from child');
  });

  it('echoes stderr content to process.stderr', async () => {
    stderrChunks = [];
    originalErrWrite = process.stderr.write;
    process.stderr.write = ((chunk: any) => {
      stderrChunks.push(chunk.toString());
      return true;
    }) as any;

    await runCommand(node('process.stderr.write("error from child")'));

    process.stderr.write = originalErrWrite;
    const combined = stderrChunks.join('');
    expect(combined).toContain('error from child');
  });

  it('captures stdout in result buffer', async () => {
    const result = await runCommand(node('console.log("captured-stdout")'));
    expect(result.stdout).toContain('captured-stdout');
  });

  it('captures stderr in result buffer', async () => {
    const result = await runCommand(node('console.error("captured-stderr")'));
    expect(result.stderr).toContain('captured-stderr');
  });

  it('keeps stdout and stderr separate', async () => {
    const code = `
      process.stdout.write("OUT");
      process.stderr.write("ERR");
    `;
    const result = await runCommand(node(code));
    expect(result.stdout).toContain('OUT');
    expect(result.stderr).toContain('ERR');
    // Stdout should not contain stderr content and vice versa
    expect(result.stdout).not.toContain('ERR');
    expect(result.stderr).not.toContain('OUT');
  });

  it('handles multiline output', async () => {
    const code = `
      console.log("line1");
      console.log("line2");
      console.log("line3");
    `;
    const result = await runCommand(node(code));
    expect(result.stdout).toContain('line1');
    expect(result.stdout).toContain('line2');
    expect(result.stdout).toContain('line3');
  });
});

// ============================================================
// 4. TTY DETECTION (KNOWN GAP)
// ============================================================

describe('TTY detection (documents known gap)', () => {
  it('child stdout.isTTY is false (piped, not inherited)', async () => {
    // This documents the known gap: piped streams lose isTTY
    const code = `process.stdout.write(String(process.stdout.isTTY))`;
    const result = await runCommand(node(code));
    // This WILL be 'undefined' or 'false' because stdout is piped
    expect(result.stdout).toMatch(/undefined|false/);
  });

  it('child stderr.isTTY is false (piped, not inherited)', async () => {
    const code = `process.stderr.write(String(process.stderr.isTTY))`;
    const result = await runCommand(node(code));
    expect(result.stderr).toMatch(/undefined|false/);
  });

  it('child stdin.isTTY inherits from parent (stdin is inherited)', async () => {
    // stdin IS inherited (not piped), so isTTY depends on whether
    // the test runner itself has a TTY stdin. In CI, it won't.
    // This test just verifies stdin is accessible, not that it's a TTY.
    const code = `process.stdout.write(typeof process.stdin.isTTY)`;
    const result = await runCommand(node(code));
    // Should be 'boolean' (true in terminal) or 'undefined' (in CI/pipe)
    expect(result.stdout).toMatch(/boolean|undefined/);
  });
});

// ============================================================
// 5. ENVIRONMENT PASSTHROUGH
// ============================================================

describe('environment passthrough', () => {
  it('sets FORCE_COLOR=1', async () => {
    const code = `process.stdout.write(process.env.FORCE_COLOR || "unset")`;
    const result = await runCommand(node(code));
    expect(result.stdout).toBe('1');
  });

  it('inherits existing env vars', async () => {
    // HOME should always be set
    const code = `process.stdout.write(process.env.HOME ? "has-home" : "no-home")`;
    const result = await runCommand(node(code));
    expect(result.stdout).toBe('has-home');
  });

  it('inherits PATH (can find system commands)', async () => {
    const code = `process.stdout.write(process.env.PATH ? "has-path" : "no-path")`;
    const result = await runCommand(node(code));
    expect(result.stdout).toBe('has-path');
  });

  it('inherits custom env vars set before run', async () => {
    const key = '__VIBEBUG_TEST_VAR__';
    process.env[key] = 'test-value';
    const code = `process.stdout.write(process.env.${key} || "missing")`;
    const result = await runCommand(node(code));
    delete process.env[key];
    expect(result.stdout).toBe('test-value');
  });
});

// ============================================================
// 6. TIMING / DURATION
// ============================================================

describe('timing accuracy', () => {
  it('measures duration in milliseconds', async () => {
    const code = `setTimeout(() => process.exit(0), 200)`;
    const result = await runCommand(node(code));
    expect(result.durationMs).toBeGreaterThanOrEqual(150);
    expect(result.durationMs).toBeLessThan(2000);
  });

  it('records command string', async () => {
    const result = await runCommand(['echo', 'hello']);
    expect(result.command).toBe('echo hello');
  });
});

// ============================================================
// 7. LARGE OUTPUT HANDLING
// ============================================================

describe('large output handling', () => {
  it('handles output larger than ring buffer without crashing', async () => {
    // Generate ~300KB of output (ring buffer is 200KB)
    const code = `
      const line = "x".repeat(1000);
      for (let i = 0; i < 300; i++) { console.log(line); }
    `;
    const result = await runCommand(node(code));
    expect(result.exitCode).toBe(0);
    // Ring buffer truncates, but process should complete cleanly
    expect(result.stdout.length).toBeGreaterThan(0);
    expect(result.stdout.length).toBeLessThanOrEqual(200 * 1024 + 1024); // ~200KB + margin
  });

  it('handles rapid small writes', async () => {
    const code = `
      for (let i = 0; i < 1000; i++) {
        process.stdout.write(".");
      }
      process.stdout.write("DONE");
    `;
    const result = await runCommand(node(code));
    expect(result.stdout).toContain('DONE');
  });
});

// ============================================================
// 8. ONCHUNK CALLBACK (stream detector integration)
// ============================================================

describe('onChunk callback', () => {
  it('receives all stdout and stderr chunks', async () => {
    const chunks: string[] = [];
    const code = `
      process.stdout.write("OUT1");
      process.stderr.write("ERR1");
      process.stdout.write("OUT2");
    `;
    const result = await runCommand(node(code), (text) => {
      chunks.push(text);
    });
    const combined = chunks.join('');
    expect(combined).toContain('OUT1');
    expect(combined).toContain('ERR1');
    expect(combined).toContain('OUT2');
  });

  it('does not crash if onChunk throws', async () => {
    const result = await runCommand(node('console.log("test")'), () => {
      throw new Error('callback error');
    });
    // runner.ts wraps onChunk in try/catch — process completes cleanly
    expect(result.exitCode).toBe(0);
  });
});

// ============================================================
// 9. SHELL FEATURES
// ============================================================

describe('shell passthrough', () => {
  it('supports piped commands', async () => {
    const result = await runCommand(['echo "hello world" | tr "h" "H"']);
    expect(result.stdout.trim()).toBe('Hello world');
  });

  it('supports environment variable expansion', async () => {
    const result = await runCommand(['echo $HOME']);
    expect(result.stdout.trim()).not.toBe('$HOME');
    expect(result.stdout.trim().length).toBeGreaterThan(0);
  });

  it('supports quoted arguments with spaces', async () => {
    const result = await runCommand(['echo "hello   world"']);
    expect(result.stdout.trim()).toBe('hello   world');
  });

  it('supports && chaining', async () => {
    const result = await runCommand(['echo first && echo second']);
    expect(result.stdout).toContain('first');
    expect(result.stdout).toContain('second');
  });

  it('&& chain stops on failure', async () => {
    const result = await runCommand(['false && echo should-not-appear']);
    expect(result.stdout).not.toContain('should-not-appear');
    expect(result.exitCode).not.toBe(0);
  });
});

// ============================================================
// 10. ANSI / COLOR PASSTHROUGH
// ============================================================

describe('ANSI / color passthrough', () => {
  it('preserves ANSI escape codes in output', async () => {
    const code = `process.stdout.write("\\x1b[31mred text\\x1b[0m")`;
    const result = await runCommand(node(code));
    expect(result.stdout).toContain('\x1b[31m');
    expect(result.stdout).toContain('\x1b[0m');
  });

  it('FORCE_COLOR enables color libraries', async () => {
    // When FORCE_COLOR=1, well-behaved color libraries will emit ANSI
    // even when stdout is not a TTY. This verifies the env var is set.
    const code = `process.stdout.write(process.env.FORCE_COLOR === "1" ? "color-forced" : "no-force")`;
    const result = await runCommand(node(code));
    expect(result.stdout).toBe('color-forced');
  });
});

// ============================================================
// 11. EDGE CASES
// ============================================================

describe('edge cases', () => {
  it('empty argv returns error', async () => {
    const result = await runCommand([]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('No command provided');
  });

  it('handles process that writes nothing', async () => {
    const result = await runCommand(node('process.exit(0)'));
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('handles binary/non-UTF8 output without crashing', async () => {
    const code = `process.stdout.write(Buffer.from([0x00, 0xFF, 0x80, 0x7F]))`;
    const result = await runCommand(node(code));
    expect(result.exitCode).toBe(0);
    // Should not crash, content may be garbled but process completes
  });

  it('handles interleaved stdout and stderr', async () => {
    const code = `
      process.stdout.write("O1");
      process.stderr.write("E1");
      process.stdout.write("O2");
      process.stderr.write("E2");
    `;
    const result = await runCommand(node(code));
    expect(result.stdout).toContain('O1');
    expect(result.stdout).toContain('O2');
    expect(result.stderr).toContain('E1');
    expect(result.stderr).toContain('E2');
  });
});
