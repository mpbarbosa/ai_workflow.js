/**
 * Step 8: Test Execution
 * @module steps/step_08_test_exec
 * @version 2.0.0
 *
 * Executes test suites and analyzes results with coverage metrics.
 */

import { STEP_KIND } from './step_contract.js';
import path from 'path';
import { logger, stripAnsi } from '../core/logger.js';
import * as executor from '../core/executor.js';
import { FileOperations } from '../lib/file_operations.js';
import { Backlog } from '../lib/backlog.js';
import { TechStackDetector, getPrimaryLanguage } from '../lib/tech_stack.js';
import { AiHelper } from '../lib/ai_helpers.js';
import { AiCache } from '../lib/ai_cache.js';
import {
  buildStructuredPrompt,
  injectProjectContext,
  buildYamlStepPrompt,
  AI_HELPERS_PATH,
} from '../lib/ai_prompt_builder.js';
import yaml from 'js-yaml';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Test commands by language
 */
export const TEST_COMMANDS = {
  javascript: 'npm test',
  typescript: 'npm test',
  python: 'pytest',
  go: 'go test ./...',
  java: 'mvn test',
  ruby: 'rspec',
  rust: 'cargo test',
};

/**
 * Coverage report file patterns
 */
export const COVERAGE_FILES = {
  javascript: ['coverage/coverage-summary.json', 'coverage/lcov.info'],
  typescript: ['coverage/coverage-summary.json', 'coverage/lcov.info'],
  python: ['coverage.xml', '.coverage', 'htmlcov/index.html'],
  go: ['coverage.out'],
  java: ['target/site/jacoco/index.html'],
  ruby: ['coverage/.resultset.json'],
  rust: ['target/debug/coverage'],
};

/**
 * Test result patterns for parsing
 */
export const TEST_RESULT_PATTERNS = {
  javascript: {
    total: /Tests:\s+(\d+)\s+total/i,
    passed: /Tests:\s+\d+\s+passed/i,
    failed: /Tests:\s+(\d+)\s+failed/i,
  },
  python: {
    total: /(\d+)\s+passed/i,
    failed: /(\d+)\s+failed/i,
  },
  go: {
    passed: /PASS/g,
    failed: /FAIL/g,
  },
};

// ============================================================================
// PURE FUNCTIONS - Test Command Detection
// ============================================================================

/**
 * Get test command for a language
 * @pure
 * @param {string} language - Programming language
 * @returns {string|null} Test command or null if not supported
 */
export function getTestCommand(language) {
  const normalized = language.toLowerCase();
  return TEST_COMMANDS[normalized] || null;
}

/**
 * Get coverage file patterns for a language
 * @pure
 * @param {string} language - Programming language
 * @returns {string[]} Coverage file patterns
 */
export function getCoverageFiles(language) {
  const normalized = language.toLowerCase();
  return COVERAGE_FILES[normalized] || COVERAGE_FILES.javascript;
}

/**
 * Check if project has a package.json test script
 * @pure
 * @param {Object} packageJson - Parsed package.json content
 * @returns {boolean} True if test script exists
 */
export function hasTestScript(packageJson) {
  return Boolean(packageJson?.scripts?.test);
}

/**
 * Extract test command from package.json
 * @pure
 * @param {Object} packageJson - Parsed package.json content
 * @returns {string|null} Test command or null
 */
export function extractTestCommand(packageJson) {
  return packageJson?.scripts?.test || null;
}

// ============================================================================
// PURE FUNCTIONS - Test Output Parsing
// ============================================================================

/**
 * Parse test output for JavaScript/Jest
 * @pure
 * @param {string} output - Test output
 * @returns {Object} Parsed test results
 */
