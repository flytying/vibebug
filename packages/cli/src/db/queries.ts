import { basename } from 'node:path';
import { eq, and, desc, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getDatabase } from './connection.js';
import { projects, issues, occurrences, fixAttempts, runLog } from './schema.js';
import { runMigrations } from './migrate.js';
import type { Project, GitContext } from '../types/index.js';
import type { CostEstimate } from '../core/cost-estimator.js';

export function ensureProject(rootPath: string): Project {
  runMigrations(rootPath);

  const db = getDatabase(rootPath);
  const existing = db.select().from(projects).where(eq(projects.rootPath, rootPath)).get();

  if (existing) {
    return existing as Project;
  }

  const now = new Date().toISOString();
  const project = {
    id: nanoid(),
    name: basename(rootPath),
    rootPath,
    createdAt: now,
    updatedAt: now,
  };

  db.insert(projects).values(project).run();
  return project as Project;
}

export function findIssueBySignature(projectRoot: string, projectId: string, signature: string) {
  const db = getDatabase(projectRoot);
  return db.select().from(issues)
    .where(and(eq(issues.projectId, projectId), eq(issues.signature, signature)))
    .get();
}

export function createIssue(
  projectRoot: string,
  data: {
    projectId: string;
    title: string;
    type: 'build' | 'runtime' | 'test' | 'lint' | 'unknown';
    signature: string;
    estimatedCost: number;
  }
) {
  const db = getDatabase(projectRoot);
  const now = new Date().toISOString();
  const id = nanoid();

  db.insert(issues).values({
    id,
    projectId: data.projectId,
    title: data.title,
    type: data.type,
    severity: 'medium',
    status: 'open',
    signature: data.signature,
    occurrenceCount: 1,
    estimatedTotalCost: data.estimatedCost,
    firstSeenAt: now,
    lastSeenAt: now,
    regressionFlag: false,
    createdAt: now,
    updatedAt: now,
  }).run();

  return id;
}

export function incrementIssue(
  projectRoot: string,
  issueId: string,
  additionalCost: number,
  wasResolved: boolean,
) {
  const db = getDatabase(projectRoot);
  const now = new Date().toISOString();

  const updateFields: Record<string, unknown> = {
    occurrenceCount: sql`${issues.occurrenceCount} + 1`,
    lastSeenAt: now,
    estimatedTotalCost: sql`${issues.estimatedTotalCost} + ${additionalCost}`,
    updatedAt: now,
  };

  if (wasResolved) {
    updateFields.status = 'open';
    updateFields.regressionFlag = true;
    updateFields.resolvedAt = null;
  }

  db.update(issues).set(updateFields).where(eq(issues.id, issueId)).run();
}

export function createOccurrence(
  projectRoot: string,
  data: {
    issueId: string;
    rawLog: string;
    command: string;
    exitCode: number | null;
    signal: string | null;
    durationMs: number;
    gitContext: GitContext;
    appliedDiff: string | null;
    costEstimate: CostEstimate;
    capturedFrom: 'wrapper' | 'stream';
  }
) {
  const db = getDatabase(projectRoot);
  const now = new Date().toISOString();

  db.insert(occurrences).values({
    id: nanoid(),
    issueId: data.issueId,
    rawLog: data.rawLog,
    command: data.command,
    exitCode: data.exitCode,
    signal: data.signal,
    durationMs: data.durationMs,
    gitBranch: data.gitContext.branch,
    gitCommit: data.gitContext.commit,
    gitDirty: data.gitContext.dirty,
    appliedDiff: data.appliedDiff,
    estimatedInputTokens: data.costEstimate.inputTokens,
    estimatedOutputTokens: data.costEstimate.outputTokens,
    estimatedCost: data.costEstimate.cost,
    capturedFrom: data.capturedFrom,
    createdAt: now,
  }).run();
}

