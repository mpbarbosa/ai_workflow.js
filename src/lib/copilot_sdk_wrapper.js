/**
 * Copilot SDK Wrapper
 *
 * Thin wrapper around the GitHub Copilot SDK that centralises all SDK lifecycle
 * concerns: client start/stop, session creation/destruction, serialised request
 * dispatch, and error-resilient cleanup (try-finally + forceStop race).
 *
 * All cookbook patterns from
 * https://github.com/github/awesome-copilot/blob/main/cookbook/copilot-sdk/nodejs/error-handling.md
 * are implemented here so higher-level code (AiHelper) stays focused on
 * orchestration rather than SDK mechanics.
 *
 * @module lib/copilot_sdk_wrapper
 * @version 2.0.0
 */
import { CopilotClient } from '@github/copilot-sdk';
import { logger } from '../core/logger.js';
import { SystemError } from '../utils/errors.js';
// ms to wait for client.stop() before calling forceStop()
const FORCE_STOP_TIMEOUT_MS = 5_000;
// ==============================================================================
// CopilotSdkWrapper — SDK lifecycle management
// ==============================================================================
/**
 * Wraps the Copilot SDK client/session lifecycle with robust error handling.
 *
 * Responsibilities:
 *  - Availability check (static)
 *  - Client start/stop with try-finally cleanup
 *  - Session creation and recreation after timeouts
 *  - Serialised sendAndWait dispatch (SDK does not allow concurrent calls)
 *  - Graceful cleanup with forceStop fallback
 *  - Optional session.abort() support
 */
