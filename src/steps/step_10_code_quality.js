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
import { AiHelper } from '../lib/ai_helpers.js';
import { AiCache } from '../lib/ai_cache.js';
import { AnalysisCache } from '../lib/analysis_cache.js';
import { buildCodeQualityPrompt } from '../lib/ai_prompt_builder.js';

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
  bash: 'shellcheck',
  json: 'npx jsonlint --quiet',
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
  json: ['.json'],
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
 * Get all languages detected in a project from a tech stack result.
 * Always includes 'bash' when .sh files exist; always includes 'json' when
 * .json files exist (tech_stack.js filters those out of `languages[]`).
 * @pure
 * @param {Object} techStackResult - Result from TechStackDetector.detectAll()
 * @param {string[]} [extraLanguages=[]] - Additional languages to include (e.g. ['json','bash'])
 * @returns {string[]} All detected language names (lower-case, de-duplicated)
 */
export function getAllDetectedLanguages(techStackResult, extraLanguages = []) {
  const fromStack = (techStackResult?.languages || []).map((l) => l.toLowerCase());
  const extra = extraLanguages.map((l) => l.toLowerCase());
  return [...new Set([...fromStack, ...extra])];
}

/**
 * Build a map of { language → linterCommand } for the given languages.
 * Config-provided commands take precedence over LINTER_COMMANDS defaults.
 * Languages without any command are omitted.
 * @pure
 * @param {string[]} languages - Detected language names
 * @param {Object} [configLintCommands={}] - Map from .workflow-config.yaml tech_stack.lint_commands
 * @returns {Object} { language: command } for each language that has a linter
 */
