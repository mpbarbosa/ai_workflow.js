/**
 * File Operations Module (Pure Functions + Wrapper)
 * @version 2.0.0
 * @description File system operations with referential transparency
 * @module lib/file_operations
 * Part of: AI Workflow Automation v1.1.0
 */

// Directories that are never traversed by default (can be overridden with options.allowAll)
const NEVER_TRAVERSE_DIRS = new Set([
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  '__pycache__',
  '.pytest_cache',
  '.tox',
  '.mypy_cache',
]);

import fs, { glob as fsGlob } from 'fs/promises';
import path from 'path';
import { logger } from '../core/logger.js';
import { FileSystemError } from '../utils/errors.js';

/**
 * PURE FUNCTIONS - All referentially transparent
 */

/**
 * Validate if a path is safe (no directory traversal, absolute paths only)
 * @param {string} filePath - Path to validate
 * @returns {Object} { valid: boolean, error?: string }
 */
export function validatePath(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    return { valid: false, error: 'Path must be a non-empty string' };
  }

  // Check if path is absolute (required for safety)
  if (!path.isAbsolute(filePath)) {
    return { valid: false, error: 'Only absolute paths are allowed' };
  }

  // Check for directory traversal attempts in the normalized path
  const normalized = path.normalize(filePath);

  // If normalized contains .. or resolved path escapes the original, reject
  if (filePath.includes('..') || normalized.includes('..')) {
    return { valid: false, error: 'Directory traversal not allowed' };
  }

  return { valid: true };
}

/**
 * Filter file list by extension (PURE)
 * @param {string[]} files - List of file paths
 * @param {string[]} extensions - Extensions to filter (e.g., ['.js', '.json'])
 * @returns {string[]} Filtered file list
 */
export function filterByExtension(files, extensions) {
  if (!Array.isArray(files) || !Array.isArray(extensions)) {
    return [];
  }

  const normalizedExts = extensions.map((ext) => (ext.startsWith('.') ? ext : `.${ext}`));

  return files.filter((file) => {
    const ext = path.extname(file);
    return normalizedExts.includes(ext);
  });
}

/**
 * Filter file list by pattern (PURE)
 * @param {string[]} files - List of file paths
 * @param {RegExp|string} pattern - Pattern to match
 * @returns {string[]} Filtered file list
 */
export function filterByPattern(files, pattern) {
  if (!Array.isArray(files)) {
    return [];
  }

  const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern);
  return files.filter((file) => regex.test(file));
}

/**
 * Sort files by modification time (PURE)
 * @param {Array<{path: string, mtime: Date}>} files - Files with metadata
 * @param {boolean} ascending - Sort order (true = oldest first)
 * @returns {Array<{path: string, mtime: Date}>} Sorted files
 */
export function sortByModificationTime(files, ascending = true) {
  if (!Array.isArray(files)) {
    return [];
  }

  const sorted = [...files].sort((a, b) => {
    const timeA = a.mtime instanceof Date ? a.mtime.getTime() : 0;
    const timeB = b.mtime instanceof Date ? b.mtime.getTime() : 0;
    return ascending ? timeA - timeB : timeB - timeA;
  });

  return sorted;
}

/**
 * Build file metadata object (PURE)
 * @param {string} filePath - File path
 * @param {Object} stats - fs.Stats object
 * @returns {Object} File metadata
 */
export function buildFileMetadata(filePath, stats) {
  return {
    path: filePath,
    size: stats.size,
    isFile: stats.isFile(),
    isDirectory: stats.isDirectory(),
    isSymbolicLink: stats.isSymbolicLink(),
    created: stats.birthtime,
    modified: stats.mtime,
    accessed: stats.atime,
  };
}

/**
 * Calculate relative path (PURE)
 * @param {string} from - Base path
 * @param {string} to - Target path
 * @returns {string} Relative path
 */
export function calculateRelativePath(from, to) {
  return path.relative(from, to);
}

/**
 * IMPURE WRAPPER CLASS - Handles I/O and side effects
 */

