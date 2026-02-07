/**
 * @fileoverview Full Changes Optimization (v2.0.0)
 *
 * Unified optimization coordinator that combines all optimization strategies:
 * - Docs-only optimization (fast path for documentation changes)
 * - Code changes optimization (pattern-based step filtering)
 * - ML optimization (predictive step skipping)
 * - Incremental analysis (change detection)
 *
 * Intelligently selects the best optimization strategy based on change analysis.
 *
 * Architecture: Referential Transparency (Phase 8.8)
 * - Pure functions: Strategy selection, confidence calculation, report merging
 * - Impure wrapper: Orchestrates sub-optimizers, historical tracking
 *
 * @module lib/full_changes_optimization
 * @version 2.0.0
 * @since 2026-02-07
 */

import { DocsOnlyOptimizer } from './docs_only_optimization.js';
import { CodeChangesOptimizer } from './code_changes_optimization.js';
import { MLOptimizer } from './ml_optimization.js';
import { IncrementalAnalyzer } from './incremental_analysis.js';
import { logger } from '../core/logger.js';

/**
 * Optimization strategies in priority order
 * @constant {Array<string>}
 */
export const OPTIMIZATION_STRATEGIES = ['docs_only', 'code_changes', 'ml_prediction', 'standard'];

/**
 * Minimum confidence thresholds for each strategy
 * @constant {Object}
 */
export const CONFIDENCE_THRESHOLDS = {
  docs_only: 0.8,
  code_changes: 0.7,
  ml_prediction: 0.6,
  standard: 0.0,
};

/**
 * Strategy priorities (higher = preferred)
 * @constant {Object}
 */
export const STRATEGY_PRIORITIES = {
  docs_only: 4,
  code_changes: 3,
  ml_prediction: 2,
  standard: 1,
};

// ============================================================================
// PURE FUNCTIONS (Referentially Transparent)
// ============================================================================

/**
 * Analyze change type and determine optimization candidates
 * @pure
 * @param {Object} changes - Change analysis from IncrementalAnalyzer
 * @param {Object} docsAnalysis - Analysis from DocsOnlyOptimizer
 * @param {Object} codeAnalysis - Analysis from CodeChangesOptimizer
 * @returns {Object} Candidate strategies with eligibility
 */
export function analyzeOptimizationCandidates(changes, docsAnalysis, codeAnalysis) {
  const candidates = {
    docs_only: false,
    code_changes: false,
    ml_prediction: true, // Always eligible
    standard: true, // Always available
  };

  // Check docs-only eligibility
  // DocsOnlyOptimizer returns {isDocsOnly, stepsToSkip, ...}
  if (docsAnalysis) {
    const isDocsOnly = docsAnalysis.isDocsOnly || false;
    const hasSkippedSteps = (docsAnalysis.stepsToSkip?.length || 0) > 0;
    const docsPercentage = docsAnalysis.docsPercentage || 0;

    // Eligible if docs-only with high docs percentage
    candidates.docs_only = isDocsOnly && hasSkippedSteps && docsPercentage >= 80;
  }

  // Check code changes eligibility
  // CodeChangesOptimizer returns {report: {recommendation, confidence}}
  if (codeAnalysis && codeAnalysis.report) {
    const { recommendation, confidence } = codeAnalysis.report;
    candidates.code_changes =
      recommendation === 'optimize' && confidence >= CONFIDENCE_THRESHOLDS.code_changes;
  }

  return candidates;
}

/**
 * Select best optimization strategy
 * @pure
 * @param {Object} candidates - Eligible candidates from analyzeOptimizationCandidates
 * @param {Object} preferences - User preferences (optional)
 * @returns {string} Selected strategy
 */
export function selectOptimizationStrategy(candidates, preferences = {}) {
  // Apply user preferences if provided
  if (preferences.forceStrategy && candidates[preferences.forceStrategy]) {
    return preferences.forceStrategy;
  }

  // Select highest priority eligible strategy
  let selectedStrategy = 'standard';
  let highestPriority = 0;

  for (const [strategy, eligible] of Object.entries(candidates)) {
    if (eligible) {
      const priority = STRATEGY_PRIORITIES[strategy] || 0;
      if (priority > highestPriority) {
        highestPriority = priority;
        selectedStrategy = strategy;
      }
    }
  }

  return selectedStrategy;
}

/**
 * Calculate overall confidence for selected strategy
 * @pure
 * @param {string} strategy - Selected strategy
 * @param {Object} docsAnalysis - Docs analysis
 * @param {Object} codeAnalysis - Code analysis
 * @param {Object} mlAnalysis - ML analysis
 * @returns {number} Confidence score (0-1)
 */
export function calculateOverallConfidence(strategy, docsAnalysis, codeAnalysis, mlAnalysis) {
  if (strategy === 'docs_only') {
    if (!docsAnalysis) return 0;
    // DocsOnlyOptimizer: high confidence if 100% docs
    const docsPercentage = docsAnalysis.docsPercentage || 0;
    return docsPercentage >= 100 ? 0.95 : docsPercentage / 100;
  }

  if (strategy === 'code_changes') {
    if (!codeAnalysis?.report) return 0;
    return codeAnalysis.report.confidence || 0;
  }

  if (strategy === 'ml_prediction' && mlAnalysis) {
    // ML confidence is in prediction result
    return mlAnalysis.confidence || 0.5;
  }

  // Standard workflow has minimal confidence
  return 0.3;
}

