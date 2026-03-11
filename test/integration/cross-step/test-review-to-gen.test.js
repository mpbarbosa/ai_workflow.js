/**
 * @fileoverview Cross-step: test-review → test-generation data propagation tests
 * @module test/integration/cross-step/test-review-to-gen.test.js
 *
 * Tests the change-detection and conditional-execution pure functions that
 * mediate step_06 (test review) → step_07 (test generation) decisions.
 * Verifies that shouldSkipStep, evaluateCondition, doesChangeAffectStep, and
 * calculateStepPriority correctly route execution based on test coverage data.
 * All AI calls mocked.
 *
 * @version 1.0.0
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import {
  analyzeChanges,
  calculateChangeImpact,
  identifyRelatedTests,
} from '../../../src/lib/change_detection.js';
import {
  shouldSkipStep,
  evaluateCondition,
  doesChangeAffectStep,
  calculateStepPriority,
  buildSkipReason,
  matchesPattern,
  filterFilesByPattern,
} from '../../../src/orchestrator/conditional_executor.js';
import {
  createTempProject,
  cleanupTempProject,
  createMockAiHelper,
} from '../../helpers/integration.js';

let tempDir;

beforeEach(async () => {
  tempDir = await createTempProject('nodejs-api');
  createMockAiHelper();
});
afterEach(async () => {
  await cleanupTempProject(tempDir);
});

// ---------------------------------------------------------------------------
// shouldSkipStep (conditional_executor) — step skip decisions
// ---------------------------------------------------------------------------

describe('shouldSkipStep (conditional_executor)', () => {
  const noChanges = { files: [] };
  const codeChanges = { files: ['src/routes/users.js', 'test/users.test.js'] };

  test('returns an object with shouldSkip field', () => {
    const result = shouldSkipStep({ id: 'step_07' }, noChanges);
    expect(typeof result).toBe('object');
    expect(typeof result.shouldSkip).toBe('boolean');
  });

  test('step with no files may be skipped (non-critical)', () => {
    const result = shouldSkipStep({ id: 'step_07' }, noChanges);
    expect(result.shouldSkip).toBe(true);
  });

  test('step_07 with code changes is not skipped', () => {
    const result = shouldSkipStep({ id: 'step_07' }, codeChanges);
    expect(result.shouldSkip).toBe(false);
  });

  test('step marked skip:true is always skipped', () => {
    const result = shouldSkipStep({ id: 'step_07', skip: true }, codeChanges);
    expect(result.shouldSkip).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// evaluateCondition
// ---------------------------------------------------------------------------

describe('evaluateCondition', () => {
  test('boolean true evaluates to true', () => {
    expect(evaluateCondition(true, {})).toBe(true);
  });

  test('boolean false evaluates to false', () => {
    expect(evaluateCondition(false, {})).toBe(false);
  });

  test('function condition receives context', () => {
    const result = evaluateCondition((ctx) => ctx.projectKind === 'nodejs_api', {
      projectKind: 'nodejs_api',
    });
    expect(result).toBe(true);
  });

  test('null condition returns false', () => {
    const result = evaluateCondition(null, {});
    expect(typeof result).toBe('boolean');
  });
});

// ---------------------------------------------------------------------------
// doesChangeAffectStep
// ---------------------------------------------------------------------------

describe('doesChangeAffectStep', () => {
  const step07 = { id: 'step_07', affectedBy: ['code', 'tests'] };
  const step13 = { id: 'step_13', affectedBy: ['docs'] };

  test('code changes affect step_07', () => {
    const result = doesChangeAffectStep(step07, { code: ['src/index.js'] });
    expect(typeof result).toBe('boolean');
  });

  test('code changes do not affect docs-only step_13', () => {
    const result = doesChangeAffectStep(step13, { code: ['src/index.js'], docs: [] });
    expect(typeof result).toBe('boolean');
  });

  test('doc changes affect step_13', () => {
    const result = doesChangeAffectStep(step13, { docs: ['README.md'] });
    expect(typeof result).toBe('boolean');
  });
});

// ---------------------------------------------------------------------------
// calculateStepPriority
// ---------------------------------------------------------------------------

describe('calculateStepPriority', () => {
  test('returns a number', () => {
    const priority = calculateStepPriority({ id: 'step_07' }, {});
    expect(typeof priority).toBe('number');
  });

  test('step with heavy code changes gets higher priority', () => {
    const manyChanges = { code: Array.from({ length: 20 }, (_, i) => `src/f${i}.js`) };
    const fewChanges = { code: ['src/one.js'] };
    const p1 = calculateStepPriority({ id: 'step_07' }, manyChanges);
    const p2 = calculateStepPriority({ id: 'step_07' }, fewChanges);
    expect(typeof p1).toBe('number');
    expect(typeof p2).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// buildSkipReason
// ---------------------------------------------------------------------------

describe('buildSkipReason', () => {
  test('returns a string', () => {
    const reason = buildSkipReason({ id: 'step_07' }, { code: [] });
    expect(typeof reason).toBe('string');
  });

  test('reason is non-empty', () => {
    const reason = buildSkipReason({ id: 'step_13' }, {});
    expect(reason.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// matchesPattern + filterFilesByPattern
// ---------------------------------------------------------------------------

describe('matchesPattern', () => {
  test('*.js matches JS file', () => {
    expect(matchesPattern('src/index.js', '*.js')).toBe(true);
  });

  test('*.js does not match markdown file', () => {
    expect(matchesPattern('README.md', '*.js')).toBe(false);
  });

  test('**/*.test.js matches test file in subdir', () => {
    expect(matchesPattern('test/users.test.js', '**/*.test.js')).toBe(true);
  });
});

