/**
 * @fileoverview StepsPanel component — backward-compatible adapter over ListPanel
 * @module cli/tui/components/StepsPanel
 *
 * Imports {@link ListPanel} and {@link StatusChronometer} from the pajussara_tui_comp
 * package and composes them into a single panel. StepsPanel maps the legacy
 * workflow-step prop names (steps / currentStepId / selectedStepId / onSelectStep)
 * to the canonical ListPanel API (items / currentItemId / selectedItemId /
 * onSelectItem), then renders a {@link StatusChronometer} below the list to reflect
 * the current GitHub Copilot SDK execution state and elapsed time.
 *
 * ### `copilotStatus` values (PanelStatus)
 * | Value        | Badge shown                        |
 * |------------- |------------------------------------|
 * | `'idle'`     | *(nothing)*                        |
 * | `'loading'`  | Animated braille spinner + Loading… |
 * | `'streaming'`| Animated braille spinner + Streaming… |
 * | `'done'`     | ✓ Done                             |
 * | `'error'`    | ✗ \<copilotErrorMessage\>          |
 *
 * ### How `copilotStatus` is derived (in App.js)
 * Priority order (highest first):
 * 1. `lastError`              → `'error'`
 * 2. `isComplete`             → `'done'`
 * 3. `streamChunks.liveText` non-empty → `'streaming'`
 * 4. `currentStepId != null`  → `'loading'`
 * 5. *(else)*                 → `'idle'`
 *
 * @version 2.4.0
 * @since 2026-04-04
 */

import React from 'react';
import { Box } from 'ink';
import { ListPanel, StatusChronometer } from 'pajussara_tui_comp';

export { ListPanel };

/**
 * Backward-compatible wrapper around {@link ListPanel} with an integrated
 * {@link StatusChronometer} that reflects the Copilot SDK execution state and
 * elapsed time.
 *
 * @param {{
 *   steps: Object.<string, import('../hooks/useOrchestrator.js').StepEntry>,
 *   currentStepId: string|null,
 *   width: number,
 *   height?: number,
 *   selectedStepId?: string|null,
 *   onSelectStep?: (id: string) => void,
 *   isFocused?: boolean,
 *   copilotStatus?: 'idle'|'loading'|'streaming'|'done'|'error',
 *   copilotErrorMessage?: string|null,
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
  copilotStatus = 'idle',
  copilotErrorMessage = null,
}) {
  const showBadge =
    copilotStatus !== 'idle' &&
    (currentStepId != null || copilotStatus === 'done' || copilotStatus === 'error');

  // Derive forceRunning explicitly (mirrors the demo pattern in
  // status-chronometer-cities5.tsx) rather than delegating via syncWithStatus.
  const forceRunning = copilotStatus === 'loading' || copilotStatus === 'streaming';

  return React.createElement(
    Box,
    { flexDirection: 'column' },
    React.createElement(ListPanel, {
      items: steps,
      currentItemId: currentStepId,
      width,
      // Reserve 1 row for StatusChronometer when it is visible so the combined
      // height stays within the contentHeight container allocated by App.js.
      height: showBadge ? height - 1 : height,
      selectedItemId: selectedStepId,
      onSelectItem: onSelectStep,
      isFocused,
      title: 'STEPS',
      emptyText: 'Waiting for steps…',
    }),
    showBadge &&
      React.createElement(StatusChronometer, {
        status: copilotStatus,
        errorMessage: copilotErrorMessage ?? undefined,
        width,
        isFocused: false,
        forceRunning,
        showLabel: false,
        showBorder: false,
        showHints: false,
      })
  );
}

export default StepsPanel;
