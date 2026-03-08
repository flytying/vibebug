import pc from 'picocolors';
import { desc, eq, and, sql } from 'drizzle-orm';
import { findProjectRoot } from '../utils/paths.js';
import { sanitizePath, truncate, formatCost } from '../utils/sanitize.js';
import { ensureProject, getAllIssues, getRunStats } from '../db/queries.js';
import { getDatabase } from '../db/connection.js';
import { issues, occurrences } from '../db/schema.js';

const MAX_ITEMS = 5;
const MAX_TITLE_LEN = 100;

interface SummaryData {
  projectName: string;
  runsToday: number;
  failuresToday: number;
  totalRuns: number;
  openIssues: number;
  resolvedIssues: number;
  totalIssues: number;
  regressionCount: number;
  totalCost: number;
  topRecurring: { title: string; count: number }[];
  mostExpensive: { title: string; cost: number }[];
  regressions: { title: string }[];
  failingCommands: { command: string; count: number }[];
}

export async function summaryCommand(options: {
  markdown?: boolean;
  json?: boolean;
  shareSafe?: boolean;
}): Promise<void> {
  const cwd = process.cwd();
  const projectRoot = findProjectRoot(cwd);

  if (!projectRoot) {
    console.error(pc.red('No VibeBug project found. Run `vb init` first.'));
    process.exit(1);
  }

  const project = ensureProject(projectRoot);
  const data = gatherData(projectRoot, project.id, project.name);

  if (options.json) {
    process.stdout.write(JSON.stringify(data, null, 2) + '\n');
    return;
  }

  if (options.markdown) {
    process.stdout.write(formatMarkdown(data) + '\n');
    return;
  }

  process.stdout.write(formatText(data) + '\n');
}

function gatherData(projectRoot: string, projectId: string, projectName: string): SummaryData {
  const db = getDatabase(projectRoot);
  const runStats = getRunStats(projectRoot, projectId);
  const allIssues = getAllIssues(projectRoot, projectId);

  const openIssues = allIssues.filter(i => i.status === 'open').length;
  const resolvedIssues = allIssues.filter(i => i.status === 'resolved').length;
  const regressionCount = allIssues.filter(i => i.regressionFlag).length;
  const totalCost = allIssues.reduce((sum, i) => sum + i.estimatedTotalCost, 0);

  // Top recurring (by occurrence count)
  const topRecurring = [...allIssues]
    .sort((a, b) => b.occurrenceCount - a.occurrenceCount)
    .slice(0, MAX_ITEMS)
    .filter(i => i.occurrenceCount > 0)
    .map(i => ({
      title: truncate(sanitizePath(i.title), MAX_TITLE_LEN),
      count: i.occurrenceCount,
    }));

  // Most expensive (by estimated cost)
  const mostExpensive = [...allIssues]
    .sort((a, b) => b.estimatedTotalCost - a.estimatedTotalCost)
    .slice(0, MAX_ITEMS)
    .filter(i => i.estimatedTotalCost > 0)
    .map(i => ({
      title: truncate(sanitizePath(i.title), MAX_TITLE_LEN),
      cost: i.estimatedTotalCost,
    }));

  // Regressions
  const regressions = allIssues
    .filter(i => i.regressionFlag)
    .slice(0, MAX_ITEMS)
    .map(i => ({
      title: truncate(sanitizePath(i.title), MAX_TITLE_LEN),
    }));

  // Failing commands (aggregate from occurrences)
  const failingCommands = db.select({
    command: occurrences.command,
    count: sql<number>`count(*)`,
  })
    .from(occurrences)
    .innerJoin(issues, eq(occurrences.issueId, issues.id))
    .where(eq(issues.projectId, projectId))
    .groupBy(occurrences.command)
    .orderBy(desc(sql`count(*)`))
    .limit(MAX_ITEMS)
    .all()
    .map(r => ({
      command: truncate(sanitizePath(r.command), MAX_TITLE_LEN),
      count: r.count,
    }));

  return {
    projectName: sanitizePath(projectName),
    runsToday: runStats.runsToday,
    failuresToday: runStats.failuresToday,
    totalRuns: runStats.totalRuns,
    openIssues,
    resolvedIssues,
    totalIssues: allIssues.length,
    regressionCount,
    totalCost,
    topRecurring,
    mostExpensive,
    regressions,
    failingCommands,
  };
}

