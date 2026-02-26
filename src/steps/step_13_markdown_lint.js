/**
 * Step 13: Markdown Linting
 * @module steps/step_13_markdown_lint
 * @version 2.0.0
 *
 * Purpose: Validate markdown formatting with markdownlint
 * Features:
 * - Enumerate markdown files in project
 * - Check markdownlint (mdl) installation
 * - Run linting on all markdown files
 * - Detect common anti-patterns
 * - Generate linting reports
 *
 * Architecture: v2.0.0 Referential Transparency
 * - Pure functions for parsing and analysis
 * - Impure wrapper class for I/O operations
 */

import path from 'path';
import { STEP_KIND } from './step_contract.js';
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

export const MARKDOWN_PATTERNS = {
  files: '**/*.md',
  excludeDirs: ['node_modules', 'coverage', '.git', 'dist', 'build'],
};

export const ANTI_PATTERNS = {
  missingSpaceAfterHash: /^#[^# ]/m,
  malformedBold: /\s\*[^*].*\*\*:/,
  trailingWhitespace: /\s+$/m,
  multipleBlankLines: /\n{3,}/,
};

export const LINTER_COMMANDS = {
  mdl: {
    check: 'mdl --version',
    // Files are appended at runtime to avoid --git-recurse / git-lock race conditions
    lintBase: 'mdl --ignore-front-matter',
  },
};

/** Maximum number of file arguments per mdl invocation */
export const MDL_BATCH_SIZE = 100;

export const SEVERITY_LEVELS = {
  error: 'error',
  warning: 'warning',
  info: 'info',
};

// ============================================================================
// PURE FUNCTIONS - Markdown File Analysis
// ============================================================================

/**
 * Filter markdown files from file list
 * @pure
 * @param {Array<string>} files - List of file paths
 * @returns {Array<string>} Filtered markdown files
 */
export function filterMarkdownFiles(files) {
  return files.filter((file) => file.endsWith('.md'));
}

/**
 * Check if path should be excluded
 * @pure
 * @param {string} path - File path to check
 * @param {Array<string>} excludeDirs - Directories to exclude
 * @returns {boolean} True if should be excluded
 */
export function shouldExcludePath(path, excludeDirs = MARKDOWN_PATTERNS.excludeDirs) {
  return excludeDirs.some(
    (dir) =>
      path.includes(`/${dir}/`) ||
      path.includes(`\\${dir}\\`) ||
      path.startsWith(`${dir}/`) ||
      path.startsWith(`${dir}\\`)
  );
}

/**
 * Parse mdl output lines
 * @pure
 * @param {string} output - mdl command output
 * @returns {Array<Object>} Parsed lint issues
 */
export function parseMdlOutput(output) {
  const lines = output
    .trim()
    .split('\n')
    .filter((l) => l.trim());
  const issues = [];

  lines.forEach((line) => {
    // Format: file:line: MD### message
    const match = line.match(/^(.+?):(\d+):\s*(MD\d+)\s*(.*)$/);
    if (match) {
      issues.push({
        file: match[1],
        line: parseInt(match[2], 10),
        rule: match[3],
        message: match[4].trim(),
        severity: SEVERITY_LEVELS.warning,
      });
    }
  });

  return issues;
}

/**
 * Group issues by file
 * @pure
 * @param {Array<Object>} issues - List of lint issues
 * @returns {Object} Issues grouped by file
 */
export function groupIssuesByFile(issues) {
  const grouped = {};

  issues.forEach((issue) => {
    if (!grouped[issue.file]) {
      grouped[issue.file] = [];
    }
    grouped[issue.file].push(issue);
  });

  return grouped;
}

/**
 * Group issues by rule
 * @pure
 * @param {Array<Object>} issues - List of lint issues
 * @returns {Object} Issues grouped by rule
 */
export function groupIssuesByRule(issues) {
  const grouped = {};

  issues.forEach((issue) => {
    if (!grouped[issue.rule]) {
      grouped[issue.rule] = [];
    }
    grouped[issue.rule].push(issue);
  });

  return grouped;
}

/**
 * Calculate linting statistics
 * @pure
 * @param {Array<Object>} issues - List of lint issues
 * @param {number} fileCount - Total files checked
 * @returns {Object} Linting statistics
 */
export function calculateLintStats(issues, fileCount) {
  const byFile = groupIssuesByFile(issues);
  const byRule = groupIssuesByRule(issues);

  return {
    totalIssues: issues.length,
    filesWithIssues: Object.keys(byFile).length,
    filesChecked: fileCount,
    cleanFiles: fileCount - Object.keys(byFile).length,
    uniqueRules: Object.keys(byRule).length,
    issuesPerFile: issues.length / Math.max(fileCount, 1),
  };
}

