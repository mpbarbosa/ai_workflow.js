/**
 * @fileoverview Auto Commit Module - Automatic workflow artifact commits
 *
 * Architecture: v2.0.0 (Referentially Transparent)
 * - Pure functions: Commit message generation, categorization, validation
 * - Impure wrapper: Git operations, file system access
 *
 * @module lib/auto_commit
 * @version 2.0.0
 */

import { logger } from '../core/logger.js';

// ============================================================================
// PURE FUNCTIONS - Exported for testing and reuse
// ============================================================================

/**
 * Generate conventional commit message from file categories
 *
 * @param {Object} fileCategories - Categorized files
 * @param {Object} options - Commit options
 * @returns {string} Formatted commit message
 *
 * @example
 * generateCommitMessage({ docs: ['README.md'], metrics: ['metrics.json'] })
 * // Returns: 'chore(workflow): update docs and metrics [skip ci]'
 */
export function generateCommitMessage(fileCategories, _options = {}) {
  if (!fileCategories || typeof fileCategories !== 'object') {
    return 'chore(workflow): update artifacts [skip ci]';
  }

  const scope = buildCommitScope(fileCategories);
  const skipCI = shouldSkipCI(fileCategories);

  const counts = {
    docs: (fileCategories.docs || []).length,
    metrics: (fileCategories.metrics || []).length,
    logs: (fileCategories.logs || []).length,
    summaries: (fileCategories.summaries || []).length,
    tests: (fileCategories.tests || []).length,
  };

  const parts = [];
  if (counts.docs > 0) parts.push('docs');
  if (counts.metrics > 0) parts.push('metrics');
  if (counts.logs > 0) parts.push('logs');
  if (counts.summaries > 0) parts.push('summaries');
  if (counts.tests > 0) parts.push('tests');

  const description = parts.length > 0 ? `update ${parts.join(' and ')}` : 'update artifacts';

  const type =
    counts.docs > 0 && counts.tests === 0 && counts.metrics === 0 && counts.logs === 0
      ? 'docs'
      : 'chore';
  const flags = skipCI ? ' [skip ci]' : '';

  return `${type}(${scope}): ${description}${flags}`;
}

/**
 * Categorize workflow artifact files
 *
 * @param {Array<string>} files - Array of file paths
 * @returns {Object} Categorized files
 *
 * @example
 * categorizeArtifacts(['.ai_workflow/metrics/step1.json', 'docs/api.md'])
 * // Returns: { metrics: ['...'], docs: ['...'], ... }
 */
export function categorizeArtifacts(files) {
  if (!Array.isArray(files)) {
    return { docs: [], metrics: [], logs: [], summaries: [], tests: [], other: [] };
  }

  const categories = {
    docs: [],
    metrics: [],
    logs: [],
    summaries: [],
    tests: [],
    other: [],
  };

  for (const file of files) {
    if (!file || typeof file !== 'string') continue;

    const normalized = file.toLowerCase();

    if (normalized.includes('/metrics/') || normalized.endsWith('.metrics.json')) {
      categories.metrics.push(file);
    } else if (normalized.includes('/logs/') || normalized.endsWith('.log')) {
      categories.logs.push(file);
    } else if (normalized.includes('/summaries/') || normalized.includes('/backlog/')) {
      categories.summaries.push(file);
    } else if (normalized.includes('/docs/') || normalized.endsWith('.md')) {
      categories.docs.push(file);
    } else if (
      normalized.includes('/test/') ||
      normalized.includes('.test.') ||
      normalized.startsWith('test-') ||
      normalized.includes('coverage')
    ) {
      categories.tests.push(file);
    } else {
      categories.other.push(file);
    }
  }

  return categories;
}

/**
 * Determine if file should be auto-committed
 *
 * @param {string} file - File path to check
 * @param {Object} config - Auto-commit configuration
 * @returns {boolean} True if file should be committed
 *
 * @example
 * shouldAutoCommit('.ai_workflow/metrics/step1.json', { enabled: true })
 * // Returns: true
 */
export function shouldAutoCommit(file, config = {}) {
  if (!file || typeof file !== 'string') {
    return false;
  }

  if (config.enabled === false) {
    return false;
  }

  // Only commit workflow artifacts
  if (!validateArtifactPath(file)) {
    return false;
  }

  // Check exclusions
  if (config.exclude && Array.isArray(config.exclude)) {
    for (const pattern of config.exclude) {
      if (file.includes(pattern)) {
        return false;
      }
    }
  }

  // Check inclusions
  if (config.include && Array.isArray(config.include) && config.include.length > 0) {
    for (const pattern of config.include) {
      if (file.includes(pattern)) {
        return true;
      }
    }
    return false; // If include list exists, only commit matching files
  }

  return true;
}

