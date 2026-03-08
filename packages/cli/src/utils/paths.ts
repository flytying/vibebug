import { join, parse } from 'node:path';
import { existsSync } from 'node:fs';
import { VIBEBUG_DIR, DB_FILENAME } from './constants.js';

/**
 * Walk up from `startDir` looking for a `.vibebug/` directory.
 * Returns the project root (parent of `.vibebug/`) or null.
 */
export function findProjectRoot(startDir: string): string | null {
  let dir = startDir;
  const { root } = parse(dir);

  while (dir !== root) {
    if (existsSync(join(dir, VIBEBUG_DIR))) {
      return dir;
    }
    dir = join(dir, '..');
  }

  return null;
}

export function getVibeBugDir(projectRoot: string): string {
  return join(projectRoot, VIBEBUG_DIR);
}

export function getDbPath(projectRoot: string): string {
  return join(projectRoot, VIBEBUG_DIR, DB_FILENAME);
}
