/**
 * Step 02_5 Submodule: Consolidation
 * Purpose: File consolidation and archiving operations
 * Version: 2.0.0
 * Architecture: Referential transparency (pure functions + impure wrapper)
 */

import path from 'path';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Archive directory structure
 */
export const ARCHIVE_STRUCTURE = {
  ORIGINAL: 'original', // Original files before consolidation
  CONSOLIDATED: 'consolidated', // Consolidated/merged files
  OUTDATED: 'outdated', // Outdated files
};

// ============================================================================
// PURE FUNCTIONS - File Selection
// ============================================================================

/**
 * Select which file to keep from duplicates (prefer shorter path)
 * @param {Array<string>} files - Array of duplicate file paths
 * @returns {Object} - Selection result {keep, remove}
 */
export function selectKeepFile(files) {
  if (files.length === 0) {
    return { keep: null, remove: [] };
  }

  // Sort by path depth (prefer shorter paths)
  const sorted = [...files].sort((a, b) => {
    const depthA = a.split('/').length;
    const depthB = b.split('/').length;
    if (depthA !== depthB) return depthA - depthB;
    // If same depth, prefer alphabetically first
    return a.localeCompare(b);
  });

  return {
    keep: sorted[0],
    remove: sorted.slice(1),
  };
}

/**
 * Build consolidation plan for duplicate groups
 * @param {Array<Array<string>>} duplicateGroups - Array of duplicate file groups
 * @returns {Array<Object>} - Consolidation actions [{keep, remove, hash}]
 */
export function buildConsolidationPlan(duplicateGroups) {
  const actions = [];

  for (const group of duplicateGroups) {
    const selection = selectKeepFile(group);
    if (selection.keep && selection.remove.length > 0) {
      actions.push({
        keep: selection.keep,
        remove: selection.remove,
        count: selection.remove.length,
      });
    }
  }

  return actions;
}

// ============================================================================
// PURE FUNCTIONS - Archive Path Generation
// ============================================================================

/**
 * Generate archive path for a file
 * @param {string} filePath - Original file path
 * @param {string} archiveRoot - Archive root directory
 * @param {string} category - Archive category (original/consolidated/outdated)
 * @param {string} timestamp - Timestamp string (YYYYMMDD_HHMMSS)
 * @returns {string} - Archive file path
 */
export function generateArchivePath(filePath, archiveRoot, category, timestamp) {
  const basename = path.basename(filePath);
  return path.join(archiveRoot, timestamp, category, basename);
}

/**
 * Generate archive directory structure
 * @param {string} archiveRoot - Archive root directory
 * @param {string} timestamp - Timestamp string
 * @returns {Object} - Directory paths {root, original, consolidated, outdated}
 */
export function generateArchiveDirectories(archiveRoot, timestamp) {
  const root = path.join(archiveRoot, timestamp);
  return {
    root,
    original: path.join(root, ARCHIVE_STRUCTURE.ORIGINAL),
    consolidated: path.join(root, ARCHIVE_STRUCTURE.CONSOLIDATED),
    outdated: path.join(root, ARCHIVE_STRUCTURE.OUTDATED),
  };
}

// ============================================================================
// PURE FUNCTIONS - Operation Results
// ============================================================================

/**
 * Calculate consolidation statistics
 * @param {Array<Object>} actions - Consolidation actions
 * @returns {Object} - Statistics {totalGroups, filesRemoved, filesKept}
 */
export function calculateConsolidationStats(actions) {
  return {
    totalGroups: actions.length,
    filesRemoved: actions.reduce((sum, a) => sum + a.remove.length, 0),
    filesKept: actions.length,
  };
}

/**
 * Format consolidation action for display
 * @param {Object} action - Consolidation action
 * @returns {string} - Formatted string
 */
export function formatConsolidationAction(action) {
  const removeList = action.remove.map((f) => `  - ${f}`).join('\n');
  return `Keep: ${action.keep}\nRemove (${action.count}):\n${removeList}`;
}

// ============================================================================
// CONSOLIDATION MANAGER - Impure Wrapper Class
// ============================================================================

/**
 * Consolidation manager for file operations
 * Handles archiving, consolidation, and file removal
 */
export class ConsolidationManager {
  constructor(options = {}) {
    this.fileOps = options.fileOps; // FileOperations instance
    this.archiveRoot = options.archiveRoot || '.ai_workflow/archive/docs';
    this.dryRun = options.dryRun || false;
    this.logger = options.logger || console;
  }

