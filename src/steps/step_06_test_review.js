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
import {
  detectAndLogPrimaryLanguage,
  detectPrimaryLanguage,
  initializeStepAiContext,
} from './step_execution_helpers.js';
import {
  buildTestReviewPrompt,
  AI_HELPERS_PATH,
  AI_PROJECT_KINDS_PATH,
  buildYamlStepPrompt,
  buildProjectKindPrompt,
} from '../lib/ai_prompt_builder.js';
import yaml from 'js-yaml';
import { Step10PartitionCache } from '../lib/step10_partition_cache.js';

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
 * Get the default coverage command for a language.
 * @pure
 * @param {string} language - Programming language
 * @returns {string} Coverage command
 */
export function getCoverageCommand(language) {
  const normalized = language.toLowerCase();
  const coverageCommands = {
    javascript: 'npm run test:coverage',
    typescript: 'npm run test:coverage',
    python: 'pytest --cov',
    go: 'go test -cover ./...',
    ruby: 'rspec --format progress',
    rust: 'cargo tarpaulin',
  };
  return coverageCommands[normalized] || 'npm run coverage';
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

/**
 * Count test files that live under dedicated test directories such as `test/`
 * or `__tests__/`, regardless of whether those directories are at the repo root
 * or nested under source folders.
 *
 * @pure
 * @param {string[]} testFiles - Array of test file paths
 * @returns {number} Count of files in dedicated test directories
 */
export function countDedicatedTestDirectoryFiles(testFiles) {
  return testFiles.filter((file) => /(?:^|\/)(?:test|__tests__)\//.test(file)).length;
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
    this.aiHelper = options.aiHelper || new AiHelper({ promptsDir: options.promptsDir || null });
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
  async execute(contextOrRoot = {}, options = {}) {
    const isLegacy = typeof contextOrRoot === 'string';
    const projectRoot = isLegacy ? contextOrRoot : contextOrRoot.projectRoot || process.cwd();
    const ctx = isLegacy ? {} : contextOrRoot;

    try {
      logger.step('Step 6: Test Review');

      // Phase 1: Detect primary language (still needed for coverage-path lookup)
      const language = await detectAndLogPrimaryLanguage(this.techStack, projectRoot);

      // Phase 2: Resolve test file list.
      // Always run a full filesystem scan so that unmodified test files are
      // included. The step_00 change-detection list (ctx.categorizedFiles.test)
      // only contains files touched in the current workflow run; we merge it in
      // to capture any files the glob patterns might miss.
      let testFiles = await this.discoverTestFiles(projectRoot, language);

      // Fallback: if no test files found for detected language, try bash patterns
      if (testFiles.length === 0 && language !== 'bash') {
        const bashFiles = await this.discoverTestFiles(projectRoot, 'bash');
        if (bashFiles.length > 0) {
          logger.info(`Fallback: found ${bashFiles.length} bash test file(s) instead`);
          testFiles = bashFiles;
        }
      }

      // Merge in any changed test files from step_00 not caught by glob scan
      if (Array.isArray(ctx.categorizedFiles?.test) && ctx.categorizedFiles.test.length > 0) {
        const merged = new Set([...testFiles, ...ctx.categorizedFiles.test]);
        testFiles = [...merged];
      }

      logger.info(`Found ${testFiles.length} test file(s)`);

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
      let reviewCoverage = null;

      // Phase 7: AI-powered test quality review (partition + rotate strategy)
      // Mirrors step 10: reviews one partition of test files per run, rotates
      // to the next partition on success, keeping prompts within model limits.
      try {
        const aiAvailable = await initializeStepAiContext({
          aiHelper: this.aiHelper,
          aiCache: this.aiCache,
        });
        if (aiAvailable) {
          const uniqueTestFiles = [
            ...new Set(
              testFiles.map((f) => (path.isAbsolute(f) ? path.relative(projectRoot, f) : f))
            ),
          ];
          const totalDedicatedDirTests = countDedicatedTestDirectoryFiles(uniqueTestFiles);
          const totalColocatedTests = uniqueTestFiles.length - totalDedicatedDirTests;

          const partitionCache = new Step10PartitionCache({
            cacheDir: `${projectRoot}/.ai_workflow/.step_cache`,
            cacheFilename: 'step_06_partition.json',
            qualityStateFilename: 'step_06_quality.json',
            label: 'Step06Partition',
          });

          const activeCandidates = await partitionCache.getActiveCandidates(
            uniqueTestFiles,
            options.modifiedFiles ?? []
          );
          const partition = await partitionCache.getCurrentPartition(activeCandidates);
          reviewCoverage =
            partition.total > 1
              ? `AI review covered partition ${partition.index + 1}/${partition.total} (${partition.files.length} files)`
              : `AI review covered ${partition.files.length} file(s) in the only partition`;

          logger.info(
            `Reviewing partition ${partition.index + 1}/${partition.total} (${partition.files.length} files): ${partition.label}`
          );

          // Read file contents only for the current partition
          const fileContents = {};
          await Promise.all(
            partition.files.map(async (relPath) => {
              try {
                const abs = relPath.startsWith('/') ? relPath : `${projectRoot}/${relPath}`;
                let content = await this.fileOps.readFile(abs);
                if (content.length > 5000) content = content.slice(0, 5000) + '\n... (truncated)';
                fileContents[relPath] = content;
              } catch {
                /* skip unreadable */
              }
            })
          );

          // Slice partition into small batches (mirrors step 10 AI_FILES_PER_SLICE = 5)
          const FILES_PER_SLICE = 5;
          const slices = [];
          for (let i = 0; i < partition.files.length; i += FILES_PER_SLICE) {
            slices.push(partition.files.slice(i, i + FILES_PER_SLICE));
          }
          if (slices.length === 0) slices.push([]);

          // Load YAML config once, shared across all slices
          let sharedParsedYaml = null;
          let sharedRoleOverride = '';
          const testCmdMap = {
            javascript: 'npm test',
            typescript: 'npm test',
            python: 'pytest',
            go: 'go test ./...',
            ruby: 'rspec',
            rust: 'cargo test',
          };
          const testFrameworkMap = {
            javascript: 'jest',
            typescript: 'jest',
            python: 'pytest',
            go: 'go test',
            ruby: 'rspec',
            rust: 'cargo test',
            bash: 'bats',
          };
          const testFramework =
            ctx.config?.tech_stack?.test_framework ??
            ctx.config?.tech_stack?.test_runner ??
            ctx.techStack?.testRunner ??
            testFrameworkMap[language] ??
            language;
          const configTestCommand =
            ctx.config?.tech_stack?.test_command ?? testCmdMap[language] ?? 'npm test';
          const configCovCommand = getCoverageCommand(language);
          try {
            const yamlContent = await this.fileOps.readFile(AI_HELPERS_PATH);
            sharedParsedYaml = yaml.load(yamlContent);
            try {
              const pkYaml = await this.fileOps.readFile(AI_PROJECT_KINDS_PATH);
              const parsedPk = yaml.load(pkYaml);
              const pk = buildProjectKindPrompt(
                parsedPk,
                options?.projectKind ?? 'default',
                'test_engineer'
              );
              if (pk?.role) sharedRoleOverride = pk.role;
            } catch {
              /* optional */
            }
          } catch {
            /* fallback to hardcoded builder */
          }

          // Run all slices in parallel — each is a self-contained review of 5 files
          const aiSectionResults = await Promise.all(
            slices.map(async (sliceFiles, si) => {
              const sliceContents = {};
              for (const f of sliceFiles) {
                if (Object.prototype.hasOwnProperty.call(fileContents, f)) {
                  sliceContents[f] = fileContents[f];
                }
              }
              const fileContentSections = sliceFiles.map((rel) => {
                const content = sliceContents[rel] ?? '(unavailable)';
                return `### ${rel}\n\`\`\`${language}\n${content}\n\`\`\``;
              });
              const testFileContents = fileContentSections.join('\n\n');

              let prompt;
              if (sharedParsedYaml) {
                try {
                  prompt = buildYamlStepPrompt(sharedParsedYaml, 'step6_test_review_prompt', {
                    project_name: path.basename(projectRoot),
                    project_description:
                      ctx.projectDescription ?? options?.projectDescription ?? 'N/A',
                    primary_language: language,
                    change_scope: options?.scope || 'N/A',
                    modified_count: String((options?.modifiedFiles ?? []).length),
                    test_framework: testFramework,
                    test_env: configTestCommand,
                    test_command: configTestCommand,
                    coverage_command: configCovCommand,
                    test_count: String(testFiles.length),
                    scoped_test_count: String(sliceFiles.length),
                    tests_in_tests_dir: String(totalDedicatedDirTests),
                    tests_colocated: String(totalColocatedTests),
                    test_files: sliceFiles.join(', '),
                    test_file_contents: testFileContents,
                  });
                  if (prompt && sharedRoleOverride) {
                    prompt = `[Project-Kind Role: ${sharedRoleOverride}]\n\n${prompt}`;
                  }
                } catch {
                  /* fallback */
                }
              }
              if (!prompt) {
                prompt = buildTestReviewPrompt({
                  testFiles: sliceFiles,
                  framework: language,
                  testFramework,
                  testCommand: configTestCommand,
                  coverageCommand: configCovCommand,
                });
              }

              const fileHashEntries = Object.entries(sliceContents).map(([k, v]) => `${k}:${v}`);
              const aiResult = await this.aiCache.withFileChangeGuard(
                `step_06_p${partition.index}_s${si}`,
                fileHashEntries,
                () => this.aiHelper.executeRequest(prompt, { persona: 'test_engineer' })
              );
              return aiResult?.content ?? '';
            })
          );

          const aiSections = aiSectionResults.filter((c) => c);
          const aiContent = aiSections.join('\n\n---\n\n');
          if (aiContent) {
            const partitionHeader = `## AI Test Review — Partition ${partition.index + 1}/${partition.total}: \`${partition.label}\`\n`;
            const coverageNote = reviewCoverage ? `> AI coverage: ${reviewCoverage}.\n\n` : '';
            const enrichedReport = `${report}\n\n---\n\n${coverageNote}${partitionHeader}\n${aiContent}`;
            await this.backlog.saveStepSummary(6, 'Test Review', enrichedReport);
            await partitionCache.advance(activeCandidates);
          }
        } else {
          logger.warn('AI helper not available - skipping AI test review');
        }
      } catch (aiError) {
        logger.warn(`AI test review skipped: ${aiError.message}`);
      }

      if (issues.length === 0) {
        logger.success(
          reviewCoverage
            ? `Step 6 completed - deterministic checks passed; ${reviewCoverage}`
            : 'Step 6 completed - test suite looks good'
        );
      } else {
        logger.warn(
          reviewCoverage
            ? `Step 6 completed - ${issues.length} issue(s) identified; ${reviewCoverage}`
            : `Step 6 completed - ${issues.length} issue(s) identified`
        );
      }

      return {
        success: true,
        ...results,
        reviewCoverage,
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
    return detectPrimaryLanguage(this.techStack, projectRoot);
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
