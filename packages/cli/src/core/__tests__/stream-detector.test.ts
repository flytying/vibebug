/**
 * Stream Detector Tests
 *
 * Validates that the StreamDetector:
 * 1. Fires on real errors (true positives)
 * 2. Does NOT fire on benign output (false positives)
 * 3. Respects cooldown between duplicate captures
 * 4. Respects quiet timeout for block finalization
 * 5. Caps error blocks at MAX_ERROR_BLOCK_LINES
 * 6. Tracks captured signatures for dedup with exit-code capture
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { StreamDetector } from '../stream-detector.js';
import type { ErrorBlock } from '../stream-detector.js';

const FIXTURES = resolve(import.meta.dirname, '../../../fixtures/logs');

function readFixture(relativePath: string): string {
  return readFileSync(resolve(FIXTURES, relativePath), 'utf-8');
}

// ============================================================
// TRUE POSITIVES — real errors that MUST trigger capture
// ============================================================

describe('true positives — real errors trigger capture', () => {
  it('TypeScript compiler error triggers', () => {
    const captured: ErrorBlock[] = [];
    const detector = new StreamDetector('npx tsc', (b) => captured.push(b));
    detector.feed(readFixture('tsc/type-error-v1.txt'));
    detector.flush();
    detector.destroy();
    expect(captured.length).toBe(1);
    expect(captured[0].signature).toHaveLength(16);
  });

  it('Next.js "Failed to compile" triggers', () => {
    const captured: ErrorBlock[] = [];
    const detector = new StreamDetector('next build', (b) => captured.push(b));
    detector.feed(readFixture('nextjs/build-error-v1.txt'));
    detector.flush();
    detector.destroy();
    expect(captured.length).toBe(1);
  });

  it('Next.js runtime error with ⨯ prefix triggers', () => {
    const captured: ErrorBlock[] = [];
    const detector = new StreamDetector('next dev', (b) => captured.push(b));
    detector.feed(readFixture('nextjs/runtime-error.txt'));
    detector.flush();
    detector.destroy();
    expect(captured.length).toBeGreaterThanOrEqual(1);
  });

  it('Python ImportError triggers', () => {
    const captured: ErrorBlock[] = [];
    const detector = new StreamDetector('pytest', (b) => captured.push(b));
    detector.feed('ImportError: No module named \'requests\'\n');
    detector.flush();
    detector.destroy();
    expect(captured.length).toBe(1);
  });

  it('Python Traceback triggers', () => {
    const captured: ErrorBlock[] = [];
    const detector = new StreamDetector('python app.py', (b) => captured.push(b));
    detector.feed('Traceback (most recent call last):\n  File "app.py", line 10, in <module>\n    connect()\nConnectionRefusedError: Connection refused\n');
    detector.flush();
    detector.destroy();
    expect(captured.length).toBe(1);
  });

  it('Python ConnectionRefusedError triggers', () => {
    const captured: ErrorBlock[] = [];
    const detector = new StreamDetector('python app.py', (b) => captured.push(b));
    detector.feed('ConnectionRefusedError: Connection refused\n');
    detector.flush();
    detector.destroy();
    expect(captured.length).toBe(1);
  });

  it('Jest FAIL triggers', () => {
    const captured: ErrorBlock[] = [];
    const detector = new StreamDetector('npx jest', (b) => captured.push(b));
    detector.feed(readFixture('jest/test-failure-v1.txt'));
    detector.flush();
    detector.destroy();
    expect(captured.length).toBeGreaterThanOrEqual(1);
  });

  it('pnpm ERR_PNPM_ error triggers', () => {
    const captured: ErrorBlock[] = [];
    const detector = new StreamDetector('pnpm install', (b) => captured.push(b));
    detector.feed(readFixture('pnpm/peer-dep-conflict.txt'));
    detector.flush();
    detector.destroy();
    expect(captured.length).toBeGreaterThanOrEqual(1);
  });

  it('npm ERR! triggers', () => {
    const captured: ErrorBlock[] = [];
    const detector = new StreamDetector('npm install', (b) => captured.push(b));
    detector.feed(readFixture('npm/install-eacces.txt'));
    detector.flush();
    detector.destroy();
    expect(captured.length).toBeGreaterThanOrEqual(1);
  });

  it('Rust compiler error triggers', () => {
    const captured: ErrorBlock[] = [];
    const detector = new StreamDetector('cargo build', (b) => captured.push(b));
    detector.feed(readFixture('rust/compile-error-v1.txt'));
    detector.flush();
    detector.destroy();
    expect(captured.length).toBeGreaterThanOrEqual(1);
  });

  it('Go panic triggers', () => {
    const captured: ErrorBlock[] = [];
    const detector = new StreamDetector('go run .', (b) => captured.push(b));
    detector.feed(readFixture('go/panic-v1.txt'));
    detector.flush();
    detector.destroy();
    expect(captured.length).toBeGreaterThanOrEqual(1);
  });

  it('Vite/Rollup resolve error triggers', () => {
    const captured: ErrorBlock[] = [];
    const detector = new StreamDetector('npx vite build', (b) => captured.push(b));
    detector.feed(readFixture('vite/build-fail-v1.txt'));
    detector.flush();
    detector.destroy();
    expect(captured.length).toBeGreaterThanOrEqual(1);
  });

  it('ESLint config error triggers', () => {
    const captured: ErrorBlock[] = [];
    const detector = new StreamDetector('npx eslint .', (b) => captured.push(b));
    detector.feed(readFixture('eslint/config-error.txt'));
    detector.flush();
    detector.destroy();
    expect(captured.length).toBeGreaterThanOrEqual(1);
  });

  it('generic ERROR at line start triggers', () => {
    const captured: ErrorBlock[] = [];
    const detector = new StreamDetector('node app.js', (b) => captured.push(b));
    detector.feed('ERROR failed to bind to port 3000\n');
    detector.flush();
    detector.destroy();
    expect(captured.length).toBe(1);
  });

  it('Segmentation fault triggers', () => {
    const captured: ErrorBlock[] = [];
    const detector = new StreamDetector('node app.js', (b) => captured.push(b));
    detector.feed('Segmentation fault (core dumped)\n');
    detector.flush();
    detector.destroy();
    expect(captured.length).toBe(1);
  });

  it('ANSI-colored error triggers', () => {
    const captured: ErrorBlock[] = [];
    const detector = new StreamDetector('npx vite build', (b) => captured.push(b));
    detector.feed(readFixture('vite/build-fail-ansi.txt'));
    detector.flush();
    detector.destroy();
    expect(captured.length).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================
// FALSE POSITIVES — benign output that MUST NOT trigger
// ============================================================

describe('false positives — benign output does not trigger', () => {
  it('Vite HMR success output does not trigger', () => {
    const captured: ErrorBlock[] = [];
    const detector = new StreamDetector('npx vite', (b) => captured.push(b));
    detector.feed(readFixture('benign/vite-hmr-success.txt'));
    detector.flush();
    detector.destroy();
    expect(captured.length).toBe(0);
  });

  it('Next.js ready/compiled output does not trigger', () => {
    const captured: ErrorBlock[] = [];
    const detector = new StreamDetector('next dev', (b) => captured.push(b));
    detector.feed(readFixture('benign/nextjs-ready.txt'));
    detector.flush();
    detector.destroy();
    expect(captured.length).toBe(0);
  });

  it('logging framework ERROR with recovery language does not trigger', () => {
    const captured: ErrorBlock[] = [];
    const detector = new StreamDetector('node app.js', (b) => captured.push(b));
    detector.feed(readFixture('benign/logging-framework-noise.txt'));
    detector.flush();
    detector.destroy();
    expect(captured.length).toBe(0);
  });

  it('"ERROR successfully connected" does not trigger', () => {
    const captured: ErrorBlock[] = [];
    const detector = new StreamDetector('node app.js', (b) => captured.push(b));
    detector.feed('ERROR successfully connected to database\n');
    detector.flush();
    detector.destroy();
    expect(captured.length).toBe(0);
  });

  it('"ERROR reconnecting to Redis" does not trigger', () => {
    const captured: ErrorBlock[] = [];
    const detector = new StreamDetector('node app.js', (b) => captured.push(b));
    detector.feed('ERROR reconnecting to Redis cluster\n');
    detector.flush();
    detector.destroy();
    expect(captured.length).toBe(0);
  });

  it('"ERROR Redis client recovered" does not trigger', () => {
    const captured: ErrorBlock[] = [];
    const detector = new StreamDetector('node app.js', (b) => captured.push(b));
    detector.feed('ERROR Redis client recovered successfully\n');
    detector.flush();
    detector.destroy();
    expect(captured.length).toBe(0);
  });

  it('"ERROR server started on port" does not trigger', () => {
    const captured: ErrorBlock[] = [];
    const detector = new StreamDetector('node app.js', (b) => captured.push(b));
    detector.feed('ERROR server started on port 3000\n');
    detector.flush();
    detector.destroy();
    expect(captured.length).toBe(0);
  });

  it('normal build output does not trigger', () => {
    const captured: ErrorBlock[] = [];
    const detector = new StreamDetector('npm run build', (b) => captured.push(b));
    detector.feed('Compiling TypeScript...\nBundling 203 modules...\nBuild completed in 4.2s\n');
    detector.flush();
    detector.destroy();
    expect(captured.length).toBe(0);
  });

  it('"error" in a path or filename does not trigger', () => {
    const captured: ErrorBlock[] = [];
    const detector = new StreamDetector('npm run build', (b) => captured.push(b));
    detector.feed('Processing src/components/error-boundary.tsx\nCompiling src/pages/error.tsx\n');
    detector.flush();
    detector.destroy();
    expect(captured.length).toBe(0);
  });
});

// ============================================================
// COOLDOWN — duplicate suppression
// ============================================================

describe('cooldown — duplicate suppression', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('same error twice within cooldown produces only one capture', () => {
    const captured: ErrorBlock[] = [];
    const detector = new StreamDetector('npx tsc', (b) => captured.push(b), {
      quietTimeoutMs: 100,
      cooldownMs: 60000,
    });

    detector.feed('error TS2322: Type \'string\' is not assignable to type \'number\'.\n');
    vi.advanceTimersByTime(200); // trigger quiet timeout → first capture
    expect(captured.length).toBe(1);

    detector.feed('error TS2322: Type \'string\' is not assignable to type \'number\'.\n');
    vi.advanceTimersByTime(200); // same error again
    expect(captured.length).toBe(1); // still 1, cooldown blocked it

    detector.destroy();
  });

  it('same error after cooldown expires produces second capture', () => {
    const captured: ErrorBlock[] = [];
    const detector = new StreamDetector('npx tsc', (b) => captured.push(b), {
      quietTimeoutMs: 100,
      cooldownMs: 1000, // short cooldown for testing
    });

    detector.feed('error TS2322: Type \'string\' is not assignable to type \'number\'.\n');
    vi.advanceTimersByTime(200);
    expect(captured.length).toBe(1);

    vi.advanceTimersByTime(1100); // exceed cooldown

    detector.feed('error TS2322: Type \'string\' is not assignable to type \'number\'.\n');
    vi.advanceTimersByTime(200);
    expect(captured.length).toBe(2);

    detector.destroy();
  });

  it('different errors within cooldown both capture', () => {
    const captured: ErrorBlock[] = [];
    const detector = new StreamDetector('npx tsc', (b) => captured.push(b), {
      quietTimeoutMs: 100,
      cooldownMs: 60000,
    });

    detector.feed('error TS2322: Type \'string\' is not assignable to type \'number\'.\n');
    vi.advanceTimersByTime(200);

    detector.feed('error TS2345: Argument of type \'{}\' is not assignable to parameter.\n');
    vi.advanceTimersByTime(200);

    expect(captured.length).toBe(2);
    expect(captured[0].signature).not.toBe(captured[1].signature);

    detector.destroy();
  });
});

// ============================================================
// QUIET TIMEOUT — block finalization timing
// ============================================================

describe('quiet timeout — block finalization', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('error block finalizes after quiet timeout', () => {
    const captured: ErrorBlock[] = [];
    const detector = new StreamDetector('npx tsc', (b) => captured.push(b), {
      quietTimeoutMs: 500,
    });

    detector.feed('error TS2322: Type mismatch\n');
    expect(captured.length).toBe(0); // not yet

    vi.advanceTimersByTime(600); // quiet timeout fires
    expect(captured.length).toBe(1);

    detector.destroy();
  });

  it('continued output resets quiet timer and extends block', () => {
    const captured: ErrorBlock[] = [];
    const detector = new StreamDetector('npx tsc', (b) => captured.push(b), {
      quietTimeoutMs: 500,
    });

    detector.feed('error TS2322: Type mismatch\n');
    vi.advanceTimersByTime(300); // halfway
    detector.feed('  at src/foo.ts:10:5\n'); // more output, resets timer
    vi.advanceTimersByTime(300); // only 300ms since last output
    expect(captured.length).toBe(0); // still collecting

    vi.advanceTimersByTime(300); // now 600ms since last output
    expect(captured.length).toBe(1);
    // Block contains both content lines plus empty strings from \n splitting
    expect(captured[0].lines.length).toBeGreaterThanOrEqual(2);

    detector.destroy();
  });

  it('flush() finalizes pending block immediately', () => {
    const captured: ErrorBlock[] = [];
    const detector = new StreamDetector('npx tsc', (b) => captured.push(b), {
      quietTimeoutMs: 5000, // very long
    });

    detector.feed('error TS2322: Type mismatch\n');
    expect(captured.length).toBe(0);

    detector.flush(); // process exited
    expect(captured.length).toBe(1);

    detector.destroy();
  });
});

// ============================================================
// MAX LINES — error block size cap
// ============================================================

describe('max lines — block size cap', () => {
  it('caps error block at MAX_ERROR_BLOCK_LINES (50)', () => {
    const captured: ErrorBlock[] = [];
    const detector = new StreamDetector('cargo build', (b) => captured.push(b));

    // Feed an error header + 60 lines of content
    const lines = ['error[E0308]: mismatched types'];
    for (let i = 1; i <= 60; i++) {
      lines.push(`  --> src/file${i}.rs:${i}:5`);
    }
    detector.feed(lines.join('\n') + '\n');
    detector.destroy();

    expect(captured.length).toBe(1);
    expect(captured[0].lines.length).toBeLessThanOrEqual(50);
  });
});

// ============================================================
// SIGNATURE TRACKING — dedup with exit-code capture
// ============================================================

describe('signature tracking', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('getCapturedSignatures returns all captured signatures', () => {
    const detector = new StreamDetector('npx tsc', () => {}, {
      quietTimeoutMs: 100,
    });

    detector.feed('error TS2322: Type mismatch\n');
    vi.advanceTimersByTime(200);

    detector.feed('error TS2345: Argument mismatch\n');
    vi.advanceTimersByTime(200);

    const sigs = detector.getCapturedSignatures();
    expect(sigs.size).toBe(2);

    detector.destroy();
  });

  it('getCapturedSignatures is empty when no errors detected', () => {
    const detector = new StreamDetector('npm run build', () => {});
    detector.feed('Build completed successfully\n');
    detector.flush();
    expect(detector.getCapturedSignatures().size).toBe(0);
    detector.destroy();
  });
});

// ============================================================
// EDGE CASES
// ============================================================

describe('edge cases', () => {
  it('empty input produces no captures', () => {
    const captured: ErrorBlock[] = [];
    const detector = new StreamDetector('npm test', (b) => captured.push(b));
    detector.feed('');
    detector.flush();
    detector.destroy();
    expect(captured.length).toBe(0);
  });

  it('whitespace-only input produces no captures', () => {
    const captured: ErrorBlock[] = [];
    const detector = new StreamDetector('npm test', (b) => captured.push(b));
    detector.feed('   \n\n  \n');
    detector.flush();
    detector.destroy();
    expect(captured.length).toBe(0);
  });

  it('multi-chunk error block captures correctly', () => {
    const captured: ErrorBlock[] = [];
    const detector = new StreamDetector('npx tsc', (b) => captured.push(b));

    // Error arrives across multiple chunks
    detector.feed('error TS2322: ');
    detector.feed('Type \'string\' is not assignable\n');
    detector.feed('  at src/foo.ts:10:5\n');
    detector.flush();
    detector.destroy();

    expect(captured.length).toBe(1);
  });

  it('custom options are respected', () => {
    const captured: ErrorBlock[] = [];
    vi.useFakeTimers();

    const detector = new StreamDetector('node app.js', (b) => captured.push(b), {
      quietTimeoutMs: 100,
      cooldownMs: 500,
    });

    detector.feed('Error: connection refused\n');
    vi.advanceTimersByTime(150); // fires at 100ms
    expect(captured.length).toBe(1);

    detector.feed('Error: connection refused\n');
    vi.advanceTimersByTime(150);
    expect(captured.length).toBe(1); // cooldown

    vi.advanceTimersByTime(500); // exceed cooldown

    detector.feed('Error: connection refused\n');
    vi.advanceTimersByTime(150);
    expect(captured.length).toBe(2); // second capture

    detector.destroy();
    vi.useRealTimers();
  });
});
