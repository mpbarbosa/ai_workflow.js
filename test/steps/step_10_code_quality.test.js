/**
 * Tests for Step 10: Code Quality Analysis
 * @group steps
 */

import {
  Step10CodeQualityAnalyzer,
  getLinterCommand,
  getSourceExtensions,
  isSourceFile,
  extractLinterCommand,
  parseEslintOutput,
  parseFlake8Output,
  parseLinterOutput,
  calculateIssueRate,
  determineQualityRating,
  formatQualityReport,
} from '../../src/steps/step_10_code_quality.js';

describe('Step 10: Code Quality Analysis', () => {
  // ========================================================================
  // PURE FUNCTIONS - Linter Detection
  // ========================================================================

  describe('getLinterCommand', () => {
    test('returns npm run lint for JavaScript', () => {
      expect(getLinterCommand('javascript')).toBe('npm run lint');
    });

    test('returns flake8 for Python', () => {
      expect(getLinterCommand('python')).toBe('flake8 .');
    });

    test('returns null for unknown language', () => {
      expect(getLinterCommand('unknown')).toBeNull();
    });
  });

  describe('getSourceExtensions', () => {
    test('returns extensions for JavaScript', () => {
      const exts = getSourceExtensions('javascript');
      expect(exts).toContain('.js');
      expect(exts).toContain('.jsx');
    });

    test('returns extensions for Python', () => {
      const exts = getSourceExtensions('python');
      expect(exts).toContain('.py');
    });

    test('defaults to JavaScript extensions', () => {
      const exts = getSourceExtensions('unknown');
      expect(exts).toContain('.js');
    });
  });

  describe('isSourceFile', () => {
    test('identifies JavaScript source file', () => {
      expect(isSourceFile('src/utils.js', 'javascript')).toBe(true);
    });

    test('identifies TypeScript source file', () => {
      expect(isSourceFile('src/types.ts', 'typescript')).toBe(true);
    });

    test('rejects non-source file', () => {
      expect(isSourceFile('README.md', 'javascript')).toBe(false);
    });
  });

  describe('extractLinterCommand', () => {
    test('extracts lint script', () => {
      const pkg = { scripts: { lint: 'eslint .' } };
      expect(extractLinterCommand(pkg)).toBe('npm run lint');
    });

    test('extracts eslint script', () => {
      const pkg = { scripts: { eslint: 'eslint .' } };
      expect(extractLinterCommand(pkg)).toBe('npm run eslint');
    });

    test('returns null when no lint script', () => {
      const pkg = { scripts: { test: 'jest' } };
      expect(extractLinterCommand(pkg)).toBeNull();
    });
  });

  // ========================================================================
  // PURE FUNCTIONS - Linter Output Parsing
  // ========================================================================

  describe('parseEslintOutput', () => {
    test('parses ESLint output with issues', () => {
      const output = `
/path/to/file1.js
  10:5  error  'foo' is not defined  no-undef

/path/to/file2.js
  5:10  warning  Missing semicolon  semi

✖ 2 problems (1 error, 1 warning)
`;

      const result = parseEslintOutput(output);

      expect(result.totalIssues).toBe(2);
      expect(result.errors).toBe(1);
      expect(result.warnings).toBe(1);
    });

    test('handles output with no issues', () => {
      const output = 'No problems found';
      const result = parseEslintOutput(output);

      expect(result.totalIssues).toBe(0);
    });
  });

  describe('parseFlake8Output', () => {
    test('parses Flake8 output', () => {
      const output = `src/utils.py:10:5: E501 line too long
src/helpers.py:20:1: W291 trailing whitespace
src/utils.py:15:10: E302 expected 2 blank lines`;

      const result = parseFlake8Output(output);

      expect(result.totalIssues).toBe(3);
      expect(result.files).toBe(2); // 2 unique files
    });

    test('handles empty output', () => {
      const result = parseFlake8Output('');
      expect(result.totalIssues).toBe(0);
    });
  });

  describe('parseLinterOutput', () => {
    test('uses ESLint parser for JavaScript', () => {
      const output = '✖ 5 problems (3 errors, 2 warnings)';
      const result = parseLinterOutput(output, 'javascript');

      expect(result.totalIssues).toBe(5);
      expect(result.errors).toBe(3);
    });

    test('uses Flake8 parser for Python', () => {
      const output = 'file.py:1:1: E501 line too long';
      const result = parseLinterOutput(output, 'python');

      expect(result.totalIssues).toBe(1);
    });

    test('uses generic parser for unknown language', () => {
      const output = 'Issue 1\nIssue 2\nIssue 3';
      const result = parseLinterOutput(output, 'unknown');

      expect(result.totalIssues).toBe(3);
    });
  });

  describe('calculateIssueRate', () => {
    test('calculates issue rate', () => {
      expect(calculateIssueRate(10, 5)).toBe(2.0);
    });

    test('handles zero files', () => {
      expect(calculateIssueRate(10, 0)).toBe(0);
    });

    test('rounds to 1 decimal place', () => {
      expect(calculateIssueRate(10, 3)).toBe(3.3);
    });
  });

  describe('determineQualityRating', () => {
    test('returns excellent for 0 issues', () => {
      expect(determineQualityRating(0)).toBe('excellent');
    });

    test('returns good for low issue rate', () => {
      expect(determineQualityRating(3)).toBe('good');
    });

    test('returns moderate for medium issue rate', () => {
      expect(determineQualityRating(15)).toBe('moderate');
    });

    test('returns poor for high issue rate', () => {
      expect(determineQualityRating(50)).toBe('poor');
    });
  });

  // ========================================================================
  // PURE FUNCTIONS - Reporting
  // ========================================================================

  describe('formatQualityReport', () => {
    test('formats report for skipped analysis', () => {
      const results = {
        language: 'bash',
        sourceFileCount: 5,
        skipped: true,
      };

      const report = formatQualityReport(results);

      expect(report).toContain('Code Quality Report');
      expect(report).toContain('Skipped');
    });

    test('formats report with no issues', () => {
      const results = {
        language: 'javascript',
        sourceFileCount: 10,
        linterResults: { totalIssues: 0, errors: 0, warnings: 0 },
        issueRate: 0,
        qualityRating: 'excellent',
        linterCommand: 'npm run lint',
      };

      const report = formatQualityReport(results);

      expect(report).toContain('**Source Files**: 10');
      expect(report).toContain('No issues found');
      expect(report).toContain('Excellent');
    });

    test('formats report with issues', () => {
      const results = {
        language: 'javascript',
        sourceFileCount: 10,
        linterResults: { totalIssues: 15, errors: 5, warnings: 10, files: 8 },
        issueRate: 1.5,
        qualityRating: 'good',
        linterCommand: 'npm run lint',
      };

      const report = formatQualityReport(results);

      expect(report).toContain('**Total Issues**: 15');
      expect(report).toContain('**Errors**: 5');
      expect(report).toContain('**Warnings**: 10');
      expect(report).toContain('Recommendations');
    });
  });

  // ========================================================================
  // STEP 10 ANALYZER - Integration Tests
  // ========================================================================

  describe('Step10CodeQualityAnalyzer', () => {
    let analyzer;
    let mockExecutor;
    let mockFileOps;
    let mockBacklog;
    let mockTechStack;

    beforeEach(() => {
      mockExecutor = {
        execute: async () => ({ stdout: '', stderr: '', exitCode: 0 }),
      };

      mockFileOps = {
        readFile: async () => JSON.stringify({ scripts: { lint: 'eslint .' } }),
        glob: async () => [],
      };

      mockBacklog = {
        saveStepSummary: async () => {},
      };

      mockTechStack = {
        detectAll: async () => ({ languages: ['javascript'] }),
      };

      analyzer = new Step10CodeQualityAnalyzer({
        executor: mockExecutor,
        fileOps: mockFileOps,
        backlog: mockBacklog,
        techStack: mockTechStack,
      });
    });

    test('runs linter when default command available', async () => {
      mockFileOps.readFile = async () => JSON.stringify({ scripts: {} });
      mockFileOps.glob = async () => ['src/utils.js', 'src/helpers.js'];

      // Even without explicit lint script, default linter command is used
      mockExecutor.execute = async () => ({
        stdout: 'All files pass linting',
        stderr: '',
        exitCode: 0,
      });

      const result = await analyzer.execute('/project');

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(false);
      expect(result.linterCommand).toBe('npm run lint');
    });

    test('analyzes code quality successfully', async () => {
      mockFileOps.glob = async () => ['src/utils.js', 'src/helpers.js'];
      mockExecutor.execute = async () => ({
        stdout: 'All files pass linting',
        stderr: '',
        exitCode: 0,
      });

      const result = await analyzer.execute('/project');

      expect(result.success).toBe(true);
      expect(result.sourceFileCount).toBe(2);
      expect(result.linterResults.totalIssues).toBe(0);
    });

    test('detects linter issues', async () => {
      mockFileOps.glob = async () => ['src/utils.js'];

      mockExecutor.execute = async () => {
        throw {
          exitCode: 1,
          stdout: '✖ 5 problems (2 errors, 3 warnings)',
          stderr: '',
        };
      };

      const result = await analyzer.execute('/project');

      expect(result.success).toBe(false);
      expect(result.linterResults.totalIssues).toBe(5);
      expect(result.linterResults.errors).toBe(2);
    });

    test('calculates quality metrics', async () => {
      mockFileOps.glob = async () => ['src/file1.js', 'src/file2.js'];

      mockExecutor.execute = async () => {
        throw {
          exitCode: 1,
          stdout: '✖ 4 problems (0 errors, 4 warnings)',
          stderr: '',
        };
      };

      const result = await analyzer.execute('/project');

      expect(result.issueRate).toBe(2.0);
      expect(result.qualityRating).toBe('good');
    });
  });
});
