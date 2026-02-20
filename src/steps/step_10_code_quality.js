/**
 * Step 10: Code Quality Analysis
 * @module steps/step_10_code_quality
 * @version 2.0.0
 *
 * Analyzes code quality using linters and static analysis tools.
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
 * Linter commands by language
 */
export const LINTER_COMMANDS = {
  javascript: 'npm run lint',
  typescript: 'npm run lint',
  python: 'flake8 .',
  go: 'golint ./...',
  java: 'mvn checkstyle:check',
  ruby: 'rubocop',
  rust: 'cargo clippy',
};

/**
 * Source file extensions by language
 */
export const SOURCE_EXTENSIONS = {
  javascript: ['.js', '.jsx', '.mjs', '.cjs'],
  typescript: ['.ts', '.tsx'],
  python: ['.py'],
  go: ['.go'],
  java: ['.java'],
  ruby: ['.rb'],
  rust: ['.rs'],
  bash: ['.sh', '.bash'],
};

/**
 * Quality metrics thresholds
 */
export const QUALITY_THRESHOLDS = {
  fileCount: {
    small: 10,
    medium: 50,
    large: 100,
  },
  issueRate: {
    excellent: 0,
    good: 5,
    moderate: 20,
    poor: 50,
  },
};

// ============================================================================
// PURE FUNCTIONS - Linter Detection
// ============================================================================

/**
 * Get linter command for a language
 * @pure
 * @param {string} language - Programming language
 * @returns {string|null} Linter command
 */
export function getLinterCommand(language) {
  const normalized = language.toLowerCase();
  return LINTER_COMMANDS[normalized] || null;
}

/**
 * Get source file extensions for a language
 * @pure
 * @param {string} language - Programming language
 * @returns {string[]} File extensions
 */
export function getSourceExtensions(language) {
  const normalized = language.toLowerCase();
  return SOURCE_EXTENSIONS[normalized] || SOURCE_EXTENSIONS.javascript;
}

/**
 * Check if file is a source file for the language
 * @pure
 * @param {string} filePath - File path
 * @param {string} language - Programming language
 * @returns {boolean} True if source file
 */
export function isSourceFile(filePath, language) {
  const extensions = getSourceExtensions(language);
  return extensions.some((ext) => filePath.endsWith(ext));
}

/**
 * Extract linter command from package.json
 * @pure
 * @param {Object} packageJson - Parsed package.json
 * @returns {string|null} Linter command
 */
export function extractLinterCommand(packageJson) {
  const scripts = packageJson?.scripts || {};

  // Check for common lint script names
  if (scripts.lint) return 'npm run lint';
  if (scripts.eslint) return 'npm run eslint';
  if (scripts['lint:check']) return 'npm run lint:check';

  return null;
}

// ============================================================================
// PURE FUNCTIONS - Linter Output Parsing
// ============================================================================

/**
 * Parse ESLint output
 * @pure
 * @param {string} output - ESLint output
 * @returns {Object} Parsed results
 */
