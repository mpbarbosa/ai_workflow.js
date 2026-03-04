/**
 * Tests for src/utils/retry.js
 *
 * @jest-environment node
 */

import { jest } from '@jest/globals';
import {
  ErrorCategory,
  classifyError,
  shouldRetry,
  calculateDelay,
  withRetry,
} from '../../src/utils/retry.js';
import { ValidationError, ConfigurationError } from '../../src/utils/errors.js';

// ==============================================================================
// classifyError — pure function
// ==============================================================================

describe('classifyError — pure function', () => {
  test('returns FATAL for ValidationError', () => {
    expect(classifyError(new ValidationError('bad input'))).toBe(ErrorCategory.FATAL);
  });

  test('returns FATAL for ConfigurationError', () => {
    expect(classifyError(new ConfigurationError('bad config'))).toBe(ErrorCategory.FATAL);
  });

  test('returns FATAL for error with code VALIDATION_ERROR', () => {
    const err = Object.assign(new Error('x'), { code: 'VALIDATION_ERROR' });
    expect(classifyError(err)).toBe(ErrorCategory.FATAL);
  });

  test('returns FATAL for error with code CONFIG_ERROR', () => {
    const err = Object.assign(new Error('x'), { code: 'CONFIG_ERROR' });
    expect(classifyError(err)).toBe(ErrorCategory.FATAL);
  });

  test('returns TRANSIENT for ENOENT', () => {
    const err = Object.assign(new Error('no such file'), { code: 'ENOENT' });
    expect(classifyError(err)).toBe(ErrorCategory.TRANSIENT);
  });

  test('returns TRANSIENT for ECONNRESET', () => {
    const err = Object.assign(new Error('conn reset'), { code: 'ECONNRESET' });
    expect(classifyError(err)).toBe(ErrorCategory.TRANSIENT);
  });

  test('returns TRANSIENT for ETIMEDOUT', () => {
    const err = Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' });
    expect(classifyError(err)).toBe(ErrorCategory.TRANSIENT);
  });

  test('returns TRANSIENT for EPIPE', () => {
    const err = Object.assign(new Error('pipe'), { code: 'EPIPE' });
    expect(classifyError(err)).toBe(ErrorCategory.TRANSIENT);
  });

  test('returns TRANSIENT for EBUSY', () => {
    const err = Object.assign(new Error('busy'), { code: 'EBUSY' });
    expect(classifyError(err)).toBe(ErrorCategory.TRANSIENT);
  });

  test('returns TRANSIENT for HTTP 429', () => {
    const err = Object.assign(new Error('rate limit'), { status: 429 });
    expect(classifyError(err)).toBe(ErrorCategory.TRANSIENT);
  });

  test('returns TRANSIENT for HTTP 500', () => {
    const err = Object.assign(new Error('server error'), { status: 500 });
    expect(classifyError(err)).toBe(ErrorCategory.TRANSIENT);
  });

  test('returns TRANSIENT for HTTP 503', () => {
    const err = Object.assign(new Error('unavailable'), { status: 503 });
    expect(classifyError(err)).toBe(ErrorCategory.TRANSIENT);
  });

  test('returns TRANSIENT for "timeout" in message', () => {
    expect(classifyError(new Error('request timeout'))).toBe(ErrorCategory.TRANSIENT);
  });

  test('returns TRANSIENT for "timed out" in message', () => {
    expect(classifyError(new Error('operation timed out'))).toBe(ErrorCategory.TRANSIENT);
  });

  test('returns TRANSIENT for "rate limit" in message', () => {
    expect(classifyError(new Error('rate limit exceeded'))).toBe(ErrorCategory.TRANSIENT);
  });

  test('returns TRANSIENT for "too many requests" in message', () => {
    expect(classifyError(new Error('too many requests'))).toBe(ErrorCategory.TRANSIENT);
  });

  test('returns TRANSIENT for "network" in message', () => {
    expect(classifyError(new Error('network failure'))).toBe(ErrorCategory.TRANSIENT);
  });

  test('returns UNKNOWN for generic Error', () => {
    expect(classifyError(new Error('something else'))).toBe(ErrorCategory.UNKNOWN);
  });

  test('returns UNKNOWN for null', () => {
    expect(classifyError(null)).toBe(ErrorCategory.UNKNOWN);
  });

  test('returns UNKNOWN for non-object', () => {
    expect(classifyError('string error')).toBe(ErrorCategory.UNKNOWN);
  });
});

// ==============================================================================
// shouldRetry — pure function
// ==============================================================================

describe('shouldRetry — pure function', () => {
  test('returns true for TRANSIENT error within retry budget', () => {
    const err = Object.assign(new Error('conn'), { code: 'ECONNRESET' });
    expect(shouldRetry(err, 0, 3)).toBe(true);
    expect(shouldRetry(err, 2, 3)).toBe(true);
  });

  test('returns true for UNKNOWN error within retry budget', () => {
    expect(shouldRetry(new Error('mystery'), 0, 3)).toBe(true);
  });

  test('returns false for FATAL error at any attempt', () => {
    expect(shouldRetry(new ValidationError('bad'), 0, 3)).toBe(false);
    expect(shouldRetry(new ConfigurationError('bad'), 1, 3)).toBe(false);
  });

  test('returns false when attempt >= maxRetries', () => {
    const err = Object.assign(new Error('net'), { code: 'ENOENT' });
    expect(shouldRetry(err, 3, 3)).toBe(false);
    expect(shouldRetry(err, 5, 3)).toBe(false);
  });
});

