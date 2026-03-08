import pc from 'picocolors';
import { serve } from '@hono/node-server';
import { createServer } from '../server/index.js';
import { ensureProject } from '../db/queries.js';
import { DEFAULT_DASHBOARD_PORT } from '../utils/constants.js';

export async function dashCommand(options: { port?: string; open?: boolean }): Promise<void> {
  const cwd = process.cwd();
  const project = ensureProject(cwd);

  const port = parseInt(options.port ?? String(DEFAULT_DASHBOARD_PORT), 10);
  const app = createServer(cwd);

  const server = serve({
    fetch: app.fetch,
    port,
  }, (info) => {
    const url = `http://localhost:${info.port}`;
    console.log(pc.green(`VibeBug dashboard running at ${pc.bold(url)}`));
    console.log(pc.dim(`Project: ${project.name} (${cwd})`));
    console.log(pc.dim('Press Ctrl+C to stop.\n'));

    // Auto-open browser
    if (options.open !== false) {
      import('open').then(({ default: open }) => open(url)).catch(() => {});
    }
  });

  // Keep process alive
  await new Promise(() => {});
}
