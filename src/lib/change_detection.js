/**
 * @fileoverview Change Detection Module - Intelligent file change analysis
 *
 * Architecture: v2.0.0 (Referentially Transparent)
 * - Pure functions: Change categorization, impact analysis, pattern detection
 * - Impure wrapper: Change detection, Git integration
 *
 * @module lib/change_detection
 * @version 2.0.0
 */

import path from 'path';
import { logger } from '../core/logger.js';

// ============================================================================
// PURE FUNCTIONS - Exported for testing and reuse
// ============================================================================

/**
 * Categorize a single file based on its path and extension
 *
 * @param {string} filePath - File path to categorize
 * @param {string} projectKind - Project type for context
 * @returns {string} Category: 'code', 'test', 'docs', 'config', 'asset', 'unknown'
 *
 * @example
 * categorizeFile('src/app.js', 'nodejs_api')
 * // Returns: 'code'
 */
export function categorizeFile(filePath, _projectKind = 'generic') {
  if (!filePath || typeof filePath !== 'string') {
    return 'unknown';
  }

  const normalized = filePath.toLowerCase();
  const ext = path.extname(normalized);
  const basename = path.basename(normalized);
  const dirname = path.dirname(normalized);

  // Test files
  if (
    normalized.includes('.test.') ||
    normalized.includes('.spec.') ||
    normalized.includes('__tests__') ||
    dirname.includes('test')
  ) {
    return 'test';
  }

  // Documentation
  if (
    ext === '.md' ||
    dirname.includes('docs') ||
    dirname.includes('documentation') ||
    basename === 'readme.md' ||
    basename === 'changelog.md' ||
    basename === 'contributing.md'
  ) {
    return 'docs';
  }

  // Configuration files
  if (
    ext === '.yaml' ||
    ext === '.yml' ||
    ext === '.json' ||
    ext === '.toml' ||
    basename.includes('config') ||
    basename === '.gitignore' ||
    basename === '.eslintrc' ||
    basename.startsWith('.')
  ) {
    return 'config';
  }

  // Code files (language-specific)
  const codeExtensions = [
    '.js',
    '.ts',
    '.jsx',
    '.tsx',
    '.py',
    '.java',
    '.go',
    '.rs',
    '.c',
    '.cpp',
    '.sh',
  ];
  if (codeExtensions.includes(ext)) {
    return 'code';
  }

  // Asset files
  const assetExtensions = [
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.svg',
    '.ico',
    '.css',
    '.scss',
    '.less',
  ];
  if (assetExtensions.includes(ext)) {
    return 'asset';
  }

  return 'unknown';
}

/**
 * Analyze changes across multiple files
 *
 * @param {Array<Object>} files - Array of file change objects
 * @returns {Object} Analysis with categories, impact, summary
 *
 * @example
 * analyzeChanges([{ file: 'src/app.js', status: 'modified' }])
 * // Returns: { categories: {...}, impact: 'medium', summary: '...' }
 */
export function analyzeChanges(files) {
  if (!Array.isArray(files)) {
    return { categories: {}, impact: 'none', summary: 'No changes' };
  }

  const categories = {
    code: [],
    test: [],
    docs: [],
    config: [],
    asset: [],
    unknown: [],
  };

  for (const fileObj of files) {
    if (!fileObj || !fileObj.file) continue;

    const category = categorizeFile(fileObj.file);
    categories[category].push(fileObj.file);
  }

  const impact = calculateChangeImpact(categories);
  const summary = buildChangeSummary(categories);

  return { categories, impact, summary };
}

/**
 * Calculate overall impact of changes
 *
 * @param {Object} categories - Categorized file changes
 * @returns {string} Impact level: 'high', 'medium', 'low', 'none'
 *
 * @example
 * calculateChangeImpact({ code: ['a.js', 'b.js'], test: ['a.test.js'] })
 * // Returns: 'medium'
 */