/**
 * Split an array into chunks of at most `size` elements
 * @pure
 * @param {Array} arr - Array to split
 * @param {number} size - Maximum chunk size
 * @returns {Array<Array>} Array of chunks
 */
export function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/**
 * Merge issues from multiple batch runs into one flat list
 * @pure
 * @param {Array<Array<Object>>} batchIssues - Issues from each batch
 * @returns {Array<Object>} Merged issues list
 */
export function mergeBatchIssues(batchIssues) {
  return batchIssues.flat();
}

// ============================================================================
// PURE FUNCTIONS - Anti-Pattern Detection
// ============================================================================

/**
 * Check for missing space after hash in headings
 * @pure
 * @param {string} content - File content
 * @returns {Array<Object>} Detected issues
 */
export function checkMissingSpaceAfterHash(content) {
  const issues = [];
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    // Match lines starting with 1-6 # followed by non-space, non-# character
    // Exclude shebangs (#!) and special cases
    if (/^#{1,6}[^#\s!]/.test(line)) {
      issues.push({
        line: index + 1,
        message: 'Missing space after # in heading',
        pattern: 'missing-space-after-hash',
      });
    }
  });

  return issues;
}

/**
 * Check for malformed bold formatting
 * @pure
 * @param {string} content - File content
 * @returns {Array<Object>} Detected issues
 */
export function checkMalformedBold(content) {
  const issues = [];
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    if (ANTI_PATTERNS.malformedBold.test(line)) {
      issues.push({
        line: index + 1,
        message: 'Potential malformed bold formatting',
        pattern: 'malformed-bold',
      });
    }
  });

  return issues;
}

/**
 * Check for trailing whitespace
 * @pure
 * @param {string} content - File content
 * @returns {Array<Object>} Detected issues
 */
export function checkTrailingWhitespace(content) {
  const issues = [];
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    if (ANTI_PATTERNS.trailingWhitespace.test(line)) {
      issues.push({
        line: index + 1,
        message: 'Trailing whitespace',
        pattern: 'trailing-whitespace',
      });
    }
  });

  return issues;
}

/**
 * Check for multiple consecutive blank lines
 * @pure
 * @param {string} content - File content
 * @returns {Array<Object>} Detected issues
 */
export function checkMultipleBlankLines(content) {
  const issues = [];
  const matches = content.matchAll(/\n{3,}/g);

  for (const match of matches) {
    const precedingContent = content.substring(0, match.index);
    const lineNumber = precedingContent.split('\n').length;
    issues.push({
      line: lineNumber,
      message: 'Multiple consecutive blank lines',
      pattern: 'multiple-blank-lines',
    });
  }

  return issues;
}

/**
 * Run all anti-pattern checks
 * @pure
 * @param {string} content - File content
 * @returns {Array<Object>} All detected anti-pattern issues
 */
export function detectAntiPatterns(content) {
  return [
    ...checkMissingSpaceAfterHash(content),
    ...checkMalformedBold(content),
    ...checkTrailingWhitespace(content),
    ...checkMultipleBlankLines(content),
  ];
}

// ============================================================================
// PURE FUNCTIONS - Report Generation
// ============================================================================

/**
 * Format markdown linting report
 * @pure
 * @param {Object} data - Report data
 * @returns {string} Formatted markdown report
 */