/**
 * Build commit scope from file categories
 *
 * @param {Object} categories - File categories
 * @returns {string} Commit scope
 *
 * @example
 * buildCommitScope({ docs: ['a.md'], metrics: [] })
 * // Returns: 'docs'
 */
export function buildCommitScope(categories) {
  if (!categories || typeof categories !== 'object') {
    return 'workflow';
  }

  const counts = {
    docs: (categories.docs || []).length,
    metrics: (categories.metrics || []).length,
    logs: (categories.logs || []).length,
    summaries: (categories.summaries || []).length,
    tests: (categories.tests || []).length,
  };

  // Single category dominance
  if (counts.docs > 0 && counts.metrics === 0 && counts.tests === 0) {
    return 'docs';
  }
  if (counts.tests > 0 && counts.docs === 0 && counts.metrics === 0) {
    return 'tests';
  }
  if (counts.metrics > 0 && counts.docs === 0 && counts.tests === 0) {
    return 'metrics';
  }

  return 'workflow';
}

/**
 * Format detailed commit body
 *
 * @param {Object} details - Commit details
 * @returns {string} Formatted commit body
 *
 * @example
 * formatCommitBody({ files: ['a.json', 'b.md'], step: 5 })
 * // Returns: multi-line commit body
 */
export function formatCommitBody(details) {
  if (!details || typeof details !== 'object') {
    return '';
  }

  const lines = [];

  // File list
  if (details.files && Array.isArray(details.files) && details.files.length > 0) {
    lines.push('');
    lines.push('Files updated:');
    for (const file of details.files.slice(0, 10)) {
      // Limit to 10 files
      lines.push(`- ${file}`);
    }
    if (details.files.length > 10) {
      lines.push(`... and ${details.files.length - 10} more`);
    }
  }

  // Metadata footer
  lines.push('');
  lines.push('Auto-committed by ai_workflow.js v2.0.0');

  const metadata = [];
  if (details.step !== undefined) {
    metadata.push(`Step: ${details.step}`);
  }
  if (details.files && details.files.length > 0) {
    metadata.push(`Files: ${details.files.length}`);
  }
  if (details.timestamp) {
    metadata.push(`Timestamp: ${details.timestamp}`);
  }

  if (metadata.length > 0) {
    lines.push(metadata.join(' | '));
  }

  return lines.join('\n');
}

/**
 * Calculate commit priority based on file types
 *
 * @param {Array<string>} files - Files to commit
 * @returns {string} Priority: 'high', 'medium', 'low'
 *
 * @example
 * calculateCommitPriority(['test-results.json', 'coverage.json'])
 * // Returns: 'high'
 */
export function calculateCommitPriority(files) {
  if (!Array.isArray(files) || files.length === 0) {
    return 'low';
  }

  const categories = categorizeArtifacts(files);

  // High priority: test results, critical metrics
  if (categories.tests.length > 0) {
    return 'high';
  }

  // Medium priority: metrics, summaries
  if (categories.metrics.length > 0 || categories.summaries.length > 0) {
    return 'medium';
  }

  // Low priority: docs, logs
  return 'low';
}

/**
 * Validate if path is a workflow artifact
 *
 * @param {string} filePath - Path to validate
 * @returns {boolean} True if valid artifact path
 *
 * @example
 * validateArtifactPath('.ai_workflow/metrics/step1.json')
 * // Returns: true
 */
export function validateArtifactPath(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    return false;
  }

  const artifactPatterns = [
    '.ai_workflow/',
    'docs/',
    'coverage/',
    '.workflow-reports/',
    'test-results/',
  ];

  return artifactPatterns.some((pattern) => filePath.includes(pattern));
}

/**
 * Merge user options with defaults
 *
 * @param {Object} userOptions - User-provided options
 * @param {Object} defaults - Default options
 * @returns {Object} Merged options
 *
 * @example
 * mergeCommitOptions({ message: 'custom' }, { message: 'default', skipCI: true })
 * // Returns: { message: 'custom', skipCI: true }
 */
export function mergeCommitOptions(userOptions, defaults) {
  const user = userOptions || {};
  const def = defaults || {};

  return {
    ...def,
    ...user,
    // Deep merge for nested objects
    exclude: user.exclude || def.exclude || [],
    include: user.include || def.include || [],
  };
}

