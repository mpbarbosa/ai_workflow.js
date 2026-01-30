/**
 * File Editing Operations Module (Pure Functions + Wrapper)
 * @version 2.0.0
 * @description File content editing utilities with referential transparency
 * @module lib/edit_operations
 * Part of: AI Workflow Automation v1.1.0
 */

import { FileOperations } from './file_operations.js';
import { logger } from '../core/logger.js';
import { FileSystemError } from '../utils/errors.js';

/**
 * PURE FUNCTIONS - All referentially transparent
 */

/**
 * Find all matches of a pattern in text (PURE)
 * @param {string} text - Text to search
 * @param {RegExp|string} pattern - Pattern to find
 * @returns {Array<{match: string, index: number, line: number}>} Array of matches with positions
 */
export function findMatches(text, pattern) {
  if (typeof text !== 'string') {
    return [];
  }

  const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern, 'g');
  const matches = [];
  const lines = text.split('\n');

  lines.forEach((line, lineIndex) => {
    let match;
    const lineRegex = new RegExp(regex.source, regex.flags);

    while ((match = lineRegex.exec(line)) !== null) {
      matches.push({
        match: match[0],
        index: match.index,
        line: lineIndex + 1,
        lineContent: line,
      });
    }
  });

  return matches;
}

/**
 * Replace all occurrences of pattern in text (PURE)
 * @param {string} text - Text to process
 * @param {RegExp|string} pattern - Pattern to find
 * @param {string|Function} replacement - Replacement string or function
 * @returns {string} Text with replacements
 */
export function replaceAll(text, pattern, replacement) {
  if (typeof text !== 'string') {
    return '';
  }

  const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern, 'g');
  return text.replace(regex, replacement);
}

/**
 * Replace only the first occurrence of pattern (PURE)
 * @param {string} text - Text to process
 * @param {RegExp|string} pattern - Pattern to find
 * @param {string|Function} replacement - Replacement string or function
 * @returns {string} Text with first replacement
 */
export function replaceFirst(text, pattern, replacement) {
  if (typeof text !== 'string') {
    return '';
  }

  const regex =
    pattern instanceof RegExp
      ? new RegExp(pattern.source, pattern.flags.replace('g', ''))
      : new RegExp(pattern);
  return text.replace(regex, replacement);
}

/**
 * Insert text at a specific line number (PURE)
 * @param {string} text - Original text
 * @param {number} lineNumber - Line number (1-based)
 * @param {string} content - Content to insert
 * @param {string} position - 'before' or 'after' the line
 * @returns {string} Text with insertion
 */
export function insertAtLine(text, lineNumber, content, position = 'after') {
  if (typeof text !== 'string' || lineNumber < 1) {
    return text;
  }

  const lines = text.split('\n');
  const index = lineNumber - 1;

  if (index < 0 || index > lines.length) {
    return text;
  }

  if (position === 'before') {
    lines.splice(index, 0, content);
  } else {
    lines.splice(index + 1, 0, content);
  }

  return lines.join('\n');
}

/**
 * Append text to the end of file (PURE)
 * @param {string} text - Original text
 * @param {string} content - Content to append
 * @param {boolean} ensureNewline - Ensure newline before appending
 * @returns {string} Text with appended content
 */
export function appendText(text, content, ensureNewline = true) {
  if (typeof text !== 'string') {
    return content;
  }

  if (!content) {
    return text;
  }

  if (ensureNewline && text.length > 0 && !text.endsWith('\n')) {
    return text + '\n' + content;
  }

  return text + content;
}

/**
 * Prepend text to the beginning of file (PURE)
 * @param {string} text - Original text
 * @param {string} content - Content to prepend
 * @param {boolean} ensureNewline - Ensure newline after prepending
 * @returns {string} Text with prepended content
 */
export function prependText(text, content, ensureNewline = true) {
  if (typeof text !== 'string') {
    return content;
  }

  if (!content) {
    return text;
  }

  // If original text is empty, just return content
  if (text.length === 0) {
    return content;
  }

  if (ensureNewline && content.length > 0 && !content.endsWith('\n')) {
    return content + '\n' + text;
  }

  return content + text;
}