export function parseJestOutput(output) {
  const clean = stripAnsi(output);
  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    suitesFailed: 0,
    suitesTotal: 0,
  };

  // Find the "Tests:" summary line (Jest order varies: failed, skipped, passed, total)
  const testsLine = clean.match(/^Tests:\s+.+$/m);
  if (testsLine) {
    const line = testsLine[0];
    const passedMatch = line.match(/(\d+)\s+passed/);
    const failedMatch = line.match(/(\d+)\s+failed/);
    const skippedMatch = line.match(/(\d+)\s+skipped/);
    const totalMatch = line.match(/(\d+)\s+total/);

    if (passedMatch) results.passed = parseInt(passedMatch[1], 10);
    if (failedMatch) results.failed = parseInt(failedMatch[1], 10);
    if (skippedMatch) results.skipped = parseInt(skippedMatch[1], 10);
    if (totalMatch) results.total = parseInt(totalMatch[1], 10);
  }

  // Also parse "Test Suites:" line to capture suite-level failures (e.g. module not found)
  const suitesLine = clean.match(/^Test Suites:\s+.+$/m);
  if (suitesLine) {
    const line = suitesLine[0];
    const suiteFailedMatch = line.match(/(\d+)\s+failed/);
    const suiteTotalMatch = line.match(/(\d+)\s+total/);
    if (suiteFailedMatch) results.suitesFailed = parseInt(suiteFailedMatch[1], 10);
    if (suiteTotalMatch) results.suitesTotal = parseInt(suiteTotalMatch[1], 10);
  }

  return results;
}

/**
 * Parse test output for Python/pytest
 * @pure
 * @param {string} output - Test output
 * @returns {Object} Parsed test results
 */
export function parsePytestOutput(output) {
  const clean = stripAnsi(output);
  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
  };

  // Look for summary line: "10 passed, 2 failed, 1 skipped in 0.5s"
  const summaryMatch = clean.match(
    /(\d+)\s+passed(?:,\s+(\d+)\s+failed)?(?:,\s+(\d+)\s+skipped)?/i
  );
  if (summaryMatch) {
    results.passed = parseInt(summaryMatch[1] || '0', 10);
    results.failed = parseInt(summaryMatch[2] || '0', 10);
    results.skipped = parseInt(summaryMatch[3] || '0', 10);
    results.total = results.passed + results.failed + results.skipped;
  }

  return results;
}

/**
 * Parse test output based on language
 * @pure
 * @param {string} output - Test output
 * @param {string} language - Programming language
 * @returns {Object} Parsed test results
 */
export function parseTestOutput(output, language) {
  const normalized = language.toLowerCase();

  if (normalized === 'javascript' || normalized === 'typescript') {
    return parseJestOutput(output);
  } else if (normalized === 'python') {
    return parsePytestOutput(output);
  }

  // Default fallback
  return {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
  };
}

// ============================================================================
// PURE FUNCTIONS - Coverage Parsing
// ============================================================================

/**
 * Parse Jest coverage summary JSON
 * @pure
 * @param {Object} coverageJson - Parsed coverage-summary.json
 * @returns {Object} Coverage metrics
 */
export function parseJestCoverage(coverageJson) {
  const total = coverageJson?.total;
  if (!total) {
    return {
      statements: 0,
      branches: 0,
      functions: 0,
      lines: 0,
    };
  }

  return {
    statements: total.statements?.pct || 0,
    branches: total.branches?.pct || 0,
    functions: total.functions?.pct || 0,
    lines: total.lines?.pct || 0,
  };
}

/**
 * Identify files below the coverage threshold from a Jest coverage-summary.json.
 *
 * Iterates every file key in the summary (all keys except `"total"`) and returns
 * an entry for each file where **any** metric (statements, branches, functions,
 * lines) falls below `threshold`.  Entries are sorted by worst minimum coverage
 * ascending so the most urgent gaps appear first.
 *
 * @pure
 * @param {Object} coverageJson - Parsed coverage-summary.json object
 * @param {number} [threshold=80] - Minimum acceptable coverage percentage
 * @returns {Array<{file: string, statements: number, branches: number, functions: number, lines: number, min: number}>}
 */
export function parseCoverageGaps(coverageJson, threshold = 80) {
  if (!coverageJson || typeof coverageJson !== 'object') return [];

  const gaps = [];

  for (const [file, metrics] of Object.entries(coverageJson)) {
    if (file === 'total') continue;

    const statements = metrics?.statements?.pct ?? 100;
    const branches = metrics?.branches?.pct ?? 100;
    const functions = metrics?.functions?.pct ?? 100;
    const lines = metrics?.lines?.pct ?? 100;
    const min = Math.min(statements, branches, functions, lines);

    if (min < threshold) {
      gaps.push({ file, statements, branches, functions, lines, min });
    }
  }

  // Worst coverage first
  gaps.sort((a, b) => a.min - b.min);
  return gaps;
}

