import { createHash } from 'node:crypto';

/**
 * Anchor-based signature algorithm for stable error deduplication.
 *
 * Instead of hashing the full log (fragile — minor noise differences split
 * the same error into multiple signatures), we:
 * 1. Normalize the log (strip timestamps, UUIDs, hex, paths, whitespace)
 * 2. Extract anchors: error header lines + top stack frames
 * 3. Hash only the anchors + command → stable signature
 *
 * Falls back to full-log hash when no anchors are detected.
 */
export function generateSignature(rawLog: string, command: string): string {
  const normalized = normalizeLog(rawLog);
  const anchors = extractAnchors(normalized);
  const input = anchors.length > 0
    ? `${anchors.join('\n')}\n${command}`
    : `${normalized}\n${command}`;
  return createHash('sha256').update(input).digest('hex').slice(0, 16);
}

/**
 * Extract stable anchor lines from normalized error output.
 * Anchors are: error header lines + top stack frames / key diagnostic lines.
 */
export function extractAnchors(normalizedLog: string): string[] {
  const lines = normalizedLog.split('\n').map(l => l.trim()).filter(Boolean);
  const anchors: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Error header lines — the most important anchors
    if (isErrorHeader(line)) {
      anchors.push(line);
      // Collect up to 5 subsequent stack frames or diagnostic context
      const frames = collectStackFrames(lines, i + 1, 5);
      anchors.push(...frames);
    }
  }

  // Dedupe while preserving order (same error header can appear in summary sections)
  return [...new Set(anchors)];
}

/**
 * Matches error header lines — the first line of an error message.
 */
function isErrorHeader(line: string): boolean {
  return ERROR_HEADER_PATTERNS.some(re => re.test(line));
}

const ERROR_HEADER_PATTERNS = [
  // JS/TS errors (with optional Unicode prefix like Next.js ⨯)
  /^[\u00d7\u2a2f]?\s*(Error|TypeError|ReferenceError|SyntaxError|RangeError|URIError|EvalError):/,
  /^Uncaught\s/,
  // TypeScript compiler
  /error TS\d+:/,
  // Rust compiler
  /^error\[E\d+\]:/,
  /^error: aborting due to/,
  // Python
  /^(ModuleNotFoundError|ImportError|ConnectionRefusedError|AssertionError|AttributeError|KeyError|ValueError|RuntimeError|FileNotFoundError|PermissionError|OSError):/,
  /^Traceback \(most recent call last\)/,
  // Go
  /^panic:/,
  // npm
  /^npm ERR! code /,
  // pnpm
  /^ERR_PNPM_/,
  // Build tools
  /^Build failed/i,
  /^Failed to compile/i,
  /Module not found/,
  /Cannot find module/,
  // Vite/Rollup
  /Rollup failed to resolve import/,
  // ESLint
  /ESLint couldn't find the config/,
  // Test runners (Jest, Vitest)
  /^\s*FAIL\s/,
  // Next.js
  /^[\u00d7\u2a2f]\s/,
  // Generic
  /^FATAL/i,
  /^ERROR\s/,
  /CompileError/,
  /ELIFECYCLE/,
];

/**
 * Collect stack frame lines after an error header.
 * Stack frames are lines that look like:
 * - "  at Function.name (file:line:col)" (JS)
 * - "  File "path", line N" (Python)
 * - "  file.go:42 +0x1a5" (Go)
 * - " --> src/main.rs:15:20" (Rust)
 * - Lines starting with whitespace that are part of the error context
 *
 * Also captures key diagnostic lines that aren't stack frames but are
 * important for deduplication (e.g., "Property 'X' is missing in type 'Y'").
 */
function collectStackFrames(lines: string[], startIdx: number, maxFrames: number): string[] {
  const frames: string[] = [];
  let collected = 0;

  for (let i = startIdx; i < lines.length && collected < maxFrames; i++) {
    const line = lines[i];

    // Stop at empty lines, separators, or new error headers
    if (!line || /^[-=_]{3,}$/.test(line) || /^$/.test(line)) break;
    if (isErrorHeader(line)) break;

    // Stack frame patterns
    if (STACK_FRAME_PATTERNS.some(re => re.test(line))) {
      frames.push(line);
      collected++;
      continue;
    }

    // Diagnostic context lines (indented or continuation of error)
    if (/^\s+/.test(lines[startIdx - 1] ? line : '') || isDiagnosticLine(line)) {
      frames.push(line);
      collected++;
      continue;
    }
  }

  return frames;
}

