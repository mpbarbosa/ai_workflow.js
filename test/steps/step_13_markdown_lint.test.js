/**
 * Tests for Step 13: Markdown Linting
 * @group steps
 */

import { jest } from '@jest/globals';
import {
  Step13MarkdownLint,
  filterMarkdownFiles,
  shouldExcludePath,
  parseMdlOutput,
  groupIssuesByFile,
  groupIssuesByRule,
  calculateLintStats,
  checkMissingSpaceAfterHash,
  checkMalformedBold,
  checkTrailingWhitespace,
  checkMultipleBlankLines,
  detectAntiPatterns,
  formatLintReport,
  determineLintStatus,
} from '../../src/steps/step_13_markdown_lint.js';

describe('Step 13: Markdown Linting', () => {
  // ========================================================================
  // PURE FUNCTIONS - Markdown File Analysis
  // ========================================================================

  describe('filterMarkdownFiles', () => {
    test('filters markdown files', () => {
      const files = ['README.md', 'src/index.js', 'docs/guide.md', 'test.txt'];
      const result = filterMarkdownFiles(files);
      expect(result).toEqual(['README.md', 'docs/guide.md']);
    });

    test('returns empty for no markdown files', () => {
      const files = ['src/index.js', 'test.txt'];
      expect(filterMarkdownFiles(files)).toEqual([]);
    });
  });

  describe('shouldExcludePath', () => {
    test('excludes node_modules', () => {
      expect(shouldExcludePath('node_modules/package/README.md')).toBe(true);
      expect(shouldExcludePath('./node_modules/package/README.md')).toBe(true);
    });

    test('excludes coverage directory', () => {
      expect(shouldExcludePath('coverage/lcov-report/index.html')).toBe(true);
    });

    test('excludes .git directory', () => {
      expect(shouldExcludePath('.git/HEAD')).toBe(true);
    });

    test('does not exclude normal paths', () => {
      expect(shouldExcludePath('README.md')).toBe(false);
      expect(shouldExcludePath('docs/guide.md')).toBe(false);
    });

    test('works with custom exclude list', () => {
      expect(shouldExcludePath('vendor/package/README.md', ['vendor'])).toBe(true);
      expect(shouldExcludePath('src/README.md', ['vendor'])).toBe(false);
    });

    test('excludes .ai_workflow files', () => {
      expect(shouldExcludePath('/project/.ai_workflow/backlog/step_01.md')).toBe(true);
      expect(shouldExcludePath('/project/.ai_workflow/logs/workflow_123/prompts/p.md')).toBe(true);
      expect(shouldExcludePath('/project/docs/guide.md')).toBe(false);
    });
  });

  describe('parseMdlOutput', () => {
    test('parses empty output', () => {
      expect(parseMdlOutput('')).toEqual([]);
      expect(parseMdlOutput('   \n  ')).toEqual([]);
    });

    test('parses single issue', () => {
      const output = 'README.md:5: MD013 Line length';
      const result = parseMdlOutput(output);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        file: 'README.md',
        line: 5,
        rule: 'MD013',
        message: 'Line length',
        severity: 'warning',
      });
    });

    test('parses multiple issues', () => {
      const output = `README.md:5: MD013 Line length
docs/guide.md:10: MD022 Blank lines around headers`;
      const result = parseMdlOutput(output);
      expect(result).toHaveLength(2);
      expect(result[0].file).toBe('README.md');
      expect(result[1].file).toBe('docs/guide.md');
    });

    test('handles file paths with colons', () => {
      const output = 'C:/projects/README.md:5: MD013 Line length';
      const result = parseMdlOutput(output);
      expect(result).toHaveLength(1);
      expect(result[0].file).toBe('C:/projects/README.md');
    });
  });

  describe('groupIssuesByFile', () => {
    test('groups empty issues', () => {
      expect(groupIssuesByFile([])).toEqual({});
    });

    test('groups issues by file', () => {
      const issues = [
        { file: 'README.md', rule: 'MD013' },
        { file: 'README.md', rule: 'MD022' },
        { file: 'CHANGELOG.md', rule: 'MD013' },
      ];
      const result = groupIssuesByFile(issues);
      expect(result['README.md']).toHaveLength(2);
      expect(result['CHANGELOG.md']).toHaveLength(1);
    });
  });

  describe('groupIssuesByRule', () => {
    test('groups empty issues', () => {
      expect(groupIssuesByRule([])).toEqual({});
    });

    test('groups issues by rule', () => {
      const issues = [
        { file: 'README.md', rule: 'MD013' },
        { file: 'CHANGELOG.md', rule: 'MD013' },
        { file: 'README.md', rule: 'MD022' },
      ];
      const result = groupIssuesByRule(issues);
      expect(result['MD013']).toHaveLength(2);
      expect(result['MD022']).toHaveLength(1);
    });
  });

  describe('calculateLintStats', () => {
    test('calculates stats for no issues', () => {
      const stats = calculateLintStats([], 10);
      expect(stats.totalIssues).toBe(0);
      expect(stats.filesWithIssues).toBe(0);
      expect(stats.filesChecked).toBe(10);
      expect(stats.cleanFiles).toBe(10);
      expect(stats.issuesPerFile).toBe(0);
    });

    test('calculates stats with issues', () => {
      const issues = [
        { file: 'README.md', rule: 'MD013' },
        { file: 'README.md', rule: 'MD022' },
        { file: 'CHANGELOG.md', rule: 'MD013' },
      ];
      const stats = calculateLintStats(issues, 5);
      expect(stats.totalIssues).toBe(3);
      expect(stats.filesWithIssues).toBe(2);
      expect(stats.filesChecked).toBe(5);
      expect(stats.cleanFiles).toBe(3);
      expect(stats.issuesPerFile).toBe(0.6);
      expect(stats.uniqueRules).toBe(2);
    });
  });

  // ========================================================================
  // PURE FUNCTIONS - Batch Helpers
  // ========================================================================

  describe('chunkArray', () => {
    let chunkArray;
    beforeAll(async () => {
      ({ chunkArray } = await import('../../src/steps/step_13_markdown_lint.js'));
    });

    test('splits array into chunks of given size', () => {
      const result = chunkArray([1, 2, 3, 4, 5], 2);
      expect(result).toEqual([[1, 2], [3, 4], [5]]);
    });

    test('returns single chunk when array fits in one batch', () => {
      const result = chunkArray(['a', 'b', 'c'], 10);
      expect(result).toEqual([['a', 'b', 'c']]);
    });

    test('returns empty array for empty input', () => {
      expect(chunkArray([], 5)).toEqual([]);
    });

    test('returns one-element chunks when size is 1', () => {
      const result = chunkArray([1, 2, 3], 1);
      expect(result).toEqual([[1], [2], [3]]);
    });

    test('returns exact chunks when divisible', () => {
      const result = chunkArray([1, 2, 3, 4], 2);
      expect(result).toEqual([
        [1, 2],
        [3, 4],
      ]);
    });
  });

  describe('mergeBatchIssues', () => {
    let mergeBatchIssues;
    beforeAll(async () => {
      ({ mergeBatchIssues } = await import('../../src/steps/step_13_markdown_lint.js'));
    });

    test('merges issues from multiple batches', () => {
      const batch1 = [{ file: 'a.md', rule: 'MD013' }];
      const batch2 = [
        { file: 'b.md', rule: 'MD022' },
        { file: 'c.md', rule: 'MD013' },
      ];
      const result = mergeBatchIssues([batch1, batch2]);
      expect(result).toHaveLength(3);
      expect(result[0].file).toBe('a.md');
      expect(result[2].file).toBe('c.md');
    });

    test('returns empty array for empty input', () => {
      expect(mergeBatchIssues([])).toEqual([]);
    });

    test('handles batches with no issues', () => {
      expect(mergeBatchIssues([[], []])).toEqual([]);
    });

    test('preserves order across batches', () => {
      const result = mergeBatchIssues([[{ file: 'first.md' }], [{ file: 'second.md' }]]);
      expect(result[0].file).toBe('first.md');
      expect(result[1].file).toBe('second.md');
    });
  });

  // ========================================================================
  // PURE FUNCTIONS - Anti-Pattern Detection
  // ========================================================================

  describe('checkMissingSpaceAfterHash', () => {
    test('detects missing space after hash', () => {
      const content = '#Heading without space\n# Correct heading';
      const issues = checkMissingSpaceAfterHash(content);
      expect(issues).toHaveLength(1);
      expect(issues[0].line).toBe(1);
      expect(issues[0].pattern).toBe('missing-space-after-hash');
    });

    test('allows correct headings', () => {
      const content = '# Heading\n## Sub-heading\n### Level 3';
      const issues = checkMissingSpaceAfterHash(content);
      expect(issues).toHaveLength(0);
    });

    test('allows code blocks with hashes', () => {
      const content = '```bash\n#!/bin/bash\n```';
      const issues = checkMissingSpaceAfterHash(content);
      expect(issues).toHaveLength(0);
    });
  });

  describe('checkMalformedBold', () => {
    test('detects potential malformed bold', () => {
      const content = 'Some text *with **bold**: more text';
      const issues = checkMalformedBold(content);
      expect(issues).toHaveLength(1);
      expect(issues[0].pattern).toBe('malformed-bold');
    });

    test('allows correct formatting', () => {
      const content = 'Some **bold** text and *italic* text';
      const issues = checkMalformedBold(content);
      expect(issues).toHaveLength(0);
    });
  });

  describe('checkTrailingWhitespace', () => {
    test('detects trailing whitespace', () => {
      const content = 'Line with trailing space  \nClean line';
      const issues = checkTrailingWhitespace(content);
      expect(issues).toHaveLength(1);
      expect(issues[0].line).toBe(1);
    });

    test('allows clean lines', () => {
      const content = 'Clean line 1\nClean line 2';
      const issues = checkTrailingWhitespace(content);
      expect(issues).toHaveLength(0);
    });
  });

  describe('checkMultipleBlankLines', () => {
    test('detects multiple blank lines', () => {
      const content = 'Line 1\n\n\nLine 4';
      const issues = checkMultipleBlankLines(content);
      expect(issues).toHaveLength(1);
      expect(issues[0].pattern).toBe('multiple-blank-lines');
    });

    test('allows single blank lines', () => {
      const content = 'Line 1\n\nLine 3';
      const issues = checkMultipleBlankLines(content);
      expect(issues).toHaveLength(0);
    });
  });

  describe('detectAntiPatterns', () => {
    test('detects multiple anti-patterns', () => {
      const content = '#NoSpace\nLine with trailing space  \n\n\nMultiple blank lines';
      const issues = detectAntiPatterns(content);
      expect(issues.length).toBeGreaterThan(0);
    });

    test('returns empty for clean content', () => {
      const content = '# Proper Heading\n\nClean content without issues.';
      const issues = detectAntiPatterns(content);
      expect(issues).toHaveLength(0);
    });
  });

  // ========================================================================
  // PURE FUNCTIONS - Report Generation
  // ========================================================================

  describe('formatLintReport', () => {
    test('formats report with no issues', () => {
      const data = {
        stats: {
          filesChecked: 10,
          cleanFiles: 10,
          filesWithIssues: 0,
          totalIssues: 0,
        },
        issues: [],
        antiPatterns: [],
        mdlVersion: '0.11.0',
      };
      const report = formatLintReport(data);
      expect(report).toContain('Markdown Linting Report');
      expect(report).toContain('**Files Checked:** 10');
      expect(report).toContain('**Total Issues:** 0');
      expect(report).toContain('✅ Excellent');
    });

    test('formats report with issues', () => {
      const data = {
        stats: {
          filesChecked: 5,
          cleanFiles: 3,
          filesWithIssues: 2,
          totalIssues: 4,
          issuesPerFile: 0.8,
        },
        issues: [
          { file: 'README.md', rule: 'MD013', line: 5 },
          { file: 'README.md', rule: 'MD022', line: 10 },
          { file: 'CHANGELOG.md', rule: 'MD013', line: 3 },
          { file: 'CHANGELOG.md', rule: 'MD013', line: 15 },
        ],
        antiPatterns: [],
      };
      const report = formatLintReport(data);
      expect(report).toContain('Issues by Rule');
      expect(report).toContain('Issues by File');
      expect(report).toContain('MD013');
      expect(report).toContain('README.md');
    });

    test('includes anti-pattern section', () => {
      const data = {
        stats: {
          filesChecked: 3,
          cleanFiles: 2,
          filesWithIssues: 1,
          totalIssues: 2,
          issuesPerFile: 0.67,
        },
        issues: [],
        antiPatterns: [
          { pattern: 'missing-space-after-hash', line: 1 },
          { pattern: 'trailing-whitespace', line: 5 },
        ],
      };
      const report = formatLintReport(data);
      expect(report).toContain('Anti-Pattern Detection');
      expect(report).toContain('missing-space-after-hash');
    });
  });

  describe('determineLintStatus', () => {
    test('returns pass for no issues', () => {
      const stats = { totalIssues: 0, issuesPerFile: 0 };
      expect(determineLintStatus(stats)).toBe('pass');
    });

    test('returns warning for minor issues', () => {
      const stats = { totalIssues: 5, issuesPerFile: 2 };
      expect(determineLintStatus(stats)).toBe('warning');
    });

    test('returns fail for many issues', () => {
      const stats = { totalIssues: 50, issuesPerFile: 10 };
      expect(determineLintStatus(stats)).toBe('fail');
    });
  });

  // ========================================================================
  // STEP13MARKDOWNLINT - Integration Tests
  // ========================================================================

  describe('Step13MarkdownLint', () => {
    let mockExecutor;
    let mockFileOps;
    let mockBacklog;
    let mockLogger;

    beforeEach(() => {
      mockExecutor = {
        executeCommand: jest.fn(),
      };
      mockFileOps = {
        listDirectoryRecursive: jest.fn(),
        readFile: jest.fn(),
      };
      mockBacklog = {
        saveStepSummary: jest.fn(),
        saveStepIssues: jest.fn(),
      };
      mockLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        step: jest.fn(),
      };
    });

    test('constructs with default options', () => {
      const step = new Step13MarkdownLint({
        aiHelper: { initialize: () => Promise.resolve(false) },
      });
      expect(step).toBeInstanceOf(Step13MarkdownLint);
      expect(step.dryRun).toBe(false);
    });

    test('constructs with custom options', () => {
      const step = new Step13MarkdownLint({
        aiHelper: { initialize: () => Promise.resolve(false) },
        executor: mockExecutor,
        fileOps: mockFileOps,
        backlogManager: mockBacklog,
        logger: mockLogger,
        dryRun: true,
      });
      expect(step.executor).toBe(mockExecutor);
      expect(step.fileOps).toBe(mockFileOps);
      expect(step.dryRun).toBe(true);
    });

    test('executes dry-run mode', async () => {
      const step = new Step13MarkdownLint({
        aiHelper: { initialize: () => Promise.resolve(false) },
        backlogManager: mockBacklog,
        logger: mockLogger,
        dryRun: true,
      });

      const result = await step.execute();

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith('[DRY RUN] Markdown linting preview:');
      expect(mockBacklog.saveStepSummary).toHaveBeenCalled();
    });

    test('handles no markdown files', async () => {
      mockFileOps.listDirectoryRecursive = jest.fn().mockResolvedValue([]);

      const step = new Step13MarkdownLint({
        aiHelper: { initialize: () => Promise.resolve(false) },
        fileOps: mockFileOps,
        backlogManager: mockBacklog,
        logger: mockLogger,
      });

      const result = await step.execute();

      expect(result.success).toBe(true);
      expect(result.noFiles).toBe(true);
      expect(mockBacklog.saveStepSummary).toHaveBeenCalledWith(
        '13',
        'Markdown_Linting',
        'No markdown files found to lint.',
        '✅'
      );
    });

    test('handles mdl not installed', async () => {
      mockFileOps.listDirectoryRecursive = jest.fn().mockResolvedValue(['README.md']);
      mockExecutor.executeCommand = jest.fn().mockRejectedValue(new Error('Command not found'));

      const step = new Step13MarkdownLint({
        aiHelper: { initialize: () => Promise.resolve(false) },
        executor: mockExecutor,
        fileOps: mockFileOps,
        backlogManager: mockBacklog,
        logger: mockLogger,
      });

      const result = await step.execute();

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('mdl not installed');
      expect(mockBacklog.saveStepSummary).toHaveBeenCalledWith(
        '13',
        'Markdown_Linting',
        expect.stringContaining('Skipped'),
        '⚠️'
      );
    });

    test('executes successful linting with no issues', async () => {
      mockFileOps.listDirectoryRecursive = jest
        .fn()
        .mockResolvedValue(['README.md', 'CHANGELOG.md']);
      mockExecutor.executeCommand = jest
        .fn()
        .mockResolvedValueOnce({ stdout: '0.11.0', stderr: '' }) // mdl version
        .mockResolvedValueOnce({ stdout: '', stderr: '' }); // mdl lint (no issues)

      const step = new Step13MarkdownLint({
        aiHelper: { initialize: () => Promise.resolve(false) },
        executor: mockExecutor,
        fileOps: mockFileOps,
        backlogManager: mockBacklog,
        logger: mockLogger,
      });

      const result = await step.execute();

      expect(result.success).toBe(true);
      expect(result.status).toBe('pass');
      expect(result.stats.totalIssues).toBe(0);
      expect(mockBacklog.saveStepSummary).toHaveBeenCalledWith(
        '13',
        'Markdown_Linting',
        expect.any(String),
        '✅'
      );
    });

    test('invalidates step cache when auto-fix is a no-op', async () => {
      const mockAiCache = {
        init: jest.fn().mockResolvedValue(),
        invalidateFileChangeGuard: jest.fn().mockResolvedValue(true),
        withFileChangeGuard: jest.fn().mockResolvedValue({ content: 'AI recommendations' }),
      };
      const mockAiHelper = {
        initialize: jest.fn().mockResolvedValue(true),
        executeRequest: jest.fn().mockResolvedValue({ content: 'AI recommendations' }),
      };
      mockFileOps.listDirectoryRecursive = jest.fn().mockResolvedValue(['README.md']);
      mockFileOps.readFile = jest.fn().mockResolvedValue('# Heading\n');
      mockExecutor.executeCommand = jest
        .fn()
        .mockResolvedValueOnce({ stdout: '0.11.0', stderr: '' })
        .mockRejectedValueOnce({ stdout: 'README.md:1: MD041 First line should be a top-level heading\n' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockRejectedValueOnce({ stdout: 'README.md:1: MD041 First line should be a top-level heading\n' });

      const step = new Step13MarkdownLint({
        aiHelper: mockAiHelper,
        aiCache: mockAiCache,
        executor: mockExecutor,
        fileOps: mockFileOps,
        backlogManager: mockBacklog,
        logger: mockLogger,
      });

      await step.execute({ projectRoot: '/project' });

      expect(mockAiCache.invalidateFileChangeGuard).toHaveBeenCalledWith('step_13');
      expect(mockAiCache.withFileChangeGuard).toHaveBeenCalledWith(
        'step_13',
        expect.arrayContaining([expect.stringContaining('autofix:autofix-noop')]),
        expect.any(Function)
      );
    });

    // [BUG FIX 9a42860] promptsDir must be forwarded to AiHelper
    test('[BUG FIX] promptsDir option is accepted without error', () => {
      const step = new Step13MarkdownLint({
        executor: mockExecutor,
        backlogManager: mockBacklog,
        promptsDir: '/tmp/prompts/step_13',
      });
      expect(step).toBeDefined();
      expect(step.aiHelper).toBeDefined();
    });
  });
});
