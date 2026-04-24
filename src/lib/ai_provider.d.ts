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
/** Supported AI providers. */
export type AIProvider = 'copilot' | 'claude';
/** Options forwarded to whichever provider wrapper is selected. */
export interface ProviderWrapperOptions {
    model?: string;
    timeout?: number;
    workingDirectory?: string;
    /** Copilot-only: whether to enable streaming in the underlying SDK session. */
    streaming?: boolean;
    /** Copilot-only: tools exposed to the Copilot SDK session. */
    tools?: any[];
}
/** Union of the two concrete wrapper types. */
export type ProviderWrapper = any;
/**
 * Creates and returns the provider wrapper for the requested AI provider.
 *
 * @param provider - `'copilot'` (default) or `'claude'`.
 * @param options  - Options forwarded to the wrapper constructor.
 */
export declare function createProviderWrapper(provider: AIProvider, options?: ProviderWrapperOptions): ProviderWrapper;
/**
 * Returns `true` if the requested provider's underlying SDK is available at runtime.
 */
export declare function isProviderAvailable(provider: AIProvider): boolean;
//# sourceMappingURL=ai_provider.d.ts.map