export function calculateChangeImpact(categories) {
  if (!categories || typeof categories !== 'object') {
    return 'none';
  }

  const codeCount = (categories.code || []).length;
  const testCount = (categories.test || []).length;
  const configCount = (categories.config || []).length;

  // High impact: Many code changes or critical config changes
  if (codeCount > 5 || configCount > 3) {
    return 'high';
  }

  // Medium impact: Some code changes
  if (codeCount > 0 || (testCount > 3 && configCount > 0)) {
    return 'medium';
  }

  // Low impact: Only docs/tests/assets
  if (testCount > 0 || (categories.docs || []).length > 0 || (categories.asset || []).length > 0) {
    return 'low';
  }

  return 'none';
}

/**
 * Detect change type from diff content
 *
 * @param {string} diff - Git diff output
 * @returns {string} Change type: 'refactor', 'feature', 'bugfix', 'chore'
 *
 * @example
 * detectChangeType('+function newFeature() {...}')
 * // Returns: 'feature'
 */
export function detectChangeType(diff) {
  if (!diff || typeof diff !== 'string') {
    return 'chore';
  }

  const lower = diff.toLowerCase();

  // Refactor indicators (function name changes, imports reorganization)
  // Check refactor BEFORE feature to avoid false positives with +function
  if (
    lower.includes('refactor:') ||
    (lower.includes('-function') && lower.includes('+function')) ||
    lower.includes('renamed')
  ) {
    return 'refactor';
  }

  // Feature indicators
  if (
    lower.includes('+function') ||
    lower.includes('+export function') ||
    lower.includes('+class') ||
    lower.includes('feat:') ||
    lower.includes('feature:')
  ) {
    return 'feature';
  }

  // Bugfix indicators
  if (
    lower.includes('fix:') ||
    lower.includes('bugfix:') ||
    lower.includes('fixed') ||
    lower.includes('bug')
  ) {
    return 'bugfix';
  }

  return 'chore';
}

/**
 * Filter files by category
 *
 * @param {Array<string>} files - Array of file paths
 * @param {string} category - Category to filter by
 * @returns {Array<string>} Filtered files
 *
 * @example
 * filterByCategory(['src/app.js', 'README.md'], 'code')
 * // Returns: ['src/app.js']
 */
export function filterByCategory(files, category) {
  if (!Array.isArray(files) || !category) {
    return [];
  }

  return files.filter((file) => categorizeFile(file) === category);
}

/**
 * Group files by parent directory
 *
 * @param {Array<string>} files - Array of file paths
 * @returns {Object} Files grouped by directory
 *
 * @example
 * groupByDirectory(['src/app.js', 'src/utils.js', 'test/app.test.js'])
 * // Returns: { 'src/': ['src/app.js', 'src/utils.js'], 'test/': ['test/app.test.js'] }
 */
export function groupByDirectory(files) {
  if (!Array.isArray(files)) {
    return {};
  }

  const groups = {};

  for (const file of files) {
    if (!file || typeof file !== 'string') continue;

    const dir = path.dirname(file) + '/';
    if (!groups[dir]) {
      groups[dir] = [];
    }
    groups[dir].push(file);
  }

  return groups;
}

/**
 * Calculate test coverage impact from code changes
 *
 * @param {Object} changes - Categorized changes
 * @returns {Object} Coverage impact with affected files and confidence
 *
 * @example
 * calculateCoverageImpact({ code: ['src/app.js'], test: [] })
 * // Returns: { affected: ['src/app.js'], confidence: 0.5 }
 */
export function calculateCoverageImpact(changes) {
  if (!changes || typeof changes !== 'object') {
    return { affected: [], confidence: 0 };
  }

  const codeFiles = changes.code || [];
  const testFiles = changes.test || [];

  const affected = [...codeFiles];

  // Calculate confidence based on test/code ratio
  let confidence = 0;
  if (codeFiles.length > 0) {
    const ratio = testFiles.length / codeFiles.length;
    confidence = Math.min(ratio, 1.0);
  } else {
    confidence = 1.0; // No code changes means no impact
  }

  return { affected, confidence };
}

