/**
 * @fileoverview Tests for CLI Resume Command
 * @module test/cli/commands/resume.test
 */

import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import {
  resumeCommand,
  validateResumeOptions,
  formatCheckpoint,
  formatCheckpointList,
} from '../../../src/cli/commands/resume.js';
import type {
  ResumeCommandOptions,
  ResumeCheckpoint,
} from '../../../src/cli/commands/resume.js';
import { logger } from '../../../src/core/logger.js';

type ProcessExitSpy = jest.SpiedFunction<typeof process.exit>;

const mockProcessExit = (): never => {
  throw new Error('process.exit');
};

const noop = (): void => {};

describe('Resume Command - Pure Functions', () => {
  describe('validateResumeOptions', () => {
    test('should be valid with checkpoint ID', () => {
      const options: ResumeCommandOptions = {};
      const result = validateResumeOptions(options, 'checkpoint-123');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should be valid with --latest flag', () => {
      const options: ResumeCommandOptions = { latest: true };
      const result = validateResumeOptions(options, null);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should be valid with --list flag', () => {
      const options: ResumeCommandOptions = { list: true };
      const result = validateResumeOptions(options, null);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should be invalid without checkpoint ID or flags', () => {
      const options: ResumeCommandOptions = {};
      const result = validateResumeOptions(options, null);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Must specify checkpoint ID, use --latest, or use --list');
    });

    test('should be invalid with both --list and --latest', () => {
      const options: ResumeCommandOptions = { list: true, latest: true };
      const result = validateResumeOptions(options, null);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Cannot use both --list and --latest');
    });

    test('should be invalid with checkpoint ID and --list', () => {
      const options: ResumeCommandOptions = { list: true };
      const result = validateResumeOptions(options, 'checkpoint-123');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Cannot specify checkpoint ID with --list or --latest');
    });
  });

  describe('formatCheckpoint', () => {
    test('should format valid checkpoint', () => {
      const checkpoint: ResumeCheckpoint = {
        workflowId: 'wf-123',
        timestamp: new Date('2026-01-15T10:00:00Z').getTime(),
        state: { completedSteps: ['step1', 'step2'] },
        metadata: { totalSteps: 10, progress: 20 },
      };

      const formatted = formatCheckpoint(checkpoint);
      expect(formatted).toContain('wf-123');
      expect(formatted).toContain('2/10 steps');
      expect(formatted).toContain('20% complete');
    });

    test('should handle checkpoint without metadata', () => {
      const checkpoint: ResumeCheckpoint = {
        workflowId: 'wf-456',
        timestamp: Date.now(),
        state: { completedSteps: [] },
      };

      const formatted = formatCheckpoint(checkpoint);
      expect(formatted).toContain('wf-456');
      expect(formatted).toContain('0/0 steps');
    });

    test('should handle invalid checkpoint', () => {
      const result = formatCheckpoint(null);
      expect(result).toBe('Invalid checkpoint');
    });
  });

  describe('formatCheckpointList', () => {
    test('should format checkpoint list', () => {
      const checkpoints: ResumeCheckpoint[] = [
        {
          workflowId: 'wf-1',
          timestamp: Date.now(),
          state: { completedSteps: [] },
          metadata: {},
        },
        {
          workflowId: 'wf-2',
          timestamp: Date.now(),
          state: { completedSteps: [] },
          metadata: {},
        },
      ];

      const formatted = formatCheckpointList(checkpoints);
      expect(formatted).toContain('Available checkpoints:');
      expect(formatted).toContain('wf-1');
      expect(formatted).toContain('wf-2');
    });

    test('should handle empty list', () => {
      const result = formatCheckpointList([]);
      expect(result).toBe('No checkpoints found');
    });

    test('should handle null list', () => {
      const result = formatCheckpointList(null);
      expect(result).toBe('No checkpoints found');
    });
  });
});

describe('resumeCommand (impure wrapper)', () => {
  let exitSpy: ProcessExitSpy;

  beforeEach(() => {
    exitSpy = jest.spyOn(process, 'exit').mockImplementation(mockProcessExit);
    jest.spyOn(logger, 'error').mockImplementation(noop);
    jest.spyOn(console, 'log').mockImplementation(noop);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('exits with code 1 when no checkpointId and no flags provided', async () => {
    await expect(resumeCommand(null, {})).rejects.toThrow('process.exit');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  test('exits with code 1 when both --list and --latest are set', async () => {
    await expect(resumeCommand(null, { list: true, latest: true })).rejects.toThrow(
      'process.exit'
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  test('exits with code 1 when checkpointId is provided with --list', async () => {
    await expect(resumeCommand('cp-123', { list: true })).rejects.toThrow('process.exit');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
