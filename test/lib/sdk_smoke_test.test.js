/**
 * @fileoverview Tests for src/lib/sdk_smoke_test.js
 */

import { jest } from '@jest/globals';
import {
  buildSmokeTestPrompt,
  validateSmokeTestResponse,
  formatSmokeTestResult,
  runSdkSmokeTest,
} from '../../src/lib/sdk_smoke_test.js';

// ============================================================================
// Pure function tests
// ============================================================================

describe('buildSmokeTestPrompt', () => {
  test('returns a non-empty string', () => {
    const prompt = buildSmokeTestPrompt();
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(0);
  });

  test('is deterministic — same value every call', () => {
    expect(buildSmokeTestPrompt()).toBe(buildSmokeTestPrompt());
  });

  test('contains the expected probe phrase', () => {
    expect(buildSmokeTestPrompt()).toContain('ok');
  });
});

describe('validateSmokeTestResponse', () => {
  test('returns true for a response with non-empty content', () => {
    expect(validateSmokeTestResponse({ content: 'ok' })).toBe(true);
  });

  test('returns true for multi-word content', () => {
    expect(validateSmokeTestResponse({ content: 'Sure, ok!' })).toBe(true);
  });

  test('returns false for null', () => {
    expect(validateSmokeTestResponse(null)).toBe(false);
  });

  test('returns false for undefined', () => {
    expect(validateSmokeTestResponse(undefined)).toBe(false);
  });

  test('returns false for non-object', () => {
    expect(validateSmokeTestResponse('string')).toBe(false);
    expect(validateSmokeTestResponse(42)).toBe(false);
  });

  test('returns false when content is missing', () => {
    expect(validateSmokeTestResponse({})).toBe(false);
  });

  test('returns false when content is empty string', () => {
    expect(validateSmokeTestResponse({ content: '' })).toBe(false);
  });

  test('returns false when content is only whitespace', () => {
    expect(validateSmokeTestResponse({ content: '   ' })).toBe(false);
  });

  test('returns false when content is not a string', () => {
    expect(validateSmokeTestResponse({ content: 123 })).toBe(false);
    expect(validateSmokeTestResponse({ content: null })).toBe(false);
  });
});

describe('formatSmokeTestResult', () => {
  test('returns status "passed" on success', () => {
    const result = formatSmokeTestResult(true, 'All good');
    expect(result.status).toBe('passed');
  });

  test('returns status "failed" on failure', () => {
    const result = formatSmokeTestResult(false, 'Timeout');
    expect(result.status).toBe('failed');
  });

  test('includes the details string', () => {
    const result = formatSmokeTestResult(true, 'responded in 200ms');
    expect(result.details).toBe('responded in 200ms');
  });

  test('coerces non-string details to string', () => {
    const result = formatSmokeTestResult(false, 42);
    expect(result.details).toBe('42');
  });

  test('is deterministic', () => {
    expect(formatSmokeTestResult(true, 'x')).toEqual(formatSmokeTestResult(true, 'x'));
  });
});

// ============================================================================
// Integration tests — runSdkSmokeTest with injected AiHelper mock
// ============================================================================

/** Build a minimal AiHelper stub for a given test scenario. */
function makeMockHelper({ initResult = true, requestResult = null, requestError = null } = {}) {
  return {
    initialize: jest.fn().mockResolvedValue(initResult),
    executeRequest: requestError
      ? jest.fn().mockRejectedValue(requestError)
      : jest.fn().mockResolvedValue(requestResult),
    cleanup: jest.fn().mockResolvedValue(undefined),
  };
}

const silentLog = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  success: jest.fn(),
  debug: jest.fn(),
};

describe('runSdkSmokeTest', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns success when API responds with non-empty content', async () => {
    const helper = makeMockHelper({ requestResult: { content: 'ok' } });
    const result = await runSdkSmokeTest({ aiHelper: helper, logger: silentLog });

    expect(result.success).toBe(true);
    expect(result.status).toBe('passed');
    expect(result.response).toEqual({ content: 'ok' });
  });

  test('returns failure when SDK is not available', async () => {
    const helper = makeMockHelper({ initResult: false });
    const result = await runSdkSmokeTest({ aiHelper: helper, logger: silentLog });

    expect(result.success).toBe(false);
    expect(result.status).toBe('failed');
    expect(helper.executeRequest).not.toHaveBeenCalled();
  });

  test('returns failure when response has empty content', async () => {
    const helper = makeMockHelper({ requestResult: { content: '' } });
    const result = await runSdkSmokeTest({ aiHelper: helper, logger: silentLog });

    expect(result.success).toBe(false);
    expect(result.status).toBe('failed');
  });

  test('returns failure when executeRequest throws', async () => {
    const helper = makeMockHelper({ requestError: new Error('Timeout after 30000ms') });
    const result = await runSdkSmokeTest({ aiHelper: helper, logger: silentLog });

    expect(result.success).toBe(false);
    expect(result.details).toContain('Timeout after 30000ms');
  });

  test('always calls cleanup even when SDK is unavailable', async () => {
    const helper = makeMockHelper({ initResult: false });
    await runSdkSmokeTest({ aiHelper: helper, logger: silentLog });
    expect(helper.cleanup).toHaveBeenCalledTimes(1);
  });

  test('always calls cleanup even when executeRequest throws', async () => {
    const helper = makeMockHelper({ requestError: new Error('network error') });
    await runSdkSmokeTest({ aiHelper: helper, logger: silentLog });
    expect(helper.cleanup).toHaveBeenCalledTimes(1);
  });

  test('sends the exact smoke test prompt to executeRequest', async () => {
    const helper = makeMockHelper({ requestResult: { content: 'ok' } });
    await runSdkSmokeTest({ aiHelper: helper, logger: silentLog });

    expect(helper.executeRequest).toHaveBeenCalledWith(
      buildSmokeTestPrompt(),
      expect.objectContaining({ validate: false })
    );
  });
});
