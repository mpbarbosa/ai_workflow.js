/**
 * @fileoverview useOrchestrator — Ink hook for live workflow state
 * @module cli/tui/hooks/useOrchestrator
 *
 * Subscribes to a MainOrchestrator's internal WorkflowEngine events and
 * translates them into React state for Ink components to render.
 *
 * Architecture: v2.0.0 Pattern
 * - Pure logic in helpers.js
 * - This hook is the impure boundary (event subscription, state mutation)
 *
 * @version 1.0.0
 * @since 2026-03-07
 */

import { useState, useEffect } from 'react';
import { keepLast } from '../helpers.js';

/** Maximum log lines kept in memory for the log panel. */
const MAX_LOG_LINES = 200;

/**
 * Subscribe to MainOrchestrator workflow events and expose live state.
 *
 * @param {import('../../../orchestrator/main_orchestrator.js').MainOrchestrator} orchestrator
 * @returns {{
 *   steps: Object.<string, StepEntry>,
 *   logs: LogEntry[],
 *   progress: number,
 *   currentStepId: string|null,
 *   isComplete: boolean,
 *   workflowError: string|null,
 * }}
 *
 * @typedef {{ id: string, name: string, status: 'pending'|'running'|'done'|'skipped'|'error', startTime: number|null, duration: number|null }} StepEntry
 * @typedef {{ time: number, message: string }} LogEntry
 */
export function useOrchestrator(orchestrator) {
  const [steps, setSteps] = useState({});
  const [logs, setLogs] = useState([]);
  const [progress, setProgress] = useState(0);
  const [currentStepId, setCurrentStepId] = useState(null);
  const [isComplete, setIsComplete] = useState(false);
  const [workflowError, setWorkflowError] = useState(null);

  useEffect(() => {
    if (!orchestrator?.workflowEngine) return;

    const engine = orchestrator.workflowEngine;

    const addLog = (message) =>
      setLogs((prev) => keepLast([...prev, { time: Date.now(), message }], MAX_LOG_LINES));

    const onStepStart = ({ step }) => {
      const id = step?.id ?? 'unknown';
      const name = step?.name ?? id;
      setCurrentStepId(id);
      setSteps((prev) => ({
        ...prev,
        [id]: { id, name, status: 'running', startTime: Date.now(), duration: null },
      }));
      addLog(`→ Starting: ${name}`);
    };

    const onStepComplete = ({ step, result }) => {
      const id = step?.id ?? 'unknown';
      const name = step?.name ?? id;
      const duration = result?.duration ?? null;
      setSteps((prev) => ({
        ...prev,
        [id]: { ...(prev[id] ?? { id, name }), status: 'done', duration },
      }));
      const dStr = duration != null ? ` (${Math.round(duration / 1000)}s)` : '';
      addLog(`✓ Completed: ${name}${dStr}`);
      // Refresh progress from orchestrator
      try {
        const status = orchestrator.getStatus();
        setProgress(status.progress ?? 0);
      } catch {
        /* non-fatal */
      }
    };

    const onStepError = ({ step, error }) => {
      const id = step?.id ?? 'unknown';
      const name = step?.name ?? id;
      setSteps((prev) => ({
        ...prev,
        [id]: { ...(prev[id] ?? { id, name }), status: 'error', duration: null },
      }));
      addLog(`✗ Failed: ${name} — ${error?.message ?? 'unknown error'}`);
    };

    const onStepSkipped = ({ step, result }) => {
      const id = step?.id ?? 'unknown';
      const name = step?.name ?? id;
      setSteps((prev) => ({
        ...prev,
        [id]: { ...(prev[id] ?? { id, name }), status: 'skipped', duration: null },
      }));
      const reason = result?.reason ? ` (${result.reason})` : '';
      addLog(`⊘ Skipped: ${name}${reason}`);
    };

    engine.on('step:start', onStepStart);
    engine.on('step:complete', onStepComplete);
    engine.on('step:error', onStepError);
    engine.on('step:skipped', onStepSkipped);

    return () => {
      engine.off('step:start', onStepStart);
      engine.off('step:complete', onStepComplete);
      engine.off('step:error', onStepError);
      engine.off('step:skipped', onStepSkipped);
    };
  }, [orchestrator]);

  // Mark complete when orchestrator signals finished
  useEffect(() => {
    if (!orchestrator) return;
    let cancelled = false;

    const checkDone = () => {
      if (cancelled) return;
      try {
        const status = orchestrator.getStatus();
        if (status.status === 'success' || status.status === 'failed') {
          setIsComplete(true);
          setProgress(status.progress ?? 100);
        }
      } catch {
        /* non-fatal */
      }
    };

    const interval = setInterval(checkDone, 500);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [orchestrator]);

  return { steps, logs, progress, currentStepId, isComplete, workflowError };
}

export default useOrchestrator;
