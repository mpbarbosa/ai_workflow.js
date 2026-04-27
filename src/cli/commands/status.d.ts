/**
 * @fileoverview CLI Status Command
 * @module cli/commands/status
 *
 * Implements the 'status' command for displaying workflow status.
 *
 * Architecture: v2.0.0 Pattern
 * - Pure functions for formatting
 * - Impure wrapper for file I/O
 *
 * @version 1.0.0
 * @since 2026-02-10
 */
export interface StatusCommandOptions {
    verbose?: boolean;
    workflowDir?: string;
}
export interface WorkflowCheckpointState {
    completedSteps?: string[];
    failedSteps?: string[];
}
export interface WorkflowCheckpointMetadata {
    progress?: number;
    totalSteps?: number;
}
export interface WorkflowCheckpoint {
    workflowId: string;
    timestamp: number | string | Date;
    state: WorkflowCheckpointState;
    metadata?: WorkflowCheckpointMetadata;
}
export interface WorkflowMetricsEntry {
    duration?: number;
    success?: boolean;
}
export interface WorkflowMetricsSummary {
    avgDuration?: number;
    successRate?: number;
    totalExecutions?: number;
}
export interface WorkflowStatusData {
    checkpoints?: WorkflowCheckpoint[];
    metrics?: WorkflowMetricsSummary | null;
}
export interface WorkflowStatusSummary {
    avgDuration: number;
    latestCheckpoint: WorkflowCheckpoint | null;
    successRate: number;
    totalCheckpoints: number;
    totalExecutions: number;
}
/**
 * Format workflow status for display
 * @pure
 */
export declare function formatWorkflowStatus(status: WorkflowStatusData | null | undefined): string;
/**
 * Calculate summary statistics
 * @pure
 */
export declare function calculateSummaryStats(checkpoints: WorkflowCheckpoint[] | null | undefined, metrics: WorkflowMetricsEntry[] | null | undefined): WorkflowStatusSummary;
/**
 * Execute the status command
 */
export declare function statusCommand(options?: StatusCommandOptions): Promise<void>;
declare const _default: {
    statusCommand: typeof statusCommand;
    formatWorkflowStatus: typeof formatWorkflowStatus;
    calculateSummaryStats: typeof calculateSummaryStats;
};
export default _default;
//# sourceMappingURL=status.d.ts.map