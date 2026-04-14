/**
 * @fileoverview Tests for step_23_perf_review module
 * @module test/steps/step_23_perf_review.test
 */

import { jest } from '@jest/globals';
import {
  isPerformanceSensitiveProject,
  scorePerfIssues,
  splitPerformancePromptEntry,
  buildPerformancePromptPartitions,
  buildPerformanceFileContentsBlock,
  formatPerfReport,
  STEP_DEFINITION,
  Step23PerfReview,
  MAX_PROMPT_ENTRY_CHARS,
} from '../../src/steps/step_23_perf_review.js';
import { STEP_KIND } from '../../src/steps/step_contract.js';

// =============================================================================
// PURE FUNCTION TESTS
// =============================================================================

describe('step_23_perf_review - Pure Functions', () => {
  // -------------------------------------------------------------------------
  // isPerformanceSensitiveProject
  // -------------------------------------------------------------------------

  describe('isPerformanceSensitiveProject', () => {
    test('returns true for .js files', () => {
      expect(isPerformanceSensitiveProject(['src/index.js'])).toBe(true);
    });

    test('returns true for .ts files', () => {
      expect(isPerformanceSensitiveProject(['src/app.ts'])).toBe(true);
    });

    test('returns true for .tsx files', () => {
      expect(isPerformanceSensitiveProject(['src/App.tsx'])).toBe(true);
    });

    test('returns true for .mjs files', () => {
      expect(isPerformanceSensitiveProject(['src/utils.mjs'])).toBe(true);
    });

    test('returns true for .cjs files', () => {
      expect(isPerformanceSensitiveProject(['src/config.cjs'])).toBe(true);
    });

    test('returns false for non-JS/TS files only', () => {
      expect(isPerformanceSensitiveProject(['README.md', 'config.yaml', 'styles.css'])).toBe(false);
    });

    test('returns false for empty array', () => {
      expect(isPerformanceSensitiveProject([])).toBe(false);
    });

    test('returns true for mixed list containing a .ts file', () => {
      expect(isPerformanceSensitiveProject(['README.md', 'src/index.ts'])).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // scorePerfIssues
  // -------------------------------------------------------------------------

  describe('scorePerfIssues', () => {
    test('returns zero scores for empty contents', () => {
      const scores = scorePerfIssues([]);
      expect(scores.nestedLoopCount).toBe(0);
      expect(scores.syncIoCount).toBe(0);
      expect(scores.jsonParseCount).toBe(0);
      expect(scores.objectInLoopCount).toBe(0);
      expect(scores.totalIssues).toBe(0);
    });

    test('returns zero scores for empty string', () => {
      const scores = scorePerfIssues(['']);
      expect(scores.totalIssues).toBe(0);
    });

    test('counts readFileSync as synchronous I/O', () => {
      const code = `
const data = fs.readFileSync('file.txt', 'utf8');
const data2 = readFileSync('other.txt');
`;
      const scores = scorePerfIssues([code]);
      expect(scores.syncIoCount).toBe(2);
    });

    test('counts writeFileSync as synchronous I/O', () => {
      const code = `fs.writeFileSync('out.txt', content);`;
      const scores = scorePerfIssues([code]);
      expect(scores.syncIoCount).toBe(1);
    });

    test('counts multiple sync I/O variants', () => {
      const code = `
readFileSync('a');
writeFileSync('b', '');
appendFileSync('c', '');
existsSync('d');
mkdirSync('e');
readdirSync('f');
`;
      const scores = scorePerfIssues([code]);
      expect(scores.syncIoCount).toBe(6);
    });

    test('counts JSON.parse calls', () => {
      const code = `
const obj1 = JSON.parse(rawData);
const obj2 = JSON.parse(otherData);
`;
      const scores = scorePerfIssues([code]);
      expect(scores.jsonParseCount).toBe(2);
    });

    test('counts JSON.stringify calls', () => {
      const code = `const s = JSON.stringify(obj);`;
      const scores = scorePerfIssues([code]);
      expect(scores.jsonParseCount).toBe(1);
    });

    test('totalIssues is sum of all individual counts', () => {
      const code = `
readFileSync('a');
JSON.parse(x);
for (let i = 0; i < n; i++) { for (let j = 0; j < m; j++) {} }
`;
      const scores = scorePerfIssues([code]);
      expect(scores.totalIssues).toBe(
        scores.nestedLoopCount +
          scores.syncIoCount +
          scores.jsonParseCount +
          scores.objectInLoopCount
      );
    });

    test('processes multiple file contents together', () => {
      const file1 = `readFileSync('a');`;
      const file2 = `readFileSync('b');`;
      const scores = scorePerfIssues([file1, file2]);
      expect(scores.syncIoCount).toBe(2);
    });

    test('returns zero for code with no anti-patterns', () => {
      const code = `
export function add(a, b) { return a + b; }
export const greet = (name) => \`Hello, \${name}\`;
`;
      const scores = scorePerfIssues([code]);
      expect(scores.syncIoCount).toBe(0);
      expect(scores.jsonParseCount).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Prompt partition helpers
  // -------------------------------------------------------------------------

  describe('splitPerformancePromptEntry', () => {
    test('keeps small files as a single prompt entry', () => {
      const entries = splitPerformancePromptEntry({
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
      const entries = splitPerformancePromptEntry(
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

  describe('buildPerformancePromptPartitions', () => {
    test('partitions source files into multiple prompt-safe batches', () => {
      const fileEntries = Array.from({ length: 5 }, (_, index) => ({
        relativePath: `src/file${index}.ts`,
        content: `export const value${index} = ${index};\n`,
      }));

      const partitions = buildPerformancePromptPartitions(fileEntries, 10_000, MAX_PROMPT_ENTRY_CHARS);

      expect(partitions).toHaveLength(2);
      expect(partitions[0].scopePaths).toEqual([
        'src/file0.ts',
        'src/file1.ts',
        'src/file2.ts',
        'src/file3.ts',
      ]);
      expect(partitions[1].scopePaths).toEqual(['src/file4.ts']);
    });
  });

  describe('buildPerformanceFileContentsBlock', () => {
    test('renders part labels without a truncation marker', () => {
      const block = buildPerformanceFileContentsBlock([
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
  // formatPerfReport
  // -------------------------------------------------------------------------

  describe('formatPerfReport', () => {
    const sampleScores = {
      nestedLoopCount: 2,
      syncIoCount: 5,
      jsonParseCount: 3,
      objectInLoopCount: 1,
      totalIssues: 11,
    };

    test('contains the Performance Review heading', () => {
      const report = formatPerfReport('AI findings', sampleScores);
      expect(report).toContain('## Performance Review');
    });

    test('contains the Heuristic Pre-scan section', () => {
      const report = formatPerfReport('AI findings', sampleScores);
      expect(report).toContain('### Heuristic Pre-scan');
    });

    test('contains the AI Analysis section', () => {
      const report = formatPerfReport('AI findings', sampleScores);
      expect(report).toContain('### AI Analysis');
    });

    test('includes correct nestedLoopCount in table', () => {
      const report = formatPerfReport('', sampleScores);
      expect(report).toContain('| Nested loops (O(n²) risk) | 2 |');
    });

    test('includes correct syncIoCount in table', () => {
      const report = formatPerfReport('', sampleScores);
      expect(report).toContain('| Synchronous I/O operations | 5 |');
    });

    test('includes correct jsonParseCount in table', () => {
      const report = formatPerfReport('', sampleScores);
      expect(report).toContain('| JSON.parse/stringify calls | 3 |');
    });

    test('includes correct objectInLoopCount in table', () => {
      const report = formatPerfReport('', sampleScores);
      expect(report).toContain('| Object instantiation inside loops | 1 |');
    });

    test('includes total issues in bold', () => {
      const report = formatPerfReport('', sampleScores);
      expect(report).toContain('**11**');
    });

    test('includes AI content when provided', () => {
      const report = formatPerfReport('O(n²) loop detected in processItems', sampleScores);
      expect(report).toContain('O(n²) loop detected in processItems');
    });

    test('shows fallback message when aiContent is empty string', () => {
      const report = formatPerfReport('', sampleScores);
      expect(report).toContain('_No AI analysis available._');
    });

    test('does not show fallback when aiContent is present', () => {
      const report = formatPerfReport('Some findings', sampleScores);
      expect(report).not.toContain('_No AI analysis available._');
    });
  });

  // -------------------------------------------------------------------------
  // STEP_DEFINITION
  // -------------------------------------------------------------------------

  describe('STEP_DEFINITION', () => {
    test('has id step_23', () => {
      expect(STEP_DEFINITION.id).toBe('step_23');
    });

    test('has name Performance Review', () => {
      expect(STEP_DEFINITION.name).toBe('Performance Review');
    });

    test('has ANALYSIS kind', () => {
      expect(STEP_DEFINITION.kind).toBe(STEP_KIND.ANALYSIS);
    });

    test('depends on step_22', () => {
      expect(STEP_DEFINITION.dependencies).toContain('step_22');
    });

    test('has a non-empty description', () => {
      expect(typeof STEP_DEFINITION.description).toBe('string');
      expect(STEP_DEFINITION.description.length).toBeGreaterThan(0);
    });
  });
});

// =============================================================================
// IMPURE WRAPPER TESTS (mocked dependencies)
// =============================================================================

describe('Step23PerfReview - Wrapper', () => {
  const makeFileOps = (files = ['src/index.js', 'src/utils.ts'], content = 'const x = 1;') => ({
    listDirectoryRecursive: jest.fn().mockResolvedValue(files),
    readFile: jest.fn().mockImplementation((p) => {
      if (p.endsWith('ai_helpers.yaml') || p.includes('ai_helpers')) {
        return Promise.resolve(
          'performance_review_prompt:\n' +
            '  role_ref: performance_engineer\n' +
            '  task_template: |\n' +
            '    {partition_header}\n' +
            '    Project: {project_name}\n' +
            '    Project Summary: {project_summary}\n' +
            '    Language: {primary_language}\n' +
            '    Build: {build_system}\n' +
            '    Files: {source_file_count}\n' +
            '    Paths: {file_paths}\n' +
            '    {partition_scope_note}\n' +
            '    **File Contents (source excerpts for this request):**\n' +
            '    {file_content_block}\n' +
            '  approach: "performance review approach"'
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
      primary_language: 'javascript',
      ...overrides,
    }),
  });

  const makeBacklog = () => ({
    saveStepSummary: jest.fn().mockResolvedValue(undefined),
  });

  const makeAiHelper = (content = 'Performance findings') => ({
    initialize: jest.fn().mockResolvedValue(true),
    executeRequest: jest.fn().mockResolvedValue({ content }),
  });

  const makeAiCache = () => {
    const cache = {
      init: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      withCache: jest.fn().mockImplementation(async (prompt, context, aiFunction) => {
        const cached = await cache.get(`${prompt}|${context}`);
        if (cached !== null) return cached;
        const response = await aiFunction();
        await cache.set(`${prompt}|${context}`, response, { prompt, context });
        return response;
      }),
    };
    return cache;
  };

  test('skips gracefully when no JS/TS files found', async () => {
    const fileOps = makeFileOps([]);
    const step = new Step23PerfReview({
      fileOps,
      backlog: makeBacklog(),
      aiHelper: makeAiHelper(),
      aiCache: makeAiCache(),
      techStack: makeTechStack(),
    });

    const result = await step.execute('/project');
    expect(result.success).toBe(true);
    expect(result.skipped).toBe(true);
    expect(result.message).toContain('No JS/TS files');
  });

  test('skips when only non-JS files are present', async () => {
    const fileOps = makeFileOps(['README.md', 'config.yaml', 'styles.css']);
    const step = new Step23PerfReview({
      fileOps,
      backlog: makeBacklog(),
      aiHelper: makeAiHelper(),
      aiCache: makeAiCache(),
      techStack: makeTechStack(),
    });

    const result = await step.execute('/project');
    expect(result.skipped).toBe(true);
  });

  test('executes successfully when JS/TS files are present', async () => {
    const step = new Step23PerfReview({
      fileOps: makeFileOps(),
      backlog: makeBacklog(),
      aiHelper: makeAiHelper(),
      aiCache: makeAiCache(),
      techStack: makeTechStack(),
    });

    const result = await step.execute('/project');
    expect(result.success).toBe(true);
    expect(result.skipped).toBe(false);
  });

  test('calls saveStepSummary with step number 23', async () => {
    const backlog = makeBacklog();
    const step = new Step23PerfReview({
      fileOps: makeFileOps(),
      backlog,
      aiHelper: makeAiHelper(),
      aiCache: makeAiCache(),
      techStack: makeTechStack(),
    });

    await step.execute('/project');
    expect(backlog.saveStepSummary).toHaveBeenCalledWith(
      23,
      'Performance Review',
      expect.any(String)
    );
  });

  test('result includes fileCount, scores, and report', async () => {
    const step = new Step23PerfReview({
      fileOps: makeFileOps(),
      backlog: makeBacklog(),
      aiHelper: makeAiHelper(),
      aiCache: makeAiCache(),
      techStack: makeTechStack(),
    });

    const result = await step.execute('/project');
    expect(typeof result.fileCount).toBe('number');
    expect(result.scores).toBeDefined();
    expect(typeof result.report).toBe('string');
  });

  test('handles AI unavailable gracefully', async () => {
    const aiHelper = {
      initialize: jest.fn().mockResolvedValue(false),
      executeRequest: jest.fn(),
    };
    const step = new Step23PerfReview({
      fileOps: makeFileOps(),
      backlog: makeBacklog(),
      aiHelper,
      aiCache: makeAiCache(),
      techStack: makeTechStack(),
    });

    const result = await step.execute('/project');
    expect(result.success).toBe(true);
    expect(aiHelper.executeRequest).not.toHaveBeenCalled();
  });

  test('handles AI errors gracefully (does not throw)', async () => {
    const aiHelper = {
      initialize: jest.fn().mockResolvedValue(true),
      executeRequest: jest.fn().mockRejectedValue(new Error('AI timeout')),
    };
    const step = new Step23PerfReview({
      fileOps: makeFileOps(),
      backlog: makeBacklog(),
      aiHelper,
      aiCache: makeAiCache(),
      techStack: makeTechStack(),
    });

    const result = await step.execute('/project');
    expect(result.success).toBe(true);
  });

  test('uses cached AI response when available', async () => {
    const aiHelper = makeAiHelper();
    const aiCache = {
      init: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue('cached perf report'),
      set: jest.fn().mockResolvedValue(undefined),
      withCache: jest.fn().mockImplementation(async (prompt, context, aiFunction) => {
        const cached = await aiCache.get(`${prompt}|${context}`);
        if (cached !== null) return cached;
        const response = await aiFunction();
        await aiCache.set(`${prompt}|${context}`, response, { prompt, context });
        return response;
      }),
    };
    const step = new Step23PerfReview({
      fileOps: makeFileOps(),
      backlog: makeBacklog(),
      aiHelper,
      aiCache,
      techStack: makeTechStack(),
    });

    await step.execute('/project');
    expect(aiHelper.executeRequest).not.toHaveBeenCalled();
  });

  test('accepts sourceFiles override via options', async () => {
    const fileOps = makeFileOps();
    const step = new Step23PerfReview({
      fileOps,
      backlog: makeBacklog(),
      aiHelper: makeAiHelper(),
      aiCache: makeAiCache(),
      techStack: makeTechStack(),
    });

    await step.execute('/project', { sourceFiles: ['custom/file.ts'] });
    expect(fileOps.listDirectoryRecursive).not.toHaveBeenCalled();
  });

  test('prompt includes enriched context fields from tech stack', async () => {
    const aiHelper = makeAiHelper('findings');
    const step = new Step23PerfReview({
      fileOps: makeFileOps(['src/index.js', 'src/utils.ts']),
      backlog: makeBacklog(),
      aiHelper,
      aiCache: makeAiCache(),
      techStack: makeTechStack({ build_system: 'vite' }),
    });

    await step.execute('/project', {
      projectName: 'my-lib',
      projectDescription: 'A performance-critical library',
    });

    const [promptArg] = aiHelper.executeRequest.mock.calls[0];
    expect(promptArg).toContain('my-lib');
    expect(promptArg).toContain('A performance-critical library');
    expect(promptArg).toContain('vite');
  });

  test('prompt lists only the files in the current partition request', async () => {
    const files = Array.from({ length: 25 }, (_, i) => `src/file${i}.js`);
    const aiHelper = makeAiHelper('findings');
    const step = new Step23PerfReview({
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
    const step = new Step23PerfReview({
      fileOps: makeFileOps(files, 'export const value = 1;\n'),
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
    const largeContent = `${'const line = 1;\n'.repeat(350)}const end = true;\n`;
    const aiHelper = makeAiHelper('large file findings');
    const step = new Step23PerfReview({
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
    const step = new Step23PerfReview({
      fileOps: makeFileOps(),
      backlog: makeBacklog(),
      aiHelper,
      aiCache: makeAiCache(),
      techStack,
    });

    const result = await step.execute('/project');
    expect(result.success).toBe(true);
    const [promptArg] = aiHelper.executeRequest.mock.calls[0];
    expect(promptArg).toContain('npm');
  });

  test('prompt injects file content block once instead of appending a duplicate copy', async () => {
    const aiHelper = makeAiHelper('findings');
    const step = new Step23PerfReview({
      fileOps: makeFileOps(['src/index.js'], 'const x = JSON.parse(raw);'),
      backlog: makeBacklog(),
      aiHelper,
      aiCache: makeAiCache(),
      techStack: makeTechStack(),
    });

    await step.execute('/project');

    const [promptArg] = aiHelper.executeRequest.mock.calls[0];
    expect(promptArg).toContain('**File Contents (source excerpts for this request):**');
    expect(promptArg).toContain('### `src/index.js`');
    expect((promptArg.match(/### `src\/index\.js`/g) || []).length).toBe(1);
  });

  test('re-throws errors from file listing', async () => {
    const fileOps = {
      listDirectoryRecursive: jest.fn().mockRejectedValue(new Error('disk error')),
      readFile: jest.fn(),
    };
    const step = new Step23PerfReview({
      fileOps,
      backlog: makeBacklog(),
      aiHelper: makeAiHelper(),
      aiCache: makeAiCache(),
      techStack: makeTechStack(),
    });

    await expect(step.execute('/project')).rejects.toThrow('disk error');
  });

  test('instantiates with default dependencies when no options provided', () => {
    const step = new Step23PerfReview();
    expect(step.fileOps).toBeDefined();
    expect(step.backlog).toBeDefined();
    expect(step.aiHelper).toBeDefined();
    expect(step.aiCache).toBeDefined();
    expect(step.techStack).toBeDefined();
  });
});
