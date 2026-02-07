/**
 * @fileoverview Docs-Only Optimization Module (v2.0.0)
 *
 * Provides fast path optimization for documentation-only changes.
 * Detects docs-only modifications and skips unnecessary workflow steps.
 *
 * Architecture: Referential Transparency (v2.0.0)
 * - Pure functions for docs detection, step filtering, and time estimation
 * - DocsOnlyOptimizer wrapper class for workflow integration
 *
 * @module lib/docs_only_optimization
 * @version 2.0.0
 */

import logger from '../core/logger.js';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Documentation file patterns
 * @constant {Array<RegExp>}
 */
export const DOCS_PATTERNS = [
  /\.md$/i, // Markdown
  /\.mdx$/i, // MDX
  /\.txt$/i, // Text files
  /^README/i, // README files
  /^CHANGELOG/i, // Changelog
  /^CONTRIBUTING/i, // Contributing guide
  /^LICENSE/i, // License
  /\.rst$/i, // reStructuredText
  /\.adoc$/i, // AsciiDoc
  /^docs?\//i, // docs/ directory
  /^documentation\//i, // documentation/ directory
];

/**
 * Steps that should run even for docs-only changes
 * @constant {Array<string>}
 */
export const ALWAYS_RUN_STEPS = [
  'step1', // Documentation validation
  'step15', // Summary generation
  'git_commit', // Auto-commit
];

/**
 * Steps to skip for docs-only changes
 * @constant {Array<string>}
 */
export const SKIPPABLE_STEPS = [
  'step2', // Project structure analysis
  'step3', // Shell script validation
  'step4', // GitHub workflow validation
  'step5', // Test generation
  'step6', // Test execution
  'step7', // Test coverage
  'step8', // Code review
  'step9', // Code quality validation
  'step10', // Security analysis
  'step11', // Performance testing
  'step12', // Integration testing
  'step13', // Deployment preparation
  'step14', // Monitoring setup
];

/**
 * Average step durations (in seconds)
 * Used for time savings estimation
 * @constant {Object}
 */
export const AVERAGE_STEP_DURATIONS = {
  step1: 30,
  step2: 20,
  step3: 15,
  step4: 10,
  step5: 60,
  step6: 120,
  step7: 45,
  step8: 90,
  step9: 180,
  step10: 60,
  step11: 90,
  step12: 120,
  step13: 30,
  step14: 20,
  step15: 10,
};

// ============================================================================
// PURE FUNCTIONS - Documentation Detection
// ============================================================================

/**
 * Check if file is a documentation file
 * @pure
 * @param {string} filepath - File path to check
 * @returns {boolean} True if documentation file
 */
export function isDocsFile(filepath) {
  if (typeof filepath !== 'string' || !filepath) {
    return false;
  }

  return DOCS_PATTERNS.some((pattern) => pattern.test(filepath));
}

/**
 * Check if changes are documentation-only
 * @pure
 * @param {Array<string>} changedFiles - List of changed files
 * @returns {boolean} True if all changes are docs
 */
export function isDocsOnlyChange(changedFiles) {
  if (!Array.isArray(changedFiles) || changedFiles.length === 0) {
    return false;
  }

  return changedFiles.every((file) => isDocsFile(file));
}

/**
 * Categorize files by type
 * @pure
 * @param {Array<string>} files - List of files
 * @returns {Object} Categorized files
 */
export function categorizeFiles(files) {
  const docs = [];
  const code = [];
  const other = [];

  for (const file of files) {
    if (isDocsFile(file)) {
      docs.push(file);
    } else if (file.match(/\.(js|jsx|ts|tsx|py|java|go|rs|c|cpp|h|hpp)$/i)) {
      code.push(file);
    } else {
      other.push(file);
    }
  }

  return { docs, code, other };
}

/**
 * Calculate documentation change percentage
 * @pure
 * @param {Array<string>} changedFiles - List of changed files
 * @returns {number} Percentage of docs changes (0-100)
 */
export function calculateDocsPercentage(changedFiles) {
  if (!Array.isArray(changedFiles) || changedFiles.length === 0) {
    return 0;
  }

  const docsCount = changedFiles.filter((file) => isDocsFile(file)).length;
  return Math.round((docsCount / changedFiles.length) * 100 * 100) / 100;
}

