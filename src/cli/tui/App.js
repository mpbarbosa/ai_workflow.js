/**
 * @fileoverview App — root Ink component for the TUI dashboard
 * @module cli/tui/App
 *
 * Composes Header, StepsPanel, LogPanel, ProgressBar, and StatusBar into
 * the full-terminal dashboard.  Handles keyboard shortcuts and enforces a
 * minimum terminal size.
 *
 * Architecture: v2.0.0 Pattern
 * - Pure layout/size logic delegated to helpers.js
 * - This component is the impure UI boundary (keyboard, terminal, state)
 *
 * @version 1.0.0
 * @since 2026-03-07
 */

import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, useApp, useInput, useStdout } from 'ink';
import { useOrchestrator } from './hooks/useOrchestrator.js';
import { Header } from './components/Header.js';
import { StepsPanel } from './components/StepsPanel.js';
import { LogPanel } from './components/LogPanel.js';
import { ProgressBar } from './components/ProgressBar.js';
import { StatusBar } from './components/StatusBar.js';
import { terminalIsSufficient, stepsPanelWidth } from './helpers.js';

/**
 * Root TUI application component.
 *
 * @param {{
 *   orchestrator: import('../../orchestrator/main_orchestrator.js').MainOrchestrator,
 *   stage: string,
 *   version?: string,
 *   onAbort?: () => void,
 *   onExit?: () => void,
 * }} props
 */
export function App({ orchestrator, stage, version = '1.5.4', onAbort, onExit }) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const { steps, logs, progress, currentStepId, isComplete } = useOrchestrator(orchestrator);

  const startTimeRef = useRef(Date.now());
  const [exiting, setExiting] = useState(false);

  // Terminal dimensions (reactive)
  const cols = stdout?.columns ?? 80;
  const rows = stdout?.rows ?? 24;

  // Keyboard handler
  useInput((input, key) => {
    if ((input === 'q' || input === 'Q') && !exiting) {
      setExiting(true);
      onExit?.();
      exit();
    }
    if ((input === 'a' || input === 'A') && !exiting && !isComplete) {
      orchestrator?.abort?.();
    }
  });

  // Auto-exit a few seconds after completion
  useEffect(() => {
    if (!isComplete) return;
    const t = setTimeout(() => {
      onExit?.();
      exit();
    }, 3000);
    return () => clearTimeout(t);
  }, [isComplete, exit, onExit]);

  // ── Terminal too small ───────────────────────────────────────────────────
  if (!terminalIsSufficient(cols, rows)) {
    return React.createElement(
      Box,
      { flexDirection: 'column', padding: 1 },
      React.createElement(Text, { color: 'yellow', bold: true }, '⚠ Terminal too small for TUI mode'),
      React.createElement(Text, { color: 'gray' }, `Minimum size: 80×20.  Current: ${cols}×${rows}`),
      React.createElement(Text, { color: 'gray' }, 'Resize your terminal or run without --tui.')
    );
  }

  // ── Layout calculation ───────────────────────────────────────────────────
  const leftWidth = stepsPanelWidth(cols);
  // Fixed chrome: header(3) + progress(3) + statusbar(3) = 9 rows
  const contentHeight = Math.max(5, rows - 9);

  const completedCount = Object.values(steps).filter(
    (s) => s.status === 'done' || s.status === 'skipped'
  ).length;

  let totalSteps = 0;
  try {
    totalSteps = orchestrator?.getStatus?.()?.total ?? 0;
  } catch {
    /* non-fatal */
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return React.createElement(
    Box,
    { flexDirection: 'column', width: cols },
    React.createElement(Header, { stage, version, completed: completedCount, total: totalSteps }),
    React.createElement(
      Box,
      { flexDirection: 'row', height: contentHeight },
      React.createElement(StepsPanel, { steps, currentStepId, width: leftWidth, height: contentHeight }),
      React.createElement(LogPanel, { logs, width: cols - leftWidth, height: contentHeight, isFocused: true })
    ),
    React.createElement(ProgressBar, { pct: progress, startTime: startTimeRef.current }),
    React.createElement(StatusBar, { isComplete }),
    isComplete
      ? React.createElement(
          Box,
          { paddingX: 2 },
          React.createElement(
            Text,
            { color: 'green', bold: true },
            '✓ Workflow complete — exiting in 3s  (press q to exit now)'
          )
        )
      : null
  );
}

export default App;
