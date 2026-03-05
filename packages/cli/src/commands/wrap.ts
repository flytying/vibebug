import { runCommand } from '../core/runner.js';
import { captureFailure } from '../core/capture.js';
import { getGitContext } from '../core/git-context.js';
import { ensureProject } from '../db/queries.js';

export async function wrapCommand(args: string[]): Promise<number> {
  const commandStr = args.join(' ');
  const project = ensureProject(process.cwd());

  const result = await runCommand(args);

  if (result.exitCode !== 0) {
    const gitContext = getGitContext(process.cwd());
    await captureFailure({
      project,
      commandStr,
      result,
      gitContext,
    });
  }

  return result.exitCode ?? 1;
}
