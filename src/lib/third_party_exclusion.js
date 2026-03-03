/**
 * Third-Party Exclusion Module
 * @version 2.0.0
 * @description Exclude third-party files and directories from analysis
 * @module lib/third_party_exclusion
 * Part of: AI Workflow Automation v1.2.0 (Phase 4)
 */

import path from 'path';
import { FileOperations } from './file_operations.js';
import { logger } from '../core/logger.js';

// ============================================================================
// PURE FUNCTIONS (No I/O, testable)
// ============================================================================

/**
 * Get default exclusion patterns for a project kind
 * @param {string} projectKind - Project kind (nodejs_api, python_app, etc.)
 * @returns {Array<string>} Exclusion patterns
 * @pure
 */
export function getDefaultExclusionPatterns(projectKind) {
  const commonPatterns = [
    // Version control
    '.git/**',
    '.svn/**',
    '.hg/**',

    // IDE and editors
    '.vscode/**',
    '.idea/**',
    '.vs/**',
    '*.swp',
    '*.swo',
    '*~',

    // OS files
    '.DS_Store',
    'Thumbs.db',

    // Workflow artifacts
    '.ai_workflow/**',
    '.workflow_core/**',

    // Python virtual environments
    'venv/**',
    '.venv/**',
    'env/**',
  ];

  const languageSpecific = {
    nodejs_api: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'coverage/**',
      '.next/**',
      '.nuxt/**',
      'out/**',
      '*.min.js',
      '*.bundle.js',
    ],

    react_spa: [
      'node_modules/**',
      'build/**',
      'dist/**',
      '.next/**',
      'out/**',
      'coverage/**',
      '*.min.js',
      '*.bundle.js',
    ],

    client_spa: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'coverage/**',
      '*.min.js',
      '*.bundle.js',
    ],

    python_app: [
      'venv/**',
      'env/**',
      '.venv/**',
      '__pycache__/**',
      '*.pyc',
      '*.pyo',
      '*.pyd',
      '.pytest_cache/**',
      '.tox/**',
      '*.egg-info/**',
      'dist/**',
      'build/**',
      '.mypy_cache/**',
    ],

    shell_script_automation: ['*.log', 'tmp/**', 'temp/**'],

    static_website: ['node_modules/**', 'dist/**', 'build/**', '*.min.js', '*.min.css'],

    configuration_library: ['node_modules/**', 'dist/**', 'build/**'],

    generic: [],
  };

  const patterns = languageSpecific[projectKind] || languageSpecific.generic;
  return [...commonPatterns, ...patterns];
}

/**
 * Parse .gitignore file content into patterns
 * @param {string} gitignoreContent - Content of .gitignore file
 * @returns {Array<string>} Parsed patterns
 * @pure
 */
export function parseGitignorePatterns(gitignoreContent) {
  if (!gitignoreContent || typeof gitignoreContent !== 'string') {
    return [];
  }

  const lines = gitignoreContent.split('\n');
  const patterns = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    // Handle negation patterns (!)
    if (trimmed.startsWith('!')) {
      // For now, skip negation patterns (would need complex handling)
      continue;
    }

    // Convert to glob pattern
    let pattern = trimmed;

    // If pattern ends with /, it's a directory
    if (pattern.endsWith('/')) {
      pattern = pattern + '**';
    }

    // If pattern doesn't contain /, match in any directory
    if (!pattern.includes('/') && !pattern.startsWith('**/')) {
      pattern = '**/' + pattern;
    }

    patterns.push(pattern);
  }

  return patterns;
}

/**
 * Check if a file path matches any exclusion pattern
 * @param {string} filePath - Relative file path to check
 * @param {Array<string>} patterns - Exclusion patterns (glob-like)
 * @returns {Object} { excluded: boolean, matchedPattern: string|null }
 * @pure
 */
export function isExcluded(filePath, patterns) {
  if (!filePath || typeof filePath !== 'string') {
    return { excluded: false, matchedPattern: null };
  }

  if (!patterns || !Array.isArray(patterns)) {
    return { excluded: false, matchedPattern: null };
  }

  // Normalize path separators
  const normalizedPath = filePath.split(path.sep).join('/');

  for (const pattern of patterns) {
    if (matchesPattern(normalizedPath, pattern)) {
      return { excluded: true, matchedPattern: pattern };
    }
  }

  return { excluded: false, matchedPattern: null };
}

