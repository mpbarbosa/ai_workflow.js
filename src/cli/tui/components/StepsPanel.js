/**
 * @fileoverview StepsPanel component — left panel listing workflow steps
 * @module cli/tui/components/StepsPanel
 *
 * Shows each known step with a status icon and elapsed duration.
 * The currently-running step is highlighted.
 *
 * @version 1.0.0
 * @since 2026-03-07
 */

import React from 'react';
import { Box, Text } from 'ink';
import { formatStepIcon, statusColor, formatDuration } from '../helpers.js';

/**
 * @param {{
 *   steps: Object.<string, import('../hooks/useOrchestrator.js').StepEntry>,
 *   currentStepId: string|null,
 *   width: number,
 *   height?: number,
 * }} props
 */
export function StepsPanel({ steps, currentStepId, width, height = 20 }) {
  const entries = Object.values(steps);

  // Keep a scrolling window: show the last (height - 2) entries, always
  // including the current step.
  const maxVisible = Math.max(1, height - 2);
  let visible = entries;
  if (entries.length > maxVisible) {
    // Find the index of the current step to ensure it is always visible
    const currentIdx = entries.findIndex((s) => s.id === currentStepId);
    const end = Math.max(currentIdx + 1, maxVisible);
    const start = Math.max(0, end - maxVisible);
    visible = entries.slice(start, end);
  }

  const labelWidth = Math.max(8, width - 10); // leave room for icon + duration

  return React.createElement(
    Box,
    { flexDirection: 'column', borderStyle: 'single', borderColor: 'gray', width, paddingX: 1 },
    React.createElement(Text, { bold: true, color: 'white', dimColor: true }, 'STEPS'),
    visible.length === 0
      ? React.createElement(Text, { color: 'gray', dimColor: true }, 'Waiting for steps…')
      : null,
    ...visible.map((step) => {
      const isActive = step.id === currentStepId;
      const icon = formatStepIcon(step.status);
      const color = statusColor(step.status);
      const durationStr =
        step.status === 'done' && step.duration != null
          ? formatDuration(step.duration)
          : step.status === 'running'
            ? '…'
            : '';

      const label =
        step.name.length > labelWidth
          ? `${step.name.slice(0, labelWidth - 1)}…`
          : step.name.padEnd(labelWidth);

      return React.createElement(
        Box,
        { key: step.id, flexDirection: 'row', gap: 1 },
        React.createElement(Text, null, icon),
        React.createElement(
          Text,
          { color, bold: isActive, dimColor: step.status === 'pending' },
          label
        ),
        React.createElement(Text, { color: 'gray', dimColor: true }, durationStr)
      );
    })
  );
}

export default StepsPanel;
