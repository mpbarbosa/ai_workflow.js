/**
 * @fileoverview Tests for step_20_async_perf_review module
 * @module test/steps/step_20_async_perf_review.test
 */

import { jest } from '@jest/globals';
import {
  isAsyncHeavyProject,
  scoreAsyncIssues,
  formatAsyncPerfReport,
  STEP_DEFINITION,
  Step20AsyncPerfReview,
} from '../../src/steps/step_20_async_perf_review.js';
import { STEP_KIND } from '../../src/steps/step_contract.js';

// =============================================================================
// PURE FUNCTION TESTS
// =============================================================================

describe('step_20_async_perf_review - Pure Functions', () => {
  // -------------------------------------------------------------------------
  // isAsyncHeavyProject
  // -------------------------------------------------------------------------

  describe('isAsyncHeavyProject', () => {
    test('returns true for .js files', () => {
      expect(isAsyncHeavyProject(['src/index.js'])).toBe(true);
    });

    test('returns true for .ts files', () => {
      expect(isAsyncHeavyProject(['src/app.ts'])).toBe(true);
    });

    test('returns true for .tsx files', () => {
      expect(isAsyncHeavyProject(['src/App.tsx'])).toBe(true);
    });

    test('returns true for .mjs files', () => {
      expect(isAsyncHeavyProject(['src/utils.mjs'])).toBe(true);
    });

    test('returns true for .cjs files', () => {
      expect(isAsyncHeavyProject(['src/config.cjs'])).toBe(true);
    });

    test('returns false for non-JS/TS files only', () => {
      expect(isAsyncHeavyProject(['README.md', 'Makefile', 'src/style.css'])).toBe(false);
    });

    test('returns false for empty array', () => {
      expect(isAsyncHeavyProject([])).toBe(false);
    });

    test('returns true for mixed list containing a .ts file', () => {
      expect(isAsyncHeavyProject(['README.md', 'src/index.ts'])).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // scoreAsyncIssues
  // -------------------------------------------------------------------------

  describe('scoreAsyncIssues', () => {
    test('returns zero scores for empty contents', () => {
      const scores = scoreAsyncIssues([]);
      expect(scores.promiseConstructorCount).toBe(0);
      expect(scores.unhandledRejectionCount).toBe(0);
      expect(scores.missingCleanupCount).toBe(0);
      expect(scores.totalIssues).toBe(0);
    });

    test('counts explicit Promise constructors', () => {
      const code = `
const p1 = new Promise((resolve) => resolve(1));
const p2 = new Promise((resolve, reject) => {});
`;
      const scores = scoreAsyncIssues([code]);
      expect(scores.promiseConstructorCount).toBe(2);
    });

    test('counts unhandled rejections (.then without .catch)', () => {
      const code = `
fetch('/api').then(res => res.json());
doSomething().then(handleResult).catch(handleError);
`;
      const scores = scoreAsyncIssues([code]);
      // 2 .then, 1 .catch → 1 unhandled
      expect(scores.unhandledRejectionCount).toBe(1);
    });

    test('counts missing event listener cleanup', () => {
      const code = `
window.addEventListener('resize', handler);
window.addEventListener('scroll', handler2);
// No removeEventListener
`;
      const scores = scoreAsyncIssues([code]);
      expect(scores.missingCleanupCount).toBe(2);
    });

    test('does not produce negative unhandledRejectionCount', () => {
      const code = `
.catch(err => console.error(err));
`;
      const scores = scoreAsyncIssues([code]);
      expect(scores.unhandledRejectionCount).toBeGreaterThanOrEqual(0);
    });

    test('does not produce negative missingCleanupCount', () => {
      const code = `
window.removeEventListener('resize', handler);
`;
      const scores = scoreAsyncIssues([code]);
      expect(scores.missingCleanupCount).toBeGreaterThanOrEqual(0);
    });

    test('totalIssues equals sum of individual counts', () => {
      const code = `
new Promise((r) => r());
fetch('/x').then(r => r.json());
el.addEventListener('click', fn);
`;
      const scores = scoreAsyncIssues([code]);
      expect(scores.totalIssues).toBe(
        scores.promiseConstructorCount + scores.unhandledRejectionCount + scores.missingCleanupCount
      );
    });

    test('aggregates across multiple file contents', () => {
      const file1 = `new Promise((r) => r());`;
      const file2 = `el.addEventListener('click', fn);`;
      const scores = scoreAsyncIssues([file1, file2]);
      expect(scores.promiseConstructorCount).toBe(1);
      expect(scores.missingCleanupCount).toBe(1);
    });

    test('returns an object with all required fields', () => {
      const scores = scoreAsyncIssues(['const x = 1;']);
      expect(scores).toHaveProperty('promiseConstructorCount');
      expect(scores).toHaveProperty('unhandledRejectionCount');
      expect(scores).toHaveProperty('missingCleanupCount');
      expect(scores).toHaveProperty('totalIssues');
    });
  });

  // -------------------------------------------------------------------------
  // formatAsyncPerfReport
  // -------------------------------------------------------------------------

  describe('formatAsyncPerfReport', () => {
    const mockScores = {
      promiseConstructorCount: 3,
      unhandledRejectionCount: 2,
      missingCleanupCount: 1,
      totalIssues: 6,
    };

    test('includes the section header', () => {
      const report = formatAsyncPerfReport('AI content here', mockScores);
      expect(report).toContain('## Async Performance Review');
    });

    test('includes heuristic pre-scan table', () => {
      const report = formatAsyncPerfReport('AI content here', mockScores);
      expect(report).toContain('### Heuristic Pre-scan');
      expect(report).toContain('Explicit Promise constructors');
      expect(report).toContain('3');
      expect(report).toContain('6');
    });

    test('includes AI analysis section', () => {
      const report = formatAsyncPerfReport('Some AI findings', mockScores);
      expect(report).toContain('### AI Analysis');
      expect(report).toContain('Some AI findings');
    });

    test('uses placeholder when AI content is empty', () => {
      const report = formatAsyncPerfReport('', mockScores);
      expect(report).toContain('No AI analysis available');
    });

    test('returns a string', () => {
      const report = formatAsyncPerfReport('content', mockScores);
      expect(typeof report).toBe('string');
    });
  });

  // -------------------------------------------------------------------------
  // STEP_DEFINITION
  // -------------------------------------------------------------------------

  describe('STEP_DEFINITION', () => {
    test('has correct id', () => {
      expect(STEP_DEFINITION.id).toBe('step_20');
    });

    test('has correct name', () => {
      expect(STEP_DEFINITION.name).toBe('Async Performance Review');
    });

    test('has ANALYSIS kind', () => {
      expect(STEP_DEFINITION.kind).toBe(STEP_KIND.ANALYSIS);
    });

    test('depends on step_19', () => {
      expect(STEP_DEFINITION.dependencies).toContain('step_19');
    });

    test('has a description', () => {
      expect(typeof STEP_DEFINITION.description).toBe('string');
      expect(STEP_DEFINITION.description.length).toBeGreaterThan(0);
    });
  });
});

// =============================================================================
// IMPURE WRAPPER TESTS (mocked dependencies)
// =============================================================================

describe('Step20AsyncPerfReview - Wrapper', () => {
  const makeFileOps = (files = ['src/index.js', 'src/utils.ts'], content = 'const x = 1;') => ({
    listDirectoryRecursive: jest.fn().mockResolvedValue(files),
    readFile: jest.fn().mockImplementation((p) => {
      if (p.endsWith('ai_helpers.yaml') || p.includes('ai_helpers')) {
        return Promise.resolve(
          'async_perf_engineer_prompt:\n' +
            '  role_prefix: "test"\n' +
            '  task_template: |\n' +
            '    Project: {project_name} ({project_description})\n' +
            '    Kind: {project_kind}\n' +
            '    Language: {primary_language}\n' +
            '    Build: {build_system}\n' +
            '    Test: {test_framework}\n' +
            '    Files: {source_file_count}\n' +
            '    Modified: {modified_count}\n' +
            '    Paths: {file_paths}\n' +
            '  approach: "approach"'
        );
      }
      if (p.endsWith('prompt_roles.yaml') || p.includes('prompt_roles')) {
        return Promise.resolve('roles: {}');
      }
      return Promise.resolve(content);
    }),
  });

  const makeTechStack = (overrides = {}) => ({
    detectAll: jest.fn().mockResolvedValue({
      build_system: 'npm',
      test_framework: 'jest',
      primary_language: 'javascript',
      ...overrides,
    }),
  });

  const makeBacklog = () => ({
    saveStepSummary: jest.fn().mockResolvedValue(undefined),
  });

  const makeAiHelper = (content = 'AI findings') => ({
    initialize: jest.fn().mockResolvedValue(true),
    executeRequest: jest.fn().mockResolvedValue({ content }),
  });

  const makeAiCache = () => ({
    init: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  });

  test('skips gracefully when no JS/TS files found', async () => {
    const fileOps = makeFileOps([]);
    const step = new Step20AsyncPerfReview({
      fileOps,
      backlog: makeBacklog(),
      aiHelper: makeAiHelper(),
      aiCache: makeAiCache(),
      techStack: makeTechStack(),
    });

    const result = await step.execute('/project');
    expect(result.success).toBe(true);
    expect(result.skipped).toBe(true);
  });

  test('calls AI with async_performance_engineer persona', async () => {
    const aiHelper = makeAiHelper('some findings');
    const step = new Step20AsyncPerfReview({
      fileOps: makeFileOps(),
      backlog: makeBacklog(),
      aiHelper,
      aiCache: makeAiCache(),
      techStack: makeTechStack(),
    });

    await step.execute('/project');

    expect(aiHelper.executeRequest).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ persona: 'async_performance_engineer' })
    );
  });

  test('saves backlog summary on success', async () => {
    const backlog = makeBacklog();
    const step = new Step20AsyncPerfReview({
      fileOps: makeFileOps(),
      backlog,
      aiHelper: makeAiHelper(),
      aiCache: makeAiCache(),
      techStack: makeTechStack(),
    });

    await step.execute('/project');

    expect(backlog.saveStepSummary).toHaveBeenCalledWith(
      20,
      'Async Performance Review',
      expect.any(String)
    );
  });

  test('returns success result with scores and report', async () => {
    const step = new Step20AsyncPerfReview({
      fileOps: makeFileOps(),
      backlog: makeBacklog(),
      aiHelper: makeAiHelper(),
      aiCache: makeAiCache(),
      techStack: makeTechStack(),
    });

    const result = await step.execute('/project');

    expect(result.success).toBe(true);
    expect(result.skipped).toBe(false);
    expect(result.fileCount).toBeGreaterThan(0);
    expect(result.scores).toHaveProperty('totalIssues');
    expect(typeof result.report).toBe('string');
  });

  test('uses cached AI response when available', async () => {
    const aiHelper = makeAiHelper();
    const aiCache = {
      init: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue('cached AI content'),
      set: jest.fn().mockResolvedValue(undefined),
    };
    const step = new Step20AsyncPerfReview({
      fileOps: makeFileOps(),
      backlog: makeBacklog(),
      aiHelper,
      aiCache,
      techStack: makeTechStack(),
    });

    const result = await step.execute('/project');

    expect(aiHelper.executeRequest).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  test('handles AI errors gracefully (does not throw)', async () => {
    const aiHelper = {
      initialize: jest.fn().mockResolvedValue(true),
      executeRequest: jest.fn().mockRejectedValue(new Error('AI timeout')),
    };
    const step = new Step20AsyncPerfReview({
      fileOps: makeFileOps(),
      backlog: makeBacklog(),
      aiHelper,
      aiCache: makeAiCache(),
      techStack: makeTechStack(),
    });

    const result = await step.execute('/project');
    expect(result.success).toBe(true);
  });

  test('accepts sourceFiles override via options', async () => {
    const fileOps = makeFileOps();
    const step = new Step20AsyncPerfReview({
      fileOps,
      backlog: makeBacklog(),
      aiHelper: makeAiHelper(),
      aiCache: makeAiCache(),
      techStack: makeTechStack(),
    });

    await step.execute('/project', { sourceFiles: ['custom/file.ts'] });

    // listDirectoryRecursive should not be called when sourceFiles is provided
    expect(fileOps.listDirectoryRecursive).not.toHaveBeenCalled();
  });

  test('prompt includes enriched context fields from tech stack', async () => {
    const aiHelper = makeAiHelper('findings');
    const step = new Step20AsyncPerfReview({
      fileOps: makeFileOps(['src/index.js', 'src/utils.ts', 'src/api.js']),
      backlog: makeBacklog(),
      aiHelper,
      aiCache: makeAiCache(),
      techStack: makeTechStack({ build_system: 'yarn', test_framework: 'vitest' }),
    });

    await step.execute('/project', {
      projectName: 'my-app',
      projectDescription: 'A sample API',
      projectKind: 'nodejs_api',
    });

    const [promptArg] = aiHelper.executeRequest.mock.calls[0];
    expect(promptArg).toContain('my-app');
    expect(promptArg).toContain('A sample API');
    expect(promptArg).toContain('nodejs_api');
    expect(promptArg).toContain('yarn');
    expect(promptArg).toContain('vitest');
    expect(promptArg).toContain('src/index.js');
  });

  test('prompt includes all analyzed file paths up to cap', async () => {
    const files = Array.from({ length: 25 }, (_, i) => `src/file${i}.js`);
    const aiHelper = makeAiHelper('findings');
    const step = new Step20AsyncPerfReview({
      fileOps: makeFileOps(files),
      backlog: makeBacklog(),
      aiHelper,
      aiCache: makeAiCache(),
      techStack: makeTechStack(),
    });

    await step.execute('/project');

    const [promptArg] = aiHelper.executeRequest.mock.calls[0];
    // First 20 files should appear; file index 20+ may be summarised
    expect(promptArg).toContain('src/file0.js');
    expect(promptArg).toContain('src/file19.js');
    expect(promptArg).toContain('and 5 more');
  });

  test('falls back gracefully when tech stack detection fails', async () => {
    const techStack = {
      detectAll: jest.fn().mockRejectedValue(new Error('detection failed')),
    };
    const aiHelper = makeAiHelper('findings');
    const step = new Step20AsyncPerfReview({
      fileOps: makeFileOps(),
      backlog: makeBacklog(),
      aiHelper,
      aiCache: makeAiCache(),
      techStack,
    });

    // Should not throw; prompt is still built with default values
    const result = await step.execute('/project');
    expect(result.success).toBe(true);
    const [promptArg] = aiHelper.executeRequest.mock.calls[0];
    expect(promptArg).toContain('npm');
    expect(promptArg).toContain('jest');
  });
});