/**
 * Simple glob pattern matching
 * @param {string} filePath - Path to check
 * @param {string} pattern - Glob pattern
 * @returns {boolean} True if path matches pattern
 * @pure
 */
function matchesPattern(filePath, pattern) {
  // Use placeholders to handle glob wildcards before escaping special chars
  let regexPattern = pattern
    .replace(/\*\*\//g, '§§DIR§§') // Temporary placeholder for **/
    .replace(/\*\*/g, '§§ANY§§') // Temporary placeholder for **
    .replace(/\*/g, '§§STAR§§') // Temporary placeholder for *
    .replace(/\?/g, '§§QUEST§§') // Temporary placeholder for ?
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape regex special chars
    .replace(/§§DIR§§/g, '(?:.*/)?') // **/ matches zero or more dirs (optional /)
    .replace(/§§ANY§§/g, '.*') // ** matches anything
    .replace(/§§STAR§§/g, '[^/]*') // * matches anything except /
    .replace(/§§QUEST§§/g, '[^/]'); // ? matches single char except /

  // Anchor pattern
  regexPattern = '^' + regexPattern + '$';

  try {
    const regex = new RegExp(regexPattern);
    return regex.test(filePath);
  } catch {
    // If regex fails, do simple string matching
    return filePath.includes(pattern.replace(/\*+/g, ''));
  }
}

/**
 * Filter file list to remove excluded files
 * @param {Array<string>} files - List of file paths
 * @param {Array<string>} patterns - Exclusion patterns
 * @returns {Object} { included: Array<string>, excluded: Array<Object> }
 * @pure
 */
export function filterExcludedFiles(files, patterns) {
  if (!files || !Array.isArray(files)) {
    return { included: [], excluded: [] };
  }

  if (!patterns || !Array.isArray(patterns) || patterns.length === 0) {
    return { included: [...files], excluded: [] };
  }

  const included = [];
  const excluded = [];

  for (const file of files) {
    const result = isExcluded(file, patterns);

    if (result.excluded) {
      excluded.push({
        path: file,
        pattern: result.matchedPattern,
        reason: `Matches exclusion pattern: ${result.matchedPattern}`,
      });
    } else {
      included.push(file);
    }
  }

  return { included, excluded };
}

/**
 * Merge multiple pattern arrays into one, removing duplicates
 * @param {...Array<string>} patternArrays - Multiple arrays of patterns
 * @returns {Array<string>} Merged and deduplicated patterns
 * @pure
 */
export function mergeExclusionPatterns(...patternArrays) {
  const allPatterns = [];

  for (const patterns of patternArrays) {
    if (Array.isArray(patterns)) {
      allPatterns.push(...patterns);
    }
  }

  // Remove duplicates
  return [...new Set(allPatterns)];
}

/**
 * Generate exclusion report
 * @param {Object} filterResult - Result from filterExcludedFiles
 * @returns {string} Human-readable report
 * @pure
 */
export function generateExclusionReport(filterResult) {
  if (!filterResult || typeof filterResult !== 'object') {
    return 'No exclusion data available.';
  }

  const lines = [];

  lines.push('=== File Exclusion Report ===\n');

  const includedCount = filterResult.included?.length || 0;
  const excludedCount = filterResult.excluded?.length || 0;
  const totalCount = includedCount + excludedCount;

  lines.push(`Total files: ${totalCount}`);
  lines.push(`Included: ${includedCount} (${((includedCount / totalCount) * 100).toFixed(1)}%)`);
  lines.push(`Excluded: ${excludedCount} (${((excludedCount / totalCount) * 100).toFixed(1)}%)`);
  lines.push('');

  if (excludedCount > 0) {
    lines.push('Top exclusion patterns:');

    // Count by pattern
    const patternCounts = {};
    for (const item of filterResult.excluded) {
      const pattern = item.pattern || 'unknown';
      patternCounts[pattern] = (patternCounts[pattern] || 0) + 1;
    }

    // Sort by count
    const sorted = Object.entries(patternCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);

    for (const [pattern, count] of sorted) {
      lines.push(`  ${pattern}: ${count} files`);
    }
  }

  return lines.join('\n');
}

// ============================================================================
// I/O WRAPPER CLASS
// ============================================================================

/**
 * Third-Party Exclusion Manager
 * Manages exclusion patterns and filters files
 */
export class ThirdPartyExclusionManager {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.projectKind = options.projectKind || 'generic';
    this.fileOps = options.fileOps || new FileOperations({ dryRun: false });
    this.patterns = [];
    this.verbose = options.verbose || false;
  }

  /**
   * Initialize exclusion patterns
   * Loads default patterns, .gitignore, and custom patterns
   * @param {Array<string>} customPatterns - Additional custom patterns
   * @returns {Promise<void>}
   */
  async initialize(customPatterns = []) {
    if (this.verbose) {
      logger.info(`Initializing exclusion patterns for: ${this.projectKind}`);
    }

    // Get default patterns for project kind
    const defaultPatterns = getDefaultExclusionPatterns(this.projectKind);

    // Load .gitignore patterns
    const gitignorePatterns = await this.loadGitignorePatterns();

    // Merge all patterns
    this.patterns = mergeExclusionPatterns(defaultPatterns, gitignorePatterns, customPatterns);

    if (this.verbose) {
      logger.info(`Loaded ${this.patterns.length} exclusion patterns`);
    }
  }

  /**
   * Load and parse .gitignore file
   * @returns {Promise<Array<string>>} Parsed patterns
   */
  async loadGitignorePatterns() {
    const gitignorePath = path.join(this.projectRoot, '.gitignore');

    try {
      const exists = await this.fileOps.exists(gitignorePath);
      if (!exists) {
        return [];
      }

      const content = await this.fileOps.readFile(gitignorePath);
      const patterns = parseGitignorePatterns(content);

      if (this.verbose) {
        logger.info(`Loaded ${patterns.length} patterns from .gitignore`);
      }

      return patterns;
    } catch (error) {
      logger.warn(`Failed to load .gitignore: ${error.message}`);
      return [];
    }
  }

  /**
   * Check if a file should be excluded
   * @param {string} filePath - Relative file path
   * @returns {Object} Exclusion result
   */
  isExcluded(filePath) {
    const relativePath = path.relative(this.projectRoot, filePath);
    return isExcluded(relativePath, this.patterns);
  }

  /**
   * Filter a list of files
   * @param {Array<string>} files - List of file paths (absolute or relative)
   * @returns {Object} Filter result
   */
  filterFiles(files) {
    // Convert to relative paths
    const relativeFiles = files.map((f) => {
      if (path.isAbsolute(f)) {
        return path.relative(this.projectRoot, f);
      }
      return f;
    });

    return filterExcludedFiles(relativeFiles, this.patterns);
  }

  /**
   * Get all files in project, excluding third-party files
   * @returns {Promise<Array<string>>} Included files (absolute paths)
   */
  async getIncludedFiles() {
    if (this.verbose) {
      logger.info('Getting included files from project');
    }

    try {
      // Get all files
      const allFiles = await this.fileOps.listDirectoryRecursive(this.projectRoot);

      // Convert to relative paths for filtering
      const relativeFiles = allFiles.map((f) => path.relative(this.projectRoot, f));

      // Filter
      const result = filterExcludedFiles(relativeFiles, this.patterns);

      // Convert back to absolute paths
      const includedAbsolute = result.included.map((f) => path.join(this.projectRoot, f));

      if (this.verbose) {
        logger.info(
          `Filtered ${allFiles.length} files: ${includedAbsolute.length} included, ${result.excluded.length} excluded`
        );
      }

      return includedAbsolute;
    } catch (error) {
      logger.error(`Failed to get included files: ${error.message}`);
      return [];
    }
  }

  /**
   * Generate exclusion report
   * @returns {Promise<string>} Formatted report
   */
  async generateReport() {
    try {
      const allFiles = await this.fileOps.listDirectoryRecursive(this.projectRoot);
      const relativeFiles = allFiles.map((f) => path.relative(this.projectRoot, f));
      const result = filterExcludedFiles(relativeFiles, this.patterns);

      return generateExclusionReport(result);
    } catch (error) {
      return `Error generating report: ${error.message}`;
    }
  }

  /**
   * Get current exclusion patterns
   * @returns {Array<string>} Current patterns
   */
  getPatterns() {
    return [...this.patterns];
  }

  /**
   * Add custom exclusion patterns
   * @param {Array<string>} patterns - Patterns to add
   */
  addPatterns(patterns) {
    if (!Array.isArray(patterns)) {
      return;
    }

    this.patterns = mergeExclusionPatterns(this.patterns, patterns);

    if (this.verbose) {
      logger.info(`Added ${patterns.length} custom patterns`);
    }
  }
}
