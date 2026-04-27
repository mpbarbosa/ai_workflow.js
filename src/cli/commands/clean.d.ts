/**
 * @fileoverview CLI Clean Command
 * @module cli/commands/clean
 *
 * Implements the 'clean' command for cleaning workflow artifacts.
 *
 * Architecture: v2.0.0 Pattern
 * - Pure functions for filtering and calculation
 * - Impure wrapper for file operations
 *
 * @version 1.0.0
 * @since 2026-02-10
 */
export interface CleanCommandOptions {
    all?: boolean;
    artifacts?: boolean;
    cache?: boolean;
    checkpoints?: boolean;
    dryRun?: boolean;
    verbose?: boolean;
    workflowDir?: string;
    olderThanDays?: number;
    keepLast?: number;
}
export interface CleanValidationResult {
    isValid: boolean;
    errors: string[];
}
export interface CleanupTargets {
    artifacts: boolean;
    cache: boolean;
    checkpoints: boolean;
    sessions: boolean;
    metrics: boolean;
    all?: boolean;
}
export interface CleanupResult {
    filesDeleted?: number;
    bytesFreed?: number;
}
/**
 * Validate clean command options
 * @pure
 */
export declare function validateCleanOptions(options: CleanCommandOptions): CleanValidationResult;
/**
 * Determine what to clean based on options
 * @pure
 */
export declare function determineCleanupTargets(options: CleanCommandOptions): CleanupTargets;
/**
 * Format cleanup result for display
 * @pure
 */
export declare function formatCleanupResult(result: CleanupResult | null | undefined): string;
/**
 * Execute the clean command
 */
export declare function cleanCommand(options: CleanCommandOptions): Promise<void>;
declare const cleanCommandExports: {
    cleanCommand: typeof cleanCommand;
    validateCleanOptions: typeof validateCleanOptions;
    determineCleanupTargets: typeof determineCleanupTargets;
    formatCleanupResult: typeof formatCleanupResult;
};
export default cleanCommandExports;
//# sourceMappingURL=clean.d.ts.map