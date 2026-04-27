/**
 * @fileoverview Header component — top bar of the TUI dashboard
 * @module cli/tui/components/Header
 *
 * Displays project name, version, active stage, and step counter.
 *
 * @version 1.0.0
 * @since 2026-03-07
 */
import { type ReactElement } from 'react';
export interface HeaderProps {
    stage: string;
    completed: number;
    total: number;
    version?: string;
    projectRoot?: string;
    projectVersion?: string | null;
}
export declare function Header({ stage, completed, total, version, projectRoot, projectVersion, }: HeaderProps): ReactElement;
export default Header;
//# sourceMappingURL=Header.d.ts.map