export function formatLintReport(data) {
  const { stats, issues, antiPatterns, mdlVersion } = data;

  const sections = [];

  sections.push('### Markdown Linting Report\n');

  if (mdlVersion) {
    sections.push(`**Linter:** markdownlint (mdl) v${mdlVersion}`);
  }

  sections.push(`**Files Checked:** ${stats.filesChecked}`);
  sections.push(`**Clean Files:** ${stats.cleanFiles}`);
  sections.push(`**Files with Issues:** ${stats.filesWithIssues}`);
  sections.push(`**Total Issues:** ${stats.totalIssues}\n`);

  if (stats.totalIssues > 0) {
    sections.push('### Issues by Rule\n');

    const byRule = groupIssuesByRule(issues);
    Object.entries(byRule)
      .sort(([, a], [, b]) => b.length - a.length)
      .forEach(([rule, ruleIssues]) => {
        sections.push(`- **${rule}**: ${ruleIssues.length} occurrence(s)`);
      });

    sections.push('\n### Issues by File\n');

    const byFile = groupIssuesByFile(issues);
    Object.entries(byFile)
      .sort(([, a], [, b]) => b.length - a.length)
      .slice(0, 10)
      .forEach(([file, fileIssues]) => {
        sections.push(`- ${file}: ${fileIssues.length} issue(s)`);
      });

    if (Object.keys(byFile).length > 10) {
      sections.push(`- ... and ${Object.keys(byFile).length - 10} more files\n`);
    } else {
      sections.push('');
    }
  }

  if (antiPatterns && antiPatterns.length > 0) {
    sections.push('### Anti-Pattern Detection\n');
    const patternCounts = {};
    antiPatterns.forEach((ap) => {
      patternCounts[ap.pattern] = (patternCounts[ap.pattern] || 0) + 1;
    });

    Object.entries(patternCounts).forEach(([pattern, count]) => {
      sections.push(`- ${pattern}: ${count} occurrence(s)`);
    });
    sections.push('');
  }

  const quality =
    stats.totalIssues === 0
      ? '✅ Excellent'
      : stats.issuesPerFile < 1
        ? '✅ Good'
        : stats.issuesPerFile < 3
          ? '⚠️ Needs Improvement'
          : '❌ Poor';

  sections.push(`**Overall Quality:** ${quality}`);

  return sections.join('\n');
}

/**
 * Determine pass/fail status
 * @pure
 * @param {Object} stats - Linting statistics
 * @returns {string} Status: pass, warning, or fail
 */
export function determineLintStatus(stats) {
  if (stats.totalIssues === 0) {
    return 'pass';
  }
  if (stats.issuesPerFile < 5) {
    return 'warning'; // Non-blocking
  }
  return 'fail';
}

// ============================================================================
// IMPURE WRAPPER CLASS - Step13MarkdownLint
// ============================================================================

export class Step13MarkdownLint {
  static stepKind = STEP_KIND.CONTEXT;

  constructor(options = {}) {
    this.executor = options.executor || null;
    this.fileOps = options.fileOps || null;
    this.backlogManager = options.backlogManager || null;
    this.logger = options.logger || console;
    this.dryRun = options.dryRun || false;
    this.aiHelper = options.aiHelper || new AiHelper({ promptsDir: options.promptsDir });
    this.aiCache = options.aiCache || new AiCache();
  }

