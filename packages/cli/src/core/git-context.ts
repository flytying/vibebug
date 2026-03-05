import { execSync } from 'node:child_process';
import type { GitContext } from '../types/index.js';

export function getGitContext(cwd: string): GitContext {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd, encoding: 'utf-8' }).trim();
    const commit = execSync('git rev-parse --short HEAD', { cwd, encoding: 'utf-8' }).trim();
    const statusOutput = execSync('git status --porcelain', { cwd, encoding: 'utf-8' }).trim();
    const dirty = statusOutput.length > 0;

    return { branch, commit, dirty };
  } catch {
    return { branch: null, commit: null, dirty: null };
  }
}

export function getGitDiff(cwd: string, fromCommit: string, toCommit: string, maxSize: number): string | null {
  try {
    const diff = execSync(`git diff ${fromCommit}..${toCommit}`, {
      cwd,
      encoding: 'utf-8',
      maxBuffer: maxSize,
    });
    return diff.length > 0 ? diff.slice(0, maxSize) : null;
  } catch {
    return null;
  }
}
