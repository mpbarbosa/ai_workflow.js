/**
 * @fileoverview CLI config command integration tests
 * @module test/integration/cli/config.integration.test.js
 *
 * Tests pure functions from the config command: validateConfigOptions,
 * formatConfigValue, listConfigKeys. Runs against isolated temp directories
 * that contain a .workflow-config.yaml.
 *
 * @version 1.0.0
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import path from 'path';
import fs from 'fs/promises';
import {
  validateConfigAction,
  getConfigValue,
  formatConfigValue,
  formatValidationErrors,
} from '../../../src/cli/commands/config.js';
import { createTempProject, cleanupTempProject } from '../../helpers/integration.js';

let tempDir;

beforeEach(async () => {
  tempDir = await createTempProject('nodejs-api');
});
afterEach(async () => {
  await cleanupTempProject(tempDir);
});

// ---------------------------------------------------------------------------
// validateConfigAction
// ---------------------------------------------------------------------------

describe('validateConfigAction', () => {
  test('accepts valid get action with key', () => {
    const result = validateConfigAction('get', ['project.name']);
    expect(result.isValid).toBe(true);
  });

  test('accepts valid set action with key and value', () => {
    const result = validateConfigAction('set', ['project.name', 'foo']);
    expect(result.isValid).toBe(true);
  });

  test('accepts show action', () => {
    const result = validateConfigAction('show', []);
    expect(result.isValid).toBe(true);
  });

  test('accepts validate action', () => {
    const result = validateConfigAction('validate', []);
    expect(result.isValid).toBe(true);
  });

  test('rejects unknown action', () => {
    const result = validateConfigAction('delete', []);
    expect(result.isValid).toBe(false);
  });

  test('rejects set without value arg (only key provided)', () => {
    const result = validateConfigAction('set', ['project.name']);
    expect(result.isValid).toBe(false);
  });

  test('rejects get without key arg', () => {
    const result = validateConfigAction('get', []);
    expect(result.isValid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// formatConfigValue
// ---------------------------------------------------------------------------

describe('formatConfigValue', () => {
  test('formats string values', () => {
    const result = formatConfigValue('myvalue');
    expect(typeof result).toBe('string');
  });

  test('formats boolean values', () => {
    const result = formatConfigValue(true);
    expect(typeof result).toBe('string');
  });

  test('formats number values', () => {
    const result = formatConfigValue(30);
    expect(typeof result).toBe('string');
  });

  test('formats null gracefully', () => {
    const result = formatConfigValue(null);
    expect(typeof result).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// getConfigValue
// ---------------------------------------------------------------------------

describe('getConfigValue', () => {
  const sampleConfig = {
    project: { name: 'test-project', kind: 'nodejs_api' },
    autoCommit: false,
  };

  test('retrieves top-level scalar value', () => {
    const val = getConfigValue(sampleConfig, 'autoCommit');
    expect(val).toBe(false);
  });

  test('retrieves nested value via dot notation', () => {
    const val = getConfigValue(sampleConfig, 'project.name');
    expect(val).toBe('test-project');
  });

  test('returns undefined for missing key', () => {
    const val = getConfigValue(sampleConfig, 'nonexistent.key');
    expect(val).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// formatValidationErrors
// ---------------------------------------------------------------------------

describe('formatValidationErrors', () => {
  test('returns a string', () => {
    const result = formatValidationErrors(['error one', 'error two']);
    expect(typeof result).toBe('string');
  });

  test('empty errors array returns a string', () => {
    const result = formatValidationErrors([]);
    expect(typeof result).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// Temp dir isolation
// ---------------------------------------------------------------------------

describe('temp project isolation', () => {
  test('two calls to createTempProject produce different directories', async () => {
    const dir2 = await createTempProject('nodejs-api');
    expect(dir2).not.toBe(tempDir);
    await cleanupTempProject(dir2);
  });

  test('temp dir is writable', async () => {
    const testFile = path.join(tempDir, 'config-test.txt');
    await fs.writeFile(testFile, 'ok');
    const content = await fs.readFile(testFile, 'utf8');
    expect(content).toBe('ok');
  });
});