// ============================================================================
// PURE FUNCTIONS - Step Filtering
// ============================================================================

/**
 * Determine if step should run for docs-only changes
 * @pure
 * @param {string} stepId - Step identifier
 * @returns {boolean} True if step should run
 */
export function shouldRunStep(stepId) {
  if (!stepId || typeof stepId !== 'string') {
    return false;
  }

  return ALWAYS_RUN_STEPS.includes(stepId);
}

/**
 * Filter steps for docs-only workflow
 * @pure
 * @param {Array<string>} allSteps - All workflow steps
 * @returns {Array<string>} Filtered steps to execute
 */
export function filterDocsOnlySteps(allSteps) {
  if (!Array.isArray(allSteps)) {
    return [];
  }

  return allSteps.filter((stepId) => shouldRunStep(stepId));
}

/**
 * Get steps to skip for docs-only changes
 * @pure
 * @param {Array<string>} allSteps - All workflow steps
 * @returns {Array<string>} Steps that will be skipped
 */
export function getSkippedSteps(allSteps) {
  if (!Array.isArray(allSteps)) {
    return [];
  }

  return allSteps.filter((stepId) => !shouldRunStep(stepId));
}

// ============================================================================
// PURE FUNCTIONS - Time Estimation
// ============================================================================

/**
 * Estimate time savings from skipping steps
 * @pure
 * @param {Array<string>} skippedSteps - Steps that will be skipped
 * @returns {number} Estimated time savings in seconds
 */
export function estimateTimeSavings(skippedSteps) {
  if (!Array.isArray(skippedSteps) || skippedSteps.length === 0) {
    return 0;
  }

  let totalSavings = 0;
  for (const stepId of skippedSteps) {
    totalSavings += AVERAGE_STEP_DURATIONS[stepId] || 0;
  }

  return totalSavings;
}

/**
 * Calculate speedup percentage
 * @pure
 * @param {number} originalTime - Original workflow time in seconds
 * @param {number} optimizedTime - Optimized workflow time in seconds
 * @returns {number} Speedup percentage (e.g., 85 for 85% faster)
 */
export function calculateSpeedup(originalTime, optimizedTime) {
  if (typeof originalTime !== 'number' || typeof optimizedTime !== 'number' || originalTime <= 0) {
    return 0;
  }

  const timeSaved = originalTime - optimizedTime;
  return Math.round((timeSaved / originalTime) * 100 * 100) / 100;
}

/**
 * Format duration in human-readable format
 * @pure
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration
 */
export function formatDuration(seconds) {
  if (typeof seconds !== 'number' || seconds < 0) {
    return '0s';
  }

  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);

  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

// ============================================================================
// PURE FUNCTIONS - Optimization Report
// ============================================================================

/**
 * Build optimization report
 * @pure
 * @param {Object} analysis - Analysis results
 * @returns {Object} Formatted report
 */
export function buildOptimizationReport(analysis) {
  const {
    isDocsOnly = false,
    docsPercentage = 0,
    changedFiles = [],
    categorization = {},
    stepsToRun = [],
    stepsToSkip = [],
    timeSavings = 0,
    speedup = 0,
  } = analysis;

  return {
    optimizationType: isDocsOnly ? 'docs-only' : 'standard',
    confidence: isDocsOnly ? 1.0 : 0,
    summary: {
      changedFiles: changedFiles.length,
      docsFiles: categorization.docs?.length || 0,
      codeFiles: categorization.code?.length || 0,
      docsPercentage: `${docsPercentage}%`,
    },
    steps: {
      total: stepsToRun.length + stepsToSkip.length,
      toRun: stepsToRun.length,
      toSkip: stepsToSkip.length,
      skippedList: stepsToSkip,
    },
    performance: {
      timeSavings: formatDuration(timeSavings),
      timeSavingsSeconds: timeSavings,
      speedup: `${speedup}%`,
      speedupPercentage: speedup,
    },
    recommendation: isDocsOnly
      ? 'Use docs-only fast path for maximum speed'
      : 'Use standard workflow (non-docs changes detected)',
  };
}

