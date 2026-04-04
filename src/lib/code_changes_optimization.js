/**
 * @fileoverview Code Changes Optimization (v2.0.0)
 *
 * Smart optimization for code-only changes with pattern detection and
 * selective step execution based on code type and complexity.
 *
 * Architecture: Referential Transparency (Phase 8.7)
 * - Pure functions: Code detection, pattern analysis, step filtering
 * - Impure wrapper: FileOperations integration, analysis caching
 *
 * @module lib/code_changes_optimization
 * @version 2.0.0
 * @since 2026-02-07
 */

import path from 'path';
import { FileOperations } from './file_operations.js';
import { logger } from '../core/logger.js';

/**
 * Code file extensions by category
 * @constant {Object}
 */
export const CODE_PATTERNS = {
  // Frontend
  frontend: ['.jsx', '.tsx', '.vue', '.svelte', '.css', '.scss', '.sass', '.less'],

  // Backend
  backend: ['.js', '.ts', '.py', '.rb', '.go', '.java', '.php', '.rs'],

  // API/Routes
  api: ['api/', 'routes/', 'controllers/', 'endpoints/'],

  // Configuration
  config: ['.json', '.yaml', '.yml', '.toml', '.ini', '.env', 'config/'],

  // Tests
  test: ['.test.', '.spec.', '__tests__/', 'test/', 'tests/'],

  // Build/Tooling
  build: ['webpack', 'rollup', 'vite', 'babel', 'tsconfig', 'package.json'],

  // Database
  database: ['migrations/', 'schema/', 'models/', '.sql'],
};

/**
 * Steps that should always run regardless of code changes
 * @constant {Array<string>}
 */
export const ALWAYS_RUN_STEPS = ['step1', 'step15', 'git_commit'];

/**
 * Steps that can be skipped for specific code change patterns
 * @constant {Object}
 */
export const CONDITIONAL_STEPS = {
  // Config-only changes can skip these
  config_only: ['step2', 'step3', 'step4', 'step5', 'step8'],

  // Frontend-only changes can skip these
  frontend_only: ['step6', 'step10', 'step12'],

  // Test-only changes can skip these (except test execution)
  test_only: ['step2', 'step3', 'step4', 'step5', 'step8'],

  // Build-only changes can skip these
  build_only: ['step2', 'step3', 'step4', 'step5'],
};

/**
 * Average step durations (seconds) for time estimation
 * @constant {Object}
 */
export const AVERAGE_STEP_DURATIONS = {
  step1: 120,
  step2: 60,
  step3: 30,
  step4: 45,
  step5: 90,
  step6: 180,
  step7: 150,
  step8: 120,
  step9: 2700, // 45 minutes
  step10: 60,
  step11: 90,
  step12: 120,
  step13: 180,
  step14: 240,
  step15: 30,
  git_commit: 5,
};

// ============================================================================
// PURE FUNCTIONS (Referentially Transparent)
// ============================================================================

/**
 * Check if a file is a code file
 * @pure
 * @param {string} filePath - File path to check
 * @returns {boolean} True if file is code
 */
export function isCodeFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const basename = path.basename(filePath).toLowerCase();
  const dirname = path.dirname(filePath).toLowerCase();

  // Check all code patterns
  for (const category of Object.values(CODE_PATTERNS)) {
    for (const pattern of category) {
      if (pattern.startsWith('.') && ext === pattern) return true;
      if (pattern.endsWith('/') && dirname.includes(pattern.slice(0, -1))) return true;
      if (basename.includes(pattern)) return true;
    }
  }

  return false;
}

/**
 * Categorize a code file by type
 * @pure
 * @param {string} filePath - File path to categorize
 * @returns {Array<string>} Array of categories (file can match multiple)
 */
export function categorizeCodeFile(filePath) {
  const categories = [];
  const ext = path.extname(filePath).toLowerCase();
  const basename = path.basename(filePath).toLowerCase();
  const dirname = path.dirname(filePath).toLowerCase();

  for (const [category, patterns] of Object.entries(CODE_PATTERNS)) {
    for (const pattern of patterns) {
      let matches;

      // Check extension patterns (must start with single '.')
      if (pattern.startsWith('.') && !pattern.slice(1).includes('.') && !pattern.endsWith('/')) {
        matches = ext === pattern;
      }
      // Check directory patterns (must end with '/')
      else if (pattern.endsWith('/')) {
        matches = dirname.includes(pattern.slice(0, -1));
      }
      // Check substring patterns (e.g., '.test.', '.spec.')
      else {
        matches = basename.includes(pattern);
      }

      if (matches && !categories.includes(category)) {
        categories.push(category);
        break;
      }
    }
  }

  return categories;
}

/**
 * Check if changes are code-only (no docs, no tests in primary sense)
 * @pure
 * @param {Array<Object>} changes - Array of change objects with {path, type}
 * @returns {boolean} True if all changes are code files
 */
export function isCodeOnlyChange(changes) {
  if (!Array.isArray(changes) || changes.length === 0) return false;

  return changes.every((change) => {
    const filePath = change.path || change.file || '';
    return isCodeFile(filePath);
  });
}

