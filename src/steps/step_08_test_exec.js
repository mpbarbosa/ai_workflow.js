/**
 * Step 8: Test Execution
 * @module steps/step_08_test_exec
 * @version 2.0.0
 *
 * Executes test suites and analyzes results with coverage metrics.
 */

import { STEP_KIND } from './step_contract.js';
import path from 'path';
import { access, readdir } from 'node:fs/promises';
import { logger, stripAnsi } from '../core/logger.js';
import * as executor from '../core/executor.js';
import { FileOperations } from '../lib/file_operations.js';
import { Backlog } from '../lib/backlog.js';
import { TechStackDetector } from '../lib/tech_stack.js';
import { AiHelper } from '../lib/ai_helpers.js';
import { AiCache } from '../lib/ai_cache.js';
import {
  buildStepPromptWithFallback,
  detectAndLogPrimaryLanguage,
  detectPrimaryLanguage,
  enrichStepSummaryWithOptionalAiAnalysis,
  logLanguageAwareSkippedStepOutcomeAndReturn,
  logStepOutcomeAndReturn,
} from './step_execution_helpers.js';
import { buildYamlStepPrompt, AI_HELPERS_PATH, loadResolvedAiHelpers } from '../lib/ai_prompt_builder.js';
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

async function pathExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function hasMatchingConfig(projectRoot, candidates) {
  const results = await Promise.all(
    candidates.map((candidate) => pathExists(path.join(projectRoot, candidate)))
  );
  return results.some(Boolean);
}

async function findExistingConfigs(projectRoot, candidates) {
  const matches = await Promise.all(
    candidates.map(async (candidate) =>
      (await pathExists(path.join(projectRoot, candidate))) ? candidate : null
    )
  );
  return matches.filter(Boolean);
}

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

/**
 * Detect which test types (unit, integration, e2e) are present in the project.
 * Inspects test config file names and the test directory for known patterns.
 * @param {string} projectRoot - Project root directory
 * @returns {Promise<string>} Comma-separated list of detected test types (e.g. "unit, integration")
 */
export async function detectTestTypes(projectRoot) {
  const types = [];
  try {
    const unitIndicators = [
      'jest.config.js',
      'jest.config.ts',
      'jest.config.cjs',
      'jest.config.mjs',
      'jest.config.json',
      'vitest.config.js',
      'vitest.config.ts',
      'vitest.config.mjs',
      'karma.conf.js',
      '.mocharc.js',
      '.mocharc.yml',
      '.mocharc.json',
      'jasmine.json',
    ];
    const integrationIndicators = [
      'jest.integration.config.js',
      'jest.integration.config.ts',
      'jest.integration.config.json',
      'jest.config.integration.js',
      'jest.config.integration.ts',
    ];
    const e2eIndicators = [
      'playwright.config.js',
      'playwright.config.ts',
      'jest.config.e2e.js',
      'jest.config.e2e.ts',
      'cypress.config.js',
      'cypress.config.ts',
      'cypress.json',
      'wdio.conf.js',
    ];

    const [hasUnit, hasIntegration, hasE2e] = await Promise.all([
      hasMatchingConfig(projectRoot, unitIndicators),
      hasMatchingConfig(projectRoot, integrationIndicators),
      hasMatchingConfig(projectRoot, e2eIndicators),
    ]);

    if (hasUnit) types.push('unit');
    if (hasIntegration) types.push('integration');
    if (hasE2e) types.push('e2e');

    // Also check for e2e or integration directories under test/
    const testDir = path.join(projectRoot, 'test');
    const entries = await readdir(testDir).catch(() => null);
    if (entries) {
      if (!types.includes('integration') && entries.some((e) => /integrat/i.test(e)))
        types.push('integration');
      if (!types.includes('e2e') && entries.some((e) => /e2e|end.to.end/i.test(e)))
        types.push('e2e');
    }
  } catch {
    /* ignore — return whatever was found */
  }
  return types.length > 0 ? types.join(', ') : 'unit';
}

const KNOWN_TEST_FRAMEWORKS = new Set([
  'jest',
  'vitest',
  'mocha',
  'ava',
  'tap',
  'jasmine',
  'karma',
  'playwright',
  'cypress',
  'wdio',
  'pytest',
  'rspec',
]);

