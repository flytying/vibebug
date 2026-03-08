import { Command } from 'commander';
import { VERSION, APP_NAME } from './utils/constants.js';

const KNOWN_COMMANDS = ['init', 'list', 'dash', 'fix', 'export', 'config', 'ignore', 'summary', 'help'];

// Check if the first arg is a known subcommand or flag
const firstArg = process.argv[2];
const isSubcommand = firstArg && (KNOWN_COMMANDS.includes(firstArg) || firstArg.startsWith('-'));

if (!isSubcommand && firstArg) {
  // Treat everything after `vb` as a command to wrap
  const args = process.argv.slice(2);
  import('./commands/wrap.js').then(async ({ wrapCommand }) => {
    const exitCode = await wrapCommand(args);
    process.exitCode = exitCode;
  });
} else {
  // Parse as a normal CLI with subcommands
  const program = new Command();

  program
    .name(APP_NAME)
    .description('Capture vibe coding failures automatically — without interrupting flow.')
    .version(VERSION);

  program
    .command('init')
    .description('Initialize VibeBug for the current project')
    .action(async () => {
      const { initCommand } = await import('./commands/init.js');
      await initCommand();
    });

  program
    .command('list')
    .description('List captured failures for the current project')
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
    .description('Record what fixed a captured failure')
    .option('--last', 'Target the most recent open capture')
    .option('--summary <text>', 'Fix summary (what was changed)')
    .option('--root-cause <text>', 'Root cause of the failure')
    .option('--prevention <text>', 'How to prevent in the future')
    .option('--json', 'Output result as JSON (for agent consumption)')
    .action(async (issueId, options) => {
      const { fixCommand } = await import('./commands/fix.js');
      await fixCommand(issueId, options);
    });

  program
    .command('export')
    .description('Export captures to JSON, CSV, or Markdown')
    .option('--format <format>', 'Output format (json, csv, or markdown)', 'json')
    .option('-o, --output <file>', 'Write to file instead of stdout')
    .option('--share-safe', 'Sanitize output for sharing (default for markdown)')
    .action(async (options) => {
      const { exportCommand } = await import('./commands/export.js');
      await exportCommand(options);
    });

  program
    .command('config <action> [key] [value]')
    .description('Manage VibeBug configuration')
    .action(async (action, key, value) => {
      const { configCommand } = await import('./commands/config.js');
      await configCommand(action, key, value);
    });

  program
    .command('ignore <action> [pattern]')
    .description('Manage ignore patterns for captured output')
    .action(async (action, pattern) => {
      const { ignoreCommand } = await import('./commands/ignore.js');
      await ignoreCommand(action, pattern);
    });

  program
    .command('summary')
    .description('Print a shareable project summary')
    .option('--markdown', 'Output in Markdown format')
    .option('--json', 'Output in JSON format')
    .option('--share-safe', 'Sanitize output for sharing (default)')
    .action(async (opts) => {
      const { summaryCommand } = await import('./commands/summary.js');
      await summaryCommand(opts);
    });

  program.parse();
}
