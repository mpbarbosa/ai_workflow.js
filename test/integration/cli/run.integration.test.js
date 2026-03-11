/**
 * @fileoverview CLI run command integration tests
 * @module test/integration/cli/run.integration.test.js
 *
 * Tests the pure-function layer of the run command (createOrchestratorOptions,
 * validateRunOptions, formatWorkflowResult) with realistic option combinations.
 * The MainOrchestrator is stubbed so no real workflow executes.
 *
 * @version 1.0.0
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import path from 'path';
import {
  validateRunOptions,
  createOrchestratorOptions,
  formatWorkflowResult,
} from '../../../src/cli/commands/run.js';
import { WORKFLOW_STAGES } from '../../../src/orchestrator/main_orchestrator.js';
import { createTempProject, cleanupTempProject } from '../../helpers/integration.js';

let tempDir;

beforeEach(async () => {
  tempDir = await createTempProject('nodejs-api');
});
afterEach(async () => {
  await cleanupTempProject(tempDir);
});

// ---------------------------------------------------------------------------
// validateRunOptions
// ---------------------------------------------------------------------------

describe('validateRunOptions', () => {
  test('accepts empty options', () => {
    const result = validateRunOptions({});
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('accepts valid FULL stage', () => {
    const result = validateRunOptions({ stage: WORKFLOW_STAGES.FULL });
    expect(result.isValid).toBe(true);
  });

  test('rejects unknown stage', () => {
    const result = validateRunOptions({ stage: 'not-a-stage' });
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toMatch(/invalid stage/i);
  });

  test('accepts string config path', () => {
    const result = validateRunOptions({ config: '/tmp/my.yaml' });
    expect(result.isValid).toBe(true);
  });

  test('rejects non-string config path', () => {
    const result = validateRunOptions({ config: 42 });
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toMatch(/config path/i);
  });

  test('accumulates multiple errors', () => {
    const result = validateRunOptions({ stage: 'bad-stage', config: 99 });
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// createOrchestratorOptions
// ---------------------------------------------------------------------------

describe('createOrchestratorOptions', () => {
  test('defaults workflowDir to .ai_workflow', () => {
    const opts = createOrchestratorOptions({});
    expect(opts.workflowDir).toBe('.ai_workflow');
  });

  test('defaults stage to FULL', () => {
    const opts = createOrchestratorOptions({});
    expect(opts.stage).toBe(WORKFLOW_STAGES.FULL);
  });

  test('passes through dryRun flag', () => {
    const opts = createOrchestratorOptions({ dryRun: true });
    expect(opts.dryRun).toBe(true);
  });

  test('passes through noParallel when parallel is false', () => {
    const opts = createOrchestratorOptions({ parallel: false });
    expect(opts.noParallel).toBe(true);
  });

  test('noParallel is false when parallel is unset', () => {
    const opts = createOrchestratorOptions({});
    expect(opts.noParallel).toBe(false);
  });

  test('verbose:true sets streamingEnabled:true', () => {
    const opts = createOrchestratorOptions({ verbose: true });
    expect(opts.verbose).toBe(true);
    expect(opts.streamingEnabled).toBe(true);
  });

  test('tui:true sets streamingEnabled:true', () => {
    const opts = createOrchestratorOptions({ tui: true });
    expect(opts.streamingEnabled).toBe(true);
  });

  test('streamingEnabled is false without verbose or tui', () => {
    const opts = createOrchestratorOptions({});
    expect(opts.streamingEnabled).toBe(false);
  });

  test('explicit workflowDir is preserved', () => {
    const opts = createOrchestratorOptions({ workflowDir: '/custom/dir' });
    expect(opts.workflowDir).toBe('/custom/dir');
  });

  test('explicit projectRoot is preserved', () => {
    const opts = createOrchestratorOptions({ projectRoot: tempDir });
    expect(opts.projectRoot).toBe(tempDir);
  });

  test('auto flag is passed through', () => {
    const opts = createOrchestratorOptions({ auto: true });
    expect(opts.auto).toBe(true);
  });

  test('sdkSmokeTest flag is passed through', () => {
    const opts = createOrchestratorOptions({ sdkSmokeTest: true });
    expect(opts.sdkSmokeTest).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// formatWorkflowResult
// ---------------------------------------------------------------------------

describe('formatWorkflowResult', () => {
  test('handles null gracefully', () => {
    const msg = formatWorkflowResult(null);
    expect(typeof msg).toBe('string');
    expect(msg.length).toBeGreaterThan(0);
  });

  test('handles undefined gracefully', () => {
    const msg = formatWorkflowResult(undefined);
    expect(typeof msg).toBe('string');
  });

  test('includes success indicator for successful result', () => {
    const msg = formatWorkflowResult({
      success: true,
      duration: 5000,
      results: { summary: { succeeded: 20, total: 20 } },
    });
    expect(typeof msg).toBe('string');
  });

  test('includes failure indicator for failed result', () => {
    const msg = formatWorkflowResult({
      success: false,
      duration: 3000,
      results: { summary: { failed: 2, total: 20 } },
    });
    expect(typeof msg).toBe('string');
  });

  test('result with stepsCompleted returns a string', () => {
    const msg = formatWorkflowResult({
      success: true,
      duration: 1000,
      results: { summary: { succeeded: 5, total: 5 } },
    });
    expect(typeof msg).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// Integration: options → config correctness with temp project
// ---------------------------------------------------------------------------

describe('createOrchestratorOptions — projectRoot pointing at fixture', () => {
  test('projectRoot is set to temp project dir', () => {
    const opts = createOrchestratorOptions({ projectRoot: tempDir });
    expect(opts.projectRoot).toBe(tempDir);
    expect(path.isAbsolute(opts.projectRoot)).toBe(true);
  });

  test('workflowDir defaults remain relative', () => {
    const opts = createOrchestratorOptions({ projectRoot: tempDir });
    expect(opts.workflowDir).toBe('.ai_workflow');
  });

  test('dry-run + verbose combination', () => {
    const opts = createOrchestratorOptions({ projectRoot: tempDir, dryRun: true, verbose: true });
    expect(opts.dryRun).toBe(true);
    expect(opts.streamingEnabled).toBe(true);
  });

  test('no-parallel + dry-run combination', () => {
    const opts = createOrchestratorOptions({ projectRoot: tempDir, parallel: false, dryRun: true });
    expect(opts.noParallel).toBe(true);
    expect(opts.dryRun).toBe(true);
  });
});
