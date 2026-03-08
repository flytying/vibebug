import pc from 'picocolors';
import { input, select } from '@inquirer/prompts';
import { findProjectRoot } from '../utils/paths.js';
import {
  ensureProject,
  getOpenIssues,
  getIssueById,
  getMostRecentOpenIssue,
  resolveIssue,
  createFixAttempt,
} from '../db/queries.js';

export async function fixCommand(
  issueId: string | undefined,
  options: {
    last?: boolean;
    summary?: string;
    rootCause?: string;
    prevention?: string;
    json?: boolean;
  }
): Promise<void> {
  const cwd = process.cwd();
  const projectRoot = findProjectRoot(cwd);

  if (!projectRoot) {
    console.error(pc.red('No VibeBug project found. Run `vb init` first.'));
    process.exit(1);
  }

  const project = ensureProject(projectRoot);

  let targetIssue;

  if (options.last) {
    // Target the most recent open issue
    targetIssue = getMostRecentOpenIssue(projectRoot, project.id);
    if (!targetIssue) {
      console.log(pc.yellow('No open failures to annotate.'));
      return;
    }
  } else if (issueId) {
    // Target a specific issue by ID (supports partial match)
    targetIssue = getIssueById(projectRoot, issueId);
    if (!targetIssue) {
      // Try partial match
      const allOpen = getOpenIssues(projectRoot, project.id);
      targetIssue = allOpen.find(i => i.id.startsWith(issueId));
      if (!targetIssue) {
        console.error(pc.red('No matching capture found.'));
        return;
      }
    }
  } else {
    // Interactive: let user pick from open issues
    const openIssues = getOpenIssues(projectRoot, project.id);
    if (openIssues.length === 0) {
      console.log(pc.yellow('No open failures to annotate.'));
      return;
    }

    const answer = await select({
      message: 'Which failure did you fix?',
      choices: openIssues.map(issue => ({
        name: `${issue.id.slice(0, 7)} ${issue.title.slice(0, 60)} (${issue.occurrenceCount}x)`,
        value: issue.id,
      })),
    });

    targetIssue = openIssues.find(i => i.id === answer)!;
  }

  // Determine if running non-interactively (agent mode)
  const isNonInteractive = !!options.summary;
  let summary = options.summary;
  let rootCause: string | undefined = options.rootCause;
  let prevention: string | undefined = options.prevention;

  if (!isNonInteractive) {
    // Interactive mode — ask for details
    summary = await input({
      message: 'Fix summary (what you changed):',
    });

    rootCause = await input({
      message: 'Root cause (optional):',
    }) || undefined;

    prevention = await input({
      message: 'Prevention (how to avoid in the future, optional):',
    }) || undefined;
  }

  const source = isNonInteractive ? 'agent' : 'manual';

  // Create fix attempt and resolve the issue
  createFixAttempt(projectRoot, {
    issueId: targetIssue.id,
    summary,
    rootCause,
    prevention,
    source,
  });

  resolveIssue(projectRoot, targetIssue.id);

  if (options.json) {
    // Machine-readable output for agents
    console.log(JSON.stringify({
      status: 'resolved',
      issueId: targetIssue.id,
      title: targetIssue.title,
      fixSummary: summary,
    }));
  } else {
    const shortTitle = targetIssue.title.length > 50
      ? targetIssue.title.slice(0, 47) + '...'
      : targetIssue.title;

    console.log(pc.green(`Resolved: ${pc.bold(shortTitle)}`));
    if (summary) {
      console.log(pc.dim(`  Fix: ${summary}`));
    }
  }
}
