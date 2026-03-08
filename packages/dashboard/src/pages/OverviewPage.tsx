import { useCallback } from 'react';
import { api } from '../api/client';
import { useApi } from '../hooks/useApi';
import { useChartColors } from '../hooks/useTheme';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Link } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CopyButton } from '@/components/ui/copy-button';
import { formatOverviewSummary } from '@/lib/format-summary';
import { AlertTriangle, Activity, DollarSign, RotateCcw, Flame, Undo2, Zap, Play } from 'lucide-react';

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#f43f5e',
  high: '#f59e0b',
  medium: '#7c5cfc',
  low: '#3f3d56',
};

function tooltipStyle(colors: ReturnType<typeof useChartColors>) {
  return { backgroundColor: colors.card, border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 12 };
}

function StatCard({ label, value, sub, icon: Icon, accent }: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: string;
}) {
  return (
    <Card className="relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-[2px]" style={{ background: accent ?? 'var(--color-border)' }} />
      <CardContent className="pt-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className="text-2xl font-bold mt-2 tracking-tight">{value}</p>
            {sub && <p className="text-muted-foreground text-[11px] mt-1.5">{sub}</p>}
          </div>
          <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
            <Icon className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function OverviewPage() {
  const { data: project } = useApi(() => api.getProject());
  const { data: stats, loading: statsLoading } = useApi(() => api.getStats());
  const { data: insights, loading: insightsLoading } = useApi(() => api.getInsights());

  const chartColors = useChartColors();

  const getCopyText = useCallback(() => {
    if (!stats || !insights || !project) return '';
    return formatOverviewSummary(stats, insights, project.name, 'compact');
  }, [stats, insights, project]);

  const loading = statsLoading || insightsLoading;
  if (loading || !stats) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  if (stats.totalIssues === 0) {
    return (
      <div className="space-y-8">
        <h1 className="text-xl font-bold tracking-tight">Overview</h1>
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-primary" />
          <CardContent className="py-12 text-center">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Activity className="w-6 h-6 text-primary" />
            </div>
            <h2 className="text-lg font-semibold mb-2">No failures captured yet</h2>
            <p className="text-muted-foreground text-sm max-w-md mx-auto mb-6">
              Prefix any command with <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">vb</code> to start capturing failures automatically.
            </p>
            <div className="bg-muted rounded-lg p-4 max-w-sm mx-auto text-left space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2">Try it</p>
              <code className="block text-sm font-mono text-foreground">vb npm run build</code>
              <code className="block text-sm font-mono text-foreground">vb npm test</code>
            </div>
            {stats.totalRuns > 0 && (
              <p className="text-muted-foreground text-xs mt-6">
                {stats.totalRuns} command{stats.totalRuns !== 1 ? 's' : ''} run so far — all passing.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (stats.totalIssues <= 3) {
    return (
      <div className="space-y-8">
        <h1 className="text-xl font-bold tracking-tight">Overview</h1>
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-primary" />
          <CardContent className="py-10 text-center">
            <h2 className="text-lg font-semibold mb-1">
              {stats.totalIssues === 1
                ? 'Your first failure was captured.'
                : `${stats.totalIssues} failures captured.`}
            </h2>
            <p className="text-muted-foreground text-sm">
              {stats.totalRuns} command{stats.totalRuns !== 1 ? 's' : ''} run
              {stats.failuresToday > 0 ? ` \u2014 ${stats.failuresToday} failed today` : ''}
            </p>
          </CardContent>
        </Card>

        {insights && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InsightCard
              title="What keeps breaking"
              icon={Flame}
              accent="var(--color-primary)"
              emptyText="No recurring failures yet."
              items={insights.topRecurring.slice(0, 3).map(i => ({
                id: i.id,
                label: i.title,
                metric: `${i.occurrenceCount}x`,
                cost: i.estimatedTotalCost,
                status: i.status,
                regression: i.regressionFlag,
              }))}
            />
            <InsightCard
              title="Back again"
              subtitle="Resolved but resurfaced"
              icon={Undo2}
              accent="var(--color-danger)"
              emptyText="No resurfaced failures. Nice."
              items={insights.regressions.slice(0, 3).map(i => ({
                id: i.id,
                label: i.title,
                metric: `${i.occurrenceCount}x`,
                status: i.status,
                regression: true,
              }))}
            />
            <InsightCard
              title="Friction hotspots"
              subtitle="Most failing commands"
              icon={Zap}
              accent="var(--color-warning)"
              emptyText="No command failures yet."
              className="md:col-span-2"
              commandItems={insights.failingCommands.slice(0, 5).map(c => ({
                command: c.command,
                count: c.count,
              }))}
            />
          </div>
        )}
      </div>
    );
  }

  const costStr = stats.totalEstimatedCost < 0.01
    ? `$${stats.totalEstimatedCost.toFixed(4)}`
    : `$${stats.totalEstimatedCost.toFixed(2)}`;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">Overview</h1>
        <CopyButton getText={getCopyText} label="Copy project summary" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Runs Today" value={stats.runsToday} sub={stats.failuresToday > 0 ? `${stats.failuresToday} failed` : 'No failures'} icon={Play} accent="var(--color-primary)" />
        <StatCard label="Open Captures" value={stats.openIssues} icon={AlertTriangle} accent="var(--color-warning)" />
        <StatCard label="Total Occurrences" value={stats.totalOccurrences} icon={Activity} accent="var(--color-primary)" />
        {/* Cost alarm card — visually distinct from other stats */}
        <Card className="relative overflow-hidden bg-danger/5">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-danger" />
          <CardContent className="pt-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Est. AI Spend</p>
                <p className="text-2xl font-bold mt-2 tracking-tight text-danger">{costStr}</p>
                <p className="text-muted-foreground text-[11px] mt-1.5">
                  {stats.totalEstimatedCost > 0
                    ? `Across ${stats.openIssues} open capture${stats.openIssues !== 1 ? 's' : ''}`
                    : 'No wasted spend'}
                </p>
                {stats.totalOccurrences > 0 && stats.totalEstimatedCost > 0 && (
                  <p className="text-danger/60 text-[10px] font-mono mt-1">
                    ~${(stats.totalEstimatedCost / stats.totalOccurrences).toFixed(3)} per failure
                  </p>
                )}
              </div>
              <div className="w-9 h-9 rounded-lg bg-danger/10 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-danger" />
              </div>
            </div>
          </CardContent>
        </Card>
        <StatCard label="Regressions" value={stats.regressions} icon={RotateCcw} accent={stats.regressions > 0 ? 'var(--color-danger)' : 'var(--color-border)'} />
      </div>

      {/* Aha insights — the 3 things that matter most */}
      {insights && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InsightCard
            title="What keeps breaking"
            icon={Flame}
            accent="var(--color-primary)"
            emptyText="No recurring failures yet."
            items={insights.topRecurring.slice(0, 3).map(i => ({
              id: i.id,
              label: i.title,
              metric: `${i.occurrenceCount}x`,
              cost: i.estimatedTotalCost,
              status: i.status,
              regression: i.regressionFlag,
            }))}
          />
          <InsightCard
            title="Back again"
            subtitle="Resolved but resurfaced"
            icon={Undo2}
            accent="var(--color-danger)"
            emptyText="No resurfaced failures. Nice."
            items={insights.regressions.slice(0, 3).map(i => ({
              id: i.id,
              label: i.title,
              metric: `${i.occurrenceCount}x`,
              status: i.status,
              regression: true,
            }))}
          />
          <InsightCard
            title="Friction hotspots"
            subtitle="Most failing commands"
            icon={Zap}
            accent="var(--color-warning)"
            emptyText="No command failures yet."
            className="md:col-span-2"
            commandItems={insights.failingCommands.slice(0, 5).map(c => ({
              command: c.command,
              count: c.count,
            }))}
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Occurrences chart */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Occurrences (30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.occurrencesPerDay.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={stats.occurrencesPerDay}>
                  <XAxis dataKey="date" tick={{ fill: chartColors.axis, fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: chartColors.axis, fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle(chartColors)} labelStyle={{ color: chartColors.muted }} />
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#7c5cfc" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#7c5cfc" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="count" stroke="#7c5cfc" fill="url(#areaGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-sm">No data yet.</p>
            )}
          </CardContent>
        </Card>

        {/* Severity pie */}
        <Card>
          <CardHeader>
            <CardTitle>By Severity</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.severityDistribution.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={stats.severityDistribution}
                      dataKey="count"
                      nameKey="severity"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={3}
                      label={false}
                    >
                      {stats.severityDistribution.map((entry) => (
                        <Cell key={entry.severity} fill={SEVERITY_COLORS[entry.severity] ?? '#5a5670'} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle(chartColors)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex items-center justify-center gap-4 mt-2">
                  {stats.severityDistribution.map((entry) => (
                    <div key={entry.severity} className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: SEVERITY_COLORS[entry.severity] ?? '#5a5670' }} />
                      <span className="text-xs text-muted-foreground capitalize">{entry.severity}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">No data yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function InsightCard({
  title,
  subtitle,
  icon: Icon,
  accent,
  emptyText,
  items,
  commandItems,
  className,
}: {
  title: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  emptyText: string;
  items?: { id: string; label: string; metric: string; cost?: number; status: string; regression: boolean }[];
  commandItems?: { command: string; count: number }[];
  className?: string;
}) {
  const hasContent = (items && items.length > 0) || (commandItems && commandItems.length > 0);

  return (
    <Card className={`relative overflow-hidden ${className ?? ''}`}>
      <div className="absolute top-0 left-0 w-full h-[2px]" style={{ background: accent }} />
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-muted-foreground" />
          <CardTitle className="text-sm">{title}</CardTitle>
        </div>
        {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
      </CardHeader>
      <CardContent>
        {!hasContent ? (
          <p className="text-muted-foreground text-[13px]">{emptyText}</p>
        ) : items ? (
          <div className="space-y-0.5">
            {items.map((item) => (
              <Link
                key={item.id}
                to={`/issues/${item.id}`}
                className="flex items-center justify-between py-2 px-2 rounded-md hover:bg-muted transition-colors group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <StatusDot status={item.status} />
                  <span className="text-[12px] truncate group-hover:text-primary transition-colors">{item.label.slice(0, 50)}</span>
                  {item.regression && <Badge variant="danger" className="text-[10px] px-1.5 py-0">!</Badge>}
                </div>
                <span className="text-[11px] font-mono text-muted-foreground shrink-0 ml-2">
                  {item.metric}
                  {item.cost != null && item.cost > 0 && (
                    <span className="text-danger/70"> · ${item.cost.toFixed(2)}</span>
                  )}
                </span>
              </Link>
            ))}
          </div>
        ) : commandItems ? (
          <div className="space-y-1.5">
            {commandItems.map((cmd) => (
              <div key={cmd.command} className="flex items-center justify-between py-1.5 px-2">
                <code className="text-[11px] text-muted-foreground font-mono truncate">{cmd.command}</code>
                <span className="text-[11px] font-mono text-muted-foreground shrink-0 ml-2">{cmd.count}x</span>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function StatusDot({ status }: { status: string }) {
  const color = status === 'open' ? 'bg-warning' : status === 'resolved' ? 'bg-success' : 'bg-muted-foreground';
  return <span className={`w-2 h-2 rounded-full ${color} inline-block shrink-0`} />;
}
