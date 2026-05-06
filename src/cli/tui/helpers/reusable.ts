/**
 * @fileoverview Reusable TUI helper functions
 * @module cli/tui/helpers/reusable
 *
 * Pure, deterministic helpers imported from pajussara_tui_comp so the local
 * TUI can share the same TypeScript implementation for generic display logic.
 */

export interface SearchMatchSegment {
  text: string;
  isMatch: boolean;
}

export interface LogSearchEntry {
  message?: string;
  time?: number;
}

export interface LogSearchResult {
  matchCount: number;
  matchIndices: number[];
}

export interface StepAlternative {
  number?: number;
  title?: string;
  description?: string;
  tradeoffs?: string;
}

export interface StepDetailInput {
  id?: string;
  name?: string;
  status?: string;
  duration?: number | null;
  retryCount?: number;
  exitCode?: number | null;
  errorMessage?: string | null;
  dependsOn?: string[];
  stepLogs?: string[];
  alternatives?: StepAlternative[];
  recommendedAlternative?: string | null;
}

export interface StepDetailResult {
  lines: string[];
  hasError: boolean;
  logLines: string[];
}

function getClockSegment(value: number): string {
  return String(value).padStart(2, '0');
}

function normalizeProgressPercentage(pct: number): number {
  return Math.min(100, Math.max(0, pct));
}

function normalizeProgressBarWidth(width: number): number {
  return Math.max(4, Math.floor(width));
}

function normalizeSearchQuery(query: string): string | null {
  if (!query || typeof query !== 'string' || query.length === 0) {
    return null;
  }

  return query.toLowerCase();
}

function formatStepAlternatives(
  alternatives: readonly StepAlternative[] | null | undefined,
  recommendedAlternative: string | null | undefined
): string[] {
  if (!Array.isArray(alternatives) || alternatives.length === 0) {
    return [];
  }

  const lines = ['', 'Alternatives:'];

  alternatives.forEach((alt) => {
    lines.push(`  [${alt.number ?? '?'}] ${alt.title ?? ''}`);

    if (alt.description) {
      lines.push(`       ${alt.description.slice(0, 80)}`);
    }

    if (alt.tradeoffs) {
      lines.push(`       Trade-offs: ${alt.tradeoffs.slice(0, 80)}`);
    }
  });

  if (recommendedAlternative) {
    lines.push(`  → Recommended: ${recommendedAlternative}`);
  }

  return lines;
}

function formatStepDependencyList(dependsOn: readonly string[] | null | undefined): string {
  if (!Array.isArray(dependsOn) || dependsOn.length === 0) {
    return '(none)';
  }

  return dependsOn.join(', ');
}

function hasStepError(step: StepDetailInput): boolean {
  return !!(step.exitCode != null || step.errorMessage);
}

export function formatStepIcon(status: string): string {
  switch (status) {
    case 'running':
      return '⚡';
    case 'done':
      return '✅';
    case 'skipped':
      return '⊘';
    case 'error':
      return '❌';
    case 'pending':
    default:
      return '⏳';
  }
}

export function statusColor(status: string): string {
  switch (status) {
    case 'running':
      return 'yellow';
    case 'done':
      return 'green';
    case 'skipped':
      return 'gray';
    case 'error':
      return 'red';
    case 'pending':
    default:
      return 'gray';
  }
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '0s';
  const totalSec = Math.round(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return s === 0 ? `${m}m` : `${m}m${s}s`;
}

export function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  const hh = getClockSegment(d.getHours());
  const mm = getClockSegment(d.getMinutes());
  const ss = getClockSegment(d.getSeconds());
  return `[${hh}:${mm}:${ss}]`;
}

export function formatEta(elapsedMs: number, pct: number): string | null {
  if (!pct || pct <= 0) return null;
  if (pct >= 100) return 'Done';
  const totalEstimated = (elapsedMs / pct) * 100;
  const remaining = totalEstimated - elapsedMs;
  return `ETA ${formatDuration(remaining)}`;
}