/**
 * Merge optimization reports from multiple strategies
 * @pure
 * @param {Object} docsReport - Docs optimization analysis
 * @param {Object} codeReport - Code optimization report
 * @param {Object} mlReport - ML optimization report
 * @returns {Object} Merged report
 */
export function mergeOptimizationReports(docsReport, codeReport, mlReport) {
  return {
    docs: docsReport
      ? {
          isDocsOnly: docsReport.isDocsOnly,
          docsPercentage: docsReport.docsPercentage,
          speedup: docsReport.speedup,
        }
      : null,
    code: codeReport
      ? {
          recommendation: codeReport.recommendation,
          confidence: codeReport.confidence,
          primaryPattern: codeReport.patterns?.primary,
          speedup: codeReport.optimization?.speedup,
        }
      : null,
    ml: mlReport
      ? {
          prediction: mlReport.prediction,
          confidence: mlReport.confidence,
          reason: mlReport.reason,
        }
      : null,
  };
}

/**
 * Calculate expected time savings
 * @pure
 * @param {string} strategy - Selected strategy
 * @param {Object} docsAnalysis - Docs analysis
 * @param {Object} codeAnalysis - Code analysis
 * @returns {Object} Time savings estimate
 */
export function calculateTimeSavings(strategy, docsAnalysis, codeAnalysis) {
  let timeSavedSeconds = 0;
  let speedupPercent = 0;

  if (strategy === 'docs_only' && docsAnalysis) {
    // DocsOnlyOptimizer returns numeric speedup
    speedupPercent = docsAnalysis.speedup || 0;
    // Estimate from speedup percentage (assuming ~800s total workflow)
    timeSavedSeconds = Math.round((speedupPercent / 100) * 800);
  } else if (strategy === 'code_changes' && codeAnalysis?.report) {
    const speedupStr = codeAnalysis.report.optimization?.speedup || '0%';
    speedupPercent = parseInt(speedupStr.replace('%', '')) || 0;
    timeSavedSeconds = Math.round((speedupPercent / 100) * 800);
  }

  return {
    timeSavedSeconds,
    speedupPercent,
    estimatedTotal: 800, // Average full workflow time
    estimatedRemaining: 800 - timeSavedSeconds,
  };
}

/**
 * Build comprehensive optimization report
 * @pure
 * @param {string} strategy - Selected strategy
 * @param {Object} candidates - Eligible candidates
 * @param {number} confidence - Overall confidence
 * @param {Object} timeSavings - Time savings estimate
 * @param {Object} merged - Merged sub-reports
 * @returns {Object} Comprehensive report
 */
export function buildComprehensiveReport(strategy, candidates, confidence, timeSavings, merged) {
  return {
    selectedStrategy: strategy,
    confidence,
    candidates,
    timeSavings,
    subReports: merged,
    recommendation:
      strategy !== 'standard' && confidence >= CONFIDENCE_THRESHOLDS[strategy]
        ? 'optimize'
        : 'standard',
    fallbackAvailable: strategy === 'standard' ? false : true,
  };
}

/**
 * Determine optimized workflow steps
 * @pure
 * @param {string} strategy - Selected strategy
 * @param {Array<string>} originalSteps - Original workflow steps
 * @param {Object} docsAnalysis - Docs analysis
 * @param {Object} codeAnalysis - Code analysis
 * @returns {Array<string>} Optimized steps
 */
export function determineOptimizedSteps(strategy, originalSteps, docsAnalysis, codeAnalysis) {
  if (strategy === 'docs_only' && docsAnalysis?.stepsToRun) {
    return docsAnalysis.stepsToRun;
  }

  if (strategy === 'code_changes' && codeAnalysis?.filtering) {
    return codeAnalysis.filtering.filtered;
  }

  // ML and standard use original steps
  return originalSteps;
}

// ============================================================================
// IMPURE WRAPPER CLASS (Side Effects)
// ============================================================================

/**
 * Full changes optimizer
 * Coordinates all optimization strategies
 */
export class FullChangesOptimizer {
  /**
   * @param {Object} [options={}] - Configuration options
   * @param {Object} [options.preferences] - User preferences
   * @param {string} [options.workingDir] - Working directory for analysis
   */
  constructor(options = {}) {
    this.preferences = options.preferences || {};
    this.workingDir = options.workingDir || process.cwd();

    // Initialize sub-optimizers
    this.docsOptimizer = new DocsOnlyOptimizer();
    this.codeOptimizer = new CodeChangesOptimizer();
    this.mlOptimizer = new MLOptimizer();
    this.incrementalAnalyzer = new IncrementalAnalyzer({ baseDir: this.workingDir });

    // State
    this.lastAnalysis = null;
    this.history = [];
  }

