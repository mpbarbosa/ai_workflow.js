/**
 * Cleanup Handlers Module (Pure Functions + Wrapper)
 * @version 2.0.0
 * @description Cleanup operations for temp files, sessions, cache, logs
 * @module lib/cleanup_handlers
 * Part of: AI Workflow Automation v1.1.0
 */

import { logger } from '../core/logger.js';
import { FileOperations } from './file_operations.js';

/**
 * PURE FUNCTIONS - All referentially transparent
 */

/**
 * Check if file should be cleaned based on age (PURE)
 * @param {number} fileModifiedTime - File modification time (ms since epoch)
 * @param {number} currentTime - Current time (ms since epoch)
 * @param {number} maxAgeMs - Maximum age in milliseconds
 * @returns {boolean} True if file should be cleaned
 */
export function shouldCleanByAge(fileModifiedTime, currentTime, maxAgeMs) {
  if (typeof fileModifiedTime !== 'number' || typeof currentTime !== 'number') {
    return false;
  }
  if (typeof maxAgeMs !== 'number' || maxAgeMs <= 0) {
    return false;
  }
  const age = currentTime - fileModifiedTime;
  return age > maxAgeMs;
}

/**
 * Check if file should be cleaned based on size (PURE)
 * @param {number} fileSize - File size in bytes
 * @param {number} maxSizeBytes - Maximum size in bytes
 * @returns {boolean} True if file should be cleaned
 */
export function shouldCleanBySize(fileSize, maxSizeBytes) {
  if (typeof fileSize !== 'number' || typeof maxSizeBytes !== 'number') {
    return false;
  }
  if (maxSizeBytes <= 0) {
    return false;
  }
  return fileSize > maxSizeBytes;
}

/**
 * Filter files by age (PURE)
 * @param {Array<Object>} files - Array of file objects with mtime property
 * @param {number} currentTime - Current time (ms since epoch)
 * @param {number} maxAgeMs - Maximum age in milliseconds
 * @returns {Array<Object>} Files that exceed max age
 */
export function filterByAge(files, currentTime, maxAgeMs) {
  if (!Array.isArray(files)) {
    return [];
  }
  return files.filter((file) => {
    if (!file) {
      return false;
    }
    // Support both mtime and modified properties
    const timeValue = file.mtime || file.modified;
    if (!timeValue) {
      return false;
    }
    // Convert to timestamp (handle both Date objects and numbers)
    let modifiedTime;
    if (typeof timeValue === 'number') {
      modifiedTime = timeValue;
    } else if (timeValue && typeof timeValue.getTime === 'function') {
      modifiedTime = timeValue.getTime();
    } else {
      return false;
    }
    return shouldCleanByAge(modifiedTime, currentTime, maxAgeMs);
  });
}

/**
 * Filter files by size (PURE)
 * @param {Array<Object>} files - Array of file objects with size property
 * @param {number} maxSizeBytes - Maximum size in bytes
 * @returns {Array<Object>} Files that exceed max size
 */
export function filterBySize(files, maxSizeBytes) {
  if (!Array.isArray(files)) {
    return [];
  }
  return files.filter((file) => {
    if (!file || typeof file.size !== 'number') {
      return false;
    }
    return shouldCleanBySize(file.size, maxSizeBytes);
  });
}

/**
 * Calculate total directory size (PURE)
 * @param {Array<Object>} files - Array of file objects with size property
 * @returns {number} Total size in bytes
 */
export function calculateTotalSize(files) {
  if (!Array.isArray(files)) {
    return 0;
  }
  return files.reduce((total, file) => {
    if (file && typeof file.size === 'number') {
      return total + file.size;
    }
    return total;
  }, 0);
}

/**
 * Sort files by modification time (oldest first) (PURE)
 * @param {Array<Object>} files - Array of file objects with mtime property
 * @returns {Array<Object>} Sorted files (oldest first)
 */
export function sortByOldest(files) {
  if (!Array.isArray(files)) {
    return [];
  }
  return [...files].sort((a, b) => {
    if (!a || !b) {
      return 0;
    }
    // Support both mtime and modified properties
    const aTime = a.mtime || a.modified;
    const bTime = b.mtime || b.modified;
    if (!aTime || !bTime) {
      return 0;
    }
    // Convert to timestamp (handle both Date objects and numbers)
    const aValue =
      typeof aTime === 'number'
        ? aTime
        : aTime && typeof aTime.getTime === 'function'
          ? aTime.getTime()
          : 0;
    const bValue =
      typeof bTime === 'number'
        ? bTime
        : bTime && typeof bTime.getTime === 'function'
          ? bTime.getTime()
          : 0;
    return aValue - bValue;
  });
}

