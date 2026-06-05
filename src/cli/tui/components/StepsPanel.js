/**
 * @fileoverview StepsPanel — cybernetic-themed step list with dot indicators
 * @module cli/tui/components/StepsPanel
 *
 * Custom implementation with colored dot indicators, ACTIVE badge, and
 * auto-scroll to the currently running step.
 *
 * Status → visual mapping:
 *   running  → ● cyanBright + [ ACTIVE ] badge
 *   done     → ● greenBright
 *   skipped  → ⊘ gray dimmed
 *   error    → ✗ red
 *   pending  → ○ gray dimmed, row dimmed
 *
 * @version 3.0.0
 * @since 2026-05-15
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';

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
export function StepsPanel({ steps, currentStepId, width, height = 20, isFocused = false }) {
  const stepEntries = Object.values(steps);
  const maxVisible = Math.max(1, height - 3);
  const [scrollOffset, setScrollOffset] = useState(0);

  // Auto-scroll to keep the running step visible
  useEffect(() => {
    if (!currentStepId) return;
    const idx = stepEntries.findIndex((s) => s.id === currentStepId);
    if (idx === -1) return;
    const N = stepEntries.length;
    const targetOffset = Math.max(0, N - idx - Math.floor(maxVisible / 2));
    setScrollOffset(Math.min(targetOffset, Math.max(0, N - maxVisible)));
  }, [currentStepId, stepEntries.length, maxVisible]);

  useInput(
    (input, key) => {
      const maxOffset = Math.max(0, stepEntries.length - maxVisible);
      if (key.upArrow || input === 'k') {
        setScrollOffset((prev) => Math.min(prev + 1, maxOffset));
      }
      if (key.downArrow || input === 'j') {
        setScrollOffset((prev) => Math.max(0, prev - 1));
      }
    },
    { isActive: isFocused }
  );

  const completedCount = stepEntries.filter(
    (s) => s.status === 'done' || s.status === 'skipped'
  ).length;
  const totalCount = stepEntries.length;

  const end = Math.max(0, totalCount - scrollOffset);
  const start = Math.max(0, end - maxVisible);
  const visibleSteps = stepEntries.slice(start, end);

  // Available width for step name: width - 2 borders - 2 paddingX - 2 dot - 1 gap - badge
  const BADGE_WIDTH = 9; // ' [ACTIVE]'
  const nameWidth = Math.max(5, width - 7 - BADGE_WIDTH);

  const counterLabel =
    totalCount > 0
      ? `${String(completedCount).padStart(2, '0')}/${String(totalCount).padStart(2, '0')}`
      : '--/--';

  return React.createElement(
    Box,
    {
      flexDirection: 'column',
      borderStyle: 'single',
      borderColor: isFocused ? 'cyanBright' : 'gray',
      width,
      height,
    },
    // ── Header row ──────────────────────────────────────────────────────────
    React.createElement(
      Box,
      { flexDirection: 'row', justifyContent: 'space-between', paddingX: 1 },
      React.createElement(Text, { color: 'cyanBright', bold: true }, '[ STEPS ]'),
      React.createElement(Text, { color: 'gray' }, counterLabel)
    ),
    // ── Empty state ─────────────────────────────────────────────────────────
    stepEntries.length === 0
      ? React.createElement(
          Box,
          { paddingX: 1 },
          React.createElement(Text, { color: 'gray', dimColor: true }, 'Waiting for steps…')
        )
      : null,
    // ── Step rows ───────────────────────────────────────────────────────────
    ...visibleSteps.map((step) => {
      const isRunning = step.status === 'running' || step.id === currentStepId;
      const isDone = step.status === 'done';
      const isSkipped = step.status === 'skipped';
      const isError = step.status === 'error';

      let dotChar = '○';
      let dotColor = 'gray';
      let dotDim = true;
      let nameColor = 'gray';
      let nameDim = true;

      if (isRunning) {
        dotChar = '●';
        dotColor = 'cyanBright';
        dotDim = false;
        nameColor = 'cyanBright';
        nameDim = false;
      } else if (isDone) {
        dotChar = '●';
        dotColor = 'greenBright';
        dotDim = false;
        nameColor = 'white';
        nameDim = false;
      } else if (isSkipped) {
        dotChar = '⊘';
        dotColor = 'gray';
        dotDim = true;
        nameColor = 'gray';
        nameDim = true;
      } else if (isError) {
        dotChar = '✗';
        dotColor = 'red';
        dotDim = false;
        nameColor = 'red';
        nameDim = false;
      }

      const truncName =
        step.name.length > nameWidth ? `${step.name.slice(0, nameWidth - 1)}…` : step.name;

      return React.createElement(
        Box,
        { key: step.id, flexDirection: 'row', gap: 1, paddingX: 1 },
        React.createElement(Text, { color: dotColor, dimColor: dotDim }, dotChar),
        React.createElement(
          Text,
          { color: nameColor, dimColor: nameDim, bold: isRunning },
          truncName
        ),
        isRunning
          ? React.createElement(Text, { color: 'cyanBright', bold: true }, ' [ACTIVE]')
          : null
      );
    })
  );
}

export default StepsPanel;