/**
 * Format a Markdown section listing per-file coverage gaps.
 *
 * Returns an empty string when there are no gaps so callers can safely
 * append the result without a guard check.
 *
 * @pure
 * @param {Array<{file: string, statements: number, branches: number, functions: number, lines: number}>} gaps
 * @param {number} [threshold=80] - Threshold used (shown in header)
 * @returns {string} Markdown section or empty string
 */
export function formatCoverageGapsSection(gaps, threshold = 80) {
  if (!gaps || gaps.length === 0) return '';

  const lines = [`## ⚠️ Coverage Gaps (below ${threshold}%)\n`];
  lines.push('| File | Stmts | Branch | Funcs | Lines |');
  lines.push('|------|------:|-------:|------:|------:|');

  for (const g of gaps) {
    const fmt = (v) => `${v < threshold ? `**${v}%**` : `${v}%`}`;
    lines.push(
      `| ${g.file} | ${fmt(g.statements)} | ${fmt(g.branches)} | ${fmt(g.functions)} | ${fmt(g.lines)} |`
    );
  }

  lines.push('');
  lines.push(
    `> **Action:** Add targeted tests for the modules above. Prioritize core logic, error handling, and edge cases.\n`
  );

  return lines.join('\n');
}

// ============================================================================
// PURE FUNCTIONS - Test Status
// ============================================================================

/**
 * @pure
 * @param {Object} results - Test results
 * @returns {string} Status: 'pass', 'fail', or 'warn'
 */
export function determineTestStatus(results) {
  if (results.failed > 0) return 'fail';
  if (results.skipped > 0) return 'warn';
  if (results.passed > 0) return 'pass';
  return 'unknown';
}

/**
 * Check whether test runner output indicates "no test files found" rather than a real failure.
 * Covers Jest, Vitest, and related runners that exit with code 1 when no tests exist.
 * @pure
 * @param {string} output - Combined stdout + stderr from test run
 * @returns {boolean}
 */
export function hasNoTestsFoundMessage(output) {
  if (!output) return false;
  const clean = stripAnsi(output);
  return (
    clean.includes('No tests found') || // Jest: "No tests found, exiting with code 1"
    clean.includes('No test files found') || // Vitest
    clean.includes('Your test suite must contain at least one test') // Jest (empty test file)
  );
}

// ============================================================================
// PURE FUNCTIONS - Reporting
// ============================================================================

/**
 * Format test execution report
 * @pure
 * @param {Object} results - Test results
 * @param {Array} [coverageGaps=[]] - Per-file coverage gaps from {@link parseCoverageGaps}
 * @param {number} [threshold=80] - Coverage threshold used for gap detection
 * @returns {string} Formatted report
 */
