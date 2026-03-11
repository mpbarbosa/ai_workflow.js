/**
 * @fileoverview App — root Ink component for the TUI dashboard
 * @module cli/tui/App
 *
 * Composes Header, StepsPanel, LogPanel, ProgressBar, StatusBar, and overlay
 * components into the full-terminal dashboard. Handles keyboard shortcuts,
 * panel focus management, and overlay rendering.
 *
 * Architecture: v2.0.0 Pattern
 * - Pure layout/size logic delegated to helpers.js
 * - This component is the impure UI boundary (keyboard, terminal, state)
 *
 * @version 1.1.0
 * @since 2026-03-07
 */

import React, { useState, useEffect, useRef } from 'react';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Box, Text, useApp, useInput, useStdout } from 'ink';
import { useOrchestrator } from './hooks/useOrchestrator.js';
import { Header } from './components/Header.js';
import { StepsPanel } from './components/StepsPanel.js';
import { LogPanel } from './components/LogPanel.js';
import { ProgressBar } from './components/ProgressBar.js';
import { StatusBar } from './components/StatusBar.js';
import { HelpOverlay } from './components/HelpOverlay.js';
import { StepDetailOverlay } from './components/StepDetailOverlay.js';
import { ErrorDetailPanel } from './components/ErrorDetailPanel.js';
import { StreamViewer } from './components/StreamViewer.js';
import { terminalIsSufficient, stepsPanelWidth } from './helpers.js';

/**
 * Root TUI application component.
 *
 * @param {{
 *   orchestrator: import('../../orchestrator/main_orchestrator.js').MainOrchestrator,
 *   stage: string,
 *   version?: string,
 *   verbose?: boolean,
 *   onAbort?: () => void,
 *   onExit?: () => void,
 * }} props
 */
