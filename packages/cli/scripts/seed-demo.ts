/**
 * Seed script for populating VibeBug with realistic demo data.
 *
 * Usage:
 *   cd /path/to/demo-project
 *   npx tsx /path/to/packages/cli/scripts/seed-demo.ts [--clean]
 *
 * Or from packages/cli:
 *   pnpm seed          (operates on cwd)
 */

import { resolve, join, dirname } from 'node:path';
import { readFileSync, existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { nanoid } from 'nanoid';
import { ensureProject } from '../src/db/queries.js';
import { getDatabase, closeDatabase } from '../src/db/connection.js';
import { issues, occurrences, fixAttempts, runLog } from '../src/db/schema.js';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(__dirname, '..', 'fixtures', 'logs');
const CLEAN = process.argv.includes('--clean');

const BRANCHES = ['feat/dashboard', 'feat/auth', 'fix/types', 'main', 'feat/api'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysAgo(days: number, hour?: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour ?? (9 + Math.floor(Math.random() * 10))); // 9am–7pm
  d.setMinutes(Math.floor(Math.random() * 60));
  d.setSeconds(Math.floor(Math.random() * 60));
  d.setMilliseconds(0);
  return d.toISOString();
}

function todayAt(hour: number, minute?: number): string {
  const d = new Date();
  d.setHours(hour);
  d.setMinutes(minute ?? Math.floor(Math.random() * 60));
  d.setSeconds(Math.floor(Math.random() * 60));
  d.setMilliseconds(0);
  return d.toISOString();
}

function fakeCommit(seed: number): string {
  return seed.toString(16).padStart(7, 'a').slice(0, 7);
}

function readFixture(relPath: string): string {
  const abs = join(FIXTURES_DIR, relPath);
  return existsSync(abs) ? readFileSync(abs, 'utf-8') : 'Error output unavailable';
}

function randomBranch(): string {
  return BRANCHES[Math.floor(Math.random() * BRANCHES.length)];
}

function occurrenceCost(): { inputTokens: number; outputTokens: number; cost: number } {
  const inputTokens = 5000 + Math.floor(Math.random() * 15000);
  const outputTokens = 2000 + Math.floor(Math.random() * 3000);
  const cost = (inputTokens * 3.0 + outputTokens * 15.0) / 1_000_000;
  return { inputTokens, outputTokens, cost };
}

function randomDuration(command: string): number {
  if (command.includes('build') || command.includes('tsc')) return 2000 + Math.floor(Math.random() * 12000);
  if (command.includes('test')) return 1500 + Math.floor(Math.random() * 6000);
  if (command.includes('lint')) return 500 + Math.floor(Math.random() * 3000);
  if (command.includes('install')) return 3000 + Math.floor(Math.random() * 15000);
  return 1000 + Math.floor(Math.random() * 5000);
}

// ---------------------------------------------------------------------------
// Demo issue definitions
// ---------------------------------------------------------------------------

interface IssueDef {
  title: string;
  type: 'build' | 'runtime' | 'test' | 'lint' | 'unknown';
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'resolved' | 'ignored';
  regressionFlag: boolean;
  command: string;
  fixtures: string[];        // fixture log paths (alternate per occurrence)
  occurrenceDays: number[];  // days ago for each occurrence
  resolvedAtDay?: number;    // day ago when resolved (for resolved + regression issues)
  appliedDiffOccurrences?: number[];  // indices into occurrenceDays that have a diff
}

const APPLIED_DIFF_TYPE_ERROR = `--- a/src/components/UserProfile.tsx
+++ b/src/components/UserProfile.tsx
@@ -42,1 +42,1 @@
-     age: user.age,
+     age: Number(user.age),`;

const APPLIED_DIFF_HEADER = `--- a/src/components/Header.tsx
+++ b/src/components/Header.tsx
@@ -0,0 +1,8 @@
+import React from 'react';
+
+export function Header() {
+  return (
+    <header className="header header--default">
+      <nav>Navigation</nav>
+    </header>
+  );
+}`;

const APPLIED_DIFF_FORMAT = `--- a/src/utils/format.ts
+++ b/src/utils/format.ts
@@ -12,1 +12,1 @@
-  return amount.toFixed(2);
+  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);`;

const APPLIED_DIFF_CHART = `--- a/package.json
+++ b/package.json
@@ -15,0 +16,1 @@
+    "chart.js": "^4.4.0",`;

const ISSUE_DEFS: IssueDef[] = [
  {
    title: "TS2322: Type 'string' is not assignable to type 'number'",
    type: 'build', severity: 'high', status: 'open', regressionFlag: true,
    command: 'npm run build',
    fixtures: ['tsc/type-error-v1.txt', 'tsc/type-error-v2.txt'],
    occurrenceDays: [28, 24, 20, 17, 16, 14, 11, 8, 5, 3, 1, 0],
    resolvedAtDay: 15,
    appliedDiffOccurrences: [4, 9],
  },
  {
    title: 'Rollup failed to resolve import "chart.js/auto"',
    type: 'build', severity: 'high', status: 'open', regressionFlag: false,
    command: 'npm run build',
    fixtures: ['vite/build-fail-v1.txt', 'vite/build-fail-v2.txt'],
    occurrenceDays: [26, 22, 18, 13, 9, 6, 3, 1],
    appliedDiffOccurrences: [5],
  },
  {
    title: "Module not found: Can't resolve './components/Header'",
    type: 'build', severity: 'medium', status: 'open', regressionFlag: true,
    command: 'npm run build',
    fixtures: ['npm/missing-module-v1.txt', 'npm/missing-module-v2.txt'],
    occurrenceDays: [25, 21, 19, 10, 4, 1],
    resolvedAtDay: 18,
    appliedDiffOccurrences: [2],
  },
  {
    title: "Property 'userId' does not exist on type 'Session'",
    type: 'build', severity: 'critical', status: 'open', regressionFlag: false,
    command: 'npm run build',
    fixtures: ['nextjs/build-error-v1.txt', 'nextjs/build-error-v2.txt'],
    occurrenceDays: [23, 17, 12, 7, 2],
  },
  {
    title: 'FAIL formatCurrency \u2014 should format USD values',
    type: 'test', severity: 'medium', status: 'open', regressionFlag: true,
    command: 'npm test',
    fixtures: ['jest/test-failure-v1.txt', 'jest/test-failure-v2.txt'],
    occurrenceDays: [27, 22, 18, 15, 13, 5, 2],
    resolvedAtDay: 12,
    appliedDiffOccurrences: [4],
  },
  {
    title: 'ESLint: 4 problems (4 errors, 0 warnings)',
    type: 'lint', severity: 'low', status: 'open', regressionFlag: false,
    command: 'npm run lint',
    fixtures: ['eslint/lint-errors-v1.txt', 'eslint/lint-errors-v2.txt'],
    occurrenceDays: [20, 14, 8, 3],
  },
  {
    title: 'ERESOLVE unable to resolve dependency tree',
    type: 'build', severity: 'medium', status: 'resolved', regressionFlag: false,
    command: 'npm install',
    fixtures: ['npm/version-conflict.txt'],
    occurrenceDays: [25, 19, 16],
    resolvedAtDay: 16,
  },
  {
    title: 'ERR_PNPM_PEER_DEP_ISSUES: Unmet peer dependencies',
    type: 'build', severity: 'low', status: 'resolved', regressionFlag: false,
    command: 'pnpm install',
    fixtures: ['pnpm/peer-dep-conflict.txt'],
    occurrenceDays: [22, 18],
    resolvedAtDay: 18,
  },
  {
    title: "Cannot find module 'react'",
    type: 'build', severity: 'high', status: 'open', regressionFlag: false,
    command: 'npx tsc --noEmit',
    fixtures: ['tsc/missing-import.txt'],
    occurrenceDays: [19, 13, 7, 2],
  },
  {
    title: "Module not found: Can't resolve 'recharts'",
    type: 'build', severity: 'medium', status: 'open', regressionFlag: false,
    command: 'npm run dev',
    fixtures: ['nextjs/hmr-error.txt'],
    occurrenceDays: [15, 9, 4],
  },
  {
    title: 'Snapshot mismatch: Header renders correctly',
    type: 'test', severity: 'low', status: 'resolved', regressionFlag: false,
    command: 'npm test',
    fixtures: ['jest/snapshot-mismatch.txt'],
    occurrenceDays: [20, 16],
    resolvedAtDay: 16,
  },
  {
    title: 'ESLint couldn\'t find config "next/core-web-vitals"',
    type: 'lint', severity: 'medium', status: 'resolved', regressionFlag: false,
    command: 'npm run lint',
    fixtures: ['eslint/config-error.txt'],
    occurrenceDays: [18, 14],
    resolvedAtDay: 14,
  },
  {
    title: 'JSX in .js file: Failed to parse source',
    type: 'build', severity: 'medium', status: 'open', regressionFlag: false,
    command: 'npm run dev',
    fixtures: ['vite/hmr-error.txt'],
    occurrenceDays: [12, 6, 1],
  },
  {
    title: "Unknown compiler option 'moduleResolutions'",
    type: 'build', severity: 'low', status: 'ignored', regressionFlag: false,
    command: 'npx tsc --noEmit',
    fixtures: ['tsc/config-error.txt'],
    occurrenceDays: [28],
  },
];

// Applied diffs mapped by issue index
const APPLIED_DIFFS: Record<number, string> = {
  0: APPLIED_DIFF_TYPE_ERROR,
  1: APPLIED_DIFF_CHART,
  2: APPLIED_DIFF_HEADER,
  4: APPLIED_DIFF_FORMAT,
};

// Fix attempts for resolved issues and pre-regression fixes
interface FixDef {
  issueIndex: number;
  summary: string;
  rootCause: string;
  prevention: string;
  createdAtDay: number;
}

const FIX_DEFS: FixDef[] = [
  {
    issueIndex: 0,
    summary: "Changed age prop to Number(user.age) at the API boundary",
    rootCause: "API returns age as string from JSON, but TypeScript type expects number",
    prevention: "Add runtime type coercion at API response boundary, add zod validation",
    createdAtDay: 15,
  },
  {
    issueIndex: 2,
    summary: "Re-created the Header component that was deleted during refactor",
    rootCause: "Component file deleted by AI agent during a refactor pass",
    prevention: "Add import verification to CI, protect critical component files",
    createdAtDay: 18,
  },
  {
    issueIndex: 4,
    summary: "Added locale and style options to Intl.NumberFormat",
    rootCause: "Missing style: 'currency' option in formatCurrency utility",
    prevention: "Add unit tests with expected formatted output for all currency helpers",
    createdAtDay: 12,
  },
  {
    issueIndex: 6,
    summary: "Used --legacy-peer-deps flag and pinned react-beautiful-dnd",
    rootCause: "react-beautiful-dnd requires React 17 but project uses React 18",
    prevention: "Replace react-beautiful-dnd with @hello-pangea/dnd for React 18 support",
    createdAtDay: 16,
  },
  {
    issueIndex: 7,
    summary: "Added strict-peer-dependencies=false to .npmrc",
    rootCause: "pnpm strict mode rejecting mismatched React peer dependencies",
    prevention: "Pin dependency versions in package.json, audit peer deps quarterly",
    createdAtDay: 18,
  },
  {
    issueIndex: 10,
    summary: "Updated snapshot with npm test -- -u",
    rootCause: "Header className changed from 'default' to 'compact' by AI refactor",
    prevention: "Use inline snapshots for frequently-changing UI components",
    createdAtDay: 16,
  },
  {
    issueIndex: 11,
    summary: "Installed eslint-config-next package",
    rootCause: "ESLint config extending next/core-web-vitals but package not installed",
    prevention: "Add eslint-config-next to devDependencies, validate config in CI",
    createdAtDay: 14,
  },
];

// ---------------------------------------------------------------------------
// Run log command weights
// ---------------------------------------------------------------------------

const COMMAND_WEIGHTS = [
  { command: 'npm run build', weight: 40 },
  { command: 'npm test', weight: 25 },
  { command: 'npm run lint', weight: 15 },
  { command: 'npx tsc --noEmit', weight: 10 },
  { command: 'npm run dev', weight: 5 },
  { command: 'npm install', weight: 3 },
  { command: 'pnpm install', weight: 2 },
];

function pickWeightedCommand(): string {
  const total = COMMAND_WEIGHTS.reduce((s, c) => s + c.weight, 0);
  let r = Math.floor(Math.random() * total);
  for (const c of COMMAND_WEIGHTS) {
    r -= c.weight;
    if (r < 0) return c.command;
  }
  return COMMAND_WEIGHTS[0].command;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const cwd = process.cwd();

// Clean if requested
if (CLEAN) {
  const vbDir = join(cwd, '.vibebug');
  if (existsSync(vbDir)) {
    rmSync(vbDir, { recursive: true });
    console.log('Cleaned .vibebug/ directory.');
  }
}

// Create project (runs migrations)
const project = ensureProject(cwd);
const db = getDatabase(cwd);

console.log(`Seeding demo data for project "${project.name}" (${cwd})...\n`);

// Track stats
let totalOccurrences = 0;
let totalFixAttempts = 0;
let totalRunLogEntries = 0;
let totalCost = 0;

// ---------------------------------------------------------------------------
// Insert issues + occurrences
// ---------------------------------------------------------------------------

const issueIds: string[] = [];

for (let i = 0; i < ISSUE_DEFS.length; i++) {
  const def = ISSUE_DEFS[i];
  const issueId = nanoid();
  issueIds.push(issueId);

  const occDays = def.occurrenceDays;
  const firstDay = Math.max(...occDays);
  const lastDay = Math.min(...occDays);

  // Compute total cost from occurrences
  let issueTotalCost = 0;
  const occCosts: number[] = [];
  for (let j = 0; j < occDays.length; j++) {
    const c = occurrenceCost();
    occCosts.push(c.cost);
    issueTotalCost += c.cost;
  }
  totalCost += issueTotalCost;

  // Determine resolved state
  let resolvedAt: string | null = null;
  if (def.status === 'resolved' && def.resolvedAtDay != null) {
    resolvedAt = daysAgo(def.resolvedAtDay);
  }
  // Regression issues: were resolved, now open again. resolvedAt = null.

  const firstSeenAt = daysAgo(firstDay);
  const lastSeenAt = daysAgo(lastDay);
  const signature = nanoid(16);

  db.insert(issues).values({
    id: issueId,
    projectId: project.id,
    title: def.title,
    type: def.type,
    severity: def.severity,
    status: def.status,
    signature,
    occurrenceCount: occDays.length,
    estimatedTotalCost: issueTotalCost,
    firstSeenAt,
    lastSeenAt,
    resolvedAt,
    regressionFlag: def.regressionFlag,
    createdAt: firstSeenAt,
    updatedAt: lastSeenAt,
  }).run();

  // Insert occurrences
  for (let j = 0; j < occDays.length; j++) {
    const day = occDays[j];
    const fixture = def.fixtures[j % def.fixtures.length];
    const rawLog = readFixture(fixture);
    const { inputTokens, outputTokens } = occurrenceCost();
    const cost = occCosts[j];

    const hasDiff = def.appliedDiffOccurrences?.includes(j) ?? false;
    const appliedDiff = hasDiff ? (APPLIED_DIFFS[i] ?? null) : null;

    db.insert(occurrences).values({
      id: nanoid(),
      issueId,
      rawLog,
      command: def.command,
      exitCode: 1,
      signal: null,
      durationMs: randomDuration(def.command),
      gitBranch: randomBranch(),
      gitCommit: fakeCommit(i * 100 + j),
      gitDirty: Math.random() > 0.5,
      appliedDiff,
      estimatedInputTokens: inputTokens,
      estimatedOutputTokens: outputTokens,
      estimatedCost: cost,
      capturedFrom: j % 5 === 0 ? 'stream' : 'wrapper',
      createdAt: daysAgo(day),
    }).run();

    totalOccurrences++;
  }
}

// ---------------------------------------------------------------------------
// Insert fix attempts
// ---------------------------------------------------------------------------

for (const fix of FIX_DEFS) {
  db.insert(fixAttempts).values({
    id: nanoid(),
    issueId: issueIds[fix.issueIndex],
    summary: fix.summary,
    rootCause: fix.rootCause,
    prevention: fix.prevention,
    successful: true,
    source: 'agent',
    createdAt: daysAgo(fix.createdAtDay),
  }).run();

  totalFixAttempts++;
}

// ---------------------------------------------------------------------------
// Insert run log (historical + today)
// ---------------------------------------------------------------------------

// Historical: ~5 runs/day for last 30 days
for (let day = 30; day >= 1; day--) {
  const runsThisDay = 3 + Math.floor(Math.random() * 5); // 3–7 runs
  for (let r = 0; r < runsThisDay; r++) {
    const command = pickWeightedCommand();
    const isFail = Math.random() < 0.38; // ~38% failure rate
    db.insert(runLog).values({
      id: nanoid(),
      projectId: project.id,
      command,
      exitCode: isFail ? 1 : 0,
      durationMs: randomDuration(command),
      createdAt: daysAgo(day, 8 + r * 2),
    }).run();
    totalRunLogEntries++;
  }
}

// Today: 15 runs, 6 failures
const todayCommands = [
  { cmd: 'npm run build', fail: true },
  { cmd: 'npm run build', fail: true },
  { cmd: 'npm test', fail: true },
  { cmd: 'npm run build', fail: false },
  { cmd: 'npm run lint', fail: true },
  { cmd: 'npm test', fail: false },
  { cmd: 'npm run build', fail: true },
  { cmd: 'npx tsc --noEmit', fail: false },
  { cmd: 'npm run build', fail: false },
  { cmd: 'npm test', fail: false },
  { cmd: 'npm run dev', fail: false },
  { cmd: 'npm run build', fail: true },
  { cmd: 'npm test', fail: false },
  { cmd: 'npm run lint', fail: false },
  { cmd: 'npm run build', fail: false },
];

for (let i = 0; i < todayCommands.length; i++) {
  const { cmd, fail } = todayCommands[i];
  db.insert(runLog).values({
    id: nanoid(),
    projectId: project.id,
    command: cmd,
    exitCode: fail ? 1 : 0,
    durationMs: randomDuration(cmd),
    createdAt: todayAt(8 + Math.floor(i / 2), (i % 2) * 30 + Math.floor(Math.random() * 25)),
  }).run();
  totalRunLogEntries++;
}

// ---------------------------------------------------------------------------
// Done
// ---------------------------------------------------------------------------

closeDatabase();

const regressionCount = ISSUE_DEFS.filter(d => d.regressionFlag).length;
const openCount = ISSUE_DEFS.filter(d => d.status === 'open').length;
const resolvedCount = ISSUE_DEFS.filter(d => d.status === 'resolved').length;
const ignoredCount = ISSUE_DEFS.filter(d => d.status === 'ignored').length;

console.log(`Demo data seeded successfully.\n`);
console.log(`  ${ISSUE_DEFS.length} issues (${openCount} open, ${resolvedCount} resolved, ${ignoredCount} ignored)`);
console.log(`  ${totalOccurrences} occurrences across 30 days`);
console.log(`  ${totalFixAttempts} fix attempts`);
console.log(`  ${totalRunLogEntries} run log entries`);
console.log(`  ${regressionCount} regressions`);
console.log(`  $${totalCost.toFixed(2)} estimated AI spend`);
console.log();
console.log(`Next steps:`);
console.log(`  vb summary              # View text summary`);
console.log(`  vb summary --markdown   # View markdown summary`);
console.log(`  vb export --format md   # Export full report`);
console.log(`  vb dash                 # Launch dashboard for screenshots`);