  /**
   * Analyze changes and select optimization strategy
   * @param {Array<Object>} changes - Array of change objects
   * @param {Array<string>} [allSteps] - All workflow steps
   * @returns {Object} Optimization analysis
   */
  async analyze(changes, allSteps = []) {
    logger.info('Full optimization: Analyzing changes...');

    // Extract file paths from change objects
    const filePaths = changes.map((c) => c.path || c.file || '').filter(Boolean);

    // Run all sub-analyses
    const docsAnalysis = this.docsOptimizer.analyze(filePaths, allSteps);
    const codeAnalysis = this.codeOptimizer.analyze(changes, allSteps);

    // ML analysis requires feature extraction
    let mlAnalysis = null;
    if (this.mlOptimizer && this.history.length > 0) {
      try {
        // Use historical data for ML prediction
        const features = {
          changeCount: changes.length,
          docsPercentage: docsAnalysis.docsPercentage || 0,
          hasTests: changes.some((c) => (c.path || '').includes('test')),
          stepId: 'workflow',
        };
        mlAnalysis = this.mlOptimizer.predict('workflow', features);
      } catch (error) {
        // ML prediction failed, continue without it
        logger.warn(`ML prediction skipped: ${error.message}`);
      }
    }

    // Analyze candidates
    const candidates = analyzeOptimizationCandidates(changes, docsAnalysis, codeAnalysis);

    // Select strategy
    const strategy = selectOptimizationStrategy(candidates, this.preferences);

    // Calculate confidence
    const confidence = calculateOverallConfidence(strategy, docsAnalysis, codeAnalysis, mlAnalysis);

    // Merge reports
    const merged = mergeOptimizationReports(docsAnalysis, codeAnalysis.report, mlAnalysis);

    // Calculate time savings
    const timeSavings = calculateTimeSavings(strategy, docsAnalysis, codeAnalysis);

    // Build comprehensive report
    const report = buildComprehensiveReport(strategy, candidates, confidence, timeSavings, merged);

    // Determine optimized steps
    const optimizedSteps = determineOptimizedSteps(strategy, allSteps, docsAnalysis, codeAnalysis);

    // Cache analysis
    this.lastAnalysis = {
      changes,
      docsAnalysis,
      codeAnalysis,
      mlAnalysis,
      candidates,
      strategy,
      confidence,
      report,
      optimizedSteps,
      timestamp: Date.now(),
    };

    logger.info(
      `Full optimization: Selected strategy '${strategy}' (confidence: ${Math.round(confidence * 100)}%)`
    );

    return this.lastAnalysis;
  }

  /**
   * Get optimization report
   * @returns {Object|null} Report or null
   */
  getReport() {
    return this.lastAnalysis?.report || null;
  }

  /**
   * Check if optimization is recommended
   * @returns {boolean} True if should optimize
   */
  shouldOptimize() {
    if (!this.lastAnalysis) return false;

    const { report } = this.lastAnalysis;
    return report.recommendation === 'optimize' && report.confidence >= 0.6;
  }

  /**
   * Get optimized workflow
   * @param {Array<string>} originalSteps - Original steps
   * @returns {Array<string>} Optimized or original steps
   */
  getOptimizedWorkflow(originalSteps) {
    if (!this.shouldOptimize()) return originalSteps;

    return this.lastAnalysis.optimizedSteps || originalSteps;
  }

  /**
   * Record workflow execution result
   * @param {Object} result - Execution result
   * @returns {void}
   */
  recordResult(result) {
    if (!this.lastAnalysis) return;

    const record = {
      strategy: this.lastAnalysis.strategy,
      confidence: this.lastAnalysis.confidence,
      changeCount: this.lastAnalysis.changes.length,
      success: result.success || false,
      duration: result.duration || 0,
      timestamp: Date.now(),
    };

    this.history.push(record);

    // Update ML optimizer if available
    if (this.mlOptimizer && result.stepOutcomes) {
      for (const [stepId, outcome] of Object.entries(result.stepOutcomes)) {
        this.mlOptimizer.recordOutcome(stepId, outcome);
      }
    }

    logger.info(
      `Full optimization: Recorded result (strategy: ${record.strategy}, success: ${record.success})`
    );
  }

  /**
   * Get optimization statistics
   * @returns {Object} Statistics
   */
  getStatistics() {
    if (this.history.length === 0) {
      return {
        totalRuns: 0,
        successRate: 0,
        averageDuration: 0,
        strategyUsage: {},
      };
    }

    const successCount = this.history.filter((r) => r.success).length;
    const totalDuration = this.history.reduce((sum, r) => sum + r.duration, 0);

    const strategyUsage = {};
    for (const record of this.history) {
      strategyUsage[record.strategy] = (strategyUsage[record.strategy] || 0) + 1;
    }

    return {
      totalRuns: this.history.length,
      successRate: successCount / this.history.length,
      averageDuration: totalDuration / this.history.length,
      strategyUsage,
    };
  }

  /**
   * Reset optimizer state
   * @returns {void}
   */
  reset() {
    this.lastAnalysis = null;
    this.history = [];
    logger.info('Full optimization: State reset');
  }
}
