import Database from 'better-sqlite3';
import { getDbPath, getVibeBugDir } from '../utils/paths.js';
import { mkdirSync, existsSync } from 'node:fs';

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  root_path TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS issues (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'unknown',
  severity TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  signature TEXT NOT NULL,
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  estimated_total_cost REAL NOT NULL DEFAULT 0,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  resolved_at TEXT,
  regression_flag INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_issues_project_signature ON issues(project_id, signature);
CREATE INDEX IF NOT EXISTS idx_issues_project_status ON issues(project_id, status);

CREATE TABLE IF NOT EXISTS occurrences (
  id TEXT PRIMARY KEY,
  issue_id TEXT NOT NULL REFERENCES issues(id),
  raw_log TEXT NOT NULL,
  command TEXT NOT NULL,
  exit_code INTEGER,
  signal TEXT,
  duration_ms INTEGER,
  git_branch TEXT,
  git_commit TEXT,
  git_dirty INTEGER,
  applied_diff TEXT,
  estimated_input_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_output_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost REAL NOT NULL DEFAULT 0,
  captured_from TEXT NOT NULL DEFAULT 'wrapper',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_occurrences_issue_created ON occurrences(issue_id, created_at);

CREATE TABLE IF NOT EXISTS fix_attempts (
  id TEXT PRIMARY KEY,
  issue_id TEXT NOT NULL REFERENCES issues(id),
  summary TEXT,
  root_cause TEXT,
  prevention TEXT,
  successful INTEGER,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fix_attempts_issue ON fix_attempts(issue_id);
`;

export function runMigrations(projectRoot: string): void {
  const vibebugDir = getVibeBugDir(projectRoot);
  if (!existsSync(vibebugDir)) {
    mkdirSync(vibebugDir, { recursive: true });
  }

  const dbPath = getDbPath(projectRoot);
  const db = new Database(dbPath);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA_SQL);

  // Incremental migrations for existing databases
  try {
    db.exec(`ALTER TABLE fix_attempts ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'`);
  } catch {
    // Column already exists — ignore
  }

  // M2: Run log table for adoption telemetry
  db.exec(`
CREATE TABLE IF NOT EXISTS run_log (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  command TEXT NOT NULL,
  exit_code INTEGER,
  duration_ms INTEGER,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_run_log_project_created ON run_log(project_id, created_at);
  `);

  db.close();
}
