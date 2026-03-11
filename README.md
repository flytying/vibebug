# VibeBug

**Your terminal failures, remembered automatically.**

A local-first CLI that detects build, test, lint, and runtime failures in real time — across JavaScript, TypeScript, Python, Rust, Go, and common build tools. See what keeps breaking, what came back, and what debugging is costing you.

![VibeBug dashboard overview](./docs/assets/vibebug-dashboard-overview.png)

---

## Why it exists

When you code with AI, failures pile up quickly.

A build breaks. A test fails. You ask the agent to fix it. It does — then it breaks again. You lose the error in terminal scrollback, forget what you already tried, and end up debugging the same issue from scratch.

Most of the problem is not the failure itself. It's the lack of memory around it.

VibeBug gives your terminal a memory.

---

## What it does

A local-first CLI that quietly tracks failures while you work.

VibeBug wraps your normal terminal commands and watches for failures in real time. It catches non-zero exit codes, detects runtime errors from terminal output — even from long-running processes like dev servers — and automatically classifies each failure as build, test, lint, or runtime. It works across JavaScript, TypeScript, Python, Rust, Go, and common build tools. You keep using your tools as usual.

- **Spot recurring failures** — see which issues keep returning instead of treating every failure like a brand-new problem
- **Catch regressions** — when something breaks again after being fixed, VibeBug flags it so it doesn't silently re-enter the loop
- **Understand AI debugging cost** — estimate how much repeated failures are costing you in AI-assisted debugging
- **Keep useful context** — track failure history with command, git context, and fixes so debugging doesn't start from zero every time

Same commands. Same output. More visibility.

---

## How it works

```bash
vb npm run build
vb pytest
vb cargo test
```

1. **Prefix with `vb`** — run your usual build, test, or dev commands through VibeBug
2. **Failures are captured** — VibeBug catches non-zero exit codes and detects runtime errors from terminal output in real time — even from long-running dev servers. Each failure is classified as build, test, lint, or runtime
3. **See what breaks** — review captures in the terminal or open the local dashboard to see recurring bugs, regressions, and estimated AI debugging cost

---

## Who it's for

Made for developers coding fast with AI.

VibeBug is especially useful for developers who:

- work heavily with AI coding tools
- run lots of terminal commands during build and debugging
- keep hitting repeat failures across the same project
- want lightweight visibility without changing how they work

Indie builders · AI-heavy developers · Open-source tool makers · Fast-moving side projects

---

## Your failure data stays with you

VibeBug stores its data locally in your project. No cloud account is required. When you generate summaries or exports, sensitive details like paths and tokens can be sanitized to make sharing safer.

No cloud by default. No account required. Share on your terms.

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

If you use Claude Code, Cursor, Cline, or similar AI coding tools, add VibeBug rules to your project so the agent uses `vb` automatically. This is a one-time setup per project.

**Claude Code** — add to your project's `CLAUDE.md`:

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

**Cursor** — add to `.cursor/rules` in your project root:

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

**Cline** — add to your project's `.clinerules` file:

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

**Other agents** — add the same instructions to your agent's system prompt or project rules file. The key rules are: prefix commands with `vb`, and record fixes with `vb fix --last --summary "..." --json`.

VibeBug's `vb fix` command is designed for non-interactive agent use — it accepts `--summary`, `--root-cause`, and `--prevention` flags with `--json` output so agents can record what they fixed without prompts.

---

## Example summary

```
Project Failure Summary
Open captures: 12
Recurring failures: 4
Regressions: 2
Estimated AI debugging cost: $18.40

Top recurring failures
1. TypeScript build error in src/lib/parser.ts
2. Pytest fixture setup failure in tests/api/test_jobs.py
3. Dev server runtime error: missing env var STRIPE_SECRET_KEY

Most failing commands
- npm run build
- pytest
- npm run dev

Latest regression
- Previously resolved build error returned on feature/onboarding-redesign
```

---

## Core commands

```bash
vb <command>      # Run a command while VibeBug watches for failures
vb dash           # Open the local dashboard
vb list           # View captured failures in the terminal
vb fix --last     # Record what fixed the latest failure
vb summary        # Generate a shareable project failure summary
vb export         # Export data as JSON, CSV, or Markdown
vb ignore         # Suppress noisy patterns
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

**Does VibeBug change how my command runs?**

No. Your command runs normally and output still flows through the terminal as expected.

**Does it send my logs to the cloud?**

No. VibeBug is local-first and stores data locally by default.

**Do I need to change my workflow?**

No. You just prefix commands with `vb` and keep working as usual.

**Is it only for AI coding?**

No, but it is especially useful for AI-assisted workflows where failures are frequent, repeated, and easy to lose in terminal output.

**Can I share results safely?**

Yes. Summaries and exports are designed to be share-safe, with sanitization for sensitive details.

**What kinds of failures does VibeBug track?**

VibeBug captures failed commands (non-zero exit codes) and also detects runtime errors from terminal output in real time — including from long-running processes like dev servers that don't exit on error. It recognizes patterns across many languages and tools (JavaScript, TypeScript, Python, Rust, Go, and common build tools), and automatically classifies each failure as a build, test, lint, or runtime error based on the command that triggered it.

**How does AI cost estimation work?**

Every time VibeBug captures a failure, it estimates how many tokens the error log would consume and calculates an approximate cost based on current model pricing (Claude Sonnet by default). It is a rough estimate for visibility — not a billing tool — designed to help you spot which recurring failures are eating the most AI debugging effort.

---

## Status

VibeBug is in active development and focused on local-first failure tracking for AI-heavy coding workflows.

Current focus: low-friction capture, recurring failure visibility, regressions, and share-safe summaries.

---

## License

MIT
