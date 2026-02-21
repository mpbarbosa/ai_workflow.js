/**
 * Step 6: Test Review
 * @module steps/step_06_test_review
 * @version 2.0.0
 *
 * Reviews existing tests, analyzes coverage, and identifies gaps.
 */

import { STEP_KIND } from './step_contract.js';
import { logger } from '../core/logger.js';
import { FileOperations } from '../lib/file_operations.js';
import { Backlog } from '../lib/backlog.js';
import { TechStackDetector } from '../lib/tech_stack.js';
import path from 'path';
import { AiHelper } from '../lib/ai_helpers.js';
import { AiCache } from '../lib/ai_cache.js';
import { buildTestReviewPrompt } from '../lib/ai_prompt_builder.js';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Test file patterns by language
 */
export const TEST_PATTERNS = {
  javascript: ['**/*.test.js', '**/*.spec.js', '**/*.test.mjs', '**/*.spec.mjs'],
  typescript: ['**/*.test.ts', '**/*.spec.ts', '**/*.test.tsx', '**/*.spec.tsx'],
  python: ['**/test_*.py', '**/*_test.py'],
  go: ['**/*_test.go'],
  java: ['**/*Test.java', '**/*Tests.java'],
  ruby: ['**/*_spec.rb', '**/*_test.rb'],
  rust: ['tests/**/*.rs'],
  cpp: ['**/*_test.cpp', '**/*_test.cc'],
  bash: ['**/*.bats', '**/test_*.sh'],
};

/**
 * Coverage report paths by language/framework
 */
export const COVERAGE_PATHS = {
  javascript: ['coverage/lcov-report/index.html', 'coverage/index.html'],
  python: ['htmlcov/index.html', 'coverage/index.html'],
  java: ['target/site/jacoco/index.html'],
  go: ['coverage.html', 'coverage.out'],
  ruby: ['coverage/index.html'],
  rust: ['target/debug/coverage/index.html'],
};

/**
 * Issue types
 */
export const ISSUE_TYPE = {
  NO_TESTS: 'no_tests',
  LOW_COVERAGE: 'low_coverage',
  NO_COVERAGE_REPORT: 'no_coverage_report',
  MISSING_TESTS: 'missing_tests',
};

// ============================================================================
// PURE FUNCTIONS - Test File Discovery
// ============================================================================

/**
 * Get test patterns for a language
 * @pure
 * @param {string} language - Programming language
 * @returns {string[]} Array of glob patterns
 */
export function getTestPatterns(language) {
  const normalized = language.toLowerCase();
  return TEST_PATTERNS[normalized] || TEST_PATTERNS.javascript;
}

/**
 * Get coverage paths for a language
 * @pure
 * @param {string} language - Programming language
 * @returns {string[]} Array of coverage report paths
 */
export function getCoveragePaths(language) {
  const normalized = language.toLowerCase();
  return COVERAGE_PATHS[normalized] || COVERAGE_PATHS.javascript;
}

/**
 * Determine if file is a test file
 * @pure
 * @param {string} filePath - File path
 * @returns {boolean} True if file is a test
 */
export function isTestFile(filePath) {
  const normalized = filePath.toLowerCase();
  return (
    normalized.includes('.test.') ||
    normalized.includes('.spec.') ||
    normalized.includes('_test.') ||
    normalized.includes('test_') ||
    normalized.endsWith('test.go') ||
    normalized.endsWith('tests.java')
  );
}

/**
 * Categorize test files by directory
 * @pure
 * @param {string[]} testFiles - Array of test file paths
 * @returns {Object} Categorized tests
 */
export function categorizeTestFiles(testFiles) {
  const categories = {
    unit: [],
    integration: [],
    e2e: [],
    other: [],
  };

  testFiles.forEach((file) => {
    const normalized = file.toLowerCase();
    if (normalized.includes('/unit/') || normalized.includes('unit.test')) {
      categories.unit.push(file);
    } else if (normalized.includes('/integration/') || normalized.includes('integration.test')) {
      categories.integration.push(file);
    } else if (normalized.includes('/e2e/') || normalized.includes('e2e.test')) {
      categories.e2e.push(file);
    } else {
      categories.other.push(file);
    }
  });

  return categories;
}

// ============================================================================
// PURE FUNCTIONS - Coverage Analysis
// ============================================================================

/**
 * Parse coverage percentage from text
 * @pure
 * @param {string} content - File content or summary text
 * @returns {number|null} Coverage percentage or null
 */