// ==============================================================================
// calculateDelay — pure function
// ==============================================================================

describe('calculateDelay — pure function', () => {
  test('attempt 0 returns baseDelay', () => {
    expect(calculateDelay(0, 1000)).toBe(1000);
  });

  test('attempt 1 returns 2 * baseDelay', () => {
    expect(calculateDelay(1, 1000)).toBe(2000);
  });

  test('attempt 2 returns 4 * baseDelay', () => {
    expect(calculateDelay(2, 1000)).toBe(4000);
  });

  test('caps at maxDelay', () => {
    expect(calculateDelay(10, 1000, 5000)).toBe(5000);
  });

  test('default maxDelay is 30_000', () => {
    expect(calculateDelay(10, 1000)).toBe(30_000);
  });

  test('never returns negative value', () => {
    expect(calculateDelay(0, 0)).toBeGreaterThanOrEqual(0);
  });

  test('returns integer (rounded)', () => {
    const d = calculateDelay(1, 333);
    expect(Number.isInteger(d)).toBe(true);
  });
});

// ==============================================================================
// withRetry — impure wrapper
// ==============================================================================

describe('withRetry — impure wrapper', () => {
  // Synchronous sleep mock — resolves immediately to keep tests fast
  const instantSleep = () => Promise.resolve();

  test('returns result on first success', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, { sleep: instantSleep });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('retries on transient error and succeeds', async () => {
    const transientErr = Object.assign(new Error('net'), { code: 'ECONNRESET' });
    const fn = jest.fn().mockRejectedValueOnce(transientErr).mockResolvedValue('recovered');
    const result = await withRetry(fn, { maxRetries: 2, sleep: instantSleep });
    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test('exhausts all retries and throws last error', async () => {
    const transientErr = Object.assign(new Error('keep failing'), { code: 'ETIMEDOUT' });
    const fn = jest.fn().mockRejectedValue(transientErr);
    await expect(withRetry(fn, { maxRetries: 2, sleep: instantSleep })).rejects.toThrow(
      'keep failing'
    );
    expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  test('does not retry FATAL errors', async () => {
    const fatalErr = new ValidationError('invalid');
    const fn = jest.fn().mockRejectedValue(fatalErr);
    await expect(withRetry(fn, { maxRetries: 3, sleep: instantSleep })).rejects.toBeInstanceOf(
      ValidationError
    );
    expect(fn).toHaveBeenCalledTimes(1); // no retries
  });

  test('calls onRetry with error, attempt index, and delay', async () => {
    const transientErr = Object.assign(new Error('oops'), { code: 'EPIPE' });
    const fn = jest.fn().mockRejectedValueOnce(transientErr).mockResolvedValue('done');
    const onRetry = jest.fn();
    await withRetry(fn, { maxRetries: 3, baseDelay: 100, onRetry, sleep: instantSleep });
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry.mock.calls[0][0]).toBe(transientErr);
    expect(onRetry.mock.calls[0][1]).toBe(1); // attempt number (1-based for readability)
    expect(typeof onRetry.mock.calls[0][2]).toBe('number');
  });

  test('accepts a custom shouldRetryFn', async () => {
    const err = new Error('custom');
    const fn = jest.fn().mockRejectedValue(err);
    const neverRetry = () => false;
    await expect(
      withRetry(fn, { maxRetries: 5, shouldRetryFn: neverRetry, sleep: instantSleep })
    ).rejects.toThrow('custom');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('maxRetries: 0 means no retries', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('fail'));
    await expect(withRetry(fn, { maxRetries: 0, sleep: instantSleep })).rejects.toThrow('fail');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('uses custom sleep implementation', async () => {
    const sleepMock = jest.fn().mockResolvedValue(undefined);
    const transientErr = Object.assign(new Error('net'), { code: 'EAGAIN' });
    const fn = jest.fn().mockRejectedValueOnce(transientErr).mockResolvedValue('ok');
    await withRetry(fn, { maxRetries: 2, baseDelay: 1000, sleep: sleepMock });
    expect(sleepMock).toHaveBeenCalledTimes(1);
    expect(sleepMock).toHaveBeenCalledWith(1000);
  });

  test('succeeds on last possible retry', async () => {
    const transientErr = Object.assign(new Error('net'), { code: 'ENOENT' });
    const fn = jest
      .fn()
      .mockRejectedValueOnce(transientErr)
      .mockRejectedValueOnce(transientErr)
      .mockResolvedValue('finally');
    const result = await withRetry(fn, { maxRetries: 2, sleep: instantSleep });
    expect(result).toBe('finally');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  test('propagates non-Error rejections correctly', async () => {
    const fn = jest.fn().mockRejectedValue('string rejection');
    await expect(withRetry(fn, { maxRetries: 2, sleep: instantSleep })).rejects.toBe(
      'string rejection'
    );
  });
});