const STACK_FRAME_PATTERNS = [
  // JS: "at Function.name (file:line:col)"
  /^\s*at\s/,
  // Python: "File "path", line N"
  /^\s*File\s+"/,
  // Go: "file.go:42 +0x..."
  /^\s+[\w./]+\.go:\d+/,
  // Rust: "--> src/file.rs:line:col"
  /^\s*-->/,
  // Generic: "path:line:col"
  /^\s*[\w./]+\.\w+:<L>:<C>/,
];

/**
 * Lines that provide diagnostic context for the error (not stack frames
 * but important for deduplication).
 */
function isDiagnosticLine(line: string): boolean {
  return DIAGNOSTIC_PATTERNS.some(re => re.test(line));
}

const DIAGNOSTIC_PATTERNS = [
  // TS: "Property 'X' is missing"
  /Property '.+' is missing/,
  // TS: "Type 'X' is not assignable to type 'Y'"
  /Type '.+' is not assignable/,
  // TS: "Cannot find name 'X'"
  /Cannot find name/,
  // TS: "Cannot find module 'X'"
  /Cannot find module/,
  // Rust: "expected `X`, found `Y`"
  /expected `.+`, found/,
  // Rust: "cannot borrow"
  /cannot borrow/,
  // Python: "E  ..."
  /^E\s{2,}/,
  // Go: "cannot use"
  /cannot use/,
  // npm: peer dependency info
  /peer .+ from/,
  // ESLint rule names
  /@typescript-eslint\//,
  // Vite/Rollup: resolve info
  /explicitly add it to/,
];

/**
 * Normalize raw log output to strip variable noise.
 * IMPORTANT: preserves newlines so anchor extraction can work line-by-line.
 * Exported for testing.
 */
export function normalizeLog(raw: string): string {
  let s = raw;

  // Strip ANSI escape codes
  s = s.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');

  // Strip timestamps (ISO, common log formats)
  s = s.replace(/\d{4}-\d{2}-\d{2}[T_]\d{2}[:\-_]\d{2}[:\-_]\d{2}[.\d_Z]*/g, '<TS>');

  // Strip time-only patterns (HH:MM:SS AM/PM)
  s = s.replace(/\d{1,2}:\d{2}:\d{2}\s*(AM|PM)?/gi, '<TS>');

  // Strip hex addresses
  s = s.replace(/0x[0-9a-fA-F]{6,}/g, '<HEX>');

  // Strip UUIDs
  s = s.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<UUID>');

  // Strip build hashes (common in bundler output: dep-jDlpJr2x.js, chunk-abc123.js)
  s = s.replace(/\b(dep|chunk|vendor|assets?)-[a-zA-Z0-9_-]{4,}\b/g, '$1-<HASH>');

  // Strip absolute paths, keep basename
  s = s.replace(/(?:\/[\w.@-]+)+\/([\w.@-]+)/g, '$1');

  // Strip line/column numbers in file references
  s = s.replace(/([\w.-]+):\d+:\d+/g, '$1:<L>:<C>');

  // Strip line-only references (file:line)
  s = s.replace(/([\w.-]+):(\d+)\b(?!:)/g, '$1:<L>');

  // Strip timing info (e.g., "in 2.34s", "3.01s")
  s = s.replace(/\b\d+\.\d+s\b/g, '<DUR>');

  // Strip counts that vary (e.g., "collected 45 items", "203 modules", "1 failed, 12 passed")
  s = s.replace(/\b\d+ (items?|modules?|files?|tests?|errors?|warnings?|problems?|failed|passed|total|succeeded|skipped|pending|suites?)\b/gi, '<N> $1');

  // Strip version numbers (e.g., "v5.1.4", "Python 3.11.5", "(14.1.0)")
  s = s.replace(/v?\d+\.\d+\.\d+/g, '<VER>');

  // Strip architecture identifiers that vary between machines
  s = s.replace(/\((?:x64|x86_64|arm64|aarch64|ia32|arm|ppc64|s390x)\)/gi, '(<ARCH>)');

  // Strip platform identifiers that vary between machines
  s = s.replace(/\bplatform (linux|darwin|win32|windows)\b/gi, 'platform <PLATFORM>');

  // Collapse horizontal whitespace (preserve newlines for anchor extraction)
  s = s.replace(/[^\S\n]+/g, ' ');

  // Collapse multiple blank lines into one
  s = s.replace(/\n{3,}/g, '\n\n');

  return s.trim();
}