export function formatProgressBar(pct: number, width: number): string {
  const safeWidth = normalizeProgressBarWidth(width);
  const safePct = normalizeProgressPercentage(pct);
  const filled = Math.round((safePct / 100) * safeWidth);
  const empty = safeWidth - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

export function formatProgressLine(pct: number, elapsedMs: number, barWidth: number): string {
  const bar = formatProgressBar(pct, barWidth);
  const pctStr = `${Math.round(pct)}%`.padStart(4);
  const elapsed = `Elapsed ${formatDuration(elapsedMs)}`;
  const eta = formatEta(elapsedMs, pct);
  return eta ? `${bar} ${pctStr}  ${elapsed}  ${eta}` : `${bar} ${pctStr}  ${elapsed}`;
}

export function truncateLogLine(line: string, maxWidth: number): string {
  if (typeof line !== 'string') return '';
  if (maxWidth <= 0) return '';
  if (line.length <= maxWidth) return line;
  return `${line.slice(0, maxWidth - 1)}…`;
}

export function keepLast<T>(arr: readonly T[] | null | undefined, n: number): T[] {
  if (!Array.isArray(arr)) return [];
  if (n <= 0) return [];
  return arr.slice(-n);
}

export function terminalIsSufficient(cols: number, rows: number): boolean {
  return cols >= 80 && rows >= 20;
}

export function stepsPanelWidth(totalCols: number): number {
  return Math.min(45, Math.max(25, Math.floor(totalCols * 0.35)));
}

export function filterLogLines(
  logs: readonly LogSearchEntry[] | null | undefined,
  query: string
): LogSearchResult {
  const normalizedQuery = normalizeSearchQuery(query);

  if (!Array.isArray(logs) || !normalizedQuery) {
    return { matchCount: 0, matchIndices: [] };
  }

  const matchIndices: number[] = [];
  for (let i = 0; i < logs.length; i++) {
    const msg = typeof logs[i]?.message === 'string' ? logs[i].message : '';
    if (msg.toLowerCase().includes(normalizedQuery)) {
      matchIndices.push(i);
    }
  }
  return { matchCount: matchIndices.length, matchIndices };
}

export function highlightSearchMatch(line: string, query: string): SearchMatchSegment[] {
  if (typeof line !== 'string') return [{ text: '', isMatch: false }];

  const normalizedQuery = normalizeSearchQuery(query);
  if (!normalizedQuery) {
    return [{ text: line, isMatch: false }];
  }

  const lower = line.toLowerCase();
  const segments: SearchMatchSegment[] = [];
  let start = 0;
  let idx = lower.indexOf(normalizedQuery);
  while (idx !== -1) {
    if (idx > start) segments.push({ text: line.slice(start, idx), isMatch: false });
    segments.push({ text: line.slice(idx, idx + query.length), isMatch: true });
    start = idx + query.length;
    idx = lower.indexOf(normalizedQuery, start);
  }
  if (start < line.length) segments.push({ text: line.slice(start), isMatch: false });
  return segments.length > 0 ? segments : [{ text: line, isMatch: false }];
}

export function truncateStackTrace(stack: string | null | undefined, maxLines = 20): string[] {
  if (!stack || typeof stack !== 'string') return [];
  return stack.split('\n').slice(0, Math.max(1, Math.floor(maxLines)));
}

export function formatStepDetail(step: StepDetailInput | null | undefined): StepDetailResult {
  if (!step) return { lines: [], hasError: false, logLines: [] };
  const lines = [
    `Name:       ${step.name ?? '(unknown)'}`,
    `ID:         ${step.id ?? '(unknown)'}`,
    `Status:     ${step.status ?? 'pending'}`,
  ];
  if (step.duration != null) lines.push(`Duration:   ${formatDuration(step.duration)}`);
  if (step.retryCount != null && step.retryCount > 0) lines.push(`Retries:    ${step.retryCount}`);
  lines.push(`Depends-on: ${formatStepDependencyList(step.dependsOn)}`);
  const hasError = hasStepError(step);
  if (step.exitCode != null) lines.push(`Exit code:  ${step.exitCode}`);
  if (step.errorMessage) lines.push(`Error:      ${step.errorMessage}`);
  lines.push(...formatStepAlternatives(step.alternatives, step.recommendedAlternative));
  const logLines = keepLast(step.stepLogs, 10);
  return { lines, hasError, logLines };
}
