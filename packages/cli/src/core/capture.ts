import pc from 'picocolors';
import type { CaptureInput, GitContext, Project } from '../types/index.js';
import type { ErrorBlock } from './stream-detector.js';
import { generateSignature } from './signature.js';
import { estimateCost } from './cost-estimator.js';
import { getGitDiff } from './git-context.js';
import {
  findIssueBySignature,
  createIssue,
  incrementIssue,
  createOccurrence,
  getLastOccurrenceCommit,
  getIssueCount,
} from '../db/queries.js';
import { readConfig } from '../commands/config.js';
import { MAX_DIFF_SIZE, DEFAULT_TAIL_LINES } from '../utils/constants.js';

export interface StreamCaptureInput {
  project: Project;
  commandStr: string;
  block: ErrorBlock;
  gitContext: GitContext;
}

export async function captureFailure(input: CaptureInput): Promise<void> {
  const { project, commandStr, result, gitContext, skipSignatures } = input;
  const fullLog = result.stderr || result.stdout;

  if (!fullLog.trim()) return;

  // Truncate to last N lines (default 200) for consistent capture
  const rawLog = tailLines(fullLog, DEFAULT_TAIL_LINES);

  // Check ignore patterns before capture
  if (matchesIgnorePattern(rawLog, getIgnorePatterns(project.rootPath))) return;

  const signature = generateSignature(rawLog, commandStr);

  // Skip if the stream detector already captured this error
  if (skipSignatures?.has(signature)) return;
  const costEstimate = estimateCost(rawLog.length);
  const issueType = inferType(commandStr);

  const existing = findIssueBySignature(project.rootPath, project.id, signature);
  const isFirstCapture = !existing && getIssueCount(project.rootPath, project.id) === 0;

  let issueId: string;
  let occurrenceCount: number;
  let appliedDiff: string | null = null;
  let isRegression = false;

  if (existing) {
    issueId = existing.id;
    const wasResolved = existing.status === 'resolved';
    isRegression = wasResolved;

    // Auto diff: capture what changed between last occurrence and now
    if (gitContext.commit) {
      const prevCommit = getLastOccurrenceCommit(project.rootPath, issueId);
      if (prevCommit && prevCommit !== gitContext.commit) {
        appliedDiff = getGitDiff(project.rootPath, prevCommit, gitContext.commit, MAX_DIFF_SIZE);
      }
    }

    incrementIssue(project.rootPath, issueId, costEstimate.cost, wasResolved);
    occurrenceCount = existing.occurrenceCount + 1;
  } else {
    const title = extractTitle(rawLog);
    issueId = createIssue(project.rootPath, {
      projectId: project.id,
      title,
      type: issueType,
      signature,
      estimatedCost: costEstimate.cost,
    });
    occurrenceCount = 1;
  }

  createOccurrence(project.rootPath, {
    issueId,
    rawLog,
    command: commandStr,
    exitCode: result.exitCode,
    signal: result.signal,
    durationMs: result.durationMs,
    gitContext,
    appliedDiff,
    costEstimate,
    capturedFrom: 'wrapper',
  });

  // Print summary
  const title = existing?.title ?? extractTitle(rawLog);
  const shortTitle = title.length > 60 ? title.slice(0, 57) + '...' : title;
  const costStr = formatCost(costEstimate.cost * occurrenceCount);
  const countStr = occurrenceCount > 1 ? ` (seen ${occurrenceCount} times, ~${costStr} in AI fixes)` : '';
  const regressionStr = isRegression ? pc.red(' [REGRESSION]') : '';

  console.error(
    `\n${pc.cyan('[vibebug]')} ${pc.bold(shortTitle)}${countStr}${regressionStr}`
  );
  if (isFirstCapture) {
    console.error(pc.dim(`  Captured. See it in the dashboard: ${pc.cyan('vb dash')}`));
  }
}

function inferType(command: string): 'build' | 'runtime' | 'test' | 'lint' | 'unknown' {
  const lower = command.toLowerCase();
  if (/\b(build|compile|tsc)\b/.test(lower)) return 'build';
  if (/\b(test|jest|vitest|mocha|pytest|cargo test|go test)\b/.test(lower)) return 'test';
  if (/\b(lint|eslint|prettier|biome)\b/.test(lower)) return 'lint';
  if (/\b(dev|start|serve|run)\b/.test(lower)) return 'runtime';
  return 'unknown';
}