/**
 * Delete lines matching a pattern (PURE)
 * @param {string} text - Original text
 * @param {RegExp|string} pattern - Pattern to match
 * @returns {string} Text with matching lines removed
 */
export function deleteLines(text, pattern) {
  if (typeof text !== 'string') {
    return '';
  }

  const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern);
  const lines = text.split('\n');
  const filtered = lines.filter((line) => !regex.test(line));

  return filtered.join('\n');
}

/**
 * Extract lines matching a pattern (PURE)
 * @param {string} text - Original text
 * @param {RegExp|string} pattern - Pattern to match
 * @returns {string[]} Array of matching lines
 */
export function extractLines(text, pattern) {
  if (typeof text !== 'string') {
    return [];
  }

  const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern);
  const lines = text.split('\n');

  return lines.filter((line) => regex.test(line));
}

/**
 * Get a range of lines (PURE)
 * @param {string} text - Original text
 * @param {number} startLine - Start line number (1-based, inclusive)
 * @param {number} endLine - End line number (1-based, inclusive)
 * @returns {string} Extracted lines as text
 */
export function getLineRange(text, startLine, endLine) {
  if (typeof text !== 'string' || startLine < 1) {
    return '';
  }

  const lines = text.split('\n');
  const start = startLine - 1;
  const end = endLine === -1 ? lines.length : endLine;

  return lines.slice(start, end).join('\n');
}

/**
 * Replace a range of lines (PURE)
 * @param {string} text - Original text
 * @param {number} startLine - Start line number (1-based, inclusive)
 * @param {number} endLine - End line number (1-based, inclusive)
 * @param {string} replacement - Replacement text
 * @returns {string} Text with replaced range
 */
export function replaceLineRange(text, startLine, endLine, replacement) {
  if (typeof text !== 'string' || startLine < 1) {
    return text;
  }

  const lines = text.split('\n');
  const start = startLine - 1;
  const end = endLine;

  if (start < 0 || start >= lines.length) {
    return text;
  }

  const replacementLines = replacement.split('\n');
  lines.splice(start, end - start, ...replacementLines);

  return lines.join('\n');
}

/**
 * Generate a simple diff between two texts (PURE)
 * @param {string} oldText - Original text
 * @param {string} newText - Modified text
 * @returns {Object} Diff information
 */
export function generateDiff(oldText, newText) {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');

  const changes = [];
  const maxLength = Math.max(oldLines.length, newLines.length);

  for (let i = 0; i < maxLength; i++) {
    const oldLine = oldLines[i] !== undefined ? oldLines[i] : null;
    const newLine = newLines[i] !== undefined ? newLines[i] : null;

    if (oldLine !== newLine) {
      changes.push({
        line: i + 1,
        type: oldLine === null ? 'added' : newLine === null ? 'deleted' : 'modified',
        oldContent: oldLine,
        newContent: newLine,
      });
    }
  }

  return {
    totalChanges: changes.length,
    linesAdded: changes.filter((c) => c.type === 'added').length,
    linesDeleted: changes.filter((c) => c.type === 'deleted').length,
    linesModified: changes.filter((c) => c.type === 'modified').length,
    changes,
  };
}

/**
 * Format diff for display (PURE)
 * @param {Object} diff - Diff object from generateDiff
 * @returns {string} Formatted diff string
 */
export function formatDiff(diff) {
  if (!diff || !diff.changes || diff.changes.length === 0) {
    return 'No changes detected.';
  }

  const lines = [];
  lines.push(`Total changes: ${diff.totalChanges}`);
  lines.push(`  +${diff.linesAdded} lines added`);
  lines.push(`  -${diff.linesDeleted} lines deleted`);
  lines.push(`  ~${diff.linesModified} lines modified`);
  lines.push('');

  diff.changes.forEach((change) => {
    if (change.type === 'added') {
      lines.push(`+ Line ${change.line}: ${change.newContent}`);
    } else if (change.type === 'deleted') {
      lines.push(`- Line ${change.line}: ${change.oldContent}`);
    } else if (change.type === 'modified') {
      lines.push(`~ Line ${change.line}:`);
      lines.push(`  - ${change.oldContent}`);
      lines.push(`  + ${change.newContent}`);
    }
  });

  return lines.join('\n');
}

