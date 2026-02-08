/**
 * Step 02_5 Submodule: Git Analysis
 * Purpose: Git history analysis for documentation outdatedness detection
 * Version: 2.0.0
 * Architecture: Referential transparency (pure functions + impure wrapper)
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default thresholds for staleness detection
 */
export const GIT_THRESHOLDS = {
  STALE_MONTHS: 6, // Files not modified in 6 months are stale
  OUTDATED_MONTHS: 12, // Files not modified in 12 months are outdated
  ABANDONED_MONTHS: 18, // Files not modified in 18 months are abandoned
  MIN_COMMITS: 3, // Minimum commits for active file
};

// ============================================================================
// PURE FUNCTIONS - Git Log Parsing
// ============================================================================

/**
 * Parse git log output for a file
 * Expected format: "timestamp|hash|author|subject"
 * @param {string} logOutput - Git log output
 * @returns {Array<Object>} - Array of commit objects
 */
export function parseGitLog(logOutput) {
  if (!logOutput || !logOutput.trim()) {
    return [];
  }

  const lines = logOutput.trim().split('\n');
  const commits = [];

  for (const line of lines) {
    const parts = line.split('|');
    if (parts.length >= 4) {
      commits.push({
        timestamp: parseInt(parts[0], 10),
        hash: parts[1].trim(),
        author: parts[2].trim(),
        subject: parts[3].trim(),
      });
    }
  }

  return commits;
}

/**
 * Extract last modified timestamp from git log
 * @param {Array<Object>} commits - Array of commit objects
 * @returns {number} - Unix timestamp or 0 if no commits
 */
export function extractLastModified(commits) {
  if (commits.length === 0) return 0;
  return commits[0].timestamp;
}

/**
 * Count commits within a time period
 * @param {Array<Object>} commits - Array of commit objects
 * @param {number} currentTime - Current timestamp
 * @param {number} months - Number of months to look back
 * @returns {number} - Commit count
 */
export function countRecentCommits(commits, currentTime, months) {
  const thresholdTime = currentTime - months * 30 * 24 * 60 * 60;
  return commits.filter((c) => c.timestamp >= thresholdTime).length;
}

// ============================================================================
// PURE FUNCTIONS - Staleness Detection
// ============================================================================

/**
 * Calculate age in months from timestamp
 * @param {number} timestamp - Unix timestamp
 * @param {number} currentTime - Current timestamp
 * @returns {number} - Age in months
 */
export function calculateAgeMonths(timestamp, currentTime) {
  if (timestamp === 0) return 0;
  const ageSeconds = currentTime - timestamp;
  return Math.floor(ageSeconds / (30 * 24 * 60 * 60));
}

/**
 * Check if file is recently modified
 * @param {number} lastModified - Last modified timestamp
 * @param {number} currentTime - Current timestamp
 * @param {number} thresholdMonths - Staleness threshold
 * @returns {boolean} - True if recent
 */
export function isRecentlyModified(lastModified, currentTime, thresholdMonths) {
  if (lastModified === 0) return true; // Not tracked = assume recent
  const ageMonths = calculateAgeMonths(lastModified, currentTime);
  return ageMonths < thresholdMonths;
}

/**
 * Determine staleness level
 * @param {number} ageMonths - Age in months
 * @param {Object} thresholds - Threshold configuration
 * @returns {string} - 'fresh', 'stale', 'outdated', or 'abandoned'
 */
export function determineStalenessLevel(ageMonths, thresholds = GIT_THRESHOLDS) {
  if (ageMonths < thresholds.STALE_MONTHS) return 'fresh';
  if (ageMonths < thresholds.OUTDATED_MONTHS) return 'stale';
  if (ageMonths < thresholds.ABANDONED_MONTHS) return 'outdated';
  return 'abandoned';
}

/**
 * Calculate staleness score (0-100, higher = more stale)
 * @param {number} ageMonths - Age in months
 * @param {number} commitCount - Recent commit count
 * @param {number} referenceCount - Number of files referencing this one
 * @param {Object} thresholds - Threshold configuration
 * @returns {number} - Staleness score (0-100)
 */
