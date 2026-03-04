/**
 * Async Retry Utility
 *
 * Reusable retry logic for async operations within workflow steps.
 *
 * The orchestrator (`step_executor.js`) already retries whole-step failures.
 * This module fills the complementary need: retrying a *specific sub-operation*
 * inside a step (e.g., a single AI API call, a file-system probe, a git command)
 * without aborting the entire step on transient errors.
 *
 * Architecture follows v2.0.0 referential transparency pattern:
 *   - Pure functions: `classifyError`, `shouldRetry`, `calculateDelay`
 *   - Impure wrapper: `withRetry` (executes the async fn and applies delays)
 *
 * @module utils/retry
 * @version 1.0.0
 */

import { ValidationError, ConfigurationError } from './errors.js';

// ==============================================================================
// Error classification
// ==============================================================================

/**
 * Error categories used by retry decisions.
 * @enum {string}
 */
export const ErrorCategory = {
  /** Permanent logic/input errors — never retry. */
  FATAL: 'FATAL',
  /** Transient infrastructure errors — safe to retry. */
  TRANSIENT: 'TRANSIENT',
  /** Unknown/unrecognised errors — retry conservatively. */
  UNKNOWN: 'UNKNOWN',
};

/**
 * Classifies an error into a retry category.
 *
 * @param {Error} error - The error to classify.
 * @returns {string} One of the {@link ErrorCategory} values.
 * @pure
 *
 * @example
 * classifyError(new ValidationError('bad input')); // => 'FATAL'
 * classifyError(new Error('ENOENT'));              // => 'TRANSIENT'
 */
export function classifyError(error) {
  if (!error || typeof error !== 'object') return ErrorCategory.UNKNOWN;

  // Permanent errors — retrying cannot help
  if (
    error instanceof ValidationError ||
    error instanceof ConfigurationError ||
    error.code === 'VALIDATION_ERROR' ||
    error.code === 'CONFIG_ERROR'
  ) {
    return ErrorCategory.FATAL;
  }

  // Well-known transient OS / network error codes
  const transientCodes = new Set([
    'ENOENT',
    'EACCES',
    'ECONNRESET',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'EPIPE',
    'EAGAIN',
    'EBUSY',
  ]);
  if (transientCodes.has(error.code)) return ErrorCategory.TRANSIENT;

  // HTTP-style status codes returned as error.status
  const transientStatuses = new Set([429, 500, 502, 503, 504]);
  if (transientStatuses.has(error.status)) return ErrorCategory.TRANSIENT;

  // Rate-limit / timeout message heuristics
  const msg = (error.message || '').toLowerCase();
  if (
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('rate limit') ||
    msg.includes('too many requests') ||
    msg.includes('service unavailable') ||
    msg.includes('network')
  ) {
    return ErrorCategory.TRANSIENT;
  }

  return ErrorCategory.UNKNOWN;
}

/**
 * Decides whether a retry attempt should be made.
 *
 * @param {Error}  error      - The error that triggered this decision.
 * @param {number} attempt    - Zero-based index of the attempt that just failed.
 * @param {number} maxRetries - Maximum number of *retries* (not total attempts).
 * @returns {boolean}
 * @pure
 *
 * @example
 * shouldRetry(new Error('ETIMEDOUT'), 0, 3); // => true
 * shouldRetry(new ValidationError('bad'), 0, 3); // => false
 * shouldRetry(new Error('x'), 3, 3); // => false (exhausted)
 */
export function shouldRetry(error, attempt, maxRetries) {
  if (attempt >= maxRetries) return false;

  const category = classifyError(error);
  return category !== ErrorCategory.FATAL;
}

// ==============================================================================
// Delay calculation
// ==============================================================================

/**
 * Calculates the delay before the next retry using exponential back-off with
 * optional jitter.
 *
 * @param {number} attempt    - Zero-based retry index (0 = first retry).
 * @param {number} baseDelay  - Milliseconds for the first retry delay.
 * @param {number} [maxDelay=30_000] - Cap on the calculated delay (ms).
 * @param {number} [jitter=0]        - Random jitter range in ms (±jitter/2).
 * @returns {number} Delay in milliseconds.
 * @pure
 *
 * @example
 * calculateDelay(0, 1000);           // => 1000
 * calculateDelay(1, 1000);           // => 2000
 * calculateDelay(2, 1000);           // => 4000
 * calculateDelay(10, 1000, 30_000);  // => 30000 (capped)
 */
export function calculateDelay(attempt, baseDelay, maxDelay = 30_000, jitter = 0) {
  const exponential = baseDelay * Math.pow(2, attempt);
  const capped = Math.min(exponential, maxDelay);
  const noise = jitter > 0 ? (Math.random() - 0.5) * jitter : 0;
  return Math.max(0, Math.round(capped + noise));
}

// ==============================================================================
// withRetry — impure wrapper
// ==============================================================================

/**
 * @typedef {Object} RetryOptions
 * @property {number} [maxRetries=3]      - Maximum number of retry attempts.
 * @property {number} [baseDelay=500]     - Initial retry delay in ms.
 * @property {number} [maxDelay=30_000]   - Maximum retry delay cap in ms.
 * @property {number} [jitter=0]          - Random jitter range in ms.
 * @property {Function} [onRetry]         - Called before each retry: `(error, attempt, delay) => void`.
 * @property {Function} [shouldRetryFn]   - Custom retry predicate: `(error, attempt, maxRetries) => boolean`.
 *                                          Defaults to {@link shouldRetry}.
 * @property {Function} [sleep]           - Custom sleep implementation (for testing): `(ms) => Promise<void>`.
 */

/**
 * Executes `fn` and retries on failure according to `options`.
 *
 * @template T
 * @param {() => Promise<T>} fn      - Async function to execute.
 * @param {RetryOptions}     [options={}]
 * @returns {Promise<T>}
 *
 * @example
 * const result = await withRetry(
 *   () => fetchSomeData(),
 *   { maxRetries: 3, baseDelay: 500, onRetry: (err, n) => logger.warn(`retry ${n}: ${err.message}`) }
 * );
 */
export async function withRetry(fn, options = {}) {
  const {
    maxRetries = 3,
    baseDelay = 500,
    maxDelay = 30_000,
    jitter = 0,
    onRetry = null,
    shouldRetryFn = shouldRetry,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  } = options;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (!shouldRetryFn(error, attempt, maxRetries)) {
        throw error;
      }

      const delay = calculateDelay(attempt, baseDelay, maxDelay, jitter);

      if (typeof onRetry === 'function') {
        onRetry(error, attempt + 1, delay);
      }

      await sleep(delay);
    }
  }

  // All retries exhausted — re-throw last error
  throw lastError;
}
