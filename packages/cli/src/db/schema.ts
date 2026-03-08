import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  rootPath: text('root_path').notNull().unique(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const issues = sqliteTable('issues', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  title: text('title').notNull(),
  type: text('type', { enum: ['build', 'runtime', 'test', 'lint', 'unknown'] }).notNull().default('unknown'),
  severity: text('severity', { enum: ['low', 'medium', 'high', 'critical'] }).notNull().default('medium'),
  status: text('status', { enum: ['open', 'resolved', 'ignored'] }).notNull().default('open'),
  signature: text('signature').notNull(),
  occurrenceCount: integer('occurrence_count').notNull().default(1),
  estimatedTotalCost: real('estimated_total_cost').notNull().default(0),
  firstSeenAt: text('first_seen_at').notNull(),
  lastSeenAt: text('last_seen_at').notNull(),
  resolvedAt: text('resolved_at'),
  regressionFlag: integer('regression_flag', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  uniqueIndex('idx_issues_project_signature').on(table.projectId, table.signature),
  index('idx_issues_project_status').on(table.projectId, table.status),
]);

export const occurrences = sqliteTable('occurrences', {
  id: text('id').primaryKey(),
  issueId: text('issue_id').notNull().references(() => issues.id),
  rawLog: text('raw_log').notNull(),
  command: text('command').notNull(),
  exitCode: integer('exit_code'),
  signal: text('signal'),
  durationMs: integer('duration_ms'),
  gitBranch: text('git_branch'),
  gitCommit: text('git_commit'),
  gitDirty: integer('git_dirty', { mode: 'boolean' }),
  appliedDiff: text('applied_diff'),
  estimatedInputTokens: integer('estimated_input_tokens').notNull().default(0),
  estimatedOutputTokens: integer('estimated_output_tokens').notNull().default(0),
  estimatedCost: real('estimated_cost').notNull().default(0),
  capturedFrom: text('captured_from', { enum: ['wrapper', 'stream'] }).notNull().default('wrapper'),
  createdAt: text('created_at').notNull(),
}, (table) => [
  index('idx_occurrences_issue_created').on(table.issueId, table.createdAt),
]);

export const fixAttempts = sqliteTable('fix_attempts', {
  id: text('id').primaryKey(),
  issueId: text('issue_id').notNull().references(() => issues.id),
  summary: text('summary'),
  rootCause: text('root_cause'),
  prevention: text('prevention'),
  successful: integer('successful', { mode: 'boolean' }),
  source: text('source', { enum: ['agent', 'manual', 'api'] }).notNull().default('manual'),
  createdAt: text('created_at').notNull(),
}, (table) => [
  index('idx_fix_attempts_issue').on(table.issueId),
]);

export const runLog = sqliteTable('run_log', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  command: text('command').notNull(),
  exitCode: integer('exit_code'),
  durationMs: integer('duration_ms'),
  createdAt: text('created_at').notNull(),
}, (table) => [
  index('idx_run_log_project_created').on(table.projectId, table.createdAt),
]);
