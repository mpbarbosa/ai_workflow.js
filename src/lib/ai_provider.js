/**
 * AI Provider Factory
 *
 * Single point of truth for creating AI provider wrappers. Call
 * `createProviderWrapper(provider, options)` wherever a wrapper is needed;
 * do not import `CopilotSdkWrapper` or `ClaudeProviderWrapper` directly in
 * application code outside of this module and the two wrapper files.
 *
 * @module lib/ai_provider
 * @version 1.0.0
 */
import { CopilotSdkWrapper } from './copilot_sdk_wrapper.js';
import { ClaudeProviderWrapper } from './claude_sdk_wrapper.js';
// ─── Factory ───────────────────────────────────────────────────────────────
/**
 * Creates and returns the provider wrapper for the requested AI provider.
 *
 * @param provider - `'copilot'` (default) or `'claude'`.
 * @param options  - Options forwarded to the wrapper constructor.
 */
export function createProviderWrapper(provider, options = {}) {
    if (provider === 'claude') {
        return new ClaudeProviderWrapper({
            model: options.model,
            timeout: options.timeout,
            workingDirectory: options.workingDirectory,
        });
    }
    // For Copilot, pass all options including streaming and tools
    // Even though the type definition doesn't list them, the actual wrapper accepts them
    const copilotOpts = {
        model: options.model,
        timeout: options.timeout,
        workingDirectory: options.workingDirectory,
    };
    if (options.streaming !== undefined) {
        copilotOpts.streaming = options.streaming;
    }
    if (options.tools !== undefined) {
        copilotOpts.tools = options.tools;
    }
    return new CopilotSdkWrapper(copilotOpts);
}
/**
 * Returns `true` if the requested provider's underlying SDK is available at runtime.
 */
export function isProviderAvailable(provider) {
    return provider === 'claude'
        ? ClaudeProviderWrapper.isAvailable()
        : CopilotSdkWrapper.isAvailable();
}
