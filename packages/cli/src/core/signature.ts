import { createHash } from 'node:crypto';

// Placeholder — will be fully implemented in M1.3
export function generateSignature(rawLog: string, command: string): string {
  const normalized = normalizeLog(rawLog);
  const input = `${normalized}\n${command}`;
  return createHash('sha256').update(input).digest('hex').slice(0, 16);
}

function normalizeLog(raw: string): string {
  let s = raw;

  // Strip ANSI escape codes
  s = s.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');

  // Strip timestamps
  s = s.replace(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[.\d]*/g, '<TS>');

  // Strip hex addresses
  s = s.replace(/0x[0-9a-fA-F]{6,}/g, '<HEX>');

  // Strip UUIDs
  s = s.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<UUID>');

  // Strip absolute paths, keep basename
  s = s.replace(/\/[\w/.-]+\/([\w.-]+)/g, '$1');

  // Strip line/column numbers in file references
  s = s.replace(/([\w.-]+):\d+:\d+/g, '$1:<L>:<C>');

  // Collapse whitespace
  s = s.replace(/\s+/g, ' ');

  return s.trim();
}
