/**
 * @fileoverview Tests for CLI Clean Command
 * @module test/cli/commands/clean.test
 */

import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import {
  cleanCommand,
  validateCleanOptions,
  determineCleanupTargets,
  formatCleanupResult,
} from '../../../src/cli/commands/clean.js';
import type { CleanCommandOptions, CleanupResult } from '../../../src/cli/commands/clean.js';
import { logger } from '../../../src/core/logger.js';

type ProcessExitSpy = jest.SpiedFunction<typeof process.exit>;

const mockProcessExit = (): never => {
  throw new Error('process.exit');
};

const noop = (): void => {};

describe('Clean Command - Pure Functions', () => {
  describe('validateCleanOptions', () => {
    test('should be valid with --all', () => {
      const options: CleanCommandOptions = { all: true };
      const result = validateCleanOptions(options);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should be valid with --artifacts', () => {
      const options: CleanCommandOptions = { artifacts: true };
      const result = validateCleanOptions(options);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should be invalid with no options', () => {
      const options: CleanCommandOptions = {};
      const result = validateCleanOptions(options);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Must specify at least one cleanup option (--all, --artifacts, --cache, --checkpoints)'
      );
    });

    test('should be invalid with --all and other flags', () => {
      const options: CleanCommandOptions = { all: true, artifacts: true };
      const result = validateCleanOptions(options);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Cannot use --all with other flags');
    });
  });

  describe('determineCleanupTargets', () => {
    test('should return all targets with --all', () => {
      const options: CleanCommandOptions = { all: true };
      const targets = determineCleanupTargets(options);
      expect(targets.artifacts).toBe(true);
      expect(targets.cache).toBe(true);
      expect(targets.checkpoints).toBe(true);
      expect(targets.sessions).toBe(true);
      expect(targets.metrics).toBe(true);
    });

    test('should return specific targets', () => {
      const options: CleanCommandOptions = { artifacts: true, cache: true };
      const targets = determineCleanupTargets(options);
      expect(targets.artifacts).toBe(true);
      expect(targets.cache).toBe(true);
      expect(targets.checkpoints).toBe(false);
      expect(targets.sessions).toBe(false);
      expect(targets.metrics).toBe(false);
    });

    test('should return false for unspecified targets', () => {
      const options: CleanCommandOptions = { artifacts: true };
      const targets = determineCleanupTargets(options);
      expect(targets.artifacts).toBe(true);
      expect(targets.cache).toBe(false);
    });
  });

  describe('formatCleanupResult', () => {
    test('should format result with files and bytes', () => {
      const result: CleanupResult = {
        filesDeleted: 5,
        bytesFreed: 1024 * 1024 * 10, // 10 MB
      };

      const formatted = formatCleanupResult(result);
      expect(formatted).toContain('5 file(s)');
      expect(formatted).toContain('10.00 MB');
    });

    test('should handle zero results', () => {
      const result: CleanupResult = {
        filesDeleted: 0,
        bytesFreed: 0,
      };

      const formatted = formatCleanupResult(result);
      expect(formatted).toBe('Nothing to clean');
    });

    test('should handle null result', () => {
      const formatted = formatCleanupResult(null);
      expect(formatted).toBe('No cleanup result');
    });
  });
});

describe('cleanCommand (impure wrapper)', () => {
  let exitSpy: ProcessExitSpy;

  beforeEach(() => {
    exitSpy = jest.spyOn(process, 'exit').mockImplementation(mockProcessExit);
    jest.spyOn(logger, 'error').mockImplementation(noop);
    jest.spyOn(console, 'log').mockImplementation(noop);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('exits with code 1 when no cleanup target is specified', async () => {
    await expect(cleanCommand({})).rejects.toThrow('process.exit');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  test('exits with code 1 when --all is combined with another flag', async () => {
    await expect(cleanCommand({ all: true, cache: true })).rejects.toThrow('process.exit');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