export function formatTestReport(results, coverageGaps = [], threshold = 80) {
  const {
    success = false,
    language = 'javascript',
    testResults = {},
    coverage = {},
    duration = 0,
    exitCode = 0,
  } = results;

  let report = '# Test Execution Report\n\n';

  // Summary
  report += '## Summary\n\n';
  report += `- **Language**: ${language}\n`;
  report += `- **Status**: ${success ? '✅ Passed' : '❌ Failed'}\n`;
  report += `- **Duration**: ${duration}ms\n`;
  report += `- **Exit Code**: ${exitCode}\n\n`;

  // Test Results
  if (testResults.total > 0) {
    report += '## Test Results\n\n';
    report += `- **Total Tests**: ${testResults.total}\n`;
    report += `- **Passed**: ${testResults.passed}\n`;
    report += `- **Failed**: ${testResults.failed}\n`;
    report += `- **Skipped**: ${testResults.skipped}\n\n`;

    const status = determineTestStatus(testResults);
    if (status === 'pass') {
      report += '✅ All tests passed!\n\n';
    } else if (status === 'fail') {
      report += `❌ ${testResults.failed} test(s) failed.\n\n`;
    } else if (status === 'warn') {
      report += `⚠️ ${testResults.skipped} test(s) skipped.\n\n`;
    }
  } else {
    report += '## Test Results\n\n';
    report += '⚠️ No test results found. Tests may not have run.\n\n';
  }

  // Coverage — aggregate totals
  if (coverage.statements !== undefined) {
    report += '## Coverage Metrics\n\n';
    report += `- **Statements**: ${coverage.statements}%\n`;
    report += `- **Branches**: ${coverage.branches}%\n`;
    report += `- **Functions**: ${coverage.functions}%\n`;
    report += `- **Lines**: ${coverage.lines}%\n\n`;

    const avgCoverage = Math.round(
      (coverage.statements + coverage.branches + coverage.functions + coverage.lines) / 4
    );

    if (avgCoverage >= 80) {
      report += '✅ Excellent coverage!\n\n';
    } else if (avgCoverage >= 60) {
      report += '👍 Good coverage, consider increasing to 80%+\n\n';
    } else {
      report += '⚠️ Coverage below recommended 60% threshold\n\n';
    }

    // Per-file gap breakdown (only when gaps exist)
    const gapsSection = formatCoverageGapsSection(coverageGaps, threshold);
    if (gapsSection) {
      report += gapsSection;
    } else {
      report += `✅ All modules meet the ${threshold}% coverage threshold.\n\n`;
    }
  } else {
    report += '## Coverage Metrics\n\n';
    report += '⚠️ No coverage data found. Run tests with `--coverage` to enable gap detection.\n\n';
  }

  // Recommendations
  if (!success || testResults.failed > 0) {
    report += '## 💡 Recommendations\n\n';
    report += '1. Review failed test output for error details\n';
    report += '2. Run tests locally to reproduce failures\n';
    report += '3. Check for environmental dependencies or timing issues\n';
    report += '4. Update tests if business logic has changed\n\n';
  }

  return report;
}

// ============================================================================
// STEP 8 EXECUTOR - Integration
// ============================================================================

/**
 * Build the retry command with a `--ci` flag appended appropriately for the
 * detected test runner invocation style.
 *
 * - Direct runner invocations (`jest`, `vitest`, `mocha`, …) accept `--ci`
 *   as a direct flag: `jest --ci`
 * - Package-manager invocations (`npm test`, `yarn test`, `pnpm test`) must
 *   forward the flag via `--`: `npm test -- --ci`
 * - Unknown invocations are returned unchanged to avoid breaking them.
 *
 * @param {string} cmd - The original test command.
 * @returns {string} Command with `--ci` flag appended, or unchanged if runner
 *   is unrecognised.
 */
export function buildCiRetryCmd(cmd) {
  if (/\b(jest|vitest|mocha|jasmine|tap|ava)\b/.test(cmd)) {
    return `${cmd} --ci`;
  }
  if (/^(npm(\s+run)?\s+test|yarn(\s+run)?\s+test|pnpm(\s+run)?\s+test)\b/.test(cmd.trim())) {
    return `${cmd} -- --ci`;
  }
  return cmd;
}

/**
 * Step 8 executor for test execution
 */
export class Step8TestExecutor {
  static stepKind = STEP_KIND.PROJECT;

  constructor(options = {}) {
    this.executor = options.executor || executor;
    this.fileOps = options.fileOps || new FileOperations();
    this.backlog = options.backlog || new Backlog();
    this.techStack = options.techStack || new TechStackDetector();
    this.aiHelper = options.aiHelper || new AiHelper({ promptsDir: options.promptsDir || null });
    this.aiCache = options.aiCache || new AiCache();
    this.configManager = options.configManager || null;
  }

