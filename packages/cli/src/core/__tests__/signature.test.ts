import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generateSignature, normalizeLog, extractAnchors } from '../signature.js';

const FIXTURES = resolve(import.meta.dirname, '../../../fixtures/logs');

function readFixture(relativePath: string): string {
  return readFileSync(resolve(FIXTURES, relativePath), 'utf-8');
}

// ============================================================
// Variant pairs: same logical error → MUST produce same signature
// ============================================================

describe('signature stability — variant pairs', () => {
  it('npm: missing module from different users/paths', () => {
    const v1 = readFixture('npm/missing-module-v1.txt');
    const v2 = readFixture('npm/missing-module-v2.txt');
    expect(generateSignature(v1, 'npm run build')).toBe(generateSignature(v2, 'npm run build'));
  });

  it('tsc: same type errors (identical content, different machines)', () => {
    const v1 = readFixture('tsc/type-error-v1.txt');
    const v2 = readFixture('tsc/type-error-v2.txt');
    expect(generateSignature(v1, 'npx tsc')).toBe(generateSignature(v2, 'npx tsc'));
  });

  it('pytest: same traceback from different platforms/paths', () => {
    const v1 = readFixture('pytest/traceback-v1.txt');
    const v2 = readFixture('pytest/traceback-v2.txt');
    expect(generateSignature(v1, 'pytest')).toBe(generateSignature(v2, 'pytest'));
  });

  it('eslint: same lint errors from different users/paths', () => {
    const v1 = readFixture('eslint/lint-errors-v1.txt');
    const v2 = readFixture('eslint/lint-errors-v2.txt');
    expect(generateSignature(v1, 'npx eslint .')).toBe(generateSignature(v2, 'npx eslint .'));
  });

  it('vite: same build failure from different paths/versions', () => {
    const v1 = readFixture('vite/build-fail-v1.txt');
    const v2 = readFixture('vite/build-fail-v2.txt');
    expect(generateSignature(v1, 'npx vite build')).toBe(generateSignature(v2, 'npx vite build'));
  });

  it('go: same panic from different machines/addresses', () => {
    const v1 = readFixture('go/panic-v1.txt');
    const v2 = readFixture('go/panic-v2.txt');
    expect(generateSignature(v1, 'go run .')).toBe(generateSignature(v2, 'go run .'));
  });

  it('rust: same compile errors (identical content)', () => {
    const v1 = readFixture('rust/compile-error-v1.txt');
    const v2 = readFixture('rust/compile-error-v2.txt');
    expect(generateSignature(v1, 'cargo build')).toBe(generateSignature(v2, 'cargo build'));
  });
});

// ============================================================
// Distinct pairs: different errors → MUST produce different signatures
// ============================================================

describe('signature stability — distinct pairs', () => {
  it('npm: missing module vs version conflict', () => {
    const a = readFixture('npm/missing-module-v1.txt');
    const b = readFixture('npm/version-conflict.txt');
    expect(generateSignature(a, 'npm run build')).not.toBe(generateSignature(b, 'npm install'));
  });

  it('npm: missing module vs EACCES', () => {
    const a = readFixture('npm/missing-module-v1.txt');
    const b = readFixture('npm/install-eacces.txt');
    expect(generateSignature(a, 'npm run build')).not.toBe(generateSignature(b, 'npm install -g some-package'));
  });

  it('npm: version conflict vs EACCES', () => {
    const a = readFixture('npm/version-conflict.txt');
    const b = readFixture('npm/install-eacces.txt');
    expect(generateSignature(a, 'npm install')).not.toBe(generateSignature(b, 'npm install -g some-package'));
  });

  it('tsc: type error vs missing import', () => {
    const a = readFixture('tsc/type-error-v1.txt');
    const b = readFixture('tsc/missing-import.txt');
    expect(generateSignature(a, 'npx tsc')).not.toBe(generateSignature(b, 'npx tsc'));
  });

  it('tsc: type error vs config error', () => {
    const a = readFixture('tsc/type-error-v1.txt');
    const b = readFixture('tsc/config-error.txt');
    expect(generateSignature(a, 'npx tsc')).not.toBe(generateSignature(b, 'npx tsc'));
  });

  it('tsc: missing import vs config error', () => {
    const a = readFixture('tsc/missing-import.txt');
    const b = readFixture('tsc/config-error.txt');
    expect(generateSignature(a, 'npx tsc')).not.toBe(generateSignature(b, 'npx tsc'));
  });

  it('pytest: traceback vs import error', () => {
    const a = readFixture('pytest/traceback-v1.txt');
    const b = readFixture('pytest/import-error.txt');
    expect(generateSignature(a, 'pytest')).not.toBe(generateSignature(b, 'pytest'));
  });

  it('pytest: traceback vs assertion error', () => {
    const a = readFixture('pytest/traceback-v1.txt');
    const b = readFixture('pytest/assertion-error.txt');
    expect(generateSignature(a, 'pytest')).not.toBe(generateSignature(b, 'pytest'));
  });

  it('pytest: import error vs assertion error', () => {
    const a = readFixture('pytest/import-error.txt');
    const b = readFixture('pytest/assertion-error.txt');
    expect(generateSignature(a, 'pytest')).not.toBe(generateSignature(b, 'pytest'));
  });

  it('eslint: lint errors vs config error', () => {
    const a = readFixture('eslint/lint-errors-v1.txt');
    const b = readFixture('eslint/config-error.txt');
    expect(generateSignature(a, 'npx eslint .')).not.toBe(generateSignature(b, 'npx eslint .'));
  });

  it('vite: build failure vs HMR error', () => {
    const a = readFixture('vite/build-fail-v1.txt');
    const b = readFixture('vite/hmr-error.txt');
    expect(generateSignature(a, 'npx vite build')).not.toBe(generateSignature(b, 'npx vite'));
  });

  it('go: panic vs compile error', () => {
    const a = readFixture('go/panic-v1.txt');
    const b = readFixture('go/compile-error.txt');
    expect(generateSignature(a, 'go run .')).not.toBe(generateSignature(b, 'go build'));
  });

  it('rust: compile error vs borrow error', () => {
    const a = readFixture('rust/compile-error-v1.txt');
    const b = readFixture('rust/borrow-error.txt');
    expect(generateSignature(a, 'cargo build')).not.toBe(generateSignature(b, 'cargo build'));
  });

  it('cross-ecosystem: npm error vs tsc error', () => {
    const a = readFixture('npm/missing-module-v1.txt');
    const b = readFixture('tsc/type-error-v1.txt');
    expect(generateSignature(a, 'npm run build')).not.toBe(generateSignature(b, 'npx tsc'));
  });

  it('cross-ecosystem: pytest traceback vs go panic', () => {
    const a = readFixture('pytest/traceback-v1.txt');
    const b = readFixture('go/panic-v1.txt');
    expect(generateSignature(a, 'pytest')).not.toBe(generateSignature(b, 'go run .'));
  });
});

