/**
 * Token budget utilities — single source of truth for token estimation and truncation.
 *
 * All callers that need to estimate token counts or truncate content to a token
 * budget must go through this module. Do not inline `/ 4` or per-file char limits
 * elsewhere in the codebase.
 *
 * @module lib/token_budget
 */

/** Per-file token budget for code/doc review (≈ 4 000 chars). */
export const DEFAULT_PER_FILE_TOKENS = 1_000;

/** Per-file token budget for test-file review (≈ 5 000 chars). */
export const DEFAULT_PER_TEST_FILE_TOKENS = 1_250;

/** Total context token budget for prompt assembly (≈ 30 000 chars). */
export const DEFAULT_TOTAL_TOKENS = 7_500;

/**
 * Estimate token count for a string using the 4-chars-per-token heuristic.
 *
 * @param {string} str
 * @returns {number}
 */
export function estimateTokens(str) {
  if (!str) return 0;
  return Math.ceil(str.length / 4);
}

/**
 * Truncate `str` so it fits within `budget` tokens.
 *
 * @param {string}  str
 * @param {number}  budget  - Maximum tokens allowed.
 * @param {'tail'|'line-boundary'|'skip'} [policy='tail']
 *   - `'tail'`           Cut at the character limit; append a short marker.
 *   - `'line-boundary'`  Cut at the last newline before the limit; append a marker.
 *   - `'skip'`           Return `null` when the string exceeds the budget.
 * @returns {string|null}  `null` only when policy is `'skip'` and content overflows.
 */
export function fitToTokens(str, budget, policy = 'tail') {
  if (!str) return policy === 'skip' ? null : '';

  if (estimateTokens(str) <= budget) return str;

  if (policy === 'skip') return null;

  const maxChars = budget * 4;

  if (policy === 'line-boundary') {
    const cutAt = str.lastIndexOf('\n', maxChars);
    const safeAt = cutAt > 0 ? cutAt : maxChars;
    return str.substring(0, safeAt) + '\n\n...(truncated — remainder omitted)';
  }

  // 'tail' (default)
  return str.substring(0, maxChars) + '\n... (truncated)';
}