/**
 * IMPURE WRAPPER CLASS - Handles I/O and side effects
 */

export class EditOperations {
  constructor(options = {}) {
    this.fileOps = options.fileOps || new FileOperations(options);
    this.dryRun = options.dryRun || false;
    this.verbose = options.verbose || false;
  }

  /**
   * Find all matches in a file
   * @param {string} filePath - Path to file
   * @param {RegExp|string} pattern - Pattern to find
   * @returns {Promise<Array>} Array of matches
   */
  async findInFile(filePath, pattern) {
    try {
      const content = await this.fileOps.readFile(filePath);
      const matches = findMatches(content, pattern);

      if (this.verbose) {
        logger.info(`Found ${matches.length} match(es) in ${filePath}`);
      }

      return matches;
    } catch (error) {
      throw new FileSystemError(`Failed to find in file: ${error.message}`, {
        path: filePath,
        originalError: error,
      });
    }
  }

  /**
   * Replace all occurrences in a file
   * @param {string} filePath - Path to file
   * @param {RegExp|string} pattern - Pattern to find
   * @param {string|Function} replacement - Replacement
   * @returns {Promise<Object>} Result with changes info
   */
  async replaceInFile(filePath, pattern, replacement) {
    try {
      const oldContent = await this.fileOps.readFile(filePath);
      const newContent = replaceAll(oldContent, pattern, replacement);

      const diff = generateDiff(oldContent, newContent);

      if (this.dryRun) {
        logger.info(`[DRY RUN] Would replace in file: ${filePath}`);
        if (this.verbose) {
          logger.info(formatDiff(diff));
        }
        return { changed: diff.totalChanges > 0, diff };
      }

      if (diff.totalChanges > 0) {
        await this.fileOps.writeFile(filePath, newContent);

        if (this.verbose) {
          logger.success(`Replaced ${diff.totalChanges} occurrence(s) in ${filePath}`);
        }
      }

      return { changed: diff.totalChanges > 0, diff };
    } catch (error) {
      throw new FileSystemError(`Failed to replace in file: ${error.message}`, {
        path: filePath,
        originalError: error,
      });
    }
  }

  /**
   * Insert content at a specific line
   * @param {string} filePath - Path to file
   * @param {number} lineNumber - Line number (1-based)
   * @param {string} content - Content to insert
   * @param {string} position - 'before' or 'after'
   * @returns {Promise<void>}
   */
  async insertAtLine(filePath, lineNumber, content, position = 'after') {
    try {
      const oldContent = await this.fileOps.readFile(filePath);
      const newContent = insertAtLine(oldContent, lineNumber, content, position);

      if (this.dryRun) {
        logger.info(`[DRY RUN] Would insert at line ${lineNumber} in ${filePath}`);
        return;
      }

      await this.fileOps.writeFile(filePath, newContent);

      if (this.verbose) {
        logger.success(`Inserted content at line ${lineNumber} in ${filePath}`);
      }
    } catch (error) {
      throw new FileSystemError(`Failed to insert at line: ${error.message}`, {
        path: filePath,
        originalError: error,
      });
    }
  }

  /**
   * Append content to a file
   * @param {string} filePath - Path to file
   * @param {string} content - Content to append
   * @returns {Promise<void>}
   */
  async appendToFile(filePath, content) {
    try {
      const oldContent = await this.fileOps.readFile(filePath);
      const newContent = appendText(oldContent, content);

      if (this.dryRun) {
        logger.info(`[DRY RUN] Would append to file: ${filePath}`);
        return;
      }

      await this.fileOps.writeFile(filePath, newContent);

      if (this.verbose) {
        logger.success(`Appended content to ${filePath}`);
      }
    } catch (error) {
      throw new FileSystemError(`Failed to append to file: ${error.message}`, {
        path: filePath,
        originalError: error,
      });
    }
  }

  /**
   * Prepend content to a file
   * @param {string} filePath - Path to file
   * @param {string} content - Content to prepend
   * @returns {Promise<void>}
   */
  async prependToFile(filePath, content) {
    try {
      const oldContent = await this.fileOps.readFile(filePath);
      const newContent = prependText(oldContent, content);

      if (this.dryRun) {
        logger.info(`[DRY RUN] Would prepend to file: ${filePath}`);
        return;
      }

      await this.fileOps.writeFile(filePath, newContent);

      if (this.verbose) {
        logger.success(`Prepended content to ${filePath}`);
      }
    } catch (error) {
      throw new FileSystemError(`Failed to prepend to file: ${error.message}`, {
        path: filePath,
        originalError: error,
      });
    }
  }

