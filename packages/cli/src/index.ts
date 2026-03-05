import { Command } from 'commander';
import { VERSION, APP_NAME } from './utils/constants.js';

const program = new Command();

program
  .name(APP_NAME)
  .description('Automatic issue capture for vibe coding failures — without interrupting flow.')
  .version(VERSION);

// Default action: if the first arg isn't a known subcommand, treat it as a wrapped command
// e.g., `vb npm run build` → wraps `npm run build`
program
  .command('init')
  .description('Initialize VibeBug for the current project')
  .action(async () => {
    const { initCommand } = await import('./commands/init.js');
    await initCommand();
  });

program
  .command('list')
  .description('List open issues for the current project')
  .action(async () => {
    const { listCommand } = await import('./commands/list.js');
    await listCommand();
  });

program
  .command('dash')
  .description('Launch the local dashboard')
  .option('--port <port>', 'Dashboard port', String(7600))
  .option('--no-open', 'Do not auto-open browser')
  .action(async (options) => {
    const { dashCommand } = await import('./commands/dash.js');
    await dashCommand(options);
  });

program
  .command('fix [issueId]')
  .description('Record what fixed an issue (retroactive annotation)')
  .option('--last', 'Target the most recent open issue')
  .option('--summary <text>', 'Quick inline fix summary')
  .action(async (issueId, options) => {
    const { fixCommand } = await import('./commands/fix.js');
    await fixCommand(issueId, options);
  });

program
  .command('config <action> [key] [value]')
  .description('Manage VibeBug configuration')
  .action(async (action, key, value) => {
    const { configCommand } = await import('./commands/config.js');
    await configCommand(action, key, value);
  });

// Catch-all: any unrecognized command is treated as a wrapped command
// e.g., `vb npm run build` → wrap and execute `npm run build`
program
  .command('wrap', { isDefault: true, hidden: true })
  .allowUnknownOption()
  .allowExcessArguments()
  .action(async () => {
    // The raw args after the program name are the command to wrap
    const args = process.argv.slice(2);

    // Skip if it looks like a known subcommand or flag
    if (args.length === 0 || args[0]?.startsWith('-')) {
      program.help();
      return;
    }

    const { wrapCommand } = await import('./commands/wrap.js');
    const exitCode = await wrapCommand(args);
    process.exitCode = exitCode;
  });

program.parse();
