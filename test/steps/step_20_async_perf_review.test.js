/**
 * @fileoverview Tests for step_20_async_perf_review module
 * @module test/steps/step_20_async_perf_review.test
 */

import { jest } from '@jest/globals';
import {
  isAsyncHeavyProject,
  isAsyncRuntimeTarget,
  filterAsyncRuntimeTargets,
  scoreAsyncIssues,
  scoreAsyncRuntimeEntry,
  selectAsyncReviewEntries,
  inferAsyncProjectKind,
  splitAsyncPromptEntry,
  buildAsyncPromptPartitions,
  buildAsyncFileContentsBlock,
  formatAsyncPerfReport,
  hasAsyncPatterns,
  loadAsyncHistory,
  buildAsyncHistoryEntry,
  mergeAsyncHistory,
  STEP_DEFINITION,
  Step20AsyncPerfReview,
  MAX_PARTITIONS_PER_RUN,
  MAX_PROMPT_ENTRY_CHARS,
  ASYNC_HISTORY_CACHE_PATH,
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

  describe('isAsyncRuntimeTarget', () => {
    test('includes runtime source files', () => {
      expect(isAsyncRuntimeTarget('src/index.ts')).toBe(true);
      expect(isAsyncRuntimeTarget('bin/cli.js')).toBe(true);
    });

    test('excludes tests, submodules, declarations, and tooling configs', () => {
      expect(isAsyncRuntimeTarget('test/app.test.js')).toBe(false);
      expect(isAsyncRuntimeTarget('src/__tests__/app.js')).toBe(false);
      expect(isAsyncRuntimeTarget('.workflow_core/config/ai_helpers/index.js')).toBe(false);
      expect(isAsyncRuntimeTarget('src/types.d.ts')).toBe(false);
      expect(isAsyncRuntimeTarget('jest.config.ts')).toBe(false);
      expect(isAsyncRuntimeTarget('vitest.config.mts')).toBe(false);
    });

    test('excludes mocks, vendored assets, generated docs, and workflow tooling', () => {
      expect(isAsyncRuntimeTarget('__mocks__/fileMock.js')).toBe(false);
      expect(isAsyncRuntimeTarget('.github/scripts/jsdoc-audit.js')).toBe(false);
      expect(isAsyncRuntimeTarget('docs/api-generated/scripts/linenumber.js')).toBe(false);
      expect(
        isAsyncRuntimeTarget(
          'venv/lib/python3.13/site-packages/urllib3/contrib/emscripten/emscripten_fetch_worker.js'
        )
      ).toBe(false);
    });
  });

  describe('filterAsyncRuntimeTargets', () => {
    test('keeps only runtime-oriented files', () => {
      expect(
        filterAsyncRuntimeTargets([
          'src/index.ts',
          'test/index.test.ts',
          '.workflow_core/config/ai_helpers/index.js',
          'vitest.config.ts',
          '__mocks__/fileMock.js',
          'docs/api-generated/scripts/linenumber.js',
          'scripts/validate.js',
        ])
      ).toEqual(['src/index.ts', 'scripts/validate.js']);
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

  describe('scoreAsyncRuntimeEntry', () => {
    test('prioritizes files with stronger async signals', () => {
      const hotEntry = {
        relativePath: 'src/services/fetcher.ts',
        content: "new Promise((resolve) => resolve()); fetch('/api').then((r) => r.json());",
      };
      const coldEntry = {
        relativePath: 'src/constants.ts',
        content: 'export const version = "1.0.0";',
      };

      expect(scoreAsyncRuntimeEntry(hotEntry)).toBeGreaterThan(scoreAsyncRuntimeEntry(coldEntry));
    });
  });

  describe('selectAsyncReviewEntries', () => {
    test('keeps only the highest-signal files within the per-run entry budget', () => {
      const totalEntries = MAX_PARTITIONS_PER_RUN * 4 + 10;
      const entries = Array.from({ length: totalEntries }, (_, index) => ({
        relativePath: `src/file-${index}.ts`,
        content:
          index === totalEntries - 1
            ? 'export const noop = true;'
            : "fetch('/api').then((r) => r.json()); new Promise((resolve) => resolve());",
      }));
      const selected = selectAsyncReviewEntries(entries);

      expect(selected.length).toBe(MAX_PARTITIONS_PER_RUN * 4);
      expect(selected.some((entry) => entry.relativePath === 'src/file-0.ts')).toBe(true);
    });
  });

  describe('inferAsyncProjectKind', () => {
    test('returns frontend_spa for frontend framework stacks', () => {
      expect(
        inferAsyncProjectKind({
          build_system: 'npm',
          frameworks: [{ package: 'vue', name: 'Vue.js' }],
        })
      ).toBe('frontend_spa');
    });
  });

  // -------------------------------------------------------------------------
  // Prompt partition helpers
  // -------------------------------------------------------------------------

  describe('splitAsyncPromptEntry', () => {
    test('keeps small files as a single prompt entry', () => {
      const entries = splitAsyncPromptEntry({
        relativePath: 'src/app.ts',
        content: 'export const value = 1;\n',
      });

      expect(entries).toEqual([
        {
          relativePath: 'src/app.ts',
          sourcePath: 'src/app.ts',
          content: 'export const value = 1;\n',
        },
      ]);
    });

    test('splits oversized files into labeled parts instead of truncating them', () => {
      const content = Array.from({ length: 1200 }, (_, index) => `line ${index}`).join('\n');
      const entries = splitAsyncPromptEntry(
        {
          relativePath: 'src/large.ts',
          content,
        },
        1000
      );

      expect(entries.length).toBeGreaterThan(1);
      expect(entries[0].relativePath).toBe('src/large.ts (part 1/11)');
      expect(entries.at(-1)?.relativePath).toBe('src/large.ts (part 11/11)');
      expect(entries.map((entry) => entry.content).join('\n')).toBe(content);
    });
  });

  describe('buildAsyncPromptPartitions', () => {
    test('partitions source files into multiple prompt-safe batches', () => {
      const fileEntries = Array.from({ length: 5 }, (_, index) => ({
        relativePath: `src/file${index}.ts`,
        content: `export const value${index} = ${index};\n`,
      }));

      const partitions = buildAsyncPromptPartitions(fileEntries, 10_000, MAX_PROMPT_ENTRY_CHARS);

      expect(partitions).toHaveLength(2);
      expect(partitions[0].scopePaths).toEqual([
        'src/file0.ts',
        'src/file1.ts',
        'src/file2.ts',
        'src/file3.ts',
      ]);
      expect(partitions[1].scopePaths).toEqual(['src/file4.ts']);
    });

    test('caps AI review partitions at the configured max per run', () => {
      const fileEntries = Array.from({ length: MAX_PARTITIONS_PER_RUN + 5 }, (_, index) => ({
        relativePath: `src/file-${index}.ts`,
        content: `export const value${index} = ${index};\n`,
      }));
      const selected = selectAsyncReviewEntries(fileEntries, MAX_PARTITIONS_PER_RUN, 1);
      const partitions = buildAsyncPromptPartitions(selected, 80, 80);

      expect(partitions.length).toBeLessThanOrEqual(MAX_PARTITIONS_PER_RUN);
    });
  });

  describe('buildAsyncFileContentsBlock', () => {
    test('renders part labels without a truncation marker', () => {
      const block = buildAsyncFileContentsBlock([
        {
          relativePath: 'src/large.ts (part 1/2)',
          sourcePath: 'src/large.ts',
          content: 'const a = 1;\n',
        },
      ]);

      expect(block).toContain('### `src/large.ts (part 1/2)`');
      expect(block).not.toContain('...(truncated — remainder omitted)');
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
// ASYNC PATTERN HISTORY — Pure Functions
// =============================================================================

describe('hasAsyncPatterns', () => {
  test.each([
    ['async function', 'async function fetch() {}'],
    ['await expression', 'const x = await getUser();'],
    ['Promise constructor', 'return new Promise((resolve) => resolve());'],
    ['.then()', 'getData().then((d) => d);'],
    ['.catch()', 'p.catch((e) => console.error(e));'],
    ['fetch', 'const res = await fetch("/api");'],
    ['axios', 'axios.get("/api")'],
    ['setTimeout', 'setTimeout(() => {}, 100)'],
    ['setInterval', 'setInterval(tick, 1000)'],
    ['addEventListener', 'el.addEventListener("click", handler)'],
    ['removeEventListener', 'el.removeEventListener("click", handler)'],
  ])('returns true for %s', (_label, content) => {
    expect(hasAsyncPatterns(content)).toBe(true);
  });

  test.each([
    ['plain assignment', 'const x = 1;'],
    ['sync function', 'function add(a, b) { return a + b; }'],
    ['class with sync methods', 'class Foo { bar() { return 42; } }'],
    ['empty string', ''],
  ])('returns false for %s', (_label, content) => {
    expect(hasAsyncPatterns(content)).toBe(false);
  });

  test('returns false for null/undefined', () => {
    expect(hasAsyncPatterns(null)).toBe(false);
    expect(hasAsyncPatterns(undefined)).toBe(false);
  });
});

describe('loadAsyncHistory', () => {
  test('returns empty history for null', () => {
    const h = loadAsyncHistory(null);
    expect(h).toEqual({ version: 1, entries: {} });
  });

  test('returns empty history for undefined', () => {
    expect(loadAsyncHistory(undefined)).toEqual({ version: 1, entries: {} });
  });

  test('returns empty history for invalid JSON', () => {
    expect(loadAsyncHistory('not json')).toEqual({ version: 1, entries: {} });
  });

  test('returns empty history when version mismatches', () => {
    expect(loadAsyncHistory(JSON.stringify({ version: 2, entries: {} }))).toEqual({
      version: 1,
      entries: {},
    });
  });

  test('returns empty history when entries is missing', () => {
    expect(loadAsyncHistory(JSON.stringify({ version: 1 }))).toEqual({ version: 1, entries: {} });
  });

  test('returns empty history when entries is an array', () => {
    expect(loadAsyncHistory(JSON.stringify({ version: 1, entries: [] }))).toEqual({
      version: 1,
      entries: {},
    });
  });

  test('parses valid history correctly', () => {
    const raw = JSON.stringify({
      version: 1,
      entries: {
        'src/foo.js': { mtimeMs: 1000, hasAsyncPatterns: true },
        'src/bar.ts': { mtimeMs: 2000, hasAsyncPatterns: false },
      },
    });
    const h = loadAsyncHistory(raw);
    expect(h.version).toBe(1);
    expect(h.entries['src/foo.js']).toEqual({ mtimeMs: 1000, hasAsyncPatterns: true });
    expect(h.entries['src/bar.ts']).toEqual({ mtimeMs: 2000, hasAsyncPatterns: false });
  });

  test('drops individual entries with invalid shape', () => {
    const raw = JSON.stringify({
      version: 1,
      entries: {
        'src/good.js': { mtimeMs: 1000, hasAsyncPatterns: true },
        'src/bad-mtime.js': { mtimeMs: 'not-a-number', hasAsyncPatterns: true },
        'src/bad-bool.js': { mtimeMs: 1000, hasAsyncPatterns: 'yes' },
        'src/missing.js': null,
      },
    });
    const h = loadAsyncHistory(raw);
    expect(Object.keys(h.entries)).toEqual(['src/good.js']);
  });

  test('drops entries with non-finite mtimeMs', () => {
    const raw = JSON.stringify({
      version: 1,
      entries: {
        'src/inf.js': { mtimeMs: Infinity, hasAsyncPatterns: false },
        'src/nan.js': { mtimeMs: NaN, hasAsyncPatterns: false },
      },
    });
    expect(loadAsyncHistory(raw).entries).toEqual({});
  });
});

describe('buildAsyncHistoryEntry', () => {
  test('returns correct shape with hasAsyncPatterns: true', () => {
    expect(buildAsyncHistoryEntry(12345, true)).toEqual({ mtimeMs: 12345, hasAsyncPatterns: true });
  });

  test('returns correct shape with hasAsyncPatterns: false', () => {
    expect(buildAsyncHistoryEntry(99, false)).toEqual({ mtimeMs: 99, hasAsyncPatterns: false });
  });
});

describe('mergeAsyncHistory', () => {
  const emptyHistory = { version: 1, entries: {} };

  test('adds new entries from updates', () => {
    const updates = new Map([['src/new.js', { mtimeMs: 500, hasAsyncPatterns: true }]]);
    const result = mergeAsyncHistory(emptyHistory, updates, ['src/new.js']);
    expect(result.entries['src/new.js']).toEqual({ mtimeMs: 500, hasAsyncPatterns: true });
  });

  test('overrides existing entry with updated one', () => {
    const existing = {
      version: 1,
      entries: { 'src/foo.js': { mtimeMs: 100, hasAsyncPatterns: false } },
    };
    const updates = new Map([['src/foo.js', { mtimeMs: 200, hasAsyncPatterns: true }]]);
    const result = mergeAsyncHistory(existing, updates, ['src/foo.js']);
    expect(result.entries['src/foo.js']).toEqual({ mtimeMs: 200, hasAsyncPatterns: true });
  });

  test('preserves existing entries not in updates', () => {
    const existing = {
      version: 1,
      entries: { 'src/unchanged.js': { mtimeMs: 100, hasAsyncPatterns: false } },
    };
    const result = mergeAsyncHistory(existing, new Map(), ['src/unchanged.js']);
    expect(result.entries['src/unchanged.js']).toEqual({ mtimeMs: 100, hasAsyncPatterns: false });
  });

  test('prunes entries for paths not in currentPaths', () => {
    const existing = {
      version: 1,
      entries: {
        'src/deleted.js': { mtimeMs: 1, hasAsyncPatterns: true },
        'src/kept.js': { mtimeMs: 2, hasAsyncPatterns: false },
      },
    };
    const result = mergeAsyncHistory(existing, new Map(), ['src/kept.js']);
    expect(result.entries['src/deleted.js']).toBeUndefined();
    expect(result.entries['src/kept.js']).toBeDefined();
  });

  test('returns version 1 history', () => {
    const result = mergeAsyncHistory(emptyHistory, new Map(), []);
    expect(result.version).toBe(1);
  });
});

// =============================================================================
// IMPURE WRAPPER TESTS (mocked dependencies)
// =============================================================================

describe('Step20AsyncPerfReview - Wrapper', () => {
  const makeFileOps = (
    files = ['src/index.js', 'src/utils.ts'],
    content = 'async function foo() { await bar(); }',
    options = {}
  ) => ({
    listDirectoryRecursive: jest.fn().mockResolvedValue(files),
    exists: jest
      .fn()
      .mockImplementation((p) =>
        Promise.resolve(Boolean(options.workflowConfig) && p.endsWith('.workflow-config.yaml'))
      ),
    stat: jest.fn().mockResolvedValue({ modified: new Date(1_000_000) }),
    writeFile: jest.fn().mockResolvedValue(undefined),
    readFile: jest.fn().mockImplementation((p) => {
      if (p.endsWith('ai_helpers.yaml') || p.includes('ai_helpers')) {
        return Promise.resolve(
          'async_perf_engineer_prompt:\n' +
            '  role_ref: async_perf_engineer\n' +
            '  task_template: |\n' +
            '    {partition_header}\n' +
            '    Project: {project_name}\n' +
            '    Project Summary: {project_summary}\n' +
            '    Kind: {project_kind}\n' +
            '    Language: {primary_language}\n' +
            '    Build: {build_system}\n' +
            '    Test: {test_framework}\n' +
            '    Files: {source_file_count}\n' +
            '    Review Scope Files: {modified_count}\n' +
            '    Paths: {file_paths}\n' +
            '    Scope: {partition_scope_note}\n' +
            '    **File Contents (source excerpts for this request):**\n' +
            '    {file_content_block}\n' +
            '  approach: "approach"'
        );
      }
      if (options.workflowConfig && p.endsWith('.workflow-config.yaml')) {
        return Promise.resolve(options.workflowConfig);
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
    withCache: jest.fn().mockImplementation(async (_prompt, _context, aiFunction) => aiFunction()),
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

  test('skips runtime review when only tests and tooling files are present', async () => {
    const fileOps = makeFileOps([
      'test/app.test.js',
      'src/__tests__/helpers.ts',
      '.workflow_core/config/ai_helpers/index.js',
      'vitest.config.ts',
    ]);
    const aiHelper = makeAiHelper();
    const step = new Step20AsyncPerfReview({
      fileOps,
      backlog: makeBacklog(),
      aiHelper,
      aiCache: makeAiCache(),
      techStack: makeTechStack(),
    });

    const result = await step.execute('/project');

    expect(result.success).toBe(true);
    expect(result.skipped).toBe(true);
    expect(result.message).toBe('No runtime JS/TS files found');
    expect(aiHelper.executeRequest).not.toHaveBeenCalled();
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
      withCache: jest.fn().mockResolvedValue({ content: 'cached AI content' }),
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

  test('marks result as degraded when AI analysis fails', async () => {
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
    expect(result.degraded).toBe(true);
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('AI timeout')])
    );
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
    expect(promptArg).toContain('Review Scope Files: 3');
  });

  test('resolves project kind from workflow config when option is omitted', async () => {
    const aiHelper = makeAiHelper('findings');
    const step = new Step20AsyncPerfReview({
      fileOps: makeFileOps(['src/index.js'], 'async function init() { await fetch("/api"); }', {
        workflowConfig: 'project:\n  kind: location_based_service\n',
      }),
      backlog: makeBacklog(),
      aiHelper,
      aiCache: makeAiCache(),
      techStack: makeTechStack({ frameworks: [{ package: 'vue', name: 'Vue.js' }] }),
    });

    await step.execute('/project', {
      projectName: 'my-app',
      projectDescription: 'A sample SPA',
    });

    const [promptArg] = aiHelper.executeRequest.mock.calls[0];
    expect(promptArg).toContain('location_based_service');
    expect(promptArg).not.toContain('nodejs_api');
  });

  test('prompt includes partition-scoped file paths plus total source count context', async () => {
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
    expect(promptArg).toContain('Files: 25 total (4 covered in this request)');
    expect(promptArg).toContain('src/file0.js');
    expect(promptArg).toContain('src/file3.js');
    expect(promptArg).not.toContain('src/file24.js');
  });

  test('prompt lists only the files in the current partition request', async () => {
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
    expect(aiHelper.executeRequest.mock.calls.length).toBeGreaterThan(1);
    expect(promptArg).toContain('[Partition 1 of');
    expect(promptArg).toContain('src/file0.js');
    expect(promptArg).toContain('src/file3.js');
    expect(promptArg).not.toContain('src/file24.js');
  });

  test('runs multiple AI requests when the source payload needs partitioning', async () => {
    const files = Array.from({ length: 5 }, (_, i) => `src/file${i}.ts`);
    const aiHelper = {
      initialize: jest.fn().mockResolvedValue(true),
      executeRequest: jest
        .fn()
        .mockResolvedValueOnce({ content: 'partition one findings' })
        .mockResolvedValueOnce({ content: 'partition two findings' }),
    };
    const step = new Step20AsyncPerfReview({
      fileOps: makeFileOps(files, 'async function a() { await Promise.resolve(1); }\n'),
      backlog: makeBacklog(),
      aiHelper,
      aiCache: makeAiCache(),
      techStack: makeTechStack(),
    });

    const result = await step.execute('/project');

    expect(aiHelper.executeRequest).toHaveBeenCalledTimes(2);
    expect(aiHelper.executeRequest.mock.calls[0][0]).toContain('[Partition 1 of 2');
    expect(aiHelper.executeRequest.mock.calls[1][0]).toContain('[Partition 2 of 2');
    expect(aiHelper.executeRequest.mock.calls[0][0]).toContain(
      'split across multiple prompt logs to avoid truncated code excerpts'
    );
    expect(result.report).toContain('#### Partition 1 of 2');
    expect(result.report).toContain('partition one findings');
    expect(result.report).toContain('partition two findings');
  });

  test('splits oversized files into part-labeled prompt entries instead of truncating them', async () => {
    const largeContent = `${'async function line() { await fetch("/api"); }\n'.repeat(100)}const end = true;\n`;
    const aiHelper = makeAiHelper('large file findings');
    const step = new Step20AsyncPerfReview({
      fileOps: makeFileOps(['src/large.ts'], largeContent),
      backlog: makeBacklog(),
      aiHelper,
      aiCache: makeAiCache(),
      techStack: makeTechStack(),
    });

    await step.execute('/project');

    const promptArg = aiHelper.executeRequest.mock.calls[0][0];
    expect(promptArg).toContain('src/large.ts (part 1/');
    expect(promptArg).not.toContain('...(truncated — remainder omitted)');
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

  // ===========================================================================
  // History cache behavior
  // ===========================================================================

  describe('async-pattern history cache', () => {
    const MTIME = new Date(1_000_000);

    test('skips file read when history shows no async patterns and mtime is unchanged', async () => {
      const cachedHistory = JSON.stringify({
        version: 1,
        entries: {
          'src/index.js': { mtimeMs: MTIME.getTime(), hasAsyncPatterns: false },
          'src/utils.ts': { mtimeMs: MTIME.getTime(), hasAsyncPatterns: false },
        },
      });

      const fileOps = {
        listDirectoryRecursive: jest.fn().mockResolvedValue(['src/index.js', 'src/utils.ts']),
        exists: jest.fn().mockResolvedValue(false),
        stat: jest.fn().mockResolvedValue({ modified: MTIME }),
        writeFile: jest.fn().mockResolvedValue(undefined),
        readFile: jest.fn().mockImplementation((p) => {
          if (p.includes(ASYNC_HISTORY_CACHE_PATH)) return Promise.resolve(cachedHistory);
          if (p.includes('ai_helpers')) {
            return Promise.resolve(
              'async_perf_engineer_prompt:\n  role_ref: r\n  task_template: "{file_content_block}"\n  approach: a'
            );
          }
          if (p.includes('prompt_roles')) return Promise.resolve('roles: {}');
          // Should NOT be called for cached no-async files
          return Promise.reject(new Error('unexpected readFile call'));
        }),
      };

      const aiHelper = makeAiHelper();
      const step = new Step20AsyncPerfReview({
        fileOps,
        backlog: makeBacklog(),
        aiHelper,
        aiCache: makeAiCache(),
        techStack: makeTechStack(),
      });

      const result = await step.execute('/project');
      expect(result.success).toBe(true);
      // No runtime files with async patterns — AI should not have been called
      expect(aiHelper.executeRequest).not.toHaveBeenCalled();
      expect(result.skippedCount).toBe(2);
    });

    test('re-reads file and updates history when mtime has changed', async () => {
      const OLD_MTIME = new Date(999_000);
      const NEW_MTIME = new Date(1_001_000);

      const cachedHistory = JSON.stringify({
        version: 1,
        entries: {
          'src/index.js': { mtimeMs: OLD_MTIME.getTime(), hasAsyncPatterns: false },
        },
      });

      const fileOps = {
        listDirectoryRecursive: jest.fn().mockResolvedValue(['src/index.js']),
        exists: jest.fn().mockResolvedValue(false),
        stat: jest.fn().mockResolvedValue({ modified: NEW_MTIME }),
        writeFile: jest.fn().mockResolvedValue(undefined),
        readFile: jest.fn().mockImplementation((p) => {
          if (p.includes(ASYNC_HISTORY_CACHE_PATH)) return Promise.resolve(cachedHistory);
          if (p.includes('ai_helpers')) {
            return Promise.resolve(
              'async_perf_engineer_prompt:\n  role_ref: r\n  task_template: "{file_content_block}"\n  approach: a'
            );
          }
          if (p.includes('prompt_roles')) return Promise.resolve('roles: {}');
          // File now has async patterns after modification
          return Promise.resolve('async function updated() { await fetch("/new"); }');
        }),
      };

      const aiHelper = makeAiHelper('analysis result');
      const step = new Step20AsyncPerfReview({
        fileOps,
        backlog: makeBacklog(),
        aiHelper,
        aiCache: makeAiCache(),
        techStack: makeTechStack(),
      });

      const result = await step.execute('/project');
      expect(result.success).toBe(true);
      // Re-read file has async patterns — AI should have been called
      expect(aiHelper.executeRequest).toHaveBeenCalled();

      // Updated history should be written with new mtime
      const writtenHistoryCall = fileOps.writeFile.mock.calls.find(([p]) =>
        p.includes(ASYNC_HISTORY_CACHE_PATH)
      );
      expect(writtenHistoryCall).toBeDefined();
      const writtenHistory = JSON.parse(writtenHistoryCall[1]);
      expect(writtenHistory.entries['src/index.js'].mtimeMs).toBe(NEW_MTIME.getTime());
      expect(writtenHistory.entries['src/index.js'].hasAsyncPatterns).toBe(true);
    });

    test('excludes files without async patterns from AI analysis', async () => {
      const fileOps = {
        listDirectoryRecursive: jest.fn().mockResolvedValue(['src/worker.js', 'src/plain.js']),
        exists: jest.fn().mockResolvedValue(false),
        stat: jest.fn().mockResolvedValue({ modified: new Date(0) }),
        writeFile: jest.fn().mockResolvedValue(undefined),
        readFile: jest.fn().mockImplementation((p) => {
          if (p.includes(ASYNC_HISTORY_CACHE_PATH)) return Promise.reject(new Error('no history'));
          if (p.includes('ai_helpers')) {
            return Promise.resolve(
              'async_perf_engineer_prompt:\n  role_ref: r\n  task_template: "{file_content_block}"\n  approach: a'
            );
          }
          if (p.includes('prompt_roles')) return Promise.resolve('roles: {}');
          if (p.includes('worker.js')) return Promise.resolve('async function a() { await b(); }');
          return Promise.resolve('const x = 1; // plain sync file');
        }),
      };

      const aiHelper = makeAiHelper('findings');
      const step = new Step20AsyncPerfReview({
        fileOps,
        backlog: makeBacklog(),
        aiHelper,
        aiCache: makeAiCache(),
        techStack: makeTechStack(),
      });

      await step.execute('/project');

      expect(aiHelper.executeRequest).toHaveBeenCalled();
      const [promptArg] = aiHelper.executeRequest.mock.calls[0];
      // worker.js should be in prompt
      expect(promptArg).toContain('worker.js');
      // plain.js should NOT be in prompt
      expect(promptArg).not.toContain('plain.js');
    });

    test('persists history after each run with pruned entries', async () => {
      const fileOps = makeFileOps(['src/index.js']);
      const step = new Step20AsyncPerfReview({
        fileOps,
        backlog: makeBacklog(),
        aiHelper: makeAiHelper(),
        aiCache: makeAiCache(),
        techStack: makeTechStack(),
      });

      await step.execute('/project');

      const writtenCall = fileOps.writeFile.mock.calls.find(([p]) =>
        p.includes(ASYNC_HISTORY_CACHE_PATH)
      );
      expect(writtenCall).toBeDefined();
      const saved = JSON.parse(writtenCall[1]);
      expect(saved.version).toBe(1);
      expect(typeof saved.entries).toBe('object');
    });
  });
});
