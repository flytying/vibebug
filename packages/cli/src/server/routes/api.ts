import { Hono } from 'hono';
import { eq, and, desc, sql, like, count as drizzleCount } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getDatabase } from '../../db/connection.js';
import { projects, issues, occurrences, fixAttempts, runLog } from '../../db/schema.js';

const VALID_STATUSES = ['open', 'resolved', 'ignored'] as const;
const VALID_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
const MAX_TEXT_LENGTH = 10_000;

export function createApiRoutes(projectRoot: string) {
  const api = new Hono();
  const db = getDatabase(projectRoot);

  // Get project info
  api.get('/project', (c) => {
    const project = db.select().from(projects)
      .where(eq(projects.rootPath, projectRoot))
      .get();
    if (!project) return c.json({ error: 'Project not found' }, 404);
    return c.json(project);
  });

  // Get overview stats
  api.get('/stats', (c) => {
    const project = db.select().from(projects)
      .where(eq(projects.rootPath, projectRoot))
      .get();
    if (!project) return c.json({ error: 'Project not found' }, 404);

    const totalIssues = db.select({ count: sql<number>`count(*)` })
      .from(issues)
      .where(eq(issues.projectId, project.id))
      .get()?.count ?? 0;

    const openIssues = db.select({ count: sql<number>`count(*)` })
      .from(issues)
      .where(and(eq(issues.projectId, project.id), eq(issues.status, 'open')))
      .get()?.count ?? 0;

    const resolvedIssues = db.select({ count: sql<number>`count(*)` })
      .from(issues)
      .where(and(eq(issues.projectId, project.id), eq(issues.status, 'resolved')))
      .get()?.count ?? 0;

    const totalOccurrences = db.select({ count: sql<number>`count(*)` })
      .from(occurrences)
      .innerJoin(issues, eq(occurrences.issueId, issues.id))
      .where(eq(issues.projectId, project.id))
      .get()?.count ?? 0;

    const totalEstimatedCost = db.select({ total: sql<number>`coalesce(sum(${issues.estimatedTotalCost}), 0)` })
      .from(issues)
      .where(eq(issues.projectId, project.id))
      .get()?.total ?? 0;

    const regressions = db.select({ count: sql<number>`count(*)` })
      .from(issues)
      .where(and(eq(issues.projectId, project.id), eq(issues.regressionFlag, true)))
      .get()?.count ?? 0;

    // Severity distribution
    const severityDist = db.select({
      severity: issues.severity,
      count: sql<number>`count(*)`,
    })
      .from(issues)
      .where(eq(issues.projectId, project.id))
      .groupBy(issues.severity)
      .all();

    // Type distribution
    const typeDist = db.select({
      type: issues.type,
      count: sql<number>`count(*)`,
    })
      .from(issues)
      .where(eq(issues.projectId, project.id))
      .groupBy(issues.type)
      .all();

    // Occurrences per day (last 30 days)
    const occurrencesPerDay = db.select({
      date: sql<string>`date(${occurrences.createdAt})`,
      count: sql<number>`count(*)`,
    })
      .from(occurrences)
      .innerJoin(issues, eq(occurrences.issueId, issues.id))
      .where(and(
        eq(issues.projectId, project.id),
        sql`${occurrences.createdAt} >= datetime('now', '-30 days')`
      ))
      .groupBy(sql`date(${occurrences.createdAt})`)
      .orderBy(sql`date(${occurrences.createdAt})`)
      .all();

    // Run telemetry
    const today = new Date().toISOString().slice(0, 10);
    const runsToday = db.select({ count: sql<number>`count(*)` })
      .from(runLog)
      .where(and(
        eq(runLog.projectId, project.id),
        sql`${runLog.createdAt} >= ${today}`,
      ))
      .get()?.count ?? 0;

    const failuresToday = db.select({ count: sql<number>`count(*)` })
      .from(runLog)
      .where(and(
        eq(runLog.projectId, project.id),
        sql`${runLog.createdAt} >= ${today}`,
        sql`${runLog.exitCode} != 0`,
      ))
      .get()?.count ?? 0;

    const totalRuns = db.select({ count: sql<number>`count(*)` })
      .from(runLog)
      .where(eq(runLog.projectId, project.id))
      .get()?.count ?? 0;

    return c.json({
      totalIssues,
      openIssues,
      resolvedIssues,
      totalOccurrences,
      totalEstimatedCost,
      regressions,
      severityDistribution: severityDist,
      typeDistribution: typeDist,
      occurrencesPerDay,
      runsToday,
      failuresToday,
      totalRuns,
    });
  });

  // List issues
  api.get('/issues', (c) => {
    const project = db.select().from(projects)
      .where(eq(projects.rootPath, projectRoot))
      .get();
    if (!project) return c.json({ error: 'Project not found' }, 404);

    const status = c.req.query('status');
    const type = c.req.query('type');
    const severity = c.req.query('severity');
    const search = c.req.query('search');
    const from = c.req.query('from');
    const to = c.req.query('to');
    const sortBy = c.req.query('sort') ?? 'lastSeenAt';

    let conditions = [eq(issues.projectId, project.id)];
    if (status) conditions.push(eq(issues.status, status as 'open' | 'resolved' | 'ignored'));
    if (type) conditions.push(eq(issues.type, type as 'build' | 'runtime' | 'test' | 'lint' | 'unknown'));
    if (severity) conditions.push(eq(issues.severity, severity as 'low' | 'medium' | 'high' | 'critical'));
    if (search) conditions.push(like(issues.title, `%${search}%`));
    if (from) conditions.push(sql`${issues.lastSeenAt} >= ${from}`);
    if (to) conditions.push(sql`${issues.lastSeenAt} <= ${to}T23:59:59`);

    const orderCol = sortBy === 'occurrences' ? desc(issues.occurrenceCount) :
      sortBy === 'cost' ? desc(issues.estimatedTotalCost) :
      sortBy === 'severity' ? desc(issues.severity) :
      desc(issues.lastSeenAt);

    const result = db.select().from(issues)
      .where(and(...conditions))
      .orderBy(orderCol)
      .all();

    return c.json(result);
  });

  // Get issue detail
  api.get('/issues/:id', (c) => {
    const issueId = c.req.param('id');
    const issue = db.select().from(issues)
      .where(eq(issues.id, issueId))
      .get();
    if (!issue) return c.json({ error: 'Issue not found' }, 404);

    const issueOccurrences = db.select().from(occurrences)
      .where(eq(occurrences.issueId, issueId))
      .orderBy(desc(occurrences.createdAt))
      .all();

    const fixes = db.select().from(fixAttempts)
      .where(eq(fixAttempts.issueId, issueId))
      .orderBy(desc(fixAttempts.createdAt))
      .all();

    return c.json({ ...issue, occurrences: issueOccurrences, fixAttempts: fixes });
  });

  // Update issue status
  api.patch('/issues/:id', async (c) => {
    const issueId = c.req.param('id');

    let body: { status?: string; severity?: string };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid JSON' }, 400);
    }

    if (body.status && !(VALID_STATUSES as readonly string[]).includes(body.status)) {
      return c.json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` }, 400);
    }
    if (body.severity && !(VALID_SEVERITIES as readonly string[]).includes(body.severity)) {
      return c.json({ error: `Invalid severity. Must be one of: ${VALID_SEVERITIES.join(', ')}` }, 400);
    }

    const now = new Date().toISOString();
    const updateFields: Record<string, unknown> = { updatedAt: now };
    if (body.status) {
      updateFields.status = body.status;
      if (body.status === 'resolved') updateFields.resolvedAt = now;
      if (body.status === 'open') updateFields.resolvedAt = null;
    }
    if (body.severity) updateFields.severity = body.severity;

    db.update(issues).set(updateFields).where(eq(issues.id, issueId)).run();
    const updated = db.select().from(issues).where(eq(issues.id, issueId)).get();
    return c.json(updated);
  });

  // Create fix attempt and resolve issue (agent-friendly endpoint)
  api.post('/issues/:id/fix', async (c) => {
    const issueId = c.req.param('id');

    const issue = db.select().from(issues)
      .where(eq(issues.id, issueId))
      .get();
    if (!issue) return c.json({ error: 'Issue not found' }, 404);

    let body: {
      summary?: string;
      rootCause?: string;
      prevention?: string;
      source?: 'agent' | 'manual' | 'api';
    };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid JSON' }, 400);
    }

    const VALID_SOURCES = ['agent', 'manual', 'api'] as const;
    if (body.source && !(VALID_SOURCES as readonly string[]).includes(body.source)) {
      return c.json({ error: `Invalid source. Must be one of: ${VALID_SOURCES.join(', ')}` }, 400);
    }
    if (body.summary && body.summary.length > MAX_TEXT_LENGTH) {
      return c.json({ error: `summary exceeds max length of ${MAX_TEXT_LENGTH}` }, 400);
    }
    if (body.rootCause && body.rootCause.length > MAX_TEXT_LENGTH) {
      return c.json({ error: `rootCause exceeds max length of ${MAX_TEXT_LENGTH}` }, 400);
    }
    if (body.prevention && body.prevention.length > MAX_TEXT_LENGTH) {
      return c.json({ error: `prevention exceeds max length of ${MAX_TEXT_LENGTH}` }, 400);
    }

    const now = new Date().toISOString();
    const fixId = nanoid();
    const source = body.source ?? 'api';

    // Insert fix attempt
    db.insert(fixAttempts).values({
      id: fixId,
      issueId,
      summary: body.summary ?? null,
      rootCause: body.rootCause ?? null,
      prevention: body.prevention ?? null,
      successful: null,
      source,
      createdAt: now,
    }).run();

    // Resolve the issue
    db.update(issues).set({
      status: 'resolved',
      resolvedAt: now,
      updatedAt: now,
    }).where(eq(issues.id, issueId)).run();

    // Return updated issue with fix attempts
    const updated = db.select().from(issues).where(eq(issues.id, issueId)).get();
    const fixes = db.select().from(fixAttempts)
      .where(eq(fixAttempts.issueId, issueId))
      .orderBy(desc(fixAttempts.createdAt))
      .all();

    return c.json({ ...updated, fixAttempts: fixes }, 201);
  });

  // Get insights
  api.get('/insights', (c) => {
    const project = db.select().from(projects)
      .where(eq(projects.rootPath, projectRoot))
      .get();
    if (!project) return c.json({ error: 'Project not found' }, 404);

    // Top recurring issues (by occurrence count)
    const topRecurring = db.select().from(issues)
      .where(eq(issues.projectId, project.id))
      .orderBy(desc(issues.occurrenceCount))
      .limit(10)
      .all();

    // Most expensive issues (by estimated cost)
    const mostExpensive = db.select().from(issues)
      .where(eq(issues.projectId, project.id))
      .orderBy(desc(issues.estimatedTotalCost))
      .limit(10)
      .all();

    // Regressions
    const regressionIssues = db.select().from(issues)
      .where(and(eq(issues.projectId, project.id), eq(issues.regressionFlag, true)))
      .orderBy(desc(issues.lastSeenAt))
      .all();

    // Most failing commands
    const failingCommands = db.select({
      command: occurrences.command,
      count: sql<number>`count(*)`,
    })
      .from(occurrences)
      .innerJoin(issues, eq(occurrences.issueId, issues.id))
      .where(eq(issues.projectId, project.id))
      .groupBy(occurrences.command)
      .orderBy(desc(sql`count(*)`))
      .limit(10)
      .all();

    return c.json({
      topRecurring,
      mostExpensive,
      regressions: regressionIssues,
      failingCommands,
    });
  });

  return api;
}
