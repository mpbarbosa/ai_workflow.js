/**
 * @fileoverview Step 1 Incremental Processing (v2.0.0)
 * @module lib/step1_incremental
 *
 * Incremental documentation validation for Step 1 (Documentation Validation).
 * Tracks file hashes to skip unchanged documentation files between workflow runs.
 *
 * Architecture: v2.0.0 Referential Transparency
 * - Pure functions for hash calculation, change detection, filtering
 * - Impure wrapper class for file I/O, cache management, state tracking
 */

import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../core/logger.js';

/**
 * Default configuration
 */
export const DEFAULT_CONFIG = {
  cacheFile: '.ai_workflow/.incremental_cache/step1_docs.json',
  hashAlgorithm: 'sha256',
  encoding: 'hex',
  ignorePatterns: [
    '**/node_modules/**',
    '**/.git/**',
    '**/dist/**',
    '**/build/**',
    '**/coverage/**',
  ],
};

/**
 * Documentation file categories
 */
export const DOC_CATEGORIES = {
  README: 'readme',
  API: 'api',
  GUIDE: 'guide',
  REFERENCE: 'reference',
  CHANGELOG: 'changelog',
  CONTRIBUTING: 'contributing',
  LICENSE: 'license',
  OTHER: 'other',
};

/**
 * Validation priorities
 */
export const VALIDATION_PRIORITY = {
  CRITICAL: 3, // README, API docs
  HIGH: 2, // Guides, reference
  MEDIUM: 1, // Changelog, contributing
  LOW: 0, // License, other
};

// =============================================================================
// PURE FUNCTIONS
// =============================================================================

/**
 * Calculate SHA-256 hash of content
 * @pure
 * @param {string} content - File content
 * @param {string} algorithm - Hash algorithm (default: 'sha256')
 * @param {string} encoding - Encoding format (default: 'hex')
 * @returns {string} Hash digest
 */
export function calculateContentHash(content, algorithm = 'sha256', encoding = 'hex') {
  return crypto.createHash(algorithm).update(content).digest(encoding);
}

/**
 * Categorize documentation file by name/path
 * @pure
 * @param {string} filePath - File path
 * @returns {string} Category from DOC_CATEGORIES
 */
export function categorizeDocFile(filePath) {
  const basename = path.basename(filePath).toLowerCase();
  const dirpath = path.dirname(filePath).toLowerCase();

  // Check directory-based categories first (higher specificity)
  if (dirpath.includes('api')) return DOC_CATEGORIES.API;
  if (dirpath.includes('guide')) return DOC_CATEGORIES.GUIDE;
  if (dirpath.includes('reference')) return DOC_CATEGORIES.REFERENCE;

  // Then check basename patterns
  if (basename === 'readme.md') return DOC_CATEGORIES.README;
  if (basename === 'changelog.md') return DOC_CATEGORIES.CHANGELOG;
  if (basename === 'contributing.md') return DOC_CATEGORIES.CONTRIBUTING;
  if (basename.startsWith('license')) return DOC_CATEGORIES.LICENSE;

  // Finally check basename keywords
  if (basename.includes('api')) return DOC_CATEGORIES.API;
  if (basename.includes('guide')) return DOC_CATEGORIES.GUIDE;
  if (basename.includes('reference')) return DOC_CATEGORIES.REFERENCE;

  return DOC_CATEGORIES.OTHER;
}

/**
 * Get validation priority for a documentation category
 * @pure
 * @param {string} category - Category from DOC_CATEGORIES
 * @returns {number} Priority from VALIDATION_PRIORITY
 */
export function getValidationPriority(category) {
  switch (category) {
    case DOC_CATEGORIES.README:
    case DOC_CATEGORIES.API:
      return VALIDATION_PRIORITY.CRITICAL;
    case DOC_CATEGORIES.GUIDE:
    case DOC_CATEGORIES.REFERENCE:
      return VALIDATION_PRIORITY.HIGH;
    case DOC_CATEGORIES.CHANGELOG:
    case DOC_CATEGORIES.CONTRIBUTING:
      return VALIDATION_PRIORITY.MEDIUM;
    case DOC_CATEGORIES.LICENSE:
    case DOC_CATEGORIES.OTHER:
    default:
      return VALIDATION_PRIORITY.LOW;
  }
}

/**
 * Compare file hashes to detect changes
 * @pure
 * @param {Object} previousCache - Previous cache state {file: hash}
 * @param {Object} currentHashes - Current file hashes {file: hash}
 * @returns {Object} Change analysis with added, modified, removed, unchanged
 */
