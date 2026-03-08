import pc from 'picocolors';
import { findProjectRoot } from '../utils/paths.js';
import { readConfig, writeConfig } from './config.js';

export async function ignoreCommand(action: string, pattern?: string): Promise<void> {
  const cwd = process.cwd();
  const projectRoot = findProjectRoot(cwd);

  if (!projectRoot) {
    console.error(pc.red('No VibeBug project found. Run `vb init` first.'));
    process.exit(1);
  }

  const config = readConfig(projectRoot);
  const patterns: string[] = Array.isArray(config.ignorePatterns) ? config.ignorePatterns : [];

  switch (action) {
    case 'add': {
      const trimmed = (pattern ?? '').trim();
      if (!trimmed) {
        console.error(pc.red('Pattern cannot be empty.'));
        return;
      }

      const duplicate = patterns.find(p => p.toLowerCase() === trimmed.toLowerCase());
      if (duplicate) {
        console.log(pc.yellow(`Already exists: "${duplicate}"`));
        return;
      }

      patterns.push(trimmed);
      config.ignorePatterns = patterns;
      writeConfig(projectRoot, config);
      console.log(pc.green(`Added ignore pattern: "${trimmed}"`));
      break;
    }
    case 'remove': {
      const trimmed = (pattern ?? '').trim();
      if (!trimmed) {
        console.error(pc.red('Pattern cannot be empty.'));
        return;
      }

      const idx = patterns.findIndex(p => p.toLowerCase() === trimmed.toLowerCase());
      if (idx === -1) {
        console.error(pc.red(`Pattern not found: "${trimmed}"`));
        return;
      }

      const removed = patterns.splice(idx, 1)[0];
      config.ignorePatterns = patterns;
      writeConfig(projectRoot, config);
      console.log(pc.green(`Removed ignore pattern: "${removed}"`));
      break;
    }
    case 'list': {
      if (patterns.length === 0) {
        console.log(pc.dim('No ignore patterns configured.'));
        return;
      }
      console.log(pc.bold(`${patterns.length} ignore pattern${patterns.length !== 1 ? 's' : ''}:\n`));
      for (const p of patterns) {
        console.log(`  ${pc.dim('•')} ${p}`);
      }
      break;
    }
    default:
      console.error(pc.red(`Unknown action: "${action}". Use "add", "remove", or "list".`));
  }
}
