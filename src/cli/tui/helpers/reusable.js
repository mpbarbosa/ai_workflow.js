/**
 * @fileoverview Reusable TUI helper functions
 * @module cli/tui/helpers/reusable
 *
 * Pure, deterministic helpers that are generic enough to reuse across TUI
 * components without encoding ai-workflow-specific content.
 */

/**
 * Map a step status string to a display icon.
 *
 * @param {'pending'|'running'|'done'|'skipped'|'error'} status
 * @returns {string}
 */
export function formatStepIcon(status) {
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

/**
 * Return the chalk color name for a given step status.
 *
 * @param {'pending'|'running'|'done'|'skipped'|'error'} status
 * @returns {string}
 */
export function statusColor(status) {
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

/**
 * Format a millisecond duration into a human-readable string.
 *
 * @param {number} ms
 * @returns {string}
 */
export function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '0s';
  const totalSec = Math.round(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return s === 0 ? `${m}m` : `${m}m${s}s`;
}

/**
 * Format a timestamp (ms since epoch) as [HH:MM:SS].
 *
 * @param {number} ts
 * @returns {string}
 */
export function formatTimestamp(ts) {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `[${hh}:${mm}:${ss}]`;
}

/**
 * Estimate ETA given elapsed time and completion percentage.
 *
 * @param {number} elapsedMs
 * @param {number} pct
 * @returns {string|null}
 */
export function formatEta(elapsedMs, pct) {
  if (!pct || pct <= 0) return null;
  if (pct >= 100) return 'Done';
  const totalEstimated = (elapsedMs / pct) * 100;
  const remaining = totalEstimated - elapsedMs;
  return `ETA ${formatDuration(remaining)}`;
}

/**
 * Render an ASCII progress bar string.
 *
 * @param {number} pct
 * @param {number} width
 * @returns {string}
 */
export function formatProgressBar(pct, width) {
  const safeWidth = Math.max(4, Math.floor(width));
  const safePct = Math.min(100, Math.max(0, pct));
  const filled = Math.round((safePct / 100) * safeWidth);
  const empty = safeWidth - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

/**
 * Build the full progress line string (bar + stats).
 *
 * @param {number} pct
 * @param {number} elapsedMs
 * @param {number} barWidth
 * @returns {string}
 */
export function formatProgressLine(pct, elapsedMs, barWidth) {
  const bar = formatProgressBar(pct, barWidth);
  const pctStr = `${Math.round(pct)}%`.padStart(4);
  const elapsed = `Elapsed ${formatDuration(elapsedMs)}`;
  const eta = formatEta(elapsedMs, pct);
  return eta ? `${bar} ${pctStr}  ${elapsed}  ${eta}` : `${bar} ${pctStr}  ${elapsed}`;
}

/**
 * Truncate a log line to fit within a maximum width.
 *
 * @param {string} line
 * @param {number} maxWidth
 * @returns {string}
 */
export function truncateLogLine(line, maxWidth) {
  if (typeof line !== 'string') return '';
  if (maxWidth <= 0) return '';
  if (line.length <= maxWidth) return line;
  return `${line.slice(0, maxWidth - 1)}…`;
}

/**
 * Keep only the last N entries from an array.
 *
 * @param {Array} arr
 * @param {number} n
 * @returns {Array}
 */
export function keepLast(arr, n) {
  if (!Array.isArray(arr)) return [];
  if (n <= 0) return [];
  return arr.slice(-n);
}

/**
 * Determine whether the terminal is large enough for TUI mode.
 *
 * @param {number} cols
 * @param {number} rows
 * @returns {boolean}
 */
export function terminalIsSufficient(cols, rows) {
  return cols >= 80 && rows >= 20;
}

/**
 * Calculate the column width of the steps panel given total columns.
 *
 * @param {number} totalCols
 * @returns {number}
 */
export function stepsPanelWidth(totalCols) {
  return Math.min(45, Math.max(25, Math.floor(totalCols * 0.35)));
}

/**
 * Find which log entry indices match a search query.
 *
 * @param {Array<{message: string, time: number}>} logs
 * @param {string} query
 * @returns {{ matchCount: number, matchIndices: number[] }}
 */
export function filterLogLines(logs, query) {
  if (!Array.isArray(logs) || !query || typeof query !== 'string' || query.length === 0) {
    return { matchCount: 0, matchIndices: [] };
  }
  const lower = query.toLowerCase();
  const matchIndices = [];
  for (let i = 0; i < logs.length; i++) {
    const msg = typeof logs[i]?.message === 'string' ? logs[i].message : '';
    if (msg.toLowerCase().includes(lower)) {
      matchIndices.push(i);
    }
  }
  return { matchCount: matchIndices.length, matchIndices };
}

/**
 * Split a log line into segments, marking which parts match the query.
 *
 * @param {string} line
 * @param {string} query
 * @returns {Array<{text: string, isMatch: boolean}>}
 */
export function highlightSearchMatch(line, query) {
  if (typeof line !== 'string') return [{ text: '', isMatch: false }];
  if (!query || typeof query !== 'string' || query.length === 0) {
    return [{ text: line, isMatch: false }];
  }
  const lower = line.toLowerCase();
  const qLower = query.toLowerCase();
  const segments = [];
  let start = 0;
  let idx = lower.indexOf(qLower);
  while (idx !== -1) {
    if (idx > start) segments.push({ text: line.slice(start, idx), isMatch: false });
    segments.push({ text: line.slice(idx, idx + query.length), isMatch: true });
    start = idx + query.length;
    idx = lower.indexOf(qLower, start);
  }
  if (start < line.length) segments.push({ text: line.slice(start), isMatch: false });
  return segments.length > 0 ? segments : [{ text: line, isMatch: false }];
}

/**
 * Truncate a stack trace string to at most maxLines lines.
 *
 * @param {string|null|undefined} stack
 * @param {number} [maxLines=20]
 * @returns {string[]}
 */
export function truncateStackTrace(stack, maxLines = 20) {
  if (!stack || typeof stack !== 'string') return [];
  return stack.split('\n').slice(0, Math.max(1, Math.floor(maxLines)));
}
