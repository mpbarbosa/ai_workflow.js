/**
 * @fileoverview HelpOverlay — keyboard shortcut reference modal
 * @module cli/tui/components/HelpOverlay
 *
 * Renders a centered overlay listing all TUI keybindings.
 * Press h or Escape to dismiss.
 *
 * Architecture: v2.0.0 Pattern (impure UI boundary, pure content via helpers.js)
 *
 * @version 1.0.0
 * @since 2026-03-07
 */
import { type ReactElement } from 'react';
export interface HelpOverlayProps {
    onClose?: () => void;
}
export declare function HelpOverlay({ onClose }: HelpOverlayProps): ReactElement;
export default HelpOverlay;
//# sourceMappingURL=HelpOverlay.d.ts.map