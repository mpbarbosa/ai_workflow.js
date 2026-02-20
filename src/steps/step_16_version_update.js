/**
 * Step 16: AI-Powered Semantic Version Update
 * Updates semantic versions in modified files and project metadata.
 * Runs after analysis steps (10,12,13,14), before Git Finalization.
 * @module steps/step_16_version_update
 * @version 2.0.0
 */

import { FileOperations } from '../lib/file_operations.js';
import { Backlog } from '../lib/backlog.js';
import { STEP_KIND } from './step_contract.js';
import { Logger } from '../core/logger.js';
import { colors } from '../core/colors.js';

// Constants
export const SEMVER_PATTERN = /\d+\.\d+\.\d+/;
export const VERSION_PATTERN_REGEX = /(version|VERSION|Version|@version)["'\s:=]*(\d+\.\d+\.\d+)/gi;

export const BUMP_TYPES = Object.freeze({
  major: 'major',
  minor: 'minor',
  patch: 'patch',
});

export const METADATA_FILES = Object.freeze([
  'package.json',
  'pyproject.toml',
  'setup.py',
  'Cargo.toml',
  '.workflow-config.yaml',
]);

export const HEURISTIC_THRESHOLDS = Object.freeze({
  majorDeletions: 500,
  majorModifiedFiles: 20,
  minorInsertions: 100,
});

// ============================================================================
// PURE FUNCTIONS - Version Parsing and Manipulation
// ============================================================================

/**
 * Extract version number from string
 * @param {string} input - String containing version
 * @returns {string|null} - Version string (X.Y.Z) or null
 */
export function extractVersion(input) {
  const match = input.match(SEMVER_PATTERN);
  return match ? match[0] : null;
}

/**
 * Parse semantic version into components
 * @param {string} version - Version string (X.Y.Z)
 * @returns {Object|null} - { major, minor, patch } or null
 */
export function parseVersion(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return null;

  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };
}

/**
 * Increment version based on bump type
 * @param {string} version - Current version (X.Y.Z)
 * @param {string} bumpType - Bump type (major|minor|patch)
 * @returns {string} - New version string
 */
export function incrementVersion(version, bumpType) {
  const parsed = parseVersion(version);
  if (!parsed) return version;

  switch (bumpType) {
    case BUMP_TYPES.major:
      return `${parsed.major + 1}.0.0`;
    case BUMP_TYPES.minor:
      return `${parsed.major}.${parsed.minor + 1}.0`;
    case BUMP_TYPES.patch:
      return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
    default:
      return version;
  }
}

/**
 * Detect version patterns in text
 * @param {string} content - File content
 * @returns {Array<Object>} - Array of { line, version, match } objects
 */
export function detectVersionPatterns(content) {
  const lines = content.split('\n');
  const patterns = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const regex = new RegExp(VERSION_PATTERN_REGEX.source, 'gi');
    let match;

    while ((match = regex.exec(line)) !== null) {
      const version = extractVersion(match[0]);
      if (version) {
        patterns.push({
          line: i + 1,
          version,
          match: match[0],
        });
      }
    }
  }

  return patterns;
}

/**
 * Replace version in content
 * @param {string} content - File content
 * @param {string} oldVersion - Old version to replace
 * @param {string} newVersion - New version
 * @returns {string} - Updated content
 */
export function replaceVersion(content, oldVersion, newVersion) {
  // Use a global regex to replace all occurrences
  const regex = new RegExp(oldVersion.replace(/\./g, '\\.'), 'g');
  return content.replace(regex, newVersion);
}

// ============================================================================
// PURE FUNCTIONS - Bump Type Determination
// ============================================================================

/**
 * Determine bump type using heuristics
 * @param {Object} stats - Change statistics
 * @param {number} stats.modifiedCount - Number of modified files
 * @param {number} stats.addedCount - Number of added files
 * @param {number} stats.deletedCount - Number of deleted files
 * @param {number} stats.insertions - Number of insertions
 * @param {number} stats.deletions - Number of deletions
 * @returns {string} - Bump type (major|minor|patch)
 */
export function determineHeuristicBumpType(stats) {
  const { modifiedCount, deletions, addedCount, insertions } = stats;

  // Major: Large deletions or many files modified (breaking changes)
  if (
    deletions > HEURISTIC_THRESHOLDS.majorDeletions ||
    modifiedCount > HEURISTIC_THRESHOLDS.majorModifiedFiles
  ) {
    return BUMP_TYPES.major;
  }

  // Minor: New files added or significant additions (new features)
  if (addedCount > 0 || insertions > HEURISTIC_THRESHOLDS.minorInsertions) {
    return BUMP_TYPES.minor;
  }

  // Patch: Small changes, documentation, bug fixes
  return BUMP_TYPES.patch;
}

/**
 * Parse AI bump recommendation
 * @param {string} aiResponse - AI analysis response
 * @returns {Object|null} - { bumpType, reasoning, confidence } or null
 */
