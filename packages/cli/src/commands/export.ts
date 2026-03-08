import pc from 'picocolors';
import { writeFileSync } from 'node:fs';
import { desc, eq, sql } from 'drizzle-orm';
import { findProjectRoot } from '../utils/paths.js';
import { sanitizePath, truncate, formatCost } from '../utils/sanitize.js';
import { ensureProject, getAllIssues, getRunStats } from '../db/queries.js';
import { getDatabase } from '../db/connection.js';
import { issues, occurrences, fixAttempts } from '../db/schema.js';

const MAX_ITEMS = 5;
const MAX_TITLE_LEN = 100;

export async function exportCommand(options: {
  format?: string;
  output?: string;
  shareSafe?: boolean;
}): Promise<void> {
  const cwd = process.cwd();
  const projectRoot = findProjectRoot(cwd);

  if (!projectRoot) {
    console.error(pc.red('No VibeBug project found. Run `vb init` first.'));
    process.exit(1);
  }

  const project = ensureProject(projectRoot);
  const allIssues = getAllIssues(projectRoot, project.id);

  if (allIssues.length === 0) {
    console.log(pc.yellow('No captures to export.'));
    return;
  }

  const format = options.format ?? 'json';

  if (format === 'json') {
    const db = getDatabase(projectRoot);
    const data = allIssues.map(issue => {
      const issueOccurrences = db.select().from(occurrences)
        .where(eq(occurrences.issueId, issue.id))
        .orderBy(desc(occurrences.createdAt))
        .all();
      const fixes = db.select().from(fixAttempts)
        .where(eq(fixAttempts.issueId, issue.id))
        .orderBy(desc(fixAttempts.createdAt))
        .all();
      return { ...issue, occurrences: issueOccurrences, fixAttempts: fixes };
    });

    const json = JSON.stringify({ project, issues: data }, null, 2);

    if (options.output) {
      writeFileSync(options.output, json, 'utf-8');
      console.log(pc.green(`Exported ${allIssues.length} captures to ${options.output}`));
    } else {
      process.stdout.write(json + '\n');
    }
  } else if (format === 'csv') {
    const header = 'id,title,type,severity,status,occurrences,estimated_cost,first_seen,last_seen,regression';
    const rows = allIssues.map(issue =>
      [
        issue.id,
        `"${issue.title.replace(/"/g, '""')}"`,
        issue.type,
        issue.severity,
        issue.status,
        issue.occurrenceCount,
        issue.estimatedTotalCost.toFixed(4),
        issue.firstSeenAt,
        issue.lastSeenAt,
        issue.regressionFlag ? 'true' : 'false',
      ].join(',')
    );

    const csv = [header, ...rows].join('\n');

    if (options.output) {
      writeFileSync(options.output, csv, 'utf-8');
      console.log(pc.green(`Exported ${allIssues.length} captures to ${options.output}`));
    } else {
      process.stdout.write(csv + '\n');
    }
  } else if (format === 'markdown') {
    const md = generateMarkdownExport(projectRoot, project, allIssues);

    if (options.output) {
      writeFileSync(options.output, md, 'utf-8');
      console.log(pc.green(`Exported ${allIssues.length} captures to ${options.output}`));
    } else {
      process.stdout.write(md + '\n');
    }
  } else {
    console.error(pc.red(`Unknown format: "${format}". Use "json", "csv", or "markdown".`));
  }
}

