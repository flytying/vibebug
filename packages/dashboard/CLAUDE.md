# VibeBug Dashboard

## Commands

```bash
pnpm dev          # Vite dev server (proxies /api → localhost:7600)
pnpm build        # tsc + vite build → ../cli/static/
pnpm preview      # Preview production build locally
```

**Dev requires the CLI server running:** `cd ../cli && pnpm build && node dist/index.js dash`

## Key Files

| File | Purpose |
|------|---------|
| `src/main.tsx` | Entry — wraps App in ThemeProvider |
| `src/App.tsx` | Router + top nav layout |
| `src/api/client.ts` | Typed API client (all fetch calls + interfaces) |
| `src/hooks/useTheme.tsx` | ThemeProvider context, useTheme, useChartColors |
| `src/hooks/useApi.ts` | Generic async data fetcher with loading/error/refetch |
| `src/lib/utils.ts` | `cn()` helper (clsx + tailwind-merge) |
| `src/lib/format-summary.ts` | Single source of truth for all copy/export text formatting |
| `src/components/ui/copy-button.tsx` | Clipboard copy button (2s checkmark feedback) |

## Pages

| Page | Route | Purpose |
|------|-------|---------|
| OverviewPage | `/` | Stats cards (Open Captures, etc.), occurrence chart, severity pie, recent failures |
| IssuesPage | `/issues` | Filterable/searchable capture list with combined filter dropdown + "Appeared" column |
| IssueDetailPage | `/issues/:id` | Fix History timeline, occurrences, raw logs, status dropdown (open/resolved/dismissed) with confirmation modal |
| InsightsPage | `/insights` | Top recurring failures, most expensive failures, regressions, failing commands (HTML-based bars) |

## IssueDetailPage — Fix History Timeline

The Fix History timeline shows three event types:

| Badge | Meaning | Source |
|-------|---------|--------|
| `failed` (danger) | Command failed / error captured | Occurrence with no `appliedDiff` |
| `failed` + `AI fix applied` (danger + default w/ Bot icon) | Command failed, agent patched code | Occurrence with `appliedDiff` present |
| `fixed` (success) | Fix recorded via `vb fix` | FixAttempt entry |

A `(?)` tooltip on the Fix History card header explains these three states inline.

Occurrences with `appliedDiff` show a collapsible diff viewer (syntax-highlighted, scrollable).

Status changes use a dropdown (open/resolved/dismissed) with a confirmation modal before applying.

## Theme System

**Do NOT use `getComputedStyle` for chart colors.** The `.dark` class is toggled in `useEffect` (post-render), so CSS variables read during render return stale values.

Instead, use the static `CHART_COLORS` map in `useTheme.tsx`:

```typescript
import { useChartColors } from '@/hooks/useTheme';

const chartColors = useChartColors(); // returns { axis, muted, card, border }
```

- Theme state lives in React Context (`ThemeProvider` in `main.tsx`)
- Persisted to `localStorage` key `vb-theme`
- Default theme: `dark`

## Component Patterns

- UI components in `components/ui/` follow ShadCN conventions (CVA variants + `cn()`)
- Path alias: `@/*` resolves to `./src/*` (tsconfig paths + Vite alias)
- Charts use Recharts for line/pie charts — always use `useChartColors()` for axis/tooltip styling
- Insights "Most Failing Commands" uses HTML-based proportional bars (not Recharts) for reliability
- Button variants include: `default`, `outline`, `ghost`, `success`, `warning`, `danger`
- Copy buttons use `CopyButton` component from `components/ui/copy-button.tsx` — all text formatting goes through `lib/format-summary.ts` (pages provide data, never compose strings)
- Print/screenshot styles: `@media print` hides nav + `.no-print` elements; `.share-mode` class provides clean screenshot layout

## Build Output

`vite build` outputs to `packages/cli/static/` (NOT `packages/dashboard/dist/`). The CLI's Hono server serves these files with SPA fallback (all non-API routes serve `index.html`).

## Gotchas

- **JSX files must use `.tsx` extension** — TypeScript requires this. The `useTheme` hook was renamed from `.ts` to `.tsx` for this reason.
- **Recharts tooltip/axis styles** are inline objects, not CSS classes. Use `useChartColors()` return values, not CSS variables.
- **Recharts horizontal BarChart** (`layout="vertical"`) has rendering bugs — avoid it. Use HTML-based proportional bars instead (see `CommandRow` pattern in InsightsPage).
- **API client base URL** is empty string (relative paths). Works because Vite proxies `/api` in dev, and the CLI serves both static files and API in production.
- **No SSR** — pure client-side SPA. `typeof window === 'undefined'` guard exists only for theme initialization safety.
- **CSS tooltips** use `group`/`group-hover` pattern with `whitespace-nowrap` for single-line content. No JS state needed.
- **No HMR for preview** — changes require `pnpm build` from project root + server restart to see updates.
