/**
 * @fileoverview Conditional Executor - Smart step execution with change detection
 * @module orchestrator/conditional_executor
 * @version 2.0.0
 *
 * Provides conditional step execution based on change detection, impact analysis,
 * and project context. Follows referential transparency pattern with pure functions
 * for business logic and ConditionalExecutor class for I/O operations.
 *
 * Architecture:
 * - Pure functions: Skip logic, impact calculation, condition evaluation
 * - Impure wrapper: ConditionalExecutor class for change detection and execution
 */

import { logger } from '../core/logger.js';

/**
 * Determines if a step should be skipped based on changes and impact
 *
 * @param {Object} step - Step definition
 * @param {Object} changes - Change information
 * @param {string} impact - Change impact level (none, low, medium, high)
 * @returns {Object} Skip decision with shouldSkip flag and reason
 * @pure
 *
 * @example
 * const result = shouldSkipStep(step, { files: ['README.md'] }, 'low');
 * // => { shouldSkip: true, reason: 'Low impact changes' }
 */
export function shouldSkipStep(step, changes = {}, impact = 'medium') {
  const result = {
    shouldSkip: false,
    reason: null,
  };

  // Check if step has skip flag
  if (step.skip === true) {
    result.shouldSkip = true;
    result.reason = 'Step marked to skip';
    return result;
  }

  // Check if step is disabled
  if (step.enabled === false) {
    result.shouldSkip = true;
    result.reason = 'Step is disabled';
    return result;
  }

  // Check if no changes
  if (!changes.files || changes.files.length === 0) {
    // Don't skip critical steps even with no changes
    if (!step.critical) {
      result.shouldSkip = true;
      result.reason = 'No changes detected';
      return result;
    }
  }

  // Smart execution: skip based on impact level
  if (step.smartExecution !== false && impact === 'low') {
    // Skip non-critical steps for low impact changes
    if (!step.critical && step.phase !== 'analysis') {
      result.shouldSkip = true;
      result.reason = `Low impact changes (${impact})`;
      return result;
    }
  }

  // Check skip conditions
  if (step.skipConditions && Array.isArray(step.skipConditions)) {
    for (const condition of step.skipConditions) {
      if (evaluateCondition(condition, { changes, impact, step })) {
        result.shouldSkip = true;
        result.reason = condition.reason || 'Skip condition met';
        return result;
      }
    }
  }

  return result;
}

/**
 * Adapts step configuration based on project kind
 *
 * @param {Object} step - Step definition
 * @param {string} projectKind - Project kind (nodejs_api, react_spa, etc.)
 * @returns {Object} Adapted step definition
 * @pure
 */
export function adaptStepToProjectKind(step, projectKind) {
  if (!projectKind || !step.projectAdaptations) {
    return step;
  }

  const adaptations = step.projectAdaptations[projectKind];
  if (!adaptations) {
    return step;
  }

  // Merge adaptations with step
  return {
    ...step,
    ...adaptations,
    metadata: {
      ...step.metadata,
      adaptedFor: projectKind,
    },
  };
}

/**
 * Calculates change impact level based on file changes
 *
 * @param {Object} changes - Change information with files array
 * @returns {string} Impact level (none, low, medium, high)
 * @pure
 */
export function calculateChangeImpact(changes = {}) {
  const files = changes.files || [];

  if (files.length === 0) {
    return 'none';
  }

  // Categorize file types
  const categories = {
    docs: 0,
    tests: 0,
    code: 0,
    config: 0,
  };

  for (const file of files) {
    if (/\.(md|txt|rst|adoc)$/i.test(file)) {
      categories.docs++;
    } else if (/\.(test|spec)\.(js|ts|jsx|tsx|py|rb|go|java)$/i.test(file)) {
      categories.tests++;
    } else if (/\.(js|ts|jsx|tsx|py|rb|go|java|c|cpp|rs|php)$/i.test(file)) {
      categories.code++;
    } else if (/\.(json|yaml|yml|toml|ini|cfg|conf)$/i.test(file)) {
      categories.config++;
    }
  }

  // Calculate impact
  if (categories.code > 10 || categories.config > 5) {
    return 'high';
  } else if (categories.code > 0 || categories.tests > 5 || categories.config > 0) {
    return 'medium';
  } else if (categories.tests > 0 || categories.docs > 0) {
    return 'low';
  }

  return 'none';
}