/**
 * Sort files by size (largest first) (PURE)
 * @param {Array<Object>} files - Array of file objects with size property
 * @returns {Array<Object>} Sorted files (largest first)
 */
export function sortByLargest(files) {
  if (!Array.isArray(files)) {
    return [];
  }
  return [...files].sort((a, b) => {
    if (!a || typeof a.size !== 'number' || !b || typeof b.size !== 'number') {
      return 0;
    }
    return b.size - a.size;
  });
}

/**
 * Select files to clean to meet size limit (PURE)
 * @param {Array<Object>} files - Array of file objects with size property
 * @param {number} currentTotalSize - Current total size in bytes
 * @param {number} targetSize - Target size in bytes
 * @returns {Array<Object>} Files to delete to meet target
 */
export function selectFilesForSizeLimit(files, currentTotalSize, targetSize) {
  if (!Array.isArray(files) || currentTotalSize <= targetSize) {
    return [];
  }

  const sortedFiles = sortByOldest(files);
  const toDelete = [];
  let freedSpace = 0;
  const neededSpace = currentTotalSize - targetSize;

  for (const file of sortedFiles) {
    if (freedSpace >= neededSpace) {
      break;
    }
    if (file && typeof file.size === 'number') {
      toDelete.push(file);
      freedSpace += file.size;
    }
  }

  return toDelete;
}

/**
 * Convert milliseconds to human-readable duration (PURE)
 * @param {number} ms - Milliseconds
 * @returns {string} Human-readable duration
 */
export function formatDuration(ms) {
  if (typeof ms !== 'number' || ms < 0) {
    return '0s';
  }

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d`;
  } else if (hours > 0) {
    return `${hours}h`;
  } else if (minutes > 0) {
    return `${minutes}m`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Convert bytes to human-readable size (PURE)
 * @param {number} bytes - Size in bytes
 * @returns {string} Human-readable size
 */
export function formatSize(bytes) {
  if (typeof bytes !== 'number' || bytes < 0) {
    return '0B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)}${units[unitIndex]}`;
}

/**
 * Generate cleanup summary (PURE)
 * @param {number} filesDeleted - Number of files deleted
 * @param {number} spaceFreed - Space freed in bytes
 * @param {number} duration - Cleanup duration in ms
 * @returns {Object} Cleanup summary
 */
export function generateCleanupSummary(filesDeleted, spaceFreed, duration) {
  return {
    filesDeleted: filesDeleted || 0,
    spaceFreed: spaceFreed || 0,
    duration: duration || 0,
    spaceFreedFormatted: formatSize(spaceFreed || 0),
    durationFormatted: formatDuration(duration || 0),
  };
}

/**
 * IMPURE WRAPPER CLASS - Handles I/O and side effects
 */

export class CleanupManager {
  constructor(options = {}) {
    this.fileOps = options.fileOps || new FileOperations({ dryRun: options.dryRun });
    this.dryRun = options.dryRun || false;
    this.verbose = options.verbose || false;
  }

