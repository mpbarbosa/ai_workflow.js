/**
 * @fileoverview StepsPanel component — backward-compatible adapter over ListPanel
 * @module cli/tui/components/StepsPanel
 *
 * Maps the legacy workflow-step prop names (steps / currentStepId / selectedStepId /
 * onSelectStep) to the canonical ListPanel API (items / currentItemId / selectedItemId /
 * onSelectItem).
 *
 * The StatusChronometer that previously lived here has been moved to StatusBar
 * (the bottom hints bar) so that SDK execution state is shown alongside keybinding
 * hints rather than consuming a row inside the steps column.
 *
 * @version 2.6.0
 * @since 2026-04-04
 */

import React from 'react';
import { ListPanel } from 'pajussara_tui_comp';

export { ListPanel };

/**
 * Backward-compatible wrapper around {@link ListPanel}.
 *
 * Maps legacy workflow-step prop names to the canonical ListPanel API.
 * The StatusChronometer (SDK execution state indicator) has moved to StatusBar.
 *
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
  return React.createElement(ListPanel, {
    items: steps,
    currentItemId: currentStepId,
    width,
    height,
    selectedItemId: selectedStepId,
    onSelectItem: onSelectStep,
    isFocused,
    title: 'STEPS',
    emptyText: 'Waiting for steps…',
  });
}

export default StepsPanel;
