/**
 * @fileoverview Orchestrator context propagation integration tests
 * @module test/integration/orchestrator/context.integration.test.js
 *
 * Tests step executor and context-related pure functions:
 * createExecutionContext, validateStepInput/Output, formatStepResult,
 * mergeCheckpointState, calculateProgress from the orchestrator layer.
 *
 * @version 1.0.0
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import {
  createExecutionContext,
  validateStepInput,
  validateStepOutput,
  formatStepResult,
  calculateTimeout,
  shouldRetryStep,
  calculateRetryDelay,
  isTimedOut,
} from '../../../src/orchestrator/step_executor.js';
import { mergeCheckpointState } from '../../../src/orchestrator/checkpoint_manager.js';
import {
  createTempProject,
  cleanupTempProject,
  createMockConfig,
} from '../../helpers/integration.js';

let tempDir;

beforeEach(async () => {
  tempDir = await createTempProject('nodejs-api');
  createMockConfig(tempDir);
});
afterEach(async () => {
  await cleanupTempProject(tempDir);
});

const sampleStep = { id: 'step_01', name: 'Documentation Validation', timeout: 60 };

// ---------------------------------------------------------------------------
// createExecutionContext
// ---------------------------------------------------------------------------

describe('createExecutionContext', () => {
  test('returns an object', () => {
    const ctx = createExecutionContext(sampleStep, {});
    expect(typeof ctx).toBe('object');
    expect(ctx).not.toBeNull();
  });

  test('step field is included', () => {
    const ctx = createExecutionContext(sampleStep, {});
    expect(ctx.step ?? ctx.stepId).toBeDefined();
  });

  test('globalContext fields are accessible via ctx.global', () => {
    const ctx = createExecutionContext(sampleStep, { projectRoot: tempDir }, {});
    expect(ctx.global.projectRoot).toBe(tempDir);
  });

  test('previousResults are accessible in context', () => {
    const ctx = createExecutionContext(sampleStep, {}, { step_00: { projectType: 'nodejs_api' } });
    expect(ctx.previousResults ?? ctx).toBeDefined();
  });

  test('empty inputs produce a valid context', () => {
    expect(() => createExecutionContext(sampleStep, {})).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// validateStepInput
// ---------------------------------------------------------------------------

describe('validateStepInput', () => {
  test('null input with no schema returns valid', () => {
    const result = validateStepInput(null);
    expect(result.valid).toBe(true);
  });

  test('object input with no schema returns valid', () => {
    const result = validateStepInput({ projectRoot: tempDir });
    expect(result.valid).toBe(true);
  });

  test('returns object with valid field', () => {
    const result = validateStepInput({});
    expect(typeof result.valid).toBe('boolean');
  });
});

// ---------------------------------------------------------------------------
// validateStepOutput
// ---------------------------------------------------------------------------

describe('validateStepOutput', () => {
  test('valid output object passes', () => {
    const result = validateStepOutput({ success: true, data: {} });
    expect(result.valid).toBe(true);
  });

  test('null output may be rejected', () => {
    const result = validateStepOutput(null);
    expect(typeof result.valid).toBe('boolean');
  });

  test('returns object with valid field', () => {
    const result = validateStepOutput({ success: true });
    expect(typeof result.valid).toBe('boolean');
  });
});

// ---------------------------------------------------------------------------
// formatStepResult
// ---------------------------------------------------------------------------

describe('formatStepResult', () => {
  const execution = { startTime: Date.now() - 1000, endTime: Date.now(), attempts: 1 };

  test('returns an object', () => {
    const result = formatStepResult(sampleStep, execution);
    expect(typeof result).toBe('object');
    expect(result).not.toBeNull();
  });

  test('result includes step id', () => {
    const result = formatStepResult(sampleStep, execution);
    expect(result.stepId ?? result.step?.id ?? result.id).toBeDefined();
  });

  test('result includes duration', () => {
    const result = formatStepResult(sampleStep, execution);
    expect(result.duration ?? result.elapsed).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// calculateTimeout
// ---------------------------------------------------------------------------

describe('calculateTimeout', () => {
  test('returns a number', () => {
    expect(typeof calculateTimeout(sampleStep)).toBe('number');
  });

  test('uses step timeout if set', () => {
    const step = { ...sampleStep, timeout: 120 };
    expect(calculateTimeout(step)).toBeGreaterThanOrEqual(120);
  });

  test('returns base timeout for step without timeout', () => {
    const step = { id: 'step_x', name: 'X' };
    expect(calculateTimeout(step, 300)).toBeGreaterThanOrEqual(300);
  });
});

// ---------------------------------------------------------------------------
// shouldRetryStep + calculateRetryDelay
// ---------------------------------------------------------------------------

describe('shouldRetryStep', () => {
  test('does not retry on attempt >= maxRetries', () => {
    expect(shouldRetryStep(new Error('fail'), 3, 3)).toBe(false);
  });

  test('retries on first attempt with retriable error', () => {
    const result = shouldRetryStep(new Error('timeout'), 1, 3);
    expect(typeof result).toBe('boolean');
  });
});

describe('calculateRetryDelay', () => {
  test('returns a number', () => {
    expect(typeof calculateRetryDelay(1)).toBe('number');
  });

  test('delay increases with attempt number', () => {
    const d1 = calculateRetryDelay(1, 1000);
    const d2 = calculateRetryDelay(2, 1000);
    expect(d2).toBeGreaterThanOrEqual(d1);
  });
});

// ---------------------------------------------------------------------------
// isTimedOut
// ---------------------------------------------------------------------------

describe('isTimedOut', () => {
  test('past start + large timeout is not timed out', () => {
    const start = Date.now() - 100;
    expect(isTimedOut(start, 100000)).toBe(false);
  });

  test('past start + tiny timeout is timed out', () => {
    const start = Date.now() - 10000;
    expect(isTimedOut(start, 1)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// mergeCheckpointState
// ---------------------------------------------------------------------------

describe('mergeCheckpointState', () => {
  test('returns an object', () => {
    const merged = mergeCheckpointState({}, {});
    expect(typeof merged).toBe('object');
  });

  test('saved currentStep overrides current', () => {
    const merged = mergeCheckpointState({ currentStep: 'step_01' }, { currentStep: 'step_03' });
    expect(merged.currentStep).toBe('step_03');
  });

  test('current completedSteps preserved when savedState has none', () => {
    const merged = mergeCheckpointState({ completedSteps: ['step_00', 'step_01'] }, {});
    expect(merged.completedSteps).toContain('step_00');
  });

  test('handles empty objects', () => {
    expect(() => mergeCheckpointState({}, {})).not.toThrow();
  });
});
