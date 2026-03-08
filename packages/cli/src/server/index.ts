import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import { createApiRoutes } from './routes/api.js';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function createServer(projectRoot: string) {
  const app = new Hono();

  // Security headers
  app.use('*', async (c, next) => {
    await next();
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('X-Frame-Options', 'DENY');
    c.header('Referrer-Policy', 'no-referrer');
  });

  // API routes
  const api = createApiRoutes(projectRoot);
  app.route('/api', api);

  // Serve dashboard static files
  const staticRoot = join(__dirname, '..', 'static');
  app.use('/*', serveStatic({ root: staticRoot }));

  // SPA fallback: serve index.html for any non-API, non-asset route
  app.get('*', serveStatic({ root: staticRoot, path: 'index.html' }));

  return app;
}
