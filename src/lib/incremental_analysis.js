/**
 * @fileoverview Incremental Analysis Module (v2.0.0)
 *
 * Provides file-level change detection for incremental processing.
 * Implements hash-based comparison to identify changed files and optimize workflow execution.
 *
 * Architecture: Referential Transparency (v2.0.0)
 * - Pure functions for hash calculation, change detection, and analysis
 * - IncrementalAnalyzer wrapper class for state management and I/O
 *
 * @module lib/incremental_analysis
 * @version 2.0.0
 */

import crypto from 'crypto';
import path from 'path';
import { FileOperations } from './file_operations.js';
import logger from '../core/logger.js';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default configuration for incremental analysis
 * @constant {Object}
 */
export const DEFAULT_CONFIG = {
  HASH_ALGORITHM: 'sha256',
  HASH_ENCODING: 'hex',
  HASH_FILE: '.incremental_hashes.json',
  CHANGE_THRESHOLD: 0.1, // 10% change threshold for reanalysis
};

/**
 * Change types for file categorization
 * @constant {Object}
 */
export const CHANGE_TYPES = {
  ADDED: 'added',
  MODIFIED: 'modified',
  DELETED: 'deleted',
  UNCHANGED: 'unchanged',
};

// ============================================================================
// PURE FUNCTIONS - Hash Calculation
// ============================================================================

/**
 * Calculate hash of file content
 * @pure
 * @param {string} content - File content to hash
 * @param {string} algorithm - Hash algorithm (default: 'sha256')
 * @param {string} encoding - Output encoding (default: 'hex')
 * @returns {string} Hash string
 */
export function calculateFileHash(content, algorithm = 'sha256', encoding = 'hex') {
  if (typeof content !== 'string') {
    throw new TypeError('Content must be a string');
  }
  return crypto.createHash(algorithm).update(content, 'utf8').digest(encoding);
}

/**
 * Calculate hashes for multiple files
 * @pure
 * @param {Object<string, string>} fileContents - Map of filepath -> content
 * @param {string} algorithm - Hash algorithm
 * @param {string} encoding - Output encoding
 * @returns {Object<string, string>} Map of filepath -> hash
 */
export function calculateFileHashes(fileContents, algorithm = 'sha256', encoding = 'hex') {
  const hashes = {};
  for (const [filepath, content] of Object.entries(fileContents)) {
    hashes[filepath] = calculateFileHash(content, algorithm, encoding);
  }
  return hashes;
}

// ============================================================================
// PURE FUNCTIONS - Change Detection
// ============================================================================

/**
 * Compare two hashes to determine if content changed
 * @pure
 * @param {string|undefined} oldHash - Previous hash (undefined if new file)
 * @param {string|undefined} newHash - Current hash (undefined if deleted file)
 * @returns {boolean} True if changed, false otherwise
 */
export function hasHashChanged(oldHash, newHash) {
  if (oldHash === undefined && newHash === undefined) {
    return false; // Both missing -> no change
  }
  if (oldHash === undefined || newHash === undefined) {
    return true; // One missing -> changed (added or deleted)
  }
  return oldHash !== newHash;
}

/**
 * Categorize file change type based on hash comparison
 * @pure
 * @param {string|undefined} oldHash - Previous hash
 * @param {string|undefined} newHash - Current hash
 * @returns {string} Change type (ADDED, MODIFIED, DELETED, UNCHANGED)
 */
export function categorizeFileChange(oldHash, newHash) {
  if (oldHash === undefined && newHash !== undefined) {
    return CHANGE_TYPES.ADDED;
  }
  if (oldHash !== undefined && newHash === undefined) {
    return CHANGE_TYPES.DELETED;
  }
  if (oldHash !== newHash) {
    return CHANGE_TYPES.MODIFIED;
  }
  return CHANGE_TYPES.UNCHANGED;
}

