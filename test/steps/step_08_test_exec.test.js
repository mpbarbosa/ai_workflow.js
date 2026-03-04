/**
 * Tests for Step 8: Test Execution
 * @group steps
 */

import { jest } from '@jest/globals';
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
  hasNoTestsFoundMessage,
  formatTestReport,
} from '../../src/steps/step_08_test_exec.js';
import { logger } from '../../src/core/logger.js';

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

    test('parses correctly when ANSI color codes are present (FORCE_COLOR env)', () => {
      // Simulates Jest output when FORCE_COLOR=1: bold/color codes wrap keywords
      const output = [
        '\x1b[1mTest Suites:\x1b[22m \x1b[1m\x1b[31m5 failed\x1b[39m\x1b[22m, \x1b[1m106 passed\x1b[22m, 111 total',
        '\x1b[1mTests:\x1b[22m       \x1b[1m\x1b[31m37 failed\x1b[39m\x1b[22m, \x1b[1m\x1b[33m19 skipped\x1b[39m\x1b[22m, \x1b[1m4981 passed\x1b[22m, 5037 total',
      ].join('\n');
      const result = parseJestOutput(output);
      expect(result.passed).toBe(4981);
      expect(result.failed).toBe(37);
      expect(result.skipped).toBe(19);
      expect(result.total).toBe(5037);
      expect(result.suitesFailed).toBe(5);
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

  describe('hasNoTestsFoundMessage', () => {
    test('detects Jest "No tests found" message', () => {
      expect(hasNoTestsFoundMessage('No tests found, exiting with code 1')).toBe(true);
    });

    test('detects Vitest "No test files found" message', () => {
      expect(hasNoTestsFoundMessage('No test files found, exiting with code 1')).toBe(true);
    });

    test('detects Jest empty-test-file message', () => {
      expect(
        hasNoTestsFoundMessage('Your test suite must contain at least one test.')
      ).toBe(true);
    });

    test('returns false for normal test output', () => {
      expect(hasNoTestsFoundMessage('Tests: 5 passed, 5 total')).toBe(false);
    });

    test('returns false for empty/null output', () => {
      expect(hasNoTestsFoundMessage('')).toBe(false);
      expect(hasNoTestsFoundMessage(null)).toBe(false);
      expect(hasNoTestsFoundMessage(undefined)).toBe(false);
    });

    test('strips ANSI codes before matching', () => {
      expect(hasNoTestsFoundMessage('\x1b[31mNo tests found\x1b[0m')).toBe(true);
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

    test('[BUG FIX] Vitest "No test files found" is treated as success=true (not critical failure)', async () => {
      // Vitest exits with code 1 with a different message than Jest
      mockExecutor.execute = async () => {
        throw {
          exitCode: 1,
          stdout: 'No test files found, exiting with code 1',
          stderr: '',
        };
      };

      const result = await executor.execute('/project');

      expect(result.success).toBe(true);
      expect(result.noTestsFound).toBe(true);
      expect(result.testResults.failed).toBe(0);
    });

    test('[BUG FIX] Jest empty test file message is treated as success=true (not critical failure)', async () => {
      // Jest exits with code 1 when a test file exists but has no test cases
      mockExecutor.execute = async () => {
        throw {
          exitCode: 1,
          stdout: 'Your test suite must contain at least one test.',
          stderr: '',
        };
      };

      const result = await executor.execute('/project');

      expect(result.success).toBe(true);
      expect(result.noTestsFound).toBe(true);
      expect(result.testResults.failed).toBe(0);
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

  // ========================================================================
  // FIX: runTests safe output capture
  // ========================================================================

  describe('[FIX] runTests — safe output capture', () => {
    // Shared minimal deps used by every test in this group
    const makeExecutor = (mockRun) =>
      new Step8TestExecutor({
        executor: { execute: mockRun },
        fileOps: {
          readFile: async () => JSON.stringify({ scripts: { test: 'jest' } }),
          exists: async () => false,
        },
        backlog: { saveStepSummary: async () => {} },
        techStack: { detectAll: async () => ({ languages: ['javascript'] }) },
        aiHelper: { initialize: () => Promise.resolve(false) },
      });

    test('concatenates stdout + stderr when executor resolves', async () => {
      const exec = makeExecutor(async () => ({
        exitCode: 0,
        stdout: 'Tests: 5 passed, 5 total',
        stderr: 'some warning on stderr',
      }));
      const result = await exec.execute('/project');
      // Output contains both streams — Jest line was parsed
      expect(result.testResults.passed).toBe(5);
      expect(result.success).toBe(true);
    });

    test('does not crash when executor resolves with undefined stdout/stderr', async () => {
      // Guards the (result.stdout || '') + (result.stderr || '') fix on success path
      const exec = makeExecutor(async () => ({
        exitCode: 0,
        stdout: undefined,
        stderr: undefined,
      }));
      // Should not throw — result is "0 tests found" which is success=true
      await expect(exec.execute('/project')).resolves.toBeDefined();
    });

    test('concatenates error.stdout + error.stderr when executor throws', async () => {
      const exec = makeExecutor(async () => {
        throw { exitCode: 1, stdout: 'Tests: 2 passed, 1 failed, 3 total', stderr: '' };
      });
      const result = await exec.execute('/project');
      expect(result.testResults.failed).toBe(1);
      expect(result.testResults.passed).toBe(2);
    });

    test('does not crash when error object has undefined stdout/stderr', async () => {
      const exec = makeExecutor(async () => {
        throw { exitCode: 1, stdout: undefined, stderr: undefined };
      });
      await expect(exec.execute('/project')).resolves.toBeDefined();
    });
  });

  // ========================================================================
  // FIX: runner crash → accurate warning (not "0 test(s) failed")
  // ========================================================================

  describe('[FIX] runner crash → informative warning message', () => {
    let warnSpy;
    let debugSpy;
    let mockExecutor;
    let mockFileOps;

    const makeExecutor = () =>
      new Step8TestExecutor({
        executor: mockExecutor,
        fileOps: mockFileOps,
        backlog: { saveStepSummary: async () => {} },
        techStack: { detectAll: async () => ({ languages: ['typescript'] }) },
        aiHelper: { initialize: () => Promise.resolve(false) },
      });

    beforeEach(() => {
      warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});
      debugSpy = jest.spyOn(logger, 'debug').mockImplementation(() => {});

      mockExecutor = { execute: null };
      mockFileOps = {
        readFile: async () => JSON.stringify({ scripts: { test: 'jest' } }),
        exists: async () => false,
      };
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('warns with exit code when runner crashes and 0 tests were parsed', async () => {
      // Simulates: TypeScript compile error before tests run — non-zero exit,
      // no Jest summary in output, not a "no tests found" message.
      mockExecutor.execute = async () => {
        throw {
          exitCode: 1,
          stdout: "error TS2345: Argument of type 'string' is not assignable",
          stderr: '',
        };
      };

      const result = await makeExecutor().execute('/project');

      expect(result.success).toBe(false);
      expect(result.testResults.failed).toBe(0); // no individual tests failed
      expect(result.exitCode).toBe(1);

      // Warning must mention the exit code, NOT "0 test(s) failed"
      const warnCalls = warnSpy.mock.calls.map((c) => c[0]);
      const relevantWarn = warnCalls.find((m) => m.includes('Step 8'));
      expect(relevantWarn).toBeDefined();
      expect(relevantWarn).toContain('code 1');
      expect(relevantWarn).not.toBe('Step 8 completed - 0 test(s) failed');
    });

    test('warns with test count when individual tests failed', async () => {
      mockExecutor.execute = async () => {
        throw {
          exitCode: 1,
          stdout: 'Tests: 8 passed, 3 failed, 11 total',
          stderr: '',
        };
      };

      await makeExecutor().execute('/project');

      const warnCalls = warnSpy.mock.calls.map((c) => c[0]);
      const relevantWarn = warnCalls.find((m) => m.includes('Step 8'));
      expect(relevantWarn).toContain('3 test(s) failed');
      expect(relevantWarn).not.toContain('code');
    });

    test('warns with suite count when suites failed to run', async () => {
      mockExecutor.execute = async () => {
        throw {
          exitCode: 1,
          stdout: 'Test Suites: 2 failed, 5 passed, 7 total\nTests: 0 total',
          stderr: '',
        };
      };

      await makeExecutor().execute('/project');

      const warnCalls = warnSpy.mock.calls.map((c) => c[0]);
      const relevantWarn = warnCalls.find((m) => m.includes('Step 8'));
      expect(relevantWarn).toContain('suite(s) failed');
    });

    test('does NOT warn "0 test(s) failed" in any crash scenario', async () => {
      // Exhaustive check: the old buggy message must never appear
      mockExecutor.execute = async () => {
        throw { exitCode: 2, stdout: 'spawn ENOENT', stderr: '' };
      };

      await makeExecutor().execute('/project');

      const warnCalls = warnSpy.mock.calls.map((c) => c[0]);
      const buggyMessage = warnCalls.find((m) => m === 'Step 8 completed - 0 test(s) failed');
      expect(buggyMessage).toBeUndefined();
    });
  });

  // ========================================================================
  // FIX: debug logging emitted during execute
  // ========================================================================

  describe('[FIX] debug logging during execute', () => {
    let debugSpy;
    let mockExecutor;
    let mockFileOps;

    const makeExecutor = () =>
      new Step8TestExecutor({
        executor: mockExecutor,
        fileOps: mockFileOps,
        backlog: { saveStepSummary: async () => {} },
        techStack: { detectAll: async () => ({ languages: ['typescript'] }) },
        aiHelper: { initialize: () => Promise.resolve(false) },
      });

    beforeEach(() => {
      debugSpy = jest.spyOn(logger, 'debug').mockImplementation(() => {});
      jest.spyOn(logger, 'warn').mockImplementation(() => {});

      mockExecutor = { execute: null };
      mockFileOps = {
        readFile: async () => JSON.stringify({ scripts: { test: 'jest' } }),
        exists: async () => false,
      };
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('logs exit code and output snippet after successful run', async () => {
      mockExecutor.execute = async () => ({
        exitCode: 0,
        stdout: 'Tests: 5 passed, 5 total',
        stderr: '',
      });

      await makeExecutor().execute('/project');

      const debugMessages = debugSpy.mock.calls.map((c) => c[0]);
      const exitLog = debugMessages.find((m) => m.includes('[step_08]') && m.includes('exited 0'));
      expect(exitLog).toBeDefined();
      const snippetLog = debugMessages.find(
        (m) => m.includes('[step_08]') && m.includes('Output snippet')
      );
      expect(snippetLog).toBeDefined();
    });

    test('logs exit code and output snippet after failed run', async () => {
      mockExecutor.execute = async () => {
        throw { exitCode: 1, stdout: 'SyntaxError: Unexpected token', stderr: '' };
      };

      await makeExecutor().execute('/project');

      const debugMessages = debugSpy.mock.calls.map((c) => c[0]);
      const exitLog = debugMessages.find((m) => m.includes('[step_08]') && m.includes('exited 1'));
      expect(exitLog).toBeDefined();
    });

    test('logs parsed result counts (passed/failed/skipped/suitesFailed)', async () => {
      mockExecutor.execute = async () => ({
        exitCode: 0,
        stdout: 'Tests: 7 passed, 7 total',
        stderr: '',
      });

      await makeExecutor().execute('/project');

      const debugMessages = debugSpy.mock.calls.map((c) => c[0]);
      const parsedLog = debugMessages.find(
        (m) => m.includes('[step_08]') && m.includes('Parsed results')
      );
      expect(parsedLog).toBeDefined();
      expect(parsedLog).toContain('passed: 7');
      expect(parsedLog).toContain('failed: 0');
    });

    test('logs decision variables (noTestsFound, anyFailure, success, exitCode)', async () => {
      mockExecutor.execute = async () => ({
        exitCode: 0,
        stdout: 'Tests: 3 passed, 3 total',
        stderr: '',
      });

      await makeExecutor().execute('/project');

      const debugMessages = debugSpy.mock.calls.map((c) => c[0]);
      const decisionsLog = debugMessages.find(
        (m) => m.includes('[step_08]') && m.includes('noTestsFound')
      );
      expect(decisionsLog).toBeDefined();
      expect(decisionsLog).toContain('anyFailure');
      expect(decisionsLog).toContain('success');
      expect(decisionsLog).toContain('exitCode');
    });

    test('output snippet log replaces newlines with ↵ for readability', async () => {
      mockExecutor.execute = async () => ({
        exitCode: 0,
        stdout: 'line1\nline2\nTests: 1 passed, 1 total',
        stderr: '',
      });

      await makeExecutor().execute('/project');

      const debugMessages = debugSpy.mock.calls.map((c) => c[0]);
      const snippetLog = debugMessages.find(
        (m) => m.includes('[step_08]') && m.includes('Output snippet')
      );
      expect(snippetLog).toBeDefined();
      expect(snippetLog).toContain('↵');
      expect(snippetLog).not.toContain('\n');
    });
  });
});
