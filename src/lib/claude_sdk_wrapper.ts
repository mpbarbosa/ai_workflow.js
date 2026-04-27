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
import { logger } from '../core/logger.js';

// createRequire works in both CJS and ESM across all supported Node versions.
const _require = createRequire(import.meta.url);

// ─── Public types ──────────────────────────────────────────────────────────

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
  availableModels: Array<{ id: string }>;
}

export interface ProviderSendResult {
  content: string;
  success: boolean;
}

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
  private readonly _opts: ClaudeProviderOptions;
  private readonly _timeout: number;
  private _inner: { run(prompt: string): Promise<{ content: string; success: boolean }> } | null =
    null;

  constructor(opts: ClaudeProviderOptions = {}) {
    this._opts = opts;
    this._timeout = opts.timeout ?? 120_000;
  }

  // ── Static helpers ────────────────────────────────────────────────────────

  /**
   * Returns `true` if `@anthropic-ai/claude-agent-sdk` is importable at runtime.
   * Uses createRequire so the check works in all Node.js versions without
   * triggering a full module load of the olinda ESM bundle.
   */
  static isAvailable(): boolean {
    try {
      const mod = _require('@anthropic-ai/claude-agent-sdk');
      return typeof mod.query === 'function';
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.debug(`Claude SDK availability check failed: ${message}`);
      return false;
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /**
   * Lazily loads `ClaudeSdkWrapper` from `olinda_copilot_sdk.ts` on first use.
   * Any import error propagates so the caller can handle it (e.g. retry or fail).
   */
  private async _getInner(): Promise<
    { run(prompt: string): Promise<{ content: string; success: boolean }> }
  > {
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
  async initialize(): Promise<ProviderInitResult> {
    return { authenticated: true, availableModels: [] };
  }

  /**
   * Sends a prompt and returns the collected assistant response.
   *
   * @param prompt     - Prompt text to send.
   * @param timeoutMs  - Optional per-call timeout override in milliseconds.
   */
  async send(prompt: string, timeoutMs?: number): Promise<ProviderSendResult> {
    const inner = await this._getInner();
    const limit = timeoutMs ?? this._timeout;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`Claude request timeout after ${limit}ms`)),
        limit,
      );
    });
    try {
      const result = await Promise.race([inner.run(prompt), timeoutPromise]);
      return { content: result.content, success: result.success };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * No-op — the Claude Code subprocess lifecycle is self-contained per call;
   * there is no persistent session to recreate.
   */
  async recreateSession(): Promise<void> {}

  /**
   * No-op — no persistent process to shut down.
   */
  async cleanup(): Promise<void> {}
}
