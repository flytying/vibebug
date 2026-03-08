const BASE = '/api';

async function fetchJson<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json() as Promise<T>;
}

export interface Project {
  id: string;
  name: string;
  rootPath: string;
  createdAt: string;
}

export interface Stats {
  totalIssues: number;
  openIssues: number;
  resolvedIssues: number;
  totalOccurrences: number;
  totalEstimatedCost: number;
  regressions: number;
  severityDistribution: { severity: string; count: number }[];
  typeDistribution: { type: string; count: number }[];
  occurrencesPerDay: { date: string; count: number }[];
  runsToday: number;
  failuresToday: number;
  totalRuns: number;
}

export interface Issue {
  id: string;
  projectId: string;
  title: string;
  type: string;
  severity: string;
  status: string;
  signature: string;
  occurrenceCount: number;
  estimatedTotalCost: number;
  firstSeenAt: string;
  lastSeenAt: string;
  resolvedAt: string | null;
  regressionFlag: boolean;
}

export interface Occurrence {
  id: string;
  issueId: string;
  rawLog: string;
  command: string;
  exitCode: number | null;
  durationMs: number | null;
  gitBranch: string | null;
  gitCommit: string | null;
  appliedDiff: string | null;
  estimatedCost: number;
  capturedFrom: string;
  createdAt: string;
}

export interface FixAttempt {
  id: string;
  summary: string | null;
  rootCause: string | null;
  prevention: string | null;
  source: 'agent' | 'manual' | 'api';
  createdAt: string;
}

export interface IssueDetail extends Issue {
  occurrences: Occurrence[];
  fixAttempts: FixAttempt[];
}

export interface Insights {
  topRecurring: Issue[];
  mostExpensive: Issue[];
  regressions: Issue[];
  failingCommands: { command: string; count: number }[];
}

export const api = {
  getProject: () => fetchJson<Project>('/project'),
  getStats: () => fetchJson<Stats>('/stats'),
  getIssues: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return fetchJson<Issue[]>(`/issues${qs}`);
  },
  getIssue: (id: string) => fetchJson<IssueDetail>(`/issues/${id}`),
  updateIssue: (id: string, data: { status?: string; severity?: string }) =>
    fetchJson<Issue>(`/issues/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  resolveIssue: (id: string, data: { summary?: string; rootCause?: string; prevention?: string; source?: string }) =>
    fetchJson<IssueDetail>(`/issues/${id}/fix`, { method: 'POST', body: JSON.stringify(data) }),
  getInsights: () => fetchJson<Insights>('/insights'),
};
