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
  formatMultiLanguageQualityReport,
  getAllDetectedLanguages,
  getLanguageLinterCommands,
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

    test('returns shellcheck for bash', () => {
      expect(getLinterCommand('bash')).toBe('shellcheck');
    });

    test('returns jsonlint for json', () => {
      expect(getLinterCommand('json')).toBe('npx jsonlint --quiet');
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
  // PURE FUNCTIONS - Multi-Language Support
  // ========================================================================

  describe('getAllDetectedLanguages', () => {
    test('returns languages from tech stack result', () => {
      const result = getAllDetectedLanguages({ languages: ['javascript', 'bash'] });
      expect(result).toContain('javascript');
      expect(result).toContain('bash');
    });

    test('merges extra languages and de-duplicates', () => {
      const result = getAllDetectedLanguages({ languages: ['javascript'] }, ['bash', 'json']);
      expect(result).toContain('javascript');
      expect(result).toContain('bash');
      expect(result).toContain('json');
      expect(result.length).toBe(3);
    });

    test('normalizes to lower-case', () => {
      const result = getAllDetectedLanguages({ languages: ['JavaScript'] }, ['JSON']);
      expect(result).toContain('javascript');
      expect(result).toContain('json');
    });

    test('handles empty tech stack result', () => {
      const result = getAllDetectedLanguages({}, ['bash']);
      expect(result).toEqual(['bash']);
    });

    test('handles null tech stack result gracefully', () => {
      const result = getAllDetectedLanguages(null, ['bash']);
      expect(result).toEqual(['bash']);
    });
  });

  describe('getLanguageLinterCommands', () => {
    test('returns default commands for known languages', () => {
      const map = getLanguageLinterCommands(['javascript', 'bash', 'json']);
      expect(map.javascript).toBe('npm run lint');
      expect(map.bash).toBe('shellcheck');
      expect(map.json).toBe('npx jsonlint --quiet');
    });

    test('config commands take precedence over defaults', () => {
      const configCmd = { javascript: 'npx eslint src/', bash: 'shellcheck -S warning' };
      const map = getLanguageLinterCommands(['javascript', 'bash'], configCmd);
      expect(map.javascript).toBe('npx eslint src/');
      expect(map.bash).toBe('shellcheck -S warning');
    });

    test('omits languages with no command', () => {
      const map = getLanguageLinterCommands(['unknown_lang']);
      expect(map.unknown_lang).toBeUndefined();
    });

    test('returns empty object for empty languages list', () => {
      expect(getLanguageLinterCommands([])).toEqual({});
    });

    test('uses config command for language not in defaults', () => {
      const map = getLanguageLinterCommands(['myLang'], { mylang: 'custom-lint' });
      expect(map.mylang).toBe('custom-lint');
    });
  });

  describe('formatMultiLanguageQualityReport', () => {
    const perLanguageResults = [
      {
        language: 'javascript',
        sourceFileCount: 5,
        linterCommand: 'npm run lint',
        linterResults: { totalIssues: 3, errors: 1, warnings: 2 },
        issueRate: 0.6,
        qualityRating: 'good',
        skipped: false,
      },
      {
        language: 'bash',
        sourceFileCount: 3,
        linterCommand: 'shellcheck',
        linterResults: { totalIssues: 0, errors: 0, warnings: 0 },
        issueRate: 0,
        qualityRating: 'excellent',
        skipped: false,
      },
    ];

    test('renders summary with totals', () => {
      const report = formatMultiLanguageQualityReport(perLanguageResults, {
        totalIssues: 3,
        errors: 1,
        warnings: 2,
        fileCount: 8,
      });
      expect(report).toContain('Languages analyzed');
      expect(report).toContain('Total Source Files');
      expect(report).toContain('Total Issues');
    });

    test('renders a section per language', () => {
      const report = formatMultiLanguageQualityReport(perLanguageResults, {
        totalIssues: 3,
        errors: 1,
        warnings: 2,
        fileCount: 8,
      });
      expect(report).toContain('Javascript');
      expect(report).toContain('Bash');
    });

    test('shows skipped status for languages with no linter', () => {
      const results = [{ language: 'ruby', sourceFileCount: 2, skipped: true }];
      const report = formatMultiLanguageQualityReport(results, {});
      expect(report).toContain('Skipped');
    });

    test('formatQualityReport delegates to multi-language format when perLanguageResults present', () => {
      const report = formatQualityReport({
        perLanguageResults,
        aggregateTotals: { totalIssues: 3 },
      });
      expect(report).toContain('Languages analyzed');
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
        // readFile throws by default (no .workflow-config.yaml, no package.json)
        readFile: async () => {
          throw new Error('not found');
        },
        glob: async () => [],
      };

      mockBacklog = {
        saveStepSummary: async () => {},
      };

      mockTechStack = {
        detectAll: async () => ({ languages: ['javascript'], primary_language: 'javascript' }),
      };

      analyzer = new Step10CodeQualityAnalyzer({
        executor: mockExecutor,
        fileOps: mockFileOps,
        backlog: mockBacklog,
        techStack: mockTechStack,
        aiHelper: { initialize: () => Promise.resolve(false) },
      });
    });

    test('runs linter when default command available', async () => {
      // Only JS files exist → JS linter runs using default LINTER_COMMANDS
      mockFileOps.glob = async () => ['src/utils.js', 'src/helpers.js'];

      mockExecutor.execute = async () => ({
        stdout: 'All files pass linting',
        stderr: '',
        exitCode: 0,
      });

      const result = await analyzer.execute('/project');

      expect(result.success).toBe(true);
      const jsResult = result.perLanguageResults?.find((r) => r.language === 'javascript');
      expect(jsResult).toBeDefined();
      expect(jsResult.linterCommand).toBe('npm run lint');
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
      expect(result.aggregateTotals.fileCount).toBeGreaterThanOrEqual(2);
      const jsResult = result.perLanguageResults?.find((r) => r.language === 'javascript');
      expect(jsResult?.linterResults.totalIssues).toBe(0);
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
      expect(result.perLanguageResults[0].linterResults.totalIssues).toBe(5);
      expect(result.perLanguageResults[0].linterResults.errors).toBe(2);
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

      expect(result.perLanguageResults[0].issueRate).toBe(2.0);
      expect(result.perLanguageResults[0].qualityRating).toBe('good');
    });

    test('skips languages with no source files', async () => {
      // All globs return empty → no languages have files → skipped
      mockFileOps.glob = async () => [];
      const result = await analyzer.execute('/project');
      expect(result.skipped).toBe(true);
    });

    test('runs linters for multiple languages with source files', async () => {
      mockTechStack.detectAll = async () => ({
        languages: ['javascript', 'bash'],
        primary_language: 'javascript',
      });

      // Return files for any pattern (both js and bash count)
      mockFileOps.glob = async () => ['src/script.sh'];
      mockExecutor.execute = async () => ({ stdout: '', stderr: '', exitCode: 0 });

      const result = await analyzer.execute('/project');

      // Both javascript and bash languages are in detected + bash/json from extraLanguages
      // Since glob returns 1 file for EVERY pattern, all will have sourceFileCount=1
      expect(result.perLanguageResults.length).toBeGreaterThan(1);
      const langs = result.perLanguageResults.map((r) => r.language);
      expect(langs).toContain('javascript');
      expect(langs).toContain('bash');
    });

    test('uses lint_commands from config YAML over defaults', async () => {
      const yaml = `tech_stack:\n  lint_commands:\n    javascript: npx eslint src/\n    bash: shellcheck -S warning\n`;
      mockFileOps.readFile = async () => yaml;
      mockFileOps.glob = async () => ['src/file.js'];
      mockExecutor.execute = async () => ({ stdout: '', stderr: '', exitCode: 0 });

      const result = await analyzer.execute('/project');

      const jsResult = result.perLanguageResults?.find((r) => r.language === 'javascript');
      expect(jsResult?.linterCommand).toBe('npx eslint src/');
    });
  });
});
