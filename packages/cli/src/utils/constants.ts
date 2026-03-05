export const VERSION = '0.1.0';
export const APP_NAME = 'vibebug';
export const DB_FILENAME = 'vibebug.db';
export const VIBEBUG_DIR = '.vibebug';
export const DEFAULT_DASHBOARD_PORT = 7600;
export const DEFAULT_RING_BUFFER_SIZE = 200 * 1024; // 200KB
export const DEFAULT_TAIL_LINES = 200;
export const DEFAULT_STREAM_QUIET_TIMEOUT_MS = 2000;
export const DEFAULT_STREAM_COOLDOWN_MS = 60_000;
export const MAX_ERROR_BLOCK_LINES = 50;
export const MAX_DIFF_SIZE = 50 * 1024; // 50KB

// AI cost estimation defaults (per million tokens)
export const DEFAULT_AI_MODEL = 'claude-sonnet';
export const AI_PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet': { input: 3.0, output: 15.0 },
  'claude-opus': { input: 15.0, output: 75.0 },
  'claude-haiku': { input: 0.25, output: 1.25 },
  'gpt-4o': { input: 2.5, output: 10.0 },
};
export const DEFAULT_ESTIMATED_OUTPUT_TOKENS = 1000;
export const CHARS_PER_TOKEN = 4;