/**
 * Extract metadata from files for commit message
 *
 * @param {Array<string>} files - Files to analyze
 * @returns {Object} Metadata { stepNumber, timestamp, fileCount }
 *
 * @example
 * extractCommitMetadata(['.ai_workflow/metrics/step5.json'])
 * // Returns: { stepNumber: 5, fileCount: 1, timestamp: '...' }
 */
export function extractCommitMetadata(files) {
  if (!Array.isArray(files)) {
    return { stepNumber: null, timestamp: null, fileCount: 0 };
  }

  let stepNumber = null;

  // Try to extract step number from filenames
  for (const file of files) {
    if (!file || typeof file !== 'string') continue;

    const match = file.match(/step[_-]?(\d+)/i);
    if (match) {
      stepNumber = parseInt(match[1], 10);
      break;
    }
  }

  return {
    stepNumber,
    timestamp: new Date().toISOString(),
    fileCount: files.length,
  };
}

/**
 * Determine if [skip ci] flag should be added
 *
 * @param {Object} categories - File categories
 * @returns {boolean} True if CI should be skipped
 *
 * @example
 * shouldSkipCI({ docs: ['a.md'], metrics: ['b.json'] })
 * // Returns: true (no code changes)
 */
export function shouldSkipCI(categories) {
  if (!categories || typeof categories !== 'object') {
    return true; // Skip CI by default for artifacts
  }

  // Skip CI if only docs/metrics/logs/summaries
  const hasTests = (categories.tests || []).length > 0;
  const hasCode = (categories.code || []).length > 0;

  return !hasTests && !hasCode;
}

// ============================================================================
// IMPURE WRAPPER CLASS - Handles I/O and side effects
// ============================================================================

/**
 * Auto Commit - Automatic workflow artifact commits
 *
 * Features:
 * - Conventional commit messages
 * - Intelligent file categorization
 * - Priority-based commit scheduling
 * - [skip ci] flag management
 * - Commit history tracking
 *
 * @class AutoCommit
 *
 * @example
 * const autoCommit = new AutoCommit({
 *   gitAutomation,
 *   enabled: true,
 *   dryRun: false
 * });
 *
 * await autoCommit.commitArtifacts(['.ai_workflow/metrics/step1.json']);
 */
export class AutoCommit {
  /**
   * Create a new auto-commit instance
   *
   * @param {Object} options - Auto-commit options
   * @param {Object} options.gitAutomation - GitAutomation instance
   * @param {boolean} options.enabled - Enable auto-commits
   * @param {boolean} options.dryRun - Dry run mode (no actual commits)
   * @param {Array<string>} options.exclude - File patterns to exclude
   * @param {Array<string>} options.include - File patterns to include
   */
  constructor(options = {}) {
    this.gitAutomation = options.gitAutomation;
    this.enabled = options.enabled !== false;
    this.dryRun = options.dryRun || false;
    this.config = {
      enabled: this.enabled,
      exclude: options.exclude || [],
      include: options.include || [],
    };
    this.commitHistory = [];
  }

  /**
   * Commit workflow artifact files
   *
   * @param {Array<string>} files - Files to commit
   * @param {Object} options - Commit options
   * @returns {Promise<Object>} Commit result
   */
  async commitArtifacts(files, options = {}) {
    if (!this.enabled) {
      logger.debug('Auto-commit disabled');
      return { committed: false, reason: 'disabled' };
    }

    if (!this.gitAutomation) {
      logger.warn('No GitAutomation instance provided');
      return { committed: false, reason: 'no_git' };
    }

    if (!Array.isArray(files) || files.length === 0) {
      logger.debug('No files to commit');
      return { committed: false, reason: 'no_files' };
    }

    // Filter files that should be committed
    const toCommit = files.filter((file) => shouldAutoCommit(file, this.config));

    if (toCommit.length === 0) {
      logger.debug('No eligible files after filtering');
      return { committed: false, reason: 'filtered' };
    }

    try {
      // Categorize files
      const categories = categorizeArtifacts(toCommit);

      // Generate commit message
      const metadata = extractCommitMetadata(toCommit);
      const message = options.message || generateCommitMessage(categories, options);
      const body = formatCommitBody({ files: toCommit, ...metadata });
      const fullMessage = `${message}\n${body}`;

      if (this.dryRun) {
        logger.info(`[DRY RUN] Would commit ${toCommit.length} files: ${message}`);
        return { committed: false, reason: 'dry_run', message: fullMessage, files: toCommit };
      }

      // Stage all files in one call (add() requires an array).
      // Force-add (-f) so that files in .gitignore-d paths (e.g. .ai_workflow/.ai_cache)
      // are still staged — these are intentional workflow artifacts.
      await this.gitAutomation.add(toCommit, { force: true });

      // Commit (--no-verify skips pre-commit hooks; artifact commits don't need project validation)
      await this.gitAutomation.commit(fullMessage, { noVerify: true });

      // Track commit
      this.commitHistory.push({
        timestamp: metadata.timestamp,
        files: toCommit,
        message,
        categories,
      });

      logger.info(`Auto-committed ${toCommit.length} files: ${message}`);
      return { committed: true, message, files: toCommit, categories };
    } catch (error) {
      logger.error(`Failed to auto-commit: ${error.message}`);
      return { committed: false, reason: 'error', error: error.message };
    }
  }

