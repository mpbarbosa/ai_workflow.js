/**
 * @fileoverview Multi-Stage Pipeline Execution (v2.0.0)
 *
 * Progressive workflow execution with multiple stages for faster feedback:
 * - Stage 1 (Quick): Fast validation and docs (< 5 minutes)
 * - Stage 2 (Medium): Core workflow with essential checks (< 30 minutes)
 * - Stage 3 (Full): Complete deep analysis and comprehensive validation
 *
 * Enables early feedback and fail-fast behavior at stage boundaries.
 *
 * Architecture: Referential Transparency (Phase 8.9)
 * - Pure functions: Stage grouping, time estimation, stage selection
 * - Impure wrapper: Workflow execution orchestration, progress tracking
 *
 * @module lib/multi_stage_pipeline
 * @version 2.0.0
 * @since 2026-02-07
 */

import { logger } from '../core/logger.js';

/**
 * Pipeline stages in execution order
 * @constant {Array<string>}
 */
export const PIPELINE_STAGES = ['quick', 'medium', 'full'];

/**
 * Stage definitions with step mappings
 * @constant {Object}
 */
export const STAGE_DEFINITIONS = {
  quick: {
    name: 'Quick Validation',
    description: 'Fast validation and documentation checks',
    maxDuration: 300, // 5 minutes
    steps: ['step1', 'step15', 'git_commit'],
    priority: 1,
  },
  medium: {
    name: 'Core Workflow',
    description: 'Essential checks and core validation',
    maxDuration: 1800, // 30 minutes
    steps: ['step2', 'step3', 'step4', 'step5', 'step6', 'step9'],
    priority: 2,
  },
  full: {
    name: 'Full Analysis',
    description: 'Complete deep analysis and comprehensive validation',
    maxDuration: 4800, // 80 minutes
    steps: ['step7', 'step8', 'step10', 'step11', 'step12', 'step13', 'step14'],
    priority: 3,
  },
};

/**
 * Time budget thresholds for stage selection
 * @constant {Object}
 */
export const TIME_BUDGETS = {
  quick: 300, // 5 minutes
  medium: 1800, // 30 minutes
  full: 4800, // 80 minutes
};

// ============================================================================
// PURE FUNCTIONS (Referentially Transparent)
// ============================================================================

/**
 * Group steps by stage
 * @pure
 * @param {Array<string>} steps - All workflow steps
 * @returns {Object} Steps grouped by stage
 */
export function groupStepsByStage(steps) {
  const grouped = {
    quick: [],
    medium: [],
    full: [],
    unknown: [],
  };

  for (const step of steps) {
    let assigned = false;

    for (const [stage, definition] of Object.entries(STAGE_DEFINITIONS)) {
      if (definition.steps.includes(step)) {
        grouped[stage].push(step);
        assigned = true;
        break;
      }
    }

    if (!assigned) {
      grouped.unknown.push(step);
    }
  }

  return grouped;
}

/**
 * Determine which stages to execute based on time budget
 * @pure
 * @param {number} timeBudget - Available time in seconds
 * @returns {Array<string>} Stages to execute
 */
export function selectStagesByTime(timeBudget) {
  const stages = [];

  if (timeBudget >= TIME_BUDGETS.quick) {
    stages.push('quick');
  }

  if (timeBudget >= TIME_BUDGETS.medium) {
    stages.push('medium');
  }

  if (timeBudget >= TIME_BUDGETS.full) {
    stages.push('full');
  }

  return stages.length > 0 ? stages : ['quick']; // Always run at least quick
}

/**
 * Determine stages based on change analysis
 * @pure
 * @param {Object} changeAnalysis - Analysis from FullChangesOptimizer
 * @returns {Array<string>} Recommended stages
 */