  /**
   * Clean files older than specified age
   * @param {string} directory - Directory to clean
   * @param {number} maxAgeMs - Maximum age in milliseconds
   * @param {Object} options - Options { recursive, pattern }
   * @returns {Promise<Object>} Cleanup summary
   */
  async cleanByAge(directory, maxAgeMs, options = {}) {
    const startTime = Date.now();

    try {
      if (this.verbose) {
        logger.info(`Cleaning files older than ${formatDuration(maxAgeMs)} in ${directory}`);
      }

      // List files in directory
      const filePaths = options.recursive
        ? await this.fileOps.listDirectoryRecursive(directory, options)
        : await this.fileOps.listDirectory(directory, options);

      // Get metadata for each file
      const files = [];
      for (const filePath of filePaths) {
        try {
          const stats = await this.fileOps.stat(filePath);
          files.push({ path: filePath, ...stats });
        } catch (error) {
          // Skip files that can't be stat'd
          if (this.verbose) {
            logger.warn(`Cannot stat ${filePath}: ${error.message}`);
          }
        }
      }

      // Filter by age
      const currentTime = Date.now();
      const toDelete = filterByAge(files, currentTime, maxAgeMs);

      if (toDelete.length === 0) {
        if (this.verbose) {
          logger.info('No files to clean');
        }
        return generateCleanupSummary(0, 0, Date.now() - startTime);
      }

      // Delete files
      let spaceFreed = 0;
      for (const file of toDelete) {
        spaceFreed += file.size || 0;
        if (file.isDirectory) {
          await this.fileOps.deleteDirectory(file.path);
        } else {
          await this.fileOps.deleteFile(file.path);
        }
      }

      const summary = generateCleanupSummary(toDelete.length, spaceFreed, Date.now() - startTime);

      if (this.verbose) {
        logger.success(
          `Cleaned ${summary.filesDeleted} files, freed ${summary.spaceFreedFormatted}`
        );
      }

      return summary;
    } catch (error) {
      logger.error(`Cleanup by age failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Clean files larger than specified size
   * @param {string} directory - Directory to clean
   * @param {number} maxSizeBytes - Maximum size in bytes
   * @param {Object} options - Options { recursive, pattern }
   * @returns {Promise<Object>} Cleanup summary
   */
  async cleanBySize(directory, maxSizeBytes, options = {}) {
    const startTime = Date.now();

    try {
      if (this.verbose) {
        logger.info(`Cleaning files larger than ${formatSize(maxSizeBytes)} in ${directory}`);
      }

      // List files in directory
      const filePaths = options.recursive
        ? await this.fileOps.listDirectoryRecursive(directory, options)
        : await this.fileOps.listDirectory(directory, options);

      // Get metadata for each file
      const files = [];
      for (const filePath of filePaths) {
        try {
          const stats = await this.fileOps.stat(filePath);
          files.push({ path: filePath, ...stats });
        } catch (error) {
          // Skip files that can't be stat'd
          if (this.verbose) {
            logger.warn(`Cannot stat ${filePath}: ${error.message}`);
          }
        }
      }

      // Filter by size
      const toDelete = filterBySize(files, maxSizeBytes);

      if (toDelete.length === 0) {
        if (this.verbose) {
          logger.info('No files to clean');
        }
        return generateCleanupSummary(0, 0, Date.now() - startTime);
      }

      // Delete files
      let spaceFreed = 0;
      for (const file of toDelete) {
        spaceFreed += file.size || 0;
        if (file.isDirectory) {
          await this.fileOps.deleteDirectory(file.path);
        } else {
          await this.fileOps.deleteFile(file.path);
        }
      }

      const summary = generateCleanupSummary(toDelete.length, spaceFreed, Date.now() - startTime);

      if (this.verbose) {
        logger.success(
          `Cleaned ${summary.filesDeleted} files, freed ${summary.spaceFreedFormatted}`
        );
      }

      return summary;
    } catch (error) {
      logger.error(`Cleanup by size failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Clean directory to meet size limit
   * @param {string} directory - Directory to clean
   * @param {number} targetSizeBytes - Target size in bytes
   * @param {Object} options - Options { recursive, pattern }
   * @returns {Promise<Object>} Cleanup summary
   */
  async cleanToSizeLimit(directory, targetSizeBytes, options = {}) {
    const startTime = Date.now();

    try {
      if (this.verbose) {
        logger.info(`Cleaning ${directory} to ${formatSize(targetSizeBytes)}`);
      }

      // List files in directory
      const filePaths = options.recursive
        ? await this.fileOps.listDirectoryRecursive(directory, options)
        : await this.fileOps.listDirectory(directory, options);

      // Get metadata for each file
      const files = [];
      for (const filePath of filePaths) {
        try {
          const stats = await this.fileOps.stat(filePath);
          files.push({ path: filePath, ...stats });
        } catch (error) {
          // Skip files that can't be stat'd
          if (this.verbose) {
            logger.warn(`Cannot stat ${filePath}: ${error.message}`);
          }
        }
      }

      // Calculate current size
      const currentSize = calculateTotalSize(files);

      if (currentSize <= targetSizeBytes) {
        if (this.verbose) {
          logger.info(`Directory already under limit (${formatSize(currentSize)})`);
        }
        return generateCleanupSummary(0, 0, Date.now() - startTime);
      }

      // Select files to delete
      const toDelete = selectFilesForSizeLimit(files, currentSize, targetSizeBytes);

      if (toDelete.length === 0) {
        if (this.verbose) {
          logger.warn('Cannot meet size limit by deleting files');
        }
        return generateCleanupSummary(0, 0, Date.now() - startTime);
      }

      // Delete files
      let spaceFreed = 0;
      for (const file of toDelete) {
        spaceFreed += file.size || 0;
        if (file.isDirectory) {
          await this.fileOps.deleteDirectory(file.path);
        } else {
          await this.fileOps.deleteFile(file.path);
        }
      }

      const summary = generateCleanupSummary(toDelete.length, spaceFreed, Date.now() - startTime);

      if (this.verbose) {
        logger.success(
          `Cleaned ${summary.filesDeleted} files, freed ${summary.spaceFreedFormatted}`
        );
      }

      return summary;
    } catch (error) {
      logger.error(`Cleanup to size limit failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Clean empty directories
   * @param {string} directory - Directory to clean
   * @param {boolean} recursive - Clean recursively
   * @returns {Promise<Object>} Cleanup summary
   */
  async cleanEmptyDirectories(directory, recursive = false) {
    const startTime = Date.now();

    try {
      if (this.verbose) {
        logger.info(`Cleaning empty directories in ${directory}`);
      }

      // List directories
      const filePaths = recursive
        ? await this.fileOps.listDirectoryRecursive(directory)
        : await this.fileOps.listDirectory(directory);

      // Get metadata and filter for directories
      const directories = [];
      for (const filePath of filePaths) {
        try {
          const stats = await this.fileOps.stat(filePath);
          if (stats.isDirectory) {
            directories.push({ path: filePath, ...stats });
          }
        } catch {
          // Skip paths that can't be stat'd
        }
      }

      // Sort by depth (deepest first) to ensure we clean from bottom up
      const sortedDirs = directories.sort((a, b) => {
        const aDepth = a.path.split('/').length;
        const bDepth = b.path.split('/').length;
        return bDepth - aDepth;
      });

      let dirsDeleted = 0;
      for (const dir of sortedDirs) {
        const contents = await this.fileOps.listDirectory(dir.path);
        if (contents.length === 0) {
          await this.fileOps.deleteDirectory(dir.path);
          dirsDeleted++;
        }
      }

      const summary = generateCleanupSummary(dirsDeleted, 0, Date.now() - startTime);

      if (this.verbose) {
        logger.success(`Cleaned ${dirsDeleted} empty directories`);
      }

      return summary;
    } catch (error) {
      logger.error(`Cleanup empty directories failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Clean all matching pattern
   * @param {string} directory - Directory to clean
   * @param {string|RegExp} pattern - Pattern to match
   * @param {boolean} recursive - Clean recursively
   * @returns {Promise<Object>} Cleanup summary
   */
  async cleanByPattern(directory, pattern, recursive = false) {
    const startTime = Date.now();

    try {
      if (this.verbose) {
        logger.info(`Cleaning files matching ${pattern} in ${directory}`);
      }

      // List files
      const filePaths = recursive
        ? await this.fileOps.listDirectoryRecursive(directory, { pattern })
        : await this.fileOps.listDirectory(directory, { pattern });

      // Get metadata for each file
      const files = [];
      for (const filePath of filePaths) {
        try {
          const stats = await this.fileOps.stat(filePath);
          files.push({ path: filePath, ...stats });
        } catch (error) {
          // Skip files that can't be stat'd
          if (this.verbose) {
            logger.warn(`Cannot stat ${filePath}: ${error.message}`);
          }
        }
      }

      if (files.length === 0) {
        if (this.verbose) {
          logger.info('No files to clean');
        }
        return generateCleanupSummary(0, 0, Date.now() - startTime);
      }

      // Delete files
      let spaceFreed = 0;
      for (const file of files) {
        spaceFreed += file.size || 0;
        if (file.isDirectory) {
          await this.fileOps.deleteDirectory(file.path);
        } else {
          await this.fileOps.deleteFile(file.path);
        }
      }

      const summary = generateCleanupSummary(files.length, spaceFreed, Date.now() - startTime);

      if (this.verbose) {
        logger.success(
          `Cleaned ${summary.filesDeleted} files, freed ${summary.spaceFreedFormatted}`
        );
      }

      return summary;
    } catch (error) {
      logger.error(`Cleanup by pattern failed: ${error.message}`);
      throw error;
    }
  }
}