/**
 * Detect changed files by comparing hash maps
 * @pure
 * @param {Object<string, string>} oldHashes - Previous hashes
 * @param {Object<string, string>} newHashes - Current hashes
 * @returns {Object} Change details with categorized files
 */
export function detectFileChanges(oldHashes = {}, newHashes = {}) {
  const changes = {
    [CHANGE_TYPES.ADDED]: [],
    [CHANGE_TYPES.MODIFIED]: [],
    [CHANGE_TYPES.DELETED]: [],
    [CHANGE_TYPES.UNCHANGED]: [],
  };

  // Check all files in both old and new
  const allFiles = new Set([...Object.keys(oldHashes), ...Object.keys(newHashes)]);

  for (const filepath of allFiles) {
    const oldHash = oldHashes[filepath];
    const newHash = newHashes[filepath];
    const changeType = categorizeFileChange(oldHash, newHash);
    changes[changeType].push(filepath);
  }

  return changes;
}

// ============================================================================
// PURE FUNCTIONS - Change Analysis
// ============================================================================

/**
 * Calculate change statistics from detected changes
 * @pure
 * @param {Object} changes - Change details from detectFileChanges
 * @returns {Object} Statistics summary
 */
export function calculateChangeStats(changes) {
  const addedCount = changes[CHANGE_TYPES.ADDED]?.length || 0;
  const modifiedCount = changes[CHANGE_TYPES.MODIFIED]?.length || 0;
  const deletedCount = changes[CHANGE_TYPES.DELETED]?.length || 0;
  const unchangedCount = changes[CHANGE_TYPES.UNCHANGED]?.length || 0;

  const totalFiles = addedCount + modifiedCount + deletedCount + unchangedCount;
  const changedFiles = addedCount + modifiedCount + deletedCount;
  const changePercentage = totalFiles > 0 ? (changedFiles / totalFiles) * 100 : 0;

  return {
    total: totalFiles,
    changed: changedFiles,
    unchanged: unchangedCount,
    added: addedCount,
    modified: modifiedCount,
    deleted: deletedCount,
    changePercentage: Math.round(changePercentage * 100) / 100,
  };
}

/**
 * Filter files by change type
 * @pure
 * @param {Object} changes - Change details from detectFileChanges
 * @param {string[]} types - Change types to include
 * @returns {string[]} Filtered file list
 */
export function filterFilesByChangeType(changes, types) {
  if (!Array.isArray(types) || types.length === 0) {
    return [];
  }

  const filtered = [];
  for (const type of types) {
    if (changes[type]) {
      filtered.push(...changes[type]);
    }
  }

  return filtered;
}

/**
 * Determine if reanalysis is needed based on change threshold
 * @pure
 * @param {Object} stats - Change statistics
 * @param {number} threshold - Change percentage threshold (0-1)
 * @returns {boolean} True if reanalysis needed
 */
export function shouldReanalyze(stats, threshold = 0.1) {
  if (typeof threshold !== 'number' || threshold < 0 || threshold > 1) {
    throw new RangeError('Threshold must be a number between 0 and 1');
  }
  return stats.changePercentage > threshold * 100;
}

/**
 * Build change report for logging/output
 * @pure
 * @param {Object} changes - Change details
 * @param {Object} stats - Change statistics
 * @returns {Object} Formatted report
 */
export function buildChangeReport(changes, stats) {
  return {
    summary: {
      total: stats.total,
      changed: stats.changed,
      unchanged: stats.unchanged,
      changePercentage: `${stats.changePercentage}%`,
    },
    details: {
      added: {
        count: stats.added,
        files: changes[CHANGE_TYPES.ADDED] || [],
      },
      modified: {
        count: stats.modified,
        files: changes[CHANGE_TYPES.MODIFIED] || [],
      },
      deleted: {
        count: stats.deleted,
        files: changes[CHANGE_TYPES.DELETED] || [],
      },
    },
    needsReanalysis: stats.changePercentage > DEFAULT_CONFIG.CHANGE_THRESHOLD * 100,
  };
}

