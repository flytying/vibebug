import { runCommand } from '../core/runner.js';
import { captureFailure, captureStreamError } from '../core/capture.js';
import { getGitContext } from '../core/git-context.js';
import { ensureProject, logRun } from '../db/queries.js';
import { StreamDetector } from '../core/stream-detector.js';
import type { ErrorBlock } from '../core/stream-detector.js';
import { readConfig } from './config.js';
import { findProjectRoot } from '../utils/paths.js';

export async function wrapCommand(args: string[]): Promise<number> {
  const commandStr = args.join(' ');
  const cwd = process.cwd();
  const project = ensureProject(cwd);

  // Read user config for stream detector options
  const projectRoot = findProjectRoot(cwd);
  const config = projectRoot ? readConfig(projectRoot) : {};

  // Set up stream detector for long-running commands
  const detector = new StreamDetector(commandStr, (block: ErrorBlock) => {
    const gitContext = getGitContext(cwd);
    captureStreamError({
      project,
      commandStr,
      block,
      gitContext,
    });
  }, {
    quietTimeoutMs: config.streamQuietTimeout as number | undefined,
    cooldownMs: config.streamCooldown as number | undefined,
  });

  const result = await runCommand(args, (chunk) => {
    detector.feed(chunk);
  });

  // Flush any pending error block from the detector
  detector.flush();
  detector.destroy();

  // Log every run for adoption telemetry (success or failure)
  logRun(cwd, {
    projectId: project.id,
    command: commandStr,
    exitCode: result.exitCode,
    durationMs: result.durationMs,
  });

  // Also capture on non-zero exit (the standard path)
  // Skip if the stream detector already captured the same error
  if (result.exitCode !== 0) {
    const gitContext = getGitContext(cwd);
    await captureFailure({
      project,
      commandStr,
      result,
      gitContext,
      skipSignatures: detector.getCapturedSignatures(),
    });
  }

  return result.exitCode ?? 1;
}
