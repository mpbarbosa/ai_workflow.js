/**
 * @fileoverview CLI Run Command
 * @module cli/commands/run
 *
 * Implements the 'run' command for executing AI workflows.
 * Integrates with MainOrchestrator to execute workflow steps.
 *
 * Architecture: v2.0.0 Pattern
 * - Pure functions for validation and configuration
 * - Impure wrapper for execution
 *
 * @version 1.0.0
 * @since 2026-02-10
 */
export type ProviderName = 'copilot' | 'claude';
export type AlternativesOption = boolean | number | string;
export interface RunCommandOptions {
    alternatives?: AlternativesOption;
    auto?: boolean;
    config?: unknown;
    dryRun?: boolean;
    noAutoResume?: boolean;
    parallel?: boolean;
    projectRoot?: string;
    provider?: string;
    sdkSmokeTest?: boolean;
    stage?: string;
    tui?: boolean;
    verbose?: boolean;
    workflowDir?: string;
}
export interface RunOptionsValidationResult {
    isValid: boolean;
    errors: string[];
}
export interface RunOrchestratorOptions {
    workflowDir: string;
    projectRoot: string;
    stage: string;
    auto: boolean;
    dryRun: boolean;
    noParallel: boolean;
    sdkSmokeTest: boolean;
    alternatives: boolean | number;
    verbose: boolean;
    streamingEnabled: boolean;
    provider: string;
}
export interface WorkflowResultSummary {
    failed?: number;
    succeeded?: number;
    total?: number;
}
export interface WorkflowExecutionResults {
    summary?: WorkflowResultSummary;
}
export interface RunResultSummary {
    report?: string;
}
export interface RunCommandResult {
    aborted?: boolean;
    duration: number;
    error?: string;
    results: WorkflowExecutionResults;
    success: boolean;
    summary?: RunResultSummary | string | null;
}
export interface StartupDecision {
    shouldResume: boolean;
    checkpointId: string | null;
    workflowId?: string | null;
    lastRunState: string;
    reason: string;
    logDirName: string | null;
}
export interface CheckpointState {
    completedSteps?: number | string[];
}
export interface CheckpointMetadata {
    id: string;
    state: CheckpointState;
}
/**
 * Validate run command options
 * @pure
 */
export declare function validateRunOptions(options?: RunCommandOptions): RunOptionsValidationResult;
/**
 * Create orchestrator options from CLI options
 * @pure
 */
export declare function createOrchestratorOptions(cliOptions?: RunCommandOptions): RunOrchestratorOptions;
/**
 * Format workflow result for display
 * @pure
 */
export declare function formatWorkflowResult(result: RunCommandResult | null | undefined): string;
/**
 * Execute the run command
 */
export declare function runCommand(options?: RunCommandOptions): Promise<void>;
declare const runCommandExports: {
    runCommand: typeof runCommand;
    validateRunOptions: typeof validateRunOptions;
    createOrchestratorOptions: typeof createOrchestratorOptions;
    formatWorkflowResult: typeof formatWorkflowResult;
};
export default runCommandExports;
//# sourceMappingURL=run.d.ts.map