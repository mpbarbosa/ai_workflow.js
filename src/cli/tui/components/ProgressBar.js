/**
 * @fileoverview ProgressBar component — workflow progress display
 * @module cli/tui/components/ProgressBar
 *
 * Renders a filled/empty block bar plus percentage, elapsed time, and ETA.
 *
 * @version 1.0.0
 * @since 2026-03-07
 */

import React from 'react';
import { Box, Text, useStdout } from 'ink';
import { formatProgressLine } from '../helpers.js';

/**
 * @param {{ pct: number, startTime: number|null }} props
 */
export function ProgressBar({ pct, startTime }) {
  const { stdout } = useStdout();
  const cols = stdout?.columns ?? 80;

  // Leave room for borders/padding (4 chars) and the stat text (~30 chars)
  const barWidth = Math.max(8, cols - 40);
  const elapsedMs = startTime ? Date.now() - startTime : 0;
  const line = formatProgressLine(pct, elapsedMs, barWidth);

  // Split bar from stats for separate coloring
  const barEnd = barWidth;
  const barPart = line.slice(0, barEnd);
  const statPart = line.slice(barEnd);

  return React.createElement(
    Box,
    { borderStyle: 'single', borderColor: 'gray', paddingX: 1 },
    React.createElement(Text, { color: 'green' }, barPart),
    React.createElement(Text, { color: 'cyan' }, statPart)
  );
}

export default ProgressBar;
