/**
 * @fileoverview StepsPanel component — left panel listing workflow steps
 * @module cli/tui/components/StepsPanel
 *
 * Shows each known step with a status icon and elapsed duration.
 * The currently-running step is highlighted. Supports keyboard selection
 * and mouse click to select a step.
 *
 * @version 1.1.0
 * @since 2026-03-07
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { formatStepIcon, statusColor, formatDuration } from '../helpers.js';

/**
 * @param {{
 *   steps: Object.<string, import('../hooks/useOrchestrator.js').StepEntry>,
 *   currentStepId: string|null,
 *   width: number,
 *   height?: number,
 *   selectedStepId?: string|null,
 *   onSelectStep?: (id: string) => void,
 *   isFocused?: boolean,
 * }} props
 */
export function StepsPanel({
  steps,
  currentStepId,
  width,
  height = 20,
  selectedStepId = null,
  onSelectStep,
  isFocused = false,
}) {
  const entries = Object.values(steps);

  // Internal selection index for keyboard navigation
  const [selIdx, setSelIdx] = useState(() => {
    if (selectedStepId) {
      const idx = entries.findIndex((s) => s.id === selectedStepId);
      return idx >= 0 ? idx : 0;
    }
    return 0;
  });

  // Sync selIdx with selectedStepId prop changes
  useEffect(() => {
    if (selectedStepId) {
      const idx = entries.findIndex((s) => s.id === selectedStepId);
      if (idx >= 0) setSelIdx(idx);
    }
  }, [selectedStepId, entries.length]);

  // Keep a scrolling window: show the last (height - 2) entries, always
  // including the current step.
  const maxVisible = Math.max(1, height - 2);
  let visible = entries;
  if (entries.length > maxVisible) {
    const currentIdx = entries.findIndex((s) => s.id === currentStepId);
    const end = Math.max(currentIdx + 1, maxVisible);
    const start = Math.max(0, end - maxVisible);
    visible = entries.slice(start, end);
  }

  useInput(
    (input, key) => {
      if (entries.length === 0) return;

      if (key.downArrow || input === 'j') {
        const next = Math.min(selIdx + 1, entries.length - 1);
        setSelIdx(next);
        onSelectStep?.(entries[next]?.id);
      } else if (key.upArrow || input === 'k') {
        const prev = Math.max(selIdx - 1, 0);
        setSelIdx(prev);
        onSelectStep?.(entries[prev]?.id);
      }
    },
    { isActive: isFocused, mouse: true }
  );

  const labelWidth = Math.max(8, width - 12);
  const currentSelId = entries[selIdx]?.id ?? selectedStepId;

  return React.createElement(
    Box,
    {
      flexDirection: 'column',
      borderStyle: 'single',
      borderColor: isFocused ? 'white' : 'gray',
      width,
      paddingX: 1,
    },
    React.createElement(Text, { bold: true, color: 'white', dimColor: !isFocused }, 'STEPS'),
    visible.length === 0
      ? React.createElement(Text, { color: 'gray', dimColor: true }, 'Waiting for steps…')
      : null,
    ...visible.map((step) => {
      const isActive = step.id === currentStepId;
      const isSelected = isFocused && step.id === currentSelId;
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

      const cursor = isSelected ? '>' : ' ';

      return React.createElement(
        Box,
        { key: step.id, flexDirection: 'row', gap: 1 },
        React.createElement(Text, { color: isSelected ? 'cyan' : 'gray' }, cursor),
        React.createElement(Text, null, icon),
        React.createElement(
          Text,
          {
            color: isSelected ? 'cyan' : color,
            bold: isActive || isSelected,
            dimColor: step.status === 'pending' && !isSelected,
          },
          label
        ),
        React.createElement(Text, { color: 'gray', dimColor: true }, durationStr)
      );
    })
  );
}

export default StepsPanel;