/**
 * Analyze code change patterns
 * @pure
 * @param {Array<Object>} changes - Array of change objects
 * @returns {Object} Pattern analysis with counts and percentages
 */
export function analyzeCodePatterns(changes) {
  // Track files per category (allows overlaps)
  const filesByCategory = {
    frontend: [],
    backend: [],
    api: [],
    config: [],
    test: [],
    build: [],
    database: [],
  };

  let totalCode = 0;

  for (const change of changes) {
    const filePath = change.path || change.file || '';
    if (!isCodeFile(filePath)) continue;

    totalCode++;
    const categories = categorizeCodeFile(filePath);

    // Add file to each matching category
    for (const category of categories) {
      if (filesByCategory[category] !== undefined) {
        filesByCategory[category].push(filePath);
      }
    }
  }

  // Count unique files per category
  const patterns = {};
  for (const [category, files] of Object.entries(filesByCategory)) {
    patterns[category] = files.length;
  }

  // Calculate percentages (can sum to > 100% due to overlaps)
  const percentages = {};
  for (const [category, count] of Object.entries(patterns)) {
    percentages[category] = totalCode > 0 ? count / totalCode : 0;
  }

  // Determine primary pattern (excluding test/build which are often overlaps)
  let primaryPattern = 'mixed';
  let maxCount = 0;

  const primaryCategories = ['frontend', 'backend', 'api', 'config', 'database'];
  for (const category of primaryCategories) {
    const count = patterns[category] || 0;
    if (count > maxCount) {
      maxCount = count;
      primaryPattern = category;
    }
  }

  // Check for single-category changes (excluding test/build)
  const categoriesWithChanges = primaryCategories.filter((cat) => patterns[cat] > 0).length;
  const isSingleCategory = categoriesWithChanges === 1 && maxCount === totalCode;

  return {
    patterns,
    percentages,
    primaryPattern,
    totalCode,
    isSingleCategory,
  };
}

/**
 * Determine if a step should run based on code patterns
 * @pure
 * @param {string} stepId - Step identifier
 * @param {Object} analysis - Pattern analysis from analyzeCodePatterns
 * @returns {boolean} True if step should run
 */
export function shouldRunStep(stepId, analysis) {
  // Always run certain steps
  if (ALWAYS_RUN_STEPS.includes(stepId)) return true;

  // If not a single category, run all steps (mixed changes)
  if (!analysis.isSingleCategory) return true;

  // Check conditional skipping
  const { primaryPattern } = analysis;

  if (primaryPattern === 'config' && CONDITIONAL_STEPS.config_only) {
    return !CONDITIONAL_STEPS.config_only.includes(stepId);
  }

  if (primaryPattern === 'frontend' && CONDITIONAL_STEPS.frontend_only) {
    return !CONDITIONAL_STEPS.frontend_only.includes(stepId);
  }

  if (primaryPattern === 'test' && CONDITIONAL_STEPS.test_only) {
    return !CONDITIONAL_STEPS.test_only.includes(stepId);
  }

  if (primaryPattern === 'build' && CONDITIONAL_STEPS.build_only) {
    return !CONDITIONAL_STEPS.build_only.includes(stepId);
  }

  // Default: run the step
  return true;
}

/**
 * Filter steps based on code patterns
 * @pure
 * @param {Array<string>} steps - Array of step IDs
 * @param {Object} analysis - Pattern analysis
 * @returns {Object} Filtered steps with skipped list
 */
export function filterStepsForCode(steps, analysis) {
  const filtered = [];
  const skipped = [];

  for (const stepId of steps) {
    if (shouldRunStep(stepId, analysis)) {
      filtered.push(stepId);
    } else {
      skipped.push(stepId);
    }
  }

  return { filtered, skipped };
}

/**
 * Estimate impact/complexity of code changes
 * @pure
 * @param {Object} analysis - Pattern analysis
 * @param {number} changeCount - Number of changed files
 * @returns {Object} Impact estimation
 */
export function estimateCodeImpact(analysis, changeCount) {
  const { primaryPattern, isSingleCategory } = analysis;

  // Base complexity score (0-1)
  let complexity = 0.5;

  // Single category is simpler
  if (isSingleCategory) complexity -= 0.2;

  // Adjust by file count
  if (changeCount > 20) complexity += 0.3;
  else if (changeCount > 10) complexity += 0.2;
  else if (changeCount > 5) complexity += 0.1;

  // Adjust by primary pattern
  const highRiskPatterns = ['api', 'database', 'backend'];
  const lowRiskPatterns = ['config', 'build', 'frontend'];

  if (highRiskPatterns.includes(primaryPattern)) complexity += 0.2;
  if (lowRiskPatterns.includes(primaryPattern)) complexity -= 0.1;

  // Clamp to [0, 1]
  complexity = Math.max(0, Math.min(1, complexity));

  // Determine risk level
  let risk = 'low';
  if (complexity > 0.7) risk = 'high';
  else if (complexity > 0.4) risk = 'medium';

  return {
    complexity,
    risk,
    confidence: isSingleCategory ? 0.8 : 0.5,
  };
}