export function parseEslintOutput(output) {
  const results = {
    totalIssues: 0,
    errors: 0,
    warnings: 0,
    files: 0,
  };

  // Look for summary line: "✖ 10 problems (5 errors, 5 warnings)"
  const problemMatch = output.match(
    /✖\s+(\d+)\s+problem[s]?\s+\((\d+)\s+error[s]?,\s+(\d+)\s+warning[s]?\)/
  );
  if (problemMatch) {
    results.totalIssues = parseInt(problemMatch[1], 10);
    results.errors = parseInt(problemMatch[2], 10);
    results.warnings = parseInt(problemMatch[3], 10);
  }

  // Count affected files
  const fileMatches = output.match(/\n\s*\//g);
  if (fileMatches) {
    results.files = fileMatches.length;
  }

  return results;
}

/**
 * Parse Flake8 output (Python)
 * @pure
 * @param {string} output - Flake8 output
 * @returns {Object} Parsed results
 */
export function parseFlake8Output(output) {
  const lines = output.split('\n').filter((line) => line.trim());

  const results = {
    totalIssues: lines.length,
    errors: 0,
    warnings: lines.length,
    files: 0,
  };

  // Count unique files
  const files = new Set();
  lines.forEach((line) => {
    const fileMatch = line.match(/^([^:]+):/);
    if (fileMatch) {
      files.add(fileMatch[1]);
    }
  });

  results.files = files.size;

  return results;
}

/**
 * Parse linter output based on language
 * @pure
 * @param {string} output - Linter output
 * @param {string} language - Programming language
 * @returns {Object} Parsed results
 */
export function parseLinterOutput(output, language) {
  const normalized = language.toLowerCase();

  if (normalized === 'javascript' || normalized === 'typescript') {
    return parseEslintOutput(output);
  } else if (normalized === 'python') {
    return parseFlake8Output(output);
  }

  // Generic fallback - count lines
  const lines = output.split('\n').filter((line) => line.trim());
  return {
    totalIssues: lines.length,
    errors: 0,
    warnings: lines.length,
    files: 0,
  };
}

/**
 * Calculate issue rate (issues per file)
 * @pure
 * @param {number} totalIssues - Total issues
 * @param {number} fileCount - Number of files
 * @returns {number} Issue rate
 */
export function calculateIssueRate(totalIssues, fileCount) {
  if (fileCount === 0) return 0;
  return Math.round((totalIssues / fileCount) * 10) / 10; // Round to 1 decimal
}

/**
 * Determine quality rating
 * @pure
 * @param {number} issueRate - Issues per file
 * @returns {string} Quality rating
 */
export function determineQualityRating(issueRate) {
  if (issueRate === 0) return 'excellent';
  if (issueRate <= 5) return 'good';
  if (issueRate <= 20) return 'moderate';
  return 'poor';
}

// ============================================================================
// PURE FUNCTIONS - Reporting
// ============================================================================

/**
 * Format code quality report
 * @pure
 * @param {Object} results - Quality results
 * @returns {string} Formatted report
 */
export function formatQualityReport(results) {
  const {
    language = 'javascript',
    sourceFileCount = 0,
    linterResults = null,
    issueRate = 0,
    qualityRating = 'unknown',
    skipped = false,
    linterCommand = null,
  } = results;

  let report = '# Code Quality Report\n\n';

  // Summary
  report += '## Summary\n\n';
  report += `- **Language**: ${language}\n`;
  report += `- **Source Files**: ${sourceFileCount}\n`;

  if (skipped) {
    report += `- **Status**: ⚠️ Skipped (no linter configured)\n\n`;
    return report;
  }

  if (linterCommand) {
    report += `- **Linter**: \`${linterCommand}\`\n`;
  }

  // Linter Results
  if (linterResults) {
    report += '\n## Linter Results\n\n';

    if (linterResults.totalIssues === 0) {
      report += '✅ **No issues found!** Code quality is excellent.\n\n';
    } else {
      report += `- **Total Issues**: ${linterResults.totalIssues}\n`;
      if (linterResults.errors > 0) {
        report += `- **Errors**: ${linterResults.errors}\n`;
      }
      if (linterResults.warnings > 0) {
        report += `- **Warnings**: ${linterResults.warnings}\n`;
      }
      if (linterResults.files > 0) {
        report += `- **Files Affected**: ${linterResults.files}\n`;
      }
      report += '\n';
    }
  }

  // Quality Metrics
  report += '## Quality Metrics\n\n';
  report += `- **Issue Rate**: ${issueRate} issues per file\n`;

  // Quality rating badge
  if (qualityRating === 'excellent') {
    report += '- **Rating**: ✅ Excellent\n\n';
  } else if (qualityRating === 'good') {
    report += '- **Rating**: 👍 Good\n\n';
  } else if (qualityRating === 'moderate') {
    report += '- **Rating**: ⚠️ Moderate\n\n';
  } else if (qualityRating === 'poor') {
    report += '- **Rating**: 🚨 Poor\n\n';
  }

  // Recommendations
  if (linterResults && linterResults.totalIssues > 0) {
    report += '## 💡 Recommendations\n\n';

    if (linterResults.errors > 0) {
      report += '1. **Fix errors first** - they indicate critical issues\n';
    }

    report += '2. Review and fix linter warnings systematically\n';
    report += '3. Configure auto-fix on save in your editor\n';
    report += '4. Add linting to CI/CD pipeline\n';

    if (qualityRating === 'poor') {
      report += '5. Consider refactoring files with high issue counts\n';
      report += '6. Document coding standards for the team\n';
    }

    report += '\n';
  }

  return report;
}

// ============================================================================
// STEP 10 ANALYZER - Integration
// ============================================================================

/**
 * Step 10 analyzer for code quality
 */
export class Step10CodeQualityAnalyzer {
  static stepKind = STEP_KIND.PROJECT;

  constructor(options = {}) {
    this.executor = options.executor || executor;
    this.fileOps = options.fileOps || new FileOperations();
    this.backlog = options.backlog || new Backlog();
    this.techStack = options.techStack || new TechStackDetector();
  }

  /**
   * Execute Step 10 code quality analysis
   * @param {string} projectRoot - Project root directory
   * @param {Object} _options - Execution options (reserved)
   * @returns {Promise<Object>} Analysis result
   */
  async execute(projectRoot, _options = {}) {
    try {
      logger.step('Step 10: Code Quality Analysis');

      // Phase 1: Detect language
      const language = await this.detectLanguage(projectRoot);
      logger.info(`Detected language: ${language}`);

      // Phase 2: Count source files
      let effectiveLanguage = language;
      let sourceFileCount = await this.countSourceFiles(projectRoot, language);
      logger.info(`Found ${sourceFileCount} source file(s)`);

      // Fallback: if 0 source files for detected language, try bash/shell
      if (sourceFileCount === 0 && language !== 'bash') {
        const bashCount = await this.countSourceFiles(projectRoot, 'bash');
        if (bashCount > 0) {
          logger.info(`Fallback: found ${bashCount} bash source file(s) instead`);
          effectiveLanguage = 'bash';
          sourceFileCount = bashCount;
        }
      }

      // Phase 3: Determine linter command
      const linterCommand = await this.determineLinterCommand(projectRoot, effectiveLanguage);

      if (!linterCommand) {
        logger.warn('No linter configured');

        const report = formatQualityReport({
          language: effectiveLanguage,
          sourceFileCount,
          skipped: true,
        });

        await this.backlog.saveStepSummary(10, 'Code Quality', report);

        return {
          success: true,
          language: effectiveLanguage,
          sourceFileCount,
          skipped: true,
        };
      }

      logger.info(`Linter command: ${linterCommand}`);

      // Phase 4: Run linter
      const linterResults = await this.runLinter(projectRoot, linterCommand, effectiveLanguage);

      if (linterResults.totalIssues > 0) {
        logger.warn(`Found ${linterResults.totalIssues} code quality issue(s)`);
      } else {
        logger.success('No code quality issues found');
      }

      // Phase 5: Calculate metrics
      const issueRate = calculateIssueRate(linterResults.totalIssues, sourceFileCount);
      const qualityRating = determineQualityRating(issueRate);

      logger.info(`Quality rating: ${qualityRating} (${issueRate} issues/file)`);

      // Phase 6: Generate report
      const results = {
        language: effectiveLanguage,
        sourceFileCount,
        linterResults,
        issueRate,
        qualityRating,
        linterCommand,
        skipped: false,
      };

      const report = formatQualityReport(results);
      await this.backlog.saveStepSummary(10, 'Code Quality', report);

      const hasErrors = linterResults.errors > 0;

      if (hasErrors) {
        logger.warn('Step 10 completed with errors');
      } else {
        logger.success('Step 10 completed - code quality validated!');
      }

      return {
        success: !hasErrors,
        ...results,
      };
    } catch (error) {
      logger.error(`Step 10 failed: ${error.message}`);
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
   * Count source files
   * @param {string} projectRoot - Project root directory
   * @param {string} language - Programming language
   * @returns {Promise<number>} Source file count
   */
  async countSourceFiles(projectRoot, language) {
    const extensions = getSourceExtensions(language);

    try {
      // Use glob to find source files
      const patterns = extensions.map((ext) => `**/*${ext}`);
      let allFiles = [];

      for (const pattern of patterns) {
        try {
          const files = await this.fileOps.glob(pattern, {
            cwd: projectRoot,
            ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**'],
          });
          allFiles = allFiles.concat(files);
        } catch {
          // Pattern didn't match
        }
      }

      // Remove duplicates
      return new Set(allFiles).size;
    } catch {
      return 0;
    }
  }

  /**
   * Determine linter command
   * @param {string} projectRoot - Project root directory
   * @param {string} language - Programming language
   * @returns {Promise<string|null>} Linter command
   */
  async determineLinterCommand(projectRoot, language) {
    // For Node.js projects, check package.json
    if (language === 'javascript' || language === 'typescript') {
      try {
        const pkgPath = `${projectRoot}/package.json`;
        const pkgContent = await this.fileOps.readFile(pkgPath);
        const packageJson = JSON.parse(pkgContent);

        const cmd = extractLinterCommand(packageJson);
        if (cmd) return cmd;
      } catch {
        // No package.json
      }
    }

    // Use default command for language
    return getLinterCommand(language);
  }

  /**
   * Run linter
   * @param {string} projectRoot - Project root directory
   * @param {string} linterCommand - Linter command
   * @param {string} language - Programming language
   * @returns {Promise<Object>} Linter results
   */
  async runLinter(projectRoot, linterCommand, language) {
    try {
      const result = await this.executor.execute(linterCommand, {
        cwd: projectRoot,
        shell: true,
        timeout: 120000, // 2 minutes
      });

      // Parse output
      const output = result.stdout + result.stderr;
      return parseLinterOutput(output, language);
    } catch (error) {
      // Linter might exit with non-zero code when issues found
      // Try to parse the output anyway
      try {
        const output = (error.stdout || '') + (error.stderr || '');
        return parseLinterOutput(output, language);
      } catch {
        // Could not parse linter output
        return {
          totalIssues: 0,
          errors: 0,
          warnings: 0,
          files: 0,
        };
      }
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default Step10CodeQualityAnalyzer;