export function getLanguageLinterCommands(languages, configLintCommands = {}) {
  const result = {};
  for (const lang of languages) {
    const normalized = lang.toLowerCase();
    const cmd = configLintCommands[normalized] || getLinterCommand(normalized);
    if (cmd) {
      result[normalized] = cmd;
    }
  }
  return result;
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
 * @param {Object} results - Quality results (single-language or multi-language)
 * @returns {string} Formatted report
 */
export function formatQualityReport(results) {
  // Multi-language mode: results contains perLanguageResults array
  if (Array.isArray(results.perLanguageResults)) {
    return formatMultiLanguageQualityReport(results.perLanguageResults, results.aggregateTotals);
  }

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

/**
 * Format a multi-language code quality report
 * @pure
 * @param {Object[]} perLanguageResults - Array of per-language result objects
 * @param {Object} aggregateTotals - { totalIssues, errors, warnings, fileCount }
 * @returns {string} Formatted report
 */
export function formatMultiLanguageQualityReport(perLanguageResults, aggregateTotals = {}) {
  let report = '# Code Quality Report\n\n';

  // Overall summary
  const { totalIssues = 0, errors = 0, warnings = 0, fileCount = 0 } = aggregateTotals;
  report += '## Summary\n\n';
  report += `- **Languages analyzed**: ${perLanguageResults.length}\n`;
  report += `- **Total Source Files**: ${fileCount}\n`;
  report += `- **Total Issues**: ${totalIssues}\n`;
  if (errors > 0) report += `- **Total Errors**: ${errors}\n`;
  if (warnings > 0) report += `- **Total Warnings**: ${warnings}\n`;
  report += '\n';

  // Per-language sections
  for (const langResult of perLanguageResults) {
    const {
      language,
      sourceFileCount: count = 0,
      linterCommand,
      linterResults,
      issueRate = 0,
      qualityRating = 'unknown',
      skipped = false,
    } = langResult;

    report += `## ${language.charAt(0).toUpperCase() + language.slice(1)}\n\n`;
    report += `- **Source Files**: ${count}\n`;

    if (skipped) {
      report += `- **Status**: ⚠️ Skipped (no linter configured)\n\n`;
      continue;
    }

    if (linterCommand) {
      report += `- **Linter**: \`${linterCommand}\`\n`;
    }

    if (linterResults) {
      if (linterResults.totalIssues === 0) {
        report += '- **Result**: ✅ No issues found\n';
      } else {
        report += `- **Issues**: ${linterResults.totalIssues}`;
        if (linterResults.errors > 0)
          report += ` (${linterResults.errors} errors, ${linterResults.warnings} warnings)`;
        report += '\n';
      }
    }

    report += `- **Issue Rate**: ${issueRate} issues/file\n`;

    if (qualityRating === 'excellent') report += '- **Rating**: ✅ Excellent\n';
    else if (qualityRating === 'good') report += '- **Rating**: 👍 Good\n';
    else if (qualityRating === 'moderate') report += '- **Rating**: ⚠️ Moderate\n';
    else if (qualityRating === 'poor') report += '- **Rating**: 🚨 Poor\n';

    report += '\n';
  }

  // Recommendations if any issues
  if (totalIssues > 0) {
    report += '## 💡 Recommendations\n\n';
    if (errors > 0) report += '1. **Fix errors first** - they indicate critical issues\n';
    report += '2. Review and fix linter warnings systematically\n';
    report += '3. Configure auto-fix on save in your editor\n';
    report += '4. Add linting to CI/CD pipeline\n\n';
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
    this.aiHelper = options.aiHelper || new AiHelper();
    this.aiCache = options.aiCache || new AiCache();
    this.analysisCache = options.analysisCache || new AnalysisCache();
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

      // Phase 1: Detect all languages present in the project
      const techStackResult = await this.detectTechStack(projectRoot);
      const detectedLanguages = getAllDetectedLanguages(techStackResult, ['bash', 'json']);
      logger.info(`Detected languages: ${detectedLanguages.join(', ') || 'none'}`);

      // Phase 2: Load lint_commands from .workflow-config.yaml (if present)
      const configLintCommands = await this.readConfigLintCommands(projectRoot);

      // Phase 3: Build per-language linter command map
      const linterCommandMap = getLanguageLinterCommands(detectedLanguages, configLintCommands);

      if (Object.keys(linterCommandMap).length === 0) {
        logger.warn('No linter configured');

        // Fall back to single-language report for backward compat
        const primaryLanguage =
          techStackResult.primary_language || detectedLanguages[0] || 'javascript';
        const sourceFileCount = await this.countSourceFiles(projectRoot, primaryLanguage);
        logger.info(`Found ${sourceFileCount} source file(s)`);

        const report = formatQualityReport({
          language: primaryLanguage,
          sourceFileCount,
          skipped: true,
        });
        await this.backlog.saveStepSummary(10, 'Code Quality', report);

        return { success: true, language: primaryLanguage, sourceFileCount, skipped: true };
      }

      // Phase 4: Run each linter and collect per-language results
      const perLanguageResults = [];
      for (const [language, linterCommand] of Object.entries(linterCommandMap)) {
        const sourceFileCount = await this.countSourceFiles(projectRoot, language);

        if (sourceFileCount === 0) {
          logger.info(`${language}: no source files found, skipping linter`);
          continue;
        }

        logger.info(`${language}: ${sourceFileCount} source file(s), linter: ${linterCommand}`);

        const linterCacheInputs = { projectRoot, language, command: linterCommand };
        let linterResults = this.analysisCache.get('linter', linterCacheInputs);
        if (linterResults) {
          logger.info(`[AnalysisCache] ${language} linter results loaded from cache`);
        } else {
          linterResults = await this.runLinter(projectRoot, linterCommand, language);
          this.analysisCache.set('linter', linterCacheInputs, linterResults);
        }

        if (linterResults.totalIssues > 0) {
          logger.warn(`${language}: ${linterResults.totalIssues} issue(s)`);
        } else {
          logger.success(`${language}: no issues`);
        }

        const issueRate = calculateIssueRate(linterResults.totalIssues, sourceFileCount);
        const qualityRating = determineQualityRating(issueRate);

        perLanguageResults.push({
          language,
          sourceFileCount,
          linterCommand,
          linterResults,
          issueRate,
          qualityRating,
          skipped: false,
        });
      }

      // Phase 5: Handle case where all languages had 0 source files
      if (perLanguageResults.length === 0) {
        logger.warn('No source files found for any configured language');
        const primaryLanguage =
          techStackResult.primary_language || detectedLanguages[0] || 'javascript';
        const report = formatQualityReport({
          language: primaryLanguage,
          sourceFileCount: 0,
          skipped: true,
        });
        await this.backlog.saveStepSummary(10, 'Code Quality', report);
        return { success: true, language: primaryLanguage, sourceFileCount: 0, skipped: true };
      }

      // Phase 6: Compute aggregate totals
      const aggregateTotals = perLanguageResults.reduce(
        (acc, r) => ({
          totalIssues: acc.totalIssues + (r.linterResults?.totalIssues || 0),
          errors: acc.errors + (r.linterResults?.errors || 0),
          warnings: acc.warnings + (r.linterResults?.warnings || 0),
          fileCount: acc.fileCount + r.sourceFileCount,
        }),
        { totalIssues: 0, errors: 0, warnings: 0, fileCount: 0 }
      );

      logger.info(
        `Total: ${aggregateTotals.totalIssues} issue(s) across ${perLanguageResults.length} language(s)`
      );

      // Phase 7: Generate multi-language report
      const report = formatQualityReport({ perLanguageResults, aggregateTotals });
      await this.backlog.saveStepSummary(10, 'Code Quality', report);

      // Phase 8: AI-powered code quality review
      const primaryLanguage =
        techStackResult.primary_language || detectedLanguages[0] || 'javascript';
      const aiAvailable = await this.aiHelper.initialize();
      if (aiAvailable) {
        await this.aiCache.init();
        const prompt = buildCodeQualityPrompt({
          codeFiles: [],
          language: primaryLanguage,
          projectInfo: { language: primaryLanguage, languages: detectedLanguages },
        });
        const cacheKey = `step_10|${detectedLanguages.join(',')}|${aggregateTotals.fileCount}|${aggregateTotals.totalIssues}`;
        await this.aiCache.withCache(prompt, cacheKey, () =>
          this.aiHelper.executeRequest(prompt, { persona: 'architecture_reviewer' })
        );
      } else {
        logger.warn('AI helper not available - skipping AI code quality review');
      }

      const hasErrors = aggregateTotals.errors > 0;
      if (hasErrors) {
        logger.warn('Step 10 completed with errors');
      } else {
        logger.success('Step 10 completed - code quality validated!');
      }

      return {
        success: !hasErrors,
        perLanguageResults,
        aggregateTotals,
        // backward-compat aliases for single-language consumers
        language: primaryLanguage,
        sourceFileCount: aggregateTotals.fileCount,
      };
    } catch (error) {
      logger.error(`Step 10 failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Detect full tech stack for the project
   * @param {string} projectRoot - Project root directory
   * @returns {Promise<Object>} Tech stack detection result
   */
  async detectTechStack(projectRoot) {
    try {
      return await this.techStack.detectAll(projectRoot);
    } catch {
      return { primary_language: 'javascript', languages: [] };
    }
  }

  /**
   * Read lint_commands map from .workflow-config.yaml
   * @param {string} projectRoot - Project root directory
   * @returns {Promise<Object>} Map of { language: command } or empty object
   */
  async readConfigLintCommands(projectRoot) {
    try {
      const configPath = `${projectRoot}/.workflow-config.yaml`;
      const content = await this.fileOps.readFile(configPath);
      // Simple YAML key extraction for tech_stack.lint_commands
      // Parse the lint_commands block manually to avoid adding a yaml dep here
      const match = content.match(/lint_commands:\s*\n((?:\s+\w[\w\s]*:.*\n?)*)/m);
      if (!match) return {};
      const block = match[1];
      const result = {};
      for (const line of block.split('\n')) {
        const pair = line.match(/^\s+([\w]+):\s*(.+)$/);
        if (pair) {
          result[pair[1].toLowerCase().trim()] = pair[2].trim();
        }
      }
      return result;
    } catch {
      return {};
    }
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
