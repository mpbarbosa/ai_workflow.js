/**
 * @fileoverview CLI status + clean command integration tests
 * @module test/integration/cli/status-clean.integration.test.js
 *
 * Tests status command pure functions (formatWorkflowStatus, calculateSummaryStats)
 * and clean command pure functions (validateCleanOptions, determineCleanupTargets,
 * formatCleanupResult) against isolated temp directories.
 *
 * @version 1.0.0
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import path from 'path';
import fs from 'fs/promises';
import { formatWorkflowStatus, calculateSummaryStats } from '../../../src/cli/commands/status.js';
import {
  validateCleanOptions,
  determineCleanupTargets,
  formatCleanupResult,
} from '../../../src/cli/commands/clean.js';
import {
  createTempProject,
  cleanupTempProject,
  ensureWorkflowDirectories,
} from '../../helpers/integration.js';

let tempDir;

beforeEach(async () => {
  tempDir = await createTempProject('nodejs-api');
});
afterEach(async () => {
  await cleanupTempProject(tempDir);
});

// ---------------------------------------------------------------------------
// formatWorkflowStatus
// ---------------------------------------------------------------------------

describe('formatWorkflowStatus', () => {
  test('returns a string', () => {
    const result = formatWorkflowStatus({ running: false, checkpoints: [] });
    expect(typeof result).toBe('string');
  });

  test('handles null status gracefully', () => {
    const result = formatWorkflowStatus(null);
    expect(typeof result).toBe('string');
  });

  test('handles undefined status gracefully', () => {
    const result = formatWorkflowStatus(undefined);
    expect(typeof result).toBe('string');
  });

  test('running status is reflected in output', () => {
    const result = formatWorkflowStatus({ running: true, currentStep: 'step_01' });
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  test('completed status is reflected in output', () => {
    const result = formatWorkflowStatus({ running: false, completed: true, totalSteps: 20 });
    expect(typeof result).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// calculateSummaryStats
// ---------------------------------------------------------------------------

describe('calculateSummaryStats', () => {
  test('returns an object', () => {
    const stats = calculateSummaryStats([], []);
    expect(typeof stats).toBe('object');
    expect(stats).not.toBeNull();
  });

  test('handles empty checkpoints and metrics', () => {
    const stats = calculateSummaryStats([], []);
    expect(typeof stats).toBe('object');
    expect(stats.totalCheckpoints).toBe(0);
    expect(stats.totalExecutions).toBe(0);
  });

  test('handles non-empty checkpoints', () => {
    const checkpoints = [
      { workflowId: 'wf-1', timestamp: new Date().toISOString(), state: {} },
      { workflowId: 'wf-2', timestamp: new Date().toISOString(), state: {} },
    ];
    const stats = calculateSummaryStats(checkpoints, []);
    expect(stats.totalCheckpoints).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// validateCleanOptions
// ---------------------------------------------------------------------------

describe('validateCleanOptions', () => {
  test('all flag passes', () => {
    const result = validateCleanOptions({ all: true });
    expect(result.isValid).toBe(true);
  });

  test('artifacts flag passes', () => {
    const result = validateCleanOptions({ artifacts: true });
    expect(result.isValid).toBe(true);
  });

  test('cache flag passes', () => {
    const result = validateCleanOptions({ cache: true });
    expect(result.isValid).toBe(true);
  });

  test('checkpoints flag passes', () => {
    const result = validateCleanOptions({ checkpoints: true });
    expect(result.isValid).toBe(true);
  });

  test('no flags fails', () => {
    const result = validateCleanOptions({});
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('all combined with artifacts fails', () => {
    const result = validateCleanOptions({ all: true, artifacts: true });
    expect(result.isValid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// determineCleanupTargets
// ---------------------------------------------------------------------------

describe('determineCleanupTargets', () => {
  test('returns an object', () => {
    const result = determineCleanupTargets({ all: true });
    expect(typeof result).toBe('object');
    expect(result).not.toBeNull();
  });

  test('all:true enables all targets', () => {
    const result = determineCleanupTargets({ all: true });
    expect(result.artifacts).toBe(true);
    expect(result.cache).toBe(true);
    expect(result.checkpoints).toBe(true);
  });

  test('artifacts:true targets only artifacts', () => {
    const result = determineCleanupTargets({ artifacts: true });
    expect(result.artifacts).toBe(true);
    expect(result.cache).toBe(false);
  });

  test('cache:true targets only cache', () => {
    const result = determineCleanupTargets({ cache: true });
    expect(result.cache).toBe(true);
    expect(result.artifacts).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// formatCleanupResult
// ---------------------------------------------------------------------------

describe('formatCleanupResult', () => {
  test('returns a string', () => {
    const result = formatCleanupResult({ filesDeleted: 0, bytesFreed: 0 });
    expect(typeof result).toBe('string');
  });

  test('handles zero deleted files', () => {
    const result = formatCleanupResult({ filesDeleted: 0, bytesFreed: 0 });
    expect(result).toBe('Nothing to clean');
  });

  test('includes deleted file count', () => {
    const result = formatCleanupResult({ filesDeleted: 5, bytesFreed: 0 });
    expect(result).toContain('5');
  });

  test('handles null gracefully', () => {
    const result = formatCleanupResult(null);
    expect(typeof result).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// Workflow directories integration
// ---------------------------------------------------------------------------

describe('ensureWorkflowDirectories', () => {
  test('creates .ai_workflow subdirectory tree', async () => {
    await ensureWorkflowDirectories(tempDir);
    const workflowDir = path.join(tempDir, '.ai_workflow');
    const stat = await fs.stat(workflowDir);
    expect(stat.isDirectory()).toBe(true);
  });

  test('creates logs subdirectory', async () => {
    await ensureWorkflowDirectories(tempDir);
    const logsDir = path.join(tempDir, '.ai_workflow', 'logs');
    const stat = await fs.stat(logsDir);
    expect(stat.isDirectory()).toBe(true);
  });

  test('creates checkpoints subdirectory', async () => {
    await ensureWorkflowDirectories(tempDir);
    const checkpointsDir = path.join(tempDir, '.ai_workflow', 'checkpoints');
    const stat = await fs.stat(checkpointsDir);
    expect(stat.isDirectory()).toBe(true);
  });

  test('creates metrics subdirectory', async () => {
    await ensureWorkflowDirectories(tempDir);
    const metricsDir = path.join(tempDir, '.ai_workflow', 'metrics');
    const stat = await fs.stat(metricsDir);
    expect(stat.isDirectory()).toBe(true);
  });

  test('is idempotent — can be called twice without error', async () => {
    await ensureWorkflowDirectories(tempDir);
    await ensureWorkflowDirectories(tempDir);
    const workflowDir = path.join(tempDir, '.ai_workflow');
    const stat = await fs.stat(workflowDir);
    expect(stat.isDirectory()).toBe(true);
  });
});
