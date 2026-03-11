/**
 * @fileoverview CLI streaming/verbose propagation integration tests
 * @module test/integration/cli/streaming.integration.test.js
 *
 * Verifies that the verbose and streamingEnabled options are correctly derived
 * by createOrchestratorOptions() and flow through to MainOrchestrator.
 *
 * @version 1.0.0
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { createOrchestratorOptions } from '../../../src/cli/commands/run.js';
import { createTempProject, cleanupTempProject } from '../../helpers/integration.js';

let tempDir;

beforeEach(async () => {
  tempDir = await createTempProject('nodejs-api');
});
afterEach(async () => {
  await cleanupTempProject(tempDir);
});

// ---------------------------------------------------------------------------
// streamingEnabled derivation
// ---------------------------------------------------------------------------

describe('streamingEnabled derivation in createOrchestratorOptions', () => {
  test('no flags → streamingEnabled is false', () => {
    const opts = createOrchestratorOptions({});
    expect(opts.streamingEnabled).toBe(false);
  });

  test('verbose:false → streamingEnabled is false', () => {
    const opts = createOrchestratorOptions({ verbose: false });
    expect(opts.streamingEnabled).toBe(false);
  });

  test('verbose:true → streamingEnabled is true', () => {
    const opts = createOrchestratorOptions({ verbose: true });
    expect(opts.streamingEnabled).toBe(true);
  });

  test('tui:true → streamingEnabled is true', () => {
    const opts = createOrchestratorOptions({ tui: true });
    expect(opts.streamingEnabled).toBe(true);
  });

  test('verbose:true AND tui:true → streamingEnabled is still true (no double-toggle)', () => {
    const opts = createOrchestratorOptions({ verbose: true, tui: true });
    expect(opts.streamingEnabled).toBe(true);
  });

  test('tui:false AND verbose:false → streamingEnabled is false', () => {
    const opts = createOrchestratorOptions({ tui: false, verbose: false });
    expect(opts.streamingEnabled).toBe(false);
  });

  test('verbose flag is passed as a boolean true in returned options', () => {
    const opts = createOrchestratorOptions({ verbose: true });
    expect(opts.verbose).toBe(true);
  });

  test('verbose is false by default', () => {
    const opts = createOrchestratorOptions({});
    expect(opts.verbose).toBe(false);
  });

  test('streamingEnabled is a boolean (not truthy object)', () => {
    const opts = createOrchestratorOptions({ verbose: true });
    expect(typeof opts.streamingEnabled).toBe('boolean');
  });

  test('streamingEnabled is a boolean when false', () => {
    const opts = createOrchestratorOptions({});
    expect(typeof opts.streamingEnabled).toBe('boolean');
  });
});

// ---------------------------------------------------------------------------
// verbose is orthogonal to other options
// ---------------------------------------------------------------------------

describe('verbose does not affect other options', () => {
  test('dryRun is independent of verbose', () => {
    const opts = createOrchestratorOptions({ dryRun: true, verbose: true });
    expect(opts.dryRun).toBe(true);
    expect(opts.streamingEnabled).toBe(true);
  });

  test('noParallel is independent of verbose', () => {
    const opts = createOrchestratorOptions({ parallel: false, verbose: true });
    expect(opts.noParallel).toBe(true);
    expect(opts.streamingEnabled).toBe(true);
  });

  test('stage is independent of verbose', () => {
    const opts = createOrchestratorOptions({ stage: 'full', verbose: true });
    expect(opts.stage).toBe('full');
    expect(opts.streamingEnabled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// resume command streaming (validateRunOptions re-use)
// ---------------------------------------------------------------------------

import { resumeCommand } from '../../../src/cli/commands/resume.js';

describe('resume command exports', () => {
  test('resumeCommand is a function', () => {
    expect(typeof resumeCommand).toBe('function');
  });
});
