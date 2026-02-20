/**
 * Step 8: Test Execution
 * @module steps/step_08_test_exec
 * @version 2.0.0
 *
 * Executes test suites and analyzes results with coverage metrics.
 */

import { STEP_KIND } from './step_contract.js';
import { logger } from '../core/logger.js';
import * as executor from '../core/executor.js';
import { FileOperations } from '../lib/file_operations.js';
import { Backlog } from '../lib/backlog.js';
import { TechStackDetector } from '../lib/tech_stack.js';

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
  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
  };

  // Extract total tests
  const totalMatch = output.match(
    /Tests:\s+(?:(\d+)\s+skipped,\s+)?(\d+)\s+passed(?:,\s+(\d+)\s+failed)?(?:,\s+)?(\d+)\s+total/i
  );
  if (totalMatch) {
    results.skipped = parseInt(totalMatch[1] || '0', 10);
    results.passed = parseInt(totalMatch[2] || '0', 10);
    results.failed = parseInt(totalMatch[3] || '0', 10);
    results.total = parseInt(totalMatch[4] || '0', 10);
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
  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
  };

  // Look for summary line: "10 passed, 2 failed, 1 skipped in 0.5s"
  const summaryMatch = output.match(
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
 * Determine test status from results
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

// ============================================================================
// PURE FUNCTIONS - Reporting
// ============================================================================

/**
 * Format test execution report
 * @pure
 * @param {Object} results - Test results
 * @returns {string} Formatted report
 */
export function formatTestReport(results) {
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

  // Coverage
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
 * Step 8 executor for test execution
 */
export class Step8TestExecutor {
  static stepKind = STEP_KIND.PROJECT;

  constructor(options = {}) {
    this.executor = options.executor || executor;
    this.fileOps = options.fileOps || new FileOperations();
    this.backlog = options.backlog || new Backlog();
    this.techStack = options.techStack || new TechStackDetector();
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
      const testResult = await this.runTests(projectRoot, testCommand, options);

      // Phase 3: Parse test output
      const testResults = parseTestOutput(testResult.output, language);
      logger.info(
        `Tests: ${testResults.passed} passed, ${testResults.failed} failed, ${testResults.skipped} skipped`
      );

      // Phase 4: Collect coverage (if available)
      const coverage = await this.collectCoverage(projectRoot, language);

      if (coverage.statements !== undefined) {
        logger.info(`Coverage: ${coverage.statements}% statements`);
      }

      // Phase 5: Generate report
      const duration = Date.now() - startTime;
      const success = testResult.exitCode === 0;

      const results = {
        success,
        language,
        testResults,
        coverage,
        duration,
        exitCode: testResult.exitCode,
      };

      const report = formatTestReport(results);
      await this.backlog.saveStepSummary(8, 'Test Execution', report);

      if (success) {
        logger.success('Step 8 completed - all tests passed!');
      } else {
        logger.warn(`Step 8 completed - ${testResults.failed} test(s) failed`);
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
    try {
      const detection = await this.techStack.detectAll(projectRoot);
      if (detection.languages && detection.languages.length > 0) {
        return detection.languages[0];
      }
    } catch {
      // Fallback
    }
    return 'javascript';
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
          return extractTestCommand(packageJson);
        }
      } catch {
        // No package.json, use default
      }
    }

    // Use default command for language
    return getTestCommand(language);
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

    try {
      const result = await this.executor.execute(testCommand, {
        cwd: projectRoot,
        timeout,
        shell: true,
      });

      return {
        exitCode: result.exitCode || 0,
        output: result.stdout + result.stderr,
      };
    } catch (error) {
      // Tests failed, but capture output
      return {
        exitCode: error.exitCode || 1,
        output: (error.stdout || '') + (error.stderr || ''),
      };
    }
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
          return parseJestCoverage(coverageJson);
        }
      } catch {
        // Try next file
      }
    }

    // No coverage found
    return {};
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default Step8TestExecutor;
