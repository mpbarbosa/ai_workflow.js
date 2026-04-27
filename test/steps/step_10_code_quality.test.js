/**
 * Tests for Step 10: Code Quality Analysis
 * @group steps
 */

import { jest } from '@jest/globals';
import { mkdtemp, mkdir, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
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
  AI_FILES_PER_SLICE,
  AI_MAX_CHARS_PER_PROMPT_ENTRY,
  prioritizeSourceFiles,
  isStep10CodeReviewableFile,
  isErrorResilienceReviewableFile,
  buildFileContentMap,
  buildSupportingQualityPromptFields,
  buildPromptFileEntries,
  buildCodePromptSlices,
  formatFileContentMap,
  formatPromptFileEntries,
  buildCodeContentHash,
  resolveCohesionGuideStatus,
  shouldRunErrorResiliencePrompt,
} from '../../src/steps/step_10_code_quality.js';
import { Step10AiReviewService } from '../../src/steps/step_10_ai_review.js';

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
      expect(getLinterCommand('bash')).toBe(
        'find . -name "*.sh" -not -path "*/node_modules/*" -not -path "*/.git/*" | xargs shellcheck'
      );
    });

    test('returns jsonlint for json', () => {
      expect(getLinterCommand('json')).toBe('(native JSON.parse)');
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

    test('parses warnings-only output (0 errors, N warnings)', () => {
      const output = `
/path/to/jq_wrapper.ts
  87:8  warning  Function 'foo' has a complexity of 17  complexity

✖ 1 problem (0 errors, 1 warning)
`;
      const result = parseEslintOutput(output);

      expect(result.totalIssues).toBe(1);
      expect(result.errors).toBe(0);
      expect(result.warnings).toBe(1);
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

    test('uses shellcheck parser for bash', () => {
      const output =
        'In script.sh line 32:\ncd foo\n^--^ SC2164 (warning): Use cd ... || exit.\n\nIn script.sh line 65:\ncd bar\n^--^ SC2164 (warning): Use cd ... || exit.';
      const result = parseLinterOutput(output, 'bash');

      expect(result.totalIssues).toBe(2);
      expect(result.warnings).toBe(2);
      expect(result.errors).toBe(0);
    });

    test('shellcheck parser captures (info) and (style) items separately from warnings', () => {
      const output =
        'In script.sh line 1:\n#!/bin/bash\n^-- SC1009 (info): The mentioned syntax error was in this case statement.\n\nIn script.sh line 5:\ncmd\n^-- SC2086 (error): Double quote to prevent globbing.\n\nIn script.sh line 10:\nfoo\n^-- SC2034 (style): foo appears unused.';
      const result = parseLinterOutput(output, 'bash');

      expect(result.totalIssues).toBe(3);
      expect(result.errors).toBe(1);
      expect(result.warnings).toBe(0);
      expect(result.infos).toBe(2); // (info) + (style)
    });

    test('shellcheck parser: totalIssues equals errors + warnings + infos', () => {
      const output =
        'In a.sh line 1:\ncmd\n^-- SC2001 (error): err1.\n\nIn a.sh line 2:\ncmd\n^-- SC2002 (warning): warn1.\n\nIn a.sh line 3:\ncmd\n^-- SC2003 (info): info1.';
      const result = parseLinterOutput(output, 'bash');

      expect(result.totalIssues).toBe(result.errors + result.warnings + result.infos);
    });

    test('shellcheck parser does not count usage/error text as issues', () => {
      const output =
        'No files specified.\n\nUsage: shellcheck [OPTIONS...] FILES...\n  -a   --check-sourced\n  -C   --color';
      const result = parseLinterOutput(output, 'bash');

      expect(result.totalIssues).toBe(0);
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
      expect(map.bash).toBe(
        'find . -name "*.sh" -not -path "*/node_modules/*" -not -path "*/.git/*" | xargs shellcheck'
      );
      expect(map.json).toBe('(native JSON.parse)');
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
  // PURE FUNCTIONS - AI Prompt Context
  // ========================================================================

  describe('prioritizeSourceFiles', () => {
    test('returns empty array for non-array input', () => {
      expect(prioritizeSourceFiles(null)).toEqual([]);
      expect(prioritizeSourceFiles(undefined)).toEqual([]);
    });

    test('puts src/ files before test/ files', () => {
      const files = [
        'test/core/colors.test.ts',
        'src/core/utils.ts',
        'src/index.ts',
        'test/index.test.ts',
      ];
      const result = prioritizeSourceFiles(files);
      expect(result.indexOf('src/core/utils.ts')).toBeLessThan(
        result.indexOf('test/core/colors.test.ts')
      );
      expect(result.indexOf('src/index.ts')).toBeLessThan(result.indexOf('test/index.test.ts'));
    });

    test('recognizes spec and __tests__ folders as test files', () => {
      const files = ['spec/foo.spec.js', '__tests__/bar.test.js', 'src/foo.js'];
      const result = prioritizeSourceFiles(files);
      expect(result[0]).toBe('src/foo.js');
    });

    test('recognizes .test. and .spec. extensions as test files', () => {
      const files = ['src/utils.spec.ts', 'src/core/logger.ts'];
      const result = prioritizeSourceFiles(files);
      expect(result[0]).toBe('src/core/logger.ts');
    });

    test('sorts alphabetically within each group', () => {
      const files = ['src/b.ts', 'test/b.test.ts', 'src/a.ts', 'test/a.test.ts'];
      const result = prioritizeSourceFiles(files);
      expect(result).toEqual(['src/a.ts', 'src/b.ts', 'test/a.test.ts', 'test/b.test.ts']);
    });

    test('returns all files unchanged when no test files present', () => {
      const files = ['src/a.ts', 'src/b.ts'];
      expect(prioritizeSourceFiles(files)).toEqual(['src/a.ts', 'src/b.ts']);
    });
  });

  describe('buildFileContentMap', () => {
    const contents = {
      'test/foo.test.ts': 'test content',
      'src/index.ts': 'src content A',
      'src/utils.ts': 'src content B',
    };

    test('returns empty array for empty/null input', () => {
      expect(buildFileContentMap(null)).toEqual([]);
      expect(buildFileContentMap({})).toEqual([]);
    });

    test('returns source files before test files', () => {
      const result = buildFileContentMap(contents);
      const paths = result.map((r) => r.path);
      expect(paths.indexOf('src/index.ts')).toBeLessThan(paths.indexOf('test/foo.test.ts'));
    });

    test('respects maxFiles option', () => {
      const result = buildFileContentMap(contents, { maxFiles: 2 });
      expect(result.length).toBe(2);
    });

    test('truncates long content and sets truncated flag', () => {
      const big = { 'src/big.ts': 'x'.repeat(2000) };
      const result = buildFileContentMap(big, { maxCharsPerFile: 100 });
      expect(result[0].excerpt.length).toBe(100);
      expect(result[0].truncated).toBe(true);
    });

    test('sets truncated:false for short content', () => {
      const small = { 'src/small.ts': 'short' };
      const result = buildFileContentMap(small);
      expect(result[0].truncated).toBe(false);
    });

    test('includes path and excerpt in each entry', () => {
      const result = buildFileContentMap({ 'src/a.ts': 'hello' });
      expect(result[0]).toMatchObject({ path: 'src/a.ts', excerpt: 'hello', truncated: false });
    });
  });

  describe('formatFileContentMap', () => {
    test('returns placeholder for empty/null input', () => {
      expect(formatFileContentMap([])).toBe('(no source files provided)');
      expect(formatFileContentMap(null)).toBe('(no source files provided)');
    });

    test('formats each entry with path and code block', () => {
      const map = [{ path: 'src/a.ts', excerpt: 'const x = 1;', truncated: false }];
      const result = formatFileContentMap(map);
      expect(result).toContain('### src/a.ts');
      expect(result).toContain('const x = 1;');
    });

    test('adds [truncated] note when truncated is true', () => {
      const map = [{ path: 'src/big.ts', excerpt: 'long...', truncated: true }];
      expect(formatFileContentMap(map)).toContain('[truncated]');
    });

    test('separates multiple files with blank line', () => {
      const map = [
        { path: 'src/a.ts', excerpt: 'a', truncated: false },
        { path: 'src/b.ts', excerpt: 'b', truncated: false },
      ];
      expect(formatFileContentMap(map)).toContain('\n\n');
    });
  });

  describe('buildPromptFileEntries', () => {
    test('splits oversized file contents into labeled part entries', () => {
      const entries = buildPromptFileEntries({
        'src/app.tsx': 'x'.repeat(AI_MAX_CHARS_PER_PROMPT_ENTRY + 25),
      });

      expect(entries).toHaveLength(2);
      expect(entries[0].displayPath).toBe('src/app.tsx (part 1/2)');
      expect(entries[1].displayPath).toBe('src/app.tsx (part 2/2)');
    });

    test('keeps short file contents as a single entry', () => {
      const entries = buildPromptFileEntries({ 'src/app.tsx': 'export const App = () => null;' });

      expect(entries).toEqual([
        {
          displayPath: 'src/app.tsx',
          sourcePath: 'src/app.tsx',
          excerpt: 'export const App = () => null;',
        },
      ]);
    });
  });

  describe('buildCodePromptSlices', () => {
    test('creates multiple prompt slices when a file is split into several parts', () => {
      const slices = buildCodePromptSlices(
        {
          'src/app.tsx': 'x'.repeat(AI_MAX_CHARS_PER_PROMPT_ENTRY * 2 + 50),
          'src/utils.ts': 'export const noop = () => {};',
        },
        {
          maxCharsPerEntry: AI_MAX_CHARS_PER_PROMPT_ENTRY,
          maxPromptChars: AI_MAX_CHARS_PER_PROMPT_ENTRY + 200,
          maxEntriesPerSlice: 2,
        }
      );

      expect(slices).toHaveLength(3);
      expect(slices[0].entries[0].displayPath).toContain('src/app.tsx (part 1/3)');
      expect(slices[2].entries.some((entry) => entry.displayPath === 'src/utils.ts')).toBe(true);
      expect(slices[0].oversizedPaths).toContain('src/app.tsx');
    });
  });

  describe('formatPromptFileEntries', () => {
    test('formats split prompt entries without truncated markers', () => {
      const result = formatPromptFileEntries([
        { displayPath: 'src/app.tsx (part 1/2)', excerpt: 'const x = 1;' },
      ]);

      expect(result).toContain('### src/app.tsx (part 1/2)');
      expect(result).not.toContain('[truncated]');
    });
  });

  describe('buildCodeContentHash', () => {
    test('returns 8-char string for valid input', () => {
      const hash = buildCodeContentHash({ 'src/a.ts': 'hello' });
      expect(hash).toMatch(/^[0-9a-f]{8}$/);
    });

    test('returns 00000000 for empty/null input', () => {
      expect(buildCodeContentHash(null)).toBe('00000000');
      expect(buildCodeContentHash({})).toBe('00000000');
    });

    test('same content produces same hash', () => {
      const c = { 'src/a.ts': 'hello', 'src/b.ts': 'world' };
      expect(buildCodeContentHash(c)).toBe(buildCodeContentHash(c));
    });

    test('different content produces different hash', () => {
      expect(buildCodeContentHash({ 'src/a.ts': 'foo' })).not.toBe(
        buildCodeContentHash({ 'src/a.ts': 'bar' })
      );
    });
  });

  // ========================================================================
  // PURE FUNCTIONS - Error Resilience
  // ========================================================================

  describe('shouldRunErrorResiliencePrompt', () => {
    test('returns true for nodejs_api', () => {
      expect(shouldRunErrorResiliencePrompt('nodejs_api')).toBe(true);
    });

    test('returns true for react_spa', () => {
      expect(shouldRunErrorResiliencePrompt('react_spa')).toBe(true);
    });

    test('returns true for python_app', () => {
      expect(shouldRunErrorResiliencePrompt('python_app')).toBe(true);
    });

    test('returns true for shell_script_automation', () => {
      expect(shouldRunErrorResiliencePrompt('shell_script_automation')).toBe(true);
    });

    test('returns true for client_spa', () => {
      expect(shouldRunErrorResiliencePrompt('client_spa')).toBe(true);
    });

    test('returns true for generic', () => {
      expect(shouldRunErrorResiliencePrompt('generic')).toBe(true);
    });

    test('returns true for unknown/empty kind', () => {
      expect(shouldRunErrorResiliencePrompt('')).toBe(true);
      expect(shouldRunErrorResiliencePrompt(undefined)).toBe(true);
    });

    test('returns false for static_website', () => {
      expect(shouldRunErrorResiliencePrompt('static_website')).toBe(false);
    });

    test('returns false for configuration_library', () => {
      expect(shouldRunErrorResiliencePrompt('configuration_library')).toBe(false);
    });
  });

  describe('buildSupportingQualityPromptFields', () => {
    test('summarizes per-language linter evidence for prompt injection', () => {
      const fields = buildSupportingQualityPromptFields([
        {
          language: 'javascript',
          sourceFileCount: 3,
          linterCommand: 'npm run lint',
          linterResults: { totalIssues: 0, errors: 0, warnings: 0, infos: 0 },
        },
      ]);

      expect(fields.supportingQualityScopeNote).toContain('supporting evidence only');
      expect(fields.supportingQualityContext).toContain('javascript: 3 source file(s)');
      expect(fields.supportingQualityContext).toContain('`npm run lint`');
      expect(fields.supportingQualityContext).toContain('no issues found');
    });

    test('falls back to explicit unavailable wording when no evidence exists', () => {
      const fields = buildSupportingQualityPromptFields([]);

      expect(fields.supportingQualityScopeNote).toContain('No supplementary tooling');
      expect(fields.supportingQualityContext).toContain('evidence unavailable');
    });
  });

  describe('resolveCohesionGuideStatus', () => {
    test('reports present and missing mandatory guide files', async () => {
      const fileOps = {
        exists: async (filePath) => filePath.endsWith('HIGH_COHESION_GUIDE.md'),
      };

      const status = await resolveCohesionGuideStatus(fileOps, '/project', 2);

      expect(status).toContain('HIGH_COHESION_GUIDE.md`: PRESENT');
      expect(status).toContain('LOW_COUPLING_GUIDE.md`: MISSING');
    });

    test('marks guide status unavailable when file checks cannot run', async () => {
      const status = await resolveCohesionGuideStatus(null, '/project', 2);
      expect(status).toContain('Unavailable');
    });
  });

  describe('isStep10CodeReviewableFile', () => {
    test('returns true for source-like executable files', () => {
      expect(isStep10CodeReviewableFile('src/app.ts')).toBe(true);
      expect(isStep10CodeReviewableFile('scripts/sync-pajussara-cdn.mjs')).toBe(true);
      expect(isStep10CodeReviewableFile('eslint.config.mjs')).toBe(true);
    });

    test('returns false for metadata-only files such as lockfiles', () => {
      expect(isStep10CodeReviewableFile('package-lock.json')).toBe(false);
      expect(isStep10CodeReviewableFile('package.json')).toBe(false);
    });
  });

  describe('isErrorResilienceReviewableFile', () => {
    test('returns true for executable source-like files', () => {
      expect(isErrorResilienceReviewableFile('src/server.ts')).toBe(true);
      expect(isErrorResilienceReviewableFile('scripts/deploy.sh')).toBe(true);
    });

    test('returns false for declaration files and metadata', () => {
      expect(isErrorResilienceReviewableFile('src/types.d.ts')).toBe(false);
      expect(isErrorResilienceReviewableFile('package-lock.json')).toBe(false);
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

      expect(result.success).toBe(true);
      expect(result.hasLintErrors).toBe(true);
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

    // [BUG FIX bb8f213] execute() reads source files and passes fileContents to AI prompt
    test('[BUG FIX] execute() reads discovered source files for AI prompt', async () => {
      const readFileCalls = [];
      mockTechStack.detectAll = async () => ({
        languages: ['javascript'],
        primary_language: 'javascript',
      });
      mockFileOps.glob = async () => ['src/index.js', 'src/utils.js'];
      mockFileOps.readFile = async (filePath) => {
        readFileCalls.push(filePath);
        if (filePath === '/project/src/index.js') return 'export const main = () => {};';
        if (filePath === '/project/src/utils.js') return 'export const noop = () => {};';
        throw new Error('not found');
      };
      mockExecutor.execute = async () => ({ stdout: '', stderr: '', exitCode: 0 });

      const aiRequests = [];
      analyzer.aiHelper = {
        initialize: jest.fn().mockResolvedValue(false),
        executeRequest: jest.fn().mockImplementation(async (prompt) => {
          aiRequests.push(prompt);
          return '**Severity**: None';
        }),
      };

      await analyzer.execute('/project');

      // readFile must have been called for at least one source file
      const srcReads = readFileCalls.filter((p) => p.includes('/project/'));
      expect(srcReads.length).toBeGreaterThan(0);
    });

    // [BUG FIX bb8f213] fileContents are injected into the AI prompt (4000-char per file budget)
    test('[BUG FIX] execute() truncates large file contents to 4000 chars per file', async () => {
      mockTechStack.detectAll = async () => ({
        languages: ['javascript'],
        primary_language: 'javascript',
      });
      const bigContent = 'x'.repeat(8000);
      mockFileOps.glob = async () => ['src/big.js'];
      mockFileOps.readFile = async () => bigContent;
      mockExecutor.execute = async () => ({ stdout: '', stderr: '', exitCode: 0 });

      const promptContents = [];
      analyzer.aiHelper = {
        initialize: jest.fn().mockResolvedValue(false),
        executeRequest: jest.fn().mockImplementation(async (prompt) => {
          promptContents.push(prompt);
          return '**Severity**: None';
        }),
      };

      await analyzer.execute('/project');

      if (promptContents.length > 0) {
        // The file content embedded in the prompt must be truncated — no 8000-char run of 'x'
        expect(promptContents[0]).not.toContain('x'.repeat(4001));
      }
    });

    test('AI prompt builder injects supplementary quality evidence and cohesion guide status', async () => {
      const service = new Step10AiReviewService({
        fileOps: {
          exists: async (filePath) =>
            filePath.endsWith('HIGH_COHESION_GUIDE.md') ||
            filePath.endsWith('.prettierrc.json') ||
            filePath.endsWith('CONTRIBUTING.md') ||
            filePath.endsWith('copilot-instructions.md'),
          readFile: async (filePath) => {
            if (filePath.endsWith('package.json')) {
              return JSON.stringify({
                scripts: {
                  format: 'prettier --write "**/*.{js,json,md}"',
                  'format:check': 'prettier --check "**/*.{js,json,md}"',
                },
              });
            }
            return '';
          },
        },
      });

      const prompt = await service.buildQualitySlicePrompt({
        sharedParsedYaml: {
          step10_code_quality_prompt: {
            task_template: [
              'Supplementary:',
              '{supporting_quality_scope_note}',
              '{supporting_quality_context}',
              'Guides:',
              '{cohesion_guide_status}',
              '{file_content_map}',
            ].join('\n'),
            approach: 'Review only shown files.',
          },
        },
        promptSlice: {
          entries: [{ displayPath: 'src/index.js', excerpt: 'export const main = () => {};' }],
          scopePaths: ['src/index.js'],
          oversizedPaths: [],
        },
        promptSlices: [{ scopePaths: ['src/index.js'] }],
        partition: { index: 0, total: 1 },
        sliceIndex: 0,
        projectRoot: '/project',
        options: { modifiedFiles: [] },
        primaryLanguage: 'javascript',
        detectedLanguages: ['javascript'],
        aggregateTotals: { totalIssues: 0, fileCount: 1 },
        perLanguageResults: [
          {
            language: 'javascript',
            sourceFileCount: 1,
            linterCommand: 'npm run lint',
            linterResults: { totalIssues: 0, errors: 0, warnings: 0, infos: 0 },
          },
        ],
        report: '# Code Quality Report',
        reviewableSourceFiles: ['src/index.js'],
      });

      expect(prompt).toContain('supporting evidence only');
      expect(prompt).toContain('javascript: 1 source file(s)');
      expect(prompt).toContain('Formatter tooling evidence:');
      expect(prompt).toContain('`.prettierrc.json` present');
      expect(prompt).toContain('`format`');
      expect(prompt).toContain('Project convention sources:');
      expect(prompt).toContain('`CONTRIBUTING.md`: PRESENT');
      expect(prompt).toContain('`.github/copilot-instructions.md`: PRESENT');
      expect(prompt).toContain('HIGH_COHESION_GUIDE.md`: PRESENT');
      expect(prompt).toContain('LOW_COUPLING_GUIDE.md`: MISSING');
    });

    test('AI prompt builder falls back to .workflow-config.yaml for project kind when options omit it', async () => {
      const service = new Step10AiReviewService({
        fileOps: {
          exists: async () => false,
          readFile: async (filePath) => {
            if (filePath.endsWith('.workflow-config.yaml')) {
              return "project:\n  kind: 'nodejs_automation'\n";
            }
            return '';
          },
        },
      });

      const prompt = await service.buildQualitySlicePrompt({
        sharedParsedYaml: {
          step10_code_quality_prompt: {
            task_template: ['Kind: {project_kind}', '{file_content_map}'].join('\n'),
            approach: 'Review only shown files.',
          },
        },
        promptSlice: {
          entries: [{ displayPath: 'src/index.js', excerpt: 'export const main = () => {};' }],
          scopePaths: ['src/index.js'],
          oversizedPaths: [],
        },
        promptSlices: [{ scopePaths: ['src/index.js'] }],
        partition: { index: 0, total: 1 },
        sliceIndex: 0,
        projectRoot: '/project',
        options: { modifiedFiles: [] },
        primaryLanguage: 'javascript',
        detectedLanguages: ['javascript'],
        aggregateTotals: { totalIssues: 0, fileCount: 1 },
        perLanguageResults: [],
        report: '# Code Quality Report',
        reviewableSourceFiles: ['src/index.js'],
      });

      expect(prompt).toContain('Kind: nodejs_automation');
    });

    // AI phase partition system: each run reviews one small batch of files.
    // Multi-file coverage accumulates across successive runs via partition rotation.
    test('AI phase uses partition system: one partition per run, with prompt slices as needed', async () => {
      // With MAX_PARTITION_SIZE=5, each run still reviews exactly one partition.
      // Step 10 may now split that partition across multiple AI prompt slices.
      const fileCount = AI_FILES_PER_SLICE * 2 + 1; // 11 total files
      const files = Array.from({ length: fileCount }, (_, i) => `src/file${i}.js`);
      mockTechStack.detectAll = async () => ({
        languages: ['javascript'],
        primary_language: 'javascript',
      });
      mockFileOps.glob = async () => files;
      mockFileOps.readFile = async () => 'const x = 1;';
      mockExecutor.execute = async () => ({ stdout: '', stderr: '', exitCode: 0 });

      const prompts = [];
      analyzer.aiHelper = {
        initialize: jest.fn().mockResolvedValue(true),
        executeRequest: jest.fn().mockImplementation(async (prompt) => {
          prompts.push(prompt);
          return { content: 'ok' };
        }),
      };
      analyzer.aiCache = {
        init: jest.fn().mockResolvedValue(undefined),
        withCache: jest.fn().mockImplementation((_prompt, _key, fn) => fn()),
        withFileChangeGuard: jest.fn().mockImplementation((_stepId, _fileContents, fn) => fn()),
      };

      // Use a real writable temp directory so the partition cache can persist state.
      const testDir = await mkdtemp(join(tmpdir(), 'step10-test-'));
      try {
        const result = await analyzer.execute(testDir, { modifiedFiles: [] });
        expect(result.success).toBe(true);
        expect(prompts.length).toBe(2);
      } finally {
        await rm(testDir, { recursive: true, force: true });
      }
    });

    test('AI phase falls back to full rotation when every file is quality-exempt', async () => {
      const files = ['src/a.js', 'src/b.js'];
      mockTechStack.detectAll = async () => ({
        languages: ['javascript'],
        primary_language: 'javascript',
      });
      mockFileOps.glob = async () => files;
      mockFileOps.readFile = async (filePath) => {
        if (filePath.endsWith('.yaml')) {
          return [
            'step10_code_quality_prompt:',
            '  role_prefix: |',
            '    You are a reviewer.',
            '  task_template: |',
            '    {partition_header}',
            '    Files: {files_in_scope}',
            '    {file_content_map}',
            '    {partition_scope_note}',
            '  approach: |',
            '    Review only shown files.',
          ].join('\n');
        }
        return 'const x = 1;';
      };
      mockExecutor.execute = async () => ({ stdout: '', stderr: '', exitCode: 0 });

      const prompts = [];
      analyzer.aiHelper = {
        initialize: jest.fn().mockResolvedValue(true),
        executeRequest: jest.fn().mockImplementation(async (prompt) => {
          prompts.push(prompt);
          return { content: 'ok' };
        }),
      };
      analyzer.aiCache = {
        init: jest.fn().mockResolvedValue(undefined),
        withCache: jest.fn().mockImplementation((_prompt, _key, fn) => fn()),
        withFileChangeGuard: jest.fn().mockImplementation((_stepId, _fileContents, fn) => fn()),
      };

      const testDir = await mkdtemp(join(tmpdir(), 'step10-exempt-test-'));
      try {
        await mkdir(join(testDir, '.ai_workflow', '.step_cache'), { recursive: true });
        await writeFile(
          join(testDir, '.ai_workflow', '.step_cache', 'step_10_quality.json'),
          JSON.stringify({
            version: 1,
            fileScores: {
              'src/a.js': { score: 100, issueCount: 0, lastAnalyzed: '2026-01-01T00:00:00.000Z' },
              'src/b.js': { score: 100, issueCount: 0, lastAnalyzed: '2026-01-01T00:00:00.000Z' },
            },
          }),
          'utf8'
        );

        const result = await analyzer.execute(testDir, { modifiedFiles: [] });
        expect(result.success).toBe(true);
        expect(prompts).toHaveLength(1);
        expect(prompts[0]).toContain('Files: 2');
        expect(prompts[0]).toContain('### src/a.js');
        expect(prompts[0]).not.toContain('(no source files provided)');
      } finally {
        await rm(testDir, { recursive: true, force: true });
      }
    });

    test('AI phase skips lockfile-only partitions after reviewable-file filtering', async () => {
      mockTechStack.detectAll = async () => ({
        languages: [],
        primary_language: 'javascript',
      });
      mockFileOps.glob = async (pattern) => (pattern.endsWith('.json') ? ['package-lock.json'] : []);
      mockFileOps.readFile = async (filePath) => {
        if (filePath.endsWith('package-lock.json')) {
          return '{"name":"demo","lockfileVersion":3,"packages":{}}';
        }
        throw new Error('not found');
      };
      mockExecutor.execute = async () => ({ stdout: '', stderr: '', exitCode: 0 });

      const prompts = [];
      analyzer.aiHelper = {
        initialize: jest.fn().mockResolvedValue(true),
        executeRequest: jest.fn().mockImplementation(async (prompt) => {
          prompts.push(prompt);
          return { content: 'ok' };
        }),
      };
      analyzer.aiCache = {
        init: jest.fn().mockResolvedValue(undefined),
        withFileChangeGuard: jest.fn().mockImplementation((_key, _files, fn) => fn()),
      };

      const testDir = await mkdtemp(join(tmpdir(), 'step10-lockfile-only-'));
      try {
        const result = await analyzer.execute(testDir, {
          projectKind: 'nodejs_api',
          modifiedFiles: [],
        });

        expect(result.success).toBe(true);
        expect(prompts).toHaveLength(0);
        expect(result.erFindings).toBe('');
      } finally {
        await rm(testDir, { recursive: true, force: true });
      }
    });

    test('AI phase filters metadata files while keeping source-like files reviewable', async () => {
      mockTechStack.detectAll = async () => ({
        languages: ['javascript'],
        primary_language: 'javascript',
      });
      mockFileOps.glob = async (pattern) => {
        if (pattern.endsWith('.mjs')) return ['scripts/sync-pajussara-cdn.mjs'];
        if (pattern.endsWith('.json')) return ['package.json', 'package-lock.json'];
        return [];
      };
      mockFileOps.readFile = async (filePath) => {
        if (filePath.includes('ai_helpers')) return minimalErYaml;
        if (filePath.endsWith('scripts/sync-pajussara-cdn.mjs')) return 'await fetch("https://example.test");';
        if (filePath.endsWith('package.json')) return '{"name":"demo","scripts":{"lint":"eslint ."}}';
        if (filePath.endsWith('package-lock.json')) {
          return '{"name":"demo","lockfileVersion":3,"packages":{}}';
        }
        throw new Error('not found');
      };
      mockExecutor.execute = async () => ({ stdout: '', stderr: '', exitCode: 0 });

      const prompts = [];
      analyzer.aiHelper = {
        initialize: jest.fn().mockResolvedValue(true),
        executeRequest: jest.fn().mockImplementation(async (prompt) => {
          prompts.push(prompt);
          return { content: 'ok' };
        }),
      };
      analyzer.aiCache = {
        init: jest.fn().mockResolvedValue(undefined),
        withFileChangeGuard: jest.fn().mockImplementation((_key, _files, fn) => fn()),
      };

      const testDir = await mkdtemp(join(tmpdir(), 'step10-reviewable-filter-'));
      try {
        const result = await analyzer.execute(testDir, {
          projectKind: 'nodejs_api',
          modifiedFiles: [],
        });

        expect(result.success).toBe(true);
        expect(prompts.length).toBeGreaterThan(0);
        expect(prompts.some((prompt) => prompt.includes('scripts/sync-pajussara-cdn.mjs'))).toBe(
          true
        );
        expect(prompts.some((prompt) => prompt.includes('package-lock.json'))).toBe(false);
        expect(prompts.some((prompt) => prompt.includes('### package.json'))).toBe(false);
      } finally {
        await rm(testDir, { recursive: true, force: true });
      }
    });

    test('AI phase splits oversized source files across multiple prompt slices', async () => {
      mockTechStack.detectAll = async () => ({
        languages: ['javascript'],
        primary_language: 'javascript',
      });
      mockFileOps.glob = async () => ['src/big.js'];
      mockFileOps.readFile = async (filePath) => {
        if (filePath.endsWith('.yaml')) {
          return [
            'step10_code_quality_prompt:',
            '  role_prefix: |',
            '    You are a reviewer.',
            '  task_template: |',
            '    {partition_header}',
            '    {file_content_map}',
            '  approach: |',
            '    Review only shown files.',
          ].join('\n');
        }
        return 'x'.repeat(AI_MAX_CHARS_PER_PROMPT_ENTRY * 3 + 50);
      };
      mockExecutor.execute = async () => ({ stdout: '', stderr: '', exitCode: 0 });

      const prompts = [];
      analyzer.aiHelper = {
        initialize: jest.fn().mockResolvedValue(true),
        executeRequest: jest.fn().mockImplementation(async (prompt) => {
          prompts.push(prompt);
          return { content: 'ok' };
        }),
      };
      analyzer.aiCache = {
        init: jest.fn().mockResolvedValue(undefined),
        withCache: jest.fn().mockImplementation((_prompt, _key, fn) => fn()),
        withFileChangeGuard: jest.fn().mockImplementation((_stepId, _fileContents, fn) => fn()),
      };

      const testDir = await mkdtemp(join(tmpdir(), 'step10-chunk-test-'));
      try {
        const result = await analyzer.execute(testDir, { modifiedFiles: [] });
        expect(result.success).toBe(true);
        expect(prompts.length).toBeGreaterThan(1);
        expect(prompts[0]).toContain('src/big.js (part 1/4)');
        expect(prompts[1]).toContain('src/big.js (part 4/4)');
        expect(prompts.join('\n')).not.toContain('[truncated]');
      } finally {
        await rm(testDir, { recursive: true, force: true });
      }
    });

    // AI phase: errors must not propagate — step must still succeed
    test('AI phase errors are caught and do not fail the step', async () => {
      mockTechStack.detectAll = async () => ({
        languages: ['javascript'],
        primary_language: 'javascript',
      });
      mockFileOps.glob = async () => ['src/index.js'];
      mockFileOps.readFile = async () => 'const x = 1;';
      mockExecutor.execute = async () => ({ stdout: '', stderr: '', exitCode: 0 });

      analyzer.aiHelper = {
        initialize: jest.fn().mockResolvedValue(true),
        executeRequest: jest.fn().mockRejectedValue(new Error('request timeout')),
      };
      analyzer.aiCache = {
        init: jest.fn().mockResolvedValue(undefined),
        withCache: jest.fn().mockImplementation((_prompt, _key, fn) => fn()),
        withFileChangeGuard: jest.fn().mockImplementation((_stepId, _fileContents, fn) => fn()),
      };

      const result = await analyzer.execute('/project');
      expect(result.success).toBe(true);
    });

    // -----------------------------------------------------------------------
    // Error Resilience integration tests
    // -----------------------------------------------------------------------

    /** Minimal ai_helpers.yaml stub containing only the error_resilience_prompt key. */
    const minimalErYaml = [
      'error_resilience_prompt:',
      '  role_prefix: |',
      '    You are a reliability engineer.',
      '  task_template: |',
      '    Review {project_name} files.',
      '    {file_content_map}',
      '  approach: |',
      '    Check error handling.',
    ].join('\n');

    test('error resilience runs as a separate AI call per partition', async () => {
      mockTechStack.detectAll = async () => ({
        languages: ['javascript'],
        primary_language: 'javascript',
      });
      mockFileOps.glob = async () => ['src/index.js'];
      mockFileOps.readFile = async (path) => {
        if (path.includes('ai_helpers')) return minimalErYaml;
        return 'const x = 1;';
      };
      mockExecutor.execute = async () => ({ stdout: '', stderr: '', exitCode: 0 });

      const cacheKeys = [];
      const prompts = [];
      analyzer.aiHelper = {
        initialize: jest.fn().mockResolvedValue(true),
        executeRequest: jest.fn().mockImplementation(async (prompt) => {
          prompts.push(prompt);
          return { content: 'analysis result' };
        }),
      };
      analyzer.aiCache = {
        init: jest.fn().mockResolvedValue(undefined),
        withFileChangeGuard: jest.fn().mockImplementation((key, _files, fn) => {
          cacheKeys.push(key);
          return fn();
        }),
      };

      const testDir = await mkdtemp(join(tmpdir(), 'step10-er-test-'));
      try {
        const result = await analyzer.execute(testDir, {
          projectKind: 'nodejs_api',
          modifiedFiles: [],
        });

        expect(result.success).toBe(true);
        // Main quality call (per slice) + ER call (per partition) = 2 total AI requests.
        expect(prompts.length).toBe(2);
        // ER call uses a distinct step_10_er_p cache key.
        expect(cacheKeys.some((k) => k.startsWith('step_10_er_p'))).toBe(true);
        // ER result is exposed in the return value.
        expect(result.erFindings).toBe('analysis result');
      } finally {
        await rm(testDir, { recursive: true, force: true });
      }
    });

    test('error resilience section appears separately in the backlog report', async () => {
      mockTechStack.detectAll = async () => ({
        languages: ['javascript'],
        primary_language: 'javascript',
      });
      mockFileOps.glob = async () => ['src/index.js'];
      mockFileOps.readFile = async (path) => {
        if (path.includes('ai_helpers')) return minimalErYaml;
        return 'const x = 1;';
      };
      mockExecutor.execute = async () => ({ stdout: '', stderr: '', exitCode: 0 });

      const savedReports = [];
      mockBacklog.saveStepSummary = async (_step, _label, report) => {
        savedReports.push(report);
      };

      analyzer.aiHelper = {
        initialize: jest.fn().mockResolvedValue(true),
        executeRequest: jest.fn().mockResolvedValue({ content: 'ER findings here' }),
      };
      analyzer.aiCache = {
        init: jest.fn().mockResolvedValue(undefined),
        withFileChangeGuard: jest.fn().mockImplementation((_key, _files, fn) => fn()),
      };

      const testDir = await mkdtemp(join(tmpdir(), 'step10-er-report-'));
      try {
        await analyzer.execute(testDir, { projectKind: 'nodejs_api', modifiedFiles: [] });

        const finalReport = savedReports[savedReports.length - 1];
        expect(finalReport).toContain('## Error Resilience Analysis');
        expect(finalReport).toContain('ER findings here');
      } finally {
        await rm(testDir, { recursive: true, force: true });
      }
    });

    test('static_website skips the error resilience pass', async () => {
      mockTechStack.detectAll = async () => ({
        languages: ['javascript'],
        primary_language: 'javascript',
      });
      mockFileOps.glob = async () => ['src/index.js'];
      mockFileOps.readFile = async (path) => {
        if (path.includes('ai_helpers')) return minimalErYaml;
        return 'const x = 1;';
      };
      mockExecutor.execute = async () => ({ stdout: '', stderr: '', exitCode: 0 });

      const cacheKeys = [];
      analyzer.aiHelper = {
        initialize: jest.fn().mockResolvedValue(true),
        executeRequest: jest.fn().mockResolvedValue({ content: 'main result' }),
      };
      analyzer.aiCache = {
        init: jest.fn().mockResolvedValue(undefined),
        withFileChangeGuard: jest.fn().mockImplementation((key, _files, fn) => {
          cacheKeys.push(key);
          return fn();
        }),
      };

      const testDir = await mkdtemp(join(tmpdir(), 'step10-static-'));
      try {
        const result = await analyzer.execute(testDir, {
          projectKind: 'static_website',
          modifiedFiles: [],
        });

        expect(result.success).toBe(true);
        // No ER cache key should be generated for static_website.
        expect(cacheKeys.some((k) => k.startsWith('step_10_er_p'))).toBe(false);
        expect(result.erFindings).toBe('');
      } finally {
        await rm(testDir, { recursive: true, force: true });
      }
    });

    test('countSourceFiles excludes test directories and test file patterns', async () => {
      // Capture all glob calls and their ignore options
      const globCalls = [];
      mockFileOps.glob = async (pattern, opts) => {
        globCalls.push({ pattern, ignore: opts?.ignore ?? [] });
        return ['src/utils.js'];
      };
      mockExecutor.execute = async () => ({ stdout: '', stderr: '', exitCode: 0 });

      await analyzer.execute('/project');

      // At least one glob call must have been made for source file counting
      expect(globCalls.length).toBeGreaterThan(0);

      // Every glob call must exclude test directories and patterns
      for (const call of globCalls) {
        const ignoreStr = call.ignore.join('|');
        expect(ignoreStr).toMatch(/\*\*\/test(s?)\/\*\*/);
        expect(ignoreStr).toMatch(/\*\*\/\*\.test\.(js|ts|jsx|tsx)/);
      }
    });
  });

  describe('Step10CodeQualityAnalyzer - alternatives directive', () => {
    let tmpDir;

    beforeEach(async () => {
      tmpDir = await mkdtemp(join(tmpdir(), 'step10-alt-'));
    });

    afterEach(async () => {
      await rm(tmpDir, { recursive: true, force: true });
    });

    test('returns empty alternatives when flag is false', async () => {
      const analyzer = new Step10CodeQualityAnalyzer({
        executor: { execute: async () => ({ stdout: '', stderr: '', exitCode: 0 }) },
        fileOps: {
          readFile: async () => {
            throw new Error('not found');
          },
          glob: async () => [],
        },
        backlog: { saveStepSummary: async () => {} },
        techStack: {
          detectAll: async () => ({ languages: ['javascript'], primary_language: 'javascript' }),
        },
        aiHelper: { initialize: () => Promise.resolve(false) },
      });
      const result = await analyzer.execute('/project');
      expect(result.alternatives).toEqual([]);
      expect(result.recommendedAlternative).toBeNull();
    });

    test('appends alternatives directive to prompt when flag is set', async () => {
      let capturedPrompt = '';
      const structuredResponse = [
        'ALTERNATIVE 1: ESLint strict\n  Description: Strict ruleset\n  Trade-offs: More false positives',
        'ALTERNATIVE 2: ESLint recommended\n  Description: Standard ruleset\n  Trade-offs: Fewer flags',
        'RECOMMENDED: 2 — Recommended rules balance quality and noise',
      ].join('\n');
      const mockAiHelper = {
        initialize: () => Promise.resolve(true),
        executeRequest: (prompt) => {
          capturedPrompt = prompt;
          return Promise.resolve({ content: structuredResponse });
        },
      };
      const mockAiCache = {
        init: () => Promise.resolve(),
        withFileChangeGuard: (_key, _files, fn) => fn(),
      };
      const analyzer = new Step10CodeQualityAnalyzer({
        executor: { execute: async () => ({ stdout: '', stderr: '', exitCode: 0 }) },
        fileOps: {
          readFile: async (filePath) =>
            filePath.endsWith('src/index.js') ? 'export const main = () => {};' : '',
          glob: async (pattern) => (pattern.includes('js') ? ['src/index.js'] : []),
        },
        backlog: { saveStepSummary: async () => {} },
        techStack: {
          detectAll: async () => ({ languages: ['javascript'], primary_language: 'javascript' }),
        },
        aiHelper: mockAiHelper,
        aiCache: mockAiCache,
        cacheDir: tmpDir,
      });
      // Use tmpDir as projectRoot so Step10PartitionCache can write its cache files
      const result = await analyzer.execute(tmpDir, { alternatives: 2 });
      expect(capturedPrompt).toMatch(/ALTERNATIVE/i);
      expect(result.alternatives).toHaveLength(2);
      expect(result.recommendedAlternative).toBeTruthy();
    });
  });
});