export function selectStagesByChanges(changeAnalysis) {
  if (!changeAnalysis || !changeAnalysis.strategy) {
    return PIPELINE_STAGES; // Run all stages if no analysis
  }

  const { strategy, confidence } = changeAnalysis;

  // Docs-only changes: quick stage only
  if (strategy === 'docs_only' && confidence >= 0.8) {
    return ['quick'];
  }

  // Code changes with high confidence: quick + medium
  if (strategy === 'code_changes' && confidence >= 0.7) {
    return ['quick', 'medium'];
  }

  // Low confidence or complex changes: all stages
  return PIPELINE_STAGES;
}

/**
 * Calculate estimated duration for stages
 * @pure
 * @param {Array<string>} stages - Stages to execute
 * @returns {number} Total estimated duration in seconds
 */
export function estimateStageDuration(stages) {
  let total = 0;

  for (const stage of stages) {
    const definition = STAGE_DEFINITIONS[stage];
    if (definition) {
      total += definition.maxDuration;
    }
  }

  return total;
}

/**
 * Build stage execution plan
 * @pure
 * @param {Array<string>} stages - Stages to execute
 * @param {Object} grouped - Steps grouped by stage
 * @returns {Array<Object>} Execution plan
 */
export function buildStagePlan(stages, grouped) {
  const plan = [];

  for (const stage of stages) {
    const definition = STAGE_DEFINITIONS[stage];
    const steps = grouped[stage] || [];

    if (steps.length > 0 || stage === 'quick') {
      plan.push({
        stage,
        name: definition?.name || stage,
        description: definition?.description || '',
        steps,
        maxDuration: definition?.maxDuration || 0,
        priority: definition?.priority || 0,
      });
    }
  }

  return plan;
}

/**
 * Check if stage should be skipped based on previous results
 * @pure
 * @param {string} stage - Current stage
 * @param {Array<Object>} previousResults - Results from previous stages
 * @returns {boolean} True if should skip
 */
export function shouldSkipStage(stage, previousResults) {
  // Never skip quick stage
  if (stage === 'quick') return false;

  // Skip if any previous stage failed
  for (const result of previousResults) {
    if (result.status === 'failed') {
      return true;
    }
  }

  return false;
}

/**
 * Calculate overall pipeline progress
 * @pure
 * @param {Array<Object>} stageResults - Results from executed stages
 * @param {Array<string>} allStages - All planned stages
 * @returns {Object} Progress information
 */
export function calculatePipelineProgress(stageResults, allStages) {
  const completedStages = stageResults.filter((r) => r.status === 'completed').length;
  const failedStages = stageResults.filter((r) => r.status === 'failed').length;
  const totalStages = allStages.length;

  return {
    completedStages,
    failedStages,
    totalStages,
    percentComplete: totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0,
    isComplete: completedStages + failedStages === totalStages,
    hasFailures: failedStages > 0,
  };
}

/**
 * Format stage duration
 * @pure
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration
 */
export function formatStageDuration(seconds) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

// ============================================================================
// IMPURE WRAPPER CLASS (Side Effects)
// ============================================================================

/**
 * Multi-stage pipeline executor
 * Orchestrates progressive workflow execution
 */
export class MultiStagePipeline {
  /**
   * @param {Object} [options={}] - Configuration options
   * @param {Function} [options.stageExecutor] - Function to execute a stage
   * @param {boolean} [options.failFast=true] - Stop on first failure
   */
  constructor(options = {}) {
    this.stageExecutor = options.stageExecutor || null;
    this.failFast = options.failFast !== undefined ? options.failFast : true;
    this.currentPlan = null;
    this.stageResults = [];
  }

