# VibeBug

**Automatic failure tracking for vibe coding.**

Track build, test, and runtime failures from your terminal — automatically.

See what keeps breaking. Stop repeating the same fixes.

VibeBug is a local-first CLI tool that captures command-line failures automatically — build errors, test failures, type errors, runtime crashes. It groups recurring breakage, tracks regressions, estimates AI cost, and serves a local dashboard. Prefix your usual commands with `vb`, and VibeBug does the rest.

![VibeBug dashboard overview](./docs/assets/vibebug-dashboard-overview.png)

---

## Why it exists

AI-assisted coding speeds up output, but it also creates a lot of repeated breakage.

Build failures, test failures, type errors, and runtime errors pile up quickly. They flash by in terminal history, fixes get repeated, and it becomes hard to learn from what already happened.

VibeBug exists to make those failures visible and useful.

Instead of losing the trail, you get a local history of:

- what fails most often
- what came back after being fixed
- which commands create the most friction
- where debugging effort and AI cost are going

---

## What it does

VibeBug helps you answer one question:

**What keeps breaking?**

It wraps your existing commands and gives you a lightweight failure memory for your project.

- capture build, test, and runtime failures automatically
- group recurring failures into the same capture
- detect when a previously fixed failure comes back
- track fix attempts over time
- estimate AI-debugging cost
- open a local dashboard to see recurring friction
- generate share-safe summaries for posts, docs, or team updates

---

## How it works

Run your commands like this:

```bash
vb npm run build
vb pytest
vb npx tsc
```

If the command fails, VibeBug captures the failure automatically.

Then you can:

- open the local dashboard to see what keeps breaking
- record what fixed a failure
- export or copy a share-safe summary

---

## Who it's for

VibeBug is for builders who are moving fast with AI and keep running into the same failures:

- errors disappear in terminal scrollback
- you forget what you already tried
- the same breakage comes back later
- debugging loops burn time and tokens
- there's no simple way to see recurring friction

Best fit right now:

- solo builders using AI-heavy workflows
- indie hackers shipping quickly with Cursor, Claude Code, Cline, or similar tools
- open-source tool builders and tinkerers
- anyone who wants lightweight failure tracking without setting up cloud infrastructure

---

## Why local-first matters

VibeBug is designed to be local-first.

Your failure data stays in your project under `.vibebug/` using a local SQLite database. You can inspect it, export it, and delete it whenever you want. No cloud account is required.

This makes VibeBug:

- fast to start
- easy to trust
- useful for solo workflows
- safer for local development logs

---

## Share-safe by default

VibeBug is built to make sharing safer.

Summaries and markdown exports are designed to strip or redact common sensitive details such as:

- absolute paths
- terminal formatting noise
- token-like strings
- environment variable values

That makes it easier to share a screenshot, paste a summary, or post a report without exposing raw local machine details.

You should still review anything before sharing publicly.

---

## Install

```bash
npm install -g vibebug
```

---

## Quickstart

**1) Go to your project folder**

```bash
cd my-project
```

**2) Initialize VibeBug**

```bash
vb init
```

This creates a local `.vibebug/` folder, prepares the database, and stores project config.

**3) Run your normal commands through VibeBug**

```bash
vb npm run build
vb npm test
vb npx tsc
```

If a command fails, VibeBug captures it automatically.

**4) Open the dashboard**

```bash
vb dash
```

This opens the local dashboard so you can see:

- what keeps breaking
- what came back again
- which commands fail most often
- estimated AI spend tied to failures

**5) Record what fixed something**

```bash
vb fix --last --summary "Added null check for undefined response"
```

**6) Generate a shareable summary**

```bash
vb summary
```

**7) Add VibeBug to your AI agent (optional but recommended)**