/**
 * Evaluates a condition against context
 *
 * @param {*} condition - Condition to evaluate (function, object, boolean)
 * @param {Object} context - Evaluation context
 * @returns {boolean} True if condition is met
 * @pure
 */
export function evaluateCondition(condition, context = {}) {
  // Boolean condition
  if (typeof condition === 'boolean') {
    return condition;
  }

  // Function condition
  if (typeof condition === 'function') {
    try {
      return condition(context) === true;
    } catch {
      return false;
    }
  }

  // Object condition with type
  if (condition && typeof condition === 'object') {
    const { type, value } = condition;

    switch (type) {
      case 'impact':
        return context.impact === value;

      case 'filePattern':
        return context.changes?.files?.some((f) => new RegExp(value).test(f)) || false;

      case 'phase':
        return context.step?.phase === value;

      case 'projectKind':
        return context.projectKind === value;

      default:
        return false;
    }
  }

  return false;
}

/**
 * Builds skip reason message
 *
 * @param {Object} step - Step definition
 * @param {Object} context - Skip context with reason and impact
 * @returns {string} Formatted skip reason
 * @pure
 */
export function buildSkipReason(step, context = {}) {
  const { reason, impact, changes } = context;

  if (reason) {
    return reason;
  }

  const parts = [`Step '${step.id}' skipped`];

  if (impact) {
    parts.push(`impact: ${impact}`);
  }

  if (changes?.files?.length) {
    parts.push(`${changes.files.length} files changed`);
  }

  return parts.join(' - ');
}

/**
 * Checks if file matches pattern
 *
 * @param {string} file - File path
 * @param {string|RegExp} pattern - Pattern to match
 * @returns {boolean} True if file matches
 * @pure
 */
export function matchesPattern(file, pattern) {
  if (pattern instanceof RegExp) {
    return pattern.test(file);
  }

  if (typeof pattern === 'string') {
    // Simple glob-like pattern matching
    const regex = new RegExp(
      pattern.replace(/\./g, '\\.').replace(/\*/g, '.*').replace(/\?/g, '.')
    );
    return regex.test(file);
  }

  return false;
}

/**
 * Filters changed files by pattern
 *
 * @param {Array<string>} files - File paths
 * @param {string|RegExp|Array} patterns - Pattern(s) to match
 * @returns {Array<string>} Filtered files
 * @pure
 */
export function filterFilesByPattern(files, patterns) {
  if (!Array.isArray(files)) {
    return [];
  }

  const patternArray = Array.isArray(patterns) ? patterns : [patterns];

  return files.filter((file) => patternArray.some((pattern) => matchesPattern(file, pattern)));
}

/**
 * Determines if changes affect specific step
 *
 * @param {Object} step - Step definition
 * @param {Object} changes - Change information
 * @returns {boolean} True if changes affect step
 * @pure
 */
export function doesChangeAffectStep(step, changes = {}) {
  if (!changes.files || changes.files.length === 0) {
    return false;
  }

  // If step has affectedBy patterns, check them
  if (step.affectedBy && step.affectedBy.length > 0) {
    const matchedFiles = filterFilesByPattern(changes.files, step.affectedBy);
    return matchedFiles.length > 0;
  }

  // If step has excludePatterns, check if all changes are excluded
  if (step.excludePatterns && step.excludePatterns.length > 0) {
    const nonExcludedFiles = changes.files.filter((file) => {
      return !step.excludePatterns.some((pattern) => matchesPattern(file, pattern));
    });
    return nonExcludedFiles.length > 0;
  }

  // Default: all changes affect the step
  return true;
}

/**
 * Calculates step priority based on changes and impact
 *
 * @param {Object} step - Step definition
 * @param {Object} changes - Change information
 * @param {string} impact - Change impact level
 * @returns {number} Priority score (0-100)
 * @pure
 */
export function calculateStepPriority(step, changes = {}, impact = 'medium') {
  let priority = step.priority || 50;

  // Critical steps get highest priority
  if (step.critical) {
    priority += 30;
  }

  // Increase priority based on impact
  switch (impact) {
    case 'high':
      priority += 20;
      break;
    case 'medium':
      priority += 10;
      break;
    case 'low':
      priority += 5;
      break;
    default:
      break;
  }

  // Increase priority if changes directly affect step
  if (doesChangeAffectStep(step, changes)) {
    priority += 15;
  }

  // Cap at 100
  return Math.min(priority, 100);
}

