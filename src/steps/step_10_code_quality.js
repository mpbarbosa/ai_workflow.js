/**
 * Step 10: Code Quality Analysis
 * @module steps/step_10_code_quality
 * @version 2.0.0
 *
 * Analyzes code quality using linters and static analysis tools.
 */

import { readFileSync } from 'fs';
import { join, basename } from 'path';
import { STEP_KIND } from './step_contract.js';
import { logger } from '../core/logger.js';
import * as executor from '../core/executor.js';
import { FileOperations } from '../lib/file_operations.js';
import { Backlog } from '../lib/backlog.js';
import { TechStackDetector } from '../lib/tech_stack.js';
import { AiHelper } from '../lib/ai_helpers.js';
import { AiCache } from '../lib/ai_cache.js';
import { AnalysisCache } from '../lib/analysis_cache.js';
import {
  buildCodeQualityPrompt,
  AI_HELPERS_PATH,
  AI_PROJECT_KINDS_PATH,
  buildYamlStepPrompt,
  buildProjectKindPrompt,
  buildAlternativesDirective,
  parseAlternatives,
} from '../lib/ai_prompt_builder.js';
import yaml from 'js-yaml';
import { Step10PartitionCache } from '../lib/step10_partition_cache.js';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Maximum number of files sent to the AI in a single request.
 * Keeps prompts well below model context limits and avoids timeout errors.
 */
