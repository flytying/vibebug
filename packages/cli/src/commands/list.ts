import pc from 'picocolors';
import { ensureProject, getAllIssues } from '../db/queries.js';

export async function listCommand(): Promise<void> {
  const cwd = process.cwd();
  const project = ensureProject(cwd);
  const issueList = getAllIssues(cwd, project.id);

  // Project header
  console.log();
  console.log(pc.bold(project.name) + pc.dim(` ${cwd}`));

  if (issueList.length === 0) {
    console.log(pc.dim('No failures captured yet. Prefix commands with vb to start capturing.'));
    return;
  }

  console.log();
  console.log(
    pc.dim(
      pad('ID', 8) +
      pad('Title', 45) +
      pad('Type', 10) +
      pad('Status', 10) +
      pad('Seen', 6) +
      pad('Cost', 10) +
      'Last seen'
    )
  );
  console.log(pc.dim('─'.repeat(110)));

  for (const issue of issueList) {
    const title = issue.title.length > 42 ? issue.title.slice(0, 39) + '...' : issue.title;
    const cost = formatCost(issue.estimatedTotalCost);
    const lastSeen = timeAgo(issue.lastSeenAt);
    const statusColor = issue.status === 'open' ? pc.yellow : issue.status === 'resolved' ? pc.green : pc.dim;
    const severityColor = issue.severity === 'critical' ? pc.red :
      issue.severity === 'high' ? pc.yellow :
      issue.severity === 'medium' ? pc.white : pc.dim;
    const regression = issue.regressionFlag ? pc.red(' !') : '';

    console.log(
      pad(issue.id.slice(0, 7), 8) +
      severityColor(pad(title, 45)) +
      pad(issue.type, 10) +
      statusColor(pad(issue.status, 10)) +
      pad(String(issue.occurrenceCount), 6) +
      pad(cost, 10) +
      lastSeen +
      regression
    );
  }

  console.log();
  console.log(pc.dim(`${issueList.length} captures total`));
}

function pad(str: string, width: number): string {
  return str.padEnd(width);
}

function formatCost(cost: number): string {
  if (cost === 0) return '-';
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

function timeAgo(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
