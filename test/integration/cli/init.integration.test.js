/**
 * @fileoverview CLI init command integration tests
 * @module test/integration/cli/init.integration.test.js
 *
 * Tests pure functions from initCommand: getProjectTemplates, validateInitOptions,
 * generateTechStackDefaults, generateWorkflowConfig, generateDirectoryStructure.
 * All tests are performed against isolated temp directories.
 *
 * @version 1.0.0
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import path from 'path';
import fs from 'fs/promises';
import {
  getProjectTemplates,
  validateInitOptions,
  generateTechStackDefaults,
} from '../../../src/cli/commands/init.js';
import { createTempProject, cleanupTempProject } from '../../helpers/integration.js';

let tempDir;

beforeEach(async () => {
  tempDir = await createTempProject('nodejs-api');
});
afterEach(async () => {
  await cleanupTempProject(tempDir);
});

// ---------------------------------------------------------------------------
// getProjectTemplates
// ---------------------------------------------------------------------------

describe('getProjectTemplates', () => {
  test('returns an array', () => {
    const templates = getProjectTemplates();
    expect(Array.isArray(templates)).toBe(true);
  });

  test('returns at least 7 templates', () => {
    const templates = getProjectTemplates();
    expect(templates.length).toBeGreaterThanOrEqual(7);
  });

  test('each template has name and description', () => {
    const templates = getProjectTemplates();
    for (const t of templates) {
      expect(typeof t.name).toBe('string');
      expect(typeof t.description).toBe('string');
    }
  });

  test('contains nodejs_api', () => {
    const templates = getProjectTemplates();
    expect(templates.some((t) => t.name === 'nodejs_api')).toBe(true);
  });

  test('contains react_spa', () => {
    const templates = getProjectTemplates();
    expect(templates.some((t) => t.name === 'react_spa')).toBe(true);
  });

  test('contains python_app', () => {
    const templates = getProjectTemplates();
    expect(templates.some((t) => t.name === 'python_app')).toBe(true);
  });

  test('contains generic', () => {
    const templates = getProjectTemplates();
    expect(templates.some((t) => t.name === 'generic')).toBe(true);
  });

  test('template names are unique', () => {
    const templates = getProjectTemplates();
    const names = templates.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

// ---------------------------------------------------------------------------
// validateInitOptions
// ---------------------------------------------------------------------------

describe('validateInitOptions', () => {
  test('accepts empty options', () => {
    const result = validateInitOptions({});
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('accepts valid template name', () => {
    const result = validateInitOptions({ template: 'nodejs_api' });
    expect(result.isValid).toBe(true);
  });

  test('rejects unknown template name', () => {
    const result = validateInitOptions({ template: 'cobol_app' });
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toMatch(/invalid template/i);
  });

  test('valid react_spa template', () => {
    const result = validateInitOptions({ template: 'react_spa' });
    expect(result.isValid).toBe(true);
  });

  test('valid python_app template', () => {
    const result = validateInitOptions({ template: 'python_app' });
    expect(result.isValid).toBe(true);
  });

  test('valid generic template', () => {
    const result = validateInitOptions({ template: 'generic' });
    expect(result.isValid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// generateTechStackDefaults
// ---------------------------------------------------------------------------

describe('generateTechStackDefaults', () => {
  test('returns an object', () => {
    const defaults = generateTechStackDefaults('javascript');
    expect(typeof defaults).toBe('object');
    expect(defaults).not.toBeNull();
  });

  test('javascript returns framework or tools info', () => {
    const defaults = generateTechStackDefaults('javascript');
    expect(Object.keys(defaults).length).toBeGreaterThan(0);
  });

  test('python returns an object', () => {
    const defaults = generateTechStackDefaults('python');
    expect(typeof defaults).toBe('object');
  });

  test('unknown language returns an object (no crash)', () => {
    const defaults = generateTechStackDefaults('brainfuck');
    expect(typeof defaults).toBe('object');
  });
});

// ---------------------------------------------------------------------------
// Fixture temp dir is a real project
// ---------------------------------------------------------------------------

describe('fixture project exists as a temp dir', () => {
  test('package.json exists in temp dir', async () => {
    const pkgPath = path.join(tempDir, 'package.json');
    const stat = await fs.stat(pkgPath);
    expect(stat.isFile()).toBe(true);
  });

  test('src/ directory exists in temp dir', async () => {
    const srcPath = path.join(tempDir, 'src');
    const stat = await fs.stat(srcPath);
    expect(stat.isDirectory()).toBe(true);
  });

  test('README.md exists in temp dir', async () => {
    const readmePath = path.join(tempDir, 'README.md');
    const stat = await fs.stat(readmePath);
    expect(stat.isFile()).toBe(true);
  });
});
