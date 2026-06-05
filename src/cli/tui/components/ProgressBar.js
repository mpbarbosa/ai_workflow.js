/**
 * @fileoverview ProgressBar component — cybernetic block-square progress display
 * @module cli/tui/components/ProgressBar
 *
 * Renders small ▪▫ squares with PROCESS label, percentage, elapsed time, and ETA.
 *
 * @version 2.0.0
 * @since 2026-03-07
 */

import React from 'react';
import { Box, Text, useStdout } from 'ink';

function formatElapsed(ms) {
  const totalSec = Math.round(ms / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}m ${String(secs).padStart(2, '0')}s`;
}

function computeEta(elapsedMs, pct) {
  if (!pct || pct <= 0) return null;
  if (pct >= 100) return 'Done';
  const remaining = (elapsedMs / pct) * (100 - pct);
  const totalSec = Math.round(remaining / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}m ${String(secs).padStart(2, '0')}s`;
}

function buildSquareBar(pct, width) {
  const safeWidth = Math.max(4, Math.floor(width));
  const safePct = Math.min(100, Math.max(0, pct));
  const filled = Math.round((safePct / 100) * safeWidth);
  const empty = safeWidth - filled;
  return '▪'.repeat(filled) + '▫'.repeat(empty);
}

/**
 * @param {{ pct: number, startTime: number|null }} props
 */
export function ProgressBar({ pct, startTime }) {
  const { stdout } = useStdout();
  const cols = stdout?.columns ?? 80;

  const elapsedMs = startTime ? Date.now() - startTime : 0;
  const pctRounded = Math.round(pct);
  const pctStr = `${pctRounded}%`.padStart(4);
  const elapsedStr = formatElapsed(elapsedMs);
  const etaStr = computeEta(elapsedMs, pct);

  // Fixed labels: "PROCESS: " (9) + pct (4) + "  ELAPSED: " (11) + elapsed (~8) + "  ETA: " (7) + eta (~6) = ~45 chars overhead
  const LABEL_WIDTH = 9; // "PROCESS: "
  const STATS_WIDTH = etaStr ? 11 + 8 + 7 + 8 : 11 + 8;
  const barWidth = Math.max(8, cols - LABEL_WIDTH - 4 - STATS_WIDTH - 4);

  const bar = buildSquareBar(pct, barWidth);

  return React.createElement(
    Box,
    { borderStyle: 'single', borderColor: 'gray', paddingX: 1, flexDirection: 'row' },
    React.createElement(Text, { color: 'gray', dimColor: true }, 'PROCESS: '),
    React.createElement(Text, { color: 'yellow', bold: true }, pctStr),
    React.createElement(Text, { color: 'cyanBright' }, `  ${bar}`),
    React.createElement(Text, { color: 'gray', dimColor: true }, '  ELAPSED: '),
    React.createElement(Text, { color: 'white' }, elapsedStr),
    etaStr
      ? React.createElement(
          React.Fragment,
          null,
          React.createElement(Text, { color: 'gray', dimColor: true }, '  ETA: '),
          React.createElement(Text, { color: 'gray' }, etaStr)
        )
      : null
  );
}

export default ProgressBar;
