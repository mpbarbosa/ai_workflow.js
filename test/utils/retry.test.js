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
  test.each([
    ['ValidationError instance', new ValidationError('bad input')],
    ['ConfigurationError instance', new ConfigurationError('bad config')],
    ['code VALIDATION_ERROR', Object.assign(new Error('x'), { code: 'VALIDATION_ERROR' })],
    ['code CONFIG_ERROR', Object.assign(new Error('x'), { code: 'CONFIG_ERROR' })],
  ])('returns FATAL for %s', (_, err) => {
    expect(classifyError(err)).toBe(ErrorCategory.FATAL);
  });

  test.each([
    ['ENOENT', 'no such file'],
    ['ECONNRESET', 'conn reset'],
    ['ETIMEDOUT', 'timeout'],
    ['EPIPE', 'pipe'],
    ['EBUSY', 'busy'],
  ])('returns TRANSIENT for system code %s', (code, msg) => {
    const err = Object.assign(new Error(msg), { code });
    expect(classifyError(err)).toBe(ErrorCategory.TRANSIENT);
  });

  test.each([429, 500, 503])('returns TRANSIENT for HTTP status %i', (status) => {
    const err = Object.assign(new Error('http error'), { status });
    expect(classifyError(err)).toBe(ErrorCategory.TRANSIENT);
  });

  test.each([
    'request timeout',
    'operation timed out',
    'rate limit exceeded',
    'too many requests',
    'network failure',
  ])('returns TRANSIENT for message containing "%s"', (msg) => {
    expect(classifyError(new Error(msg))).toBe(ErrorCategory.TRANSIENT);
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
  test.each([
    [0, 1000, 1000],
    [1, 1000, 2000],
    [2, 1000, 4000],
  ])('attempt %i with baseDelay %i returns %i', (attempt, base, expected) => {
    expect(calculateDelay(attempt, base)).toBe(expected);
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
