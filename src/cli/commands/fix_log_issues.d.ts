/**
 * @fileoverview CLI Fix Log Issues Command
 * @module cli/commands/fix_log_issues
 *
 * Implements the 'fix-log-issues' command: reads workflow log files,
 * batches them to fit within the model's token limit, sends each batch
 * to the AI in sequence (streaming output to the terminal), then merges
 * all partial plans into a single consolidated fix plan.
 *
 * Architecture: v2.0.0 Pattern
 * - Pure functions for option validation, path resolution, batching, and prompt building
 * - Impure wrapper for filesystem I/O, AI calls, streaming output
 *
 * @version 2.1.0
 * @since 2026-03-12
 */
export type FixLogSeverity = 'critical' | 'warning' | 'all';
export interface FixLogCommandOptions {
    logDir?: string;
    projectRoot?: string;
    workflowDir?: string;
    output?: string;
    latest?: boolean;
    severity?: FixLogSeverity;
    model?: string;
    dryRun?: boolean;
    verbose?: boolean;
    promptsDir?: string | null;
}
export interface FixLogOptionsValidationResult {
    isValid: boolean;
    errors: string[];
}
export interface LogEntry {
    filePath: string;
    content: string;
}
/**
 * Approximate prompt-token context limits per known model.
 * We use 85% of the published limit to leave room for the system prompt
 * preamble, per-batch instructions, and completion tokens.
 */
export declare const MODEL_CONTEXT_LIMITS: Readonly<Record<string, number>>;
/**
 * Estimate token count of a string using a conservative chars-per-token ratio.
 */
export declare function estimateTokenCount(text: string): number;
/**
 * Compute the maximum body characters that fit in a single batch prompt
 * for the given model, after reserving overhead for instructions and completion.
 */
export declare function maxBodyCharsForModel(model: string): number;
/**
 * Validate fix-log-issues command options.
 */
export declare function validateFixLogOptions(options?: FixLogCommandOptions): FixLogOptionsValidationResult;
/**
 * Resolve the log directory from options, with fallback to workflow directory default.
 */
export declare function resolveLogDirectory(options: FixLogCommandOptions, cwd: string): string;
/**
 * Resolve the project root from options or cwd.
 */
export declare function resolveProjectRoot(options: FixLogCommandOptions, cwd: string): string;
/**
 * Format a terminal summary line for an issue count.
 */
export declare function formatIssueSummary(critical: number, warning: number, total: number): string[];
/**
 * Split log entries into batches that each fit within `maxBodyChars`.
 *
 * Files are ordered: step `.log` files first (higher priority), then prompt
 * `.md` files. Within each group the original discovery order is preserved.
 * A single file that exceeds `maxBodyChars` on its own is placed alone in
 * its own batch (the AI will receive what it can handle).
 */
export declare function batchLogEntries<T extends LogEntry>(entries: readonly T[], maxBodyChars: number): T[][];
/**
 * Build the prompt for a single analysis batch.
 */
export declare function buildBatchPrompt(entries: readonly LogEntry[], projectRoot: string, batchNum: number, totalBatches: number): string;
/**
 * Build the final merge prompt that consolidates multiple partial batch results.
 */
export declare function buildMergePrompt(partialPlans: readonly string[], projectRoot: string): string;
/**
 * Convenience alias for single-batch use: build a complete prompt from all log entries.
 */
export declare function buildFixLogPrompt<T extends LogEntry>(entries: readonly T[], projectRoot: string): string;
/**
 * Execute the fix-log-issues command.
 */
export declare function fixLogIssuesCommand(options?: FixLogCommandOptions): Promise<void>;
declare const fixLogIssuesModule: {
    fixLogIssuesCommand: typeof fixLogIssuesCommand;
    validateFixLogOptions: typeof validateFixLogOptions;
    resolveLogDirectory: typeof resolveLogDirectory;
    resolveProjectRoot: typeof resolveProjectRoot;
    formatIssueSummary: typeof formatIssueSummary;
    estimateTokenCount: typeof estimateTokenCount;
    maxBodyCharsForModel: typeof maxBodyCharsForModel;
    batchLogEntries: typeof batchLogEntries;
    buildBatchPrompt: typeof buildBatchPrompt;
    buildFixLogPrompt: typeof buildFixLogPrompt;
    buildMergePrompt: typeof buildMergePrompt;
};
export default fixLogIssuesModule;
//# sourceMappingURL=fix_log_issues.d.ts.map