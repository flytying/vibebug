/**
 * Share-safe sanitization for public output.
 *
 * This module owns the rules for making VibeBug output safe to share publicly.
 * It is conceptually separate from normalizeLog() in signature.ts (which optimizes
 * for stable dedup signatures). They may share similar regex patterns but serve
 * different purposes and are not coupled.
 */

/**
 * Full sanitization for sharing raw text (logs, multi-line output).
 * Strips ANSI, absolute paths, tokens, env vars, excess whitespace.
 */
export function sanitizeForSharing(text: string): string {
  let s = text;

  // Strip ANSI escape codes
  s = s.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');

  // Replace home directory references with ~/
  s = s.replace(/\/(?:Users|home)\/[\w.-]+\//g, '~/');

  // Replace remaining absolute paths with basename only
  s = s.replace(/(?:\/[\w.@-]+)+\/([\w.@-]+)/g, '$1');

  // Mask environment variable assignments (KEY=value patterns)
  s = s.replace(/\b([A-Z][A-Z_]{2,})=\S+/g, '$1=***');

  // Mask token-like hex strings (>20 chars)
  s = s.replace(/\b[0-9a-f]{20,}\b/gi, '<REDACTED>');

  // Mask JWT-like patterns (three dot-separated base64 segments)
  s = s.replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, '<REDACTED>');

  // Collapse excess whitespace (preserve newlines)
  s = s.replace(/[^\S\n]+/g, ' ');
  s = s.replace(/\n{3,}/g, '\n\n');

  return s.trim();
}

/**
 * Light sanitization for titles and command strings.
 * Strips absolute paths only — no ANSI stripping needed for stored data.
 */
export function sanitizePath(text: string): string {
  let s = text;

  // Replace home directory references with ~/
  s = s.replace(/\/(?:Users|home)\/[\w.-]+\//g, '~/');

  // Replace remaining absolute paths with basename only
  s = s.replace(/(?:\/[\w.@-]+)+\/([\w.@-]+)/g, '$1');

  return s;
}

/**
 * Truncate text to maxLen characters, appending … if truncated.
 */
export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + '\u2026';
}

/**
 * Format a cost value for display.
 */
export function formatCost(cost: number): string {
  if (cost === 0) return '\u2014';
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}
