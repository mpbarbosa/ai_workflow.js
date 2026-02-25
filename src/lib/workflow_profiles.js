/**
 * @fileoverview Workflow Profiles (v2.0.0)
 * @module lib/workflow_profiles
 *
 * Intelligent workflow customization based on detected change patterns.
 * Defines execution profiles that skip unnecessary steps and focus on
 * relevant validation for different change types.
 *
 * Architecture: v2.0.0 Referential Transparency
 * - Pure functions for profile detection, pattern matching, step filtering
 * - Impure wrapper class for git integration, environment variable access
 *
 * **Source**: Migrated from ai_workflow v3.2.7 `workflow_profiles.sh`
 * **Performance Impact**: 30-43% time savings (71-121 min/day for 10 runs)
 *
 * @version 2.0.0
 * @since 2026-02-08
 */

import { logger } from '../core/logger.js';

/**
 * Workflow profile definitions
 * @constant
 */
export const WORKFLOW_PROFILES = {
  docs_only: {
    name: 'docs_only',
    description: 'Documentation changes only',
    skipSteps: [7, 8], // Skip tests and dependencies
    focusSteps: [1, 2, 4, 10], // Focus on docs, consistency, structure
    estimatedTime: '8-12 minutes',
    savingsPercent: 60,
  },
  code_changes: {
    name: 'code_changes',
    description: 'Source code modifications',
    skipSteps: [2], // Skip consistency (docs-focused)
    focusSteps: [7, 8, 9, 13], // Focus on tests, deps, quality, prompts
    estimatedTime: '20-25 minutes',
    savingsPercent: 20,
  },
  test_changes: {
    name: 'test_changes',
    description: 'Test modifications only',
    skipSteps: [2, 4], // Skip consistency and structure
    focusSteps: [7, 9], // Focus on tests and quality
    estimatedTime: '15-18 minutes',
    savingsPercent: 35,
  },
  infrastructure: {
    name: 'infrastructure',
    description: 'CI/CD and dependencies',
    skipSteps: [2, 4], // Skip docs-focused steps
    focusSteps: [8, 9, 14], // Focus on deps, quality, summary
    estimatedTime: '25-30 minutes',
    savingsPercent: 0, // Full validation for safety
  },
  full_validation: {
    name: 'full_validation',
    description: 'Complete workflow validation',
    skipSteps: [],
    focusSteps: 'all',
    estimatedTime: '23-28 minutes',
    savingsPercent: 0,
  },
};

/**
 * File patterns for profile detection
 * @constant
 */
