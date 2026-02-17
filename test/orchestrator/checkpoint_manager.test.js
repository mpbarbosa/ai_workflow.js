/**
 * @fileoverview Tests for checkpoint_manager.js
 * @module test/orchestrator/checkpoint_manager
 */

import fs from 'fs/promises';
import path from 'path';
import {
  createCheckpointData,
  validateCheckpoint,
  mergeCheckpointState,
  calculateCheckpointAge,
  shouldCleanupCheckpoint,
  generateCheckpointId,
  parseCheckpointId,
  filterCheckpointsByWorkflow,
  sortCheckpointsByTime,
  CheckpointManager,
} from '../../src/orchestrator/checkpoint_manager.js';
import { ValidationError, SystemError } from '../../src/utils/errors.js';

// Test directory
const TEST_DIR = '.ai_workflow/checkpoints/test';

describe('checkpoint_manager - Pure Functions', () => {
  describe('createCheckpointData', () => {
    test('creates checkpoint with minimal workflow', () => {
      const workflow = { id: 'test-wf', name: 'Test Workflow' };
      const state = { timestamp: 1000 };

      const result = createCheckpointData(workflow, state);

      expect(result.version).toBe('1.0.0');
      expect(result.workflowId).toBe('test-wf');
      expect(result.timestamp).toBe(1000);
      expect(result.state).toEqual({
        currentStep: null,
        completedSteps: [],
        failedSteps: [],
        skippedSteps: [],
        results: {},
        context: {},
      });
    });

    test('creates checkpoint with full state', () => {
      const workflow = { id: 'test-wf', version: '2.0.0', steps: [1, 2, 3] };
      const state = {
        timestamp: 2000,
        currentStep: 'step2',
        completedSteps: ['step1'],
        failedSteps: ['step0'],
        skippedSteps: ['step3'],
        results: { step1: 'success' },
        context: { user: 'test' },
        progress: 50,
        metadata: { custom: 'value' },
      };

      const result = createCheckpointData(workflow, state);

      expect(result.workflowVersion).toBe('2.0.0');
      expect(result.state.currentStep).toBe('step2');
      expect(result.state.completedSteps).toEqual(['step1']);
      expect(result.state.failedSteps).toEqual(['step0']);
      expect(result.state.skippedSteps).toEqual(['step3']);
      expect(result.state.results).toEqual({ step1: 'success' });
      expect(result.state.context).toEqual({ user: 'test' });
      expect(result.metadata.totalSteps).toBe(3);
      expect(result.metadata.progress).toBe(50);
      expect(result.metadata.custom).toBe('value');
    });

    test('uses workflow name as ID if no id field', () => {
      const workflow = { name: 'My Workflow' };

      const result = createCheckpointData(workflow, {});

      expect(result.workflowId).toBe('My Workflow');
    });

    test('defaults to empty state when no state provided', () => {
      const workflow = { id: 'test' };

      const result = createCheckpointData(workflow);

      expect(result.state.completedSteps).toEqual([]);
      expect(result.state.results).toEqual({});
    });
  });

  describe('validateCheckpoint', () => {
    test('validates valid checkpoint', () => {
      const checkpoint = {
        version: '1.0.0',
        workflowId: 'test',
        timestamp: 1000,
        state: {
          completedSteps: [],
          results: {},
        },
      };

      const result = validateCheckpoint(checkpoint);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('rejects null checkpoint', () => {
      const result = validateCheckpoint(null);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Checkpoint data must be an object');
    });

    test('rejects non-object checkpoint', () => {
      const result = validateCheckpoint('not-an-object');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Checkpoint data must be an object');
    });

    test('rejects checkpoint without version', () => {
      const checkpoint = { workflowId: 'test', timestamp: 1000, state: {} };

      const result = validateCheckpoint(checkpoint);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing checkpoint version');
    });

    test('rejects checkpoint without workflowId', () => {
      const checkpoint = { version: '1.0.0', timestamp: 1000, state: {} };

      const result = validateCheckpoint(checkpoint);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing workflow ID');
    });

    test('rejects checkpoint without timestamp', () => {
      const checkpoint = { version: '1.0.0', workflowId: 'test', state: {} };

      const result = validateCheckpoint(checkpoint);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing timestamp');
    });

    test('rejects checkpoint without state', () => {
      const checkpoint = { version: '1.0.0', workflowId: 'test', timestamp: 1000 };

      const result = validateCheckpoint(checkpoint);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing or invalid state object');
    });

    test('rejects checkpoint with non-array completedSteps', () => {
      const checkpoint = {
        version: '1.0.0',
        workflowId: 'test',
        timestamp: 1000,
        state: { completedSteps: 'not-array' },
      };

      const result = validateCheckpoint(checkpoint);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('completedSteps must be an array');
    });

    test('rejects checkpoint with non-object results', () => {
      const checkpoint = {
        version: '1.0.0',
        workflowId: 'test',
        timestamp: 1000,
        state: { completedSteps: [], results: 'not-object' },
      };

      const result = validateCheckpoint(checkpoint);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('results must be an object');
    });

    test('collects multiple errors', () => {
      const checkpoint = { state: { completedSteps: 'not-array', results: 'not-object' } };

      const result = validateCheckpoint(checkpoint);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(3);
    });
  });

  describe('mergeCheckpointState', () => {
    test('merges empty states', () => {
      const result = mergeCheckpointState({}, {});

      expect(result).toEqual({
        completedSteps: [],
        failedSteps: [],
        skippedSteps: [],
        results: {},
        context: {},
      });
    });

    test('prefers saved currentStep over current', () => {
      const current = { currentStep: 'step2' };
      const saved = { currentStep: 'step1' };

      const result = mergeCheckpointState(current, saved);

      expect(result.currentStep).toBe('step1');
    });

    test('concatenates completedSteps arrays', () => {
      const current = { completedSteps: ['step3'] };
      const saved = { completedSteps: ['step1', 'step2'] };

      const result = mergeCheckpointState(current, saved);

      expect(result.completedSteps).toEqual(['step1', 'step2', 'step3']);
    });

    test('concatenates failedSteps arrays', () => {
      const current = { failedSteps: ['step4'] };
      const saved = { failedSteps: ['step2'] };

      const result = mergeCheckpointState(current, saved);

      expect(result.failedSteps).toEqual(['step2', 'step4']);
    });

    test('concatenates skippedSteps arrays', () => {
      const current = { skippedSteps: ['step5'] };
      const saved = { skippedSteps: ['step3'] };

      const result = mergeCheckpointState(current, saved);

      expect(result.skippedSteps).toEqual(['step3', 'step5']);
    });

    test('merges results with current overriding saved', () => {
      const current = { results: { step1: 'new', step3: 'current' } };
      const saved = { results: { step1: 'old', step2: 'saved' } };

      const result = mergeCheckpointState(current, saved);

      expect(result.results).toEqual({
        step1: 'new',
        step2: 'saved',
        step3: 'current',
      });
    });

    test('merges context with current overriding saved', () => {
      const current = { context: { key1: 'new', key3: 'current' } };
      const saved = { context: { key1: 'old', key2: 'saved' } };

      const result = mergeCheckpointState(current, saved);

      expect(result.context).toEqual({
        key1: 'new',
        key2: 'saved',
        key3: 'current',
      });
    });

    test('preserves other current state properties', () => {
      const current = { custom: 'value', extra: 123 };
      const saved = { completedSteps: ['step1'] };

      const result = mergeCheckpointState(current, saved);

      expect(result.custom).toBe('value');
      expect(result.extra).toBe(123);
    });
  });

  describe('calculateCheckpointAge', () => {
    test('calculates age in milliseconds', () => {
      const checkpoint = { timestamp: 1000 };
      const now = 5000;

      const result = calculateCheckpointAge(checkpoint, now);

      expect(result).toBe(4000);
    });

    test('returns Infinity for checkpoint without timestamp', () => {
      const checkpoint = {};
      const now = 5000;

      const result = calculateCheckpointAge(checkpoint, now);

      expect(result).toBe(Infinity);
    });

    test('handles zero timestamp', () => {
      const checkpoint = { timestamp: 0 };
      const now = 1000;

      const result = calculateCheckpointAge(checkpoint, now);

      expect(result).toBe(1000);
    });

    test('handles same timestamp as now', () => {
      const checkpoint = { timestamp: 5000 };
      const now = 5000;

      const result = calculateCheckpointAge(checkpoint, now);

      expect(result).toBe(0);
    });
  });

  describe('shouldCleanupCheckpoint', () => {
    test('returns true if age exceeds maxAge', () => {
      const checkpoint = { timestamp: 1000 };
      const maxAge = 1000;
      const now = 3000;

      const result = shouldCleanupCheckpoint(checkpoint, maxAge, now);

      expect(result).toBe(true);
    });

    test('returns true if age equals maxAge', () => {
      const checkpoint = { timestamp: 1000 };
      const maxAge = 1000;
      const now = 2000;

      const result = shouldCleanupCheckpoint(checkpoint, maxAge, now);

      expect(result).toBe(true);
    });

    test('returns false if age is less than maxAge', () => {
      const checkpoint = { timestamp: 1000 };
      const maxAge = 2000;
      const now = 2999;

      const result = shouldCleanupCheckpoint(checkpoint, maxAge, now);

      expect(result).toBe(false);
    });

    test('returns true for checkpoint without timestamp', () => {
      const checkpoint = {};
      const maxAge = 1000;
      const now = 5000;

      const result = shouldCleanupCheckpoint(checkpoint, maxAge, now);

      expect(result).toBe(true);
    });
  });

  describe('generateCheckpointId', () => {
    test('generates ID from workflow and timestamp', () => {
      const result = generateCheckpointId('my-workflow', 1234567890);

      expect(result).toBe('my-workflow-1234567890');
    });

    test('handles workflow IDs with hyphens', () => {
      const result = generateCheckpointId('my-complex-workflow-id', 1000);

      expect(result).toBe('my-complex-workflow-id-1000');
    });
  });

  describe('parseCheckpointId', () => {
    test('parses checkpoint ID', () => {
      const result = parseCheckpointId('my-workflow-1234567890');

      expect(result).toEqual({
        workflowId: 'my-workflow',
        timestamp: 1234567890,
      });
    });

    test('handles workflow IDs with multiple hyphens', () => {
      const result = parseCheckpointId('my-complex-workflow-1000');

      expect(result).toEqual({
        workflowId: 'my-complex-workflow',
        timestamp: 1000,
      });
    });

    test('handles ID without timestamp', () => {
      const result = parseCheckpointId('simple');

      expect(result).toEqual({
        workflowId: 'simple',
        timestamp: null,
      });
    });

    test('handles invalid timestamp', () => {
      const result = parseCheckpointId('workflow-abc');

      expect(result).toEqual({
        workflowId: 'workflow-abc',
        timestamp: null,
      });
    });
  });

  describe('filterCheckpointsByWorkflow', () => {
    test('filters checkpoints by workflowId', () => {
      const checkpoints = [
        { workflowId: 'wf1', timestamp: 1000 },
        { workflowId: 'wf2', timestamp: 2000 },
        { workflowId: 'wf1', timestamp: 3000 },
      ];

      const result = filterCheckpointsByWorkflow(checkpoints, 'wf1');

      expect(result).toHaveLength(2);
      expect(result[0].workflowId).toBe('wf1');
      expect(result[1].workflowId).toBe('wf1');
    });

    test('returns empty array if no matches', () => {
      const checkpoints = [{ workflowId: 'wf1', timestamp: 1000 }];

      const result = filterCheckpointsByWorkflow(checkpoints, 'wf2');

      expect(result).toEqual([]);
    });

    test('returns empty array for empty input', () => {
      const result = filterCheckpointsByWorkflow([], 'wf1');

      expect(result).toEqual([]);
    });
  });

  describe('sortCheckpointsByTime', () => {
    test('sorts checkpoints by timestamp descending', () => {
      const checkpoints = [{ timestamp: 1000 }, { timestamp: 3000 }, { timestamp: 2000 }];

      const result = sortCheckpointsByTime(checkpoints);

      expect(result[0].timestamp).toBe(3000);
      expect(result[1].timestamp).toBe(2000);
      expect(result[2].timestamp).toBe(1000);
    });

    test('does not mutate original array', () => {
      const checkpoints = [{ timestamp: 1000 }, { timestamp: 2000 }];
      const original = [...checkpoints];

      sortCheckpointsByTime(checkpoints);

      expect(checkpoints).toEqual(original);
    });

    test('handles empty array', () => {
      const result = sortCheckpointsByTime([]);

      expect(result).toEqual([]);
    });

    test('handles single checkpoint', () => {
      const checkpoints = [{ timestamp: 1000 }];

      const result = sortCheckpointsByTime(checkpoints);

      expect(result).toEqual(checkpoints);
    });
  });
});

describe('checkpoint_manager - CheckpointManager Class', () => {
  let manager;

  beforeEach(async () => {
    // Clean up before test to ensure isolation
    try {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    // Small delay to ensure filesystem cleanup completes
    await new Promise((resolve) => setTimeout(resolve, 10));

    manager = new CheckpointManager({ checkpointDir: TEST_DIR, autoCleanup: false });
    await fs.mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('constructor', () => {
    test('creates manager with default options', () => {
      const mgr = new CheckpointManager();

      expect(mgr.options.checkpointDir).toBe('.ai_workflow/checkpoints');
      expect(mgr.options.maxAge).toBe(7 * 24 * 60 * 60 * 1000);
      expect(mgr.options.autoCleanup).toBe(true);
    });

    test('creates manager with custom options', () => {
      const mgr = new CheckpointManager({
        checkpointDir: '/custom/path',
        maxAge: 1000,
        autoCleanup: false,
      });

      expect(mgr.options.checkpointDir).toBe('/custom/path');
      expect(mgr.options.maxAge).toBe(1000);
      expect(mgr.options.autoCleanup).toBe(false);
    });
  });

  describe('save', () => {
    test('saves checkpoint to file', async () => {
      const workflow = { id: 'test-wf', name: 'Test' };
      const state = { currentStep: 'step1', completedSteps: [] };

      const checkpointId = await manager.save(workflow, state);

      expect(checkpointId).toMatch(/^test-wf-\d+$/);

      const files = await fs.readdir(TEST_DIR);
      expect(files).toContain(`${checkpointId}.json`);
    });

    test('saves checkpoint with valid JSON', async () => {
      const workflow = { id: 'test-wf' };
      const state = { currentStep: 'step1' };

      const checkpointId = await manager.save(workflow, state);

      const filePath = path.join(TEST_DIR, `${checkpointId}.json`);
      const content = await fs.readFile(filePath, 'utf8');
      const checkpoint = JSON.parse(content);

      expect(checkpoint.workflowId).toBe('test-wf');
      expect(checkpoint.state.currentStep).toBe('step1');
    });

    test('throws ValidationError for invalid checkpoint', async () => {
      const workflow = {}; // Missing id

      await expect(manager.save(workflow, {})).rejects.toThrow(ValidationError);
    });

    test('creates checkpoint directory if not exists', async () => {
      await fs.rm(TEST_DIR, { recursive: true, force: true });

      const workflow = { id: 'test-wf' };
      await manager.save(workflow, {});

      const stats = await fs.stat(TEST_DIR);
      expect(stats.isDirectory()).toBe(true);
    });
  });

  describe('load', () => {
    test('loads checkpoint from file', async () => {
      const workflow = { id: 'test-wf' };
      const state = { currentStep: 'step1', completedSteps: ['step0'] };
      const checkpointId = await manager.save(workflow, state);

      const checkpoint = await manager.load(checkpointId);

      expect(checkpoint.workflowId).toBe('test-wf');
      expect(checkpoint.state.currentStep).toBe('step1');
      expect(checkpoint.state.completedSteps).toEqual(['step0']);
    });

    test('throws ValidationError for non-existent checkpoint', async () => {
      await expect(manager.load('non-existent')).rejects.toThrow(ValidationError);
      await expect(manager.load('non-existent')).rejects.toThrow('Checkpoint not found');
    });

    test('throws ValidationError for invalid checkpoint JSON', async () => {
      const checkpointId = 'invalid-checkpoint';
      const filePath = path.join(TEST_DIR, `${checkpointId}.json`);
      await fs.writeFile(filePath, 'invalid json', 'utf8');

      await expect(manager.load(checkpointId)).rejects.toThrow(SystemError);
    });

    test('validates loaded checkpoint', async () => {
      const checkpointId = 'test-checkpoint';
      const filePath = path.join(TEST_DIR, `${checkpointId}.json`);
      await fs.writeFile(filePath, JSON.stringify({ invalid: 'checkpoint' }), 'utf8');

      await expect(manager.load(checkpointId)).rejects.toThrow(ValidationError);
    });
  });

  describe('list', () => {
    test('lists all checkpoints', async () => {
      await manager.save({ id: 'wf1' }, { currentStep: 'step1' });
      await manager.save({ id: 'wf2' }, { currentStep: 'step2' });

      const checkpoints = await manager.list();

      expect(checkpoints).toHaveLength(2);
      expect(checkpoints[0]).toHaveProperty('id');
      expect(checkpoints[0]).toHaveProperty('workflowId');
      expect(checkpoints[0]).toHaveProperty('timestamp');
    });

    test('filters checkpoints by workflowId', async () => {
      // Add small delays to ensure unique timestamps
      await manager.save({ id: 'wf1' }, { timestamp: Date.now() });
      await new Promise((resolve) => setTimeout(resolve, 5));
      await manager.save({ id: 'wf2' }, { timestamp: Date.now() });
      await new Promise((resolve) => setTimeout(resolve, 5));
      await manager.save({ id: 'wf1' }, { timestamp: Date.now() });

      const checkpoints = await manager.list({ workflowId: 'wf1' });

      expect(checkpoints).toHaveLength(2);
      expect(checkpoints.every((cp) => cp.workflowId === 'wf1')).toBe(true);
    });

    test('sorts checkpoints by time (newest first)', async () => {
      await manager.save({ id: 'wf1' }, { timestamp: 1000 });
      await new Promise((resolve) => setTimeout(resolve, 10));
      await manager.save({ id: 'wf1' }, { timestamp: 2000 });

      const checkpoints = await manager.list();

      expect(checkpoints[0].timestamp).toBeGreaterThan(checkpoints[1].timestamp);
    });

    test('returns empty array for empty directory', async () => {
      const checkpoints = await manager.list();

      expect(checkpoints).toEqual([]);
    });

    test('skips non-JSON files', async () => {
      await manager.save({ id: 'wf1' }, {});
      await fs.writeFile(path.join(TEST_DIR, 'not-json.txt'), 'test', 'utf8');

      const checkpoints = await manager.list();

      expect(checkpoints).toHaveLength(1);
    });

    test('skips invalid checkpoint files', async () => {
      await manager.save({ id: 'wf1' }, {});
      await fs.writeFile(path.join(TEST_DIR, 'invalid.json'), 'invalid', 'utf8');

      const checkpoints = await manager.list();

      expect(checkpoints).toHaveLength(1);
    });

    test('includes checkpoint metadata', async () => {
      const workflow = { id: 'wf1', steps: [1, 2, 3] };
      const state = { currentStep: 'step2', completedSteps: ['step1'], progress: 50 };
      await manager.save(workflow, state);

      const checkpoints = await manager.list();

      expect(checkpoints[0].state.currentStep).toBe('step2');
      expect(checkpoints[0].state.completedSteps).toBe(1);
      expect(checkpoints[0].state.progress).toBe(50);
    });
  });

  describe('delete', () => {
    test('deletes checkpoint file', async () => {
      const checkpointId = await manager.save({ id: 'wf1' }, {});

      const deleted = await manager.delete(checkpointId);

      expect(deleted).toBe(true);

      const files = await fs.readdir(TEST_DIR);
      expect(files).not.toContain(`${checkpointId}.json`);
    });

    test('returns false for non-existent checkpoint', async () => {
      const deleted = await manager.delete('non-existent');

      expect(deleted).toBe(false);
    });
  });

  describe('cleanup', () => {
    test('cleans up old checkpoints', async () => {
      await manager.save({ id: 'wf1' }, { timestamp: 1000 });
      await manager.save({ id: 'wf1' }, { timestamp: Date.now() });

      const cleaned = await manager.cleanup(1000); // Max age 1 second

      expect(cleaned).toBeGreaterThanOrEqual(1);

      const checkpoints = await manager.list();
      const hasOldCheckpoint = checkpoints.some((cp) => cp.timestamp === 1000);
      expect(hasOldCheckpoint).toBe(false);
    });

    test('uses default maxAge if not provided', async () => {
      const mgr = new CheckpointManager({
        checkpointDir: TEST_DIR,
        maxAge: 100,
        autoCleanup: false,
      });
      // Save checkpoint with old timestamp
      const oldTimestamp = Date.now() - 1000; // 1 second ago
      await mgr.save({ id: 'wf1' }, { timestamp: oldTimestamp });

      const cleaned = await mgr.cleanup();

      expect(cleaned).toBeGreaterThanOrEqual(1);
    });

    test('returns 0 if no checkpoints to cleanup', async () => {
      await manager.save({ id: 'wf1' }, { timestamp: Date.now() });

      const cleaned = await manager.cleanup(1000000); // 1000 seconds

      expect(cleaned).toBe(0);
    });

    test('handles cleanup errors gracefully', async () => {
      await expect(manager.cleanup()).resolves.toBeDefined();
    });
  });

  describe('validate', () => {
    test('validates valid checkpoint', async () => {
      const checkpointId = await manager.save({ id: 'wf1' }, {});

      const result = await manager.validate(checkpointId);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('returns errors for invalid checkpoint', async () => {
      const result = await manager.validate('non-existent');

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('getLatest', () => {
    test('gets latest checkpoint for workflow', async () => {
      await manager.save({ id: 'wf1' }, { timestamp: 1000 });
      await new Promise((resolve) => setTimeout(resolve, 10));
      await manager.save({ id: 'wf1' }, { timestamp: 2000 });

      const latest = await manager.getLatest('wf1');

      expect(latest.timestamp).toBeGreaterThan(1000);
    });

    test('returns null if no checkpoints for workflow', async () => {
      const latest = await manager.getLatest('non-existent');

      expect(latest).toBeNull();
    });

    test('ignores checkpoints for other workflows', async () => {
      await manager.save({ id: 'wf1' }, { timestamp: 1000 });
      await manager.save({ id: 'wf2' }, { timestamp: 2000 });

      const latest = await manager.getLatest('wf1');

      expect(latest.workflowId).toBe('wf1');
    });
  });

  describe('resume', () => {
    test('resumes workflow from checkpoint', async () => {
      const workflow = { id: 'wf1' };
      const state = { currentStep: 'step2', completedSteps: ['step1'] };
      const checkpointId = await manager.save(workflow, state);

      const result = await manager.resume(checkpointId);

      expect(result.checkpoint).toBeDefined();
      expect(result.state.currentStep).toBe('step2');
      expect(result.state.completedSteps).toEqual(['step1']);
    });

    test('merges checkpoint state with current state', async () => {
      const workflow = { id: 'wf1' };
      const savedState = { completedSteps: ['step1', 'step2'], results: { step1: 'ok' } };
      const checkpointId = await manager.save(workflow, savedState);

      const currentState = { completedSteps: ['step3'], results: { step3: 'ok' } };
      const result = await manager.resume(checkpointId, currentState);

      expect(result.state.completedSteps).toEqual(['step1', 'step2', 'step3']);
      expect(result.state.results).toEqual({ step1: 'ok', step3: 'ok' });
    });

    test('throws ValidationError for non-existent checkpoint', async () => {
      await expect(manager.resume('non-existent')).rejects.toThrow(ValidationError);
    });
  });
});