If you use Claude Code, Cursor, or Cline, add the rules below so your agent uses `vb` automatically. See [Using with AI agents](#using-with-ai-agents) for copy-pasteable templates.

---

## Using with AI agents

If you use Claude Code, Cursor, Cline, or similar AI coding tools, add VibeBug rules to your project so the agent uses `vb` automatically. This is a one-time setup per project.

### Claude Code

Add to your project's `CLAUDE.md`:

```markdown
## VibeBug — Failure Tracking

This project uses VibeBug for automatic failure tracking.

- Prefix all build, test, typecheck, and lint commands with `vb`
  Examples: `vb npm run build`, `vb npm test`, `vb npx tsc`, `vb pytest`
- After fixing a failure, record what you changed:
  vb fix --last --summary "<what you changed>" --root-cause "<why it broke>" --prevention "<how to avoid>" --json
- Before starting work, check for open failures: `vb list`
- Do not repeat fixes that have already been tried — check the failure history first
```

### Cursor

Add to `.cursor/rules` in your project root:

```
## VibeBug — Failure Tracking

This project uses VibeBug for automatic failure tracking.

- Prefix all build, test, typecheck, and lint commands with `vb`
  Examples: `vb npm run build`, `vb npm test`, `vb npx tsc`, `vb pytest`
- After fixing a failure, record what you changed:
  vb fix --last --summary "<what you changed>" --root-cause "<why it broke>" --prevention "<how to avoid>" --json
- Before starting work, check for open failures: `vb list`
- Do not repeat fixes that have already been tried — check the failure history first
```

### Cline

Add to your project's `.clinerules` file:

```
## VibeBug — Failure Tracking

This project uses VibeBug for automatic failure tracking.

- Prefix all build, test, typecheck, and lint commands with `vb`
  Examples: `vb npm run build`, `vb npm test`, `vb npx tsc`, `vb pytest`
- After fixing a failure, record what you changed:
  vb fix --last --summary "<what you changed>" --root-cause "<why it broke>" --prevention "<how to avoid>" --json
- Before starting work, check for open failures: `vb list`
- Do not repeat fixes that have already been tried — check the failure history first
```

### Other agents

Add the same instructions to your agent's system prompt or project rules file. The key rules are: prefix commands with `vb`, and record fixes with `vb fix --last --summary "..." --json`.

VibeBug's `vb fix` command is designed for non-interactive agent use — it accepts `--summary`, `--root-cause`, and `--prevention` flags with `--json` output so agents can record what they fixed without prompts.

---

## Example summary

```
VibeBug Summary — my-project
─────────────────────────────
Runs: 14 today (5 failed) · 312 total
Open captures: 3 · Resolved: 2 · Regressions: 1
Est. AI spend: $2.43

Top recurring failures:
  1. TypeError: Cannot read properties of undefined (4x)
  2. error TS2339: Property does not exist on type (3x)
  3. Module not found: Can't resolve './Button' (2x)

Most expensive (est. AI cost):
  1. TypeError: Cannot read properties of undefined — $0.82
  2. error TS2339: Property does not exist on type — $0.64
  3. Module not found: Can't resolve './Button' — $0.38

Regressions (fixed, then broke again):
  1. TypeError: Cannot read properties of undefined (resolved → recurred)

Top failing commands:
  1. npm run build — 3x
  2. npm test — 2x
  3. npx tsc — 2x
```

---

## Core commands

```bash
vb <command>                 # wrap a command and auto-capture failures
vb init                      # initialize VibeBug in the current project
vb dash                      # open the local dashboard
vb fix --last --summary "…"  # record what fixed the latest open capture
vb list                      # list captured failures
vb summary                   # print a compact share-safe summary
vb export --format markdown  # export a share-safe markdown report
vb ignore list               # view ignored noise patterns
```

---

## Current scope

VibeBug today is:

- open-source
- local-first
- CLI-first
- single-user / project-local
- focused on capture, tracking, summaries, and visibility

VibeBug today is **not**:

- a cloud bug tracker
- a team collaboration platform
- a hosted SaaS
- an automatic fix engine

---

## FAQ

**Does VibeBug slow down my commands?**

No. VibeBug runs your command exactly as you would, then captures the output if it fails. There is no meaningful overhead.

**Does VibeBug send my logs to the cloud?**

No. VibeBug is local-first. Your data stays in your project unless you choose to export or share it.

**Is it safe to share summaries?**

VibeBug is designed to make summaries share-safe by default, but you should still review outputs before posting publicly.

**Does it work only with AI tools?**

No. VibeBug works with any command that can fail. But it is especially useful when coding with AI, because failures tend to be more repetitive and harder to keep track of.

**What kinds of failures does VibeBug track?**

Build errors, test failures, type errors, runtime crashes — anything that produces a non-zero exit code. VibeBug captures the output, groups recurring failures, and tracks regressions automatically.

**Does it replace GitHub Issues, Linear, or Jira?**

No. VibeBug is for local failure tracking and debugging visibility. It helps you understand recurring breakage during development. It is not a replacement for full team planning or project management tools.

**Is VibeBug a bug tracker?**

Not in the traditional sense. VibeBug doesn't do manual filing, assignment, or project management. It automatically captures command-line failures — build errors, test failures, type errors, runtime crashes — groups recurring ones, and tracks regressions. Think of it as a failure memory for your terminal.

**How does AI cost estimation work?**

Every time VibeBug captures a failure, it estimates how many tokens the error log would consume and calculates an approximate cost based on current model pricing (Claude Sonnet by default). It’s a rough estimate for visibility — not a billing tool — designed to help you spot which recurring failures are eating the most AI debugging effort.

---

## Status

VibeBug is in active development and focused on local-first failure tracking for AI-heavy coding workflows.

Current focus: low-friction capture, recurring failure visibility, regressions, and share-safe summaries.

---

## License

MIT