export const AI_FILES_PER_SLICE = 5;

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
  bash: 'find . -name "*.sh" -not -path "*/node_modules/*" -not -path "*/.git/*" | xargs shellcheck',
  json: '(native JSON.parse)',
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
    fileIssues: {},
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

  // Extract per-file issue counts from ESLint stylish output.
  // Non-indented lines starting with '/' are file paths; indented lines are issues.
  const lines = output.split('\n');
  let currentFile = null;
  for (const line of lines) {
    if (/^\//.test(line)) {
      currentFile = line.trim();
      results.fileIssues[currentFile] = 0;
    } else if (currentFile && /^\s+\d+:\d+\s+(error|warning)/.test(line)) {
      results.fileIssues[currentFile]++;
    }
  }

  results.files = Object.keys(results.fileIssues).length;

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
    fileIssues: {},
  };

  // Count unique files and per-file issue counts.
  // Flake8 format: "file.py:line:col: E123 message"
  lines.forEach((line) => {
    const fileMatch = line.match(/^([^:]+):/);
    if (fileMatch) {
      const filePath = fileMatch[1];
      results.fileIssues[filePath] = (results.fileIssues[filePath] || 0) + 1;
    }
  });

  results.files = Object.keys(results.fileIssues).length;

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
  } else if (normalized === 'bash' || normalized === 'shell') {
    // Parse shellcheck output: count "In file line N:" markers as issues
    const issueMatches = output.match(/^In .+? line \d+:/gm) || [];
    const errors = (output.match(/\(error\)/g) || []).length;
    const warnings = (output.match(/\(warning\)/g) || []).length;
    const infos =
      (output.match(/\(info\)/g) || []).length +
      (output.match(/\(style\)/g) || []).length +
      (output.match(/\(note\)/g) || []).length;
    const total = issueMatches.length || errors + warnings + infos;
    return {
      totalIssues: total,
      errors,
      warnings,
      infos,
      files: 0,
    };
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
 * Aggregate per-file issue counts from all language linter results.
 * Normalises absolute paths to project-relative paths.
 *
 * @pure
 * @param {Array<{ linterResults: Object }>} perLanguageResults
 * @param {string} projectRoot - Absolute project root path
 * @returns {Object} Map of relativeFilePath → total issue count
 */
export function collectPerFileIssues(perLanguageResults, projectRoot) {
  const issues = {};
  const prefix = projectRoot ? `${projectRoot}/` : '';
  for (const { linterResults } of perLanguageResults) {
    const fileIssues = linterResults?.fileIssues || {};
    for (const [absPath, count] of Object.entries(fileIssues)) {
      const rel = prefix && absPath.startsWith(prefix) ? absPath.slice(prefix.length) : absPath;
      issues[rel] = (issues[rel] || 0) + count;
    }
  }
  return issues;
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
  const { totalIssues = 0, errors = 0, warnings = 0, infos = 0, fileCount = 0 } = aggregateTotals;
  report += '## Summary\n\n';
  report += `- **Languages analyzed**: ${perLanguageResults.length}\n`;
  report += `- **Total Source Files**: ${fileCount}\n`;
  report += `- **Total Issues**: ${totalIssues}\n`;
  if (errors > 0) report += `- **Total Errors**: ${errors}\n`;
  if (warnings > 0) report += `- **Total Warnings**: ${warnings}\n`;
  if (infos > 0) report += `- **Total Info**: ${infos}\n`;
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
        if (linterResults.errors > 0) {
          let breakdown = `${linterResults.errors} errors, ${linterResults.warnings} warnings`;
          if (linterResults.infos > 0) breakdown += `, ${linterResults.infos} info`;
          report += ` (${breakdown})`;
        }
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
// PURE FUNCTIONS - AI Prompt Context
// ============================================================================

/**
 * Sort file paths so source files (src/) appear before test files (test/).
 * Within each group, alphabetical order is preserved.
 * This ensures AI code samples show implementation code first.
 * @pure
 * @param {string[]} files - Relative file paths
 * @returns {string[]} Sorted file paths (source files first)
 */
export function prioritizeSourceFiles(files) {
  if (!Array.isArray(files)) return [];
  const isTestFile = (f) => /[\\/](test|tests|spec|__tests__)[\\/]|\.test\.|\.spec\./.test(f);
  const src = files.filter((f) => !isTestFile(f)).sort();
  const test = files.filter((f) => isTestFile(f)).sort();
  return [...src, ...test];
}

/**
 * Build a structured map of file content excerpts for AI prompt injection.
 * Prioritises source files and caps each file's content to avoid token overflow.
 * @pure
 * @param {Object} fileContents - Map of { relPath: fileContent }
 * @param {Object} [options={}]
 * @param {number} [options.maxCharsPerFile=600] - Max characters per file excerpt
 * @param {number} [options.maxFiles=8] - Max number of files to include
 * @returns {Array<{path: string, excerpt: string, truncated: boolean}>}
 */
export function buildFileContentMap(fileContents, options = {}) {
  const { maxCharsPerFile = 600, maxFiles = 8 } = options;
  if (!fileContents || typeof fileContents !== 'object') return [];
  const prioritized = prioritizeSourceFiles(Object.keys(fileContents));
  return prioritized.slice(0, maxFiles).map((path) => {
    const content = fileContents[path] ?? '';
    const truncated = content.length > maxCharsPerFile;
    return { path, excerpt: content.slice(0, maxCharsPerFile), truncated };
  });
}

/**
 * Format a file content map as a human-readable string for the AI prompt.
 * @pure
 * @param {Array<{path: string, excerpt: string, truncated: boolean}>} contentMap
 * @returns {string}
 */
export function formatFileContentMap(contentMap) {
  if (!Array.isArray(contentMap) || contentMap.length === 0) return '(no source files provided)';
  return contentMap
    .map(({ path, excerpt, truncated }) => {
      const note = truncated ? ' [truncated]' : '';
      return `### ${path}${note}\n\`\`\`\n${excerpt}\n\`\`\``;
    })
    .join('\n\n');
}

/**
 * Build an 8-character content hash from file contents for cache-key freshness.
 * Combines the first 80 chars of each file (sorted by path) into a simple checksum.
 * @pure
 * @param {Object} fileContents - Map of { relPath: fileContent }
 * @returns {string} 8-character hex-like hash string
 */
export function buildCodeContentHash(fileContents) {
  if (!fileContents || typeof fileContents !== 'object') return '00000000';
  const sorted = Object.keys(fileContents).sort();
  let hash = 0;
  for (const key of sorted) {
    const snippet = (fileContents[key] ?? '').slice(0, 80);
    for (let i = 0; i < snippet.length; i++) {
      hash = (hash * 31 + snippet.charCodeAt(i)) >>> 0;
    }
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * Determine whether the error resilience supplementary prompt should be run
 * for the given project kind.
 *
 * The error_resilience_prompt focuses on server-side and general application
 * failure modes (uncaught exceptions, unhandled rejections, silent failures).
 * It is not applicable to purely static or passive projects.
 *
 * @pure
 * @param {string} projectKind - Project kind identifier
 * @returns {boolean} True when error resilience analysis is appropriate
 */
export function shouldRunErrorResiliencePrompt(projectKind) {
  const excluded = new Set(['static_website', 'configuration_library']);
  return !excluded.has(projectKind);
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
    this.aiHelper = options.aiHelper || new AiHelper({ promptsDir: options.promptsDir || null });
    this.aiCache = options.aiCache || new AiCache();
    this.analysisCache = options.analysisCache || new AnalysisCache();
  }

  /**
   * Execute Step 10 code quality analysis
   * @param {string} projectRoot - Project root directory
   * @param {Object} options - Execution options (reserved)
   * @returns {Promise<Object>} Analysis result
   */
  async execute(projectRoot, options = {}) {
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
        const sourceFiles = await this.countSourceFiles(projectRoot, primaryLanguage);
        const sourceFileCount = sourceFiles.length;
        logger.info(`Found ${sourceFileCount} source file(s)`);

        const report = formatQualityReport({
          language: primaryLanguage,
          sourceFileCount,
          skipped: true,
        });
        await this.backlog.saveStepSummary(10, 'Code Quality', report);

        return {
          success: true,
          language: primaryLanguage,
          sourceFileCount,
          skipped: true,
          alternatives: [],
          recommendedAlternative: null,
        };
      }

      // Phase 4: Run each linter and collect per-language results
      const perLanguageResults = [];
      const allSourceFiles = [];
      for (const [language, linterCommand] of Object.entries(linterCommandMap)) {
        const sourceFiles = await this.countSourceFiles(projectRoot, language);
        const sourceFileCount = sourceFiles.length;

        if (sourceFileCount === 0) {
          logger.info(`${language}: no source files found, skipping linter`);
          continue;
        }

        allSourceFiles.push(...sourceFiles);
        logger.info(`${language}: ${sourceFileCount} source file(s), linter: ${linterCommand}`);

        const linterCacheInputs = { projectRoot, language, command: linterCommand };
        let linterResults = this.analysisCache.get('linter', linterCacheInputs);
        if (linterResults) {
          logger.info(`[AnalysisCache] ${language} linter results loaded from cache`);
        } else {
          if (language === 'json') {
            linterResults = this._lintJsonNative(projectRoot, sourceFiles);
          } else {
            linterResults = await this.runLinter(projectRoot, linterCommand, language);
          }
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
        return {
          success: true,
          language: primaryLanguage,
          sourceFileCount: 0,
          skipped: true,
          alternatives: [],
          recommendedAlternative: null,
        };
      }

      // Phase 6: Compute aggregate totals
      const aggregateTotals = perLanguageResults.reduce(
        (acc, r) => ({
          totalIssues: acc.totalIssues + (r.linterResults?.totalIssues || 0),
          errors: acc.errors + (r.linterResults?.errors || 0),
          warnings: acc.warnings + (r.linterResults?.warnings || 0),
          infos: acc.infos + (r.linterResults?.infos || 0),
          fileCount: acc.fileCount + r.sourceFileCount,
        }),
        { totalIssues: 0, errors: 0, warnings: 0, infos: 0, fileCount: 0 }
      );

      logger.info(
        `Total: ${aggregateTotals.totalIssues} issue(s) across ${perLanguageResults.length} language(s)`
      );

      // Phase 7: Generate multi-language report
      const report = formatQualityReport({ perLanguageResults, aggregateTotals });
      await this.backlog.saveStepSummary(10, 'Code Quality', report);

      // Phase 8: AI-powered code quality review (partition + rotate strategy)
      const primaryLanguage =
        techStackResult.primary_language || detectedLanguages[0] || 'javascript';
      let stepAlternatives = { alternatives: [], recommended: null };
      let erContent = '';
      try {
        const aiAvailable = await this.aiHelper.initialize();
        if (aiAvailable) {
          await this.aiCache.init();

          // Deduplicate. venv, coverage and similar dirs can inflate allSourceFiles.
          const uniqueSourceFiles = [...new Set(allSourceFiles)];

          // Select the partition to review this run and rotate for the next run.
          // Uses quality-aware ordering: recently modified first, exempt high-quality
          // files excluded until they are modified again.
          const partitionCache = new Step10PartitionCache({
            cacheDir: `${projectRoot}/.ai_workflow/.step_cache`,
          });
          const activeCandidates = await partitionCache.getActiveCandidates(
            uniqueSourceFiles,
            options.modifiedFiles ?? []
          );
          const partition = await partitionCache.getCurrentPartition(activeCandidates);

          logger.info(
            `Reviewing partition ${partition.index + 1}/${partition.total} (${partition.files.length} files): ${partition.label}`
          );

          // Read file contents so the AI receives real code, not just file names.
          const fileContents = {};
          await Promise.all(
            partition.files.map(async (relPath) => {
              try {
                const abs = relPath.startsWith('/') ? relPath : `${projectRoot}/${relPath}`;
                fileContents[relPath] = await this.fileOps.readFile(abs);
              } catch {
                // File unreadable — the prompt will still list it by name.
              }
            })
          );

          // Slice the partition into smaller batches so each AI request stays within
          // a manageable prompt size and doesn't time out on large file sets.
          const slices = [];
          for (let i = 0; i < partition.files.length; i += AI_FILES_PER_SLICE) {
            slices.push(partition.files.slice(i, i + AI_FILES_PER_SLICE));
          }
          if (slices.length === 0) slices.push([]);

          // Read YAML config once, outside the per-slice work, so all parallel requests share it.
          let sharedParsedYaml = null;
          let sharedRoleOverride = '';
          try {
            const yamlContent = await this.fileOps.readFile(AI_HELPERS_PATH);
            sharedParsedYaml = yaml.load(yamlContent);
            try {
              const pkYaml = await this.fileOps.readFile(AI_PROJECT_KINDS_PATH);
              const parsedPk = yaml.load(pkYaml);
              const pk = buildProjectKindPrompt(
                parsedPk,
                options?.projectKind ?? 'default',
                'code_quality_auditor'
              );
              if (pk?.role) sharedRoleOverride = pk.role;
            } catch {
              /* optional */
            }
          } catch {
            /* fallback to hardcoded builder below */
          }

          // Run all slices in parallel — each slice is independent (different file set, unique cache key).
          const aiSectionResults = await Promise.all(
            slices.map(async (sliceFiles, si) => {
              const sliceContents = {};
              for (const f of sliceFiles) {
                if (Object.prototype.hasOwnProperty.call(fileContents, f)) {
                  sliceContents[f] = fileContents[f];
                }
              }

              // Try YAML-based prompt; fall back to hardcoded builder
              let prompt;
              try {
                if (sharedParsedYaml) {
                  const prioritizedContents = {};
                  for (const f of prioritizeSourceFiles(sliceFiles)) {
                    if (Object.prototype.hasOwnProperty.call(sliceContents, f)) {
                      prioritizedContents[f] = sliceContents[f];
                    }
                  }
                  const contentMap = buildFileContentMap(prioritizedContents, {
                    maxFiles: sliceFiles.length,
                    maxCharsPerFile: 5000,
                  });
                  const fileContentMap = formatFileContentMap(contentMap);
                  const sampleCode = '';
                  const largeFList = sliceFiles.join(', ');
                  const projectName = basename(projectRoot);
                  const projectDescription = options?.projectDescription ?? '';
                  const changeScope = options?.changeScope ?? 'full';
                  const modifiedFiles = options?.modifiedFiles ?? [];
                  const modifiedCount = modifiedFiles.length;
                  const totalFiles = aggregateTotals.fileCount ?? sliceFiles.length;
                  const languageBreakdown =
                    detectedLanguages.map((l) => `${l}`).join(', ') || primaryLanguage;
                  prompt = buildYamlStepPrompt(sharedParsedYaml, 'step9_code_quality_prompt', {
                    project_name: projectName,
                    project_description: projectDescription,
                    primary_language: primaryLanguage,
                    tech_stack_summary: detectedLanguages.join(', '),
                    change_scope: changeScope,
                    modified_count: modifiedCount,
                    total_files: totalFiles,
                    language_breakdown: languageBreakdown,
                    quality_summary: `${aggregateTotals.totalIssues} issue(s)`,
                    quality_report_content: report.slice(0, 3000),
                    large_files_list: largeFList,
                    sample_code: sampleCode,
                    file_content_map: fileContentMap,
                  });
                  if (prompt && sharedRoleOverride) {
                    prompt = `[Project-Kind Role: ${sharedRoleOverride}]\n\n${prompt}`;
                  }
                  // Supplementary: issue extraction — only append when actual log content is available
                  const logFile = options?.sessionLogFile ?? '';
                  const logContent = options?.sessionLogContent ?? '';
                  if (logFile && logContent) {
                    const issuePrompt = buildYamlStepPrompt(
                      sharedParsedYaml,
                      'issue_extraction_prompt',
                      {
                        project_name: projectName,
                        primary_language: primaryLanguage,
                        log_file: logFile,
                        log_content: logContent,
                      }
                    );
                    if (issuePrompt && prompt) {
                      prompt = `${prompt}\n\n---\n\n${issuePrompt}`;
                    }
                  }
                  // Front-end projects: add front_end_developer perspective
                  const fePks = ['react_spa', 'client_spa', 'static_website'];
                  if (fePks.includes(options?.projectType ?? options?.projectKind ?? '')) {
                    const fePrompt = buildYamlStepPrompt(
                      sharedParsedYaml,
                      'front_end_developer_prompt',
                      {
                        project_name: basename(projectRoot),
                      }
                    );
                    if (fePrompt && prompt) {
                      prompt = `${prompt}\n\n---\n\n${fePrompt}`;
                    }
                  }
                }
              } catch {
                /* fallback */
              }

              if (!prompt) {
                prompt = buildCodeQualityPrompt({
                  codeFiles: sliceFiles,
                  language: primaryLanguage,
                  projectInfo: {
                    projectRoot,
                    language: primaryLanguage,
                    languages: detectedLanguages,
                  },
                  fileContents: sliceContents,
                });
              }

              if (options.alternatives) {
                const n = options.alternatives === true ? 2 : options.alternatives;
                prompt += buildAlternativesDirective(n);
              }

              const fileHashEntries = Object.entries(sliceContents).map(([k, v]) => `${k}:${v}`);
              // Use 'code_quality_analyst' persona: Step 10 performs code quality review
              // (maintainability, anti-patterns, technical debt) using the step9_code_quality_prompt
              // YAML template, which defines a "comprehensive software quality engineer" role.
              // 'architecture_reviewer' is too narrow (architecture/scalability only) and creates
              // a misleading mismatch between the logged persona and the actual prompt content.
              const aiResult = await this.aiCache.withFileChangeGuard(
                `step_10_p${partition.index}_s${si}`,
                fileHashEntries,
                () =>
                  this.aiHelper.executeRequest(prompt, {
                    persona: 'code_quality_analyst',
                    timeout: 240000,
                  })
              );
              return aiResult?.content ?? '';
            })
          );

          const aiSections = aiSectionResults.filter((c) => c);

          const aiContent = aiSections.join('\n\n---\n\n');

          // Error Resilience: separate AI pass at the partition level (not per-slice).
          // One focused call reviews all partition files for production failure modes:
          // empty catches, missing await, unhandled rejections, error masking, etc.
          // Runs independently so it has its own cache key and never inflates the
          // main code quality prompt.
          const currentKind = options?.projectType ?? options?.projectKind ?? '';
          if (sharedParsedYaml && shouldRunErrorResiliencePrompt(currentKind)) {
            try {
              const erFileMap = formatFileContentMap(
                buildFileContentMap(fileContents, {
                  maxFiles: partition.files.length,
                  maxCharsPerFile: 2000,
                })
              );
              const erPrompt = buildYamlStepPrompt(sharedParsedYaml, 'error_resilience_prompt', {
                project_name: basename(projectRoot),
                primary_language: primaryLanguage,
                file_content_map: erFileMap,
              });
              if (erPrompt) {
                const erHashEntries = Object.entries(fileContents).map(([k, v]) => `${k}:${v}`);
                const erResult = await this.aiCache.withFileChangeGuard(
                  `step_10_er_p${partition.index}`,
                  erHashEntries,
                  () =>
                    this.aiHelper.executeRequest(erPrompt, {
                      persona: 'code_quality_analyst',
                      timeout: 180000,
                    })
                );
                erContent = erResult?.content ?? '';
              }
            } catch (erError) {
              logger.warn(`Error resilience analysis skipped: ${erError.message}`);
            }
          }

          const parsedAlternatives = options.alternatives
            ? parseAlternatives(aiContent)
            : { alternatives: [], recommended: null };
          stepAlternatives = parsedAlternatives;
          if (aiContent || erContent) {
            const partitionHeader = `## AI Code Review — Partition ${partition.index + 1}/${partition.total}: \`${partition.label}\`\n`;
            let enrichedReport = `${report}\n\n---\n\n${partitionHeader}\n${aiContent}`;
            if (erContent) {
              enrichedReport += `\n\n---\n\n## Error Resilience Analysis\n\n${erContent}`;
            }
            await this.backlog.saveStepSummary(10, 'Code Quality', enrichedReport);
            // Update per-file quality scores and advance partition for the next run.
            const perFileIssues = collectPerFileIssues(perLanguageResults, projectRoot);
            await partitionCache.updateQualityScores(perFileIssues, partition.files);
            await partitionCache.advance(activeCandidates);
          }
        } else {
          logger.warn('AI helper not available - skipping AI code quality review');
        }
      } catch (aiError) {
        logger.warn(`AI code quality review skipped: ${aiError.message}`);
      }

      const hasErrors = aggregateTotals.errors > 0;
      if (hasErrors) {
        logger.warn('Step 10 completed with errors');
      } else {
        logger.success('Step 10 completed - code quality validated!');
      }

      return {
        success: true,
        hasLintErrors: hasErrors,
        perLanguageResults,
        aggregateTotals,
        // backward-compat aliases for single-language consumers
        language: primaryLanguage,
        sourceFileCount: aggregateTotals.fileCount,
        alternatives: stepAlternatives.alternatives,
        recommendedAlternative: stepAlternatives.recommended,
        erFindings: erContent,
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
   * @returns {Promise<string[]>} Source file paths
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
            ignore: [
              '**/node_modules/**',
              '**/dist/**',
              '**/build/**',
              '**/.git/**',
              '**/venv/**',
              '**/.venv/**',
              '**/coverage/**',
              '**/.coverage/**',
              '**/__pycache__/**',
              '**/.jest-cache/**',
              '**/.cache/**',
              '**/legacy-tests/**',
              '**/vendor/**',
              // Exclude test directories and test file patterns so only source files
              // are counted; linters (e.g. eslint 'src/**') already exclude tests.
              '**/test/**',
              '**/tests/**',
              '**/__tests__/**',
              '**/*.test.js',
              '**/*.test.ts',
              '**/*.test.jsx',
              '**/*.test.tsx',
              '**/*.spec.js',
              '**/*.spec.ts',
              '**/*.spec.jsx',
              '**/*.spec.tsx',
            ],
          });
          allFiles = allFiles.concat(files);
        } catch {
          // Pattern didn't match
        }
      }

      // Remove duplicates
      return [...new Set(allFiles)];
    } catch {
      return [];
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
  /**
   * Validate JSON files natively using JSON.parse (no subprocess).
   * @param {string} projectRoot - Project root directory
   * @param {string[]} files - Relative file paths from countSourceFiles
   * @returns {Object} Linter results { totalIssues, errors, warnings, files }
   */
  _lintJsonNative(projectRoot, files) {
    let errors = 0;
    for (const relPath of files) {
      // tsconfig*.json and *.jsonc use JSONC format (allows comments) — skip to avoid false positives
      if (/tsconfig.*\.json$/i.test(relPath) || relPath.endsWith('.jsonc')) continue;
      try {
        const content = readFileSync(join(projectRoot, relPath), 'utf8');
        JSON.parse(content);
      } catch (err) {
        if (err instanceof SyntaxError) {
          logger.warn(`JSON syntax error in ${relPath}: ${err.message}`);
          errors++;
        }
        // ENOENT / permission errors are not syntax errors; skip silently
      }
    }
    return { totalIssues: errors, errors, warnings: 0, files: errors };
  }

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