// ============================================================================
// PURE FUNCTIONS - Hash Storage
// ============================================================================

/**
 * Serialize hashes to JSON format
 * @pure
 * @param {Object<string, string>} hashes - Hash map
 * @param {number} timestamp - Timestamp in seconds
 * @returns {string} JSON string
 */
export function serializeHashes(hashes, timestamp) {
  return JSON.stringify(
    {
      version: '2.0.0',
      timestamp,
      hashes,
    },
    null,
    2
  );
}

/**
 * Parse hashes from JSON format
 * @pure
 * @param {string} json - JSON string
 * @returns {Object} Parsed hash data
 */
export function parseHashes(json) {
  if (typeof json !== 'string' || json.trim() === '') {
    throw new TypeError('JSON must be a non-empty string');
  }

  const data = JSON.parse(json);

  if (!data.version || !data.timestamp || !data.hashes) {
    throw new Error('Invalid hash file format: missing required fields');
  }

  return {
    version: data.version,
    timestamp: data.timestamp,
    hashes: data.hashes,
  };
}

/**
 * Validate hash file format
 * @pure
 * @param {Object} data - Parsed hash data
 * @returns {boolean} True if valid
 */
export function validateHashData(data) {
  if (!data || typeof data !== 'object') {
    return false;
  }
  if (!data.version || typeof data.version !== 'string') {
    return false;
  }
  if (!data.timestamp || typeof data.timestamp !== 'number') {
    return false;
  }
  if (!data.hashes || typeof data.hashes !== 'object') {
    return false;
  }
  return true;
}

// ============================================================================
// INCREMENTAL ANALYZER CLASS (Impure Wrapper)
// ============================================================================

/**
 * Incremental Analyzer
 * Manages file hash tracking and change detection for incremental processing
 */
export class IncrementalAnalyzer {
  /**
   * Create incremental analyzer
   * @param {Object} options - Configuration options
   * @param {FileOperations} options.fileOps - File operations instance
   * @param {string} options.hashFile - Path to hash storage file
   * @param {number} options.changeThreshold - Change threshold for reanalysis
   */
  constructor(options = {}) {
    this.fileOps = options.fileOps || new FileOperations();
    this.hashFile = options.hashFile || DEFAULT_CONFIG.HASH_FILE;
    this.changeThreshold = options.changeThreshold || DEFAULT_CONFIG.CHANGE_THRESHOLD;

    this.currentHashes = {};
    this.previousHashes = {};
    this.changes = null;
    this.stats = null;
  }

  /**
   * Calculate hashes for files in directory
   * @param {string} directory - Directory to scan
   * @param {string[]} _patterns - File patterns to include (currently unused, scans all files)
   * @returns {Promise<Object<string, string>>} Hash map
   */
  async calculateHashes(directory, _patterns = ['**/*']) {
    try {
      // Read all files recursively (returns relative paths)
      const relativePaths = await this.fileOps.listDirectoryRecursive(directory, { files: true });
      const fileContents = {};

      for (const relativePath of relativePaths) {
        const fullPath = path.isAbsolute(relativePath)
          ? relativePath
          : path.join(directory, relativePath);
        const content = await this.fileOps.readFile(fullPath);

        // Normalize path to relative (strip directory prefix if present)
        const normalizedPath = path.isAbsolute(relativePath)
          ? path.relative(directory, relativePath)
          : relativePath;

        fileContents[normalizedPath] = content;
      }

      // Calculate hashes (pure function)
      this.currentHashes = calculateFileHashes(fileContents);

      logger.debug(`Calculated hashes for ${relativePaths.length} files`);
      return this.currentHashes;
    } catch (error) {
      logger.error(`Failed to calculate hashes: ${error.message}`);
      throw error;
    }
  }

