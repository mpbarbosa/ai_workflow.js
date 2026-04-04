/**
 * @fileoverview StepsPanel component — backward-compatible adapter over ListPanel
 * @module cli/tui/components/StepsPanel
 *
 * Imports {@link ListPanel} from the pajussara_tui_comp CDN package and re-exports
 * it directly. StepsPanel is a thin adapter that maps the legacy workflow-step prop
 * names (steps / currentStepId / selectedStepId / onSelectStep) to the canonical
 * ListPanel API (items / currentItemId / selectedItemId / onSelectItem).
 *
 * @version 2.0.0
 * @since 2026-04-04
 */

import React from 'react';
import { ListPanel } from 'pajussara_tui_comp';

export { ListPanel };

/**
 * Backward-compatible wrapper around {@link ListPanel}.
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
