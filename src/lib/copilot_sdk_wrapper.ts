/**
 * Copilot SDK Wrapper
 *
 * Re-exports {@link CopilotSdkWrapper} and its companion types from
 * `olinda_copilot_sdk.ts` v0.5.1.  All SDK lifecycle concerns (client
 * start/stop, session creation/destruction, serialised request dispatch,
 * forceStop fallback, etc.) are implemented there and documented at:
 * https://github.com/mpbarbosa/olinda_copilot_sdk.ts
 *
 * Higher-level code (AiHelper) should continue importing from this module so
 * the import path stays stable even if the underlying package changes again.
 *
 * @module lib/copilot_sdk_wrapper
 * @version 2.5.0
 */

export {
  CopilotSdkWrapper,
  approveAll,
} from 'olinda_copilot_sdk.ts';

export type {
  CopilotSdkWrapperOptions,
  InitializeResult,
  SendResult,
  // v0.5.1+ — session resume config (used with resumeSession())
  ResumeSessionConfig,
} from 'olinda_copilot_sdk.ts';
