/**
 * @fileoverview CLI Resume Command
 * @module cli/commands/resume
 *
 * Implements the 'resume' command for resuming workflows from checkpoints.
 *
 * Architecture: v2.0.0 Pattern
 * - Pure functions for validation and formatting
 * - Impure wrapper for execution
 *
 * @version 1.0.0
 * @since 2026-02-10
 */
export interface ResumeCommandOptions {
    latest?: boolean;
    list?: boolean;
    projectRoot?: string;
    stage?: string;
    tui?: boolean;
    verbose?: boolean;
    workflowDir?: string;
}
export interface ResumeValidationResult {
    isValid: boolean;
    errors: string[];
}
export interface ResumeCheckpointState {
    completedSteps?: string[] | number;
}
export interface ResumeCheckpointMetadata {
    progress?: number;
    totalSteps?: number;
}
export interface ResumeCheckpoint {
    id?: string;
    workflowId: string;
    timestamp: number | string | Date;
    state: ResumeCheckpointState;
    metadata?: ResumeCheckpointMetadata;
}
export interface ResumeCommandResult {
    aborted?: boolean;
    duration?: number;
    error?: string;
    success: boolean;
}
export interface TuiResumeResult extends ResumeCommandResult {
    aborted: boolean;
}
/**
 * Validate resume command options
 * @pure
 */
export declare function validateResumeOptions(options: ResumeCommandOptions | undefined, checkpointId: string | null | undefined): ResumeValidationResult;
/**
 * Format checkpoint for display
 * @pure
 */
export declare function formatCheckpoint(checkpoint: ResumeCheckpoint | null | undefined): string;
/**
 * Format checkpoint list for display
 * @pure
 */
export declare function formatCheckpointList(checkpoints: ResumeCheckpoint[] | null | undefined): string;
/**
 * Execute the resume command
 */
export declare function resumeCommand(checkpointId: string | null | undefined, options?: ResumeCommandOptions): Promise<void>;
declare const resumeCommandExports: {
    resumeCommand: typeof resumeCommand;
    validateResumeOptions: typeof validateResumeOptions;
    formatCheckpoint: typeof formatCheckpoint;
    formatCheckpointList: typeof formatCheckpointList;
};
export default resumeCommandExports;
//# sourceMappingURL=resume.d.ts.map