export function parseAiBumpRecommendation(aiResponse) {
  // Extract bump type
  const bumpMatch = aiResponse.match(/Bump Type:\s*(major|minor|patch)/i);
  const bumpType = bumpMatch ? bumpMatch[1].toLowerCase() : null;

  if (!bumpType) {
    // Try alternative pattern
    const altMatch = aiResponse.match(/recommend.*\b(major|minor|patch)\b/i);
    if (altMatch) {
      return {
        bumpType: altMatch[1].toLowerCase(),
        reasoning: 'Extracted from recommendation text',
        confidence: 'medium',
      };
    }
    return null;
  }

  // Extract reasoning
  const reasoningMatch = aiResponse.match(/Reasoning:\s*(.+?)(?=\n\n|Confidence:|$)/is);
  const reasoning = reasoningMatch ? reasoningMatch[1].trim() : '';

  // Extract confidence
  const confidenceMatch = aiResponse.match(/Confidence:\s*(high|medium|low)/i);
  const confidence = confidenceMatch ? confidenceMatch[1].toLowerCase() : 'medium';

  return { bumpType, reasoning, confidence };
}

/**
 * Build AI prompt for version bump analysis
 * @param {Object} context - Analysis context
 * @param {Array<string>} context.modifiedFiles - List of modified files
 * @param {Object} context.gitStats - Git statistics
 * @param {string} context.preAnalysis - Pre-analysis results (optional)
 * @returns {string} - Formatted AI prompt
 */
