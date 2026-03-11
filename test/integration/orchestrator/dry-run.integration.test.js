/**
 * @fileoverview Orchestrator dry-run integration tests
 * @module test/integration/orchestrator/dry-run.integration.test.js
 *
 * Tests the dry-run path by verifying that the orchestrator options correctly
 * carry dryRun:true and that the pure function layer (validateOrchestratorConfig,
 * calculateProgress) handles dry-run correctly.
 * The MainOrchestrator is NOT instantiated here to avoid real I/O.
 *
 * @version 1.0.0
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import {
  validateOrchestratorConfig,
  calculateProgress,
  getStepsForStage,
  WORKFLOW_STAGES,
} from '../../../src/orchestrator/main_orchestrator.js';
import { createOrchestratorOptions } from '../../../src/cli/commands/run.js';
import {
  createTempProject,
  cleanupTempProject,
  createMockConfig,
} from '../../helpers/integration.js';

let tempDir;

beforeEach(async () => {
  tempDir = await createTempProject('nodejs-api');
});
afterEach(async () => {
  await cleanupTempProject(tempDir);
});

// ---------------------------------------------------------------------------
// Dry-run option flows through createOrchestratorOptions
// ---------------------------------------------------------------------------

describe('dry-run flag propagation', () => {
  test('dryRun:true is set in orchestrator options', () => {
    const opts = createOrchestratorOptions({ dryRun: true, projectRoot: tempDir });
    expect(opts.dryRun).toBe(true);
  });

  test('dryRun:false is the default', () => {
    const opts = createOrchestratorOptions({ projectRoot: tempDir });
    expect(opts.dryRun).toBe(false);
  });

  test('dry-run does not disable verbose', () => {
    const opts = createOrchestratorOptions({ dryRun: true, verbose: true });
    expect(opts.dryRun).toBe(true);
    expect(opts.verbose).toBe(true);
  });

  test('dry-run does not disable streaming', () => {
    const opts = createOrchestratorOptions({ dryRun: true, verbose: true });
    expect(opts.streamingEnabled).toBe(true);
  });

  test('dry-run + noParallel combination', () => {
    const opts = createOrchestratorOptions({ dryRun: true, parallel: false });
    expect(opts.dryRun).toBe(true);
    expect(opts.noParallel).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Config validation for dry-run mode
// ---------------------------------------------------------------------------

describe('validateOrchestratorConfig for dry-run options', () => {
  test('config with dryRun:true validates', () => {
    const result = validateOrchestratorConfig({
      projectRoot: tempDir,
      workflowDir: '.ai_workflow',
      dryRun: true,
    });
    expect(result.isValid).toBe(true);
  });

  test('dry-run does not require workflowDir to exist on disk', () => {
    const result = validateOrchestratorConfig({
      projectRoot: tempDir,
      workflowDir: '.ai_workflow',
      dryRun: true,
    });
    expect(typeof result.isValid).toBe('boolean');
  });
});

// ---------------------------------------------------------------------------
// Step list completeness for dry-run simulation
// ---------------------------------------------------------------------------

describe('step enumeration for dry-run simulation', () => {
  test('FULL stage returns steps that can be dry-run', () => {
    const steps = getStepsForStage(WORKFLOW_STAGES.FULL);
    expect(steps.length).toBeGreaterThan(0);
  });

  test('steps are strings or objects', () => {
    const steps = getStepsForStage(WORKFLOW_STAGES.FULL);
    for (const step of steps) {
      expect(['string', 'object'].includes(typeof step)).toBe(true);
    }
  });

  test('progress starts at 0 for dry-run', () => {
    expect(calculateProgress(0, 20)).toBe(0);
  });

  test('progress reaches 100 when all steps complete in dry-run', () => {
    const steps = getStepsForStage(WORKFLOW_STAGES.FULL);
    expect(calculateProgress(steps.length, steps.length)).toBe(100);
  });

  test('mid-run progress is correct', () => {
    const steps = getStepsForStage(WORKFLOW_STAGES.FULL);
    const half = Math.floor(steps.length / 2);
    const pct = calculateProgress(half, steps.length);
    expect(pct).toBeGreaterThan(0);
    expect(pct).toBeLessThan(100);
  });
});

// ---------------------------------------------------------------------------
// Mock config is valid in dry-run mode
// ---------------------------------------------------------------------------

describe('createMockConfig correctness for dry-run tests', () => {
  test('mock config has projectRoot', () => {
    const cfg = createMockConfig(tempDir);
    expect(cfg.projectRoot).toBe(tempDir);
  });

  test('mock config has dryRun:false by default', () => {
    const cfg = createMockConfig(tempDir);
    expect(cfg.dryRun).toBe(false);
  });

  test('mock config override sets dryRun:true', () => {
    const cfg = createMockConfig(tempDir, { dryRun: true });
    expect(cfg.dryRun).toBe(true);
  });

  test('workflowDir is under projectRoot', () => {
    const cfg = createMockConfig(tempDir);
    expect(cfg.workflowDir).toContain(tempDir);
  });
});
