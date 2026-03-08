import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router';
import { SlidersHorizontal, X, ArrowUpDown, ArrowDown } from 'lucide-react';
import { api } from '../api/client';
import { useApi } from '../hooks/useApi';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

export function IssuesPage() {
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [severity, setSeverity] = useState('');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState('lastSeenAt');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFiltersOpen(false);
      }
    }
    if (filtersOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [filtersOpen]);

  const activeFilterCount = [status, type, severity, from, to].filter(Boolean).length;

  function clearFilters() {
    setStatus('');
    setType('');
    setSeverity('');
    setFrom('');
    setTo('');
  }

  const params: Record<string, string> = { sort };
  if (status) params.status = status;
  if (type) params.type = type;
  if (severity) params.severity = severity;
  if (search) params.search = search;
  if (from) params.from = from;
  if (to) params.to = to;

  const { data: issues, loading } = useApi(() => api.getIssues(params), [status, type, severity, search, from, to, sort]);

  // Compute relative cost tiers for color coding
  const maxCost = issues ? Math.max(...issues.map(i => i.estimatedTotalCost), 0) : 0;

  function costTier(cost: number): 'high' | 'mid' | 'low' {
    if (maxCost <= 0) return 'low';
    const ratio = cost / maxCost;
    if (ratio > 0.6) return 'high';
    if (ratio > 0.25) return 'mid';
    return 'low';
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold tracking-tight">Captures</h1>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <Input
          type="text"
          placeholder="Search captures..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-56 shrink-0"
        />

        {/* Filters dropdown */}
        <div className="relative" ref={filterRef}>
          <Button
            variant="outline"
            onClick={() => setFiltersOpen(!filtersOpen)}
            className="gap-1.5"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                {activeFilterCount}
              </span>
            )}
          </Button>

          {filtersOpen && (
            <div className="absolute left-0 top-full z-50 mt-2 w-80 rounded-xl border border-border bg-card p-4 shadow-lg">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Filters</span>
                {activeFilterCount > 0 && (
                  <button
                    onClick={clearFilters}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Clear all
                  </button>
                )}
              </div>

              <div className="space-y-3">
                <FilterField label="Status">
                  <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full">
                    <option value="">All statuses</option>
                    <option value="open">Open</option>
                    <option value="resolved">Resolved</option>
                    <option value="ignored">Dismissed</option>
                  </Select>
                </FilterField>

                <FilterField label="Type">
                  <Select value={type} onChange={(e) => setType(e.target.value)} className="w-full">
                    <option value="">All types</option>
                    <option value="build">Build</option>
                    <option value="test">Test</option>
                    <option value="lint">Lint</option>
                    <option value="runtime">Runtime</option>
                    <option value="unknown">Unknown</option>
                  </Select>
                </FilterField>

                <FilterField label="Severity">
                  <Select value={severity} onChange={(e) => setSeverity(e.target.value)} className="w-full">
                    <option value="">All severities</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </Select>
                </FilterField>

                <FilterField label="Sort by">
                  <Select value={sort} onChange={(e) => setSort(e.target.value)} className="w-full">
                    <option value="lastSeenAt">Last seen</option>
                    <option value="occurrences">Occurrences</option>
                    <option value="cost">Est. cost</option>
                    <option value="severity">Severity</option>
                  </Select>
                </FilterField>

                <FilterField label="Date range">
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      value={from}
                      onChange={(e) => setFrom(e.target.value)}
                      title="From date"
                      className="min-w-0"
                    />
                    <Input
                      type="date"
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                      title="To date"
                      className="min-w-0"
                    />
                  </div>
                </FilterField>
              </div>
            </div>
          )}
        </div>

        {/* Active filter pills */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {status && <FilterPill label={status} onRemove={() => setStatus('')} />}
            {type && <FilterPill label={type} onRemove={() => setType('')} />}
            {severity && <FilterPill label={severity} onRemove={() => setSeverity('')} />}
            {from && <FilterPill label={`from ${from}`} onRemove={() => setFrom('')} />}
            {to && <FilterPill label={`to ${to}`} onRemove={() => setTo('')} />}
          </div>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : issues && issues.length > 0 ? (
        <Card className="overflow-x-auto">
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead className="w-20">Type</TableHead>
                <TableHead className="w-20">Severity</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <SortableHead value="occurrences" current={sort} onSort={setSort} className="w-16 text-right">Seen</SortableHead>
                <SortableHead value="cost" current={sort} onSort={setSort} className="w-20 text-right">Cost</SortableHead>
                <TableHead className="w-28 text-right">Appeared</TableHead>
                <SortableHead value="lastSeenAt" current={sort} onSort={setSort} className="w-28 text-right">Last seen</SortableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {issues.map((issue) => (
                <TableRow key={issue.id} className="group">
                  <TableCell>
                    <Link to={`/issues/${issue.id}`} className="text-foreground group-hover:text-primary transition-colors">
                      {issue.title.slice(0, 80)}
                    </Link>
                    {issue.regressionFlag && (
                      <Badge variant="danger" className="ml-2">regression</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{issue.type}</Badge>
                  </TableCell>
                  <TableCell>
                    <SeverityBadge severity={issue.severity} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={issue.status} />
                  </TableCell>
                  <TableCell className="text-right text-secondary-foreground font-mono">{issue.occurrenceCount}</TableCell>
                  <TableCell className="text-right">
                    {costTier(issue.estimatedTotalCost) === 'high' ? (
                      <span className="inline-block rounded-md bg-danger/10 text-danger font-semibold font-mono text-[12px] px-1.5 py-0.5">${issue.estimatedTotalCost.toFixed(2)}</span>
                    ) : costTier(issue.estimatedTotalCost) === 'mid' ? (
                      <span className="inline-block rounded-md bg-warning/10 text-warning font-mono text-[12px] px-1.5 py-0.5">${issue.estimatedTotalCost.toFixed(2)}</span>
                    ) : (
                      <span className="text-muted-foreground font-mono">${issue.estimatedTotalCost.toFixed(2)}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground font-mono whitespace-nowrap">{shortDate(issue.firstSeenAt)}</TableCell>
                  <TableCell className="text-right text-muted-foreground font-mono whitespace-nowrap">{timeAgo(issue.lastSeenAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-sm">
            {(status || type || severity || search || from || to)
              ? 'No captures match your filters.'
              : 'No failures captured yet. Prefix commands with vb to start.'}
          </p>
        </div>
      )}
    </div>
  );
}

function SortableHead({
  value,
  current,
  onSort,
  className,
  children,
}: {
  value: string;
  current: string;
  onSort: (v: string) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const active = current === value;
  return (
    <TableHead className={className}>
      <button
        onClick={() => onSort(value)}
        className={`inline-flex items-center gap-1 transition-colors ${active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
      >
        {children}
        {active ? <ArrowDown className="h-3 w-3" /> : <ArrowUpDown className="h-3 w-3 opacity-40" />}
      </button>
    </TableHead>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function FilterPill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
      {label}
      <button onClick={onRemove} className="hover:text-primary/70 transition-colors">
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const variant = severity === 'critical' || severity === 'high' ? 'danger' : severity === 'medium' ? 'default' : 'muted';
  return <Badge variant={variant as 'danger' | 'default' | 'muted'}>{severity}</Badge>;
}

function StatusBadge({ status }: { status: string }) {
  const variant = status === 'open' ? 'warning' : status === 'resolved' ? 'success' : 'muted';
  return <Badge variant={variant as 'warning' | 'success' | 'muted'}>{status}</Badge>;
}

function shortDate(isoStr: string): string {
  const d = new Date(isoStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function timeAgo(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