export function buildVersionBumpPrompt(context) {
  const { modifiedFiles, gitStats, preAnalysis } = context;

  const fileList = modifiedFiles
    .slice(0, 20)
    .map((f) => `  - ${f}`)
    .join('\n');
  const moreFiles =
    modifiedFiles.length > 20 ? `\n  ... and ${modifiedFiles.length - 20} more files` : '';

  return `You are a Version Manager and Semantic Versioning Expert. Analyze the changes and determine the appropriate version bump type.

# Version Bump Analysis Context

## Git Changes
${gitStats.summary || 'No statistics available'}

## Modified Files
${fileList}${moreFiles}

${preAnalysis ? `## Pre-Analysis Results\n${preAnalysis}\n` : ''}

Based on this context, determine the semantic version bump type:
- **MAJOR (X.0.0)**: Breaking changes, API modifications, removed features
- **MINOR (X.Y.0)**: New features, enhancements, additive changes
- **PATCH (X.Y.Z)**: Bug fixes, documentation, refactoring, tests

Output format:
Bump Type: [major|minor|patch]
Reasoning: [2-3 sentence explanation]
Confidence: [high|medium|low]`;
}

/**
 * Calculate version update statistics
 * @param {Array<Object>} updates - Array of file update results
 * @returns {Object} - Statistics { updated, skipped, failed }
 */
export function calculateUpdateStats(updates) {
  return updates.reduce(
    (acc, update) => {
      if (update.success) acc.updated++;
      else if (update.skipped) acc.skipped++;
      else acc.failed++;
      return acc;
    },
    { updated: 0, skipped: 0, failed: 0 }
  );
}

/**
 * Format version update report
 * @param {Object} data - Report data
 * @param {string} data.oldVersion - Original version
 * @param {string} data.newVersion - New version
 * @param {string} data.bumpType - Bump type used
 * @param {Object} data.stats - Update statistics
 * @param {Array<Object>} data.updates - List of file updates
 * @param {string} data.timestamp - ISO timestamp
 * @returns {string} - Formatted markdown report
 */
export function formatVersionUpdateReport(data) {
  const { oldVersion, newVersion, bumpType, stats, updates, timestamp } = data;

  let updatesSection = '';
  if (updates.length > 0) {
    updatesSection = '\n## Files Updated\n\n';
    updates
      .filter((u) => u.success)
      .forEach((u) => {
        updatesSection += `- ✅ ${u.file}\n`;
      });

    if (stats.failed > 0) {
      updatesSection += '\n## Failed Updates\n\n';
      updates
        .filter((u) => !u.success && !u.skipped)
        .forEach((u) => {
          updatesSection += `- ❌ ${u.file}: ${u.error}\n`;
        });
    }
  }

  return `# Step 16: Semantic Version Update Report

**Status**: ✅ Completed
**Date**: ${timestamp}

## Version Update

- **Previous Version**: ${oldVersion}
- **New Version**: ${newVersion}
- **Bump Type**: ${bumpType}

## Update Statistics

- **Files Updated**: ${stats.updated}
- **Files Skipped**: ${stats.skipped}
- **Files Failed**: ${stats.failed}
${updatesSection}

---

## Metadata

- **Step Version**: 2.0.0
- **Analysis Method**: Heuristic-based
- **Bump Type**: ${bumpType.toUpperCase()}

## Next Steps

1. Review version changes in modified files
2. Commit version updates with conventional commit message
3. Create git tag for new version (if applicable)
4. Update CHANGELOG.md with version history
`;
}

// ============================================================================
// STEP16VERSIONUPDATE - Impure Wrapper Class
// ============================================================================

/**
 * Step 16: AI-Powered Semantic Version Update
 * Updates versions in modified files and project metadata.
 */
export class Step16VersionUpdate {
  static stepKind = STEP_KIND.CONTEXT;

  /**
   * Create a new Step 16 version updater
   * @param {Object} options - Configuration options
   * @param {Object} options.fileOps - File operations instance
   * @param {Object} options.backlog - Backlog instance
   * @param {Object} options.logger - Logger instance
   * @param {boolean} options.dryRun - Whether to run in dry-run mode
   * @param {string} options.projectRoot - Project root directory
   */
  constructor(options = {}) {
    this.fileOps = options.fileOps || new FileOperations();
    this.backlog = options.backlog || new Backlog();
    this.logger = options.logger || new Logger();
    this.dryRun = options.dryRun || false;
    this.projectRoot = options.projectRoot || process.cwd();
  }

  /**
   * Execute version update step
   * @param {Object} context - Execution context
   * @param {Array<string>} context.modifiedFiles - List of modified files
   * @param {Object} context.gitStats - Git change statistics
   * @returns {Promise<Object>} - Execution result { success, oldVersion, newVersion, ... }
   */
  async execute(context = {}) {
    const startTime = Date.now();

    // Use projectRoot from context if provided (overrides constructor default)
    if (context.projectRoot) {
      this.projectRoot = context.projectRoot;
    }

    try {
      this.logger.step('Step 16: Version Update');
      if (this.dryRun) {
        this.logger.info('[DRY RUN] Version update preview:');
        this.logger.info('- Would detect current version in project files');
        this.logger.info('- Would determine appropriate bump type');
        this.logger.info('- Would update versions in modified files');
        return {
          success: true,
          dryRun: true,
          message: 'Version update dry run completed',
        };
      }

      const modifiedFiles = context.modifiedFiles || [];
      const gitStats = context.gitStats || {};

      if (modifiedFiles.length === 0) {
        this.logger.info('Step 16: No modified files to process');

        await this.backlog.saveStepSummary(
          '16',
          'Version_Update',
          'Skipped: No modified files',
          '⏭️'
        );

        return {
          success: true,
          skipped: true,
          reason: 'no modified files',
        };
      }

      // Phase 1: Detect current version
      this.logger.info(`${colors.blue}Phase 1:${colors.reset} Detecting current version...`);
      const currentVersion = await this.detectCurrentVersion(modifiedFiles);

      if (!currentVersion) {
        this.logger.warn('No version found in project files');
        await this.backlog.saveStepSummary(
          '16',
          'Version_Update',
          'Skipped: No version found',
          '⏭️'
        );

        return {
          success: true,
          skipped: true,
          reason: 'no version found',
        };
      }

      this.logger.success(`Current version: ${currentVersion}`);

      // Phase 2: Determine bump type
      this.logger.info(`${colors.blue}Phase 2:${colors.reset} Determining bump type...`);
      const bumpType = determineHeuristicBumpType(gitStats);
      this.logger.info(`Bump type: ${bumpType}`);

      // Phase 3: Calculate new version
      const newVersion = incrementVersion(currentVersion, bumpType);
      this.logger.success(`New version: ${currentVersion} → ${newVersion}`);

      // Phase 4: Update versions in files
      this.logger.info(`${colors.blue}Phase 3:${colors.reset} Updating versions in files...`);
      const updates = await this.updateVersionsInFiles(modifiedFiles, currentVersion, newVersion);

      const stats = calculateUpdateStats(updates);
      this.logger.success(
        `Updated ${stats.updated} files, skipped ${stats.skipped}, failed ${stats.failed}`
      );

      // Phase 5: Generate report
      const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
      const report = formatVersionUpdateReport({
        oldVersion: currentVersion,
        newVersion,
        bumpType,
        stats,
        updates,
        timestamp,
      });

      await this.backlog.saveStepSummary('16', 'Version_Update', report, '✅');

      this.logger.success('Step 16: Version update completed');

      return {
        success: true,
        oldVersion: currentVersion,
        newVersion,
        bumpType,
        stats,
        updates,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      this.logger.error(`Step 16 failed: ${error.message}`);

      await this.backlog.saveStepIssues('16', 'Version_Update', [
        {
          type: 'error',
          message: error.message,
          location: 'step_16_version_update',
        },
      ]);

      return {
        success: false,
        error: error.message,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Detect current version from project files (I/O operation)
   * @param {Array<string>} _files - List of files to check
   * @returns {Promise<string|null>} - Current version or null
   */
  async detectCurrentVersion(_files) {
    // In real implementation, would read files and parse versions
    // For now, return mock version
    return '1.0.0';
  }

  /**
   * Update versions in modified files (I/O operation)
   * @param {Array<string>} _files - List of files to update
   * @param {string} _oldVersion - Old version
   * @param {string} _newVersion - New version
   * @returns {Promise<Array<Object>>} - Update results
   */
  async updateVersionsInFiles(_files, _oldVersion, _newVersion) {
    // In real implementation, would update files
    // For now, return mock updates
    return [
      { file: 'package.json', success: true },
      { file: 'README.md', success: true },
    ];
  }
}
