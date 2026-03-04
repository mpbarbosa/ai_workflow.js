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
import { CopilotClient, CopilotSession } from '@github/copilot-sdk';
import type { ModelInfo } from '@github/copilot-sdk';
/** Options accepted by the {@link CopilotSdkWrapper} constructor. */
export interface CopilotSdkWrapperOptions {
    /** Model identifier to use when creating sessions (e.g. `"claude-sonnet-4.5"`). */
    model?: string;
    /** Default `sendAndWait` timeout in milliseconds. */
    timeout?: number;
    /** Working directory forwarded to the SDK session config. */
    workingDirectory?: string;
}
/** Shape returned by {@link CopilotSdkWrapper.initialize}. */
export interface InitializeResult {
    authenticated: boolean;
    availableModels: ModelInfo[];
}
/** Raw event data returned by {@link CopilotSdkWrapper.send}. */
export interface SendResult {
    content: string;
    success: boolean;
    [key: string]: unknown;
}
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
export declare class CopilotSdkWrapper {
    private _model;
    private _timeout;
    private _workingDirectory;
    private _client;
    private _session;
    private _authenticated;
    private _availableModels;
    /** Serialises concurrent send() calls — the SDK does not support simultaneous sendAndWait. */
    private _sendQueue;
    constructor({ model, timeout, workingDirectory }?: CopilotSdkWrapperOptions);
    get client(): CopilotClient | null;
    get session(): CopilotSession | null;
    get authenticated(): boolean;
    get availableModels(): ModelInfo[];
    /**
     * Returns true if CopilotClient can be imported and instantiated.
     * Does NOT start the CLI server — safe to call any time.
     */
    static isAvailable(): boolean;
    /**
     * Starts the Copilot CLI server, authenticates, and creates the first session.
     *
     * Cookbook pattern: if auth or session creation fails after client.start()
     * the client is stopped inside a catch block so no orphaned process is left.
     *
     * @returns Resolved authentication state and available models.
     * @throws Re-throws any error after cleaning up the client.
     */
    initialize(): Promise<InitializeResult>;
    /**
     * Sends a prompt to the current session and returns the raw SDK response data.
     * Requests are serialised — concurrent callers wait their turn.
     *
     * @param prompt    - The prompt text.
     * @param timeoutMs - Override the default timeout (ms).
     * @returns Raw event data from the SDK.
     * @throws {@link SystemError} If no active session exists.
     */
    send(prompt: string, timeoutMs?: number): Promise<SendResult>;
    /**
     * Aborts any in-flight request on the current session (if the SDK supports it).
     */
    abort(): Promise<void>;
    /**
     * Destroys the current session, restarts the client, and creates a fresh session.
     * Called before each retry after a timeout so a stuck server process is replaced.
     */
    recreateSession(): Promise<void>;
    /**
     * Shuts down the session and client.
     *
     * Cookbook patterns applied:
     *  - try-finally: client.stop() is always called even if session.destroy() throws.
     *  - forceStop: if client.stop() hangs beyond FORCE_STOP_TIMEOUT_MS, forceStop() is called.
     */
    cleanup(): Promise<void>;
    /** Performs a single serialised sendAndWait call. */
    private _doSend;
}
//# sourceMappingURL=copilot_sdk_wrapper.d.ts.map