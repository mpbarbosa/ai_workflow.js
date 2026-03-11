/**
 * @fileoverview TUI entry point — startTui()
 * @module cli/tui/index
 *
 * Renders the Ink dashboard, wires orchestrator events, and manages
 * lifecycle (startup, abort, graceful exit).
 *
 * Usage:
 *   import { startTui } from './tui/index.js';
 *   await startTui(orchestrator, { stage: 'full', version: '1.8.0' });
 *
 * Architecture: v2.0.0 Pattern
 * - Impure entry point: I/O, process management, Ink render lifecycle
 *
 * @version 1.0.0
 * @since 2026-03-07
 */

import React from 'react';
import { render } from 'ink';
import { App } from './App.js';
import { terminalIsSufficient } from './helpers.js';

/**
 * Start the TUI dashboard for a given orchestrator.
 *
 * The function renders the Ink app, starts the orchestrator's workflow
 * execution in the background, and resolves when the workflow finishes
 * (or the user presses q/a).
 *
 * @param {import('../../orchestrator/main_orchestrator.js').MainOrchestrator} orchestrator
 *   A fully constructed (but not yet executed) MainOrchestrator instance.
 * @param {{
 *   stage?: string,
 *   version?: string,
 *   verbose?: boolean,
 * }} [options={}]
 * @returns {Promise<{ success: boolean, aborted: boolean, error?: string }>}
 */
export async function startTui(orchestrator, options = {}) {
  const { stage = 'full', version = '1.8.0', verbose = false } = options;

  // Warn and fall back gracefully if the terminal is too small
  const cols = process.stdout.columns ?? 80;
  const rows = process.stdout.rows ?? 24;
  if (!terminalIsSufficient(cols, rows)) {
    process.stderr.write(
      `\n⚠ Terminal too small for --tui (minimum 80×20, got ${cols}×${rows}).\n` +
        `  Run without --tui to use standard output.\n\n`
    );
    // Still run the workflow in standard mode
    return orchestrator.execute();
  }

  let inkApp = null;

  const handleExit = () => {
    // Unmount Ink gracefully before the process ends
    try {
      inkApp?.unmount();
    } catch {
      /* best-effort */
    }
  };

  const handleAbort = () => {
    orchestrator?.abort?.();
  };

  // Suppress console output so it doesn't corrupt the TUI
  const origLog = console.log;
  const origError = console.error;
  const origWarn = console.warn;
  console.log = () => {};
  console.error = () => {};
  console.warn = () => {};

  const restoreConsole = () => {
    console.log = origLog;
    console.error = origError;
    console.warn = origWarn;
  };

  try {
    // Render the Ink app
    inkApp = render(
      React.createElement(App, {
        orchestrator,
        stage,
        version,
        verbose,
        onAbort: handleAbort,
        onExit: handleExit,
      }),
      {
        // Do not patch console — we handle suppression ourselves
        patchConsole: false,
        exitOnCtrlC: false, // We handle 'q' and Ctrl+C ourselves
      }
    );

    // Run the workflow concurrently with the UI
    const workflowResult = await orchestrator.execute().catch((err) => ({
      success: false,
      aborted: false,
      error: err.message,
    }));

    // Allow the UI to display the completion banner briefly
    await new Promise((r) => setTimeout(r, 3000));

    inkApp.unmount();
    restoreConsole();

    return workflowResult;
  } catch (err) {
    try {
      inkApp?.unmount();
    } catch {
      /* best-effort */
    }
    restoreConsole();
    throw err;
  }
}

export default startTui;
