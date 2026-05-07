/**
 * Tests for TokenBudget module
 *
 * @jest-environment node
 */

import {
  estimateTokens,
  fitToTokens,
  DEFAULT_PER_FILE_TOKENS,
  DEFAULT_PER_TEST_FILE_TOKENS,
  DEFAULT_TOTAL_TOKENS,
} from '../../src/lib/token_budget.js';

describe('estimateTokens', () => {
  test('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });

  test('returns 0 for null/undefined', () => {
    expect(estimateTokens(null)).toBe(0);
    expect(estimateTokens(undefined)).toBe(0);
  });

  test('rounds up to nearest token', () => {
    expect(estimateTokens('abc')).toBe(1); // 3 chars → ceil(0.75) = 1
    expect(estimateTokens('abcd')).toBe(1); // 4 chars → 1
    expect(estimateTokens('abcde')).toBe(2); // 5 chars → ceil(1.25) = 2
  });

  test('scales linearly with length', () => {
    const str = 'a'.repeat(400);
    expect(estimateTokens(str)).toBe(100);
  });
});

describe('fitToTokens — tail policy (default)', () => {
  test('returns string unchanged when it fits', () => {
    const str = 'a'.repeat(40); // 10 tokens
    expect(fitToTokens(str, 100)).toBe(str);
    expect(fitToTokens(str, 10)).toBe(str);
  });

  test('truncates and appends marker when over budget', () => {
    const str = 'a'.repeat(400); // 100 tokens
    const result = fitToTokens(str, 50);
    expect(result).toContain('(truncated)');
    // 200 chars content + 16-char marker = 216 chars = 54 tokens
    expect(estimateTokens(result)).toBeLessThanOrEqual(54);
  });

  test('returns empty string for empty input', () => {
    expect(fitToTokens('', 100)).toBe('');
  });

  test('returns empty string for null input', () => {
    expect(fitToTokens(null, 100)).toBe('');
  });
});

describe('fitToTokens — line-boundary policy', () => {
  test('cuts at last newline before the limit', () => {
    const line = 'x'.repeat(20) + '\n'; // 21 chars per line
    const str = line.repeat(20); // 420 chars ≈ 105 tokens
    const result = fitToTokens(str, 50, 'line-boundary'); // budget = 200 chars
    expect(result).toContain('(truncated');
    // Result should not cut a line in half — ends right before a \n
    const withoutMarker = result.split('\n\n...(truncated')[0];
    expect(withoutMarker.endsWith('\n') || withoutMarker.endsWith('x'.repeat(20))).toBe(true);
  });

  test('falls back to char limit when no newline found', () => {
    const str = 'a'.repeat(400); // no newlines, 100 tokens
    const result = fitToTokens(str, 50, 'line-boundary');
    expect(result).toContain('(truncated');
    expect(result.startsWith('a'.repeat(200))).toBe(true);
  });

  test('returns string unchanged when it fits', () => {
    const str = 'hello\nworld\n';
    expect(fitToTokens(str, 1000, 'line-boundary')).toBe(str);
  });
});

describe('fitToTokens — skip policy', () => {
  test('returns null when string exceeds budget', () => {
    const str = 'a'.repeat(400); // 100 tokens
    expect(fitToTokens(str, 50, 'skip')).toBeNull();
  });

  test('returns string unchanged when it fits', () => {
    const str = 'hello';
    expect(fitToTokens(str, 100, 'skip')).toBe(str);
  });

  test('returns null for empty/null input', () => {
    expect(fitToTokens('', 100, 'skip')).toBeNull();
    expect(fitToTokens(null, 100, 'skip')).toBeNull();
  });
});

describe('exported constants', () => {
  test('DEFAULT_PER_FILE_TOKENS converts to 4 000 chars', () => {
    expect(DEFAULT_PER_FILE_TOKENS * 4).toBe(4_000);
  });

  test('DEFAULT_PER_TEST_FILE_TOKENS converts to 5 000 chars', () => {
    expect(DEFAULT_PER_TEST_FILE_TOKENS * 4).toBe(5_000);
  });

  test('DEFAULT_TOTAL_TOKENS converts to 30 000 chars', () => {
    expect(DEFAULT_TOTAL_TOKENS * 4).toBe(30_000);
  });
});
