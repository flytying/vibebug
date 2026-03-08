import type { Stats, Issue, Insights } from '@/api/client';

export type SummaryMode = 'compact' | 'detailed';

const MAX_ITEMS = 5;
const MAX_LABEL_LEN = 100;

/**
 * Sanitize text for public display — strip absolute paths, keep basename.
 */
export function sanitizeForDisplay(text: string): string {
  let s = text;
  // Replace home directory references
  s = s.replace(/\/(?:Users|home)\/[\w.-]+\//g, '~/');
  // Replace remaining absolute paths with basename
  s = s.replace(/(?:\/[\w.@-]+)+\/([\w.@-]+)/g, '$1');
  return s;
}

/**
 * Truncate text to maxLen characters, appending … if truncated.
 */
export function truncateLabel(text: string, maxLen: number = MAX_LABEL_LEN): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + '\u2026';
}

/**
 * Format a cost value for display.
 */
export function formatCost(cost: number): string {
  if (cost === 0) return '\u2014';
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

/**
 * Format a count for display.
 */
export function formatCount(count: number): string {
  return count.toLocaleString();
}

/**
 * Format a full overview summary for clipboard.
 */
export function formatOverviewSummary(
  stats: Stats,
  insights: Insights,
  projectName: string,
  mode: SummaryMode = 'compact',
): string {
  const name = sanitizeForDisplay(projectName);
  const lines: string[] = [];

  lines.push(`VibeBug Summary \u2014 ${name}`);
  lines.push('\u2500'.repeat(Math.min(`VibeBug Summary \u2014 ${name}`.length, 40)));

  const failStr = stats.failuresToday > 0 ? ` (${stats.failuresToday} failed)` : '';
  lines.push(`Runs: ${stats.runsToday} today${failStr} \u00b7 ${formatCount(stats.totalRuns)} total`);

  if (stats.totalIssues === 0) {
    lines.push('No failures captured yet.');
    return lines.join('\n');
  }

  lines.push(
    `Open captures: ${stats.openIssues} \u00b7 Resolved: ${stats.resolvedIssues} \u00b7 Regressions: ${stats.regressions}`
  );
  lines.push(`Est. AI spend: ${formatCost(stats.totalEstimatedCost)}`);

  const itemLimit = mode === 'compact' ? 3 : MAX_ITEMS;

  // Top recurring
  lines.push('');
  lines.push('Top recurring failures:');
  const recurring = insights.topRecurring.slice(0, itemLimit);
  if (recurring.length === 0) {
    lines.push('  No recurring failures detected.');
  } else {
    for (let i = 0; i < recurring.length; i++) {
      const r = recurring[i];
      lines.push(`  ${i + 1}. ${truncateLabel(sanitizeForDisplay(r.title))} (${r.occurrenceCount}x)`);
    }
  }

  // Most expensive
  lines.push('');
  lines.push('Most expensive (est. AI cost):');
  const expensive = insights.mostExpensive.slice(0, itemLimit);
  if (expensive.length === 0) {
    lines.push('  No AI cost estimated yet.');
  } else {
    for (let i = 0; i < expensive.length; i++) {
      const e = expensive[i];
      lines.push(`  ${i + 1}. ${truncateLabel(sanitizeForDisplay(e.title))} \u2014 ${formatCost(e.estimatedTotalCost)}`);
    }
  }

  // Regressions
  if (insights.regressions.length > 0 || mode === 'detailed') {
    lines.push('');
    lines.push('Regressions:');
    const regs = insights.regressions.slice(0, itemLimit);
    if (regs.length === 0) {
      lines.push('  No regressions detected.');
    } else {
      for (let i = 0; i < regs.length; i++) {
        lines.push(`  ${i + 1}. ${truncateLabel(sanitizeForDisplay(regs[i].title))} (resolved \u2192 recurred)`);
      }
    }
  }

  // Failing commands (detailed only, or if compact has data)
  if (mode === 'detailed' || insights.failingCommands.length > 0) {
    lines.push('');
    lines.push('Top failing commands:');
    const cmds = insights.failingCommands.slice(0, itemLimit);
    if (cmds.length === 0) {
      lines.push('  No failing commands recorded.');
    } else {
      for (let i = 0; i < cmds.length; i++) {
        const cmd = cmds[i];
        lines.push(`  ${i + 1}. ${truncateLabel(sanitizeForDisplay(cmd.command))} \u2014 ${cmd.count}x`);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Format a single insight card's data for clipboard.
 */
export function formatInsightCard(
  title: string,
  items: { label: string; metric: string }[],
): string {
  const lines: string[] = [];
  lines.push(title);
  lines.push('\u2500'.repeat(Math.min(title.length, 30)));

  const capped = items.slice(0, MAX_ITEMS);
  if (capped.length === 0) {
    lines.push(`No ${title.toLowerCase()} detected.`);
  } else {
    for (let i = 0; i < capped.length; i++) {
      const item = capped[i];
      lines.push(`${i + 1}. ${truncateLabel(sanitizeForDisplay(item.label))} \u2014 ${item.metric}`);
    }
  }

  return lines.join('\n');
}