export function parseCoveragePercentage(content) {
  // Look for patterns like "85.5%" or "Coverage: 85.5%"
  const patterns = [/(\d+\.?\d*)%/, /coverage:\s*(\d+\.?\d*)%/i, /statements:\s*(\d+\.?\d*)%/i];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      const value = parseFloat(match[1]);
      if (!isNaN(value) && value >= 0 && value <= 100) {
        return value;
      }
    }
  }

  return null;
}

/**
 * Determine coverage status
 * @pure
 * @param {number|null} coverage - Coverage percentage
 * @param {number} threshold - Minimum acceptable coverage
 * @returns {Object} Status object
 */
export function getCoverageStatus(coverage, threshold = 80) {
  if (coverage === null) {
    return {
      status: 'unknown',
      message: 'Coverage data not available',
      needsImprovement: true,
    };
  }

  if (coverage >= threshold) {
    return {
      status: 'good',
      message: `Coverage is ${coverage}% (meets ${threshold}% threshold)`,
      needsImprovement: false,
    };
  }

  const gap = threshold - coverage;
  return {
    status: 'low',
    message: `Coverage is ${coverage}% (${gap}% below ${threshold}% threshold)`,
    needsImprovement: true,
  };
}

// ============================================================================
// PURE FUNCTIONS - Test Statistics
// ============================================================================

/**
 * Calculate test statistics
 * @pure
 * @param {Object} params - Parameters
 * @param {string[]} params.testFiles - Test files
 * @param {Object} params.categories - Categorized tests
 * @param {number} params.totalLines - Total lines in test files
 * @returns {Object} Statistics
 */
export function calculateTestStatistics({ testFiles, categories, totalLines }) {
  return {
    totalTests: testFiles.length,
    unitTests: categories.unit.length,
    integrationTests: categories.integration.length,
    e2eTests: categories.e2e.length,
    otherTests: categories.other.length,
    totalLines,
    averageLinesPerTest: testFiles.length > 0 ? Math.round(totalLines / testFiles.length) : 0,
  };
}

// ============================================================================
// PURE FUNCTIONS - Reporting
// ============================================================================

/**
 * Format test review report
 * @pure
 * @param {Object} results - Review results
 * @returns {string} Formatted report
 */
export function formatTestReport(results) {
  const { testFiles = [], categories = {}, statistics = {}, coverage = {}, issues = [] } = results;

  let report = '# Test Review Report\n\n';

  // Summary
  report += '## Summary\n\n';
  report += `- **Total Test Files**: ${testFiles.length}\n`;
  report += `- **Total Lines**: ${statistics.totalLines || 0}\n`;
  report += `- **Coverage Reports Found**: ${coverage.found ? 'Yes' : 'No'}\n`;
  report += `- **Issues Identified**: ${issues.length}\n\n`;

  // Test breakdown
  if (testFiles.length > 0) {
    report += '## Test Distribution\n\n';
    report += `- **Unit Tests**: ${categories.unit?.length || 0}\n`;
    report += `- **Integration Tests**: ${categories.integration?.length || 0}\n`;
    report += `- **E2E Tests**: ${categories.e2e?.length || 0}\n`;
    report += `- **Other Tests**: ${categories.other?.length || 0}\n\n`;
  }

  // Coverage
  if (coverage.found) {
    report += '## Coverage Analysis\n\n';
    if (coverage.percentage !== null) {
      report += `**Coverage**: ${coverage.percentage}%\n\n`;
      const status = getCoverageStatus(coverage.percentage);
      report += `**Status**: ${status.message}\n\n`;
    }
    report += `**Report Location**: ${coverage.path}\n\n`;
  } else if (testFiles.length > 0) {
    report += '## ⚠️ Coverage Analysis\n\n';
    report += 'No coverage reports found. Consider generating coverage reports.\n\n';
  }

  // Issues
  if (issues.length > 0) {
    report += '## Issues Found\n\n';
    const grouped = {};
    issues.forEach((issue) => {
      if (!grouped[issue.type]) grouped[issue.type] = [];
      grouped[issue.type].push(issue);
    });

    Object.entries(grouped).forEach(([type, typeIssues]) => {
      report += `### ${type}\n\n`;
      typeIssues.slice(0, 10).forEach((issue) => {
        report += `- ${issue.message}\n`;
      });
      if (typeIssues.length > 10) {
        report += `\n... and ${typeIssues.length - 10} more\n`;
      }
      report += '\n';
    });
  }

  // Recommendations
  if (testFiles.length === 0) {
    report += '## 🚨 Critical\n\n';
    report += 'No test files found! Consider adding tests to improve code quality.\n\n';
  } else if (!coverage.found) {
    report += '## 💡 Recommendations\n\n';
    report += '1. Generate coverage reports to track test effectiveness\n';
    report += '2. Aim for at least 80% code coverage\n';
    report += '3. Focus on critical code paths first\n\n';
  }

  return report;
}

