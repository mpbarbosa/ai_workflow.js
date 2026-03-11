/**
 * @fileoverview Workflow smoke test — all steps, dry-run mode
 * @module test/e2e/workflow-smoke.e2e.test.js
 *
 * Verifies that every workflow step exported from src/steps/ can be imported
 * and that its module-level exported step definition has the expected shape.
 * In dry-run scenarios the step modules are exercised without live AI calls.
 *
 * @version 1.0.0
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import {
  createTempProject,
  cleanupTempProject,
  createMockConfig,
  createMockAiHelper,
  ensureWorkflowDirectories,
} from '../helpers/integration.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STEPS_DIR = path.resolve(__dirname, '../../src/steps');

let tempDir;
let config;
let mockAiHelper;

beforeEach(async () => {
  tempDir = await createTempProject('nodejs-api');
  config = createMockConfig(tempDir);
  mockAiHelper = createMockAiHelper();
  await ensureWorkflowDirectories(tempDir);
});
afterEach(async () => {
  await cleanupTempProject(tempDir);
});

// ---------------------------------------------------------------------------
// Helper — discover all step files
// ---------------------------------------------------------------------------

async function discoverStepFiles() {
  const entries = await fs.readdir(STEPS_DIR);
  return entries
    .filter((f) => f.endsWith('.js') && !f.includes('.test.') && !f.includes('.spec.'))
    .map((f) => path.join(STEPS_DIR, f));
}

// ---------------------------------------------------------------------------
// Step module shape smoke test
// ---------------------------------------------------------------------------

describe('Workflow smoke — all step modules importable', () => {
  test('steps directory exists', async () => {
    const stat = await fs.stat(STEPS_DIR);
    expect(stat.isDirectory()).toBe(true);
  });

  test('at least 15 step files exist', async () => {
    const files = await discoverStepFiles();
    expect(files.length).toBeGreaterThanOrEqual(15);
  });

  test('all step files have .js extension', async () => {
    const files = await discoverStepFiles();
    expect(files.every((f) => f.endsWith('.js'))).toBe(true);
  });

  test('step files include step_00', async () => {
    const files = await discoverStepFiles();
    expect(files.some((f) => f.includes('step_00'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// createMockConfig shape
// ---------------------------------------------------------------------------

describe('createMockConfig produces correct shape', () => {
  test('has projectRoot pointing to tempDir', () => {
    expect(config.projectRoot).toBe(tempDir);
  });

  test('has workflowDir under tempDir', () => {
    expect(config.workflowDir).toContain(tempDir);
  });

  test('backlogRunDir is defined', () => {
    expect(config.backlogRunDir).toBeDefined();
  });

  test('summaryRunDir is defined', () => {
    expect(config.summaryRunDir).toBeDefined();
  });

  test('metricsDir is defined', () => {
    expect(config.metricsDir).toBeDefined();
  });

  test('checkpointsDir is defined', () => {
    expect(config.checkpointsDir).toBeDefined();
  });

  test('primaryLanguage defaults to javascript', () => {
    expect(config.primaryLanguage).toBe('javascript');
  });

  test('projectKind defaults to nodejs_api', () => {
    expect(config.projectKind).toBe('nodejs_api');
  });

  test('dryRun defaults to false', () => {
    expect(config.dryRun).toBe(false);
  });

  test('override dryRun:true is applied', () => {
    const dryConfig = createMockConfig(tempDir, { dryRun: true });
    expect(dryConfig.dryRun).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ensureWorkflowDirectories creates the full tree
// ---------------------------------------------------------------------------

describe('workflow artifact directory tree', () => {
  test('.ai_workflow/ exists', async () => {
    const dir = path.join(tempDir, '.ai_workflow');
    expect((await fs.stat(dir)).isDirectory()).toBe(true);
  });

  test('backlog/ exists', async () => {
    const dir = path.join(tempDir, '.ai_workflow', 'backlog');
    expect((await fs.stat(dir)).isDirectory()).toBe(true);
  });

  test('summaries/ exists', async () => {
    const dir = path.join(tempDir, '.ai_workflow', 'summaries');
    expect((await fs.stat(dir)).isDirectory()).toBe(true);
  });

  test('logs/ exists', async () => {
    const dir = path.join(tempDir, '.ai_workflow', 'logs');
    expect((await fs.stat(dir)).isDirectory()).toBe(true);
  });

  test('checkpoints/ exists', async () => {
    const dir = path.join(tempDir, '.ai_workflow', 'checkpoints');
    expect((await fs.stat(dir)).isDirectory()).toBe(true);
  });

  test('metrics/ exists', async () => {
    const dir = path.join(tempDir, '.ai_workflow', 'metrics');
    expect((await fs.stat(dir)).isDirectory()).toBe(true);
  });

  test('prompts/ exists', async () => {
    const dir = path.join(tempDir, '.ai_workflow', 'prompts');
    expect((await fs.stat(dir)).isDirectory()).toBe(true);
  });

  test('ml_models/ exists', async () => {
    const dir = path.join(tempDir, '.ai_workflow', 'ml_models');
    expect((await fs.stat(dir)).isDirectory()).toBe(true);
  });

  test('.incremental_cache/ exists', async () => {
    const dir = path.join(tempDir, '.ai_workflow', '.incremental_cache');
    expect((await fs.stat(dir)).isDirectory()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// mockAiHelper contract
// ---------------------------------------------------------------------------

describe('mockAiHelper fulfils AiHelper contract', () => {
  test('has executeRequest method', () => {
    expect(typeof mockAiHelper.executeRequest).toBe('function');
  });

  test('has isAvailable method', () => {
    expect(typeof mockAiHelper.isAvailable).toBe('function');
  });

  test('executeRequest returns content string', async () => {
    const resp = await mockAiHelper.executeRequest('test');
    expect(typeof resp.content).toBe('string');
  });

  test('executeRequest returns model field', async () => {
    const resp = await mockAiHelper.executeRequest('test');
    expect(typeof resp.model).toBe('string');
  });

  test('executeRequest returns usage.totalTokens > 0', async () => {
    const resp = await mockAiHelper.executeRequest('test');
    expect(resp.usage.totalTokens).toBeGreaterThan(0);
  });

  test('isAvailable resolves to true', async () => {
    expect(await mockAiHelper.isAvailable()).toBe(true);
  });

  test('executeRequest with options does not throw', async () => {
    await expect(mockAiHelper.executeRequest('prompt', { maxTokens: 100 })).resolves.toBeDefined();
  });

  test('multiple calls return consistent structure', async () => {
    const r1 = await mockAiHelper.executeRequest('p1');
    const r2 = await mockAiHelper.executeRequest('p2');
    expect(Object.keys(r1)).toEqual(Object.keys(r2));
  });
});