export function calculateStalenessScore(
  ageMonths,
  commitCount,
  referenceCount,
  thresholds = GIT_THRESHOLDS
) {
  // Base score from age (0-50 points)
  const maxAge = thresholds.ABANDONED_MONTHS;
  const ageScore = Math.min(50, (ageMonths / maxAge) * 50);

  // Commit activity score (0-30 points, inverted)
  const commitScore = Math.max(0, 30 - commitCount * 5);

  // Reference score (0-20 points, inverted)
  const refScore = Math.max(0, 20 - referenceCount * 2);

  return Math.min(100, Math.round(ageScore + commitScore + refScore));
}

// ============================================================================
// PURE FUNCTIONS - Reference Counting
// ============================================================================

/**
 * Count markdown link references to a file
 * @param {string} content - File content to search
 * @param {string} filename - Target filename (basename)
 * @returns {number} - Number of references found
 */
export function countFileReferences(content, filename) {
  // Match markdown links: [text](filename) or [text](path/to/filename)
  const regex = new RegExp(`\\]\\([^)]*${filename}\\)`, 'g');
  const matches = content.match(regex);
  return matches ? matches.length : 0;
}

/**
 * Find all files that reference a target file
 * @param {Map<string, string>} fileContents - Map of filename -> content
 * @param {string} targetFile - Target file path
 * @returns {Array<string>} - Array of files that reference the target
 */
export function findReferencingFiles(fileContents, targetFile) {
  const basename = targetFile.split('/').pop();
  const referencingFiles = [];

  for (const [file, content] of fileContents.entries()) {
    if (file === targetFile) continue; // Skip self-references

    const refCount = countFileReferences(content, basename);
    if (refCount > 0) {
      referencingFiles.push(file);
    }
  }

  return referencingFiles;
}

// ============================================================================
// PURE FUNCTIONS - Analysis Results
// ============================================================================

/**
 * Build git analysis report for a file
 * @param {string} filePath - File path
 * @param {Object} data - Analysis data
 * @param {number} data.lastModified - Last modified timestamp
 * @param {number} data.ageMonths - Age in months
 * @param {number} data.commitCount - Recent commit count
 * @param {number} data.referenceCount - Reference count
 * @param {number} data.currentTime - Current timestamp
 * @returns {Object} - Analysis report
 */
export function buildFileAnalysis(filePath, data) {
  const { lastModified, ageMonths, commitCount, referenceCount } = data;

  const stalenessLevel = determineStalenessLevel(ageMonths);
  const stalenessScore = calculateStalenessScore(ageMonths, commitCount, referenceCount);

  return {
    file: filePath,
    lastModified,
    ageMonths,
    commitCount,
    referenceCount,
    stalenessLevel,
    stalenessScore,
    isOutdated: stalenessLevel === 'outdated' || stalenessLevel === 'abandoned',
    isAbandoned: stalenessLevel === 'abandoned',
  };
}

/**
 * Filter files by staleness level
 * @param {Array<Object>} analyses - Array of file analyses
 * @param {string} level - Staleness level to filter by
 * @returns {Array<Object>} - Filtered analyses
 */
export function filterByStalenessLevel(analyses, level) {
  return analyses.filter((a) => a.stalenessLevel === level);
}

/**
 * Sort analyses by staleness score descending
 * @param {Array<Object>} analyses - Array of file analyses
 * @returns {Array<Object>} - Sorted analyses
 */
export function sortByStalenesScore(analyses) {
  return [...analyses].sort((a, b) => b.stalenessScore - a.stalenessScore);
}

/**
 * Generate summary statistics
 * @param {Array<Object>} analyses - Array of file analyses
 * @returns {Object} - Summary statistics
 */
export function generateSummaryStats(analyses) {
  const byLevel = {
    fresh: filterByStalenessLevel(analyses, 'fresh').length,
    stale: filterByStalenessLevel(analyses, 'stale').length,
    outdated: filterByStalenessLevel(analyses, 'outdated').length,
    abandoned: filterByStalenessLevel(analyses, 'abandoned').length,
  };

  const avgAge =
    analyses.length > 0
      ? Math.round(analyses.reduce((sum, a) => sum + a.ageMonths, 0) / analyses.length)
      : 0;

  const avgScore =
    analyses.length > 0
      ? Math.round(analyses.reduce((sum, a) => sum + a.stalenessScore, 0) / analyses.length)
      : 0;

  return {
    totalFiles: analyses.length,
    byLevel,
    avgAgeMonths: avgAge,
    avgStalenessScore: avgScore,
  };
}

// ============================================================================
// GIT ANALYZER - Impure Wrapper Class
// ============================================================================