export function detectDocumentationChanges(previousCache, currentHashes) {
  const previousFiles = new Set(Object.keys(previousCache));
  const currentFiles = new Set(Object.keys(currentHashes));

  const added = [];
  const modified = [];
  const unchanged = [];
  const removed = [];

  // Check current files
  for (const file of currentFiles) {
    if (!previousFiles.has(file)) {
      added.push(file);
    } else if (previousCache[file] !== currentHashes[file]) {
      modified.push(file);
    } else {
      unchanged.push(file);
    }
  }

  // Check removed files
  for (const file of previousFiles) {
    if (!currentFiles.has(file)) {
      removed.push(file);
    }
  }

  return {
    added,
    modified,
    unchanged,
    removed,
    totalFiles: currentFiles.size,
    changedFiles: added.length + modified.length,
    unchangedFiles: unchanged.length,
  };
}

/**
 * Filter files by priority level
 * @pure
 * @param {Array<string>} files - File paths
 * @param {number} minPriority - Minimum priority level
 * @returns {Array<string>} Filtered files meeting priority threshold
 */
export function filterByPriority(files, minPriority) {
  return files.filter((file) => {
    const category = categorizeDocFile(file);
    const priority = getValidationPriority(category);
    return priority >= minPriority;
  });
}

/**
 * Group files by category
 * @pure
 * @param {Array<string>} files - File paths
 * @returns {Object} Files grouped by category
 */
export function groupByCategory(files) {
  const grouped = {};

  for (const category of Object.values(DOC_CATEGORIES)) {
    grouped[category] = [];
  }

  for (const file of files) {
    const category = categorizeDocFile(file);
    grouped[category].push(file);
  }

  return grouped;
}

/**
 * Calculate incremental validation statistics
 * @pure
 * @param {Object} changes - Change analysis from detectDocumentationChanges
 * @param {Array<string>} filesToValidate - Files that will be validated
 * @returns {Object} Statistics with speedup, skipRate, etc.
 */
export function calculateIncrementalStats(changes, filesToValidate) {
  const totalFiles = changes.totalFiles;
  const skippedFiles = totalFiles - filesToValidate.length;
  const skipRate = totalFiles > 0 ? (skippedFiles / totalFiles) * 100 : 0;
  const speedup = totalFiles > 0 ? totalFiles / Math.max(filesToValidate.length, 1) : 1;

  return {
    totalFiles,
    filesToValidate: filesToValidate.length,
    skippedFiles,
    skipRate: Math.round(skipRate * 10) / 10,
    speedup: Math.round(speedup * 10) / 10,
    changedFiles: changes.changedFiles,
    unchangedFiles: changes.unchangedFiles,
  };
}

/**
 * Sort files by priority (high to low)
 * @pure
 * @param {Array<string>} files - File paths
 * @returns {Array<string>} Sorted files
 */
export function sortByPriority(files) {
  return [...files].sort((a, b) => {
    const catA = categorizeDocFile(a);
    const catB = categorizeDocFile(b);
    const prioA = getValidationPriority(catA);
    const prioB = getValidationPriority(catB);
    return prioB - prioA; // High to low
  });
}

/**
 * Generate cache entry for a file
 * @pure
 * @param {string} filePath - File path
 * @param {string} hash - File hash
 * @param {number} timestamp - Timestamp in milliseconds
 * @returns {Object} Cache entry
 */
export function createCacheEntry(filePath, hash, timestamp) {
  return {
    path: filePath,
    hash,
    category: categorizeDocFile(filePath),
    priority: getValidationPriority(categorizeDocFile(filePath)),
    timestamp,
  };
}

/**
 * Validate cache structure
 * @pure
 * @param {any} cache - Cache object to validate
 * @returns {boolean} True if valid cache structure
 */
export function isValidCache(cache) {
  if (!cache || typeof cache !== 'object') return false;
  if (!cache.version || typeof cache.version !== 'string') return false;
  if (!cache.files || typeof cache.files !== 'object') return false;
  if (!cache.lastUpdate || typeof cache.lastUpdate !== 'number') return false;
  return true;
}

// =============================================================================
// IMPURE WRAPPER CLASS
// =============================================================================

/**
 * Step 1 Incremental Processor
 * Manages incremental validation of documentation files
 */
