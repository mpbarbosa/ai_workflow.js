/**
 * Tests for Step 8: Test Execution
 * @group steps
 */

import {
  Step8TestExecutor,
  getTestCommand,
  getCoverageFiles,
  hasTestScript,
  extractTestCommand,
  parseJestOutput,
  parsePytestOutput,
  parseTestOutput,
  parseJestCoverage,
  determineTestStatus,
  formatTestReport,
} from '../../src/steps/step_08_test_exec.js';

describe('Step 8: Test Execution', () => {
  // ========================================================================
  // PURE FUNCTIONS - Test Command Detection
  // ========================================================================

  describe('getTestCommand', () => {
    test('returns npm test for JavaScript', () => {
      expect(getTestCommand('javascript')).toBe('npm test');
    });

    test('returns pytest for Python', () => {
      expect(getTestCommand('python')).toBe('pytest');
    });

    test('returns go test for Go', () => {
      expect(getTestCommand('go')).toBe('go test ./...');
    });

    test('returns null for unknown language', () => {
      expect(getTestCommand('unknown')).toBeNull();
    });
  });

  describe('getCoverageFiles', () => {
    test('returns coverage files for JavaScript', () => {
      const files = getCoverageFiles('javascript');
      expect(files).toContain('coverage/coverage-summary.json');
    });

    test('returns coverage files for Python', () => {
      const files = getCoverageFiles('python');
      expect(files).toContain('coverage.xml');
    });

    test('defaults to JavaScript files for unknown language', () => {
      const files = getCoverageFiles('unknown');
      expect(files).toContain('coverage/coverage-summary.json');
    });
  });

  describe('hasTestScript', () => {
    test('returns true when test script exists', () => {
      const pkg = { scripts: { test: 'jest' } };
      expect(hasTestScript(pkg)).toBe(true);
    });

    test('returns false when no test script', () => {
      const pkg = { scripts: { build: 'webpack' } };
      expect(hasTestScript(pkg)).toBe(false);
    });

    test('returns false for null package.json', () => {
      expect(hasTestScript(null)).toBe(false);
    });
  });

  describe('extractTestCommand', () => {
    test('extracts test command', () => {
      const pkg = { scripts: { test: 'jest --coverage' } };
      expect(extractTestCommand(pkg)).toBe('jest --coverage');
    });

    test('returns null when no test script', () => {
      const pkg = { scripts: {} };
      expect(extractTestCommand(pkg)).toBeNull();
    });
  });

  // ========================================================================
  // PURE FUNCTIONS - Test Output Parsing
  // ========================================================================

  describe('parseJestOutput', () => {
    test('parses successful Jest output', () => {
      const output = 'Tests: 10 passed, 10 total';
      const result = parseJestOutput(output);

      expect(result.total).toBe(10);
      expect(result.passed).toBe(10);
      expect(result.failed).toBe(0);
    });

    test('parses Jest output with failures', () => {
      const output = 'Tests: 8 passed, 2 failed, 10 total';
      const result = parseJestOutput(output);

      expect(result.total).toBe(10);
      expect(result.passed).toBe(8);
      expect(result.failed).toBe(2);
    });

    test('parses Jest output with skipped tests', () => {
      const output = 'Tests: 2 skipped, 8 passed, 10 total';
      const result = parseJestOutput(output);

      expect(result.total).toBe(10);
      expect(result.passed).toBe(8);
      expect(result.skipped).toBe(2);
    });

    test('parses real Jest output with failed, skipped, passed order', () => {
      const output = 'Tests:       3 failed, 19 skipped, 4771 passed, 4793 total';
      const result = parseJestOutput(output);

      expect(result.total).toBe(4793);
      expect(result.passed).toBe(4771);
      expect(result.failed).toBe(3);
      expect(result.skipped).toBe(19);
    });

    test('handles output without test summary', () => {
      const output = 'No tests found';
      const result = parseJestOutput(output);

      expect(result.total).toBe(0);
    });

    test('parses Test Suites line for suite-level failures', () => {
      const output = [
        'Test Suites: 2 failed, 6 passed, 8 total',
        'Tests:       149 passed, 149 total',
      ].join('\n');
      const result = parseJestOutput(output);
      expect(result.suitesFailed).toBe(2);
      expect(result.suitesTotal).toBe(8);
      expect(result.failed).toBe(0);
      expect(result.passed).toBe(149);
    });

    test('suitesFailed defaults to 0 when Test Suites line absent', () => {
      const result = parseJestOutput('Tests: 5 passed, 5 total');
      expect(result.suitesFailed).toBe(0);
      expect(result.suitesTotal).toBe(0);
    });

    test('captures suite failures even when no individual tests ran', () => {
      const output = 'Test Suites: 1 failed, 1 total\nTests: 0 total';
      const result = parseJestOutput(output);
      expect(result.suitesFailed).toBe(1);
      expect(result.total).toBe(0);
    });
  });

  describe('parsePytestOutput', () => {
    test('parses successful pytest output', () => {
      const output = '10 passed in 1.5s';
      const result = parsePytestOutput(output);

      expect(result.passed).toBe(10);
      expect(result.total).toBe(10);
    });

    test('parses pytest output with failures', () => {
      const output = '8 passed, 2 failed in 2.0s';
      const result = parsePytestOutput(output);

      expect(result.passed).toBe(8);
      expect(result.failed).toBe(2);
      expect(result.total).toBe(10);
    });

    test('parses pytest output with skipped tests', () => {
      const output = '8 passed, 2 skipped in 1.0s';
      const result = parsePytestOutput(output);

      expect(result.passed).toBe(8);
      expect(result.skipped).toBe(2);
      expect(result.total).toBe(10);
    });
  });

  describe('parseTestOutput', () => {
    test('uses Jest parser for JavaScript', () => {
      const output = 'Tests: 10 passed, 10 total';
      const result = parseTestOutput(output, 'javascript');

      expect(result.total).toBe(10);
      expect(result.passed).toBe(10);
    });

    test('uses pytest parser for Python', () => {
      const output = '10 passed in 1.5s';
      const result = parseTestOutput(output, 'python');

      expect(result.passed).toBe(10);
    });

    test('returns empty results for unknown language', () => {
      const output = 'Some test output';
      const result = parseTestOutput(output, 'unknown');

      expect(result.total).toBe(0);
    });
  });

  // ========================================================================
  // PURE FUNCTIONS - Coverage Parsing
  // ========================================================================

  describe('parseJestCoverage', () => {
    test('parses Jest coverage summary', () => {
      const coverage = {
        total: {
          statements: { pct: 85 },
          branches: { pct: 80 },
          functions: { pct: 90 },
          lines: { pct: 85 },
        },
      };

      const result = parseJestCoverage(coverage);

      expect(result.statements).toBe(85);
      expect(result.branches).toBe(80);
      expect(result.functions).toBe(90);
      expect(result.lines).toBe(85);
    });

    test('handles missing coverage data', () => {
      const result = parseJestCoverage({});

      expect(result.statements).toBe(0);
      expect(result.branches).toBe(0);
    });

    test('handles null coverage', () => {
      const result = parseJestCoverage(null);

      expect(result.statements).toBe(0);
    });
  });

  describe('determineTestStatus', () => {
    test('returns fail when tests failed', () => {
      expect(determineTestStatus({ passed: 8, failed: 2, skipped: 0 })).toBe('fail');
    });

    test('returns warn when tests skipped', () => {
      expect(determineTestStatus({ passed: 8, failed: 0, skipped: 2 })).toBe('warn');
    });

    test('returns pass when all tests passed', () => {
      expect(determineTestStatus({ passed: 10, failed: 0, skipped: 0 })).toBe('pass');
    });

    test('returns unknown when no tests', () => {
      expect(determineTestStatus({ passed: 0, failed: 0, skipped: 0 })).toBe('unknown');
    });
  });

  // ========================================================================
  // PURE FUNCTIONS - Reporting
  // ========================================================================

  describe('formatTestReport', () => {
    test('formats successful test report', () => {
      const results = {
        success: true,
        language: 'javascript',
        testResults: { total: 10, passed: 10, failed: 0, skipped: 0 },
        coverage: { statements: 85, branches: 80, functions: 90, lines: 85 },
        duration: 1500,
        exitCode: 0,
      };

      const report = formatTestReport(results);

      expect(report).toContain('Test Execution Report');
      expect(report).toContain('✅ Passed');
      expect(report).toContain('**Total Tests**: 10');
      expect(report).toContain('**Statements**: 85%');
      expect(report).toContain('All tests passed');
    });

    test('formats failed test report', () => {
      const results = {
        success: false,
        language: 'python',
        testResults: { total: 10, passed: 8, failed: 2, skipped: 0 },
        coverage: {},
        duration: 2000,
        exitCode: 1,
      };

      const report = formatTestReport(results);

      expect(report).toContain('❌ Failed');
      expect(report).toContain('**Failed**: 2');
      expect(report).toContain('2 test(s) failed');
      expect(report).toContain('Recommendations');
    });

    test('formats report with skipped tests', () => {
      const results = {
        success: true,
        language: 'javascript',
        testResults: { total: 10, passed: 8, failed: 0, skipped: 2 },
        coverage: {},
        duration: 1000,
        exitCode: 0,
      };

      const report = formatTestReport(results);

      expect(report).toContain('**Skipped**: 2');
      expect(report).toContain('2 test(s) skipped');
    });

    test('handles report without test results', () => {
      const results = {
        success: false,
        language: 'javascript',
        testResults: { total: 0 },
        coverage: {},
        duration: 100,
        exitCode: -1,
      };

      const report = formatTestReport(results);

      expect(report).toContain('No test results found');
    });
  });

  // ========================================================================
  // STEP 8 EXECUTOR - Integration Tests
  // ========================================================================

  describe('Step8TestExecutor', () => {
    let executor;
    let mockExecutor;
    let mockFileOps;
    let mockBacklog;
    let mockTechStack;

    beforeEach(() => {
      mockExecutor = {
        execute: async (_cmd, _opts) => ({
          exitCode: 0,
          stdout: 'Tests: 10 passed, 10 total',
          stderr: '',
        }),
      };

      mockFileOps = {
        readFile: async () => JSON.stringify({ scripts: { test: 'jest' } }),
        exists: async () => false,
      };

      mockBacklog = {
        saveStepSummary: async () => {},
      };

      mockTechStack = {
        detectAll: async () => ({ languages: ['javascript'] }),
      };

      executor = new Step8TestExecutor({
        executor: mockExecutor,
        fileOps: mockFileOps,
        backlog: mockBacklog,
        techStack: mockTechStack,
        aiHelper: { initialize: () => Promise.resolve(false) },
      });
    });

    test('uses "npm test" (not raw script value) when package.json has a test script', async () => {
      // Regression test for: step_08 passes raw jest command to executor causing
      // "jest: not found" (exit 127) because node_modules/.bin is not in PATH.
      // determineTestCommand must always return "npm test", not the raw script value.
      let capturedCommand;
      mockExecutor.execute = async (cmd, _opts) => {
        capturedCommand = cmd;
        return { exitCode: 0, stdout: 'Tests: 1 passed, 1 total', stderr: '' };
      };
      mockFileOps.readFile = async () => JSON.stringify({
        scripts: { test: "jest --testPathPattern='test/(core|utils)' --passWithNoTests" },
      });

      await executor.execute('/project');

      expect(capturedCommand).toBe('npm test');
    });

    test('executes tests successfully', async () => {
      const result = await executor.execute('/project');

      expect(result.success).toBe(true);
      expect(result.testResults.passed).toBe(10);
    });

    test('handles test failures', async () => {
      mockExecutor.execute = async () => {
        throw {
          exitCode: 1,
          stdout: 'Tests: 8 passed, 2 failed, 10 total',
          stderr: '',
        };
      };

      const result = await executor.execute('/project');

      expect(result.success).toBe(false);
      expect(result.testResults.failed).toBe(2);
    });

    test('[BUG FIX] treats 0 tests found as success=true (warning, not critical failure)', async () => {
      // jest exits with code 1 when no test files are found — this must not halt the workflow
      mockExecutor.execute = async () => {
        throw {
          exitCode: 1,
          stdout: 'No tests found, exiting with code 1',
          stderr: '',
        };
      };

      const result = await executor.execute('/project');

      expect(result.success).toBe(true);
      expect(result.noTestsFound).toBe(true);
      expect(result.testResults.failed).toBe(0);
      expect(result.testResults.total).toBe(0);
    });

    test('collects coverage metrics', async () => {
      let readCount = 0;
      mockFileOps.readFile = async (_path) => {
        readCount++;
        if (readCount === 1) {
          return JSON.stringify({ scripts: { test: 'jest' } });
        }
        return JSON.stringify({
          total: {
            statements: { pct: 85 },
            branches: { pct: 80 },
            functions: { pct: 90 },
            lines: { pct: 85 },
          },
        });
      };

      mockFileOps.exists = async () => true;

      const result = await executor.execute('/project');

      expect(result.coverage.statements).toBe(85);
    });

    test('handles missing test command', async () => {
      mockFileOps.readFile = async () => JSON.stringify({ scripts: {} });
      mockTechStack.detectAll = async () => ({ languages: ['bash'] });

      const result = await executor.execute('/project');

      expect(result.success).toBe(false);
      expect(result.message).toContain('No test command');
    });

    test('saves report to backlog', async () => {
      let savedTitle = '';
      mockBacklog.saveStepSummary = async (step, title) => {
        savedTitle = title;
      };

      await executor.execute('/project');

      expect(savedTitle).toBe('Test Execution');
    });

    // [BUG FIX 0f99feb] promptsDir must be forwarded so AI exchanges are saved
    test('[BUG FIX] promptsDir option is accepted without error', () => {
      const instance = new Step8TestExecutor({
        executor: mockExecutor,
        fileOps: mockFileOps,
        backlog: mockBacklog,
        techStack: mockTechStack,
        promptsDir: '/tmp/prompts/step_08',
      });
      expect(instance).toBeDefined();
      expect(instance.aiHelper).toBeDefined();
    });
  });
});