/**
 * Conditional Executor - Manages conditional step execution
 *
 * Impure wrapper class that provides:
 * - Change detection
 * - Impact analysis
 * - Smart execution decisions
 * - Project-aware adaptation
 *
 * Side effects:
 * - Console logging via logger
 * - Maintains execution state
 *
 * @class
 */
export class ConditionalExecutor {
  constructor(options = {}) {
    this.options = {
      smartExecution: options.smartExecution !== false,
      projectKind: options.projectKind || null,
      ...options,
    };
    this.skipHistory = [];
  }

  /**
   * Evaluates if a step should be executed
   *
   * @param {Object} step - Step definition
   * @param {Object} context - Evaluation context
   * @returns {Object} Evaluation result with execute flag and reason
   */
  evaluateStep(step, context = {}) {
    const changes = context.changes || {};
    const impact = context.impact || calculateChangeImpact(changes);

    logger.debug(`Evaluating step: ${step.id} (impact: ${impact})`);

    // Adapt step to project kind if configured
    const adaptedStep = this.options.projectKind
      ? adaptStepToProjectKind(step, this.options.projectKind)
      : step;

    // Check if should skip
    const skipDecision = shouldSkipStep(adaptedStep, changes, impact);

    if (skipDecision.shouldSkip) {
      this.skipHistory.push({
        stepId: step.id,
        reason: skipDecision.reason,
        timestamp: Date.now(),
      });

      logger.info(`⚡ Step '${step.id}' skipped: ${skipDecision.reason}`);

      return {
        execute: false,
        reason: skipDecision.reason,
        step: adaptedStep,
        impact,
      };
    }

    logger.debug(`✓ Step '${step.id}' will execute`);

    return {
      execute: true,
      reason: null,
      step: adaptedStep,
      impact,
    };
  }

  /**
   * Evaluates multiple steps and returns execution plan
   *
   * @param {Array<Object>} steps - Array of step definitions
   * @param {Object} context - Evaluation context
   * @returns {Object} Execution plan with steps to execute and skip
   */
  evaluateSteps(steps, context = {}) {
    const plan = {
      execute: [],
      skip: [],
    };

    for (const step of steps) {
      const evaluation = this.evaluateStep(step, context);

      if (evaluation.execute) {
        plan.execute.push({
          step: evaluation.step,
          priority: calculateStepPriority(step, context.changes, evaluation.impact),
        });
      } else {
        plan.skip.push({
          step: evaluation.step,
          reason: evaluation.reason,
        });
      }
    }

    // Sort execute list by priority (highest first)
    plan.execute.sort((a, b) => b.priority - a.priority);

    logger.info(`Execution plan: ${plan.execute.length} to execute, ${plan.skip.length} to skip`);

    return plan;
  }

  /**
   * Gets change impact for files
   *
   * @param {Array<string>} files - Changed files
   * @returns {string} Impact level
   */
  getImpact(files) {
    const impact = calculateChangeImpact({ files });
    logger.debug(`Calculated impact: ${impact} (${files.length} files)`);
    return impact;
  }

  /**
   * Checks if step should be skipped
   *
   * @param {Object} step - Step definition
   * @param {Object} context - Context with changes and impact
   * @returns {boolean} True if should skip
   */
  shouldSkip(step, context = {}) {
    const evaluation = this.evaluateStep(step, context);
    return !evaluation.execute;
  }

  /**
   * Gets skip history
   *
   * @returns {Array<Object>} Skip history
   */
  getSkipHistory() {
    return [...this.skipHistory];
  }

  /**
   * Gets skip statistics
   *
   * @returns {Object} Skip statistics
   */
  getStats() {
    const total = this.skipHistory.length;
    const byReason = {};

    for (const entry of this.skipHistory) {
      const reason = entry.reason || 'Unknown';
      byReason[reason] = (byReason[reason] || 0) + 1;
    }

    return {
      total,
      byReason,
    };
  }

  /**
   * Clears skip history
   */
  clearHistory() {
    this.skipHistory = [];
    logger.debug('Cleared skip history');
  }
}
