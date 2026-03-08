export interface RunResult {
  exitCode: number | null;
  signal: string | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  command: string;
}

export interface GitContext {
  branch: string | null;
  commit: string | null;
  dirty: boolean | null;
}

export interface Project {
  id: string;
  name: string;
  rootPath: string;
  createdAt: string;
  updatedAt: string;
}

export interface Issue {
  id: string;
  projectId: string;
  title: string;
  type: 'build' | 'runtime' | 'test' | 'lint' | 'unknown';
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'resolved' | 'ignored';
  signature: string;
  occurrenceCount: number;
  estimatedTotalCost: number;
  firstSeenAt: string;
  lastSeenAt: string;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Occurrence {
  id: string;
  issueId: string;
  rawLog: string;
  command: string;
  exitCode: number | null;
  signal: string | null;
  durationMs: number | null;
  gitBranch: string | null;
  gitCommit: string | null;
  gitDirty: boolean | null;
  appliedDiff: string | null;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCost: number;
  createdAt: string;
}

export interface FixAttempt {
  id: string;
  issueId: string;
  summary: string | null;
  rootCause: string | null;
  prevention: string | null;
  successful: boolean | null;
  source: 'agent' | 'manual' | 'api';
  createdAt: string;
}

export interface CaptureInput {
  project: Project;
  commandStr: string;
  result: RunResult;
  gitContext: GitContext;
  skipSignatures?: Set<string>;
}
