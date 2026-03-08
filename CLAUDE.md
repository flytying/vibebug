# VibeBug

Capture vibe coding failures automatically — without interrupting flow.

## Commands

```bash
pnpm install          # Install all dependencies
pnpm build            # Build all packages (Turbo)
pnpm dev              # Dev mode with watch (Turbo)
pnpm test             # Run tests (Turbo, depends on build)
pnpm clean            # Remove all dist/
```

### Package-specific

```bash
# CLI only
cd packages/cli && pnpm build     # tsup → dist/index.js
cd packages/cli && pnpm test      # vitest run

# Dashboard only
cd packages/dashboard && pnpm dev           # Vite dev server (proxies /api → :7600)
cd packages/dashboard && pnpm build         # tsc + vite build → packages/cli/static/
```

## Architecture

Turbo monorepo with pnpm workspaces. Two packages:

```
packages/
  cli/          # NPM-distributable CLI (bin: vb, vibebug)
  dashboard/    # Private React SPA (builds into cli/static/)
```

**Key relationship:** Dashboard builds its output into `packages/cli/static/`. The CLI serves these static files via Hono when `vb dash` is run. The dashboard is never deployed independently.

### CLI structure

```
packages/cli/src/
  index.ts              # Entry point — routes subcommands OR wraps raw commands
  commands/             # One file per CLI command (init, list, dash, fix, export, config, ignore, summary, wrap)
  core/                 # Business logic (capture, runner, stream-detector, signature, git, cost)
  db/                   # SQLite layer (schema, migrations, queries, connection)
  server/routes/        # Hono API endpoints
  types/                # Shared TypeScript interfaces
  utils/                # Constants, paths, ring-buffer, logger, sanitize
```

### Dashboard structure

```
packages/dashboard/src/
  App.tsx               # Router + nav layout
  main.tsx              # Entry point (wraps App in ThemeProvider)
  api/client.ts         # API client with typed methods
  pages/                # 4 pages: Overview, Issues, IssueDetail, Insights
  components/ui/        # Reusable UI components (badge, button, card, copy-button, input, select, table)
  hooks/                # useApi (data fetcher), useTheme (dark mode + chart colors)
  lib/utils.ts          # cn() helper (clsx + tailwind-merge)
  lib/format-summary.ts # Shareable text formatting (copy buttons, export)
```

## Gotchas

- **Dashboard build target:** `vite build` outputs to `../cli/static/`, NOT the dashboard's own `dist/`. This is intentional — the CLI serves the built dashboard.
- **CLI entry point routing:** `index.ts` checks if the first arg is a known subcommand. If not, it treats the entire argv as a wrapped command (`vb npm run build`). This means new subcommands MUST be added to the `KNOWN_COMMANDS` array.
- **Database location:** SQLite DB lives at `.vibebug/vibebug.db` inside the user's project. The `.vibebug/` directory is gitignored.
- **Dashboard proxy:** During dev, Vite proxies `/api` requests to `localhost:7600`. You must run `vb dash` (or the CLI server) separately for API calls to work.
- **Build order matters:** Turbo handles this, but if building manually: CLI must build before dashboard (dashboard depends on `^build`). Always use `pnpm build` from root.
- **Node target:** CLI targets Node 20+ (tsup config: `target: 'node20'`).
- **ESM only:** Both packages use `"type": "module"`. All internal imports use `.js` extensions in the CLI.

## Code Style

- TypeScript strict mode across both packages
- Path alias `@/*` maps to `./src/*` in the dashboard (configured in tsconfig + vite)
- UI components follow ShadCN/Radix patterns (CVA + Tailwind + `cn()` utility)
- Database uses Drizzle ORM with `camelCase` column mapping over `snake_case` SQL columns
- CLI uses Commander.js with lazy `import()` for each command to keep startup fast
- `nanoid` for all primary keys
- ISO 8601 strings for all timestamps (not Unix)

## Deployment

- **Landing site (`site/`):** Hosted on Cloudflare Pages. Every push to `main` auto-deploys the `site/` directory to **vibebug.dev**. No build step — static files only.
- **Custom domain:** `vibebug.dev` DNS is managed in Cloudflare (A records → Cloudflare Pages).
- **CLI + Dashboard:** Not deployed — the CLI is distributed via npm, and the dashboard is bundled into `packages/cli/static/` at build time.

## Coding Standards

Follow the Pragmatic AI Coding Standards defined in `pragmatic-programming-skills.md` when coding.
