/**
 * Claude Provider Wrapper
 *
 * Adapts {@link ClaudeSdkWrapper} from `olinda_copilot_sdk.ts` to the same
 * initialize / send / recreateSession / cleanup interface used by
 * {@link CopilotSdkWrapper}, so that {@link AiHelper} can switch AI providers
 * by replacing a single wrapper object.
 *
 * Authentication is handled by the user's local `claude` CLI configuration —
 * there is no separate SDK handshake, so `initialize()` always resolves with
 * `authenticated: true`.
 *
 * Import via `ai_provider.js` rather than directly.
 *
 * @module lib/claude_sdk_wrapper
 * @version 1.1.0
 */
export interface ClaudeProviderOptions {
    /** Model alias forwarded to the Claude Code subprocess (e.g. `'claude-sonnet-4-6'`). */
    model?: string;
    /** Default request timeout in milliseconds. Defaults to 120 000. */
    timeout?: number;
    /** Working directory forwarded to the Claude Code subprocess. */
    workingDirectory?: string;
}
export interface ProviderInitResult {
    authenticated: boolean;
    availableModels: Array<{
        id: string;
    }>;
}
export interface ProviderSendResult {
    content: string;
    success: boolean;
}
/**
 * Wraps {@link ClaudeSdkWrapper} with the same `initialize / send / cleanup`
 * interface as `CopilotSdkWrapper` so that `AiHelper` treats both providers
 * identically.
 *
 * The olinda inner SDK is loaded lazily on the first `send()` call so that
 * a missing `@anthropic-ai/claude-agent-sdk` package degrades gracefully
 * (isAvailable() returns false) instead of crashing the module chain at
 * import time.
 */
export declare class ClaudeProviderWrapper {
    private readonly _opts;
    private readonly _timeout;
    private _inner;
    constructor(opts?: ClaudeProviderOptions);
    /**
     * Returns `true` if `@anthropic-ai/claude-agent-sdk` is importable at runtime.
     * Uses createRequire so the check works in all Node.js versions without
     * triggering a full module load of the olinda ESM bundle.
     */
    static isAvailable(): boolean;
    /**
     * Lazily loads `ClaudeSdkWrapper` from `olinda_copilot_sdk.ts` on first use.
     * Any import error propagates so the caller can handle it (e.g. retry or fail).
     */
    private _getInner;
    /**
     * No SDK handshake required — authentication is via the local `claude` CLI.
     * Always resolves with `{ authenticated: true, availableModels: [] }`.
     */
    initialize(): Promise<ProviderInitResult>;
    /**
     * Sends a prompt and returns the collected assistant response.
     *
     * @param prompt     - Prompt text to send.
     * @param timeoutMs  - Optional per-call timeout override in milliseconds.
     */
    send(prompt: string, timeoutMs?: number): Promise<ProviderSendResult>;
    /**
     * No-op — the Claude Code subprocess lifecycle is self-contained per call;
     * there is no persistent session to recreate.
     */
    recreateSession(): Promise<void>;
    /**
     * No-op — no persistent process to shut down.
     */
    cleanup(): Promise<void>;
}
//# sourceMappingURL=claude_sdk_wrapper.d.ts.map