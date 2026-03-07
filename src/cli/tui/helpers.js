/**
 * @fileoverview TUI Pure Helper Functions
 * @module cli/tui/helpers
 *
 * Pure, deterministic helper functions for the TUI dashboard.
 * No side effects, no I/O — all rendering math lives here.
 *
 * Architecture: v2.0.0 Pattern (pure functions only)
 *
 * @version 1.0.0
 * @since 2026-03-07
 */

// ============================================================================
// PURE FUNCTIONS - Step Status
// ============================================================================

/**
 * Map a step status string to a display icon.
 * @pure
 * @param {'pending'|'running'|'done'|'skipped'|'error'} status
 * @returns {string} Single emoji/character icon
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
 * @pure
 * @param {'pending'|'running'|'done'|'skipped'|'error'} status
 * @returns {string} Ink/chalk color name
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

// ============================================================================
// PURE FUNCTIONS - Time Formatting
// ============================================================================

/**
 * Format a millisecond duration into a human-readable string.
 * @pure
 * @param {number} ms - Duration in milliseconds (>= 0)
 * @returns {string} e.g. "0.8s", "12s", "1m23s"
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
 * @pure
 * @param {number} ts - Unix timestamp in milliseconds
 * @returns {string} e.g. "[19:15:02]"
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
 * Returns null when percentage is 0 (cannot estimate).
 * @pure
 * @param {number} elapsedMs - Milliseconds elapsed so far
 * @param {number} pct - Completion percentage 0–100
 * @returns {string|null} e.g. "ETA 2m10s" or null
 */
export function formatEta(elapsedMs, pct) {
  if (!pct || pct <= 0) return null;
  if (pct >= 100) return 'Done';
  const totalEstimated = (elapsedMs / pct) * 100;
  const remaining = totalEstimated - elapsedMs;
  return `ETA ${formatDuration(remaining)}`;
}

// ============================================================================
// PURE FUNCTIONS - Progress Bar
// ============================================================================

/**
 * Render an ASCII progress bar string.
 * @pure
 * @param {number} pct - Completion percentage 0–100
 * @param {number} width - Total character width of the bar (≥ 4)
 * @returns {string} e.g. "████░░░░"
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
 * @pure
 * @param {number} pct - Completion percentage 0–100
 * @param {number} elapsedMs - Milliseconds elapsed
 * @param {number} barWidth - Character width for the bar portion
 * @returns {string} e.g. "████░░░░ 40%  Elapsed 1m23s  ETA 2m10s"
 */
export function formatProgressLine(pct, elapsedMs, barWidth) {
  const bar = formatProgressBar(pct, barWidth);
  const pctStr = `${Math.round(pct)}%`.padStart(4);
  const elapsed = `Elapsed ${formatDuration(elapsedMs)}`;
  const eta = formatEta(elapsedMs, pct);
  return eta ? `${bar} ${pctStr}  ${elapsed}  ${eta}` : `${bar} ${pctStr}  ${elapsed}`;
}

// ============================================================================
// PURE FUNCTIONS - Log Lines
// ============================================================================

/**
 * Truncate a log line to fit within a maximum width, appending '…' if cut.
 * @pure
 * @param {string} line - Source string
 * @param {number} maxWidth - Maximum character count (> 0)
 * @returns {string} Possibly truncated string
 */
export function truncateLogLine(line, maxWidth) {
  if (typeof line !== 'string') return '';
  if (maxWidth <= 0) return '';
  if (line.length <= maxWidth) return line;
  return `${line.slice(0, maxWidth - 1)}…`;
}

/**
 * Keep only the last N entries from an array (immutable).
 * @pure
 * @param {Array} arr
 * @param {number} n - Maximum entries to keep
 * @returns {Array} New array with at most n trailing entries
 */
export function keepLast(arr, n) {
  if (!Array.isArray(arr)) return [];
  if (n <= 0) return [];
  return arr.slice(-n);
}

// ============================================================================
// PURE FUNCTIONS - Layout
// ============================================================================

/**
 * Determine whether the terminal is large enough for TUI mode.
 * @pure
 * @param {number} cols - Terminal column count
 * @param {number} rows - Terminal row count
 * @returns {boolean}
 */
export function terminalIsSufficient(cols, rows) {
  return cols >= 80 && rows >= 20;
}

/**
 * Calculate the column width of the steps panel given total columns.
 * Steps panel takes 35% of width, clamped between 25 and 45 chars.
 * @pure
 * @param {number} totalCols - Terminal column count
 * @returns {number} Steps panel width in characters
 */
export function stepsPanelWidth(totalCols) {
  return Math.min(45, Math.max(25, Math.floor(totalCols * 0.35)));
}
