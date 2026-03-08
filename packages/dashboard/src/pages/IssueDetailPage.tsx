import { useParams, Link } from 'react-router';
import { api, type IssueDetail, type FixAttempt } from '../api/client';
import { useApi } from '../hooks/useApi';
import { useChartColors } from '../hooks/useTheme';
import { useState, useRef, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, GitBranch, Terminal, Clock, Wrench, AlertCircle, Bot, User, HelpCircle } from 'lucide-react';

function tooltipStyle(colors: ReturnType<typeof useChartColors>) {
  return { backgroundColor: colors.card, border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 12 };
}

export function IssueDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: issue, loading, refetch } = useApi(() => api.getIssue(id!), [id]);
  const chartColors = useChartColors();

  if (loading || !issue) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link to="/issues" className="hover:text-secondary-foreground transition-colors">Captures</Link>
        <span>/</span>
        <Badge variant="muted" className="font-mono">{issue.id.slice(0, 7)}</Badge>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-lg font-bold tracking-tight">{issue.title}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <Badge variant="outline">{issue.type}</Badge>
            <SeverityBadge severity={issue.severity} />
            <Badge variant="muted">{issue.occurrenceCount} occurrence{issue.occurrenceCount !== 1 ? 's' : ''}</Badge>
            <Badge variant="danger">
              ~${issue.estimatedTotalCost.toFixed(2)} AI spend
              {issue.occurrenceCount > 0 && ` · ~$${(issue.estimatedTotalCost / issue.occurrenceCount).toFixed(3)}/failure`}
            </Badge>
            {issue.regressionFlag && <Badge variant="danger">regression</Badge>}
          </div>
        </div>
        <StatusActions issue={issue} onUpdate={refetch} />
      </div>

      {/* Occurrence chart */}
      <OccurrenceChart occurrences={issue.occurrences} chartColors={chartColors} />

      {/* Fix History Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Fix History
            {issue.fixAttempts.length > 0 && (
              <Badge variant="muted">{issue.fixAttempts.length} fix{issue.fixAttempts.length !== 1 ? 'es' : ''}</Badge>
            )}
            <div className="relative group">
              <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/50 hover:text-muted-foreground cursor-help transition-colors" />
              <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 rounded-lg border border-border bg-card p-3 shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none whitespace-nowrap">
                <div className="space-y-2 text-[11px]">
                  <div className="flex items-center gap-2">
                    <Badge variant="danger" className="text-[10px] px-1.5 py-0 shrink-0">failed</Badge>
                    <span className="text-muted-foreground">Command failed</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="text-[10px] px-1.5 py-0 gap-0.5 shrink-0"><Bot className="w-2.5 h-2.5" />AI fix applied</Badge>
                    <span className="text-muted-foreground">Agent patched the code</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="success" className="text-[10px] px-1.5 py-0 shrink-0">fixed</Badge>
                    <span className="text-muted-foreground">Fix recorded via <code className="bg-muted px-1 rounded">vb fix</code></span>
                  </div>
                </div>
              </div>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {issue.fixAttempts.length > 0 || issue.occurrences.length > 0 ? (
            <FixTimeline issue={issue} />
          ) : (
            <p className="text-muted-foreground text-[13px]">
              No activity yet. Use <code className="bg-muted px-1.5 py-0.5 rounded text-[11px]">vb fix</code> to annotate a fix.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Occurrences */}
      <Card>
        <CardHeader>
          <CardTitle>Occurrences ({issue.occurrences.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {issue.occurrences.map((occ) => (
            <OccurrenceCard key={occ.id} occurrence={occ} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const variant = severity === 'critical' || severity === 'high' ? 'danger' : severity === 'medium' ? 'default' : 'muted';
  return <Badge variant={variant as 'danger' | 'default' | 'muted'}>{severity}</Badge>;
}

const STATUS_CONFIG: Record<string, { label: string; action: string; dot: string; btnClass: string; confirmVariant: 'success' | 'warning' | 'ghost'; description: string }> = {
  open: {
    label: 'Open',
    action: 'Reopen',
    dot: 'bg-warning',
    btnClass: 'border-warning/30 bg-warning/10 text-warning hover:bg-warning/15',
    confirmVariant: 'warning',
    description: 'Reopen this capture and mark it as active again.',
  },
  resolved: {
    label: 'Resolved',
    action: 'Resolve',
    dot: 'bg-success',
    btnClass: 'border-success/30 bg-success/10 text-success hover:bg-success/15',
    confirmVariant: 'success',
    description: 'Mark this capture as resolved. You can add an optional fix summary.',
  },
  ignored: {
    label: 'Dismissed',
    action: 'Dismiss',
    dot: 'bg-muted-foreground',
    btnClass: 'border-border bg-muted text-muted-foreground hover:bg-muted/80',
    confirmVariant: 'ghost',
    description: "Dismiss this capture. It won't appear in active counts.",
  },
};

function StatusActions({ issue, onUpdate }: { issue: IssueDetail; onUpdate: () => void }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<string | null>(null);
  const [summary, setSummary] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [dropdownOpen]);

  const handleConfirm = async () => {
    if (!confirmTarget) return;
    if (confirmTarget === 'resolved') {
      await api.resolveIssue(issue.id, {
        summary: summary || undefined,
        source: 'manual',
      });
    } else {
      await api.updateIssue(issue.id, { status: confirmTarget });
    }
    setSummary('');
    setConfirmTarget(null);
    onUpdate();
  };

  const current = STATUS_CONFIG[issue.status] ?? STATUS_CONFIG.open;
  const transitions = Object.entries(STATUS_CONFIG).filter(([key]) => key !== issue.status);
  const target = confirmTarget ? STATUS_CONFIG[confirmTarget] : null;

  return (
    <>
      <div className="relative shrink-0" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors border cursor-pointer',
            current.btnClass,
          )}
        >
          <span className={`w-2 h-2 rounded-full ${current.dot}`} />
          {current.label}
          <ChevronDown className={cn('w-3 h-3 transition-transform', dropdownOpen && 'rotate-180')} />
        </button>

        {dropdownOpen && (
          <div className="absolute right-0 top-full z-50 mt-1.5 w-40 rounded-lg border border-border bg-card p-1 shadow-lg">
            {transitions.map(([key, config]) => (
              <button
                key={key}
                onClick={() => {
                  setConfirmTarget(key);
                  setDropdownOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs hover:bg-muted transition-colors text-left cursor-pointer"
              >
                <span className={`w-2 h-2 rounded-full ${config.dot}`} />
                {config.action}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Confirmation modal */}
      {confirmTarget && target && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
          onClick={() => { setConfirmTarget(null); setSummary(''); }}
        >
          <div
            className="bg-card border border-border rounded-xl shadow-xl w-96 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold mb-1">{target.action} capture</h3>
            <p className="text-xs text-muted-foreground mb-4">{target.description}</p>

            {confirmTarget === 'resolved' && (
              <Input
                type="text"
                placeholder="Fix summary (optional)"
                value={summary}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSummary(e.target.value)}
                className="w-full text-xs mb-4"
                onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && handleConfirm()}
                autoFocus
              />
            )}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setConfirmTarget(null); setSummary(''); }}>
                Cancel
              </Button>
              <Button variant={target.confirmVariant} size="sm" onClick={handleConfirm}>
                {target.action}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ─── Fix History Timeline ─── */

type TimelineEvent =
  | { kind: 'occurrence'; data: IssueDetail['occurrences'][0] }
  | { kind: 'fix'; data: FixAttempt };

function FixTimeline({ issue }: { issue: IssueDetail }) {
  const events: TimelineEvent[] = [
    ...issue.occurrences.map((o) => ({ kind: 'occurrence' as const, data: o })),
    ...issue.fixAttempts.map((f) => ({ kind: 'fix' as const, data: f })),
  ].sort((a, b) => new Date(a.data.createdAt).getTime() - new Date(b.data.createdAt).getTime());

  return (
    <div className="relative pl-6 space-y-3">
      {/* Vertical timeline line */}
      <div className="absolute left-[9px] top-2 bottom-2 w-px bg-border" />

      {events.map((event) => (
        <div key={`${event.kind}-${event.data.id}`} className="relative flex gap-3 items-start">
          {/* Timeline dot */}
          <div className={cn(
            'absolute left-[-15px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-card',
            event.kind === 'fix' ? 'bg-success' :
            (event.kind === 'occurrence' && event.data.appliedDiff) ? 'bg-primary' :
            'bg-danger'
          )} />

          {event.kind === 'fix' ? (
            <FixEvent fix={event.data} />
          ) : (
            <OccurrenceEvent occurrence={event.data} />
          )}
        </div>
      ))}
    </div>
  );
}

function FixEvent({ fix }: { fix: FixAttempt }) {
  return (
    <div className="flex-1 border border-success/20 bg-success/5 rounded-lg p-3 text-[13px]">
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <Wrench className="w-3 h-3 text-success" />
        <Badge variant="success">fixed</Badge>
        <SourceBadge source={fix.source} />
        <span className="text-muted-foreground text-[11px] ml-auto">
          {new Date(fix.createdAt).toLocaleString()}
        </span>
      </div>
      {fix.summary && <p className="mt-1.5">{fix.summary}</p>}
      {fix.rootCause && (
        <p className="text-secondary-foreground mt-1">
          <span className="text-muted-foreground font-medium">Cause:</span> {fix.rootCause}
        </p>
      )}
      {fix.prevention && (
        <p className="text-secondary-foreground mt-1">
          <span className="text-muted-foreground font-medium">Prevention:</span> {fix.prevention}
        </p>
      )}
    </div>
  );
}

function OccurrenceEvent({ occurrence }: { occurrence: IssueDetail['occurrences'][0] }) {
  const [showDiff, setShowDiff] = useState(false);

  return (
    <div className="flex-1 border border-border rounded-lg p-3 text-[13px]">
      <div className="flex items-center gap-2 flex-wrap">
        <AlertCircle className="w-3 h-3 text-danger" />
        <Badge variant="danger">failed</Badge>
        {occurrence.appliedDiff && (
          <Badge variant="default" className="gap-1">
            <Bot className="w-3 h-3" />
            AI fix applied
          </Badge>
        )}
        <span className="font-mono text-[11px] text-muted-foreground">{occurrence.command}</span>
        {occurrence.gitBranch && (
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <GitBranch className="w-3 h-3" />
            <span className="font-mono">{occurrence.gitBranch}@{occurrence.gitCommit?.slice(0, 7)}</span>
          </span>
        )}
        <span className="text-muted-foreground text-[11px] ml-auto">
          {new Date(occurrence.createdAt).toLocaleString()}
        </span>
      </div>

      {occurrence.appliedDiff && (
        <div className="mt-2">
          <button
            onClick={() => setShowDiff(!showDiff)}
            className="text-[12px] text-primary hover:text-primary/80 font-medium transition-colors flex items-center gap-1"
          >
            {showDiff ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {showDiff ? 'Hide' : 'View'} applied diff
          </button>
          {showDiff && (
            <pre className="bg-background text-[12px] p-3 rounded-lg overflow-x-auto max-h-64 overflow-y-auto font-mono leading-relaxed whitespace-pre-wrap mt-2">
              {occurrence.appliedDiff.split('\n').map((line, i) => (
                <span key={i} className={
                  line.startsWith('+') ? 'text-success' :
                  line.startsWith('-') ? 'text-danger' :
                  line.startsWith('@@') ? 'text-cyan-400' :
                  'text-muted-foreground'
                }>
                  {line}{'\n'}
                </span>
              ))}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

function SourceBadge({ source }: { source: string }) {
  if (source === 'agent') {
    return (
      <Badge variant="default" className="gap-1">
        <Bot className="w-3 h-3" />
        agent
      </Badge>
    );
  }
  if (source === 'api') return <Badge variant="outline">api</Badge>;
  return (
    <Badge variant="muted" className="gap-1">
      <User className="w-3 h-3" />
      manual
    </Badge>
  );
}

/* ─── Charts & Occurrence Details ─── */

function OccurrenceChart({ occurrences, chartColors }: { occurrences: IssueDetail['occurrences']; chartColors: ReturnType<typeof useChartColors> }) {
  const countByDay: Record<string, number> = {};
  for (const occ of occurrences) {
    const day = occ.createdAt.slice(0, 10);
    countByDay[day] = (countByDay[day] ?? 0) + 1;
  }
  const data = Object.entries(countByDay)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (data.length < 2) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Occurrence Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={150}>
          <BarChart data={data}>
            <XAxis dataKey="date" tick={{ fill: chartColors.axis, fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill: chartColors.axis, fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle(chartColors)} labelStyle={{ color: chartColors.muted }} />
            <Bar dataKey="count" fill="#7c5cfc" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function OccurrenceCard({ occurrence }: { occurrence: IssueDetail['occurrences'][0] }) {
  const [expanded, setExpanded] = useState(false);
  const [showDiff, setShowDiff] = useState(false);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors text-left"
      >
        <div className="flex items-center gap-3 text-[13px]">
          <Terminal className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-secondary-foreground font-mono">{occurrence.command}</span>
          {occurrence.exitCode !== null && (
            <span className="text-[11px] text-muted-foreground">exit {occurrence.exitCode}</span>
          )}
          {occurrence.capturedFrom === 'stream' && (
            <Badge variant="default" className="text-[10px]">stream</Badge>
          )}
          {occurrence.gitBranch && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <GitBranch className="w-3 h-3" />
              <span className="font-mono">{occurrence.gitBranch}@{occurrence.gitCommit?.slice(0, 7)}</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="font-mono text-danger/80 font-medium">-${occurrence.estimatedCost.toFixed(3)}</span>
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(occurrence.createdAt).toLocaleString()}</span>
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border">
          <div className="p-4">
            <p className="text-[11px] text-muted-foreground mb-2 uppercase tracking-wider font-medium">Raw Output</p>
            <pre className="bg-background text-secondary-foreground text-[12px] p-3 rounded-lg overflow-x-auto max-h-64 overflow-y-auto font-mono leading-relaxed whitespace-pre-wrap">
              {occurrence.rawLog}
            </pre>
          </div>

          {occurrence.appliedDiff && (
            <div className="px-4 pb-4">
              <button
                onClick={() => setShowDiff(!showDiff)}
                className="text-[12px] text-primary hover:text-primary/80 mb-2 font-medium transition-colors"
              >
                {showDiff ? 'Hide' : 'Show'} applied diff (AI fix attempt)
              </button>
              {showDiff && (
                <pre className="bg-background text-[12px] p-3 rounded-lg overflow-x-auto max-h-64 overflow-y-auto font-mono leading-relaxed whitespace-pre-wrap">
                  {occurrence.appliedDiff.split('\n').map((line, i) => (
                    <span key={i} className={
                      line.startsWith('+') ? 'text-success' :
                      line.startsWith('-') ? 'text-danger' :
                      line.startsWith('@@') ? 'text-cyan-400' :
                      'text-muted-foreground'
                    }>
                      {line}{'\n'}
                    </span>
                  ))}
                </pre>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