function formatText(d: SummaryData): string {
  const lines: string[] = [];
  const header = `VibeBug Summary \u2014 ${d.projectName}`;
  lines.push(header);
  lines.push('\u2500'.repeat(Math.min(header.length, 40)));

  // Stats line
  const failStr = d.failuresToday > 0 ? ` (${d.failuresToday} failed)` : '';
  lines.push(`Runs: ${d.runsToday} today${failStr} \u00b7 ${d.totalRuns.toLocaleString()} total`);

  if (d.totalIssues === 0) {
    lines.push('No failures captured yet.');
    return lines.join('\n');
  }

  lines.push(
    `Open captures: ${d.openIssues} \u00b7 Resolved: ${d.resolvedIssues} \u00b7 Regressions: ${d.regressionCount}`
  );
  lines.push(`Est. AI spend: ${formatCost(d.totalCost)}`);

  // Top recurring
  lines.push('');
  lines.push('Top recurring failures:');
  if (d.topRecurring.length === 0) {
    lines.push('  No recurring failures detected.');
  } else {
    for (let i = 0; i < d.topRecurring.length; i++) {
      const r = d.topRecurring[i];
      lines.push(`  ${i + 1}. ${r.title} (${r.count}x)`);
    }
  }

  // Most expensive
  lines.push('');
  lines.push('Most expensive (est. AI cost):');
  if (d.mostExpensive.length === 0) {
    lines.push('  No AI cost estimated yet.');
  } else {
    for (let i = 0; i < d.mostExpensive.length; i++) {
      const e = d.mostExpensive[i];
      lines.push(`  ${i + 1}. ${e.title} \u2014 ${formatCost(e.cost)}`);
    }
  }

  // Regressions
  lines.push('');
  lines.push('Regressions (fixed, then broke again):');
  if (d.regressions.length === 0) {
    lines.push('  No regressions detected.');
  } else {
    for (let i = 0; i < d.regressions.length; i++) {
      lines.push(`  ${i + 1}. ${d.regressions[i].title} (resolved \u2192 recurred)`);
    }
  }

  // Failing commands
  lines.push('');
  lines.push('Top failing commands:');
  if (d.failingCommands.length === 0) {
    lines.push('  No failing commands recorded.');
  } else {
    for (let i = 0; i < d.failingCommands.length; i++) {
      const cmd = d.failingCommands[i];
      lines.push(`  ${i + 1}. ${cmd.command} \u2014 ${cmd.count}x`);
    }
  }

  return lines.join('\n');
}

function formatMarkdown(d: SummaryData): string {
  const lines: string[] = [];
  lines.push(`# VibeBug Summary \u2014 ${d.projectName}`);
  lines.push('');

  const failStr = d.failuresToday > 0 ? ` (${d.failuresToday} failed)` : '';
  lines.push(`**Runs:** ${d.runsToday} today${failStr} \u00b7 ${d.totalRuns.toLocaleString()} total`);

  if (d.totalIssues === 0) {
    lines.push('');
    lines.push('No failures captured yet.');
    return lines.join('\n');
  }

  lines.push(
    `**Open captures:** ${d.openIssues} \u00b7 **Resolved:** ${d.resolvedIssues} \u00b7 **Regressions:** ${d.regressionCount}`
  );
  lines.push(`**Est. AI spend:** ${formatCost(d.totalCost)}`);

  // Top recurring
  lines.push('');
  lines.push('## Top Recurring Failures');
  if (d.topRecurring.length === 0) {
    lines.push('No recurring failures detected.');
  } else {
    for (const r of d.topRecurring) {
      lines.push(`- ${r.title} (${r.count}x)`);
    }
  }

  // Most expensive
  lines.push('');
  lines.push('## Most Expensive (Est. AI Cost)');
  if (d.mostExpensive.length === 0) {
    lines.push('No AI cost estimated yet.');
  } else {
    for (const e of d.mostExpensive) {
      lines.push(`- ${e.title} \u2014 ${formatCost(e.cost)}`);
    }
  }

  // Regressions
  lines.push('');
  lines.push('## Regressions');
  if (d.regressions.length === 0) {
    lines.push('No regressions detected.');
  } else {
    for (const r of d.regressions) {
      lines.push(`- ${r.title} (resolved \u2192 recurred)`);
    }
  }

  // Failing commands
  lines.push('');
  lines.push('## Top Failing Commands');
  if (d.failingCommands.length === 0) {
    lines.push('No failing commands recorded.');
  } else {
    for (const cmd of d.failingCommands) {
      lines.push(`- \`${cmd.command}\` \u2014 ${cmd.count}x`);
    }
  }

  return lines.join('\n');
}