export class Step1IncrementalProcessor {
  /**
   * Create processor
   * @param {Object} config - Configuration options
   */
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cache = null;
    this.currentHashes = {};
  }

  /**
   * Load cache from disk
   * @async
   * @returns {Promise<Object>} Cache object or empty cache
   */
  async loadCache() {
    try {
      const cacheDir = path.dirname(this.config.cacheFile);
      await fs.mkdir(cacheDir, { recursive: true });

      const content = await fs.readFile(this.config.cacheFile, 'utf8');
      const cache = JSON.parse(content);

      if (!isValidCache(cache)) {
        logger.warn('Step1: Invalid cache structure, starting fresh');
        return this._createEmptyCache();
      }

      this.cache = cache;
      logger.info(`Step1: Loaded cache with ${Object.keys(cache.files).length} entries`);
      return cache;
    } catch (error) {
      if (error.code === 'ENOENT') {
        logger.info('Step1: No cache found, starting fresh');
      } else {
        logger.warn(`Step1: Failed to load cache: ${error.message}`);
      }
      this.cache = this._createEmptyCache();
      return this.cache;
    }
  }

  /**
   * Save cache to disk
   * @async
   * @returns {Promise<void>}
   */
  async saveCache() {
    try {
      const cacheDir = path.dirname(this.config.cacheFile);
      await fs.mkdir(cacheDir, { recursive: true });

      const content = JSON.stringify(this.cache, null, 2);
      await fs.writeFile(this.config.cacheFile, content, 'utf8');

      logger.info(`Step1: Saved cache with ${Object.keys(this.cache.files).length} entries`);
    } catch (error) {
      logger.error(`Step1: Failed to save cache: ${error.message}`);
      throw error;
    }
  }

  /**
   * Calculate hash for a file
   * @async
   * @param {string} filePath - File path
   * @returns {Promise<string>} File hash
   */
  async calculateFileHash(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return calculateContentHash(content, this.config.hashAlgorithm, this.config.encoding);
    } catch (error) {
      logger.warn(`Step1: Failed to read file ${filePath}: ${error.message}`);
      return null;
    }
  }

  /**
   * Calculate hashes for multiple files
   * @async
   * @param {Array<string>} files - File paths
   * @returns {Promise<Object>} File hashes {file: hash}
   */
  async calculateHashes(files) {
    const hashes = {};

    for (const file of files) {
      const hash = await this.calculateFileHash(file);
      if (hash !== null) {
        hashes[file] = hash;
      }
    }

    this.currentHashes = hashes;
    return hashes;
  }

  /**
   * Analyze changes since last run
   * @async
   * @param {Array<string>} files - Current documentation files
   * @returns {Promise<Object>} Change analysis
   */
  async analyzeChanges(files) {
    if (!this.cache) {
      await this.loadCache();
    }

    await this.calculateHashes(files);

    const changes = detectDocumentationChanges(this.cache.files, this.currentHashes);

    logger.info(
      `Step1: Detected ${changes.changedFiles} changed files, ${changes.unchangedFiles} unchanged`
    );

    return changes;
  }

  /**
   * Get files that need validation
   * @async
   * @param {Array<string>} files - All documentation files
   * @param {Object} options - Filtering options
   * @returns {Promise<Object>} Files to validate and statistics
   */
  async getFilesToValidate(files, options = {}) {
    const { minPriority = VALIDATION_PRIORITY.LOW, sortFiles = true } = options;

    const changes = await this.analyzeChanges(files);

    // Always validate added and modified files
    let filesToValidate = [...changes.added, ...changes.modified];

    // Apply priority filter
    if (minPriority > VALIDATION_PRIORITY.LOW) {
      filesToValidate = filterByPriority(filesToValidate, minPriority);
    }

    // Sort by priority
    if (sortFiles) {
      filesToValidate = sortByPriority(filesToValidate);
    }

    const stats = calculateIncrementalStats(changes, filesToValidate);

    return {
      files: filesToValidate,
      changes,
      stats,
    };
  }

  /**
   * Update cache after validation
   * @async
   * @param {Array<string>} validatedFiles - Files that were validated
   * @returns {Promise<void>}
   */
  async updateCache(validatedFiles) {
    if (!this.cache) {
      this.cache = this._createEmptyCache();
    }

    const now = Date.now();

    // Update cache with validated files
    for (const file of validatedFiles) {
      if (this.currentHashes[file]) {
        this.cache.files[file] = this.currentHashes[file];
      }
    }

    this.cache.lastUpdate = now;

    await this.saveCache();

    logger.info(`Step1: Updated cache with ${validatedFiles.length} validated files`);
  }

  /**
   * Clear cache
   * @async
   * @returns {Promise<void>}
   */
  async clearCache() {
    this.cache = this._createEmptyCache();
    await this.saveCache();
    logger.info('Step1: Cache cleared');
  }

  /**
   * Detect documentation files that have changed since last run
   * @async
   * @param {Array<string>} files - Current documentation files
   * @returns {Promise<Array<string>>} Changed (added/modified) file paths
   */
  async detectChangedDocs(files) {
    const result = await this.getFilesToValidate(files);
    return result.files;
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    if (!this.cache) {
      return {
        entries: 0,
        lastUpdate: null,
        categories: {},
      };
    }

    const files = Object.keys(this.cache.files);
    const grouped = groupByCategory(files);
    const categories = {};

    for (const [category, categoryFiles] of Object.entries(grouped)) {
      categories[category] = categoryFiles.length;
    }

    return {
      entries: files.length,
      lastUpdate: new Date(this.cache.lastUpdate).toISOString(),
      categories,
    };
  }

  /**
   * Create empty cache structure
   * @private
   * @returns {Object} Empty cache
   */
  _createEmptyCache() {
    return {
      version: '1.0.0',
      files: {},
      lastUpdate: Date.now(),
    };
  }
}