export const PROFILE_PATTERNS = {
  docs_only: [
    /\.md$/i,
    /^docs\//,
    /^README/i,
    /^CHANGELOG/i,
    /\.txt$/,
    /^LICENSE/i,
    /^CONTRIBUTING/i,
  ],
  code_changes: [
    /^src\/.+\.js$/,
    /^src\/.+\.mjs$/,
    /^src\/.+\.sh$/,
    /^lib\/.+\.js$/,
    /\.js$/,
    /\.mjs$/,
  ],
  test_changes: [/^test\/.+\.js$/, /_test\.js$/, /\.test\.js$/, /^tests\//],
  infrastructure: [
    /\.ya?ml$/,
    /^\.github\//,
    /^Makefile$/,
    /package\.json$/,
    /package-lock\.json$/,
    /\.eslintrc/,
    /\.prettierrc/,
  ],
};

// =============================================================================
// PURE FUNCTIONS
// =============================================================================

/**
 * Check if a file matches any pattern in a pattern array
 * @pure
 * @param {string} filePath - File path to check
 * @param {Array<RegExp>} patterns - Array of regex patterns
 * @returns {boolean} True if file matches any pattern
 */
export function matchesPattern(filePath, patterns) {
  return patterns.some((pattern) => pattern.test(filePath));
}

/**
 * Categorize changed files into profile categories
 * @pure
 * @param {Array<string>} files - Array of changed file paths
 * @returns {Object} Counts by category
 */
export function categorizeChanges(files) {
  const counts = {
    docs: 0,
    code: 0,
    tests: 0,
    infrastructure: 0,
    other: 0,
    total: files.length,
  };

  for (const file of files) {
    let categorized = false;

    // Check in priority order (test > infrastructure > code > docs > other)
    // This ensures files are counted only once in the most specific category
    if (matchesPattern(file, PROFILE_PATTERNS.test_changes)) {
      counts.tests++;
      categorized = true;
    } else if (matchesPattern(file, PROFILE_PATTERNS.infrastructure)) {
      counts.infrastructure++;
      categorized = true;
    } else if (matchesPattern(file, PROFILE_PATTERNS.code_changes)) {
      counts.code++;
      categorized = true;
    } else if (matchesPattern(file, PROFILE_PATTERNS.docs_only)) {
      counts.docs++;
      categorized = true;
    }

    if (!categorized) {
      counts.other++;
    }
  }

  return counts;
}

/**
 * Select appropriate profile based on change categories
 * @pure
 * @param {Object} counts - Change category counts from categorizeChanges
 * @returns {string} Profile name
 */
export function selectProfile(counts) {
  const { docs, code, tests, infrastructure, total } = counts;

  // No changes - full validation
  if (total === 0) {
    return 'full_validation';
  }

  // Infrastructure changes with code/test modifications trigger full validation (safety-first)
  if (infrastructure > 0 && (code > 0 || tests > 0)) {
    return 'full_validation';
  }

  // Infrastructure-only changes (possibly with docs)
  if (infrastructure > 0) {
    return 'infrastructure';
  }

  // Pure documentation changes
  if (docs > 0 && code === 0 && tests === 0) {
    return 'docs_only';
  }

  // Pure test changes
  if (tests > 0 && code === 0 && docs === 0) {
    return 'test_changes';
  }

  // Any code changes
  if (code > 0) {
    return 'code_changes';
  }

  // Mixed or unknown changes - full validation
  return 'full_validation';
}

/**
 * Get profile configuration by name
 * @pure
 * @param {string} profileName - Profile name
 * @returns {Object|null} Profile configuration or null if not found
 */
export function getProfile(profileName) {
  return WORKFLOW_PROFILES[profileName] || null;
}

/**
 * Get steps to skip for a profile
 * @pure
 * @param {string} profileName - Profile name
 * @returns {Array<number>} Array of step numbers to skip
 */
export function getSkipSteps(profileName) {
  const profile = getProfile(profileName);
  return profile ? profile.skipSteps : [];
}

/**
 * Get focus steps for a profile
 * @pure
 * @param {string} profileName - Profile name
 * @returns {Array<number>|string} Array of step numbers or 'all'
 */
export function getFocusSteps(profileName) {
  const profile = getProfile(profileName);
  return profile ? profile.focusSteps : 'all';
}

/**
 * Calculate estimated time savings
 * @pure
 * @param {string} profileName - Profile name
 * @param {number} baselineMinutes - Baseline time in minutes (default 25)
 * @returns {Object} Time savings information
 */
export function calculateSavings(profileName, baselineMinutes = 25) {
  const profile = getProfile(profileName);
  if (!profile) {
    return {
      baselineMinutes,
      estimatedMinutes: baselineMinutes,
      savedMinutes: 0,
      savingsPercent: 0,
    };
  }

  const savedMinutes = Math.round((baselineMinutes * profile.savingsPercent) / 100);
  const estimatedMinutes = baselineMinutes - savedMinutes;

  return {
    baselineMinutes,
    estimatedMinutes,
    savedMinutes,
    savingsPercent: profile.savingsPercent,
  };
}

/**
 * Validate profile name
 * @pure
 * @param {string} profileName - Profile name to validate
 * @returns {boolean} True if valid profile name
 */
export function isValidProfile(profileName) {
  return profileName in WORKFLOW_PROFILES;
}

/**
 * Get all profile names
 * @pure
 * @returns {Array<string>} Array of profile names
 */
export function getAllProfiles() {
  return Object.keys(WORKFLOW_PROFILES);
}

/**
 * Format profile info for display
 * @pure
 * @param {string} profileName - Profile name
 * @returns {string} Formatted profile information
 */
export function formatProfileInfo(profileName) {
  const profile = getProfile(profileName);
  if (!profile) {
    return `Unknown profile: ${profileName}`;
  }

  const lines = [
    `Profile: ${profile.name}`,
    `Description: ${profile.description}`,
    `Estimated Time: ${profile.estimatedTime}`,
    `Time Savings: ${profile.savingsPercent}%`,
  ];

  if (profile.skipSteps.length > 0) {
    lines.push(`Skip Steps: ${profile.skipSteps.join(', ')}`);
  }

  if (profile.focusSteps !== 'all') {
    lines.push(`Focus Steps: ${profile.focusSteps.join(', ')}`);
  }

  return lines.join('\n');
}

// =============================================================================
// IMPURE WRAPPER CLASS
// =============================================================================

/**
 * Workflow profile manager
 * Handles profile detection and management with git integration
 */
export class WorkflowProfileManager {
  /**
   * Create workflow profile manager
   * @param {Object} options - Configuration options
   * @param {Object} options.gitAutomation - GitAutomation instance for change detection
   * @param {Object} options.env - Environment variables (default: process.env)
   */
  constructor(options = {}) {
    this.gitAutomation = options.gitAutomation || null;
    this.env = options.env || process.env;
    this.currentProfile = null;
    this.changeCounts = null;
  }

  /**
   * Detect workflow profile based on git changes
   * @async
   * @returns {Promise<string>} Detected profile name
   */
  async detectProfile() {
    // Skip if explicitly disabled
    if (this.env.SKIP_PROFILE_DETECTION === 'true') {
      logger.info('Profile detection disabled, using full_validation');
      this.currentProfile = 'full_validation';
      return this.currentProfile;
    }

    // Use manually set profile if available
    if (this.env.WORKFLOW_PROFILE) {
      const manualProfile = this.env.WORKFLOW_PROFILE;
      if (isValidProfile(manualProfile)) {
        logger.info(`Using manually set profile: ${manualProfile}`);
        this.currentProfile = manualProfile;
        return this.currentProfile;
      } else {
        logger.warn(`Invalid profile '${manualProfile}', using full_validation`);
        this.currentProfile = 'full_validation';
        return this.currentProfile;
      }
    }

    logger.info('Detecting workflow profile based on changes...');

    // Get changed files
    let changedFiles = [];
    try {
      if (this.gitAutomation) {
        const status = await this.gitAutomation.status();
        if (
          status.modified !== undefined ||
          status.added !== undefined ||
          status.deleted !== undefined
        ) {
          // Flat string array format
          changedFiles = [
            ...(status.modified || []),
            ...(status.added || []),
            ...(status.deleted || []),
          ];
        } else {
          // { staged, unstaged, untracked } object array format from parseGitStatus
          const allEntries = [
            ...(status.staged || []),
            ...(status.unstaged || []),
            ...(status.untracked || []),
          ];
          changedFiles = allEntries.map((e) => e.file).filter(Boolean);
        }
      }
    } catch (error) {
      logger.warn(`Could not detect changes: ${error.message}, using full_validation`);
      this.currentProfile = 'full_validation';
      return this.currentProfile;
    }

    // Categorize changes
    this.changeCounts = categorizeChanges(changedFiles);

    // Select profile
    this.currentProfile = selectProfile(this.changeCounts);

    logger.info(`Detected profile: ${this.currentProfile}`);
    logger.info(
      `  Changed files: ${this.changeCounts.total} ` +
        `(docs: ${this.changeCounts.docs}, code: ${this.changeCounts.code}, ` +
        `tests: ${this.changeCounts.tests}, infra: ${this.changeCounts.infrastructure}, ` +
        `other: ${this.changeCounts.other})`
    );

    return this.currentProfile;
  }

  /**
   * Re-run profile detection using a pre-computed file list (e.g. from CommitHistory).
   * Useful when git-status returns 0 changes but committed-since-last-run changes exist.
   * @param {string[]} fileList - Absolute or relative file paths to categorize
   */
  refreshWithFiles(fileList) {
    if (!Array.isArray(fileList) || fileList.length === 0) return;
    this.changeCounts = categorizeChanges(fileList);
    this.currentProfile = selectProfile(this.changeCounts);
  }

  /**
   * Get current profile
   * @returns {string|null} Current profile name or null if not detected
   */
  getCurrentProfile() {
    return this.currentProfile;
  }

  /**
   * Get current profile configuration
   * @returns {Object|null} Profile configuration or null if not detected
   */
  getCurrentProfileConfig() {
    return this.currentProfile ? getProfile(this.currentProfile) : null;
  }

  /**
   * Get steps to skip for current profile
   * @returns {Array<number>} Array of step numbers to skip
   */
  getSkipSteps() {
    return this.currentProfile ? getSkipSteps(this.currentProfile) : [];
  }

  /**
   * Get focus steps for current profile
   * @returns {Array<number>|string} Array of step numbers or 'all'
   */
  getFocusSteps() {
    return this.currentProfile ? getFocusSteps(this.currentProfile) : 'all';
  }

  /**
   * Check if a step should be skipped
   * @param {number} stepNumber - Step number to check
   * @returns {boolean} True if step should be skipped
   */
  shouldSkipStep(stepNumber) {
    return this.getSkipSteps().includes(stepNumber);
  }

  /**
   * Get time savings for current profile
   * @param {number} baselineMinutes - Baseline time in minutes
   * @returns {Object} Time savings information
   */
  getSavings(baselineMinutes = 25) {
    return this.currentProfile ? calculateSavings(this.currentProfile, baselineMinutes) : null;
  }

  /**
   * Display current profile information
   */
  displayProfileInfo() {
    if (!this.currentProfile) {
      logger.info('No profile detected yet. Run detectProfile() first.');
      return;
    }

    const info = formatProfileInfo(this.currentProfile);
    logger.info('\n' + info);

    if (this.changeCounts) {
      const savings = this.getSavings();
      if (savings && savings.savedMinutes > 0) {
        logger.info(
          `\nEstimated time savings: ${savings.savedMinutes} minutes (~${savings.savingsPercent}%)`
        );
      }
    }
  }

  /**
   * Set profile manually
   * @param {string} profileName - Profile name to set
   * @throws {Error} If invalid profile name
   */
  setProfile(profileName) {
    if (!isValidProfile(profileName)) {
      throw new Error(`Invalid profile name: ${profileName}`);
    }
    this.currentProfile = profileName;
    logger.info(`Profile set to: ${profileName}`);
  }

  /**
   * Reset profile detection
   */
  reset() {
    this.currentProfile = null;
    this.changeCounts = null;
  }
}

// Export default manager instance for convenience
export default WorkflowProfileManager;
