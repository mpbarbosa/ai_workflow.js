/**
 * @fileoverview CLI resume command integration tests
 * @module test/integration/cli/resume.integration.test.js
 *
 * Tests resume command pure functions: validateResumeOptions, formatCheckpoint,
 * formatCheckpointList. Exercises option validation and checkpoint formatting
 * logic against isolated temp directories.
 *
 * @version 1.0.0
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import path from 'path';
import fs from 'fs/promises';
import {
  validateResumeOptions,
  formatCheckpoint,
  formatCheckpointList,
} from '../../../src/cli/commands/resume.js';
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

// ---------------------------------------------------------------------------
// Sample checkpoints
// ---------------------------------------------------------------------------

const sampleCheckpoint = {
  workflowId: 'wf-cp-abc123',
  timestamp: new Date('2026-01-15T10:00:00Z').toISOString(),
  state: { completedSteps: ['step_00', 'step_01', 'step_02', 'step_03', 'step_04'] },
  metadata: { totalSteps: 20, progress: 25 },
};

// ---------------------------------------------------------------------------
// validateResumeOptions
// ---------------------------------------------------------------------------

describe('validateResumeOptions', () => {
  test('valid options with checkpointId passes', () => {
    const result = validateResumeOptions({}, 'cp-abc123');
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('undefined checkpointId without list or latest is invalid', () => {
    const result = validateResumeOptions({}, undefined);
    expect(result.isValid).toBe(false);
  });

  test('null checkpointId without list or latest is invalid', () => {
    const result = validateResumeOptions({}, null);
    expect(result.isValid).toBe(false);
  });

  test('empty checkpointId string without list or latest is invalid', () => {
    const result = validateResumeOptions({}, '');
    expect(result.isValid).toBe(false);
  });

  test('options with latest:true passes without checkpointId', () => {
    const result = validateResumeOptions({ latest: true }, null);
    expect(result.isValid).toBe(true);
  });

  test('options with list:true passes without checkpointId', () => {
    const result = validateResumeOptions({ list: true }, null);
    expect(result.isValid).toBe(true);
  });

  test('cannot use list and latest together', () => {
    const result = validateResumeOptions({ list: true, latest: true }, null);
    expect(result.isValid).toBe(false);
  });

  test('returns isValid boolean', () => {
    const result = validateResumeOptions({}, 'test-id');
    expect(typeof result.isValid).toBe('boolean');
  });

  test('returns errors array', () => {
    const result = validateResumeOptions({}, 'test-id');
    expect(Array.isArray(result.errors)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// formatCheckpoint
// ---------------------------------------------------------------------------

describe('formatCheckpoint', () => {
  test('returns a string', () => {
    const result = formatCheckpoint(sampleCheckpoint);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  test('includes workflowId in output', () => {
    const result = formatCheckpoint(sampleCheckpoint);
    expect(result).toContain('wf-cp-abc123');
  });

  test('handles minimal checkpoint object (null state)', () => {
    const result = formatCheckpoint(null);
    expect(typeof result).toBe('string');
  });

  test('handles checkpoint with empty state gracefully', () => {
    const cp = {
      workflowId: 'wf-test',
      timestamp: new Date().toISOString(),
      state: { completedSteps: [] },
      metadata: {},
    };
    const result = formatCheckpoint(cp);
    expect(typeof result).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// formatCheckpointList
// ---------------------------------------------------------------------------

describe('formatCheckpointList', () => {
  test('returns a string for empty list', () => {
    const result = formatCheckpointList([]);
    expect(typeof result).toBe('string');
  });

  test('returns a string for single-item list', () => {
    const result = formatCheckpointList([sampleCheckpoint]);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  test('returns a string for multiple checkpoints', () => {
    const second = {
      workflowId: 'wf-cp-xyz999',
      timestamp: new Date().toISOString(),
      state: { completedSteps: [] },
      metadata: {},
    };
    const result = formatCheckpointList([sampleCheckpoint, second]);
    expect(typeof result).toBe('string');
  });

  test('includes first checkpoint workflowId in list output', () => {
    const result = formatCheckpointList([sampleCheckpoint]);
    expect(result).toContain('wf-cp-abc123');
  });
});

// ---------------------------------------------------------------------------
// Checkpoint file round-trip
// ---------------------------------------------------------------------------

describe('checkpoint file persistence', () => {
  test('checkpoint JSON can be written and read back', async () => {
    const cpDir = path.join(tempDir, '.ai_workflow', 'checkpoints');
    const cpFile = path.join(cpDir, `${sampleCheckpoint.id}.json`);
    await fs.writeFile(cpFile, JSON.stringify(sampleCheckpoint, null, 2));
    const raw = await fs.readFile(cpFile, 'utf8');
    const parsed = JSON.parse(raw);
    expect(parsed.id).toBe(sampleCheckpoint.id);
    expect(parsed.step).toBe(sampleCheckpoint.step);
  });

  test('checkpoint file exists after write', async () => {
    const cpDir = path.join(tempDir, '.ai_workflow', 'checkpoints');
    const cpFile = path.join(cpDir, 'test-cp.json');
    await fs.writeFile(cpFile, JSON.stringify({ id: 'test-cp' }));
    const stat = await fs.stat(cpFile);
    expect(stat.isFile()).toBe(true);
  });
});