/**
 * Decide whether the invoked command is acting as a repository validation
 * script rather than as a conventional test runner.
 *
 * @pure
 * @param {Object} params
 * @param {string} [params.testCommand]
 * @param {string} [params.testFramework]
 * @param {string} [params.testConfigPaths]
 * @param {string} [params.testTypes]
 * @returns {boolean}
 */
export function isValidationScriptExecution({
  testCommand = '',
  testFramework = '',
  testConfigPaths = 'none found',
  testTypes = '',
} = {}) {
  const normalizedCommand = String(testCommand).trim().toLowerCase();
  const normalizedFramework = String(testFramework).trim().toLowerCase();
  const normalizedConfigPaths = String(testConfigPaths).trim().toLowerCase();
  const normalizedTypes = String(testTypes).trim().toLowerCase();

  if (normalizedTypes === 'validation-script') {
    return true;
  }

  if (normalizedConfigPaths !== 'none found' && normalizedConfigPaths !== '') {
    return false;
  }

  const commandLooksLikeTestRunner =
    /\b(jest|vitest|mocha|ava|tap|jasmine|karma|playwright|cypress|wdio|pytest|rspec)\b/.test(
      normalizedCommand
    ) || /\b(go test|mvn test|cargo test)\b/.test(normalizedCommand);

  if (commandLooksLikeTestRunner || KNOWN_TEST_FRAMEWORKS.has(normalizedFramework)) {
    return false;
  }

  if (normalizedFramework === 'custom') {
    return true;
  }

  return /\b(typecheck|tsc|lint|validate|check)\b/.test(normalizedCommand);
}

/**
 * Decide whether the available evidence explicitly indicates E2E coverage.
 *
 * @pure
 * @param {Object} params
 * @param {string} [params.testCommand]
 * @param {string} [params.testFramework]
 * @param {string} [params.testConfigPaths]
 * @param {string} [params.testTypes]
 * @returns {boolean}
 */
export function hasExplicitE2eEvidence({
  testCommand = '',
  testFramework = '',
  testConfigPaths = 'none found',
  testTypes = '',
} = {}) {
  const normalizedCommand = String(testCommand).trim().toLowerCase();
  const normalizedFramework = String(testFramework).trim().toLowerCase();
  const normalizedConfigPaths = String(testConfigPaths).trim().toLowerCase();
  const normalizedTypes = String(testTypes).trim().toLowerCase();

  return (
    /\be2e\b/.test(normalizedTypes) ||
    /\b(playwright|cypress|wdio)\b/.test(normalizedFramework) ||
    /\b(playwright|cypress|wdio)\b/.test(normalizedCommand) ||
    /\b(playwright|cypress|wdio)\b/.test(normalizedConfigPaths)
  );
}

/**
 * Format a prompt-friendly test result summary.
 *
 * @pure
 * @param {Object} params
 * @param {boolean} [params.isValidationScript=false]
 * @param {Object} [params.testResults={}]
 * @returns {string}
 */
export function formatPromptResultsSummary({ isValidationScript = false, testResults = {} } = {}) {
  if (isValidationScript && (testResults.total ?? 0) === 0) {
    return 'unavailable — validation-script run did not report test-case counts';
  }

  return `${testResults.passed ?? 0}/${testResults.total ?? 0} passed, ${testResults.failed ?? 0} failed, ${testResults.skipped ?? 0} skipped`;
}

/**
 * Format a prompt-friendly coverage threshold string.
 *
 * @pure
 * @param {number|null} configuredCoverageThreshold
 * @returns {string}
 */
export function formatPromptCoverageThreshold(configuredCoverageThreshold) {
  return configuredCoverageThreshold === null
    ? 'unavailable — no explicit project threshold configured'
    : `${configuredCoverageThreshold}%`;
}

/**
 * Detect CI/CD workflow config file paths under .github/workflows/.
 * @param {string} projectRoot - Project root directory
 * @returns {Promise<string>} Comma-separated list of workflow filenames, or 'none found'
 */
