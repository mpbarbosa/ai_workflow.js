/**
 * @fileoverview ErrorDetailPanel — error/stack trace modal overlay
 * @module cli/tui/components/ErrorDetailPanel
 *
 * Shown automatically when a step fails and when the user presses 'e'.
 * Displays the failed step name, error message, and a truncated stack trace.
 * Press e or Escape to dismiss.
 *
 * Architecture: v2.0.0 Pattern (impure UI boundary, pure truncation via helpers.js)
 *
 * @version 1.0.0
 * @since 2026-03-07
 */
import { type ReactElement } from 'react';
export interface ErrorDetailPanelError {
    stepId: string;
    stepName: string;
    message: string;
    stack: string | null;
}
export interface ErrorDetailPanelProps {
    error: ErrorDetailPanelError | null;
    onClose: () => void;
}
export declare function ErrorDetailPanel({ error, onClose, }: ErrorDetailPanelProps): ReactElement;
export default ErrorDetailPanel;
//# sourceMappingURL=ErrorDetailPanel.d.ts.map