  /**
   * Generate timestamp string
   * @param {number} currentTime - Current time in ms (injected for testing)
   * @returns {string} - Timestamp string (YYYYMMDD_HHMMSS)
   */
  generateTimestamp(currentTime = Date.now()) {
    const date = new Date(currentTime);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}_${hours}${minutes}${seconds}`;
  }

  /**
   * Create archive directory structure
   * @param {string} timestamp - Timestamp string
   * @returns {Promise<Object>} - Directory paths
   */
  async createArchiveDirectories(timestamp) {
    const dirs = generateArchiveDirectories(this.archiveRoot, timestamp);

    if (this.dryRun) {
      this.logger.info(`[DRY RUN] Would create archive: ${dirs.root}`);
      return dirs;
    }

    try {
      await this.fileOps.createDirectory(dirs.original, { recursive: true });
      await this.fileOps.createDirectory(dirs.consolidated, { recursive: true });
      await this.fileOps.createDirectory(dirs.outdated, { recursive: true });

      this.logger.info(`Created archive: ${dirs.root}`);
      return dirs;
    } catch (error) {
      this.logger.error(`Failed to create archive directories: ${error.message}`);
      throw error;
    }
  }

  /**
   * Archive a file
   * @param {string} filePath - File to archive
   * @param {string} archiveDir - Archive directory
   * @param {string} category - Archive category
   * @returns {Promise<string>} - Archive file path
   */
  async archiveFile(filePath, archiveDir, category) {
    const archivePath = path.join(archiveDir, category, path.basename(filePath));

    if (this.dryRun) {
      this.logger.info(`[DRY RUN] Would archive: ${filePath} → ${archivePath}`);
      return archivePath;
    }

    try {
      await this.fileOps.copyFile(filePath, archivePath);
      this.logger.info(`Archived: ${filePath}`);
      return archivePath;
    } catch (error) {
      this.logger.warn(`Failed to archive ${filePath}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Consolidate duplicate files
   * @param {Array<Array<string>>} duplicateGroups - Duplicate file groups
   * @param {string} timestamp - Timestamp for archive
   * @returns {Promise<Object>} - Consolidation result
   */
  async consolidateDuplicates(duplicateGroups, timestamp) {
    this.logger.info(`Consolidating ${duplicateGroups.length} duplicate groups...`);

    const plan = buildConsolidationPlan(duplicateGroups);
    const dirs = await this.createArchiveDirectories(timestamp);

    const results = {
      archived: [],
      removed: [],
      kept: [],
      errors: [],
    };

    for (const action of plan) {
      try {
        // Archive files to be removed
        for (const file of action.remove) {
          try {
            await this.archiveFile(file, dirs.root, ARCHIVE_STRUCTURE.ORIGINAL);
            results.archived.push(file);

            // Remove duplicate
            if (!this.dryRun) {
              await this.fileOps.removeFile(file);
              results.removed.push(file);
              this.logger.info(`Removed duplicate: ${file}`);
            } else {
              this.logger.info(`[DRY RUN] Would remove: ${file}`);
            }
          } catch (error) {
            results.errors.push({ file, error: error.message });
          }
        }

        results.kept.push(action.keep);
      } catch (error) {
        this.logger.error(`Error consolidating group: ${error.message}`);
        results.errors.push({ action, error: error.message });
      }
    }

    const stats = calculateConsolidationStats(plan);
    this.logger.info(
      `Consolidation complete: ${stats.filesRemoved} removed, ${stats.filesKept} kept`
    );

    return {
      ...results,
      stats,
      plan,
    };
  }

  /**
   * Archive outdated files
   * @param {Array<string>} outdatedFiles - Files to archive
   * @param {string} timestamp - Timestamp for archive
   * @returns {Promise<Object>} - Archive result
   */
  async archiveOutdatedFiles(outdatedFiles, timestamp) {
    this.logger.info(`Archiving ${outdatedFiles.length} outdated files...`);

    const dirs = await this.createArchiveDirectories(timestamp);

    const results = {
      archived: [],
      removed: [],
      errors: [],
    };

    for (const file of outdatedFiles) {
      try {
        await this.archiveFile(file, dirs.root, ARCHIVE_STRUCTURE.OUTDATED);
        results.archived.push(file);

        // Optionally remove (user confirmation in CLI)
        // For now, just archive without removing
        this.logger.info(`Archived outdated: ${file}`);
      } catch (error) {
        results.errors.push({ file, error: error.message });
      }
    }

    this.logger.info(`Archived ${results.archived.length} outdated files`);

    return results;
  }

  /**
   * Get consolidation summary
   * @param {Object} result - Consolidation result
   * @returns {string} - Summary string
   */
  formatSummary(result) {
    let output = `\n=== Consolidation Summary ===\n`;

    if (result.stats) {
      output += `Groups Consolidated: ${result.stats.totalGroups}\n`;
      output += `Files Removed: ${result.stats.filesRemoved}\n`;
      output += `Files Kept: ${result.stats.filesKept}\n`;
    }

    if (result.archived.length > 0) {
      output += `Files Archived: ${result.archived.length}\n`;
    }

    if (result.errors.length > 0) {
      output += `\nErrors: ${result.errors.length}\n`;
      for (const err of result.errors.slice(0, 5)) {
        output += `  - ${err.file || 'Unknown'}: ${err.error}\n`;
      }
    }

    return output;
  }

  /**
   * Preview consolidation plan
   * @param {Array<Array<string>>} duplicateGroups - Duplicate groups
   * @returns {string} - Preview string
   */
  previewConsolidation(duplicateGroups) {
    const plan = buildConsolidationPlan(duplicateGroups);
    const stats = calculateConsolidationStats(plan);

    let output = `\n=== Consolidation Preview ===\n`;
    output += `Total Groups: ${stats.totalGroups}\n`;
    output += `Files to Remove: ${stats.filesRemoved}\n`;
    output += `Files to Keep: ${stats.filesKept}\n\n`;

    const limit = Math.min(5, plan.length);
    output += `First ${limit} actions:\n\n`;

    for (let i = 0; i < limit; i++) {
      output += formatConsolidationAction(plan[i]);
      output += '\n\n';
    }

    if (plan.length > limit) {
      output += `... and ${plan.length - limit} more groups\n`;
    }

    return output;
  }
}
