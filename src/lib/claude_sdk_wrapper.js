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
import { createRequire } from 'module';
// createRequire works in both CJS and ESM across all supported Node versions.
const _require = createRequire(import.meta.url);
// ─── ClaudeProviderWrapper ─────────────────────────────────────────────────
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
export class ClaudeProviderWrapper {
    _opts;
    _timeout;
    _inner = null;
    constructor(opts = {}) {
        this._opts = opts;
        this._timeout = opts.timeout ?? 120_000;
    }
    // ── Static helpers ────────────────────────────────────────────────────────
    /**
     * Returns `true` if `@anthropic-ai/claude-agent-sdk` is importable at runtime.
     * Uses createRequire so the check works in all Node.js versions without
     * triggering a full module load of the olinda ESM bundle.
     */
    static isAvailable() {
        try {
            const mod = _require('@anthropic-ai/claude-agent-sdk');
            return typeof mod.query === 'function';
        }
        catch {
            return false;
        }
    }
    // ── Private helpers ───────────────────────────────────────────────────────
    /**
     * Lazily loads `ClaudeSdkWrapper` from `olinda_copilot_sdk.ts` on first use.
     * Any import error propagates so the caller can handle it (e.g. retry or fail).
     */
    async _getInner() {
        if (!this._inner) {
            const { ClaudeSdkWrapper } = await import('olinda_copilot_sdk.ts');
            this._inner = new ClaudeSdkWrapper({
                model: this._opts.model,
                cwd: this._opts.workingDirectory,
                permissionMode: 'bypassPermissions',
            });
        }
        return this._inner;
    }
    // ── Lifecycle ─────────────────────────────────────────────────────────────
    /**
     * No SDK handshake required — authentication is via the local `claude` CLI.
     * Always resolves with `{ authenticated: true, availableModels: [] }`.
     */
    async initialize() {
        return { authenticated: true, availableModels: [] };
    }
    /**
     * Sends a prompt and returns the collected assistant response.
     *
     * @param prompt     - Prompt text to send.
     * @param timeoutMs  - Optional per-call timeout override in milliseconds.
     */
    async send(prompt, timeoutMs) {
        const inner = await this._getInner();
        const limit = timeoutMs ?? this._timeout;
        let timer;
        const timeoutPromise = new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error(`Claude request timeout after ${limit}ms`)), limit);
        });
        try {
            const result = await Promise.race([inner.run(prompt), timeoutPromise]);
            return { content: result.content, success: result.success };
        }
        finally {
            clearTimeout(timer);
        }
    }
    /**
     * No-op — the Claude Code subprocess lifecycle is self-contained per call;
     * there is no persistent session to recreate.
     */
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    async recreateSession() { }
    /**
     * No-op — no persistent process to shut down.
     */
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    async cleanup() { }
}