function extractTitle(rawLog: string): string {
  const lines = rawLog.split('\n').filter(l => l.trim());

  // Look for common error patterns
  for (const line of lines) {
    const stripped = line.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').trim();
    if (/^(Error|TypeError|ReferenceError|SyntaxError|RangeError):/.test(stripped)) {
      return stripped.slice(0, 200);
    }
    if (/^error(\[|\s|:)/i.test(stripped)) {
      return stripped.slice(0, 200);
    }
    if (/Module not found|Cannot find module/.test(stripped)) {
      return stripped.slice(0, 200);
    }
    if (/FAIL|FATAL|panic:/.test(stripped)) {
      return stripped.slice(0, 200);
    }
  }

  // Fallback: last non-empty line
  const last = lines.at(-1)?.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').trim() ?? 'Unknown error';
  return last.slice(0, 200);
}

/**
 * Capture an error block detected by the stream detector (long-running commands).
 */
export function captureStreamError(input: StreamCaptureInput): void {
  const { project, commandStr, block, gitContext } = input;
  const rawLog = block.lines.join('\n');
  if (!rawLog.trim()) return;

  // Check ignore patterns before capture
  if (matchesIgnorePattern(rawLog, getIgnorePatterns(project.rootPath))) return;

  const costEstimate = estimateCost(rawLog.length);
  const issueType = inferType(commandStr);

  const existing = findIssueBySignature(project.rootPath, project.id, block.signature);
  const isFirstCapture = !existing && getIssueCount(project.rootPath, project.id) === 0;

  let issueId: string;
  let occurrenceCount: number;
  let appliedDiff: string | null = null;
  let isRegression = false;

  if (existing) {
    issueId = existing.id;
    const wasResolved = existing.status === 'resolved';
    isRegression = wasResolved;

    if (gitContext.commit) {
      const prevCommit = getLastOccurrenceCommit(project.rootPath, issueId);
      if (prevCommit && prevCommit !== gitContext.commit) {
        appliedDiff = getGitDiff(project.rootPath, prevCommit, gitContext.commit, MAX_DIFF_SIZE);
      }
    }

    incrementIssue(project.rootPath, issueId, costEstimate.cost, wasResolved);
    occurrenceCount = existing.occurrenceCount + 1;
  } else {
    const title = extractTitle(rawLog);
    issueId = createIssue(project.rootPath, {
      projectId: project.id,
      title,
      type: issueType,
      signature: block.signature,
      estimatedCost: costEstimate.cost,
    });
    occurrenceCount = 1;
  }

  createOccurrence(project.rootPath, {
    issueId,
    rawLog,
    command: commandStr,
    exitCode: null,
    signal: null,
    durationMs: 0,
    gitContext,
    appliedDiff,
    costEstimate,
    capturedFrom: 'stream',
  });

  const title = existing?.title ?? extractTitle(rawLog);
  const shortTitle = title.length > 60 ? title.slice(0, 57) + '...' : title;
  const costStr = formatCost(costEstimate.cost * occurrenceCount);
  const countStr = occurrenceCount > 1 ? ` (seen ${occurrenceCount} times, ~${costStr} in AI fixes)` : '';
  const regressionStr = isRegression ? pc.red(' [REGRESSION]') : '';

  console.error(
    `\n${pc.cyan('[vibebug:stream]')} ${pc.bold(shortTitle)}${countStr}${regressionStr}`
  );
  if (isFirstCapture) {
    console.error(pc.dim(`  Captured. See it in the dashboard: ${pc.cyan('vb dash')}`));
  }
}

function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

function tailLines(text: string, maxLines: number): string {
  const lines = text.split('\n');
  if (lines.length <= maxLines) return text;
  return lines.slice(-maxLines).join('\n');
}

function getIgnorePatterns(projectRoot: string): string[] {
  const config = readConfig(projectRoot);
  return Array.isArray(config.ignorePatterns) ? config.ignorePatterns : [];
}

function matchesIgnorePattern(text: string, patterns: string[]): boolean {
  if (patterns.length === 0) return false;
  const lower = text.toLowerCase();
  return patterns.some(p => lower.includes(p.toLowerCase()));
}
