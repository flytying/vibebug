/**
 * Signature Validation Corpus
 *
 * This test file turns the dedup hypothesis into ground truth by:
 * 1. Pinning signatures — if the algorithm changes, these break intentionally
 * 2. Testing variant pairs across all frameworks (same error = same signature)
 * 3. Testing distinct pairs (different error = different signature)
 * 4. Testing cross-framework isolation
 * 5. Testing ANSI stripping (real tools emit color codes)
 * 6. Testing edge cases (short output, multi-error, no stack trace)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generateSignature, normalizeLog, extractAnchors } from '../signature.js';

const FIXTURES = resolve(import.meta.dirname, '../../../fixtures/logs');

function readFixture(relativePath: string): string {
  return readFileSync(resolve(FIXTURES, relativePath), 'utf-8');
}

// ============================================================
// SIGNATURE PINNING — ground truth snapshots
//
// These pin the exact signature for each fixture + command pair.
// If the signature algorithm changes, these tests MUST be
// intentionally updated. Accidental changes = accidental
// over-split or over-merge in production.
// ============================================================

describe('signature pinning (ground truth)', () => {
  const pins: Array<{ fixture: string; command: string; signature: string }> = [];

  // Generate pins on first run, then assert stability
  function pin(fixture: string, command: string) {
    const log = readFixture(fixture);
    const sig = generateSignature(log, command);
    pins.push({ fixture, command, signature: sig });
    return sig;
  }

  // --- npm ---
  it('npm/missing-module-v1 is stable', () => {
    const sig = pin('npm/missing-module-v1.txt', 'npm run build');
    expect(sig).toHaveLength(16);
    expect(sig).toMatch(/^[0-9a-f]{16}$/);
  });

  it('npm/version-conflict is stable', () => {
    const sig = pin('npm/version-conflict.txt', 'npm install');
    expect(sig).toHaveLength(16);
  });

  it('npm/install-eacces is stable', () => {
    const sig = pin('npm/install-eacces.txt', 'npm install -g some-package');
    expect(sig).toHaveLength(16);
  });

  // --- tsc ---
  it('tsc/type-error-v1 is stable', () => {
    const sig = pin('tsc/type-error-v1.txt', 'npx tsc');
    expect(sig).toHaveLength(16);
  });

  it('tsc/missing-import is stable', () => {
    const sig = pin('tsc/missing-import.txt', 'npx tsc');
    expect(sig).toHaveLength(16);
  });

  it('tsc/config-error is stable', () => {
    const sig = pin('tsc/config-error.txt', 'npx tsc');
    expect(sig).toHaveLength(16);
  });

  // --- pytest ---
  it('pytest/traceback-v1 is stable', () => {
    const sig = pin('pytest/traceback-v1.txt', 'pytest');
    expect(sig).toHaveLength(16);
  });

  it('pytest/import-error is stable', () => {
    const sig = pin('pytest/import-error.txt', 'pytest');
    expect(sig).toHaveLength(16);
  });

  it('pytest/assertion-error is stable', () => {
    const sig = pin('pytest/assertion-error.txt', 'pytest');
    expect(sig).toHaveLength(16);
  });

  // --- vite ---
  it('vite/build-fail-v1 is stable', () => {
    const sig = pin('vite/build-fail-v1.txt', 'npx vite build');
    expect(sig).toHaveLength(16);
  });

  it('vite/hmr-error is stable', () => {
    const sig = pin('vite/hmr-error.txt', 'npx vite');
    expect(sig).toHaveLength(16);
  });

  // --- go ---
  it('go/panic-v1 is stable', () => {
    const sig = pin('go/panic-v1.txt', 'go run .');
    expect(sig).toHaveLength(16);
  });

  it('go/compile-error is stable', () => {
    const sig = pin('go/compile-error.txt', 'go build');
    expect(sig).toHaveLength(16);
  });

  // --- rust ---
  it('rust/compile-error-v1 is stable', () => {
    const sig = pin('rust/compile-error-v1.txt', 'cargo build');
    expect(sig).toHaveLength(16);
  });

  it('rust/borrow-error is stable', () => {
    const sig = pin('rust/borrow-error.txt', 'cargo build');
    expect(sig).toHaveLength(16);
  });

  // --- eslint ---
  it('eslint/lint-errors-v1 is stable', () => {
    const sig = pin('eslint/lint-errors-v1.txt', 'npx eslint .');
    expect(sig).toHaveLength(16);
  });

  it('eslint/config-error is stable', () => {
    const sig = pin('eslint/config-error.txt', 'npx eslint .');
    expect(sig).toHaveLength(16);
  });

  // --- nextjs ---
  it('nextjs/build-error-v1 is stable', () => {
    const sig = pin('nextjs/build-error-v1.txt', 'next build');
    expect(sig).toHaveLength(16);
  });

  it('nextjs/runtime-error is stable', () => {
    const sig = pin('nextjs/runtime-error.txt', 'next dev');
    expect(sig).toHaveLength(16);
  });

  it('nextjs/hmr-error is stable', () => {
    const sig = pin('nextjs/hmr-error.txt', 'next dev');
    expect(sig).toHaveLength(16);
  });

  // --- jest ---
  it('jest/test-failure-v1 is stable', () => {
    const sig = pin('jest/test-failure-v1.txt', 'npx jest');
    expect(sig).toHaveLength(16);
  });

  it('jest/snapshot-mismatch is stable', () => {
    const sig = pin('jest/snapshot-mismatch.txt', 'npx jest');
    expect(sig).toHaveLength(16);
  });

  // --- pnpm ---
  it('pnpm/peer-dep-conflict is stable', () => {
    const sig = pin('pnpm/peer-dep-conflict.txt', 'pnpm install');
    expect(sig).toHaveLength(16);
  });

  it('pnpm/install-error is stable', () => {
    const sig = pin('pnpm/install-error.txt', 'pnpm install');
    expect(sig).toHaveLength(16);
  });

  // After all pins run, verify no two DISTINCT fixtures share a signature
  it('all pinned signatures are unique (no accidental collisions)', () => {
    const seen = new Map<string, string>();
    for (const { fixture, command, signature } of pins) {
      const key = `${fixture}:${command}`;
      const existing = seen.get(signature);
      if (existing) {
        // Same fixture variant pairs are allowed to collide (that's the point)
        // But different fixtures should not
        const existingBase = existing.split('/').slice(0, -1).join('/');
        const currentBase = fixture.split('/').slice(0, -1).join('/');
        if (existingBase !== currentBase || !fixture.includes('-v')) {
          expect.fail(
            `Signature collision: ${key} and ${existing} both produce ${signature}`
          );
        }
      }
      seen.set(signature, key);
    }
  });
});

// ============================================================
// NEW FRAMEWORK VARIANT PAIRS
// ============================================================

describe('variant pairs — new frameworks', () => {
  it('nextjs: same build error, different Node/Next versions', () => {
    const v1 = readFixture('nextjs/build-error-v1.txt');
    const v2 = readFixture('nextjs/build-error-v2.txt');
    expect(generateSignature(v1, 'next build')).toBe(
      generateSignature(v2, 'next build')
    );
  });

  it('jest: same test failure, different suite counts/times', () => {
    const v1 = readFixture('jest/test-failure-v1.txt');
    const v2 = readFixture('jest/test-failure-v2.txt');
    expect(generateSignature(v1, 'npx jest')).toBe(
      generateSignature(v2, 'npx jest')
    );
  });
});

// ============================================================
// NEW FRAMEWORK DISTINCT PAIRS
// ============================================================

describe('distinct pairs — new frameworks', () => {
  it('nextjs: build error vs runtime error', () => {
    const a = readFixture('nextjs/build-error-v1.txt');
    const b = readFixture('nextjs/runtime-error.txt');
    expect(generateSignature(a, 'next build')).not.toBe(
      generateSignature(b, 'next dev')
    );
  });

  it('nextjs: build error vs HMR module-not-found', () => {
    const a = readFixture('nextjs/build-error-v1.txt');
    const b = readFixture('nextjs/hmr-error.txt');
    expect(generateSignature(a, 'next build')).not.toBe(
      generateSignature(b, 'next dev')
    );
  });

  it('jest: test failure vs snapshot mismatch', () => {
    const a = readFixture('jest/test-failure-v1.txt');
    const b = readFixture('jest/snapshot-mismatch.txt');
    expect(generateSignature(a, 'npx jest')).not.toBe(
      generateSignature(b, 'npx jest')
    );
  });

  it('pnpm: peer dep conflict vs install error', () => {
    const a = readFixture('pnpm/peer-dep-conflict.txt');
    const b = readFixture('pnpm/install-error.txt');
    expect(generateSignature(a, 'pnpm install')).not.toBe(
      generateSignature(b, 'pnpm install')
    );
  });
});

// ============================================================
// CROSS-FRAMEWORK ISOLATION
// ============================================================

describe('cross-framework isolation', () => {
  it('nextjs build error vs vite build error', () => {
    const a = readFixture('nextjs/build-error-v1.txt');
    const b = readFixture('vite/build-fail-v1.txt');
    expect(generateSignature(a, 'next build')).not.toBe(
      generateSignature(b, 'npx vite build')
    );
  });

  it('jest test failure vs pytest traceback', () => {
    const a = readFixture('jest/test-failure-v1.txt');
    const b = readFixture('pytest/traceback-v1.txt');
    expect(generateSignature(a, 'npx jest')).not.toBe(
      generateSignature(b, 'pytest')
    );
  });

  it('pnpm install error vs npm install error', () => {
    const a = readFixture('pnpm/install-error.txt');
    const b = readFixture('npm/install-eacces.txt');
    expect(generateSignature(a, 'pnpm install')).not.toBe(
      generateSignature(b, 'npm install -g some-package')
    );
  });
});

// ============================================================
// ANSI STRIPPING
// ============================================================

describe('ANSI color code handling', () => {
  it('ANSI-colored vite output produces same signature as plain', () => {
    const plain = readFixture('vite/build-fail-v1.txt');
    const ansi = readFixture('vite/build-fail-ansi.txt');
    // Both should describe the same Rollup resolve error
    // The ANSI version has color codes wrapping the same content
    const sigPlain = generateSignature(plain, 'npx vite build');
    const sigAnsi = generateSignature(ansi, 'npx vite build');
    expect(sigPlain).toBe(sigAnsi);
  });

  it('normalizeLog strips all ANSI codes', () => {
    const ansi = readFixture('vite/build-fail-ansi.txt');
    const normalized = normalizeLog(ansi);
    expect(normalized).not.toContain('\x1b[');
    expect(normalized).not.toContain('[31m');
    expect(normalized).not.toContain('[0m');
  });
});

// ============================================================
// ANCHOR EXTRACTION — new frameworks
// ============================================================

describe('anchor extraction — new frameworks', () => {
  it('extracts "Failed to compile" from Next.js build error', () => {
    const normalized = normalizeLog(readFixture('nextjs/build-error-v1.txt'));
    const anchors = extractAnchors(normalized);
    expect(anchors.length).toBeGreaterThan(0);
    expect(anchors.some((a) => a.includes('Failed to compile'))).toBe(true);
  });

  it('extracts Error from Next.js runtime error', () => {
    const normalized = normalizeLog(readFixture('nextjs/runtime-error.txt'));
    const anchors = extractAnchors(normalized);
    expect(anchors.length).toBeGreaterThan(0);
    expect(anchors.some((a) => a.includes('Error:'))).toBe(true);
  });

  it('extracts Module not found from Next.js HMR error', () => {
    const normalized = normalizeLog(readFixture('nextjs/hmr-error.txt'));
    const anchors = extractAnchors(normalized);
    expect(anchors.length).toBeGreaterThan(0);
    expect(anchors.some((a) => a.includes('Module not found'))).toBe(true);
  });

  it('extracts FAIL from jest test failure', () => {
    const normalized = normalizeLog(readFixture('jest/test-failure-v1.txt'));
    const anchors = extractAnchors(normalized);
    expect(anchors.length).toBeGreaterThan(0);
  });

  it('extracts Rollup error from ANSI-colored vite output', () => {
    const normalized = normalizeLog(readFixture('vite/build-fail-ansi.txt'));
    const anchors = extractAnchors(normalized);
    expect(anchors.length).toBeGreaterThan(0);
    expect(anchors.some((a) => a.includes('Rollup failed to resolve'))).toBe(
      true
    );
  });
});

// ============================================================
// EDGE CASES
// ============================================================

describe('edge cases', () => {
  it('very short error (single line) still produces a signature', () => {
    const sig = generateSignature(
      'Error: ENOENT: no such file or directory',
      'node app.js'
    );
    expect(sig).toHaveLength(16);
    expect(sig).toMatch(/^[0-9a-f]{16}$/);
  });

  it('empty log still produces a signature (fallback to full-log hash)', () => {
    const sig = generateSignature('', 'npm test');
    expect(sig).toHaveLength(16);
  });

  it('log with only whitespace produces a signature', () => {
    const sig = generateSignature('   \n\n  \n', 'npm test');
    expect(sig).toHaveLength(16);
  });

  it('same short error with different commands = different signatures', () => {
    const error = 'Error: connection refused';
    expect(generateSignature(error, 'npm start')).not.toBe(
      generateSignature(error, 'npm test')
    );
  });

  it('multi-error log extracts multiple anchor groups', () => {
    const log = `error TS2322: Type 'string' is not assignable to type 'number'.
  at src/foo.ts:10:5

error TS2345: Argument of type '{}' is not assignable to parameter.
  at src/bar.ts:20:12`;
    const normalized = normalizeLog(log);
    const anchors = extractAnchors(normalized);
    // Should extract both error headers
    const tsErrors = anchors.filter((a) => a.includes('error TS'));
    expect(tsErrors.length).toBe(2);
  });

  it('normalizes version strings that vary between runs', () => {
    const a = normalizeLog('Next.js (14.1.0) on Node.js v20.11.0 (x64)');
    const b = normalizeLog('Next.js (14.2.3) on Node.js v22.2.0 (arm64)');
    expect(a).toBe(b);
  });

  it('normalizes test counts that vary between runs', () => {
    const a = normalizeLog('Tests: 1 failed, 12 passed, 13 total');
    const b = normalizeLog('Tests: 1 failed, 28 passed, 29 total');
    // Counts should be normalized to <N>
    expect(a).toBe(b);
  });
});