export class CopilotSdkWrapper {
  _model;
  _timeout;
  _workingDirectory;
  _streaming;
  _client;
  _session;
  _authenticated;
  _availableModels;
  /** Serialises concurrent send() calls — the SDK does not support simultaneous sendAndWait. */
  _sendQueue;
  constructor({ model, timeout, workingDirectory, streaming = false } = {}) {
    this._model = model;
    this._timeout = timeout;
    this._workingDirectory = workingDirectory;
    this._streaming = streaming;
    this._client = null;
    this._session = null;
    this._authenticated = false;
    this._availableModels = [];
    this._sendQueue = Promise.resolve();
  }
  // --------------------------------------------------------------------------
  // Getters — expose SDK state for external inspection (e.g. consistency checks)
  // --------------------------------------------------------------------------
  get client() {
    return this._client;
  }
  get session() {
    return this._session;
  }
  get authenticated() {
    return this._authenticated;
  }
  get availableModels() {
    return this._availableModels;
  }
  // --------------------------------------------------------------------------
  // Static helpers
  // --------------------------------------------------------------------------
  /**
   * Returns true if CopilotClient can be imported and instantiated.
   * Does NOT start the CLI server — safe to call any time.
   */
  static isAvailable() {
    try {
      if (!CopilotClient || typeof CopilotClient !== 'function') return false;
      const probe = new CopilotClient();
      return probe !== null;
    } catch {
      return false;
    }
  }
  // --------------------------------------------------------------------------
  // Lifecycle
  // --------------------------------------------------------------------------
  /**
   * Starts the Copilot CLI server, authenticates, and creates the first session.
   *
   * Cookbook pattern: if auth or session creation fails after client.start()
   * the client is stopped inside a catch block so no orphaned process is left.
   *
   * @returns Resolved authentication state and available models.
   * @throws Re-throws any error after cleaning up the client.
   */
  async initialize() {
    this._client = new CopilotClient();
    await this._client.start();
    try {
      const status = await this._client.getAuthStatus();
      this._authenticated = status?.isAuthenticated ?? false;
      if (this._authenticated) {
        try {
          this._availableModels = await this._client.listModels();
        } catch (modelErr) {
          logger.debug(`Could not fetch available models: ${modelErr.message}`);
        }
        const sessionConfig = { model: this._model };
        if (this._workingDirectory) {
          sessionConfig.workingDirectory = this._workingDirectory;
        }
        if (this._streaming) {
          sessionConfig.streaming = true;
        }
        this._session = await this._client.createSession(sessionConfig);
      }
    } catch (error) {
      // Cookbook: clean up the client so the CLI process is not orphaned
      await this._client.stop().catch(() => {});
      this._client = null;
      throw error;
    }
    return {
      authenticated: this._authenticated,
      availableModels: this._availableModels,
    };
  }
  /**
   * Sends a prompt to the current session and returns the raw SDK response data.
   * Requests are serialised — concurrent callers wait their turn.
   *
   * @param prompt    - The prompt text.
   * @param timeoutMs - Override the default timeout (ms).
   * @returns Raw event data from the SDK.
   * @throws {@link SystemError} If no active session exists.
   */
  async send(prompt, timeoutMs) {
    if (!this._session) {
      throw new SystemError('No active session. Call initialize() first.');
    }
    const result = this._sendQueue.then(() => this._doSend(prompt, timeoutMs));
    // Advance the queue regardless of success/failure so later requests aren't blocked.
    this._sendQueue = result.catch(() => {});
    return result;
  }
  /**
   * Aborts any in-flight request on the current session (if the SDK supports it).
   */
  async abort() {
    const session = this._session;
    if (session && typeof session.abort === 'function') {
      await session.abort().catch(() => {});
    }
  }
  /**
   * Destroys the current session, restarts the client, and creates a fresh session.
   * Called before each retry after a timeout so a stuck server process is replaced.
   */
  async recreateSession() {
    if (this._session) {
      await this._session.destroy().catch(() => {});
      this._session = null;
    }
    if (this._client) {
      await this._client.stop().catch(() => {});
      this._client = new CopilotClient();
      await this._client.start();
    }
    this._session = await this._client.createSession({
      model: this._model,
      ...(this._workingDirectory ? { workingDirectory: this._workingDirectory } : {}),
      ...(this._streaming ? { streaming: true } : {}),
    });
    // Reset the send queue so the fresh session isn't blocked by stale entries.
    this._sendQueue = Promise.resolve();
    logger.info('[SDK] Client and session recreated for retry');
  }
  /**
   * Shuts down the session and client.
   *
   * Cookbook patterns applied:
   *  - try-finally: client.stop() is always called even if session.destroy() throws.
   *  - forceStop: if client.stop() hangs beyond FORCE_STOP_TIMEOUT_MS, forceStop() is called.
   */
  async cleanup() {
    try {
      if (this._session) {
        await this._session.destroy().catch(() => {});
        this._session = null;
      }
    } finally {
      if (this._client) {
        const client = this._client;
        this._client = null;
        try {
          await Promise.race([
            client.stop(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('client.stop() timed out')), FORCE_STOP_TIMEOUT_MS)
            ),
          ]);
        } catch {
          // Cookbook: forceStop if stop() hangs
          await client.forceStop().catch(() => {});
        }
      }
    }
  }
  /**
   * Sends a prompt and streams the response via an `onChunk` callback.
   * Requests are serialised — concurrent callers wait their turn.
   *
   * The session must have been created with `streaming: true` (pass `streaming: true`
   * to the constructor). Each delta content chunk is delivered to `onChunk` as it
   * arrives; the method resolves with the same `event.data` shape as `send()` once
   * the session goes idle, so callers can switch between streaming and non-streaming
   * without changing their response-handling code.
   *
   * @param prompt    - The prompt text.
   * @param onChunk   - Called with each `deltaContent` string as it arrives.
   * @param timeoutMs - Override the default timeout (ms).
   * @returns Raw event data from the SDK (full assembled response).
   * @throws {@link SystemError} If no active session exists.
   */
  async sendStream(prompt, onChunk, timeoutMs) {
    if (!this._session) {
      throw new SystemError('No active session. Call initialize() first.');
    }
    const result = this._sendQueue.then(() => this._doSendStream(prompt, onChunk, timeoutMs));
    this._sendQueue = result.catch(() => {});
    return result;
  }
  // --------------------------------------------------------------------------
  // Private helpers
  // --------------------------------------------------------------------------
  /** Performs a single serialised sendAndWait call. */
  async _doSend(prompt, timeoutMs) {
    const timeout = timeoutMs ?? this._timeout;
    const event = await this._session.sendAndWait({ prompt }, timeout);
    return event?.data ?? { content: '', success: false };
  }
  /** Performs a single streaming sendAndWait call, forwarding deltas to onChunk. */
  async _doSendStream(prompt, onChunk, timeoutMs) {
    const timeout = timeoutMs ?? this._timeout;
    const chunks = [];
    const unsubscribeDelta = this._session.on('assistant.message_delta', (event) => {
      const delta = event?.data?.deltaContent ?? '';
      if (delta) chunks.push(delta);
      if (typeof onChunk === 'function') onChunk(delta);
    });
    try {
      const event = await this._session.sendAndWait({ prompt }, timeout);
      return event?.data ?? { content: chunks.join(''), success: true };
    } finally {
      if (typeof unsubscribeDelta === 'function') unsubscribeDelta();
    }
  }
}