// ============================================================
// Normalization tests
// ============================================================

describe('normalizeLog', () => {
  it('strips ANSI escape codes', () => {
    const input = '\x1b[31mError: something failed\x1b[0m';
    expect(normalizeLog(input)).toBe('Error: something failed');
  });

  it('strips ISO timestamps', () => {
    const input = '2024-03-15T10:30:45.123 Error occurred';
    expect(normalizeLog(input)).toBe('<TS> Error occurred');
  });

  it('strips time-only patterns', () => {
    const input = '10:32:15 AM [vite] Error';
    expect(normalizeLog(input)).toBe('<TS> [vite] Error');
  });

  it('strips hex addresses', () => {
    const input = 'main.processItems(0xc000014090, 0x3, 0x4)';
    expect(normalizeLog(input)).toBe('main.processItems(<HEX>, 0x3, 0x4)');
  });

  it('strips UUIDs', () => {
    const input = 'Request a1b2c3d4-e5f6-7890-abcd-ef1234567890 failed';
    expect(normalizeLog(input)).toBe('Request <UUID> failed');
  });

  it('strips absolute paths, keeps basename', () => {
    const input = '/Users/alice/projects/my-app/src/App.tsx';
    expect(normalizeLog(input)).toBe('App.tsx');
  });

  it('strips line:col references', () => {
    const input = 'App.tsx:42:5 error something';
    expect(normalizeLog(input)).toBe('App.tsx:<L>:<C> error something');
  });

  it('strips timing durations', () => {
    const input = 'completed in 2.34s';
    expect(normalizeLog(input)).toBe('completed in <DUR>');
  });

  it('strips counts', () => {
    const input = 'collected 45 items and found 3 errors';
    expect(normalizeLog(input)).toBe('collected <N> items and found <N> errors');
  });

  it('strips version numbers', () => {
    const input = 'Python 3.11.5, pytest-7.4.3';
    expect(normalizeLog(input)).toBe('Python <VER>, pytest-<VER>');
  });

  it('collapses whitespace', () => {
    const input = 'Error:   too   many   spaces';
    expect(normalizeLog(input)).toBe('Error: too many spaces');
  });
});

// ============================================================
// Anchor extraction tests
// ============================================================

describe('extractAnchors', () => {
  it('extracts error headers from JS errors', () => {
    const normalized = normalizeLog('TypeError: Cannot read properties of undefined\n  at Object.render (App.tsx:<L>:<C>)\n  at Module.run (index.js:<L>:<C>)');
    const anchors = extractAnchors(normalized);
    expect(anchors.length).toBeGreaterThan(0);
    expect(anchors[0]).toContain('TypeError:');
  });

  it('extracts error headers from TypeScript compiler', () => {
    const normalized = normalizeLog(readFixture('tsc/type-error-v1.txt'));
    const anchors = extractAnchors(normalized);
    expect(anchors.length).toBeGreaterThan(0);
    expect(anchors.some(a => a.includes('error TS'))).toBe(true);
  });

  it('extracts panic from Go output', () => {
    const normalized = normalizeLog(readFixture('go/panic-v1.txt'));
    const anchors = extractAnchors(normalized);
    expect(anchors.length).toBeGreaterThan(0);
    expect(anchors.some(a => a.includes('panic:'))).toBe(true);
  });

  it('extracts error codes from Rust compiler', () => {
    const normalized = normalizeLog(readFixture('rust/compile-error-v1.txt'));
    const anchors = extractAnchors(normalized);
    expect(anchors.length).toBeGreaterThan(0);
    expect(anchors.some(a => a.includes('error[E'))).toBe(true);
  });

  it('extracts npm ERR codes', () => {
    const normalized = normalizeLog(readFixture('npm/version-conflict.txt'));
    const anchors = extractAnchors(normalized);
    expect(anchors.length).toBeGreaterThan(0);
    expect(anchors.some(a => a.includes('npm ERR! code'))).toBe(true);
  });

  it('returns empty array for logs with no recognizable error patterns', () => {
    const normalized = normalizeLog('Building project...\nDone.');
    const anchors = extractAnchors(normalized);
    expect(anchors).toEqual([]);
  });
});

// ============================================================
// Command sensitivity: same error, different commands → different sig
// ============================================================

describe('command sensitivity', () => {
  it('same error text with different commands produces different signatures', () => {
    const errorLog = 'Error: Cannot find module "react"';
    const sig1 = generateSignature(errorLog, 'npm run build');
    const sig2 = generateSignature(errorLog, 'npm test');
    expect(sig1).not.toBe(sig2);
  });
});