  /**
   * Execute markdown linting workflow
   * @param {Object} context - Workflow context
   * @returns {Promise<Object>} Linting results
   */
  async execute(context = {}) {
    this.logger.step('Step 13: Markdown Linting');

    if (this.dryRun) {
      return this._executeDryRun();
    }

    const projectRoot = context.projectRoot || process.cwd();

    try {
      // Phase 1: Enumerate markdown files
      const markdownFiles = await this._enumerateMarkdownFiles(projectRoot);

      if (markdownFiles.length === 0) {
        return this._handleNoFiles();
      }

      // Phase 2: Check mdl installation
      const mdlInstalled = await this._checkMdlInstalled();

      if (!mdlInstalled.available) {
        return this._handleMdlNotInstalled();
      }

      // Phase 3: Run mdl linting (pass enumerated files to avoid git-lock race)
      const lintResults = await this._runMdlLinting(projectRoot, markdownFiles);

      // Phase 4: Run anti-pattern detection
      const antiPatterns = await this._detectAntiPatterns(markdownFiles);

      // Phase 5: Generate report
      return this._generateReport(
        markdownFiles.length,
        lintResults,
        antiPatterns,
        mdlInstalled.version,
        projectRoot
      );
    } catch (error) {
      this.logger.error(`Markdown linting failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Execute dry-run mode
   * @private
   */
  async _executeDryRun() {
    this.logger.info('[DRY RUN] Markdown linting preview:');
    this.logger.info('  - Would enumerate markdown files');
    this.logger.info('  - Would check mdl installation');
    this.logger.info('  - Would run markdown linting');
    this.logger.info('  - Would detect anti-patterns');

    if (this.backlogManager) {
      await this.backlogManager.saveStepSummary(
        '13',
        'Markdown_Linting',
        'Dry run mode - no linting performed.',
        '✅'
      );
    }

    return {
      success: true,
      dryRun: true,
      message: 'Dry run completed',
    };
  }

  /**
   * Enumerate markdown files in project
   * @private
   */
  async _enumerateMarkdownFiles(projectRoot) {
    this.logger.info('Enumerating markdown files...');

    if (!this.fileOps) {
      this.logger.warn('No file operations available');
      return [];
    }

    try {
      const absRoot = path.resolve(projectRoot);
      const allFiles = await this.fileOps.listDirectoryRecursive(absRoot, {
        extensions: ['.md'],
      });

      const filtered = allFiles.filter((file) => !shouldExcludePath(file));

      this.logger.info(`Found ${filtered.length} markdown files`);
      return filtered;
    } catch {
      this.logger.warn('Failed to enumerate markdown files');
      return [];
    }
  }

  /**
   * Check if mdl is installed
   * @private
   */
  async _checkMdlInstalled() {
    this.logger.info('Checking for mdl (markdownlint)...');

    try {
      const result = await this._executeCommand(LINTER_COMMANDS.mdl.check);
      const version = result.stdout.trim();

      this.logger.info(`mdl is installed: ${version}`);
      return { available: true, version };
    } catch {
      this.logger.warn('mdl not found');
      return { available: false };
    }
  }

  /**
   * Handle case when no markdown files exist
   * @private
   */
  async _handleNoFiles() {
    this.logger.info('No markdown files found');

    if (this.backlogManager) {
      await this.backlogManager.saveStepSummary(
        '13',
        'Markdown_Linting',
        'No markdown files found to lint.',
        '✅'
      );
    }

    return {
      success: true,
      noFiles: true,
      message: 'No markdown files to lint',
    };
  }

  /**
   * Handle case when mdl is not installed
   * @private
   */
  async _handleMdlNotInstalled() {
    this.logger.warn('mdl not installed - skipping markdown linting');

    if (this.backlogManager) {
      const report = '### Markdown Linting - mdl Not Installed\n\nInstall with: `gem install mdl`';
      await this.backlogManager.saveStepIssues('13', 'Markdown_Linting', report);
      await this.backlogManager.saveStepSummary(
        '13',
        'Markdown_Linting',
        'Skipped - mdl not installed. Install with: gem install mdl',
        '⚠️'
      );
    }

    return {
      success: true,
      skipped: true,
      reason: 'mdl not installed',
    };
  }

  /**
   * Run mdl linting in batches to avoid command-line length limits and git-lock races
   * @private
   * @param {string} projectRoot - Project root directory
   * @param {Array<string>} files - Enumerated markdown files to lint
   */
  async _runMdlLinting(projectRoot, files) {
    this.logger.info('Running mdl on all markdown files...');

    const batches = chunkArray(files, MDL_BATCH_SIZE);
    const batchIssues = [];

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const fileArgs = batch.map((f) => `"${f}"`).join(' ');
      const command = `${LINTER_COMMANDS.mdl.lintBase} ${fileArgs}`;

      try {
        const result = await this._executeCommand(command, { cwd: projectRoot });
        const output = result.stdout + result.stderr;
        batchIssues.push(parseMdlOutput(output));
      } catch (error) {
        // mdl exits with non-zero when it finds violations but still writes to stdout
        const output = (error.stdout || '') + (error.stderr || '');
        const issues = parseMdlOutput(output);

        if (issues.length > 0) {
          batchIssues.push(issues);
        } else {
          // Empty output means a real execution failure (e.g. bad args, missing files)
          throw error;
        }
      }
    }

    const issues = mergeBatchIssues(batchIssues);

    if (issues.length === 0) {
      this.logger.info('✅ No markdown linting errors found');
    } else {
      this.logger.warn(`Found ${issues.length} markdown linting violations`);
    }

    return { issues };
  }

  /**
   * Detect anti-patterns in markdown files
   * @private
   */
  async _detectAntiPatterns(files) {
    this.logger.info('Checking for common markdown anti-patterns...');

    if (!this.fileOps) {
      return [];
    }

    const allAntiPatterns = [];

    for (const file of files.slice(0, 50)) {
      // Limit to avoid excessive processing
      try {
        const content = await this.fileOps.readFile(file);
        const fileAntiPatterns = detectAntiPatterns(content);

        fileAntiPatterns.forEach((ap) => {
          allAntiPatterns.push({ ...ap, file });
        });
      } catch {
        // Skip files that can't be read
      }
    }

    if (allAntiPatterns.length > 0) {
      this.logger.warn(`Detected ${allAntiPatterns.length} anti-pattern occurrences`);
    } else {
      this.logger.info('No common anti-patterns detected');
    }

    return allAntiPatterns;
  }

  /**
   * Generate final report
   * @private
   */
  async _generateReport(fileCount, lintResults, antiPatterns, mdlVersion, projectRoot) {
    const stats = calculateLintStats(lintResults.issues, fileCount);
    const status = determineLintStatus(stats);

    const reportData = {
      stats,
      issues: lintResults.issues,
      antiPatterns,
      mdlVersion,
    };

    const report = formatLintReport(reportData);

    if (this.backlogManager) {
      await this.backlogManager.saveStepIssues('13', 'Markdown_Linting', report);

      const summary = `Linted ${fileCount} markdown files. ${stats.totalIssues} issue(s) found. ${stats.cleanFiles} clean file(s).`;

      const statusEmoji = status === 'pass' ? '✅' : status === 'warning' ? '⚠️' : '❌';

      await this.backlogManager.saveStepSummary('13', 'Markdown_Linting', summary, statusEmoji);
    }

    // Phase AI: AI-powered markdown lint analysis
    const aiAvailable = await this.aiHelper.initialize();
    if (aiAvailable) {
      await this.aiCache.init();

      // Build grounding data for the prompt (prevents hallucination of file/rule names)
      const byRule = groupIssuesByRule(lintResults.issues);
      const byFile = groupIssuesByFile(lintResults.issues);
      const issuesByRule = Object.entries(byRule)
        .sort((a, b) => b[1].length - a[1].length)
        .map(([rule, items]) => `${rule}: ${items.length} occurrence(s)`)
        .join('\n');
      const issuesByFile = Object.entries(byFile)
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 10)
        .map(([file, items]) => `${file}: ${items.length} issue(s)`)
        .join('\n');

      let prompt;
      try {
        const yamlContent =
          (await this.fileOps?.readFile(AI_HELPERS_PATH)) ??
          (await import('fs').then((m) => m.promises.readFile(AI_HELPERS_PATH, 'utf-8')));
        const parsedYaml = yaml.load(yamlContent);
        prompt = buildYamlStepPrompt(parsedYaml, 'markdown_lint_prompt', {
          project_name: projectRoot,
          files_linted: String(fileCount),
          total_issues: String(stats.totalIssues),
          clean_files: String(stats.cleanFiles),
          anti_patterns: String(antiPatterns?.length ?? 0),
          issues_by_rule: issuesByRule || '(none)',
          issues_by_file: issuesByFile || '(none)',
          status,
        });
      } catch {
        /* fallback to generic prompt */
      }
      if (!prompt) {
        const role = `You are an expert in Markdown authoring and documentation quality.`;
        const task = `Analyze these markdown linting results for the project at: ${projectRoot}

- Files linted: ${fileCount}
- Total issues: ${stats.totalIssues}
- Clean files: ${stats.cleanFiles}
- Anti-patterns detected: ${antiPatterns?.length ?? 0}
- Status: ${status}

Issues by rule:
${issuesByRule || '(none)'}

Issues by file (top 10):
${issuesByFile || '(none)'}

IMPORTANT: Only reference the files and rules listed above. Do not invent file paths or rule names not present in this data.`;
        const approach = `Provide actionable fixes for the rules and files listed above. Be precise and reference only the data provided.`;
        prompt = injectProjectContext(buildStructuredPrompt({ role, task, approach }), {
          project_name: projectRoot,
        });
      }
      const cacheKey = `step_13|${fileCount}|${stats.totalIssues}`;
      const aiResult = await this.aiCache.withCache(prompt, cacheKey, () =>
        this.aiHelper.executeRequest(prompt, { persona: 'technical_writer' })
      );
      const aiContent = aiResult?.content ?? '';
      if (aiContent && this.backlogManager) {
        const enrichedReport = `${report}\n\n---\n\n## AI Recommendations\n\n${aiContent}`;
        const statusEmoji = status === 'pass' ? '✅' : status === 'warning' ? '⚠️' : '❌';
        await this.backlogManager.saveStepSummary(
          '13',
          'Markdown_Linting',
          enrichedReport,
          statusEmoji
        );
      }
    } else {
      this.logger.warn('AI helper not available - skipping AI analysis');
    }

    return {
      success: true,
      status,
      stats,
      issues: lintResults.issues,
      antiPatterns,
      report,
    };
  }

  /**
   * Execute command
   * @private
   */
  async _executeCommand(command, options = {}) {
    if (this.executor && typeof this.executor.execute === 'function') {
      return await this.executor.execute(command, { shell: true, ...options });
    }

    // Fallback: use executor module functions
    const executor = this.executor;
    if (executor && typeof executor.executeCommand === 'function') {
      return await executor.executeCommand(command, { shell: true, ...options });
    }

    throw new Error('No executor available for commands');
  }
}
