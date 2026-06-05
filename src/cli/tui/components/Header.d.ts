/**
 * @fileoverview Header component — top bar of the TUI dashboard
 * @module cli/tui/components/Header
 *
 * Cybernetic breadcrumb header: ai-workflow > step_id > step_name
 *
 * @version 2.0.0
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
    currentStepId?: string | null;
    currentStepName?: string | null;
}
export declare function Header({ stage, completed, total, version, projectVersion, currentStepId, currentStepName, }: HeaderProps): ReactElement;
export default Header;
//# sourceMappingURL=Header.d.ts.map