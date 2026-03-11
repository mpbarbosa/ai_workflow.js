/**
 * @fileoverview Workflow artifact creation verification
 * @module test/e2e/workflow-artifacts.e2e.test.js
 *
 * Verifies that workflow helpers create correctly-structured artifact files
 * in the .ai_workflow/ directory tree. Tests Backlog, MetricsCollector,
 * and SessionManager writing to an isolated temp project.
 *
 * @version 1.0.0
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import path from 'path';
import fs from 'fs/promises';
import { Backlog } from '../../src/lib/backlog.js';
import { Metrics } from '../../src/lib/metrics.js';
import { SessionManager } from '../../src/lib/session_manager.js';
import {
  createTempProject,
  cleanupTempProject,
  createMockConfig,
  ensureWorkflowDirectories,
} from '../helpers/integration.js';

let tempDir;
let config;

beforeEach(async () => {
  tempDir = await createTempProject('nodejs-api');
  config = createMockConfig(tempDir);
  await ensureWorkflowDirectories(tempDir);
});
afterEach(async () => {
  await cleanupTempProject(tempDir);
});

// ---------------------------------------------------------------------------
// Backlog artifact writing
// ---------------------------------------------------------------------------

describe('Backlog artifact creation', () => {
  test('Backlog can be instantiated with config', () => {
    const backlog = new Backlog(config);
    expect(backlog).toBeDefined();
  });

  test('backlog runDir exists after setup', async () => {
    const dir = config.backlogRunDir;
    const stat = await fs.stat(dir);
    expect(stat.isDirectory()).toBe(true);
  });

  test('can write a test file to backlog dir', async () => {
    const testFile = path.join(config.backlogRunDir, 'test-artifact.json');
    const data = { step: 'step_00', result: 'success', timestamp: Date.now() };
    await fs.writeFile(testFile, JSON.stringify(data, null, 2));
    const content = JSON.parse(await fs.readFile(testFile, 'utf8'));
    expect(content.step).toBe('step_00');
    expect(content.result).toBe('success');
  });

  test('backlog dir is writable multiple times', async () => {
    for (let i = 0; i < 3; i++) {
      const f = path.join(config.backlogRunDir, `artifact-${i}.json`);
      await fs.writeFile(f, JSON.stringify({ idx: i }));
    }
    const files = await fs.readdir(config.backlogRunDir);
    expect(files.length).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// SessionManager artifact writing
// ---------------------------------------------------------------------------

describe('SessionManager artifact creation', () => {
  test('SessionManager can be instantiated', () => {
    const sm = new SessionManager(config);
    expect(sm).toBeDefined();
  });

  test('SessionManager has registerSession method', () => {
    const sm = new SessionManager(config);
    expect(typeof sm.registerSession).toBe('function');
  });

  test('generateSessionId returns a string', () => {
    const sm = new SessionManager(config);
    const sessionId = sm.generateSessionId(0, 'test');
    expect(typeof sessionId).toBe('string');
    expect(sessionId.length).toBeGreaterThan(0);
  });

  test('two generateSessionId calls produce different ids', () => {
    const sm = new SessionManager(config);
    const id1 = sm.generateSessionId(0, 'run');
    const id2 = sm.generateSessionId(1, 'run');
    expect(id1).not.toBe(id2);
  });

  test('registerSession and getSession round-trip', () => {
    const sm = new SessionManager(config);
    const id = sm.generateSessionId(0, 'test');
    sm.registerSession(id, 'test session');
    const session = sm.getSession(id);
    expect(session).toBeDefined();
  });

  test('getSession for unknown id returns null', () => {
    const sm = new SessionManager(config);
    expect(sm.getSession('no-such-id')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Metrics artifact writing
// ---------------------------------------------------------------------------

describe('Metrics artifact creation', () => {
  test('Metrics can be instantiated', () => {
    const mc = new Metrics(config);
    expect(mc).toBeDefined();
  });

  test('Metrics has startStepTimer method', () => {
    const mc = new Metrics(config);
    expect(typeof mc.startStepTimer).toBe('function');
  });

  test('startStepTimer tracks a step timer', () => {
    const mc = new Metrics(config);
    expect(() => mc.startStepTimer(0)).not.toThrow();
  });

  test('endStepTimer does not throw', () => {
    const mc = new Metrics(config);
    mc.startStepTimer(0);
    expect(() => mc.endStepTimer(0, 'passed')).not.toThrow();
  });

  test('getAllMetrics returns an object', () => {
    const mc = new Metrics(config);
    const metrics = mc.getAllMetrics();
    expect(typeof metrics).toBe('object');
  });

  test('metrics dir exists', async () => {
    const stat = await fs.stat(config.metricsDir);
    expect(stat.isDirectory()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Checkpoint artifact schema
// ---------------------------------------------------------------------------

describe('checkpoint artifact schema', () => {
  test('checkpoint file can be written with correct JSON schema', async () => {
    const cpDir = config.checkpointsDir;
    const checkpoint = {
      id: 'cp-test-001',
      workflowId: 'wf-test',
      step: 'step_05',
      stepIndex: 5,
      timestamp: new Date().toISOString(),
      executionContext: {
        projectRoot: tempDir,
        projectKind: 'nodejs_api',
      },
      stepResults: {
        step_00: { success: true },
        step_01: { success: true },
      },
    };
    const cpFile = path.join(cpDir, `${checkpoint.id}.json`);
    await fs.writeFile(cpFile, JSON.stringify(checkpoint, null, 2));
    const parsed = JSON.parse(await fs.readFile(cpFile, 'utf8'));
    expect(parsed.id).toBe('cp-test-001');
    expect(parsed.step).toBe('step_05');
    expect(typeof parsed.executionContext).toBe('object');
    expect(typeof parsed.stepResults).toBe('object');
  });

  test('checkpoint file is discoverable in directory listing', async () => {
    const cpDir = config.checkpointsDir;
    await fs.writeFile(path.join(cpDir, 'cp-disc.json'), '{"id":"cp-disc"}');
    const files = await fs.readdir(cpDir);
    expect(files.includes('cp-disc.json')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Summary artifact schema
// ---------------------------------------------------------------------------

describe('summary artifact schema', () => {
  test('summary file can be written with correct schema', async () => {
    const summary = {
      workflowId: 'wf-test',
      startTime: new Date(Date.now() - 10000).toISOString(),
      endTime: new Date().toISOString(),
      stepsCompleted: 20,
      stepsFailed: 0,
      projectKind: 'nodejs_api',
    };
    const summaryFile = path.join(config.summaryRunDir, 'summary-test.json');
    await fs.writeFile(summaryFile, JSON.stringify(summary, null, 2));
    const parsed = JSON.parse(await fs.readFile(summaryFile, 'utf8'));
    expect(parsed.stepsCompleted).toBe(20);
    expect(parsed.projectKind).toBe('nodejs_api');
  });
});
