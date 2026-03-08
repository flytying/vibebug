import pc from 'picocolors';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { findProjectRoot } from '../utils/paths.js';
import { VIBEBUG_DIR } from '../utils/constants.js';

const CONFIG_FILE = 'config.json';

const VALID_KEYS: Record<string, { type: 'string' | 'number'; description: string }> = {
  aiModel: { type: 'string', description: 'AI model for cost estimation (claude-sonnet, claude-opus, claude-haiku, gpt-4o)' },
  aiInputPricePerMToken: { type: 'number', description: 'Custom input price per million tokens' },
  aiOutputPricePerMToken: { type: 'number', description: 'Custom output price per million tokens' },
  estimatedOutputTokens: { type: 'number', description: 'Heuristic for AI response size (default: 1000)' },
  ringBufferSize: { type: 'number', description: 'Ring buffer size in bytes (default: 204800)' },
  streamQuietTimeout: { type: 'number', description: 'Stream quiet timeout in ms (default: 2000)' },
  streamCooldown: { type: 'number', description: 'Stream cooldown in ms (default: 60000)' },
  dashboardPort: { type: 'number', description: 'Dashboard port (default: 7600)' },
  autoOpen: { type: 'string', description: 'Auto-open dashboard in browser (true/false)' },
};

function getConfigPath(projectRoot: string): string {
  return join(projectRoot, VIBEBUG_DIR, CONFIG_FILE);
}

export function readConfig(projectRoot: string): Record<string, unknown> {
  const configPath = getConfigPath(projectRoot);
  if (!existsSync(configPath)) return {};
  try {
    return JSON.parse(readFileSync(configPath, 'utf-8'));
  } catch {
    return {};
  }
}

export function writeConfig(projectRoot: string, config: Record<string, unknown>): void {
  const configPath = getConfigPath(projectRoot);
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

export async function configCommand(action: string, key?: string, value?: string): Promise<void> {
  const cwd = process.cwd();
  const projectRoot = findProjectRoot(cwd);

  if (!projectRoot) {
    console.error(pc.red('No VibeBug project found. Run `vb init` first.'));
    process.exit(1);
  }

  const config = readConfig(projectRoot);

  switch (action) {
    case 'get': {
      if (key) {
        const val = config[key];
        if (val !== undefined) {
          console.log(`${key} = ${val}`);
        } else {
          console.log(pc.dim(`${key} is not set`));
        }
      } else {
        // Show all config
        if (Object.keys(config).length === 0) {
          console.log(pc.dim('No configuration set. Using defaults.'));
        } else {
          for (const [k, v] of Object.entries(config)) {
            console.log(`${k} = ${v}`);
          }
        }
      }
      break;
    }
    case 'set': {
      if (!key || value === undefined) {
        console.error(pc.red('Usage: vb config set <key> <value>'));
        return;
      }

      const spec = VALID_KEYS[key];
      if (!spec) {
        console.error(pc.red(`Unknown config key: "${key}"`));
        console.log(pc.dim('Valid keys:'));
        for (const [k, v] of Object.entries(VALID_KEYS)) {
          console.log(pc.dim(`  ${k} — ${v.description}`));
        }
        return;
      }

      let parsed: unknown = value;
      if (spec.type === 'number') {
        parsed = Number(value);
        if (Number.isNaN(parsed as number)) {
          console.error(pc.red(`"${value}" is not a valid number.`));
          return;
        }
      }

      config[key] = parsed;
      writeConfig(projectRoot, config);
      console.log(pc.green(`Set ${key} = ${parsed}`));
      break;
    }
    case 'list': {
      console.log(pc.bold('Available configuration keys:\n'));
      for (const [k, v] of Object.entries(VALID_KEYS)) {
        const current = config[k];
        const currentStr = current !== undefined ? pc.cyan(` (current: ${current})`) : '';
        console.log(`  ${pc.bold(k)}${currentStr}`);
        console.log(`    ${pc.dim(v.description)}`);
      }
      break;
    }
    default:
      console.error(pc.red(`Unknown action: "${action}". Use "get", "set", or "list".`));
  }
}