/**
 * Identify related test files for a code file
 *
 * @param {string} codeFile - Code file path
 * @param {string} testPattern - Test file pattern (e.g., '.test.js')
 * @returns {Array<string>} Related test file paths
 *
 * @example
 * identifyRelatedTests('src/app.js', '.test.js')
 * // Returns: ['src/app.test.js', 'test/app.test.js']
 */
export function identifyRelatedTests(codeFile, testPattern = '.test.js') {
  if (!codeFile || typeof codeFile !== 'string') {
    return [];
  }

  const ext = path.extname(codeFile);
  const basename = path.basename(codeFile, ext);
  const dirname = path.dirname(codeFile);

  const candidates = [
    // Same directory
    path.join(dirname, `${basename}${testPattern}`),
    // test/ subdirectory
    path.join(dirname, 'test', `${basename}${testPattern}`),
    // __tests__ subdirectory
    path.join(dirname, '__tests__', `${basename}${testPattern}`),
    // Root test/ directory
    path.join('test', dirname, `${basename}${testPattern}`),
  ];

  return candidates;
}

/**
 * Build human-readable change summary
 *
 * @param {Object} categories - Categorized changes
 * @returns {string} Summary text
 *
 * @example
 * buildChangeSummary({ code: ['a.js', 'b.js'], test: ['a.test.js'] })
 * // Returns: '2 code files, 1 test file changed'
 */
export function buildChangeSummary(categories) {
  if (!categories || typeof categories !== 'object') {
    return 'No changes';
  }

  const parts = [];

  const counts = {
    code: (categories.code || []).length,
    test: (categories.test || []).length,
    docs: (categories.docs || []).length,
    config: (categories.config || []).length,
    asset: (categories.asset || []).length,
  };

  if (counts.code > 0) {
    parts.push(`${counts.code} code file${counts.code > 1 ? 's' : ''}`);
  }
  if (counts.test > 0) {
    parts.push(`${counts.test} test file${counts.test > 1 ? 's' : ''}`);
  }
  if (counts.docs > 0) {
    parts.push(`${counts.docs} doc${counts.docs > 1 ? 's' : ''}`);
  }
  if (counts.config > 0) {
    parts.push(`${counts.config} config file${counts.config > 1 ? 's' : ''}`);
  }
  if (counts.asset > 0) {
    parts.push(`${counts.asset} asset${counts.asset > 1 ? 's' : ''}`);
  }

  if (parts.length === 0) {
    return 'No changes';
  }

  return parts.join(', ') + ' changed';
}

/**
 * Determine if workflow step can be skipped based on changes
 *
 * @param {string} stepId - Workflow step identifier
 * @param {Object} changes - Categorized changes
 * @returns {boolean} True if step can be skipped
 *
 * @example
 * shouldSkipStep('run_tests', { code: [], test: [], docs: ['README.md'] })
 * // Returns: true (no code/test changes)
 */
export function shouldSkipStep(stepId, changes) {
  if (!stepId || !changes || typeof changes !== 'object') {
    return false; // Don't skip if uncertain
  }

  const hasCodeChanges = (changes.code || []).length > 0;
  const hasTestChanges = (changes.test || []).length > 0;
  const hasDocChanges = (changes.docs || []).length > 0;
  const hasConfigChanges = (changes.config || []).length > 0;

  switch (stepId) {
    case 'run_tests':
    case 'test':
      // Skip tests if only docs/assets changed
      return !hasCodeChanges && !hasTestChanges && !hasConfigChanges;

    case 'lint':
    case 'format':
      // Skip linting if only docs changed
      return !hasCodeChanges && !hasTestChanges && !hasConfigChanges;

    case 'update_docs':
    case 'generate_docs':
      // Skip docs generation if no code changes
      return !hasCodeChanges && !hasDocChanges;

    case 'build':
    case 'compile':
      // Skip build if only docs/tests changed
      return !hasCodeChanges && !hasConfigChanges;

    default:
      // Don't skip unknown steps
      return false;
  }
}