  /**
   * Plan pipeline execution
   * @param {Array<string>} steps - All workflow steps
   * @param {Object} [options={}] - Planning options
   * @returns {Object} Execution plan
   */
  plan(steps, options = {}) {
    const { timeBudget, changeAnalysis } = options;

    // Group steps by stage
    const grouped = groupStepsByStage(steps);

    // Determine stages to execute
    let stages;
    if (changeAnalysis) {
      stages = selectStagesByChanges(changeAnalysis);
      logger.info(`Pipeline stages selected by changes: ${stages.join(', ')}`);
    } else if (timeBudget) {
      stages = selectStagesByTime(timeBudget);
      logger.info(`Pipeline stages selected by time budget (${timeBudget}s): ${stages.join(', ')}`);
    } else {
      stages = PIPELINE_STAGES;
      logger.info('Pipeline: Running all stages');
    }

    // Build execution plan
    const plan = buildStagePlan(stages, grouped);
    const estimatedDuration = estimateStageDuration(stages);

    this.currentPlan = {
      stages,
      grouped,
      plan,
      estimatedDuration,
      startTime: null,
    };

    logger.info(
      `Pipeline planned: ${plan.length} stages, estimated ${formatStageDuration(estimatedDuration)}`
    );

    return this.currentPlan;
  }

  /**
   * Execute pipeline
   * @param {Function} stageExecutor - Function to execute a stage (stage, steps) => Promise<result>
   * @returns {Promise<Object>} Execution results
   */
  async execute(stageExecutor) {
    if (!this.currentPlan) {
      throw new Error('No execution plan. Call plan() first.');
    }

    this.stageExecutor = stageExecutor || this.stageExecutor;
    if (!this.stageExecutor) {
      throw new Error('No stage executor provided');
    }

    this.currentPlan.startTime = Date.now();
    this.stageResults = [];

    logger.info('Pipeline execution started');

    for (const stageInfo of this.currentPlan.plan) {
      const { stage, steps } = stageInfo;

      // Check if should skip
      if (shouldSkipStage(stage, this.stageResults)) {
        logger.warn(`Pipeline: Skipping stage '${stage}' due to previous failures`);
        this.stageResults.push({
          stage,
          status: 'skipped',
          reason: 'previous_failure',
        });
        continue;
      }

      // Execute stage
      logger.info(`Pipeline: Executing stage '${stage}' (${steps.length} steps)`);
      const stageStart = Date.now();

      try {
        const result = await this.stageExecutor(stage, steps);
        const duration = Math.round((Date.now() - stageStart) / 1000);

        this.stageResults.push({
          stage,
          status: result.success ? 'completed' : 'failed',
          duration,
          result,
        });

        logger.info(
          `Pipeline: Stage '${stage}' ${result.success ? 'completed' : 'failed'} (${duration}s)`
        );

        // Fail fast if enabled
        if (!result.success && this.failFast) {
          logger.warn('Pipeline: Stopping execution due to stage failure (fail-fast enabled)');
          break;
        }
      } catch (error) {
        const duration = Math.round((Date.now() - stageStart) / 1000);

        this.stageResults.push({
          stage,
          status: 'failed',
          duration,
          error: error.message,
        });

        logger.error(`Pipeline: Stage '${stage}' failed with error: ${error.message}`);

        if (this.failFast) {
          break;
        }
      }
    }

    const totalDuration = Math.round((Date.now() - this.currentPlan.startTime) / 1000);
    const progress = calculatePipelineProgress(this.stageResults, this.currentPlan.stages);

    const results = {
      stages: this.currentPlan.stages,
      results: this.stageResults,
      progress,
      duration: totalDuration,
      success: progress.hasFailures === false && progress.isComplete,
    };

    logger.info(
      `Pipeline execution ${results.success ? 'completed' : 'failed'}: ${progress.completedStages}/${progress.totalStages} stages (${totalDuration}s)`
    );

    return results;
  }

  /**
   * Get current pipeline status
   * @returns {Object|null} Status or null
   */
  getStatus() {
    if (!this.currentPlan) return null;

    const progress = calculatePipelineProgress(this.stageResults, this.currentPlan.stages);
    const elapsed = this.currentPlan.startTime
      ? Math.round((Date.now() - this.currentPlan.startTime) / 1000)
      : 0;

    return {
      plan: this.currentPlan,
      results: this.stageResults,
      progress,
      elapsed,
    };
  }

  /**
   * Reset pipeline state
   * @returns {void}
   */
  reset() {
    this.currentPlan = null;
    this.stageResults = [];
    logger.info('Pipeline: State reset');
  }
}
