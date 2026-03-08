# VibeBug CLI

## Commands

```bash
pnpm build        # tsup → dist/index.js (ESM, Node 20+, sourcemaps)
pnpm dev          # tsup --watch
pnpm test         # vitest run
```

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Entry point — subcommand router OR wrap passthrough |
| `src/commands/wrap.ts` | Core capture flow: spawn → buffer → detect → store |
| `src/core/capture.ts` | `captureFailure()` and `captureStreamError()` — the two capture paths |
| `src/core/signature.ts` | Error normalization + SHA256 dedup key generation |
| `src/core/stream-detector.ts` | Real-time error detection state machine |
| `src/db/schema.ts` | Drizzle schema (4 tables: projects, issues, occurrences, fixAttempts) |
| `src/db/migrate.ts` | Raw SQL schema + incremental ALTER migrations |
| `src/db/queries.ts` | All database CRUD operations |
| `src/commands/summary.ts` | `vb summary` — shareable project summary (text, markdown, JSON) |
| `src/utils/sanitize.ts` | Share-safe sanitization (path stripping, token masking, truncation) |
| `src/server/routes/api.ts` | Hono API endpoints (mounted at `/api`) |

## Capture Flow

Two capture paths, both converge on the same DB logic:

1. **Wrapper capture** (`captureFailure`) — triggered on non-zero exit code
2. **Stream capture** (`captureStreamError`) — triggered by `StreamDetector` mid-execution

Both: check ignore patterns → normalize error → generate signature → find/create issue → insert occurrence → print summary

## Database

- SQLite with WAL mode + foreign keys enabled
- Drizzle ORM maps `camelCase` TS fields to `snake_case` SQL columns
- Singleton connection cached in `connection.ts`
- Migrations use `CREATE TABLE IF NOT EXISTS` + incremental `ALTER TABLE` in try/catch

### Adding new columns

Pattern for incremental migrations in `migrate.ts`:

```typescript
try {
  db.exec(`ALTER TABLE table_name ADD COLUMN col_name TYPE NOT NULL DEFAULT 'value'`);
} catch {
  // Column already exists — ignore
}
```

Always add after `db.exec(SCHEMA_SQL)` and also update the `CREATE TABLE` in `SCHEMA_SQL` for fresh installs.

## CLI Patterns

- **New subcommands** must be added to `KNOWN_COMMANDS` array in `index.ts`, otherwise they'll be treated as wrapped commands
- Commands use lazy `import()` to avoid loading all deps at startup
- `fix` command has two modes: interactive (prompts) and non-interactive (when `--summary` provided, sets `source: 'agent'`)
- `--json` flag outputs machine-readable JSON for agent consumption
- `ignore` command manages noise suppression patterns stored in `config.json` as `ignorePatterns` array; patterns are case-insensitive substring matches against raw error output, checked before signature generation in both capture paths
- `summary` command outputs compact, share-safe project summaries; `--markdown` and `--json` flags change format; `--share-safe` is a visible no-op (default behavior)
- `export` command supports `json`, `csv`, and `markdown` formats; `--share-safe` flag applies sanitization (default for markdown)
- `better-sqlite3` is marked `external` in tsup — it's a native addon, can't be bundled

## Sanitization

Two independent sanitization systems exist:

1. **`normalizeLog()`** in `signature.ts` — optimized for dedup (error normalization for signature generation)
2. **`sanitizeForSharing()`** in `utils/sanitize.ts` — optimized for public output (strips paths, tokens, env vars)

These are conceptually separate. `sanitize.ts` also exports `sanitizePath()` (light path stripping for titles) and `truncate()` (ellipsis truncation).

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/project` | Current project info |
| GET | `/api/stats` | Overview statistics |
| GET | `/api/issues` | List issues (query: status, type, severity, search, sort) |
| GET | `/api/issues/:id` | Issue detail with occurrences + fix attempts |
| PATCH | `/api/issues/:id` | Update status/severity |
| POST | `/api/issues/:id/fix` | Create fix attempt + resolve (agent-friendly) |
| GET | `/api/insights` | Analytics data |

## Testing

```bash
pnpm test               # Run all tests
```

Tests use Vitest. Test files colocated with source or in `__tests__/` directories.