export async function detectCiConfigPaths(projectRoot) {
  const workflowsDir = path.join(projectRoot, '.github', 'workflows');
  try {
    const files = (await readdir(workflowsDir)).filter(
      (f) => f.endsWith('.yml') || f.endsWith('.yaml')
    );
    return files.length > 0 ? files.join(', ') : 'none found';
  } catch {
    return 'none found';
  }
}

/**
 * Detect test runner config files in the project root.
 * Covers Jest, Vitest, Mocha, Jasmine, Karma, and Playwright.
 * @param {string} projectRoot - Project root directory
 * @returns {Promise<string>} Comma-separated list of found config filenames, or 'none found'
 */
export async function detectTestConfigPaths(projectRoot) {
  const candidates = [
    'jest.config.js',
    'jest.config.ts',
    'jest.config.cjs',
    'jest.config.mjs',
    'jest.config.json',
    'jest.integration.config.js',
    'jest.integration.config.ts',
    'jest.integration.config.cjs',
    'jest.integration.config.mjs',
    'jest.integration.config.json',
    'jest.config.unit.js',
    'jest.config.unit.ts',
    'jest.config.unit.cjs',
    'jest.config.unit.mjs',
    'jest.config.unit.json',
    'jest.config.e2e.js',
    'jest.config.e2e.ts',
    'jest.config.e2e.cjs',
    'jest.config.e2e.mjs',
    'jest.config.e2e.json',
    'jest.config.integration.js',
    'jest.config.integration.ts',
    'jest.config.integration.cjs',
    'jest.config.integration.mjs',
    'jest.config.integration.json',
    'vitest.config.js',
    'vitest.config.ts',
    'vitest.config.mjs',
    'karma.conf.js',
    'karma.conf.ts',
    '.mocharc.js',
    '.mocharc.yml',
    '.mocharc.json',
    'jasmine.json',
    'playwright.config.js',
    'playwright.config.ts',
  ];
  try {
    const found = await findExistingConfigs(projectRoot, candidates);
    return found.length > 0 ? found.join(', ') : 'none found';
  } catch {
    return 'none found';
  }
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

/**
 * Build the coverage context string injected into the Step 8 AI prompt.
 *
 * Distinguishes between:
 * - no tests ran,
 * - no coverage artifact was produced,
 * - aggregate coverage being below threshold without file-level gaps,
 * - and a genuine "no gaps" success case backed by measured coverage.
 *
 * @pure
 * @param {Object} params
 * @param {boolean} [params.noTestsFound=false]
 * @param {Object} [params.coverage={}]
 * @param {Object|null} [params.coverageJson=null]
 * @param {Array<{file: string, statements: number, branches: number, functions: number, lines: number}>} [params.coverageGaps=[]]
 * @param {number} [params.coverageThreshold=80]
 * @returns {string}
 */
export function describeCoveragePromptContext({
  noTestsFound = false,
  coverage = {},
  coverageJson = null,
  coverageGaps = [],
  coverageThreshold = 80,
} = {}) {
  if (noTestsFound) {
    return 'unavailable — no tests ran, so coverage could not be measured';
  }

  const metrics = [
    ['statements', coverage?.statements],
    ['branches', coverage?.branches],
    ['functions', coverage?.functions],
    ['lines', coverage?.lines],
  ].filter(([, value]) => typeof value === 'number' && Number.isFinite(value));

  const coverageAvailable = Boolean(coverageJson) || metrics.length > 0;
  if (!coverageAvailable) {
    return 'unavailable — no coverage artifact was found for this run';
  }

  if (coverageGaps.length > 0) {
    return coverageGaps
      .map(
        (g) =>
          `  - ${g.file}: stmts=${g.statements}% branch=${g.branches}% funcs=${g.functions}% lines=${g.lines}%`
      )
      .join('\n');
  }

  const aggregateBelowThreshold = metrics
    .filter(([, value]) => value < coverageThreshold)
    .map(([name, value]) => `${name}=${value}%`);

  if (aggregateBelowThreshold.length > 0) {
    return `inconclusive — aggregate coverage is below ${coverageThreshold}% (${aggregateBelowThreshold.join(', ')}), but no per-file gaps were provided`;
  }

  return `none — measured coverage meets or exceeds the ${coverageThreshold}% threshold`;
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

/**
 * Decide whether test execution should be skipped based on repo-local workflow config.
 *
 * @pure
 * @param {Object|null} workflowConfig - Parsed .workflow-config.yaml content
 * @returns {{skip: boolean, reason: string|null}}
 */
export function getTestExecutionSkipDecision(workflowConfig) {
  const steps = Array.isArray(workflowConfig?.workflow?.steps) ? workflowConfig.workflow.steps : [];
  const step08 = steps.find((step) => String(step?.id ?? '').trim() === '08');
  if (step08?.enabled === false) {
    return {
      skip: true,
      reason: step08.reason || 'Test execution is disabled in .workflow-config.yaml',
    };
  }

  const techStack = workflowConfig?.tech_stack;
  const framework =
    typeof techStack?.test_framework === 'string' ? techStack.test_framework.trim() : '';
  if (framework.toLowerCase() === 'none') {
    return {
      skip: true,
      reason: 'Test framework is set to "none" in .workflow-config.yaml',
    };
  }

  if (
    techStack &&
    Object.prototype.hasOwnProperty.call(techStack, 'test_command') &&
    typeof techStack.test_command === 'string' &&
    techStack.test_command.trim() === ''
  ) {
    return {
      skip: true,
      reason: 'No test command is configured in .workflow-config.yaml',
    };
  }

  return { skip: false, reason: null };
}

/**
 * Decide whether a missing test command means the step is inapplicable rather
 * than a real failure.
 *
 * @pure
 * @param {Object} context
 * @param {string} [context.language] - Detected primary language
 * @param {string} [context.scope] - Workflow scope/profile key
 * @param {Object|null} [context.workflowConfig] - Parsed .workflow-config.yaml
 * @returns {{skip: boolean, reason: string}}
 */
export function getMissingTestCommandDecision({ language, scope, workflowConfig } = {}) {
  const normalizedLanguage = String(language ?? '')
    .trim()
    .toLowerCase();
  const normalizedScope = String(scope ?? '')
    .trim()
    .toLowerCase();
  const configuredPrimaryLanguage = String(workflowConfig?.tech_stack?.primary_language ?? '')
    .trim()
    .toLowerCase();

  if (
    normalizedScope === 'docs_only' ||
    normalizedLanguage === 'markdown' ||
    configuredPrimaryLanguage === 'markdown'
  ) {
    return {
      skip: true,
      reason: 'Test execution is not applicable to documentation-only Markdown projects',
    };
  }

  return {
    skip: false,
    reason: 'No test command configured',
  };
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
      const language = await detectAndLogPrimaryLanguage(this.techStack, projectRoot);

      const workflowConfig = await this._readWorkflowConfig(projectRoot);
      const skipDecision = getTestExecutionSkipDecision(workflowConfig);
      if (skipDecision.skip) {
        return logLanguageAwareSkippedStepOutcomeAndReturn({
          backlog: this.backlog,
          stepId: 8,
          stepName: 'Test Execution',
          language,
          logMessage: `Skipping test execution: ${skipDecision.reason}`,
          summary: `# Test Execution Report\n\n- **Status**: ⏭️ Skipped\n- **Language**: ${language}\n- **Reason**: ${skipDecision.reason}\n`,
          result: {
            testResults: {},
            coverage: {},
          },
          message: skipDecision.reason,
          reason: 'tests_disabled',
        });
      }

      const testCommand = await this.determineTestCommand(projectRoot, language);
      if (!testCommand) {
        const missingCommandDecision = getMissingTestCommandDecision({
          language,
          scope: options.scope,
          workflowConfig,
        });
        if (missingCommandDecision.skip) {
          return logLanguageAwareSkippedStepOutcomeAndReturn({
            backlog: this.backlog,
            stepId: 8,
            stepName: 'Test Execution',
            language,
            logMessage: `Skipping test execution: ${missingCommandDecision.reason}`,
            summary: `# Test Execution Report\n\n- **Status**: ⏭️ Skipped\n- **Language**: ${language}\n- **Reason**: ${missingCommandDecision.reason}\n`,
            result: {
              testResults: {},
              coverage: {},
            },
            message: missingCommandDecision.reason,
            reason: 'tests_not_applicable',
          });
        }

        const report = formatTestReport({
          success: false,
          language,
          testResults: {},
          coverage: {},
          duration: 0,
          exitCode: -1,
        });
        return logStepOutcomeAndReturn({
          backlog: this.backlog,
          stepId: 8,
          stepName: 'Test Execution',
          logMethod: 'warn',
          logMessage: missingCommandDecision.reason,
          summary: report,
          result: {
            success: false,
            language,
            testResults: {},
            message: missingCommandDecision.reason,
          },
        });
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

      // "no tests found" must remain distinct from a silent runner crash:
      //   1. Jest/Vitest explicitly reports no test files → warn only, non-blocking
      //   2. Runner/compiler exits non-zero with no output on both attempts → inconclusive failure
      //   3. All tests passed or produced explicit failure diagnostics
      // "runnerCrashed" is set by runTests() when both the initial run and the --ci retry
      // produced 0 bytes of output with a non-zero exit code.
      const noTestsMessageInOutput = hasNoTestsFoundMessage(testResult.output);
      const runnerCrashed = !!testResult.runnerCrashed;
      const silentRunnerExit = runnerCrashed && !noTestsMessageInOutput;
      const duration = Date.now() - startTime;
      const noTestsFound =
        testResults.total === 0 &&
        (testResults.suitesFailed ?? 0) === 0 &&
        (testResult.exitCode === 0 || noTestsMessageInOutput);
      const anyFailure =
        testResults.failed > 0 ||
        (testResults.suitesFailed ?? 0) > 0 ||
        silentRunnerExit ||
        (testResult.exitCode !== 0 && !noTestsFound);
      const success = !anyFailure;

      // Phase 4: Collect coverage only when the current run produced usable runtime evidence.
      const coverageThreshold = await this.readCoverageThreshold(projectRoot);
      const configuredCoverageThreshold = await this.readConfiguredCoverageThreshold(projectRoot);
      let coverage = {};
      let coverageJson = null;
      let coverageGaps = [];

      if (!silentRunnerExit) {
        ({ coverage, coverageJson } = await this.collectCoverage(projectRoot, language));

        if (coverage.statements !== undefined) {
          logger.info(`Coverage: ${coverage.statements}% statements`);
        }

        coverageGaps = parseCoverageGaps(coverageJson, coverageThreshold);
        if (coverageGaps.length > 0) {
          logger.warn(`Coverage gaps: ${coverageGaps.length} module(s) below ${coverageThreshold}%`);
        }
      }

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
      const skipAiAnalysis = silentRunnerExit;
      if (skipAiAnalysis) {
        logger.warn(
          '[step_08] Skipping AI analysis because the test runner produced no runtime evidence on either attempt'
        );
      }
      await enrichStepSummaryWithOptionalAiAnalysis({
        aiHelper: this.aiHelper,
        aiCache: this.aiCache,
        shouldInitialize: !skipAiAnalysis,
        unavailableMessage: 'AI helper not available - skipping AI analysis',
        backlog: this.backlog,
        stepId: 8,
        stepName: 'Test Execution',
        summary: report,
        buildAnalysis: async () => {
          const coverageGapsText = describeCoveragePromptContext({
            noTestsFound,
            coverage,
            coverageJson,
            coverageGaps,
            coverageThreshold,
          });
          const configuredTestFramework =
            this.configManager?.getConfig?.()?.tech_stack?.test_framework ||
            (await this._readTestFrameworkFromConfig(projectRoot)) ||
            language;
          const [testConfigPaths, detectedTestTypes, ciConfigPaths] = await Promise.all([
            detectTestConfigPaths(projectRoot),
            detectTestTypes(projectRoot),
            detectCiConfigPaths(projectRoot),
          ]);
          const validationScriptExecution = isValidationScriptExecution({
            testCommand,
            testFramework: configuredTestFramework,
            testConfigPaths,
            testTypes: detectedTestTypes,
          });
          const explicitE2eEvidence = hasExplicitE2eEvidence({
            testCommand,
            testFramework: configuredTestFramework,
            testConfigPaths,
            testTypes: detectedTestTypes,
          });
          const promptTestTypes =
            validationScriptExecution ? 'validation-script' : detectedTestTypes;
          const promptResultsSummary = formatPromptResultsSummary({
            isValidationScript: validationScriptExecution,
            testResults,
          });
          const promptCoverageThreshold = formatPromptCoverageThreshold(configuredCoverageThreshold);
          const promptScope = validationScriptExecution
            ? 'validation script only'
            : 'automated test suite only';
          const promptExecutionSummary = silentRunnerExit
            ? validationScriptExecution
              ? `The validation command exited without output in ${duration}ms; no validation, typecheck, or test diagnostics could be confirmed from captured evidence, so the workflow treated this as a blocking inconclusive failure`
              : `The test runner exited without output in ${duration}ms; no tests, assertion failures, or discovery/configuration cause could be confirmed from captured evidence, so the workflow treated this as a blocking inconclusive failure`
            : noTestsFound
              ? validationScriptExecution
                ? `The validation command completed without reporting test-case counts in ${duration}ms`
                : `No tests were discovered or executed (runner reported no test files in ${duration}ms)`
              : `${testResults.passed ?? 0} passed, ${testResults.failed ?? 0} failed, ${testResults.skipped ?? 0} skipped in ${duration}ms${testResults.suitesFailed > 0 ? ` (${testResults.suitesFailed} suite${testResults.suitesFailed > 1 ? 's' : ''} failed to run)` : ''}`;
          const promptOutput = silentRunnerExit
            ? validationScriptExecution
              ? `none — validation command produced no output (exit code ${testResult.exitCode}; root cause unavailable from captured evidence)`
              : `none — test runner produced no output (exit code ${testResult.exitCode}; root cause unavailable from captured evidence)`
            : noTestsFound
              ? (testResult.output ?? '').slice(0, 2000) ||
                (validationScriptExecution
                  ? `validation command completed without reporting test cases (exit code ${testResult.exitCode})`
                  : `runner reported no test files (exit code ${testResult.exitCode})`)
              : (testResult.output ?? '').slice(0, 2000) || 'none';
          const failedTestList =
            validationScriptExecution && !anyFailure
              ? 'none — validation-script run did not report named test cases'
              : anyFailure
                ? (testResult.output ?? '').slice(0, 1000)
                : 'none';

          const prompt = await buildStepPromptWithFallback({
            buildPrompt: async () => {
              const parsedYaml = await loadResolvedAiHelpers(this.fileOps);
              return buildYamlStepPrompt(parsedYaml, 'step8_test_exec_prompt', {
                project_name: path.basename(projectRoot),
                project_description: options?.projectDescription ?? 'N/A',
                primary_language: language,
                test_framework: configuredTestFramework,
                test_command: testCommand,
                test_config_paths: testConfigPaths,
                test_types: promptTestTypes,
                test_exit_code: silentRunnerExit
                  ? `${testResult.exitCode} (runner exited without output; root cause unavailable from captured evidence, so the workflow treated it as a blocking inconclusive failure that requires manual investigation)`
                  : noTestsFound
                    ? `${testResult.exitCode} (no tests found message detected in runner output; treated as no-tests-found, not a test failure)`
                    : String(testResult.exitCode),
                results_summary: promptResultsSummary,
                project_kind: options?.projectType ?? options?.projectKind ?? 'N/A',
                ci_config_paths: ciConfigPaths,
                execution_summary: promptExecutionSummary,
                test_output: promptOutput,
                failed_test_list: failedTestList,
                coverage_threshold: promptCoverageThreshold,
                coverage_gaps: coverageGapsText,
                scope_label: promptScope,
              });
            },
            fallbackRole: `You are an expert in software testing and quality assurance.`,
            fallbackTask: `Analyze these test execution results and provide recommendations:
- Language: ${language}
- Tests passed: ${testResults.passed ?? 0}
- Tests failed: ${testResults.failed ?? 0}
- Overall coverage: ${coverage.statements ?? 'N/A'}% statements
- Coverage threshold: ${promptCoverageThreshold}
- Modules below threshold:\n${coverageGapsText}
- Duration: ${duration}ms
- Exit code: ${testResult.exitCode}`,
            fallbackApproach: `Identify the most likely root causes of failures and coverage gaps. Suggest concrete, targeted tests for each module below threshold. Prioritize core logic, error handling, and edge cases. Be concise.`,
            fallbackProjectContext: {},
          });
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
          if (fePks.includes(resolvedKind) && !validationScriptExecution && explicitE2eEvidence) {
            try {
              const yamlContent2 = await this.fileOps.readFile(AI_HELPERS_PATH);
              const parsedYaml2 = yaml.load(yamlContent2);
              const e2ePrompt = buildYamlStepPrompt(parsedYaml2, 'e2e_test_engineer_prompt', {
                project_name: path.basename(projectRoot),
                project_description: options?.projectDescription ?? 'N/A',
                project_type: resolvedKind,
                e2e_framework: configuredTestFramework,
                test_command: testCommand,
                browser_targets: '',
                modified_count: String((options?.modifiedFiles ?? []).length),
              });
              if (e2ePrompt) {
                const e2eKey = `step_08_e2e|${language}|${testResults.passed ?? 0}`;
                const e2eResult = await this.aiCache.withCache(e2ePrompt, e2eKey, () =>
                  this.aiHelper.executeRequest(e2ePrompt, { persona: 'test_engineer' })
                );
                e2eContent = e2eResult?.content ?? '';
              }
            } catch {
              /* optional */
            }
          }

          return {
            aiRecommendations: aiContent,
            extraSections: [{ title: 'E2E Test Engineering Analysis', content: e2eContent }],
          };
        },
      });

      if (!success) {
        if (runnerCrashed) {
          logger.warn(
            `Step 8 blocked - test runner exited with code ${testResult.exitCode} but produced no output ` +
              `on either attempt. Run \`${testCommand}\` manually to investigate.`
          );
          await this.backlog.saveStepSummary(
            8,
            'Test Execution',
            `${report}\n\n## ❌ Inconclusive Test Runner Failure\n\n` +
              `The test runner exited with code ${testResult.exitCode} but produced no output on either attempt.\n` +
              `The root cause could not be confirmed from the captured evidence, so this run cannot be treated as a passing or no-tests-found outcome.\n\n` +
              `**Action required**: Run \`${testCommand}\` manually in the project directory to investigate before relying on downstream workflow results.\n`,
            '❌'
          );
        } else if (testResults.failed > 0 || testResults.suitesFailed > 0) {
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
    return detectPrimaryLanguage(this.techStack, projectRoot);
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

  async _readWorkflowConfig(projectRoot) {
    try {
      const configPath = `${projectRoot}/.workflow-config.yaml`;
      const configContent = await this.fileOps.readFile(configPath);
      const parsed = yaml.load(configContent);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
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

  /**
   * Read the explicitly configured minimum coverage threshold from
   * `.workflow-config.yaml`.
   *
   * @param {string} projectRoot - Project root directory
   * @returns {Promise<number|null>} Threshold percentage or null when unset
   */
  async readConfiguredCoverageThreshold(projectRoot) {
    try {
      const configPath = `${projectRoot}/.workflow-config.yaml`;
      const content = await this.fileOps.readFile(configPath);
      const config = yaml.load(content);
      const threshold = config?.validation?.testing?.min_coverage;
      if (typeof threshold === 'number' && threshold > 0 && threshold <= 100) {
        return threshold;
      }
    } catch {
      // Config missing or unreadable — no explicit threshold configured
    }
    return null;
  }
  /**
   * Read the test framework name from `.workflow-config.yaml`.
   * Used as a fallback when `configManager` is not injected.
   *
   * @param {string} projectRoot - Project root directory
   * @returns {Promise<string|null>} Framework name (e.g. 'jest') or null
   */
  async _readTestFrameworkFromConfig(projectRoot) {
    try {
      const configPath = `${projectRoot}/.workflow-config.yaml`;
      const content = await this.fileOps.readFile(configPath);
      const config = yaml.load(content);
      return config?.tech_stack?.test_framework || null;
    } catch {
      return null;
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default Step8TestExecutor;
