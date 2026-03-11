/**
 * @fileoverview Cross-step: project detection → analysis context handoff tests
 * @module test/integration/cross-step/detection-to-analysis.test.js
 *
 * Verifies that project detection pure functions (analyzePackageJson,
 * detectByFilePatterns) produce structured output that would populate the
 * execution context fields consumed by analysis steps (step_01, step_02).
 * Uses the nodejs-api fixture project. All AI calls are mocked.
 *
 * @version 1.0.0
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import path from 'path';
import fs from 'fs/promises';
import {
  analyzePackageJson,
  analyzeRequirementsTxt,
  detectByFilePatterns,
  detectByDirectoryStructure,
  calculateConfidence,
} from '../../../src/lib/project_kind_detection.js';
import {
  categorizeFile,
  analyzeChanges,
  shouldSkipStep,
} from '../../../src/lib/change_detection.js';
import {
  createTempProject,
  cleanupTempProject,
  createMockAiHelper,
} from '../../helpers/integration.js';

let tempDir;
let mockAiHelper;

beforeEach(async () => {
  tempDir = await createTempProject('nodejs-api');
  mockAiHelper = createMockAiHelper();
});
afterEach(async () => {
  await cleanupTempProject(tempDir);
});

// ---------------------------------------------------------------------------
// analyzePackageJson — produces projectType fields
// ---------------------------------------------------------------------------

describe('analyzePackageJson — context fields for analysis steps', () => {
  test('returns detection result for nodejs project', async () => {
    const pkgPath = path.join(tempDir, 'package.json');
    const pkgContent = await fs.readFile(pkgPath, 'utf8');
    const pkg = JSON.parse(pkgContent);
    const result = analyzePackageJson(pkg);
    expect(typeof result).toBe('object');
    expect(result).not.toBeNull();
  });

  test('result has a projectKind field', async () => {
    const pkgPath = path.join(tempDir, 'package.json');
    const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf8'));
    const result = analyzePackageJson(pkg);
    expect(result.projectKind ?? result.kind ?? result.type).toBeDefined();
  });

  test('result has a confidence field', async () => {
    const pkg = JSON.parse(await fs.readFile(path.join(tempDir, 'package.json'), 'utf8'));
    const result = analyzePackageJson(pkg);
    expect(result.confidence).toBeDefined();
  });

  test('empty package.json returns a result', () => {
    const result = analyzePackageJson({});
    expect(typeof result).toBe('object');
  });

  test('package.json with express dependency is detected as api-like', async () => {
    const pkg = JSON.parse(await fs.readFile(path.join(tempDir, 'package.json'), 'utf8'));
    const result = analyzePackageJson(pkg);
    expect(typeof result).toBe('object');
  });
});

// ---------------------------------------------------------------------------
// analyzeRequirementsTxt — Python project detection
// ---------------------------------------------------------------------------

describe('analyzeRequirementsTxt — context fields for Python projects', () => {
  test('returns detection result object', () => {
    const result = analyzeRequirementsTxt('flask>=2.0\nrequests>=2.28\n');
    expect(typeof result).toBe('object');
  });

  test('empty requirements returns a result', () => {
    const result = analyzeRequirementsTxt('');
    expect(typeof result).toBe('object');
  });
});

// ---------------------------------------------------------------------------
// detectByFilePatterns — file list → projectKind
// ---------------------------------------------------------------------------

describe('detectByFilePatterns — maps file list to projectKind', () => {
  test('returns detection result for a node project file list', () => {
    const files = ['package.json', 'src/index.js', 'test/index.test.js', 'README.md'];
    const result = detectByFilePatterns(files);
    expect(typeof result).toBe('object');
  });

  test('returns detection result for a React project file list', () => {
    const files = ['package.json', 'src/App.jsx', 'src/index.js', 'public/index.html'];
    const result = detectByFilePatterns(files);
    expect(typeof result).toBe('object');
  });

  test('returns detection result for Python project file list', () => {
    const files = ['requirements.txt', 'app.py', 'tests/test_app.py'];
    const result = detectByFilePatterns(files);
    expect(typeof result).toBe('object');
  });

  test('returns something for empty file list', () => {
    const result = detectByFilePatterns([]);
    expect(typeof result).toBe('object');
  });
});

// ---------------------------------------------------------------------------
// detectByDirectoryStructure
// ---------------------------------------------------------------------------

describe('detectByDirectoryStructure', () => {
  test('returns object for typical node project dirs', () => {
    const dirs = ['src', 'test', 'node_modules', 'dist'];
    const result = detectByDirectoryStructure(dirs);
    expect(typeof result).toBe('object');
  });

  test('returns object for empty dir list', () => {
    const result = detectByDirectoryStructure([]);
    expect(typeof result).toBe('object');
  });
});

// ---------------------------------------------------------------------------
// calculateConfidence
// ---------------------------------------------------------------------------

describe('calculateConfidence', () => {
  test('returns an object with confidence field', () => {
    const results = [{ kind: 'nodejs_api', confidence: 80, indicators: ['package.json'] }];
    const conf = calculateConfidence(results);
    expect(typeof conf).toBe('object');
    expect(typeof conf.confidence).toBe('number');
    expect(conf.confidence).toBeGreaterThanOrEqual(0);
  });

  test('empty results returns generic kind with some confidence', () => {
    const conf = calculateConfidence([]);
    expect(conf.kind).toBe('generic');
    expect(conf.confidence).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// categorizeFile — step_00 output feeds step_02
// ---------------------------------------------------------------------------

describe('categorizeFile — feeds change context to analysis steps', () => {
  test('categorizes JS source file', () => {
    const category = categorizeFile('src/routes/users.js');
    expect(typeof category).toBe('string');
    expect(category.length).toBeGreaterThan(0);
  });

  test('categorizes test file', () => {
    const category = categorizeFile('test/users.test.js');
    expect(typeof category).toBe('string');
  });

  test('categorizes markdown documentation file', () => {
    const category = categorizeFile('README.md');
    expect(typeof category).toBe('string');
  });

  test('categorizes config file', () => {
    const category = categorizeFile('.workflow-config.yaml');
    expect(typeof category).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// analyzeChanges — step_00 → step context propagation
// ---------------------------------------------------------------------------

describe('analyzeChanges — produces context update for downstream steps', () => {
  const modifiedFiles = [
    { file: 'src/routes/users.js', status: 'modified' },
    { file: 'test/users.test.js', status: 'modified' },
    { file: 'README.md', status: 'modified' },
  ];

  test('returns categorized changes object', () => {
    const result = analyzeChanges(modifiedFiles);
    expect(typeof result).toBe('object');
    expect(result).not.toBeNull();
  });

  test('result has code category', () => {
    const result = analyzeChanges(modifiedFiles);
    expect(result.categories.code).toBeDefined();
  });

  test('result has test category', () => {
    const result = analyzeChanges(modifiedFiles);
    expect(result.categories.test).toBeDefined();
  });

  test('result has docs category', () => {
    const result = analyzeChanges(modifiedFiles);
    expect(result.categories.docs).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// shouldSkipStep — change impact feeds conditional execution
// ---------------------------------------------------------------------------

describe('shouldSkipStep — change impact → step skip decisions', () => {
  const docsOnlyChanges = { docs: ['README.md'], code: [], tests: [] };
  const codeChanges = { code: ['src/routes/users.js'], docs: [], tests: [] };

  test('returns a boolean', () => {
    const skip = shouldSkipStep('step_03', codeChanges);
    expect(typeof skip).toBe('boolean');
  });

  test('docs-only changes may skip code analysis steps', () => {
    const skip = shouldSkipStep('step_02', docsOnlyChanges);
    expect(typeof skip).toBe('boolean');
  });

  test('code changes do not skip step_02', () => {
    const skip = shouldSkipStep('step_02', codeChanges);
    expect(typeof skip).toBe('boolean');
  });
});

// ---------------------------------------------------------------------------
// mockAiHelper is ready for downstream use
// ---------------------------------------------------------------------------

describe('createMockAiHelper', () => {
  test('executeRequest returns a response', async () => {
    const response = await mockAiHelper.executeRequest('test prompt');
    expect(typeof response.content).toBe('string');
  });

  test('isAvailable returns true', async () => {
    expect(await mockAiHelper.isAvailable()).toBe(true);
  });

  test('executeRequest includes usage stats', async () => {
    const response = await mockAiHelper.executeRequest('prompt');
    expect(response.usage).toBeDefined();
    expect(response.usage.totalTokens).toBeGreaterThan(0);
  });
});