/**
 * Merge two change analysis objects
 *
 * @param {Object} analysis1 - First analysis
 * @param {Object} analysis2 - Second analysis
 * @returns {Object} Merged analysis
 *
 * @example
 * mergeChangeAnalysis(
 *   { categories: { code: ['a.js'] }, impact: 'low' },
 *   { categories: { code: ['b.js'] }, impact: 'medium' }
 * )
 * // Returns: { categories: { code: ['a.js', 'b.js'] }, impact: 'medium' }
 */
export function mergeChangeAnalysis(analysis1, analysis2) {
  const a1 = analysis1 || { categories: {}, impact: 'none' };
  const a2 = analysis2 || { categories: {}, impact: 'none' };

  const merged = {
    categories: {},
    impact: 'none',
  };

  // Merge categories
  const allCategories = ['code', 'test', 'docs', 'config', 'asset', 'unknown'];
  for (const cat of allCategories) {
    const files1 = a1.categories?.[cat] || [];
    const files2 = a2.categories?.[cat] || [];
    merged.categories[cat] = [...new Set([...files1, ...files2])];
  }

  // Take higher impact
  const impacts = ['none', 'low', 'medium', 'high'];
  const impact1Index = impacts.indexOf(a1.impact);
  const impact2Index = impacts.indexOf(a2.impact);
  merged.impact = impacts[Math.max(impact1Index, impact2Index)];

  merged.summary = buildChangeSummary(merged.categories);

  return merged;
}

/**
 * Validate change detection data
 *
 * @param {Object} data - Change data to validate
 * @returns {Object} Validation result { valid, errors }
 *
 * @example
 * validateChangeData({ categories: { code: ['a.js'] }, impact: 'medium' })
 * // Returns: { valid: true, errors: [] }
 */