/**
 * Git analyzer for documentation staleness detection
 * Manages git operations and analysis coordination
 */
export class GitAnalyzer {
  constructor(options = {}) {
    this.gitAutomation = options.gitAutomation; // GitAutomation instance
    this.fileOps = options.fileOps; // FileOperations instance
    this.thresholds = options.thresholds || GIT_THRESHOLDS;
    this.logger = options.logger || console;
  }

  /**
   * Get git log for a file
   * @param {string} filePath - File path
   * @returns {Promise<Array<Object>>} - Array of commits
   */
  async getFileHistory(filePath) {
    try {
      // Format: timestamp|hash|author|subject
      const format = '%ct|%h|%an|%s';
      const result = await this.gitAutomation.executeGitCommand(
        ['log', `--format=${format}`, '--', filePath],
        { captureOutput: true }
      );

      return parseGitLog(result.stdout);
    } catch (error) {
      this.logger.warn(`Failed to get git history for ${filePath}: ${error.message}`);
      return [];
    }
  }

  /**
   * Analyze staleness for all files
   * @param {Array<string>} filePaths - Array of file paths
   * @param {number} currentTime - Current timestamp (injected for testing)
   * @returns {Promise<Array<Object>>} - Array of file analyses
   */
  async analyzeFiles(filePaths, currentTime = Date.now() / 1000) {
    this.logger.info(`Analyzing git history for ${filePaths.length} files...`);

    const analyses = [];

    // Get all file contents for reference counting
    const fileContents = new Map();
    for (const file of filePaths) {
      try {
        const content = await this.fileOps.readFile(file);
        fileContents.set(file, content);
      } catch (error) {
        this.logger.warn(`Could not read ${file}: ${error.message}`);
      }
    }

    // Analyze each file
    for (const file of filePaths) {
      const commits = await this.getFileHistory(file);
      const lastModified = extractLastModified(commits);
      const ageMonths = calculateAgeMonths(lastModified, currentTime);
      const commitCount = countRecentCommits(commits, currentTime, this.thresholds.STALE_MONTHS);

      // Count references
      const referencingFiles = findReferencingFiles(fileContents, file);
      const referenceCount = referencingFiles.length;

      const analysis = buildFileAnalysis(file, {
        lastModified,
        ageMonths,
        commitCount,
        referenceCount,
        currentTime,
      });

      analyses.push(analysis);
    }

    this.logger.info(`Completed git analysis for ${analyses.length} files`);
    return analyses;
  }

  /**
   * Identify outdated files
   * @param {Array<Object>} analyses - File analyses
   * @returns {Array<Object>} - Outdated file analyses
   */
  getOutdatedFiles(analyses) {
    return analyses.filter((a) => a.isOutdated);
  }

  /**
   * Identify abandoned files
   * @param {Array<Object>} analyses - File analyses
   * @returns {Array<Object>} - Abandoned file analyses
   */
  getAbandonedFiles(analyses) {
    return analyses.filter((a) => a.isAbandoned);
  }

  /**
   * Get summary statistics
   * @param {Array<Object>} analyses - File analyses
   * @returns {Object} - Summary statistics
   */
  getSummary(analyses) {
    return generateSummaryStats(analyses);
  }

  /**
   * Format analysis results for display
   * @param {Array<Object>} analyses - File analyses
   * @param {number} limit - Maximum number to show
   * @returns {string} - Formatted output
   */
  formatResults(analyses, limit = 10) {
    const sorted = sortByStalenesScore(analyses);
    const summary = generateSummaryStats(analyses);

    let output = `\n=== Git Analysis Summary ===\n`;
    output += `Total Files: ${summary.totalFiles}\n`;
    output += `Fresh: ${summary.byLevel.fresh}, Stale: ${summary.byLevel.stale}, `;
    output += `Outdated: ${summary.byLevel.outdated}, Abandoned: ${summary.byLevel.abandoned}\n`;
    output += `Average Age: ${summary.avgAgeMonths} months\n`;
    output += `Average Staleness Score: ${summary.avgStalenessScore}/100\n\n`;

    output += `Top ${limit} Stale Files:\n`;
    for (const analysis of sorted.slice(0, limit)) {
      output += `  - ${analysis.file}\n`;
      output += `    Age: ${analysis.ageMonths} months, `;
      output += `Score: ${analysis.stalenessScore}/100, `;
      output += `Level: ${analysis.stalenessLevel}\n`;
    }

    return output;
  }
}