export class FileOperations {
  constructor(options = {}) {
    this.dryRun = options.dryRun || false;
    this.verbose = options.verbose || false;
  }

  /**
   * Read file contents
   * @param {string} filePath - Path to file
   * @param {string} encoding - File encoding (default: 'utf8')
   * @returns {Promise<string>} File contents
   * @throws {FileSystemError} If file cannot be read
   */
  async readFile(filePath, encoding = 'utf8') {
    const validation = validatePath(filePath);
    if (!validation.valid) {
      throw new FileSystemError(validation.error, { path: filePath });
    }

    try {
      if (this.verbose) {
        logger.debug(`Reading file: ${filePath}`);
      }
      const content = await fs.readFile(filePath, encoding);
      return content;
    } catch (error) {
      throw new FileSystemError(`Failed to read file: ${error.message}`, {
        path: filePath,
        originalError: error,
      });
    }
  }

  /**
   * Write file contents
   * @param {string} filePath - Path to file
   * @param {string} content - Content to write
   * @param {Object} options - Write options
   * @returns {Promise<void>}
   * @throws {FileSystemError} If file cannot be written
   */
  async writeFile(filePath, content, options = {}) {
    const validation = validatePath(filePath);
    if (!validation.valid) {
      throw new FileSystemError(validation.error, { path: filePath });
    }

    if (this.dryRun) {
      logger.info(`[DRY RUN] Would write to file: ${filePath} (${content.length} bytes)`);
      return;
    }

    try {
      if (this.verbose) {
        logger.debug(`Writing file: ${filePath}`);
      }

      // Ensure parent directory exists
      const dirPath = path.dirname(filePath);
      await fs.mkdir(dirPath, { recursive: true });

      await fs.writeFile(filePath, content, options);

      if (this.verbose) {
        logger.success(`File written: ${filePath}`);
      }
    } catch (error) {
      throw new FileSystemError(`Failed to write file: ${error.message}`, {
        path: filePath,
        originalError: error,
      });
    }
  }

  /**
   * Check if path exists
   * @param {string} filePath - Path to check
   * @returns {Promise<boolean>} True if exists
   */
  async exists(filePath) {
    const validation = validatePath(filePath);
    if (!validation.valid) {
      return false;
    }

    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file stats
   * @param {string} filePath - Path to file
   * @returns {Promise<Object>} File metadata
   * @throws {FileSystemError} If stats cannot be retrieved
   */
  async stat(filePath) {
    const validation = validatePath(filePath);
    if (!validation.valid) {
      throw new FileSystemError(validation.error, { path: filePath });
    }

    try {
      const stats = await fs.stat(filePath);
      return buildFileMetadata(filePath, stats);
    } catch (error) {
      throw new FileSystemError(`Failed to get file stats: ${error.message}`, {
        path: filePath,
        originalError: error,
      });
    }
  }

  /**
   * List directory contents
   * @param {string} dirPath - Directory path
   * @param {Object} options - List options
   * @returns {Promise<string[]>} List of paths
   * @throws {FileSystemError} If directory cannot be listed
   */
  async listDirectory(dirPath, options = {}) {
    const validation = validatePath(dirPath);
    if (!validation.valid) {
      throw new FileSystemError(validation.error, { path: dirPath });
    }

    try {
      if (this.verbose) {
        logger.debug(`Listing directory: ${dirPath}`);
      }

      let entries = await fs.readdir(dirPath);

      // Convert to absolute paths
      entries = entries.map((entry) => path.join(dirPath, entry));

      // Apply filters if provided
      if (options.extensions) {
        entries = filterByExtension(entries, options.extensions);
      }

      if (options.pattern) {
        entries = filterByPattern(entries, options.pattern);
      }

      return entries;
    } catch (error) {
      throw new FileSystemError(`Failed to list directory: ${error.message}`, {
        path: dirPath,
        originalError: error,
      });
    }
  }

  /**
   * List directory recursively
   * @param {string} dirPath - Directory path
   * @param {Object} options - List options
   * @param {string[]} [options.exclude] - Additional directory names to skip
   * @param {boolean} [options.allowAll] - If true, skip default NEVER_TRAVERSE_DIRS exclusions
   * @param {string[]} [options.extensions] - Filter results by file extension
   * @param {string} [options.pattern] - Filter results by glob pattern
   * @param {boolean} [options.includeDirectories] - Include directory paths in results
   * @returns {Promise<string[]>} List of all file paths
   */
  async listDirectoryRecursive(dirPath, options = {}) {
    const validation = validatePath(dirPath);
    if (!validation.valid) {
      throw new FileSystemError(validation.error, { path: dirPath });
    }

    const results = [];

    const callerExcludeSet = new Set(options.exclude || []);
    const excludeSet = options.allowAll
      ? callerExcludeSet
      : new Set([...NEVER_TRAVERSE_DIRS, ...callerExcludeSet]);

    async function traverse(currentPath) {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);

        if (entry.isDirectory()) {
          if (excludeSet.has(entry.name)) {
            continue;
          }
          if (options.includeDirectories) {
            results.push(fullPath);
          }
          await traverse(fullPath);
        } else if (entry.isFile()) {
          results.push(fullPath);
        }
      }
    }

