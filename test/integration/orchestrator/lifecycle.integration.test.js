/**
 * @fileoverview Orchestrator lifecycle integration tests
 * @module test/integration/orchestrator/lifecycle.integration.test.js
 *
 * Tests MainOrchestrator instantiation and pure function layer
 * (validateOrchestratorConfig, getStepsForStage, calculateProgress,
 * determineWorkflowStatus, WORKFLOW_STAGES) without executing any real AI steps.
 *
 * @version 1.0.0
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import {
  validateOrchestratorConfig,
  getStepsForStage,
  calculateProgress,
  determineWorkflowStatus,
  WORKFLOW_STAGES,
} from '../../../src/orchestrator/main_orchestrator.js';
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

// ---------------------------------------------------------------------------
// WORKFLOW_STAGES
// ---------------------------------------------------------------------------

describe('WORKFLOW_STAGES constants', () => {
  test('FULL stage exists', () => {
    expect(WORKFLOW_STAGES.FULL).toBeDefined();
  });

  test('FULL stage is a string', () => {
    expect(typeof WORKFLOW_STAGES.FULL).toBe('string');
  });

  test('stages object is frozen', () => {
    expect(Object.isFrozen(WORKFLOW_STAGES)).toBe(true);
  });

  test('contains at least 2 stages', () => {
    expect(Object.keys(WORKFLOW_STAGES).length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// validateOrchestratorConfig
// ---------------------------------------------------------------------------

describe('validateOrchestratorConfig', () => {
  test('validates a minimal config object', () => {
    const result = validateOrchestratorConfig({ projectRoot: tempDir });
    expect(typeof result.isValid).toBe('boolean');
    expect(Array.isArray(result.errors)).toBe(true);
  });

  test('valid config with workflowDir passes', () => {
    const result = validateOrchestratorConfig({
      projectRoot: tempDir,
      workflowDir: '.ai_workflow',
    });
    expect(result.isValid).toBe(true);
  });

  test('null config is rejected', () => {
    const result = validateOrchestratorConfig(null);
    expect(result.isValid).toBe(false);
  });

  test('empty object may be rejected or accepted', () => {
    const result = validateOrchestratorConfig({});
    expect(typeof result.isValid).toBe('boolean');
  });

  test('errors is empty when config is valid', () => {
    const result = validateOrchestratorConfig({
      projectRoot: tempDir,
      workflowDir: '.ai_workflow',
    });
    expect(result.errors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getStepsForStage
// ---------------------------------------------------------------------------

describe('getStepsForStage', () => {
  test('returns array for FULL stage', () => {
    const steps = getStepsForStage(WORKFLOW_STAGES.FULL);
    expect(Array.isArray(steps)).toBe(true);
  });

  test('FULL stage returns at least 10 steps', () => {
    const steps = getStepsForStage(WORKFLOW_STAGES.FULL);
    expect(steps.length).toBeGreaterThanOrEqual(10);
  });

  test('returns array for any valid stage', () => {
    for (const stage of Object.values(WORKFLOW_STAGES)) {
      const steps = getStepsForStage(stage);
      expect(Array.isArray(steps)).toBe(true);
    }
  });

  test('unknown stage returns an array (graceful fallback)', () => {
    const steps = getStepsForStage('unknown-stage');
    expect(Array.isArray(steps)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// calculateProgress
// ---------------------------------------------------------------------------

describe('calculateProgress', () => {
  test('0 of 20 is 0%', () => {
    expect(calculateProgress(0, 20)).toBe(0);
  });

  test('20 of 20 is 100%', () => {
    expect(calculateProgress(20, 20)).toBe(100);
  });

  test('10 of 20 is 50%', () => {
    expect(calculateProgress(10, 20)).toBe(50);
  });

  test('returns a number', () => {
    expect(typeof calculateProgress(5, 20)).toBe('number');
  });

  test('0 of 0 does not throw', () => {
    expect(() => calculateProgress(0, 0)).not.toThrow();
  });

  test('result is between 0 and 100', () => {
    const pct = calculateProgress(7, 20);
    expect(pct).toBeGreaterThanOrEqual(0);
    expect(pct).toBeLessThanOrEqual(100);
  });
});

// ---------------------------------------------------------------------------
// determineWorkflowStatus
// ---------------------------------------------------------------------------

describe('determineWorkflowStatus', () => {
  test('returns a string', () => {
    const status = determineWorkflowStatus(null);
    expect(typeof status).toBe('string');
  });

  test('all-success results produce "success" status', () => {
    const results = {
      steps: {
        step_00: { status: 'completed' },
        step_01: { status: 'completed' },
      },
    };
    const status = determineWorkflowStatus(results);
    expect(typeof status).toBe('string');
    expect(status).toBe('success');
  });

  test('results with failures reflect "failed" status', () => {
    const results = {
      steps: {
        step_00: { status: 'completed' },
        step_01: { status: 'failed' },
      },
    };
    const status = determineWorkflowStatus(results);
    expect(status).toBe('failed');
  });

  test('null results return "unknown"', () => {
    const status = determineWorkflowStatus(null);
    expect(status).toBe('unknown');
  });
});
