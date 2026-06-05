/**
 * Tests for Step 8: Test Execution
 * @group steps
 */

import { jest } from '@jest/globals';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  Step8TestExecutor,
  buildCiRetryCmd,
  describeCoveragePromptContext,
  detectCiConfigPaths,
  detectTestConfigPaths,
  detectTestTypes,
  formatPromptCoverageThreshold,
  formatPromptResultsSummary,
  getTestCommand,
  getCoverageFiles,
  hasTestScript,
  extractTestCommand,
  isValidationScriptExecution,
  parseJestOutput,
  parsePytestOutput,
  parseTestOutput,
  parseJestCoverage,
  determineTestStatus,
  hasNoTestsFoundMessage,
  getTestExecutionSkipDecision,
  getMissingTestCommandDecision,
  formatTestReport,
} from '../../src/steps/step_08_test_exec.js';
import { AI_HELPERS_PATH } from '../../src/lib/ai_prompt_builder.js';
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

  describe('detectTestConfigPaths', () => {
    test('includes integration-specific Jest config files when present', async () => {
      const projectRoot = mkdtempSync(path.join(tmpdir(), 'step8-config-'));

      try {
        writeFileSync(path.join(projectRoot, 'jest.config.json'), '{}');
        writeFileSync(path.join(projectRoot, 'jest.integration.config.json'), '{}');

        await expect(detectTestConfigPaths(projectRoot)).resolves.toBe(
          'jest.config.json, jest.integration.config.json'
        );
      } finally {
        rmSync(projectRoot, { recursive: true, force: true });
      }
    });
  });

  describe('detectTestTypes', () => {
    test('detects integration and e2e directories asynchronously', async () => {
      const projectRoot = mkdtempSync(path.join(tmpdir(), 'step8-types-'));

      try {
        writeFileSync(path.join(projectRoot, 'jest.config.json'), '{}');
        writeFileSync(path.join(projectRoot, 'playwright.config.js'), '{}');
        const testDir = path.join(projectRoot, 'test');
        mkdirSync(path.join(testDir, 'integration'), { recursive: true });
        mkdirSync(path.join(testDir, 'end-to-end'), { recursive: true });

        await expect(detectTestTypes(projectRoot)).resolves.toBe('unit, e2e, integration');
      } finally {
        rmSync(projectRoot, { recursive: true, force: true });
      }
    });
  });

  describe('validation-script prompt helpers', () => {
    test('classifies custom npm validation commands without test configs as validation scripts', () => {
      expect(
        isValidationScriptExecution({
          testCommand: 'npm test',
          testFramework: 'custom',
          testConfigPaths: 'none found',
          testTypes: 'unit',
        })
      ).toBe(true);
    });

    test('does not classify real Jest runs as validation scripts', () => {
      expect(
        isValidationScriptExecution({
          testCommand: 'npm test',
          testFramework: 'jest',
          testConfigPaths: 'jest.config.js',
          testTypes: 'unit',
        })
      ).toBe(false);
    });

    test('formats validation-script result summaries as unavailable when no test counts exist', () => {
      expect(
        formatPromptResultsSummary({
          isValidationScript: true,
          testResults: { total: 0, passed: 0, failed: 0, skipped: 0 },
        })
      ).toBe('unavailable — validation-script run did not report test-case counts');
    });

    test('formats missing project coverage thresholds as unavailable', () => {
      expect(formatPromptCoverageThreshold(null)).toBe(
        'unavailable — no explicit project threshold configured'
      );
    });
  });

  describe('detectCiConfigPaths', () => {
    test('returns workflow files discovered asynchronously', async () => {
      const projectRoot = mkdtempSync(path.join(tmpdir(), 'step8-workflows-'));

      try {
        const workflowsDir = path.join(projectRoot, '.github', 'workflows');
        mkdirSync(workflowsDir, { recursive: true });
        writeFileSync(path.join(workflowsDir, 'ci.yml'), 'name: CI');
        writeFileSync(path.join(workflowsDir, 'release.yaml'), 'name: Release');
        writeFileSync(path.join(workflowsDir, 'notes.txt'), 'ignore me');

        const result = await detectCiConfigPaths(projectRoot);
        expect(result.split(', ').sort()).toEqual(['ci.yml', 'release.yaml']);
      } finally {
        rmSync(projectRoot, { recursive: true, force: true });
      }
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

    test('parses Vitest summaries', () => {
      const output = ['Test Files  1 passed (1)', 'Tests  3 passed (3)'].join('\n');
      const result = parseJestOutput(output);

      expect(result.passed).toBe(3);
      expect(result.total).toBe(3);
      expect(result.suitesFailed).toBe(0);
      expect(result.suitesTotal).toBe(1);
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

  describe('describeCoveragePromptContext', () => {
    test('marks coverage unavailable when no tests ran', () => {
      expect(
        describeCoveragePromptContext({
          noTestsFound: true,
          coverageThreshold: 80,
        })
      ).toBe('unavailable — no tests ran, so coverage could not be measured');
    });

    test('marks coverage unavailable when no artifact exists', () => {
      expect(
        describeCoveragePromptContext({
          coverage: {},
          coverageJson: null,
          coverageThreshold: 80,
        })
      ).toBe('unavailable — no coverage artifact was found for this run');
    });

    test('marks aggregate coverage below threshold as inconclusive without file gaps', () => {
      expect(
        describeCoveragePromptContext({
          coverage: { statements: 75, branches: 82, functions: 91, lines: 88 },
          coverageJson: { total: { statements: { pct: 75 } } },
          coverageGaps: [],
          coverageThreshold: 80,
        })
      ).toBe(
        'inconclusive — aggregate coverage is below 80% (statements=75%), but no per-file gaps were provided'
      );
    });

    test('reports threshold success only when measured coverage supports it', () => {
      expect(
        describeCoveragePromptContext({
          coverage: { statements: 85, branches: 82, functions: 91, lines: 88 },
          coverageJson: { total: { statements: { pct: 85 } } },
          coverageGaps: [],
          coverageThreshold: 80,
        })
      ).toBe('none — measured coverage meets or exceeds the 80% threshold');
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
      expect(hasNoTestsFoundMessage('Your test suite must contain at least one test.')).toBe(true);
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

  describe('getTestExecutionSkipDecision', () => {
    test('skips when step 08 is disabled in workflow config', () => {
      expect(
        getTestExecutionSkipDecision({
          workflow: {
            steps: [{ id: '08', enabled: false, reason: 'No test suite' }],
          },
        })
      ).toEqual({
        skip: true,
        reason: 'No test suite',
      });
    });

    test('skips when workflow config explicitly declares no tests', () => {
      expect(
        getTestExecutionSkipDecision({
          tech_stack: { test_framework: 'none', test_command: '' },
        })
      ).toEqual({
        skip: true,
        reason: 'Test framework is set to "none" in .workflow-config.yaml',
      });
    });
  });

  describe('getMissingTestCommandDecision', () => {
    test('skips missing test commands for docs_only markdown workflows', () => {
      expect(
        getMissingTestCommandDecision({
          language: 'markdown',
          scope: 'docs_only',
        })
      ).toEqual({
        skip: true,
        reason: 'Test execution is not applicable to documentation-only Markdown projects',
      });
    });

    test('keeps missing test command as failure outside docs-only markdown workflows', () => {
      expect(
        getMissingTestCommandDecision({
          language: 'bash',
          scope: 'full_validation',
        })
      ).toEqual({
        skip: false,
        reason: 'No test command configured',
      });
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
        detectTechStack: async () => ({ primaryLanguage: 'javascript', languages: ['javascript'] }),
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
      mockFileOps.readFile = async () =>
        JSON.stringify({
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

    test('[BUG FIX] accepts callable executor dependencies from the orchestrator', async () => {
      const callableExecutor = jest.fn(async () => ({
        exitCode: 0,
        stdout: 'Tests: 4 passed, 4 total',
        stderr: '',
      }));
      const callableStepExecutor = new Step8TestExecutor({
        executor: callableExecutor,
        fileOps: mockFileOps,
        backlog: mockBacklog,
        techStack: mockTechStack,
        aiHelper: { initialize: () => Promise.resolve(false) },
      });

      const result = await callableStepExecutor.execute('/project');

      expect(callableExecutor).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.testResults.passed).toBe(4);
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

    test('does not log silent-exit preflight correlation notes for parsed test failures', async () => {
      const loggerInfoSpy = jest.spyOn(logger, 'info').mockImplementation(() => {});
      mockExecutor.execute = async () => ({
        exitCode: 0,
        stdout: 'Test Suites: 1 failed, 3 passed, 4 total\nTests: 8 passed, 2 failed, 10 total',
        stderr: '',
      });

      const result = await executor.execute('/project', {
        preflightCheck: {
          commands: [{ name: 'test', command: 'npm test', passed: true }],
        },
      });

      expect(result.success).toBe(false);
      expect(loggerInfoSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('silent exit here points')
      );
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

    test('[BUG FIX] runner crash with no output and suitesFailed=undefined is treated as a blocking failure', async () => {
      // Reproduces the exact scenario from workflow log:
      //   - exit code 1, 0 bytes output (runnerCrashed: true)
      //   - parseTestOutput returns suitesFailed: undefined (non-Jest parser)
      // This must not be collapsed into "no tests found", because the captured evidence
      // is inconclusive rather than explicitly test-free.
      mockExecutor.execute = async () => {
        throw { exitCode: 1, stdout: '', stderr: '' };
      };

      const result = await executor.execute('/project');

      expect(result.success).toBe(false);
      expect(result.noTestsFound).toBe(false);
      expect(result.exitCode).toBe(1);
    });

    test('[BUG FIX] Vitest pass output is not collapsed into "no tests found"', async () => {
      mockExecutor.execute = async () => ({
        stdout: ['Test Files  1 passed (1)', 'Tests  3 passed (3)'].join('\n'),
        stderr: '',
        exitCode: 0,
      });

      const result = await executor.execute('/project');

      expect(result.success).toBe(true);
      expect(result.noTestsFound).toBe(false);
      expect(result.testResults.total).toBe(3);
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
      mockTechStack.detectTechStack = async () => ({
        primaryLanguage: 'bash',
        languages: ['bash'],
      });

      const result = await executor.execute('/project');

      expect(result.success).toBe(false);
      expect(result.message).toContain('No test command');
    });

    test('skips missing test command for docs_only markdown repositories', async () => {
      mockFileOps.readFile = async () => JSON.stringify({ scripts: {} });
      mockTechStack.detectTechStack = async () => ({
        primaryLanguage: 'markdown',
        languages: ['markdown'],
      });

      const result = await executor.execute('/project', { scope: 'docs_only' });

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('tests_not_applicable');
      expect(result.message).toContain('not applicable');
    });

    test('skips test execution when workflow config disables step 08', async () => {
      mockFileOps.readFile = async (targetPath) => {
        if (targetPath === '/project/.workflow-config.yaml') {
          return [
            'tech_stack:',
            '  primary_language: markdown',
            '  test_framework: none',
            '  test_command: ""',
            'workflow:',
            '  steps:',
            '    - id: "08"',
            '      enabled: false',
            '      reason: "No test suite"',
          ].join('\n');
        }
        if (targetPath === '/project/package.json') {
          throw new Error('package.json should not be read when step 08 is disabled');
        }
        throw new Error(`Unexpected path: ${targetPath}`);
      };
      mockTechStack.detectTechStack = async () => ({
        primaryLanguage: 'markdown',
        languages: ['markdown'],
      });

      const result = await executor.execute('/project');

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.message).toContain('No test suite');
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

    test('[BUG FIX] AI prompt marks coverage unavailable instead of claiming threshold success when no tests ran', async () => {
      let capturedPrompt = '';
      mockExecutor.execute = async () => {
        throw {
          exitCode: 1,
          stdout: 'No tests found, exiting with code 1',
          stderr: '',
        };
      };
      mockFileOps.readFile = async (targetPath) => {
        if (targetPath === '/project/package.json') {
          return JSON.stringify({ scripts: { test: 'jest' } });
        }
        if (targetPath === AI_HELPERS_PATH) {
          return readFileSync(AI_HELPERS_PATH, 'utf8');
        }
        throw new Error(`Unexpected readFile path: ${targetPath}`);
      };

      const aiHelper = {
        initialize: () => Promise.resolve(true),
        executeRequest: () => Promise.resolve({ content: 'ok' }),
      };
      const aiCache = {
        init: () => Promise.resolve(),
        withCache: async (prompt) => {
          capturedPrompt = prompt;
          return { content: 'ok' };
        },
      };

      executor = new Step8TestExecutor({
        executor: mockExecutor,
        fileOps: mockFileOps,
        backlog: mockBacklog,
        techStack: mockTechStack,
        aiHelper,
        aiCache,
      });

      await executor.execute('/project');

      expect(capturedPrompt).toContain(
        'Coverage Gaps: unavailable — no tests ran, so coverage could not be measured'
      );
      expect(capturedPrompt).toContain(
        'mark the result as unavailable or inconclusive instead of guessing a specific misconfiguration'
      );
      expect(capturedPrompt).toContain(
        'Do not prescribe `testMatch`, `testRegex`, missing-test-file, or file-naming fixes as confirmed remediation'
      );
      expect(capturedPrompt).toContain(
        'do not cite unseen keys such as `testMatch`, `testRegex`, or `roots`'
      );
      expect(capturedPrompt).toContain(
        'do not cite unseen directories or patterns such as `test/`, `src/**/__tests__`, or file-naming conventions as evidence'
      );
      expect(capturedPrompt).toContain('keep follow-up actions limited to neutral diagnostics');
      expect(capturedPrompt).toContain(
        'If the runner produced no output, or the prompt only names config/workflow files without'
      );
      expect(capturedPrompt).toContain(
        'do not assert a specific root cause or workflow gap unless the'
      );
      expect(capturedPrompt).toContain(
        'When workflow filenames are listed without YAML contents, keep repository-specific CI guidance'
      );
      expect(capturedPrompt).toContain(
        'explicitly conditional and avoid stating that a step is missing, present, or misconfigured.'
      );
      expect(capturedPrompt).toContain('do not mention unseen config keys such');
      expect(capturedPrompt).toContain(
        'In an inconclusive run, keep next steps diagnostic and evidence-preserving rather than phrasing'
      );
      expect(capturedPrompt).toContain(
        'Do not describe an inconclusive or silent run as a confirmed broken, non-functional, or misconfigured test setup'
      );
      expect(capturedPrompt).toContain(
        'reserve `Critical` for explicitly confirmed blocking failures'
      );
      expect(capturedPrompt).toContain(
        'use neutral forward-looking wording such as "consider adding a basic CI workflow" rather than repository-history claims such as "restore CI"'
      );
      expect(capturedPrompt).toContain(
        'Specific code fixes or test modifications needed when the evidence supports them; otherwise diagnostic next steps'
      );
    });

    test('skips AI analysis when silent runner exits leave no runtime evidence', async () => {
      mockExecutor.execute = async () => {
        throw {
          exitCode: 137,
          stdout: '',
          stderr: '',
        };
      };
      mockFileOps.readFile = async (targetPath) => {
        if (targetPath === '/project/package.json') {
          return JSON.stringify({ scripts: { test: 'jest' } });
        }
        if (targetPath === AI_HELPERS_PATH) {
          return readFileSync(AI_HELPERS_PATH, 'utf8');
        }
        throw new Error(`Unexpected readFile path: ${targetPath}`);
      };

      executor = new Step8TestExecutor({
        executor: mockExecutor,
        fileOps: mockFileOps,
        backlog: mockBacklog,
        techStack: mockTechStack,
        aiHelper: {
          initialize: jest.fn(() => Promise.resolve(true)),
          executeRequest: jest.fn(() => Promise.resolve({ content: 'ok' })),
        },
        aiCache: {
          init: jest.fn(() => Promise.resolve()),
          withCache: jest.fn(async () => ({ content: 'ok' })),
        },
      });

      await executor.execute('/project');

      expect(executor.aiHelper.initialize).not.toHaveBeenCalled();
      expect(executor.aiHelper.executeRequest).not.toHaveBeenCalled();
      expect(executor.aiCache.init).not.toHaveBeenCalled();
      expect(executor.aiCache.withCache).not.toHaveBeenCalled();
    });

    test('does not collect stale coverage when silent runner exits leave no runtime evidence', async () => {
      mockExecutor.execute = async () => {
        throw {
          exitCode: 137,
          stdout: '',
          stderr: '',
        };
      };
      const coverageSpy = jest.spyOn(executor, 'collectCoverage');

      const result = await executor.execute('/project');

      expect(result.success).toBe(false);
      expect(result.coverage).toEqual({});
      expect(coverageSpy).not.toHaveBeenCalled();
    });

    test('persists enriched AI recommendations without changing the base step result', async () => {
      const savedSummaries = [];
      mockBacklog.saveStepSummary = jest.fn(async (_step, _title, summary) => {
        savedSummaries.push(summary);
      });
      mockFileOps.readFile = async (targetPath) => {
        if (targetPath === '/project/package.json') {
          return JSON.stringify({ scripts: { test: 'jest' } });
        }
        if (targetPath === AI_HELPERS_PATH) {
          return readFileSync(AI_HELPERS_PATH, 'utf8');
        }
        throw new Error(`Unexpected readFile path: ${targetPath}`);
      };

      executor = new Step8TestExecutor({
        executor: mockExecutor,
        fileOps: mockFileOps,
        backlog: mockBacklog,
        techStack: mockTechStack,
        aiHelper: {
          initialize: jest.fn(() => Promise.resolve(true)),
          executeRequest: jest.fn(() => Promise.resolve({ content: 'AI says hi' })),
        },
        aiCache: {
          init: jest.fn(() => Promise.resolve()),
          withCache: jest.fn(async (_prompt, _cacheKey, runner) => runner()),
        },
      });

      const result = await executor.execute('/project');

      expect(result.success).toBe(true);
      expect(savedSummaries).toHaveLength(2);
      expect(executor.aiHelper.executeRequest).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          persona: 'test_engineer',
          responseType: 'test_review',
          validationContext: expect.any(Object),
        })
      );
      expect(savedSummaries.at(-1)).toContain('## AI Recommendations\n\nAI says hi');
      expect(savedSummaries.at(-1)).not.toContain('## E2E Test Engineering Analysis');
    });

    test('replaces unsupported AI clean-bill summaries with a validation notice', async () => {
      const savedSummaries = [];
      mockBacklog.saveStepSummary = jest.fn(async (_step, _title, summary) => {
        savedSummaries.push(summary);
      });
      mockFileOps.readFile = async (targetPath) => {
        if (targetPath === '/project/package.json') {
          return JSON.stringify({ scripts: { test: 'jest' } });
        }
        if (targetPath === AI_HELPERS_PATH) {
          return readFileSync(AI_HELPERS_PATH, 'utf8');
        }
        throw new Error(`Unexpected readFile path: ${targetPath}`);
      };

      executor = new Step8TestExecutor({
        executor: mockExecutor,
        fileOps: mockFileOps,
        backlog: mockBacklog,
        techStack: mockTechStack,
        aiHelper: {
          initialize: jest.fn(() => Promise.resolve(true)),
          executeRequest: jest.fn(() =>
            Promise.resolve({
              content: 'Coverage meets the stated threshold.',
              validation: {
                warnings: [
                  'Unsupported positive summary for test review: "Coverage meets the stated threshold" should be cited or marked inconclusive',
                ],
              },
            })
          ),
        },
        aiCache: {
          init: jest.fn(() => Promise.resolve()),
          withCache: jest.fn(async (_prompt, _cacheKey, runner) => runner()),
        },
      });

      const result = await executor.execute('/project');

      expect(result.success).toBe(true);
      expect(savedSummaries.at(-1)).toContain(
        'AI test analysis was rejected by validation because it made unsupported success claims without enough cited evidence.'
      );
      expect(savedSummaries.at(-1)).toContain(
        'Unsupported positive summary for test review: "Coverage meets the stated threshold" should be cited or marked inconclusive'
      );
    });

    test('skips AI analysis for silent custom npm validation commands with no runtime evidence', async () => {
      mockExecutor.execute = async () => {
        throw {
          exitCode: 1,
          stdout: '',
          stderr: '',
        };
      };
      mockFileOps.readFile = async (targetPath) => {
        if (targetPath === '/project/package.json') {
          return JSON.stringify({ scripts: { test: 'npm run typecheck' } });
        }
        if (targetPath === '/project/.workflow-config.yaml') {
          return [
            'project:',
            '  kind: static_website',
            'tech_stack:',
            '  primary_language: typescript',
            '  test_framework: custom',
            '  test_command: npm test',
          ].join('\n');
        }
        if (targetPath === AI_HELPERS_PATH) {
          return readFileSync(AI_HELPERS_PATH, 'utf8');
        }
        throw new Error(`Unexpected readFile path: ${targetPath}`);
      };

      executor = new Step8TestExecutor({
        executor: mockExecutor,
        fileOps: mockFileOps,
        backlog: mockBacklog,
        techStack: {
          detectTechStack: async () => ({
            primaryLanguage: 'typescript',
            languages: ['typescript'],
          }),
        },
        aiHelper: {
          initialize: jest.fn(() => Promise.resolve(true)),
          executeRequest: jest.fn(() => Promise.resolve({ content: 'ok' })),
        },
        aiCache: {
          init: jest.fn(() => Promise.resolve()),
          withCache: jest.fn(async () => ({ content: 'ok' })),
        },
      });

      await executor.execute('/project', { projectKind: 'nodejs_automation' });

      expect(executor.aiHelper.initialize).not.toHaveBeenCalled();
      expect(executor.aiHelper.executeRequest).not.toHaveBeenCalled();
      expect(executor.aiCache.init).not.toHaveBeenCalled();
      expect(executor.aiCache.withCache).not.toHaveBeenCalled();
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
        techStack: {
          detectTechStack: async () => ({
            primaryLanguage: 'javascript',
            languages: ['javascript'],
          }),
        },
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
    let mockExecutor;
    let mockFileOps;

    const makeExecutor = () =>
      new Step8TestExecutor({
        executor: mockExecutor,
        fileOps: mockFileOps,
        backlog: { saveStepSummary: async () => {} },
        techStack: {
          detectTechStack: async () => ({
            primaryLanguage: 'typescript',
            languages: ['typescript'],
          }),
        },
        aiHelper: { initialize: () => Promise.resolve(false) },
      });

    beforeEach(() => {
      warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});
      jest.spyOn(logger, 'debug').mockImplementation(() => {});

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

    test('surfaces execution setup errors instead of calling them silent runner crashes', async () => {
      mockExecutor.execute = async () => {
        throw new TypeError('this.executor.execute is not a function');
      };

      const result = await makeExecutor().execute('/project');

      expect(result.success).toBe(false);
      const warnCalls = warnSpy.mock.calls.map((c) => c[0]);
      const relevantWarn = warnCalls.find((m) => m.includes('Step 8 blocked'));
      expect(relevantWarn).toContain('this.executor.execute is not a function');
      expect(relevantWarn).not.toContain('produced no output on either attempt');
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
        techStack: {
          detectTechStack: async () => ({
            primaryLanguage: 'typescript',
            languages: ['typescript'],
          }),
        },
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

  // ========================================================================
  // buildCiRetryCmd — retry command construction
  // ========================================================================

  describe('buildCiRetryCmd', () => {
    test('appends --ci directly for jest invocations', () => {
      expect(buildCiRetryCmd('jest')).toBe('jest --ci');
      expect(buildCiRetryCmd('jest --testPathPattern=foo')).toBe('jest --testPathPattern=foo --ci');
      expect(buildCiRetryCmd('npx jest')).toBe('npx jest --ci');
    });

    test('appends --ci directly for vitest invocations', () => {
      expect(buildCiRetryCmd('vitest run')).toBe('vitest run --ci');
    });

    test('appends --ci directly for mocha invocations', () => {
      expect(buildCiRetryCmd('mocha --recursive')).toBe('mocha --recursive --ci');
    });

    test('appends -- --ci for npm test invocations', () => {
      expect(buildCiRetryCmd('npm test')).toBe('npm test -- --ci');
    });

    test('appends -- --ci for npm run test invocations', () => {
      expect(buildCiRetryCmd('npm run test')).toBe('npm run test -- --ci');
    });

    test('appends -- --ci for yarn test invocations', () => {
      expect(buildCiRetryCmd('yarn test')).toBe('yarn test -- --ci');
    });

    test('appends -- --ci for pnpm test invocations', () => {
      expect(buildCiRetryCmd('pnpm test')).toBe('pnpm test -- --ci');
    });

    test('returns command unchanged for unknown runners', () => {
      expect(buildCiRetryCmd('python -m pytest')).toBe('python -m pytest');
      expect(buildCiRetryCmd('go test ./...')).toBe('go test ./...');
      expect(buildCiRetryCmd('cargo test')).toBe('cargo test');
    });

    test('is a pure function — does not mutate input', () => {
      const cmd = 'npm test';
      buildCiRetryCmd(cmd);
      expect(cmd).toBe('npm test');
    });
  });
});
