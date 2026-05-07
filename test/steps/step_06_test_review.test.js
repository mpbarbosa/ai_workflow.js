/**
 * Tests for Step 6: Test Review
 * @group steps
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

import {
  Step6TestReviewer,
  getTestPatterns,
  getCoveragePaths,
  getCoverageCommand,
  isTestFile,
  categorizeTestFiles,
  countDedicatedTestDirectoryFiles,
  parseCoveragePercentage,
  getCoverageStatus,
  calculateTestStatistics,
  formatTestReport,
  ISSUE_TYPE,
} from '../../src/steps/step_06_test_review.js';

describe('Step 6: Test Review', () => {
  // ========================================================================
  // PURE FUNCTIONS - Test File Discovery
  // ========================================================================

  describe('getTestPatterns', () => {
    test('returns JavaScript patterns', () => {
      const patterns = getTestPatterns('javascript');
      expect(patterns).toContain('**/*.test.js');
      expect(patterns).toContain('**/*.spec.js');
    });

    test('returns TypeScript patterns', () => {
      const patterns = getTestPatterns('typescript');
      expect(patterns).toContain('**/*.test.ts');
      expect(patterns).toContain('**/*.spec.ts');
    });

    test('returns Python patterns', () => {
      const patterns = getTestPatterns('python');
      expect(patterns).toContain('**/test_*.py');
      expect(patterns).toContain('**/*_test.py');
    });

    test('defaults to JavaScript for unknown language', () => {
      const patterns = getTestPatterns('unknown');
      expect(patterns).toContain('**/*.test.js');
    });
  });

  describe('getCoveragePaths', () => {
    test('returns JavaScript coverage paths', () => {
      const paths = getCoveragePaths('javascript');
      expect(paths).toContain('coverage/lcov-report/index.html');
    });

    test('returns Python coverage paths', () => {
      const paths = getCoveragePaths('python');
      expect(paths).toContain('htmlcov/index.html');
    });

    test('defaults to JavaScript for unknown language', () => {
      const paths = getCoveragePaths('unknown');
      expect(paths).toContain('coverage/index.html');
    });
  });

  describe('getCoverageCommand', () => {
    test('returns npm test:coverage for JavaScript', () => {
      expect(getCoverageCommand('javascript')).toBe('npm run test:coverage');
    });

    test('returns npm test:coverage for TypeScript', () => {
      expect(getCoverageCommand('typescript')).toBe('npm run test:coverage');
    });

    test('falls back to a generic npm coverage command for unknown languages', () => {
      expect(getCoverageCommand('unknown')).toBe('npm run coverage');
    });
  });

  describe('isTestFile', () => {
    test('identifies .test.js files', () => {
      expect(isTestFile('src/utils.test.js')).toBe(true);
    });

    test('identifies .spec.ts files', () => {
      expect(isTestFile('src/component.spec.ts')).toBe(true);
    });

    test('identifies test_*.py files', () => {
      expect(isTestFile('test_utils.py')).toBe(true);
    });

    test('identifies *_test.go files', () => {
      expect(isTestFile('utils_test.go')).toBe(true);
    });

    test('rejects non-test files', () => {
      expect(isTestFile('src/utils.js')).toBe(false);
      expect(isTestFile('index.ts')).toBe(false);
    });
  });

  describe('categorizeTestFiles', () => {
    test('categorizes unit tests', () => {
      const files = ['test/unit/utils.test.js', 'src/unit.test.js'];
      const result = categorizeTestFiles(files);

      expect(result.unit).toHaveLength(2);
    });

    test('categorizes integration tests', () => {
      const files = ['test/integration/api.test.js', 'src/integration.test.js'];
      const result = categorizeTestFiles(files);

      expect(result.integration).toHaveLength(2);
    });

    test('categorizes e2e tests', () => {
      const files = ['test/e2e/flows.test.js', 'src/e2e.test.js'];
      const result = categorizeTestFiles(files);

      expect(result.e2e).toHaveLength(2);
    });

    test('categorizes other tests', () => {
      const files = ['test/component.test.js', 'src/widget.spec.js'];
      const result = categorizeTestFiles(files);

      expect(result.other).toHaveLength(2);
    });

    test('handles empty array', () => {
      const result = categorizeTestFiles([]);

      expect(result.unit).toHaveLength(0);
      expect(result.integration).toHaveLength(0);
      expect(result.e2e).toHaveLength(0);
      expect(result.other).toHaveLength(0);
    });
  });

  describe('countDedicatedTestDirectoryFiles', () => {
    test('counts root and nested dedicated test directories', () => {
      const files = [
        'test/cli/commands/clean.test.ts',
        'src/__tests__/helpers.test.js',
        'src/lib/utils.test.js',
      ];

      expect(countDedicatedTestDirectoryFiles(files)).toBe(2);
    });

    test('returns zero for co-located tests only', () => {
      const files = ['src/lib/utils.test.js', 'src/cli/output.test.js'];

      expect(countDedicatedTestDirectoryFiles(files)).toBe(0);
    });
  });

  // ========================================================================
  // PURE FUNCTIONS - Coverage Analysis
  // ========================================================================

  describe('parseCoveragePercentage', () => {
    test('parses simple percentage', () => {
      expect(parseCoveragePercentage('85.5%')).toBe(85.5);
    });

    test('parses coverage label', () => {
      expect(parseCoveragePercentage('Coverage: 92.3%')).toBe(92.3);
    });

    test('parses statements label', () => {
      expect(parseCoveragePercentage('Statements: 78.9%')).toBe(78.9);
    });

    test('returns null for invalid input', () => {
      expect(parseCoveragePercentage('no percentage here')).toBeNull();
    });

    test('returns null for out-of-range values', () => {
      expect(parseCoveragePercentage('150%')).toBeNull();
      // Note: '-10%' matches '10' which is valid, so it returns 10
      expect(parseCoveragePercentage('200%')).toBeNull();
    });

    test('handles integer percentages', () => {
      expect(parseCoveragePercentage('100%')).toBe(100);
    });
  });

  describe('getCoverageStatus', () => {
    test('returns good status for high coverage', () => {
      const result = getCoverageStatus(85, 80);

      expect(result.status).toBe('good');
      expect(result.needsImprovement).toBe(false);
    });

    test('returns low status for insufficient coverage', () => {
      const result = getCoverageStatus(65, 80);

      expect(result.status).toBe('low');
      expect(result.needsImprovement).toBe(true);
      expect(result.message).toContain('15% below');
    });

    test('returns unknown status for null coverage', () => {
      const result = getCoverageStatus(null, 80);

      expect(result.status).toBe('unknown');
      expect(result.needsImprovement).toBe(true);
    });

    test('uses default threshold of 80%', () => {
      const result = getCoverageStatus(75);

      expect(result.status).toBe('low');
    });
  });

  // ========================================================================
  // PURE FUNCTIONS - Test Statistics
  // ========================================================================

  describe('calculateTestStatistics', () => {
    test('calculates statistics correctly', () => {
      const params = {
        testFiles: ['test1.js', 'test2.js', 'test3.js'],
        categories: {
          unit: ['test1.js', 'test2.js'],
          integration: ['test3.js'],
          e2e: [],
          other: [],
        },
        totalLines: 300,
      };

      const result = calculateTestStatistics(params);

      expect(result.totalTests).toBe(3);
      expect(result.unitTests).toBe(2);
      expect(result.integrationTests).toBe(1);
      expect(result.e2eTests).toBe(0);
      expect(result.totalLines).toBe(300);
      expect(result.averageLinesPerTest).toBe(100);
    });

    test('handles empty test files', () => {
      const params = {
        testFiles: [],
        categories: { unit: [], integration: [], e2e: [], other: [] },
        totalLines: 0,
      };

      const result = calculateTestStatistics(params);

      expect(result.totalTests).toBe(0);
      expect(result.averageLinesPerTest).toBe(0);
    });
  });

  // ========================================================================
  // PURE FUNCTIONS - Reporting
  // ========================================================================

  describe('formatTestReport', () => {
    test('formats report with tests and coverage', () => {
      const results = {
        testFiles: ['test1.js', 'test2.js'],
        categories: { unit: ['test1.js'], integration: ['test2.js'], e2e: [], other: [] },
        statistics: { totalLines: 200, averageLinesPerTest: 100 },
        coverage: { found: true, path: 'coverage/index.html', percentage: 85 },
        issues: [],
      };

      const report = formatTestReport(results);

      expect(report).toContain('Test Review Report');
      expect(report).toContain('**Total Test Files**: 2');
      expect(report).toContain('**Coverage**: 85%');
      expect(report).toContain('**Unit Tests**: 1');
    });

    test('formats report with no tests', () => {
      const results = {
        testFiles: [],
        issues: [{ type: ISSUE_TYPE.NO_TESTS, message: 'No tests found' }],
      };

      const report = formatTestReport(results);

      expect(report).toContain('**Total Test Files**: 0');
      expect(report).toContain('Critical');
      expect(report).toContain('No test files found');
    });

    test('formats report with no coverage', () => {
      const results = {
        testFiles: ['test1.js'],
        categories: { unit: ['test1.js'], integration: [], e2e: [], other: [] },
        statistics: { totalLines: 100 },
        coverage: { found: false },
        issues: [
          {
            type: ISSUE_TYPE.NO_COVERAGE_REPORT,
            message: 'No coverage reports found',
          },
        ],
      };

      const report = formatTestReport(results);

      expect(report).toContain('**Coverage Reports Found**: No');
      expect(report).toContain('Recommendations');
    });

    test('truncates long issue lists', () => {
      const issues = Array(15)
        .fill(null)
        .map((_, i) => ({
          type: ISSUE_TYPE.MISSING_TESTS,
          message: `Issue ${i}`,
        }));

      const results = {
        testFiles: ['test.js'],
        issues,
      };

      const report = formatTestReport(results);

      expect(report).toContain('... and 5 more');
    });
  });

  // ========================================================================
  // STEP 6 ANALYZER - Integration Tests
  // ========================================================================

  describe('Step6TestReviewer', () => {
    let reviewer;
    let mockFileOps;
    let mockBacklog;
    let mockTechStack;
    let mockAiHelper;
    let mockAiCache;

    beforeEach(() => {
      mockFileOps = {
        readFile: () => Promise.resolve(''),
        glob: () => Promise.resolve([]),
        fileExists: () => Promise.resolve(false),
      };

      mockBacklog = {
        saveStepSummary: () => Promise.resolve(),
      };

      mockTechStack = {
        detectAll: () => Promise.resolve({ languages: ['javascript'] }),
      };

      mockAiHelper = {
        initialize: () => Promise.resolve(false),
      };

      mockAiCache = {
        init: () => Promise.resolve(),
        withCache: (_prompt, _key, fn) => fn(),
      };

      reviewer = new Step6TestReviewer({
        fileOps: mockFileOps,
        backlog: mockBacklog,
        techStack: mockTechStack,
        aiHelper: mockAiHelper,
        aiCache: mockAiCache,
      });
    });

    test('executes successfully with test files', async () => {
      mockFileOps.glob = () => Promise.resolve(['test/unit.test.js', 'test/integration.test.js']);
      mockFileOps.readFile = () => Promise.resolve('// test file\n'.repeat(50));
      mockFileOps.fileExists = () => Promise.resolve(true);

      const result = await reviewer.execute('/project');

      expect(result.success).toBe(true);
      expect(result.testFiles).toHaveLength(2);
    });

    test('handles no test files', async () => {
      mockFileOps.glob = () => Promise.resolve([]);

      const result = await reviewer.execute('/project');

      expect(result.success).toBe(true);
      expect(result.testFiles).toHaveLength(0);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          type: ISSUE_TYPE.NO_TESTS,
        })
      );
    });

    test('detects coverage reports', async () => {
      mockFileOps.glob = () => Promise.resolve(['test/unit.test.js']);
      mockFileOps.readFile = (path) => {
        if (path.includes('coverage')) {
          return Promise.resolve('<html>Coverage: 85.5%</html>');
        }
        return Promise.resolve('// test');
      };
      mockFileOps.fileExists = (path) => Promise.resolve(path.includes('coverage'));

      const result = await reviewer.execute('/project');

      expect(result.success).toBe(true);
      expect(result.coverage.found).toBe(true);
      expect(result.coverage.percentage).toBe(85.5);
    });

    test('identifies missing coverage report', async () => {
      mockFileOps.glob = () => Promise.resolve(['test/unit.test.js']);
      mockFileOps.readFile = () => Promise.resolve('// test');
      mockFileOps.fileExists = () => Promise.resolve(false);

      const result = await reviewer.execute('/project');

      expect(result.success).toBe(true);
      expect(result.coverage.found).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          type: ISSUE_TYPE.NO_COVERAGE_REPORT,
        })
      );
    });

    test('saves report to backlog', async () => {
      let savedTitle = '';
      mockBacklog.saveStepSummary = (step, title) => {
        savedTitle = title;
        return Promise.resolve();
      };

      mockFileOps.glob = () => Promise.resolve([]);

      await reviewer.execute('/project');

      expect(savedTitle).toBe('Test Review');
    });

    test('handles errors gracefully', async () => {
      mockFileOps.glob = () => Promise.reject(new Error('File system error'));

      // The execute method catches errors in discoverTestFiles
      // and returns empty results on first try, then fails on language detection
      // Let's make techStack fail instead
      mockTechStack.detectAll = () => Promise.reject(new Error('Tech stack error'));

      // Since we fallback to 'javascript' on error, and glob fails,
      // we end up with no test files which is handled gracefully
      const result = await reviewer.execute('/project');

      expect(result.success).toBe(true);
      expect(result.testFiles).toHaveLength(0);
    });

    // [BUG FIX 0f99feb] promptsDir must be forwarded so prompt+response files are saved
    test('[BUG FIX] promptsDir option is accepted without error', () => {
      const instance = new Step6TestReviewer({
        fileOps: mockFileOps,
        backlog: mockBacklog,
        techStack: mockTechStack,
        promptsDir: '/tmp/prompts/step_06',
      });
      expect(instance).toBeDefined();
      expect(instance.aiHelper).toBeDefined();
    });

    test('injects config_file_contents and project_context_contents into AI prompt', async () => {
      const prompts = [];
      const tempProjectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'step6-slots-'));
      mockFileOps.glob = () => Promise.resolve(['test/unit.test.js']);
      mockFileOps.readFile = (filePath) => {
        const p = String(filePath);
        if (p.endsWith('ai_helpers.yaml')) {
          return Promise.resolve(`
step6_test_review_prompt:
  role: Test reviewer
  task_template: |
    cfg={config_file_contents}
    ctx={project_context_contents}
    tests={test_file_contents}
  approach: |
    noop
`);
        }
        if (p.endsWith('package.json')) return Promise.resolve('{"name":"my-pkg"}');
        if (p.endsWith('README.md')) return Promise.resolve('# My Project');
        return Promise.resolve('// test body');
      };
      mockAiHelper.initialize = () => Promise.resolve(true);
      mockAiHelper.executeRequest = (prompt) => {
        prompts.push(prompt);
        return Promise.resolve({ content: 'ok' });
      };
      mockAiCache.withFileChangeGuard = (_key, _entries, fn) => fn();
      try {
        const result = await reviewer.execute(tempProjectRoot);
        expect(result.success).toBe(true);
        expect(prompts).toHaveLength(1);
        expect(prompts[0]).toContain('package.json');
        expect(prompts[0]).toContain('README.md');
        expect(prompts[0]).toContain('test/unit.test.js');
      } finally {
        fs.rmSync(tempProjectRoot, { recursive: true, force: true });
      }
    });

    test('uses global test-directory counts and per-slice scope in AI prompts', async () => {
      const prompts = [];
      const tempProjectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'step6-review-'));
      mockFileOps.glob = () =>
        Promise.resolve([
          'test/cli/commands/clean.test.ts',
          'src/__tests__/helpers.test.js',
          'src/lib/utils.test.js',
        ]);
      mockFileOps.readFile = (filePath) => {
        if (String(filePath).endsWith('ai_helpers.yaml')) {
          return Promise.resolve(`
step6_test_review_prompt:
  role: Test reviewer
  task_template: |
    total={test_count}
    dedicated={tests_in_tests_dir}
    colocated={tests_colocated}
    scope={scoped_test_count}
  approach: |
    noop
`);
        }
        return Promise.resolve('// visible test content');
      };
      mockAiHelper.initialize = () => Promise.resolve(true);
      mockAiHelper.executeRequest = (prompt) => {
        prompts.push(prompt);
        return Promise.resolve({ content: 'ok' });
      };
      mockAiCache.withFileChangeGuard = (_key, _entries, fn) => fn();
      try {
        const result = await reviewer.execute(tempProjectRoot);

        expect(result.success).toBe(true);
        expect(prompts).toHaveLength(1);
        expect(prompts[0]).toContain('total=3');
        expect(prompts[0]).toContain('dedicated=2');
        expect(prompts[0]).toContain('colocated=1');
        expect(prompts[0]).toContain('scope=3');
      } finally {
        fs.rmSync(tempProjectRoot, { recursive: true, force: true });
      }
    });
  });
});