export function validateChangeData(data) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Change data must be an object'] };
  }

  // Validate categories
  if (!data.categories || typeof data.categories !== 'object') {
    errors.push('Categories must be an object');
  } else {
    const validCategories = ['code', 'test', 'docs', 'config', 'asset', 'unknown'];
    for (const [key, value] of Object.entries(data.categories)) {
      if (!validCategories.includes(key)) {
        errors.push(`Invalid category: ${key}`);
      }
      if (!Array.isArray(value)) {
        errors.push(`Category '${key}' must be an array`);
      }
    }
  }

  // Validate impact
  if (data.impact !== undefined) {
    const validImpacts = ['none', 'low', 'medium', 'high'];
    if (!validImpacts.includes(data.impact)) {
      errors.push(`Invalid impact: ${data.impact}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================================
// IMPURE WRAPPER CLASS - Handles I/O and side effects
// ============================================================================

/**
 * Change Detector - Intelligent file change analysis for workflow optimization
 *
 * Features:
 * - Categorizes changes by type (code, test, docs, config, asset)
 * - Calculates impact level (high, medium, low, none)
 * - Identifies related test files
 * - Determines which workflow steps to run/skip
 *
 * @class ChangeDetector
 *
 * @example
 * const detector = new ChangeDetector({
 *   gitAutomation,
 *   projectKind: 'nodejs_api'
 * });
 *
 * const changes = await detector.detectChanges();
 * console.log(changes.summary); // '3 code files, 2 test files changed'
 */
export class ChangeDetector {
  /**
   * Create a new change detector instance
   *
   * @param {Object} options - Detector options
   * @param {Object} options.gitAutomation - GitAutomation instance
   * @param {string} options.projectKind - Project type
   * @param {Object} options.cache - Optional cache instance
   */
  constructor(options = {}) {
    this.gitAutomation = options.gitAutomation;
    this.projectKind = options.projectKind || 'generic';
    this.cache = options.cache;
    this.lastAnalysis = null;
  }

  /**
   * Detect changes since a specific commit or tag
   *
   * @param {string} sinceCommit - Commit hash or tag (default: HEAD)
   * @returns {Promise<Object>} Change analysis
   */
  async detectChanges(_sinceCommit = 'HEAD') {
    if (!this.gitAutomation) {
      logger.warn('No GitAutomation instance provided');
      return { categories: {}, impact: 'none', summary: 'No changes' };
    }

    try {
      // Get git status
      const status = await this.gitAutomation.status();

      const files = [
        ...status.staged.map((f) => ({ file: f.file, status: 'staged' })),
        ...status.unstaged.map((f) => ({ file: f.file, status: 'unstaged' })),
        ...status.untracked.map((f) => ({ file: f, status: 'untracked' })),
      ];

      const analysis = analyzeChanges(files);
      this.lastAnalysis = analysis;

      logger.info(`Detected changes: ${analysis.summary}`);
      return analysis;
    } catch (error) {
      logger.error(`Failed to detect changes: ${error.message}`);
      return { categories: {}, impact: 'none', summary: 'Error detecting changes' };
    }
  }

  /**
   * Analyze impact of current changes
   *
   * @returns {Promise<Object>} Impact analysis
   */
  async analyzeImpact() {
    if (!this.lastAnalysis) {
      await this.detectChanges();
    }

    const impact = this.lastAnalysis?.impact || 'none';
    const coverage = calculateCoverageImpact(this.lastAnalysis?.categories || {});

    return {
      level: impact,
      coverage,
      shouldRunTests: impact !== 'none',
      shouldUpdateDocs: (this.lastAnalysis?.categories?.code || []).length > 0,
    };
  }

  /**
   * Get workflow steps that should be executed based on changes
   *
   * @returns {Promise<Array<string>>} Array of step IDs to execute
   */
  async getAffectedSteps() {
    if (!this.lastAnalysis) {
      await this.detectChanges();
    }

    const steps = [
      'validate_config',
      'lint',
      'run_tests',
      'build',
      'update_docs',
      'generate_metrics',
    ];

    const affected = steps.filter(
      (step) => !shouldSkipStep(step, this.lastAnalysis?.categories || {})
    );

    logger.debug(`Affected steps: ${affected.join(', ')}`);
    return affected;
  }

  /**
   * Categorize all changed files
   *
   * @returns {Promise<Object>} Categorized files
   */
  async categorizeChanges() {
    if (!this.lastAnalysis) {
      await this.detectChanges();
    }

    return this.lastAnalysis?.categories || {};
  }

  /**
   * Get formatted change summary
   *
   * @returns {Promise<string>} Change summary text
   */
  async getChangesSummary() {
    if (!this.lastAnalysis) {
      await this.detectChanges();
    }

    return this.lastAnalysis?.summary || 'No changes';
  }

  /**
   * Determine if tests should run based on changes
   *
   * @returns {Promise<boolean>} True if tests should run
   */
  async shouldRunTests() {
    if (!this.lastAnalysis) {
      await this.detectChanges();
    }

    const categories = this.lastAnalysis?.categories || {};
    return !shouldSkipStep('run_tests', categories);
  }

  /**
   * Determine if documentation should be updated
   *
   * @returns {Promise<boolean>} True if docs should update
   */
  async shouldUpdateDocs() {
    if (!this.lastAnalysis) {
      await this.detectChanges();
    }

    const categories = this.lastAnalysis?.categories || {};
    const hasCodeChanges = (categories.code || []).length > 0;
    const hasDocChanges = (categories.docs || []).length > 0;

    // Update docs if code changed OR docs changed
    return hasCodeChanges || hasDocChanges;
  }
}