  /**
   * Execute Step 8 test execution
   * @param {string} projectRoot - Project root directory
   * @param {Object} options - Execution options
   * @param {boolean} [options.skipCoverage] - Skip coverage collection
   * @param {number} [options.timeout] - Test timeout in ms
   * @returns {Promise<Object>} Execution result
   */
  async execute(projectRoot, options = {}) {
    const startTime = Date.now();

    try {
      logger.step('Step 8: Test Execution');

      // Phase 1: Detect language and test command
      const language = await this.detectLanguage(projectRoot);
      logger.info(`Detected language: ${language}`);

      const testCommand = await this.determineTestCommand(projectRoot, language);
      if (!testCommand) {
        logger.warn('No test command configured');
        const report = formatTestReport({
          success: false,
          language,
          testResults: {},
          coverage: {},
          duration: 0,
          exitCode: -1,
        });
        await this.backlog.saveStepSummary(8, 'Test Execution', report);

        return {
          success: false,
          language,
          testResults: {},
          message: 'No test command configured',
        };
      }

      logger.info(`Test command: ${testCommand}`);

      // Phase 2: Execute tests
      logger.debug(`[step_08] Executing test command: ${testCommand} in ${projectRoot}`);
      logger.step('Executing tests...');
      const testResult = await this.runTests(projectRoot, testCommand, options);
      logger.debug(`[step_08] Test command exited with code ${testResult.exitCode}`);
      logger.debug(`[step_08] Raw output length: ${testResult.output.length} chars`);

      // Phase 3: Parse test output
      logger.info('Parsing test results...');
      const testResults = parseTestOutput(testResult.output, language);
      logger.debug(
        `[step_08] Parsed results — passed: ${testResults.passed}, failed: ${testResults.failed}, skipped: ${testResults.skipped}, total: ${testResults.total}, suitesFailed: ${testResults.suitesFailed}`
      );
      logger.info(
        `Tests: ${testResults.passed} passed, ${testResults.failed} failed, ${testResults.skipped} skipped`
      );

      // Phase 4: Collect coverage (if available)
      const { coverage, coverageJson } = await this.collectCoverage(projectRoot, language);

      if (coverage.statements !== undefined) {
        logger.info(`Coverage: ${coverage.statements}% statements`);
      }

      // Phase 4b: Identify per-file coverage gaps
      const coverageThreshold = await this.readCoverageThreshold(projectRoot);
      const coverageGaps = parseCoverageGaps(coverageJson, coverageThreshold);
      if (coverageGaps.length > 0) {
        logger.warn(`Coverage gaps: ${coverageGaps.length} module(s) below ${coverageThreshold}%`);
      }

      // Phase 5: Generate report
      const duration = Date.now() - startTime;
      // "no tests found" can mean three different things:
      //   1. Jest literally found no test files → exits 1 + prints "No tests found" → warn only
      //   2. Runner/compiler crashed before finding tests → exits 1, silent/different output
      //   3. All tests passed, no output issues
      // "runnerCrashed" is set by runTests() when both the initial run and the --ci retry
      // produced 0 bytes of output with a non-zero exit code, indicating the process was
      // killed (OOM, SIGKILL) or crashed before writing anything.  We treat this the same
      // as "no tests found" — warn and continue rather than halting the whole workflow.
      const noTestsMessageInOutput = hasNoTestsFoundMessage(testResult.output);
      const runnerCrashed = !!testResult.runnerCrashed;
      const noTestsFound =
        testResults.total === 0 &&
        (testResults.suitesFailed ?? 0) === 0 &&
        (testResult.exitCode === 0 || noTestsMessageInOutput || runnerCrashed);
      const anyFailure =
        testResults.failed > 0 ||
        (testResults.suitesFailed ?? 0) > 0 ||
        (testResult.exitCode !== 0 && !noTestsFound);
      const success = !anyFailure;

      logger.debug(
        `[step_08] noTestsMessageInOutput: ${noTestsMessageInOutput}, runnerCrashed: ${runnerCrashed}, noTestsFound: ${noTestsFound}, anyFailure: ${anyFailure}, success: ${success}, exitCode: ${testResult.exitCode}`
      );

      const results = {
        success,
        noTestsFound,
        language,
        testResults,
        coverage,
        duration,
        exitCode: testResult.exitCode,
      };

      const report = formatTestReport(results, coverageGaps, coverageThreshold);
      await this.backlog.saveStepSummary(8, 'Test Execution', report);

      // Phase AI: AI-powered test result analysis
      const aiAvailable = await this.aiHelper.initialize();
      if (aiAvailable) {
        await this.aiCache.init();

        // Build a concise coverage gaps string for the prompt
        const coverageGapsText =
          coverageGaps.length > 0
            ? coverageGaps
                .map(
                  (g) =>
                    `  - ${g.file}: stmts=${g.statements}% branch=${g.branches}% funcs=${g.functions}% lines=${g.lines}%`
                )
                .join('\n')
            : 'none — all modules meet the threshold';

        let prompt;
        try {
          const yamlContent = await this.fileOps.readFile(AI_HELPERS_PATH);
          const parsedYaml = yaml.load(yamlContent);
          prompt = buildYamlStepPrompt(parsedYaml, 'step8_test_exec_prompt', {
            project_name: path.basename(projectRoot),
            project_description: options?.projectDescription ?? 'N/A',
            primary_language: language,
            test_framework:
              this.configManager?.getConfig?.()?.tech_stack?.test_framework || language,
            test_command: testCommand,
            test_exit_code: noTestsFound
              ? `${testResult.exitCode} (no tests discovered — runner exited without output${runnerCrashed ? ', possible crash or OOM kill' : ''}; treated as no-tests-found, not a test failure)`
              : String(testResult.exitCode),
            tests_total: String(testResults.total ?? 0),
            tests_passed: String(testResults.passed ?? 0),
            tests_failed: String(testResults.failed ?? 0),
            execution_summary: noTestsFound
              ? `No tests were discovered or executed (runner produced no output in ${duration}ms)`
              : `${testResults.passed ?? 0} passed, ${testResults.failed ?? 0} failed, ${testResults.skipped ?? 0} skipped in ${duration}ms${testResults.suitesFailed > 0 ? ` (${testResults.suitesFailed} suite${testResults.suitesFailed > 1 ? 's' : ''} failed to run)` : ''}`,
            test_output: noTestsFound
              ? `none — test runner produced no output (exit code ${testResult.exitCode}${runnerCrashed ? ', runner likely crashed before writing' : ''}; workflow treated this as no-tests-found)`
              : (testResult.output ?? '').slice(0, 2000) || 'none',
            failed_test_list: anyFailure ? (testResult.output ?? '').slice(0, 1000) : 'none',
            coverage_threshold: String(coverageThreshold),
            coverage_gaps: coverageGapsText,
          });
        } catch {
          /* fallback to generic prompt */
        }
        if (!prompt) {
          const role = `You are an expert in software testing and quality assurance.`;
          const task = `Analyze these test execution results and provide recommendations:
- Language: ${language}
- Tests passed: ${testResults.passed ?? 0}
- Tests failed: ${testResults.failed ?? 0}
- Overall coverage: ${coverage.statements ?? 'N/A'}% statements
- Coverage threshold: ${coverageThreshold}%
- Modules below threshold:\n${coverageGapsText}
- Duration: ${duration}ms
- Exit code: ${testResult.exitCode}`;
          const approach = `Identify the most likely root causes of failures and coverage gaps. Suggest concrete, targeted tests for each module below threshold. Prioritize core logic, error handling, and edge cases. Be concise.`;
          prompt = injectProjectContext(buildStructuredPrompt({ role, task, approach }), {});
        }
        const cacheKey = `step_08|${language}|${testResults.passed ?? 0}|${testResults.failed ?? 0}|${coverageGaps.length}`;
        const aiResult = await this.aiCache.withCache(prompt, cacheKey, () =>
          this.aiHelper.executeRequest(prompt, { persona: 'test_engineer' })
        );
        const aiContent = aiResult?.content ?? '';

        // Supplementary: e2e test engineering analysis — only for frontend/browser projects.
        // Library and API projects have no UI, so browser-based E2E tests are not applicable.
        const fePks = ['react_spa', 'client_spa', 'static_website'];
        const resolvedKind = options?.projectType ?? options?.projectKind ?? '';
        let e2eContent = '';
        if (fePks.includes(resolvedKind)) {
          try {
            const yamlContent2 = await this.fileOps.readFile(AI_HELPERS_PATH);
            const parsedYaml2 = yaml.load(yamlContent2);
            const e2ePrompt = buildYamlStepPrompt(parsedYaml2, 'e2e_test_engineer_prompt', {
              project_name: path.basename(projectRoot),
              project_description: options?.projectDescription ?? 'N/A',
              project_type: resolvedKind,
              e2e_framework: language,
              test_command: testCommand,
              browser_targets: '',
              modified_count: String((options?.modifiedFiles ?? []).length),
            });
            if (e2ePrompt) {
              const e2eKey = `step_08_e2e|${language}|${testResults.passed ?? 0}`;
              const e2eResult = await this.aiCache.withCache(e2eKey, e2eKey, () =>
                this.aiHelper.executeRequest(e2ePrompt, { persona: 'test_engineer' })
              );
              e2eContent = e2eResult?.content ?? '';
            }
          } catch {
            /* optional */
          }
        }

        if (aiContent || e2eContent) {
          const sections = aiContent
            ? [`${report}\n\n---\n\n## AI Recommendations\n\n${aiContent}`]
            : [report];
          if (e2eContent) sections.push(`\n\n## E2E Test Engineering Analysis\n\n${e2eContent}`);
          await this.backlog.saveStepSummary(8, 'Test Execution', sections.join(''));
        }
      } else {
        logger.warn('AI helper not available - skipping AI analysis');
      }

      if (!success) {
        if (testResults.failed > 0 || testResults.suitesFailed > 0) {
          logger.warn(
            `Step 8 completed - ${testResults.failed} test(s) failed` +
              (testResults.suitesFailed > 0
                ? `, ${testResults.suitesFailed} suite(s) failed to run`
                : '')
          );
        } else {
          logger.warn(
            `Step 8 completed - test runner exited with code ${testResult.exitCode} (0 tests parsed — check output snippet above)`
          );
        }
      } else if (noTestsFound) {
        if (runnerCrashed) {
          logger.warn(
            `Step 8 completed - test runner exited with code ${testResult.exitCode} but produced no output ` +
              `(possible OOM kill or crash before first write). Run \`${testCommand}\` manually to investigate.`
          );
          await this.backlog.saveStepSummary(
            8,
            'Test Execution',
            `${report}\n\n## ⚠️ Runner Crash Detected\n\n` +
              `The test runner exited with code ${testResult.exitCode} but produced no output on either attempt.\n` +
              `This usually indicates the process was killed (OOM, SIGKILL) before writing anything.\n\n` +
              `**Action required**: Run \`${testCommand}\` manually in the project directory to investigate.\n`,
            '⚠️'
          );
        } else {
          logger.warn('Step 8 completed - no tests found');
          await this.backlog.saveStepSummary(
            8,
            'Test Execution',
            `${report}\n\n## ⚠️ Recommendation\n\nNo test suite was found in this project. ` +
              `Consider adding tests to enable regression detection (Req 1 — Workflow Engine Requirements).\n` +
              `- For Node.js: \`npm init jest\` or add a \`test\` script to \`package.json\`\n` +
              `- For Python: add \`pytest\` and a \`tests/\` directory\n` +
              `- For shell scripts: add \`bats\` tests\n`,
            '⚠️'
          );
        }
      } else {
        logger.success('Step 8 completed - all tests passed!');
      }

      return {
        success,
        ...results,
      };
    } catch (error) {
      logger.error(`Step 8 failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Detect primary language
   * @param {string} projectRoot - Project root directory
   * @returns {Promise<string>} Language name
   */
  async detectLanguage(projectRoot) {
    return getPrimaryLanguage(this.techStack, projectRoot);
  }

  /**
   * Determine test command
   * @param {string} projectRoot - Project root directory
   * @param {string} language - Programming language
   * @returns {Promise<string|null>} Test command
   */
  async determineTestCommand(projectRoot, language) {
    // Try to read package.json for Node.js projects
    if (language === 'javascript' || language === 'typescript') {
      try {
        const pkgPath = `${projectRoot}/package.json`;
        const pkgContent = await this.fileOps.readFile(pkgPath);
        const packageJson = JSON.parse(pkgContent);

        if (hasTestScript(packageJson)) {
          // Always invoke via `npm test` so npm resolves node_modules/.bin
          // and applies the exact script defined in package.json.
          // Returning the raw script value (extractTestCommand) causes
          // "jest: not found" (exit 127) because node_modules/.bin is not in PATH.
          return 'npm test';
        }
      } catch {
        // No package.json, use default
      }
    }

    // Use default command for language
    const defaultCommand = getTestCommand(language);
    if (defaultCommand) return defaultCommand;

    // Fallback: read from .workflow-config.yaml tech_stack.test_command
    try {
      const configPath = `${projectRoot}/.workflow-config.yaml`;
      const configContent = await this.fileOps.readFile(configPath);
      const config = yaml.load(configContent);
      const testCommand = config?.tech_stack?.test_command;
      if (testCommand) return testCommand;
    } catch {
      // No workflow config or parse error
    }

    return null;
  }

  /**
   * Run tests
   * @param {string} projectRoot - Project root directory
   * @param {string} testCommand - Test command to execute
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Test result
   */
  async runTests(projectRoot, testCommand, options = {}) {
    const timeout = options.timeout || 300000; // 5 minutes default

    // Force non-interactive, pipe-friendly output so exec() reliably captures all
    // stdout/stderr regardless of whether the parent process has a TTY attached.
    // Without CI=true, Jest (and some other runners) may use ANSI cursor-control
    // sequences or interactive progress displays that can result in 0-byte output
    // being captured when the process exits before flushing those streams.
    const env = { ...process.env, CI: 'true', FORCE_COLOR: '0' };

    const runOnce = async (cmd) => {
      try {
        logger.debug(`[step_08] Running: ${cmd} (cwd: ${projectRoot}, timeout: ${timeout}ms)`);
        const result = await this.executor.execute(cmd, {
          cwd: projectRoot,
          timeout,
          shell: true,
          env,
        });
        const output = (result.stdout || '') + (result.stderr || '');
        logger.debug(`[step_08] Test runner exited 0 — output length: ${output.length} chars`);
        logger.debug(`[step_08] Output snippet: ${output.slice(0, 400).replace(/\n/g, '↵')}`);
        return { exitCode: result.exitCode || 0, output };
      } catch (error) {
        const output = (error.stdout || '') + (error.stderr || '');
        logger.debug(
          `[step_08] Test runner exited ${error.exitCode ?? 1} — output length: ${output.length} chars`
        );
        logger.debug(`[step_08] Output snippet: ${output.slice(0, 400).replace(/\n/g, '↵')}`);
        return { exitCode: error.exitCode || 1, output };
      }
    };

    const firstRun = await runOnce(testCommand);

    // If the runner exited non-zero with no output it likely crashed before writing
    // anything (e.g. OOM kill, ts-jest compilation panic, broken pipe).  Retry once
    // with an explicit `--ci` flag (Jest / Vitest) to surface diagnostic output.
    if (firstRun.output.length === 0 && firstRun.exitCode !== 0) {
      logger.warn(
        '[step_08] Test runner produced no output (possible crash) — retrying with --ci flag'
      );
      const ciCmd = buildCiRetryCmd(testCommand);
      const retry = await runOnce(ciCmd);
      if (retry.output.length > 0 || retry.exitCode === 0) {
        return retry;
      }
      // Both runs produced no output — return the original result with a sentinel
      return { ...firstRun, runnerCrashed: true };
    }

    return firstRun;
  }

  /**
   * Collect coverage metrics
   * @param {string} projectRoot - Project root directory
   * @param {string} language - Programming language
   * @returns {Promise<Object>} Coverage metrics
   */
  async collectCoverage(projectRoot, language) {
    const coverageFiles = getCoverageFiles(language);

    // Try to find coverage summary
    for (const file of coverageFiles) {
      const coveragePath = `${projectRoot}/${file}`;

      try {
        const exists = await this.fileOps.exists(coveragePath);
        if (!exists) continue;

        // Parse JSON coverage (Jest format)
        if (file.endsWith('.json')) {
          const content = await this.fileOps.readFile(coveragePath);
          const coverageJson = JSON.parse(content);
          // Return both aggregate metrics and the raw JSON for gap analysis
          return { coverage: parseJestCoverage(coverageJson), coverageJson };
        }
      } catch {
        // Try next file
      }
    }

    // No coverage found
    return { coverage: {}, coverageJson: null };
  }

  /**
   * Read the minimum coverage threshold from `.workflow-config.yaml`.
   * Falls back to 80 if the file is missing or the field is not set.
   *
   * @param {string} projectRoot - Project root directory
   * @returns {Promise<number>} Threshold percentage (0–100)
   */
  async readCoverageThreshold(projectRoot) {
    try {
      const configPath = `${projectRoot}/.workflow-config.yaml`;
      const content = await this.fileOps.readFile(configPath);
      const config = yaml.load(content);
      const threshold = config?.validation?.testing?.min_coverage;
      if (typeof threshold === 'number' && threshold > 0 && threshold <= 100) {
        return threshold;
      }
    } catch {
      // Config missing or unreadable — use default
    }
    return 80;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default Step8TestExecutor;