// ============================================================================
// STEP 6 ANALYZER - Integration
// ============================================================================

/**
 * Step 6 analyzer for test review
 */
export class Step6TestReviewer {
  static stepKind = STEP_KIND.CONTEXT;

  constructor(options = {}) {
    this.fileOps = options.fileOps || new FileOperations();
    this.backlog = options.backlog || new Backlog();
    this.techStack = options.techStack || new TechStackDetector();
    this.aiHelper = options.aiHelper || new AiHelper();
    this.aiCache = options.aiCache || new AiCache();
  }

  /**
   * Execute Step 6 test review.
   *
   * Accepts two calling conventions:
   *   • Orchestrator (CONTEXT step): execute({ projectRoot, categorizedFiles, … })
   *   • Tests / legacy:              execute('/path', options)
   *
   * When step_00's categorizedFiles.test is present in the context it is used
   * as the authoritative list of changed test files, avoiding a redundant
   * filesystem scan whose patterns may not match the project's conventions.
   *
   * @param {string|Object} contextOrRoot - Context object or legacy projectRoot string
   * @param {Object} _legacyOptions - Reserved (legacy calling convention)
   * @returns {Promise<Object>} Review result
   */
  async execute(contextOrRoot = {}, _legacyOptions = {}) {
    const isLegacy = typeof contextOrRoot === 'string';
    const projectRoot = isLegacy ? contextOrRoot : contextOrRoot.projectRoot || process.cwd();
    const ctx = isLegacy ? {} : contextOrRoot;

    try {
      logger.step('Step 6: Test Review');

      // Phase 1: Detect primary language (still needed for coverage-path lookup)
      const language = await this.detectLanguage(projectRoot);
      logger.info(`Detected language: ${language}`);

      // Phase 2: Resolve test file list.
      // Prefer step_00's authoritative change-detection result over a fresh
      // filesystem scan, which may use patterns that don't cover this project.
      let testFiles;
      if (Array.isArray(ctx.categorizedFiles?.test)) {
        testFiles = ctx.categorizedFiles.test;
        logger.info(`Found ${testFiles.length} test file(s) (from step_00 change detection)`);
      } else {
        testFiles = await this.discoverTestFiles(projectRoot, language);
        logger.info(`Found ${testFiles.length} test file(s)`);

        // Fallback: if no test files found for detected language, try bash patterns
        if (testFiles.length === 0 && language !== 'bash') {
          const bashFiles = await this.discoverTestFiles(projectRoot, 'bash');
          if (bashFiles.length > 0) {
            logger.info(`Fallback: found ${bashFiles.length} bash test file(s) instead`);
            testFiles = bashFiles;
          }
        }
      }

      if (testFiles.length === 0) {
        logger.warn('No test files found!');
        const report = formatTestReport({
          testFiles: [],
          issues: [{ type: ISSUE_TYPE.NO_TESTS, message: 'No test files found in project' }],
        });
        await this.backlog.saveStepSummary(6, 'Test Review', report);

        return {
          success: true,
          testFiles: [],
          issues: [{ type: ISSUE_TYPE.NO_TESTS, message: 'No test files found' }],
        };
      }

      // Phase 3: Categorize and analyze tests
      const categories = categorizeTestFiles(testFiles);
      const totalLines = await this.countTestLines(projectRoot, testFiles);
      const statistics = calculateTestStatistics({ testFiles, categories, totalLines });

      logger.info(
        `Unit: ${categories.unit.length}, Integration: ${categories.integration.length}, E2E: ${categories.e2e.length}`
      );

      // Phase 4: Check for coverage reports
      const coverage = await this.analyzeCoverage(projectRoot, language);
      if (coverage.found) {
        logger.info(`Coverage report found: ${coverage.path}`);
      } else {
        logger.warn('No coverage reports found');
      }

      // Phase 5: Identify issues
      const issues = this.identifyIssues({ testFiles, coverage, statistics });

      // Phase 6: Generate report
      const results = {
        testFiles,
        categories,
        statistics,
        coverage,
        issues,
      };

      const report = formatTestReport(results);
      await this.backlog.saveStepSummary(6, 'Test Review', report);

      // Phase 7: AI-powered test quality review
      const aiAvailable = await this.aiHelper.initialize();
      if (aiAvailable) {
        await this.aiCache.init();
        const prompt = buildTestReviewPrompt({ testFiles, framework: language });
        const cacheKey = `step_06|${language}|${testFiles.length}|${issues.length}`;
        await this.aiCache.withCache(prompt, cacheKey, () =>
          this.aiHelper.executeRequest(prompt, { persona: 'test_engineer' })
        );
      } else {
        logger.warn('AI helper not available - skipping AI test review');
      }

      if (issues.length === 0) {
        logger.success('Step 6 completed - test suite looks good');
      } else {
        logger.warn(`Step 6 completed - ${issues.length} issue(s) identified`);
      }

      return {
        success: true,
        ...results,
      };
    } catch (error) {
      logger.error(`Step 6 failed: ${error.message}`);
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
   * Discover test files
   * @param {string} projectRoot - Project root directory
   * @param {string} language - Programming language
   * @returns {Promise<string[]>} Test file paths
   */
  async discoverTestFiles(projectRoot, language) {
    const patterns = getTestPatterns(language);
    const exclude = ['node_modules', '.git', 'coverage', 'dist', 'build', '__pycache__', 'target'];

    const allFiles = [];
    for (const pattern of patterns) {
      try {
        const files = await this.fileOps.glob(pattern, {
          cwd: projectRoot,
          absolute: false,
          ignore: exclude.map((dir) => `**/${dir}/**`),
        });
        allFiles.push(...files);
      } catch {
        // Pattern didn't match, continue
      }
    }

    // Remove duplicates and filter
    const unique = [...new Set(allFiles)];
    return unique.filter((file) => isTestFile(file));
  }

  /**
   * Count lines in test files
   * @param {string} projectRoot - Project root directory
   * @param {string[]} testFiles - Test file paths
   * @returns {Promise<number>} Total lines
   */
  async countTestLines(projectRoot, testFiles) {
    let totalLines = 0;
    for (const file of testFiles) {
      try {
        const fullPath = path.join(projectRoot, file);
        const content = await this.fileOps.readFile(fullPath);
        totalLines += content.split('\n').length;
      } catch {
        // File read failed, skip
      }
    }
    return totalLines;
  }

  /**
   * Analyze coverage reports
   * @param {string} projectRoot - Project root directory
   * @param {string} language - Programming language
   * @returns {Promise<Object>} Coverage information
   */
  async analyzeCoverage(projectRoot, language) {
    const paths = getCoveragePaths(language);

    for (const relativePath of paths) {
      try {
        const fullPath = path.join(projectRoot, relativePath);
        const exists = await this.fileOps.fileExists(fullPath);
        if (exists) {
          // Try to extract coverage percentage
          const content = await this.fileOps.readFile(fullPath);
          const percentage = parseCoveragePercentage(content);

          return {
            found: true,
            path: relativePath,
            percentage,
          };
        }
      } catch {
        // File doesn't exist or can't be read
      }
    }

    return { found: false, path: null, percentage: null };
  }

  /**
   * Identify issues
   * @param {Object} params - Parameters
   * @returns {Array} Array of issues
   */
  identifyIssues({ testFiles, coverage, statistics }) {
    const issues = [];

    // No tests
    if (testFiles.length === 0) {
      issues.push({
        type: ISSUE_TYPE.NO_TESTS,
        message: 'No test files found in project',
      });
    }

    // No coverage report
    if (testFiles.length > 0 && !coverage.found) {
      issues.push({
        type: ISSUE_TYPE.NO_COVERAGE_REPORT,
        message: 'No coverage reports found - consider generating coverage data',
      });
    }

    // Low coverage
    if (coverage.percentage !== null) {
      const status = getCoverageStatus(coverage.percentage);
      if (status.needsImprovement) {
        issues.push({
          type: ISSUE_TYPE.LOW_COVERAGE,
          message: status.message,
        });
      }
    }

    // Missing test types
    if (statistics.unitTests === 0 && testFiles.length > 0) {
      issues.push({
        type: ISSUE_TYPE.MISSING_TESTS,
        message: 'No unit tests found - consider adding unit tests',
      });
    }

    return issues;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default Step6TestReviewer;