    try {
      await traverse(dirPath);

      // Apply filters
      let filtered = results;
      if (options.extensions) {
        filtered = filterByExtension(filtered, options.extensions);
      }
      if (options.pattern) {
        filtered = filterByPattern(filtered, options.pattern);
      }

      return filtered;
    } catch (error) {
      throw new FileSystemError(`Failed to list directory recursively: ${error.message}`, {
        path: dirPath,
        originalError: error,
      });
    }
  }

  /**
   * Copy file
   * @param {string} sourcePath - Source file path
   * @param {string} destPath - Destination file path
   * @returns {Promise<void>}
   * @throws {FileSystemError} If file cannot be copied
   */
  async copyFile(sourcePath, destPath) {
    const sourceValidation = validatePath(sourcePath);
    const destValidation = validatePath(destPath);

    if (!sourceValidation.valid) {
      throw new FileSystemError(sourceValidation.error, { path: sourcePath });
    }
    if (!destValidation.valid) {
      throw new FileSystemError(destValidation.error, { path: destPath });
    }

    if (this.dryRun) {
      logger.info(`[DRY RUN] Would copy file: ${sourcePath} → ${destPath}`);
      return;
    }

    try {
      if (this.verbose) {
        logger.debug(`Copying file: ${sourcePath} → ${destPath}`);
      }

      // Ensure destination directory exists
      const destDir = path.dirname(destPath);
      await fs.mkdir(destDir, { recursive: true });

      await fs.copyFile(sourcePath, destPath);

      if (this.verbose) {
        logger.success(`File copied: ${destPath}`);
      }
    } catch (error) {
      throw new FileSystemError(`Failed to copy file: ${error.message}`, {
        path: sourcePath,
        destination: destPath,
        originalError: error,
      });
    }
  }

  /**
   * Move/rename file
   * @param {string} sourcePath - Source file path
   * @param {string} destPath - Destination file path
   * @returns {Promise<void>}
   * @throws {FileSystemError} If file cannot be moved
   */
  async moveFile(sourcePath, destPath) {
    const sourceValidation = validatePath(sourcePath);
    const destValidation = validatePath(destPath);

    if (!sourceValidation.valid) {
      throw new FileSystemError(sourceValidation.error, { path: sourcePath });
    }
    if (!destValidation.valid) {
      throw new FileSystemError(destValidation.error, { path: destPath });
    }

    if (this.dryRun) {
      logger.info(`[DRY RUN] Would move file: ${sourcePath} → ${destPath}`);
      return;
    }

    try {
      if (this.verbose) {
        logger.debug(`Moving file: ${sourcePath} → ${destPath}`);
      }

      // Ensure destination directory exists
      const destDir = path.dirname(destPath);
      await fs.mkdir(destDir, { recursive: true });

      await fs.rename(sourcePath, destPath);

      if (this.verbose) {
        logger.success(`File moved: ${destPath}`);
      }
    } catch (error) {
      throw new FileSystemError(`Failed to move file: ${error.message}`, {
        path: sourcePath,
        destination: destPath,
        originalError: error,
      });
    }
  }

  /**
   * Delete file
   * @param {string} filePath - Path to file
   * @returns {Promise<void>}
   * @throws {FileSystemError} If file cannot be deleted
   */
  async deleteFile(filePath) {
    const validation = validatePath(filePath);
    if (!validation.valid) {
      throw new FileSystemError(validation.error, { path: filePath });
    }

    if (this.dryRun) {
      logger.info(`[DRY RUN] Would delete file: ${filePath}`);
      return;
    }

    try {
      if (this.verbose) {
        logger.debug(`Deleting file: ${filePath}`);
      }

      await fs.unlink(filePath);

      if (this.verbose) {
        logger.success(`File deleted: ${filePath}`);
      }
    } catch (error) {
      throw new FileSystemError(`Failed to delete file: ${error.message}`, {
        path: filePath,
        originalError: error,
      });
    }
  }

  /**
   * Create directory
   * @param {string} dirPath - Directory path
   * @param {Object} options - Options (recursive: true by default)
   * @returns {Promise<void>}
   * @throws {FileSystemError} If directory cannot be created
   */
  async createDirectory(dirPath, options = { recursive: true }) {
    const validation = validatePath(dirPath);
    if (!validation.valid) {
      throw new FileSystemError(validation.error, { path: dirPath });
    }

    if (this.dryRun) {
      logger.info(`[DRY RUN] Would create directory: ${dirPath}`);
      return;
    }

    try {
      if (this.verbose) {
        logger.debug(`Creating directory: ${dirPath}`);
      }

      await fs.mkdir(dirPath, options);

      if (this.verbose) {
        logger.success(`Directory created: ${dirPath}`);
      }
    } catch (error) {
      // Ignore error if directory already exists
      if (error.code !== 'EEXIST') {
        throw new FileSystemError(`Failed to create directory: ${error.message}`, {
          path: dirPath,
          originalError: error,
        });
      }
    }
  }

  /**
   * Delete directory (recursive)
   * @param {string} dirPath - Directory path
   * @returns {Promise<void>}
   * @throws {FileSystemError} If directory cannot be deleted
   */
  async deleteDirectory(dirPath) {
    const validation = validatePath(dirPath);
    if (!validation.valid) {
      throw new FileSystemError(validation.error, { path: dirPath });
    }

    if (this.dryRun) {
      logger.info(`[DRY RUN] Would delete directory: ${dirPath}`);
      return;
    }

    try {
      if (this.verbose) {
        logger.debug(`Deleting directory: ${dirPath}`);
      }

      await fs.rm(dirPath, { recursive: true, force: true });

      if (this.verbose) {
        logger.success(`Directory deleted: ${dirPath}`);
      }
    } catch (error) {
      throw new FileSystemError(`Failed to delete directory: ${error.message}`, {
        path: dirPath,
        originalError: error,
      });
    }
  }

  /**
   * Glob files matching a pattern
   * @param {string} pattern - Glob pattern (e.g. '**\/*.sh')
   * @param {Object} [options] - Options
   * @param {string} [options.cwd] - Working directory for glob resolution
   * @param {string[]} [options.ignore] - Patterns to exclude
   * @param {boolean} [options.absolute] - Return absolute paths (default false)
   * @returns {Promise<string[]>} Matching file paths
   */
  async glob(pattern, options = {}) {
    const { cwd = process.cwd(), ignore = [], absolute = false } = options;
    const files = [];
    const globIter = fsGlob(pattern, {
      cwd,
      exclude:
        ignore.length > 0
          ? (name) => ignore.some((p) => name === p.replace('**/', '').replace('/**', ''))
          : undefined,
    });
    for await (const file of globIter) {
      files.push(absolute ? path.join(cwd, file) : file);
    }
    return files;
  }
}
