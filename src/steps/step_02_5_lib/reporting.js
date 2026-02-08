/**
 * Step 02_5 Submodule: Reporting
 * Purpose: Generate optimization reports and metrics
 * Version: 2.0.0
 * Architecture: Referential transparency (pure functions + impure wrapper)
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Report sections
 */
export const REPORT_SECTIONS = {
  SUMMARY: 'summary',
  DUPLICATES: 'duplicates',
  REDUNDANT: 'redundant',
  OUTDATED: 'outdated',
  RECOMMENDATIONS: 'recommendations',
};

/**
 * Default recommendations
 */
export const DEFAULT_RECOMMENDATIONS = [
  'Review redundant pairs above 80% similarity for potential consolidation',
  'Update version references in remaining documentation',
  'Run this optimization quarterly to maintain documentation quality',
];

// ============================================================================
// PURE FUNCTIONS - Metrics Calculation
// ============================================================================

/**
 * Calculate total file size
 * @param {Array<Object>} files - Array of {path, size}
 * @returns {number} - Total size in bytes
 */
export function calculateTotalSize(files) {
  return files.reduce((sum, file) => sum + (file.size || 0), 0);
}

/**
 * Calculate size savings
 * @param {number} beforeSize - Size before optimization (bytes)
 * @param {number} afterSize - Size after optimization (bytes)
 * @returns {Object} - {bytes, kilobytes, percentage}
 */
export function calculateSizeSavings(beforeSize, afterSize) {
  const bytes = Math.max(0, beforeSize - afterSize);
  const kilobytes = Math.round(bytes / 1024);
  const percentage = beforeSize > 0 ? Math.round((bytes / beforeSize) * 100) : 0;

  return { bytes, kilobytes, percentage };
}

/**
 * Estimate token savings (rough: 1 token ≈ 4 characters)
 * @param {number} bytes - Size in bytes
 * @returns {number} - Estimated tokens
 */
export function estimateTokenSavings(bytes) {
  return Math.round(bytes / 4);
}

/**
 * Calculate optimization metrics
 * @param {Object} data - Optimization data
 * @returns {Object} - Calculated metrics
 */
export function calculateOptimizationMetrics(data) {
  const {
    totalFiles = 0,
    exactDuplicates = [],
    redundantPairs = [],
    outdatedFiles = [],
    archivedFiles = [],
    beforeSize = 0,
    afterSize = 0,
  } = data;

  const filesRemoved = archivedFiles.length;
  const sizeSavings = calculateSizeSavings(beforeSize, afterSize);
  const tokenSavings = estimateTokenSavings(sizeSavings.bytes);

  return {
    totalFiles,
    exactDuplicatesFound: exactDuplicates.length,
    redundantPairsFound: redundantPairs.length,
    outdatedFilesFound: outdatedFiles.length,
    filesRemoved,
    sizeSavings,
    tokenSavings,
  };
}

// ============================================================================
// PURE FUNCTIONS - Report Formatting
// ============================================================================

/**
 * Format timestamp
 * @param {number} timestamp - Time in ms
 * @returns {string} - Formatted timestamp (YYYY-MM-DD HH:MM:SS)
 */
export function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Format file list for report
 * @param {Array<string>} files - File paths
 * @param {string} noneText - Text to show when empty
 * @returns {string} - Formatted list
 */
export function formatFileList(files, noneText = 'None') {
  if (!files || files.length === 0) {
    return noneText;
  }
  return files.map((f) => `- \`${f}\``).join('\n');
}

/**
 * Format redundant pairs for report
 * @param {Array<Object>} pairs - Array of {file1, file2, similarity}
 * @param {string} noneText - Text to show when empty
 * @returns {string} - Formatted pairs
 */
export function formatRedundantPairs(pairs, noneText = 'None') {
  if (!pairs || pairs.length === 0) {
    return noneText;
  }
  return pairs
    .map(
      (p) => `- \`${p.file1}\` ↔ \`${p.file2}\` (similarity: ${Math.round(p.similarity * 100)}%)`
    )
    .join('\n');
}

/**
 * Format summary section
 * @param {Object} metrics - Optimization metrics
 * @param {string} projectName - Project name
 * @param {number} timestamp - Generation timestamp
 * @returns {string} - Formatted summary
 */
export function formatSummarySection(metrics, projectName, timestamp) {
  const time = formatTimestamp(timestamp);
  return `# Documentation Optimization Report

**Generated:** ${time}  
**Project:** ${projectName}

## Summary

- **Total files analyzed:** ${metrics.totalFiles}
- **Exact duplicates found:** ${metrics.exactDuplicatesFound}
- **Redundant pairs found:** ${metrics.redundantPairsFound}
- **Outdated files found:** ${metrics.outdatedFilesFound}
- **Files removed/archived:** ${metrics.filesRemoved}
- **Size reduction:** ${metrics.sizeSavings.kilobytes}KB (${metrics.sizeSavings.percentage}%)
- **Estimated token savings:** ~${metrics.tokenSavings} tokens
`;
}