export function App({ orchestrator, stage, version = '1.6.1', verbose = false, onExit }) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const { steps, logs, progress, currentStepId, isComplete, lastError, streamChunks } =
    useOrchestrator(orchestrator);

  const startTimeRef = useRef(Date.now());
  const [exiting, setExiting] = useState(false);
  const [projectVersion, setProjectVersion] = useState(null);

  // Read the target project's version from its package.json (if available)
  useEffect(() => {
    const root = orchestrator?.projectRoot || process.cwd();
    readFile(join(root, 'package.json'), 'utf8')
      .then((raw) => {
        const pkg = JSON.parse(raw);
        if (pkg.version) setProjectVersion(pkg.version);
      })
      .catch(() => {
        /* no package.json — leave projectVersion null */
      });
  }, [orchestrator?.projectRoot]);

  // ── Panel focus & overlay state ──────────────────────────────────────────
  /** @type {'steps'|'log'|'stream'} */
  const [focusedPanel, setFocusedPanel] = useState('log');
  const [selectedStepId, setSelectedStepId] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showErrorDetail, setShowErrorDetail] = useState(false);
  const [showStepDetail, setShowStepDetail] = useState(false);
  // Stream viewer is shown by default when --verbose is set; toggled with `v`.
  const [showStream, setShowStream] = useState(verbose);

  // Terminal dimensions (reactive)
  const cols = stdout?.columns ?? 80;
  const rows = stdout?.rows ?? 24;

  // Auto-open error detail when a new step error occurs
  useEffect(() => {
    if (lastError) {
      setShowErrorDetail(true);
    }
  }, [lastError]);

  // Keyboard handler
  useInput((input, key) => {
    // ── Quit / Abort ─────────────────────────────────────────────────────
    if ((input === 'q' || input === 'Q') && !exiting) {
      setExiting(true);
      onExit?.();
      exit();
      return;
    }
    if ((input === 'a' || input === 'A') && !exiting && !isComplete) {
      orchestrator?.abort?.();
      return;
    }

    // ── Escape — close topmost overlay ──────────────────────────────────
    if (key.escape) {
      if (showHelp) {
        setShowHelp(false);
        return;
      }
      if (showErrorDetail) {
        setShowErrorDetail(false);
        return;
      }
      if (showStepDetail) {
        setShowStepDetail(false);
        return;
      }
      return;
    }

    // ── h — toggle help overlay ──────────────────────────────────────────
    if (input === 'h' || input === 'H') {
      setShowHelp((prev) => !prev);
      return;
    }

    // ── e — toggle error detail ──────────────────────────────────────────
    if ((input === 'e' || input === 'E') && lastError) {
      setShowErrorDetail((prev) => !prev);
      return;
    }

    // ── Tab — cycle focus between panels ────────────────────────────────
    if (key.tab) {
      setFocusedPanel((prev) => {
        if (showStream) {
          // Three-way cycle: log → stream → steps → log
          if (prev === 'log') return 'stream';
          if (prev === 'stream') return 'steps';
          return 'log';
        }
        return prev === 'log' ? 'steps' : 'log';
      });
      return;
    }

    // ── v — toggle stream viewer ─────────────────────────────────────────
    if (input === 'v' || input === 'V') {
      setShowStream((prev) => {
        if (prev && focusedPanel === 'stream') setFocusedPanel('log');
        return !prev;
      });
      return;
    }

    // ── Enter — open step detail for selected step ───────────────────────
    if (key.return && selectedStepId && steps[selectedStepId]) {
      setShowStepDetail((prev) => !prev);
      return;
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
      React.createElement(
        Text,
        { color: 'yellow', bold: true },
        '⚠ Terminal too small for TUI mode'
      ),
      React.createElement(
        Text,
        { color: 'gray' },
        `Minimum size: 80×20.  Current: ${cols}×${rows}`
      ),
      React.createElement(Text, { color: 'gray' }, 'Resize your terminal or run without --tui.')
    );
  }

  // ── Layout calculation ───────────────────────────────────────────────────
  const leftWidth = stepsPanelWidth(cols);
  const rightWidth = cols - leftWidth;
  const contentHeight = Math.max(5, rows - 9);
  // When the stream viewer is shown, split the right panel vertically.
  // LogPanel gets 60%, StreamViewer gets 40% (min 8 lines each).
  const logHeight = showStream
    ? Math.max(8, Math.floor(contentHeight * 0.6))
    : contentHeight;
  const streamHeight = showStream ? Math.max(8, contentHeight - logHeight) : 0;

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
    React.createElement(Header, {
      stage,
      version,
      completed: completedCount,
      total: totalSteps,
      projectRoot: orchestrator?.projectRoot || process.cwd(),
      projectVersion,
    }),
    React.createElement(
      Box,
      { flexDirection: 'row', height: contentHeight },
      React.createElement(StepsPanel, {
        steps,
        currentStepId,
        width: leftWidth,
        height: contentHeight,
        isFocused: focusedPanel === 'steps',
        selectedStepId,
        onSelectStep: setSelectedStepId,
      }),
      React.createElement(
        Box,
        { flexDirection: 'column', width: rightWidth },
        React.createElement(LogPanel, {
          logs,
          width: rightWidth,
          height: logHeight,
          isFocused: focusedPanel === 'log',
        }),
        showStream
          ? React.createElement(StreamViewer, {
              streamChunks,
              width: rightWidth,
              height: streamHeight,
              isFocused: focusedPanel === 'stream',
            })
          : null
      )
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
      : null,
    // ── Overlays (rendered on top) ─────────────────────────────────────────
    showHelp
      ? React.createElement(HelpOverlay, { key: 'help', onClose: () => setShowHelp(false) })
      : null,
    showErrorDetail && lastError
      ? React.createElement(ErrorDetailPanel, {
          key: 'error',
          error: lastError,
          onClose: () => setShowErrorDetail(false),
        })
      : null,
    showStepDetail && selectedStepId && steps[selectedStepId]
      ? React.createElement(StepDetailOverlay, {
          key: 'stepdetail',
          step: steps[selectedStepId],
          onClose: () => setShowStepDetail(false),
        })
      : null
  );
}

export default App;