export function getOpenIssues(projectRoot: string, projectId: string) {
  const db = getDatabase(projectRoot);
  return db.select().from(issues)
    .where(and(eq(issues.projectId, projectId), eq(issues.status, 'open')))
    .orderBy(desc(issues.lastSeenAt))
    .all();
}

export function getAllIssues(projectRoot: string, projectId: string) {
  const db = getDatabase(projectRoot);
  return db.select().from(issues)
    .where(eq(issues.projectId, projectId))
    .orderBy(desc(issues.lastSeenAt))
    .all();
}

export function getLastOccurrenceCommit(projectRoot: string, issueId: string): string | null {
  const db = getDatabase(projectRoot);
  const last = db.select({ gitCommit: occurrences.gitCommit })
    .from(occurrences)
    .where(eq(occurrences.issueId, issueId))
    .orderBy(desc(occurrences.createdAt))
    .limit(1)
    .get();

  return last?.gitCommit ?? null;
}

export function getMostRecentOpenIssue(projectRoot: string, projectId: string) {
  const db = getDatabase(projectRoot);
  return db.select().from(issues)
    .where(and(eq(issues.projectId, projectId), eq(issues.status, 'open')))
    .orderBy(desc(issues.lastSeenAt))
    .limit(1)
    .get();
}

export function resolveIssue(projectRoot: string, issueId: string) {
  const db = getDatabase(projectRoot);
  const now = new Date().toISOString();
  db.update(issues).set({
    status: 'resolved',
    resolvedAt: now,
    updatedAt: now,
  }).where(eq(issues.id, issueId)).run();
}

export function getIssueById(projectRoot: string, issueId: string) {
  const db = getDatabase(projectRoot);
  return db.select().from(issues).where(eq(issues.id, issueId)).get();
}

export function createFixAttempt(
  projectRoot: string,
  data: {
    issueId: string;
    summary?: string;
    rootCause?: string;
    prevention?: string;
    source?: 'agent' | 'manual' | 'api';
  }
) {
  const db = getDatabase(projectRoot);
  const now = new Date().toISOString();
  const id = nanoid();

  db.insert(fixAttempts).values({
    id,
    issueId: data.issueId,
    summary: data.summary ?? null,
    rootCause: data.rootCause ?? null,
    prevention: data.prevention ?? null,
    successful: null,
    source: data.source ?? 'manual',
    createdAt: now,
  }).run();

  return id;
}

export function logRun(
  projectRoot: string,
  data: {
    projectId: string;
    command: string;
    exitCode: number | null;
    durationMs: number | null;
  }
) {
  const db = getDatabase(projectRoot);
  db.insert(runLog).values({
    id: nanoid(),
    projectId: data.projectId,
    command: data.command,
    exitCode: data.exitCode,
    durationMs: data.durationMs,
    createdAt: new Date().toISOString(),
  }).run();
}

export function getIssueCount(projectRoot: string, projectId: string): number {
  const db = getDatabase(projectRoot);
  const result = db.select({ count: sql<number>`count(*)` })
    .from(issues)
    .where(eq(issues.projectId, projectId))
    .get();
  return result?.count ?? 0;
}

export function getRunStats(projectRoot: string, projectId: string) {
  const db = getDatabase(projectRoot);
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const todayRuns = db.select({ count: sql<number>`count(*)` })
    .from(runLog)
    .where(and(
      eq(runLog.projectId, projectId),
      sql`${runLog.createdAt} >= ${today}`,
    ))
    .get();

  const todayFailures = db.select({ count: sql<number>`count(*)` })
    .from(runLog)
    .where(and(
      eq(runLog.projectId, projectId),
      sql`${runLog.createdAt} >= ${today}`,
      sql`${runLog.exitCode} != 0`,
    ))
    .get();

  const totalRuns = db.select({ count: sql<number>`count(*)` })
    .from(runLog)
    .where(eq(runLog.projectId, projectId))
    .get();

  return {
    runsToday: todayRuns?.count ?? 0,
    failuresToday: todayFailures?.count ?? 0,
    totalRuns: totalRuns?.count ?? 0,
  };
}