  /**
   * Commit documentation updates
   *
   * @returns {Promise<Object>} Commit result
   */
  async commitDocs() {
    if (!this.gitAutomation) {
      return { committed: false, reason: 'no_git' };
    }

    try {
      const status = await this.gitAutomation.status();
      const allFiles = [...status.staged.map((f) => f.file), ...status.unstaged.map((f) => f.file)];

      const docFiles = allFiles.filter((f) => f.includes('docs/') || f.endsWith('.md'));

      return await this.commitArtifacts(docFiles, { message: null });
    } catch (error) {
      logger.error(`Failed to commit docs: ${error.message}`);
      return { committed: false, reason: 'error', error: error.message };
    }
  }

  /**
   * Commit metrics files
   *
   * @returns {Promise<Object>} Commit result
   */
  async commitMetrics() {
    if (!this.gitAutomation) {
      return { committed: false, reason: 'no_git' };
    }

    try {
      const status = await this.gitAutomation.status();
      const allFiles = [...status.staged.map((f) => f.file), ...status.unstaged.map((f) => f.file)];

      const metricFiles = allFiles.filter(
        (f) => f.includes('/metrics/') || f.endsWith('.metrics.json')
      );

      return await this.commitArtifacts(metricFiles, { message: null });
    } catch (error) {
      logger.error(`Failed to commit metrics: ${error.message}`);
      return { committed: false, reason: 'error', error: error.message };
    }
  }

  /**
   * Commit workflow summaries
   *
   * @returns {Promise<Object>} Commit result
   */
  async commitSummaries() {
    if (!this.gitAutomation) {
      return { committed: false, reason: 'no_git' };
    }

    try {
      const status = await this.gitAutomation.status();
      const allFiles = [...status.staged.map((f) => f.file), ...status.unstaged.map((f) => f.file)];

      const summaryFiles = allFiles.filter(
        (f) => f.includes('/summaries/') || f.includes('/backlog/')
      );

      return await this.commitArtifacts(summaryFiles, { message: null });
    } catch (error) {
      logger.error(`Failed to commit summaries: ${error.message}`);
      return { committed: false, reason: 'error', error: error.message };
    }
  }

  /**
   * Commit all pending workflow artifacts
   *
   * @returns {Promise<Object>} Commit result
   */
  async commitAll() {
    if (!this.gitAutomation) {
      return { committed: false, reason: 'no_git' };
    }

    try {
      const status = await this.gitAutomation.status();
      const allFiles = [...status.staged.map((f) => f.file), ...status.unstaged.map((f) => f.file)];

      const artifactFiles = allFiles.filter((f) => validateArtifactPath(f));

      return await this.commitArtifacts(artifactFiles, { message: null });
    } catch (error) {
      logger.error(`Failed to commit all: ${error.message}`);
      return { committed: false, reason: 'error', error: error.message };
    }
  }

  /**
   * Schedule a delayed commit
   *
   * @param {number} delay - Delay in milliseconds
   * @returns {Promise<Object>} Commit result after delay
   */
  async scheduleCommit(delay = 5000) {
    logger.debug(`Scheduling commit in ${delay}ms`);

    return new Promise((resolve) => {
      setTimeout(async () => {
        const result = await this.commitAll();
        resolve(result);
      }, delay).unref();
    });
  }

  /**
   * Get commit history
   *
   * @returns {Array<Object>} Commit history entries
   */
  getCommitHistory() {
    return [...this.commitHistory];
  }
}
