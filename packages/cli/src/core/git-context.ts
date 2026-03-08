import { execSync } from 'node:child_process';
import type { GitContext } from '../types/index.js';

export function getGitContext(cwd: string): GitContext {
  try {
    const opts = { cwd, encoding: 'utf-8' as const, stdio: ['pipe', 'pipe', 'pipe'] as const };
    const branch = execSync('git rev-parse --abbrev-ref HEAD', opts).trim();
    const commit = execSync('git rev-parse --short HEAD', opts).trim();
    const statusOutput = execSync('git status --porcelain', opts).trim();
    const dirty = statusOutput.length > 0;

    return { branch, commit, dirty };
  } catch {
    return { branch: null, commit: null, dirty: null };
  }
}

const GIT_REF_PATTERN = /^[a-f0-9]{4,40}$/i;

export function getGitDiff(cwd: string, fromCommit: string, toCommit: string, maxSize: number): string | null {
  if (!GIT_REF_PATTERN.test(fromCommit) || !GIT_REF_PATTERN.test(toCommit)) {
    return null;
  }
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