/**
 * Calculate time savings from skipped steps
 * @pure
 * @param {Array<string>} skippedSteps - Steps to skip
 * @param {Object} [durations=AVERAGE_STEP_DURATIONS] - Step durations
 * @returns {number} Time saved in seconds
 */
export function estimateTimeSavings(skippedSteps, durations = AVERAGE_STEP_DURATIONS) {
  let totalSaved = 0;

  for (const stepId of skippedSteps) {
    totalSaved += durations[stepId] || 0;
  }

  return totalSaved;
}

/**
 * Calculate speedup percentage
 * @pure
 * @param {number} timeSaved - Time saved in seconds
 * @param {Array<string>} allSteps - All workflow steps
 * @param {Object} [durations=AVERAGE_STEP_DURATIONS] - Step durations
 * @returns {number} Speedup percentage (0-100)
 */
export function calculateSpeedup(timeSaved, allSteps, durations = AVERAGE_STEP_DURATIONS) {
  let totalTime = 0;

  for (const stepId of allSteps) {
    totalTime += durations[stepId] || 0;
  }

  if (totalTime === 0) return 0;

  return Math.round((timeSaved / totalTime) * 100);
}

/**
 * Format duration in human-readable format
 * @pure
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration
 */
export function formatDuration(seconds) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h`;
}

/**
 * Build optimization report
 * @pure
 * @param {Object} analysis - Pattern analysis
 * @param {Object} impact - Impact estimation
 * @param {Object} filtering - Step filtering result
 * @param {number} timeSaved - Time saved in seconds
 * @param {number} speedup - Speedup percentage
 * @returns {Object} Formatted report
 */
export function buildOptimizationReport(analysis, impact, filtering, timeSaved, speedup) {
  return {
    recommendation: impact.risk === 'low' && filtering.skipped.length > 0 ? 'optimize' : 'standard',
    confidence: impact.confidence,
    patterns: {
      primary: analysis.primaryPattern,
      singleCategory: analysis.isSingleCategory,
      distribution: analysis.percentages,
    },
    impact: {
      complexity: impact.complexity,
      risk: impact.risk,
      filesChanged: analysis.totalCode,
    },
    optimization: {
      stepsToRun: filtering.filtered.length,
      stepsToSkip: filtering.skipped.length,
      skippedSteps: filtering.skipped,
      timeSaved: formatDuration(timeSaved),
      speedup: `${speedup}%`,
    },
  };
}

// ============================================================================
// IMPURE WRAPPER CLASS (Side Effects)
// ============================================================================

/**
 * Code changes optimizer
 * Handles code change analysis and workflow optimization
 */
export class CodeChangesOptimizer {
  /**
   * @param {Object} [options={}] - Configuration options
   * @param {Object} [options.durations=AVERAGE_STEP_DURATIONS] - Step durations
   * @param {FileOperations} [options.fileOps] - File operations instance
   */
  constructor(options = {}) {
    this.durations = options.durations || AVERAGE_STEP_DURATIONS;
    this.fileOps = options.fileOps || new FileOperations();
    this.lastAnalysis = null;
  }

  /**
   * Analyze code changes
   * @param {Array<Object>} changes - Array of change objects
   * @param {Array<string>} [allSteps] - All workflow steps
   * @returns {Object} Analysis result
   */
  analyze(changes, allSteps = Object.keys(AVERAGE_STEP_DURATIONS)) {
    // Pattern analysis
    const analysis = analyzeCodePatterns(changes);

    // Impact estimation
    const impact = estimateCodeImpact(analysis, changes.length);

    // Step filtering
    const filtering = filterStepsForCode(allSteps, analysis);

    // Time calculations
    const timeSaved = estimateTimeSavings(filtering.skipped, this.durations);
    const speedup = calculateSpeedup(timeSaved, allSteps, this.durations);

    // Build report
    const report = buildOptimizationReport(analysis, impact, filtering, timeSaved, speedup);

    // Cache analysis
    this.lastAnalysis = {
      analysis,
      impact,
      filtering,
      timeSaved,
      speedup,
      report,
    };

    logger.info(
      `Code optimization: ${analysis.primaryPattern} (${filtering.skipped.length} steps skipped)`
    );

    return this.lastAnalysis;
  }

  /**
   * Get formatted report
   * @returns {Object|null} Report or null if no analysis
   */
  getReport() {
    return this.lastAnalysis?.report || null;
  }

  /**
   * Check if optimization is recommended
   * @param {number} [minSkipped=2] - Minimum steps to skip for optimization
   * @returns {boolean} True if should optimize
   */
  shouldOptimize(minSkipped = 2) {
    if (!this.lastAnalysis) return false;

    const { report } = this.lastAnalysis;
    return report.recommendation === 'optimize' && report.optimization.stepsToSkip >= minSkipped;
  }

  /**
   * Get optimized workflow
   * @param {Array<string>} originalSteps - Original workflow steps
   * @returns {Array<string>} Optimized steps or original if no optimization
   */
  getOptimizedWorkflow(originalSteps) {
    if (!this.shouldOptimize()) return originalSteps;

    const { filtering } = this.lastAnalysis;
    return filtering.filtered;
  }
}