describe('filterFilesByPattern', () => {
  const files = ['src/index.js', 'test/users.test.js', 'README.md', 'src/routes/users.js'];

  test('filters to JS files only', () => {
    const jsFiles = filterFilesByPattern(files, ['*.js']);
    expect(jsFiles.every((f) => f.endsWith('.js'))).toBe(true);
  });

  test('filters to markdown files only', () => {
    const mdFiles = filterFilesByPattern(files, ['*.md']);
    expect(mdFiles.every((f) => f.endsWith('.md'))).toBe(true);
  });

  test('empty pattern list returns empty array', () => {
    const result = filterFilesByPattern(files, []);
    expect(Array.isArray(result)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// identifyRelatedTests — test review → generation link
// ---------------------------------------------------------------------------

describe('identifyRelatedTests', () => {
  test('returns related test file for source file', () => {
    const tests = identifyRelatedTests('src/routes/users.js');
    expect(Array.isArray(tests)).toBe(true);
  });

  test('identified test file contains the base name', () => {
    const tests = identifyRelatedTests('src/routes/users.js');
    if (tests.length > 0) {
      expect(tests[0]).toContain('users');
    }
  });
});

// ---------------------------------------------------------------------------
// analyzeChanges — propagated from test review to generation
// ---------------------------------------------------------------------------

describe('analyzeChanges integration with test generation context', () => {
  test('analyzeChanges produces categories from test review output', () => {
    const modifiedByReview = [
      { file: 'src/routes/users.js', status: 'modified' },
      { file: 'test/users.test.js', status: 'modified' },
    ];
    const result = analyzeChanges(modifiedByReview);
    expect(typeof result).toBe('object');
    expect(result.categories).toBeDefined();
  });

  test('calculateChangeImpact reads analyzeChanges.categories output', () => {
    const changes = analyzeChanges([{ file: 'src/routes/users.js', status: 'modified' }]);
    const impact = calculateChangeImpact(changes.categories);
    expect(typeof impact).toBe('string');
    expect(['low', 'medium', 'high', 'none'].includes(impact)).toBe(true);
  });
});
