/**
 * @fileoverview StepsPanel component — backward-compatible adapter over ListPanel
 * @module cli/tui/components/StepsPanel
 *
 * Imports {@link ListPanel} and {@link StatusBadge} from the pajussara_tui_comp
 * package and composes them into a single panel. StepsPanel maps the legacy
 * workflow-step prop names (steps / currentStepId / selectedStepId / onSelectStep)
 * to the canonical ListPanel API (items / currentItemId / selectedItemId /
 * onSelectItem), then renders a {@link StatusBadge} below the list to reflect the
 * current GitHub Copilot SDK execution state.
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
 * @version 2.1.0
 * @since 2026-04-04
 */

import React from 'react';
import { Box } from 'ink';
import { ListPanel, StatusBadge } from 'pajussara_tui_comp';

export { ListPanel };

/**
 * Backward-compatible wrapper around {@link ListPanel} with an integrated
 * {@link StatusBadge} that reflects the Copilot SDK execution state.
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

  return React.createElement(
    Box,
    { flexDirection: 'column' },
    React.createElement(ListPanel, {
      items: steps,
      currentItemId: currentStepId,
      width,
      height,
      selectedItemId: selectedStepId,
      onSelectItem: onSelectStep,
      isFocused,
      title: 'STEPS',
      emptyText: 'Waiting for steps…',
    }),
    showBadge &&
      React.createElement(
        Box,
        { paddingX: 1 },
        React.createElement(StatusBadge, {
          status: copilotStatus,
          errorMessage: copilotErrorMessage ?? undefined,
        })
      )
  );
}

export default StepsPanel;