  /**
   * Load previous hashes from storage
   * @param {string} hashFilePath - Path to hash file (optional, uses default if not provided)
   * @returns {Promise<Object<string, string>>} Previous hashes
   */
  async loadPreviousHashes(hashFilePath = null) {
    const filePath = hashFilePath || this.hashFile;

    try {
      const exists = await this.fileOps.exists(filePath);
      if (!exists) {
        logger.debug('No previous hash file found');
        this.previousHashes = {};
        return this.previousHashes;
      }

      const json = await this.fileOps.readFile(filePath);
      const data = parseHashes(json); // Pure function

      if (!validateHashData(data)) {
        throw new Error('Invalid hash file format');
      }

      this.previousHashes = data.hashes;
      logger.debug(`Loaded ${Object.keys(this.previousHashes).length} previous hashes`);
      return this.previousHashes;
    } catch (error) {
      logger.warn(`Failed to load previous hashes: ${error.message}`);
      this.previousHashes = {};
      return this.previousHashes;
    }
  }

  /**
   * Save current hashes to storage
   * @param {string} hashFilePath - Path to hash file (optional)
   * @returns {Promise<void>}
   */
  async saveHashes(hashFilePath = null) {
    const filePath = hashFilePath || this.hashFile;

    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const json = serializeHashes(this.currentHashes, timestamp); // Pure function

      await this.fileOps.writeFile(filePath, json);
      logger.debug(`Saved ${Object.keys(this.currentHashes).length} hashes to ${filePath}`);
    } catch (error) {
      logger.error(`Failed to save hashes: ${error.message}`);
      throw error;
    }
  }

  /**
   * Detect changes between current and previous hashes
   * @returns {Object} Change details
   */
  detectChanges() {
    this.changes = detectFileChanges(this.previousHashes, this.currentHashes); // Pure function
    this.stats = calculateChangeStats(this.changes); // Pure function

    logger.info(
      `Detected changes: ${this.stats.added} added, ${this.stats.modified} modified, ${this.stats.deleted} deleted`
    );

    return this.changes;
  }

  /**
   * Get change statistics
   * @returns {Object} Change statistics
   */
  getChangeStats() {
    if (!this.stats) {
      throw new Error('No changes detected yet. Call detectChanges() first.');
    }
    return this.stats;
  }

  /**
   * Get change report
   * @returns {Object} Formatted change report
   */
  getChangeReport() {
    if (!this.changes || !this.stats) {
      throw new Error('No changes detected yet. Call detectChanges() first.');
    }
    return buildChangeReport(this.changes, this.stats); // Pure function
  }

  /**
   * Check if reanalysis is needed
   * @returns {boolean} True if reanalysis needed
   */
  needsReanalysis() {
    if (!this.stats) {
      throw new Error('No changes detected yet. Call detectChanges() first.');
    }
    return shouldReanalyze(this.stats, this.changeThreshold); // Pure function
  }

  /**
   * Get changed files (added + modified + deleted)
   * @returns {string[]} List of changed files
   */
  getChangedFiles() {
    if (!this.changes) {
      throw new Error('No changes detected yet. Call detectChanges() first.');
    }
    return filterFilesByChangeType(this.changes, [
      CHANGE_TYPES.ADDED,
      CHANGE_TYPES.MODIFIED,
      CHANGE_TYPES.DELETED,
    ]);
  }

  /**
   * Get files by change type
   * @param {string} changeType - Change type to filter by
   * @returns {string[]} List of files
   */
  getFilesByType(changeType) {
    if (!this.changes) {
      throw new Error('No changes detected yet. Call detectChanges() first.');
    }
    return this.changes[changeType] || [];
  }

  /**
   * Reset analyzer state
   */
  reset() {
    this.currentHashes = {};
    this.previousHashes = {};
    this.changes = null;
    this.stats = null;
    logger.debug('Analyzer state reset');
  }
}