  /**
   * Delete lines matching pattern from a file
   * @param {string} filePath - Path to file
   * @param {RegExp|string} pattern - Pattern to match
   * @returns {Promise<Object>} Result with deleted lines count
   */
  async deleteLines(filePath, pattern) {
    try {
      const oldContent = await this.fileOps.readFile(filePath);
      const newContent = deleteLines(oldContent, pattern);

      const oldLineCount = oldContent.split('\n').length;
      const newLineCount = newContent.split('\n').length;
      const deletedLines = oldLineCount - newLineCount;

      if (this.dryRun) {
        logger.info(`[DRY RUN] Would delete ${deletedLines} line(s) from ${filePath}`);
        return { deletedLines };
      }

      if (deletedLines > 0) {
        await this.fileOps.writeFile(filePath, newContent);

        if (this.verbose) {
          logger.success(`Deleted ${deletedLines} line(s) from ${filePath}`);
        }
      }

      return { deletedLines };
    } catch (error) {
      throw new FileSystemError(`Failed to delete lines: ${error.message}`, {
        path: filePath,
        originalError: error,
      });
    }
  }

  /**
   * Replace a range of lines in a file
   * @param {string} filePath - Path to file
   * @param {number} startLine - Start line (1-based)
   * @param {number} endLine - End line (1-based)
   * @param {string} replacement - Replacement text
   * @returns {Promise<void>}
   */
  async replaceLineRange(filePath, startLine, endLine, replacement) {
    try {
      const oldContent = await this.fileOps.readFile(filePath);
      const newContent = replaceLineRange(oldContent, startLine, endLine, replacement);

      if (this.dryRun) {
        logger.info(`[DRY RUN] Would replace lines ${startLine}-${endLine} in ${filePath}`);
        return;
      }

      await this.fileOps.writeFile(filePath, newContent);

      if (this.verbose) {
        logger.success(`Replaced lines ${startLine}-${endLine} in ${filePath}`);
      }
    } catch (error) {
      throw new FileSystemError(`Failed to replace line range: ${error.message}`, {
        path: filePath,
        originalError: error,
      });
    }
  }

  /**
   * Preview changes before applying them
   * @param {string} filePath - Path to file
   * @param {Function} transformFn - Function that transforms content
   * @returns {Promise<Object>} Preview with diff
   */
  async previewChanges(filePath, transformFn) {
    try {
      const oldContent = await this.fileOps.readFile(filePath);
      const newContent = transformFn(oldContent);

      const diff = generateDiff(oldContent, newContent);
      const formatted = formatDiff(diff);

      return {
        diff,
        formatted,
        hasChanges: diff.totalChanges > 0,
      };
    } catch (error) {
      throw new FileSystemError(`Failed to preview changes: ${error.message}`, {
        path: filePath,
        originalError: error,
      });
    }
  }

  /**
   * Apply a transformation function to a file
   * @param {string} filePath - Path to file
   * @param {Function} transformFn - Function that transforms content
   * @returns {Promise<Object>} Result with diff
   */
  async applyTransform(filePath, transformFn) {
    try {
      const oldContent = await this.fileOps.readFile(filePath);
      const newContent = transformFn(oldContent);

      const diff = generateDiff(oldContent, newContent);

      if (this.dryRun) {
        logger.info(`[DRY RUN] Would transform file: ${filePath}`);
        if (this.verbose) {
          logger.info(formatDiff(diff));
        }
        return { applied: false, diff };
      }

      if (diff.totalChanges > 0) {
        await this.fileOps.writeFile(filePath, newContent);

        if (this.verbose) {
          logger.success(`Applied transformation to ${filePath}`);
        }
      }

      return { applied: diff.totalChanges > 0, diff };
    } catch (error) {
      throw new FileSystemError(`Failed to apply transform: ${error.message}`, {
        path: filePath,
        originalError: error,
      });
    }
  }
}