function generateMarkdownExport(
  projectRoot: string,
  project: { id: string; name: string },
  allIssues: ReturnType<typeof getAllIssues>,
): string {
  const db = getDatabase(projectRoot);
  const runStats = getRunStats(projectRoot, project.id);
  const lines: string[] = [];

  lines.push(`# VibeBug Report \u2014 ${sanitizePath(project.name)}`);
  lines.push('');
  lines.push(`*Generated ${new Date().toISOString().slice(0, 10)}*`);
  lines.push('');

  // Stats summary
  lines.push('## Summary');
  lines.push('');
  const failStr = runStats.failuresToday > 0 ? ` (${runStats.failuresToday} failed)` : '';
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Runs today | ${runStats.runsToday}${failStr} |`);
  lines.push(`| Total runs | ${runStats.totalRuns.toLocaleString()} |`);
  lines.push(`| Total captures | ${allIssues.length} |`);
  lines.push(`| Open | ${allIssues.filter(i => i.status === 'open').length} |`);
  lines.push(`| Resolved | ${allIssues.filter(i => i.status === 'resolved').length} |`);
  lines.push(`| Regressions | ${allIssues.filter(i => i.regressionFlag).length} |`);
  const totalCost = allIssues.reduce((s, i) => s + i.estimatedTotalCost, 0);
  lines.push(`| Est. AI spend | ${formatCost(totalCost)} |`);
  lines.push('');

  // Issues table
  lines.push('## All Captures');
  lines.push('');
  lines.push('| Title | Type | Severity | Status | Seen | Cost |');
  lines.push('|-------|------|----------|--------|------|------|');
  for (const issue of allIssues) {
    const title = truncate(sanitizePath(issue.title), MAX_TITLE_LEN);
    const cost = formatCost(issue.estimatedTotalCost);
    const regression = issue.regressionFlag ? ' \u26a0\ufe0f' : '';
    lines.push(`| ${title}${regression} | ${issue.type} | ${issue.severity} | ${issue.status} | ${issue.occurrenceCount}x | ${cost} |`);
  }
  lines.push('');

  // Top recurring
  const topRecurring = [...allIssues]
    .sort((a, b) => b.occurrenceCount - a.occurrenceCount)
    .slice(0, MAX_ITEMS)
    .filter(i => i.occurrenceCount > 0);

  lines.push('## Top Recurring Failures');
  lines.push('');
  if (topRecurring.length === 0) {
    lines.push('No recurring failures detected.');
  } else {
    for (const r of topRecurring) {
      lines.push(`- ${truncate(sanitizePath(r.title), MAX_TITLE_LEN)} (${r.occurrenceCount}x)`);
    }
  }
  lines.push('');

  // Most expensive
  const mostExpensive = [...allIssues]
    .sort((a, b) => b.estimatedTotalCost - a.estimatedTotalCost)
    .slice(0, MAX_ITEMS)
    .filter(i => i.estimatedTotalCost > 0);

  lines.push('## Most Expensive (Est. AI Cost)');
  lines.push('');
  if (mostExpensive.length === 0) {
    lines.push('No AI cost estimated yet.');
  } else {
    for (const e of mostExpensive) {
      lines.push(`- ${truncate(sanitizePath(e.title), MAX_TITLE_LEN)} \u2014 ${formatCost(e.estimatedTotalCost)}`);
    }
  }
  lines.push('');

  // Regressions
  const regressions = allIssues.filter(i => i.regressionFlag).slice(0, MAX_ITEMS);
  lines.push('## Regressions');
  lines.push('');
  if (regressions.length === 0) {
    lines.push('No regressions detected.');
  } else {
    for (const r of regressions) {
      lines.push(`- ${truncate(sanitizePath(r.title), MAX_TITLE_LEN)} (resolved \u2192 recurred)`);
    }
  }
  lines.push('');

  // Failing commands
  const failingCommands = db.select({
    command: occurrences.command,
    count: sql<number>`count(*)`,
  })
    .from(occurrences)
    .innerJoin(issues, eq(occurrences.issueId, issues.id))
    .where(eq(issues.projectId, project.id))
    .groupBy(occurrences.command)
    .orderBy(desc(sql`count(*)`))
    .limit(MAX_ITEMS)
    .all();

  lines.push('## Top Failing Commands');
  lines.push('');
  if (failingCommands.length === 0) {
    lines.push('No failing commands recorded.');
  } else {
    for (const cmd of failingCommands) {
      lines.push(`- \`${truncate(sanitizePath(cmd.command), MAX_TITLE_LEN)}\` \u2014 ${cmd.count}x`);
    }
  }

  return lines.join('\n');
}
