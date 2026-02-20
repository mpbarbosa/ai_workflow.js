/**
 * SDK Smoke Test
 * Sends a minimal prompt to the GitHub Copilot API to verify connectivity.
 * Used by step_00 when the --sdk-smoke-test flag is set.
 *
 * @module lib/sdk_smoke_test
 * @version 2.0.0
 */

import { AiHelper } from './ai_helpers.js';
import { logger } from '../core/logger.js';

// ============================================================================
// PURE FUNCTIONS
// ============================================================================

/**
 * Return the minimal prompt used for the smoke test.
 * @pure
 * @returns {string} Smoke test prompt
 */
export function buildSmokeTestPrompt() {
  return 'Reply with the single word: ok';
}

/**
 * Validate a smoke test response from the AI.
 * @pure
 * @param {Object|null} response - Parsed AI response
 * @returns {boolean} True if the response contains non-empty content
 */
export function validateSmokeTestResponse(response) {
  if (!response || typeof response !== 'object') return false;
  const content = response.content;
  return typeof content === 'string' && content.trim().length > 0;
}

/**
 * Format a smoke test outcome into a backlog-friendly result object.
 * @pure
 * @param {boolean} success - Whether the test passed
 * @param {string} details - Human-readable detail string
 * @returns {{ status: string, details: string }}
 */
export function formatSmokeTestResult(success, details) {
  return {
    status: success ? 'passed' : 'failed',
    details: String(details),
  };
}

// ============================================================================
// IMPURE WRAPPER
// ============================================================================

/**
 * Run the SDK smoke test against the GitHub Copilot API.
 *
 * Creates a fresh AiHelper instance (or uses the one passed via options),
 * initialises it, sends a minimal prompt, and validates the response.
 * The AiHelper is cleaned up before returning.
 *
 * @param {Object} [options={}]
 * @param {Object} [options.logger] - Logger instance (defaults to module logger)
 * @param {Object} [options.aiHelper] - AiHelper instance for testing/injection
 * @returns {Promise<{ success: boolean, status: string, details: string, response?: Object }>}
 */
export async function runSdkSmokeTest(options = {}) {
  const log = options.logger || logger;
  const aiHelper = options.aiHelper || new AiHelper({ logger: log });

  log.info('[SDK Smoke Test] Initialising Copilot SDK...');

  try {
    const available = await aiHelper.initialize();

    if (!available) {
      const result = formatSmokeTestResult(false, 'Copilot SDK not available or not authenticated');
      log.warn(`[SDK Smoke Test] ${result.details}`);
      return { success: false, ...result };
    }

    const prompt = buildSmokeTestPrompt();
    log.info(`[SDK Smoke Test] Sending probe prompt: "${prompt}"`);

    const response = await aiHelper.executeRequest(prompt, { validate: false });

    if (!validateSmokeTestResponse(response)) {
      const result = formatSmokeTestResult(
        false,
        'Received empty or invalid response from Copilot API'
      );
      log.warn(`[SDK Smoke Test] ${result.details}`);
      return { success: false, ...result, response };
    }

    const result = formatSmokeTestResult(
      true,
      `Copilot API responded successfully (${response.content.trim().length} chars)`
    );
    log.success(`[SDK Smoke Test] ✓ ${result.details}`);
    return { success: true, ...result, response };
  } catch (error) {
    const result = formatSmokeTestResult(false, `SDK error: ${error.message}`);
    log.error(`[SDK Smoke Test] ${result.details}`);
    return { success: false, ...result };
  } finally {
    try {
      await aiHelper.cleanup();
    } catch {
      // cleanup errors are non-fatal
    }
  }
}