// ============================================================================
// DOCS-ONLY OPTIMIZER CLASS (Impure Wrapper)
// ============================================================================

/**
 * Docs-Only Optimizer
 * Detects documentation-only changes and optimizes workflow execution
 */
export class DocsOnlyOptimizer {
  /**
   * Create docs-only optimizer
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.customDocsPatterns = options.docsPatterns || [];
    this.customStepDurations = options.stepDurations || {};
  }

  /**
   * Analyze changes for docs-only optimization
   * @param {Array<string>} changedFiles - List of changed files
   * @param {Array<string>} allSteps - All workflow steps
   * @returns {Object} Analysis results
   */
  analyze(changedFiles, allSteps) {
    if (!Array.isArray(changedFiles) || !Array.isArray(allSteps)) {
      throw new TypeError('changedFiles and allSteps must be arrays');
    }

    // Detect docs-only changes (pure function)
    const isDocsOnly = isDocsOnlyChange(changedFiles);

    // Categorize files (pure function)
    const categorization = categorizeFiles(changedFiles);

    // Calculate docs percentage (pure function)
    const docsPercentage = calculateDocsPercentage(changedFiles);

    // Filter steps (pure functions)
    const stepsToRun = isDocsOnly ? filterDocsOnlySteps(allSteps) : allSteps;
    const stepsToSkip = isDocsOnly ? getSkippedSteps(allSteps) : [];

    // Estimate time savings (pure function)
    const timeSavings = estimateTimeSavings(stepsToSkip);

    // Calculate total times
    const originalTime = allSteps.reduce(
      (sum, stepId) => sum + (AVERAGE_STEP_DURATIONS[stepId] || 0),
      0
    );
    const optimizedTime = stepsToRun.reduce(
      (sum, stepId) => sum + (AVERAGE_STEP_DURATIONS[stepId] || 0),
      0
    );

    // Calculate speedup (pure function)
    const speedup = calculateSpeedup(originalTime, optimizedTime);

    const analysis = {
      isDocsOnly,
      docsPercentage,
      changedFiles,
      categorization,
      stepsToRun,
      stepsToSkip,
      timeSavings,
      originalTime,
      optimizedTime,
      speedup,
    };

    logger.info(
      `Docs-only analysis: ${isDocsOnly ? 'YES' : 'NO'} (${docsPercentage}% docs, ${speedup}% faster)`
    );

    return analysis;
  }

  /**
   * Get optimization report
   * @param {Object} analysis - Analysis results from analyze()
   * @returns {Object} Formatted report
   */
  getReport(analysis) {
    return buildOptimizationReport(analysis); // Pure function
  }

  /**
   * Check if optimization should be applied
   * @param {Object} analysis - Analysis results
   * @param {number} minDocsPercentage - Minimum docs percentage (default: 100)
   * @returns {boolean} True if optimization recommended
   */
  shouldOptimize(analysis, minDocsPercentage = 100) {
    if (!analysis || typeof analysis.docsPercentage !== 'number') {
      return false;
    }

    return analysis.isDocsOnly && analysis.docsPercentage >= minDocsPercentage;
  }

  /**
   * Get optimized workflow configuration
   * @param {Array<string>} allSteps - All workflow steps
   * @param {Array<string>} changedFiles - Changed files
   * @returns {Object} Optimized workflow config
   */
  getOptimizedWorkflow(allSteps, changedFiles) {
    const analysis = this.analyze(changedFiles, allSteps);

    if (!this.shouldOptimize(analysis)) {
      logger.debug('Docs-only optimization not applicable, using standard workflow');
      return {
        steps: allSteps,
        optimized: false,
        reason: 'Non-docs changes detected',
      };
    }

    logger.info(`Applying docs-only optimization (skipping ${analysis.stepsToSkip.length} steps)`);

    return {
      steps: analysis.stepsToRun,
      optimized: true,
      skippedSteps: analysis.stepsToSkip,
      timeSavings: analysis.timeSavings,
      speedup: analysis.speedup,
    };
  }
}
