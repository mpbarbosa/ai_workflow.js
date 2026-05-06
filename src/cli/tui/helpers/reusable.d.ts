/**
 * @fileoverview Reusable TUI helper functions
 * @module cli/tui/helpers/reusable
 *
 * Pure, deterministic helpers imported from pajussara_tui_comp so the local
 * TUI can share the same TypeScript implementation for generic display logic.
 */
export interface SearchMatchSegment {
    text: string;
    isMatch: boolean;
}
export interface LogSearchEntry {
    message?: string;
    time?: number;
}
export interface LogSearchResult {
    matchCount: number;
    matchIndices: number[];
}
export interface StepAlternative {
    number?: number;
    title?: string;
    description?: string;
    tradeoffs?: string;
}
export interface StepDetailInput {
    id?: string;
    name?: string;
    status?: string;
    duration?: number | null;
    retryCount?: number;
    exitCode?: number | null;
    errorMessage?: string | null;
    dependsOn?: string[];
    stepLogs?: string[];
    alternatives?: StepAlternative[];
    recommendedAlternative?: string | null;
}
export interface StepDetailResult {
    lines: string[];
    hasError: boolean;
    logLines: string[];
}
export declare function formatStepIcon(status: string): string;
export declare function statusColor(status: string): string;
export declare function formatDuration(ms: number): string;
export declare function formatTimestamp(ts: number): string;
export declare function formatEta(elapsedMs: number, pct: number): string | null;
export declare function formatProgressBar(pct: number, width: number): string;
export declare function formatProgressLine(pct: number, elapsedMs: number, barWidth: number): string;
export declare function truncateLogLine(line: string, maxWidth: number): string;
export declare function keepLast<T>(arr: readonly T[] | null | undefined, n: number): T[];
export declare function terminalIsSufficient(cols: number, rows: number): boolean;
export declare function stepsPanelWidth(totalCols: number): number;
export declare function filterLogLines(logs: readonly LogSearchEntry[] | null | undefined, query: string): LogSearchResult;
export declare function highlightSearchMatch(line: string, query: string): SearchMatchSegment[];
export declare function truncateStackTrace(stack: string | null | undefined, maxLines?: number): string[];
export declare function formatStepDetail(step: StepDetailInput | null | undefined): StepDetailResult;
//# sourceMappingURL=reusable.d.ts.map