/**
 * Format actions section
 * @param {Object} data - {exactDuplicates, outdatedFiles, redundantPairs}
 * @returns {string} - Formatted actions
 */
export function formatActionsSection(data) {
  const { exactDuplicates = [], outdatedFiles = [], redundantPairs = [] } = data;

  return `## Actions Taken

### Exact Duplicates Consolidated

${formatFileList(exactDuplicates)}

### Outdated Files Archived

${formatFileList(outdatedFiles)}

### Redundant Pairs (Manual Review Recommended)

${formatRedundantPairs(redundantPairs)}
`;
}

/**
 * Format recommendations section
 * @param {Array<string>} recommendations - Custom recommendations
 * @returns {string} - Formatted recommendations
 */
export function formatRecommendationsSection(recommendations = []) {
  const recs = recommendations.length > 0 ? recommendations : DEFAULT_RECOMMENDATIONS;
  const formatted = recs.map((r) => `- ${r}`).join('\n');

  return `## Recommendations

${formatted}
`;
}

/**
 * Format archive location section
 * @param {string} archiveDir - Archive directory path
 * @returns {string} - Formatted archive info
 */
export function formatArchiveSection(archiveDir) {
  return `## Archive Location

All modified files have been archived to:
\`${archiveDir}\`

To restore files, copy them back from the archive directory.
`;
}

/**
 * Generate complete optimization report
 * @param {Object} data - Report data
 * @returns {string} - Complete markdown report
 */
export function generateOptimizationReport(data) {
  const {
    metrics,
    projectName,
    timestamp,
    exactDuplicates,
    outdatedFiles,
    redundantPairs,
    archiveDir,
    recommendations,
  } = data;

  const sections = [
    formatSummarySection(metrics, projectName, timestamp),
    formatActionsSection({ exactDuplicates, outdatedFiles, redundantPairs }),
    formatRecommendationsSection(recommendations),
    formatArchiveSection(archiveDir),
  ];

  return sections.join('\n');
}

// ============================================================================
// PURE FUNCTIONS - Console Output
// ============================================================================

/**
 * Format console summary
 * @param {Object} metrics - Optimization metrics
 * @returns {string} - Console-friendly summary
 */
export function formatConsoleSummary(metrics) {
  return `
📊 Optimization Complete!
═══════════════════════
  Files analyzed: ${metrics.totalFiles}
  Files optimized: ${metrics.filesRemoved}
  Size saved: ${metrics.sizeSavings.kilobytes}KB (${metrics.sizeSavings.percentage}%)
  Token savings: ~${metrics.tokenSavings}
`;
}

// ============================================================================
// REPORTING MANAGER - Impure Wrapper Class
// ============================================================================

/**
 * Reporting manager for optimization reports
 * Handles report generation and file I/O
 */
export class ReportingManager {
  constructor(options = {}) {
    this.fileOps = options.fileOps; // FileOperations instance
    this.projectName = options.projectName || 'Unknown Project';
    this.logger = options.logger || console;
  }

  /**
   * Calculate metrics from optimization data
   * @param {Object} data - Optimization data
   * @returns {Object} - Calculated metrics
   */
  calculateMetrics(data) {
    return calculateOptimizationMetrics(data);
  }

  /**
   * Generate and save optimization report
   * @param {Object} data - Optimization data
   * @param {string} outputPath - Report file path
   * @returns {Promise<Object>} - {reportPath, metrics, content}
   */
  async generateReport(data, outputPath) {
    this.logger.info('Generating optimization report...');

    const timestamp = Date.now();
    const metrics = this.calculateMetrics(data);

    const reportData = {
      metrics,
      projectName: this.projectName,
      timestamp,
      exactDuplicates: data.exactDuplicates || [],
      outdatedFiles: data.outdatedFiles || [],
      redundantPairs: data.redundantPairs || [],
      archiveDir: data.archiveDir || '.ai_workflow/archive/docs',
      recommendations: data.recommendations || [],
    };

    const content = generateOptimizationReport(reportData);

    try {
      await this.fileOps.writeFile(outputPath, content);
      this.logger.info(`Report saved: ${outputPath}`);

      return {
        reportPath: outputPath,
        metrics,
        content,
      };
    } catch (error) {
      this.logger.error(`Failed to save report: ${error.message}`);
      throw error;
    }
  }

  /**
   * Display console summary
   * @param {Object} metrics - Optimization metrics
   */
  displaySummary(metrics) {
    const summary = formatConsoleSummary(metrics);
    this.logger.info(summary);
  }

  /**
   * Generate report and display summary
   * @param {Object} data - Optimization data
   * @param {string} outputPath - Report file path
   * @returns {Promise<Object>} - Report result
   */
  async generateAndDisplay(data, outputPath) {
    const result = await this.generateReport(data, outputPath);
    this.displaySummary(result.metrics);
    this.logger.info(`\nFull report: ${result.reportPath}`);
    return result;
  }
}
