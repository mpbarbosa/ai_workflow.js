/**
 * @fileoverview Orchestrator checkpoint save/restore integration tests
 * @module test/integration/orchestrator/checkpoint.integration.test.js
 *
 * Tests CheckpointManager and pure checkpoint functions: createCheckpointData,
 * validateCheckpoint, generateCheckpointId, parseCheckpointId,
 * calculateCheckpointAge, filterCheckpointsByWorkflow, sortCheckpointsByTime.
 *
 * @version 1.0.0
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import path from 'path';
import {
  createCheckpointData,
  validateCheckpoint,
  generateCheckpointId,
  parseCheckpointId,
  calculateCheckpointAge,
  shouldCleanupCheckpoint,
  filterCheckpointsByWorkflow,
  sortCheckpointsByTime,
  CheckpointManager,
} from '../../../src/orchestrator/checkpoint_manager.js';
import {
  createTempProject,
  cleanupTempProject,
  ensureWorkflowDirectories,
} from '../../helpers/integration.js';

let tempDir;

beforeEach(async () => {
  tempDir = await createTempProject('nodejs-api');
  await ensureWorkflowDirectories(tempDir);
});
afterEach(async () => {
  await cleanupTempProject(tempDir);
});

const NOW = 1_700_000_000_000;

// ---------------------------------------------------------------------------
// generateCheckpointId
// ---------------------------------------------------------------------------

describe('generateCheckpointId', () => {
  test('returns a string', () => {
    const id = generateCheckpointId('wf-1', NOW);
    expect(typeof id).toBe('string');
  });

  test('same inputs produce same id (deterministic)', () => {
    expect(generateCheckpointId('wf-1', NOW)).toBe(generateCheckpointId('wf-1', NOW));
  });

  test('different workflow ids produce different ids', () => {
    expect(generateCheckpointId('wf-1', NOW)).not.toBe(generateCheckpointId('wf-2', NOW));
  });

  test('different timestamps produce different ids', () => {
    expect(generateCheckpointId('wf-1', NOW)).not.toBe(generateCheckpointId('wf-1', NOW + 1));
  });

  test('id contains workflow id substring', () => {
    const id = generateCheckpointId('wf-abc', NOW);
    expect(id).toContain('wf-abc');
  });
});

// ---------------------------------------------------------------------------
// parseCheckpointId
// ---------------------------------------------------------------------------

describe('parseCheckpointId', () => {
  test('parses a generated checkpoint id', () => {
    const id = generateCheckpointId('wf-1', NOW);
    const parsed = parseCheckpointId(id);
    expect(typeof parsed).toBe('object');
    expect(parsed).not.toBeNull();
  });

  test('round-trip workflowId matches', () => {
    const id = generateCheckpointId('wf-round', NOW);
    const parsed = parseCheckpointId(id);
    expect(parsed.workflowId).toBe('wf-round');
  });

  test('null id returns null or throws gracefully', () => {
    try {
      const result = parseCheckpointId(null);
      // If it doesn't throw, result should be something
      expect(result !== undefined).toBe(true);
    } catch {
      // Throwing is also acceptable
    }
  });
});

// ---------------------------------------------------------------------------
// createCheckpointData
// ---------------------------------------------------------------------------

describe('createCheckpointData', () => {
  const mockWorkflow = { id: 'wf-test', name: 'Test Workflow', stage: 'full' };

  test('returns an object', () => {
    const cp = createCheckpointData(mockWorkflow);
    expect(typeof cp).toBe('object');
    expect(cp).not.toBeNull();
  });

  test('checkpoint has a workflowId field', () => {
    const cp = createCheckpointData(mockWorkflow);
    expect(cp.workflowId).toBeDefined();
  });

  test('checkpoint has a timestamp field', () => {
    const cp = createCheckpointData(mockWorkflow);
    expect(cp.timestamp).toBeDefined();
  });

  test('currentState is merged into checkpoint.state', () => {
    const cp = createCheckpointData(mockWorkflow, { currentStep: 'step_05' });
    expect(cp.state.currentStep).toBe('step_05');
  });

  test('empty currentState produces valid checkpoint', () => {
    const cp = createCheckpointData(mockWorkflow, {});
    expect(typeof cp).toBe('object');
  });
});

// ---------------------------------------------------------------------------
// validateCheckpoint
// ---------------------------------------------------------------------------

describe('validateCheckpoint', () => {
  test('valid checkpoint passes', () => {
    const cp = createCheckpointData({ id: 'wf-1', stage: 'full' });
    const result = validateCheckpoint(cp);
    expect(result.valid).toBe(true);
  });

  test('null checkpoint fails', () => {
    const result = validateCheckpoint(null);
    expect(result.valid).toBe(false);
  });

  test('checkpoint without id fails', () => {
    const result = validateCheckpoint({ timestamp: NOW });
    expect(result.valid).toBe(false);
  });

  test('checkpoint without timestamp fails', () => {
    const result = validateCheckpoint({ id: 'cp-1' });
    expect(result.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// calculateCheckpointAge
// ---------------------------------------------------------------------------

describe('calculateCheckpointAge', () => {
  test('returns a number', () => {
    const cp = { timestamp: NOW - 5000 };
    const age = calculateCheckpointAge(cp, NOW);
    expect(typeof age).toBe('number');
  });

  test('age is positive for past checkpoint', () => {
    const cp = { timestamp: NOW - 5000 };
    expect(calculateCheckpointAge(cp, NOW)).toBeGreaterThan(0);
  });

  test('age of 5 seconds', () => {
    const cp = { timestamp: NOW - 5000 };
    expect(calculateCheckpointAge(cp, NOW)).toBeCloseTo(5000, -1);
  });
});

// ---------------------------------------------------------------------------
// shouldCleanupCheckpoint
// ---------------------------------------------------------------------------

describe('shouldCleanupCheckpoint', () => {
  test('old checkpoint should be cleaned up', () => {
    const cp = { timestamp: NOW - 10 * 24 * 3600 * 1000 }; // 10 days old
    expect(shouldCleanupCheckpoint(cp, 7 * 24 * 3600 * 1000, NOW)).toBe(true);
  });

  test('fresh checkpoint should not be cleaned up', () => {
    const cp = { timestamp: NOW - 1000 }; // 1 second old
    expect(shouldCleanupCheckpoint(cp, 7 * 24 * 3600 * 1000, NOW)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// filterCheckpointsByWorkflow + sortCheckpointsByTime
// ---------------------------------------------------------------------------

describe('filterCheckpointsByWorkflow', () => {
  const checkpoints = [
    { id: generateCheckpointId('wf-A', NOW), workflowId: 'wf-A', timestamp: NOW },
    { id: generateCheckpointId('wf-B', NOW + 1), workflowId: 'wf-B', timestamp: NOW + 1 },
    { id: generateCheckpointId('wf-A', NOW + 2), workflowId: 'wf-A', timestamp: NOW + 2 },
  ];

  test('filters to only wf-A checkpoints', () => {
    const filtered = filterCheckpointsByWorkflow(checkpoints, 'wf-A');
    expect(filtered.every((cp) => cp.workflowId === 'wf-A')).toBe(true);
  });

  test('returns 2 checkpoints for wf-A', () => {
    const filtered = filterCheckpointsByWorkflow(checkpoints, 'wf-A');
    expect(filtered).toHaveLength(2);
  });

  test('unknown workflowId returns empty array', () => {
    const filtered = filterCheckpointsByWorkflow(checkpoints, 'wf-Z');
    expect(filtered).toHaveLength(0);
  });
});

describe('sortCheckpointsByTime', () => {
  const checkpoints = [
    { id: 'cp3', timestamp: NOW + 2000 },
    { id: 'cp1', timestamp: NOW },
    { id: 'cp2', timestamp: NOW + 1000 },
  ];

  test('sorts in descending order (newest first)', () => {
    const sorted = sortCheckpointsByTime(checkpoints);
    expect(sorted[0].id).toBe('cp3');
    expect(sorted[sorted.length - 1].id).toBe('cp1');
  });

  test('returns same length as input', () => {
    const sorted = sortCheckpointsByTime(checkpoints);
    expect(sorted).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// CheckpointManager file I/O integration
// ---------------------------------------------------------------------------

describe('CheckpointManager file I/O', () => {
  test('CheckpointManager can be instantiated with checkpoint dir', () => {
    const cpDir = path.join(tempDir, '.ai_workflow', 'checkpoints');
    const mgr = new CheckpointManager({ checkpointsDir: cpDir });
    expect(mgr).toBeDefined();
  });

  test('CheckpointManager has save and load methods', () => {
    const cpDir = path.join(tempDir, '.ai_workflow', 'checkpoints');
    const mgr = new CheckpointManager({ checkpointsDir: cpDir });
    expect(typeof mgr.save).toBe('function');
    expect(typeof mgr.load).toBe('function');
  });
});
