import { useCallback } from 'react';
import { Link } from 'react-router';
import { api } from '../api/client';
import { useApi } from '../hooks/useApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CopyButton } from '@/components/ui/copy-button';
import { formatInsightCard, formatCost as fmtCost } from '@/lib/format-summary';

export function InsightsPage() {
  const { data: insights, loading } = useApi(() => api.getInsights());

  const getCopyExpensive = useCallback(() => {
    if (!insights) return '';
    return formatInsightCard('Most Expensive Failures',
      insights.mostExpensive.map(i => ({ label: i.title, metric: fmtCost(i.estimatedTotalCost) }))
    );
  }, [insights]);

  const getCopyRegressions = useCallback(() => {
    if (!insights) return '';
    return formatInsightCard('Regressions',
      insights.regressions.map(i => ({ label: i.title, metric: `${i.occurrenceCount}x` }))
    );
  }, [insights]);

  const getCopyRecurring = useCallback(() => {
    if (!insights) return '';
    return formatInsightCard('Top Recurring Failures',
      insights.topRecurring.map(i => ({ label: i.title, metric: `${i.occurrenceCount}x` }))
    );
  }, [insights]);

  const getCopyCommands = useCallback(() => {
    if (!insights) return '';
    return formatInsightCard('Most Failing Commands',
      insights.failingCommands.map(c => ({ label: c.command, metric: `${c.count}x` }))
    );
  }, [insights]);

  if (loading || !insights) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold tracking-tight">Insights</h1>

      {/* Most expensive issues */}
      <Card className="relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[2px] bg-danger" />
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Most Expensive Failures (Est. AI Spend)</CardTitle>
            <CopyButton getText={getCopyExpensive} label="Copy expensive failures" />
          </div>
          {insights.mostExpensive.length > 0 && (
            <p className="text-[11px] text-muted-foreground mt-1">
              ${insights.mostExpensive.reduce((sum, i) => sum + i.estimatedTotalCost, 0).toFixed(2)} total across {insights.mostExpensive.length} failure{insights.mostExpensive.length !== 1 ? 's' : ''}
            </p>
          )}
        </CardHeader>
        <CardContent>
          {insights.mostExpensive.length > 0 ? (() => {
            const maxCost = Math.max(...insights.mostExpensive.map(i => i.estimatedTotalCost));
            return (
              <div className="space-y-0.5">
                {insights.mostExpensive.map((issue) => (
                  <CostIssueRow key={issue.id} issue={issue} maxCost={maxCost} />
                ))}
              </div>
            );
          })() : (
            <Empty />
          )}
        </CardContent>
      </Card>

      {/* Regressions */}
      <Card className="relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[2px] bg-warning" />
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Resurfaced Failures (Resolved, Then Came Back)</CardTitle>
            <CopyButton getText={getCopyRegressions} label="Copy regressions" />
          </div>
        </CardHeader>
        <CardContent>
          {insights.regressions.length > 0 ? (
            <div className="space-y-0.5">
              {insights.regressions.map((issue) => (
                <IssueRow key={issue.id} issue={issue} metric={`${issue.occurrenceCount}x`} />
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-[13px]">No resurfaced failures. Nice.</p>
          )}
        </CardContent>
      </Card>

      {/* Top recurring */}
      <Card className="relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[2px] bg-primary" />
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Top Recurring Failures</CardTitle>
            <CopyButton getText={getCopyRecurring} label="Copy recurring failures" />
          </div>
        </CardHeader>
        <CardContent>
          {insights.topRecurring.length > 0 ? (
            <div className="space-y-0.5">
              {insights.topRecurring.map((issue) => (
                <IssueRow key={issue.id} issue={issue} metric={`${issue.occurrenceCount}x`} />
              ))}
            </div>
          ) : (
            <Empty />
          )}
        </CardContent>
      </Card>

      {/* Most failing commands */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Most Failing Commands</CardTitle>
            <CopyButton getText={getCopyCommands} label="Copy failing commands" />
          </div>
        </CardHeader>
        <CardContent>
          {insights.failingCommands.length > 0 ? (() => {
            const maxCount = Math.max(...insights.failingCommands.map(c => c.count));
            return (
              <div className="space-y-1.5">
                {insights.failingCommands.map((cmd) => (
                  <CommandRow key={cmd.command} command={cmd.command} count={cmd.count} maxCount={maxCount} />
                ))}
              </div>
            );
          })() : (
            <Empty />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CostIssueRow({ issue, maxCost }: { issue: { id: string; title: string; status: string; regressionFlag: boolean; estimatedTotalCost: number }; maxCost: number }) {
  const widthPercent = maxCost > 0 ? (issue.estimatedTotalCost / maxCost) * 100 : 0;
  return (
    <Link
      to={`/issues/${issue.id}`}
      className="relative flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-muted transition-colors group overflow-hidden"
    >
      {/* Proportional background bar */}
      <div
        className="absolute inset-y-0 left-0 bg-danger/8 rounded-lg"
        style={{ width: `${widthPercent}%` }}
      />
      <div className="relative flex items-center gap-3 text-[13px] min-w-0">
        <StatusDot status={issue.status} />
        <span className="truncate group-hover:text-primary transition-colors">{issue.title.slice(0, 70)}</span>
        {issue.regressionFlag && <Badge variant="danger">regression</Badge>}
      </div>
      <span className="relative text-xs font-mono text-danger font-medium shrink-0 ml-4">${issue.estimatedTotalCost.toFixed(2)}</span>
    </Link>
  );
}

function IssueRow({ issue, metric }: { issue: { id: string; title: string; status: string; regressionFlag: boolean }; metric: string }) {
  return (
    <Link
      to={`/issues/${issue.id}`}
      className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-muted transition-colors group"
    >
      <div className="flex items-center gap-3 text-[13px] min-w-0">
        <StatusDot status={issue.status} />
        <span className="truncate group-hover:text-primary transition-colors">{issue.title.slice(0, 70)}</span>
        {issue.regressionFlag && <Badge variant="danger">regression</Badge>}
      </div>
      <span className="text-xs font-mono text-secondary-foreground shrink-0 ml-4">{metric}</span>
    </Link>
  );
}

function StatusDot({ status }: { status: string }) {
  const color = status === 'open' ? 'bg-warning' : status === 'resolved' ? 'bg-success' : 'bg-muted-foreground';
  return <span className={`w-2 h-2 rounded-full ${color} inline-block shrink-0`} />;
}

function CommandRow({ command, count, maxCount }: { command: string; count: number; maxCount: number }) {
  const widthPercent = maxCount > 0 ? (count / maxCount) * 100 : 0;
  return (
    <div className="relative flex items-center justify-between py-2 px-3 rounded-lg overflow-hidden">
      <div
        className="absolute inset-y-0 left-0 bg-primary/10 rounded-lg"
        style={{ width: `${widthPercent}%` }}
      />
      <span className="relative text-[13px] font-mono text-muted-foreground truncate min-w-0 mr-4">{command}</span>
      <span className="relative text-xs font-mono text-primary font-medium shrink-0">{count}x</span>
    </div>
  );
}

function Empty() {
  return <p className="text-muted-foreground text-[13px]">No data yet.</p>;
}
