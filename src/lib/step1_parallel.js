/**
 * @fileoverview Step 1 Parallel Processing (v2.0.0)
 * @module lib/step1_parallel
 *
 * Parallel documentation validation for Step 1 (Documentation Validation).
 * Validates multiple documentation categories concurrently for maximum throughput.
 *
 * Architecture: v2.0.0 Referential Transparency
 * - Pure functions for task distribution, result merging, error handling
 * - Impure wrapper class for async execution, process management
 */

import { logger } from '../core/logger.js';
import { DOC_CATEGORIES, VALIDATION_PRIORITY, groupByCategory } from './step1_incremental.js';

/**
 * Default configuration
 */
export const DEFAULT_CONFIG = {
  maxConcurrency: 4, // Max parallel validation tasks
  categoryOrder: [
    DOC_CATEGORIES.README,
    DOC_CATEGORIES.API,
    DOC_CATEGORIES.GUIDE,
    DOC_CATEGORIES.REFERENCE,
    DOC_CATEGORIES.CHANGELOG,
    DOC_CATEGORIES.CONTRIBUTING,
    DOC_CATEGORIES.LICENSE,
    DOC_CATEGORIES.OTHER,
  ],
  timeout: 300000, // 5 minutes per category
  retryAttempts: 2,
};

/**
 * Parallel execution strategies
 */
export const EXECUTION_STRATEGY = {
  SEQUENTIAL: 'sequential', // One at a time
  PARALLEL: 'parallel', // All at once (up to maxConcurrency)
  PRIORITY_BASED: 'priority_based', // High priority first, then parallel
  BALANCED: 'balanced', // Mix of sequential (critical) and parallel (others)
};

/**
 * Task statuses
 */
export const TASK_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  TIMEOUT: 'timeout',
  CANCELLED: 'cancelled',
};

// =============================================================================
// PURE FUNCTIONS
// =============================================================================

/**
 * Create validation task for a category
 * @pure
 * @param {string} category - Category from DOC_CATEGORIES
 * @param {Array<string>} files - Files in this category
 * @param {number} priority - Validation priority
 * @param {number} timestamp - Current timestamp for ID generation
 * @param {number} sequence - Sequence number for uniqueness
 * @returns {Object} Task object
 */
export function createValidationTask(category, files, priority, timestamp, sequence = 0) {
  return {
    id: `task_${category}_${timestamp}_${sequence}`,
    category,
    files,
    priority,
    status: TASK_STATUS.PENDING,
    result: null,
    error: null,
    startTime: null,
    endTime: null,
    duration: null,
  };
}

/**
 * Group files into validation tasks by category
 * @pure
 * @param {Array<string>} files - Documentation files
 * @param {Function} getPriority - Function to get priority for category
 * @param {number} timestamp - Current timestamp for ID generation
 * @returns {Array<Object>} Validation tasks
 */
export function createValidationTasks(files, getPriority, timestamp) {
  const grouped = groupByCategory(files);
  const tasks = [];

  let sequence = 0;
  for (const [category, categoryFiles] of Object.entries(grouped)) {
    if (categoryFiles.length > 0) {
      const priority = getPriority(category);
      tasks.push(createValidationTask(category, categoryFiles, priority, timestamp, sequence++));
    }
  }

  return tasks;
}

/**
 * Sort tasks by priority (high to low) and category order
 * @pure
 * @param {Array<Object>} tasks - Validation tasks
 * @param {Array<string>} categoryOrder - Preferred category order
 * @returns {Array<Object>} Sorted tasks
 */
export function sortTasksByPriority(tasks, categoryOrder) {
  return [...tasks].sort((a, b) => {
    // First by priority (high to low)
    if (a.priority !== b.priority) {
      return b.priority - a.priority;
    }

    // Then by category order
    const indexA = categoryOrder.indexOf(a.category);
    const indexB = categoryOrder.indexOf(b.category);

    if (indexA !== -1 && indexB !== -1) {
      return indexA - indexB;
    }

    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;

    return 0;
  });
}

/**
 * Determine execution strategy based on task priorities
 * @pure
 * @param {Array<Object>} tasks - Validation tasks
 * @param {number} criticalThreshold - Priority threshold for critical tasks
 * @returns {string} Recommended strategy from EXECUTION_STRATEGY
 */
export function determineExecutionStrategy(
  tasks,
  criticalThreshold = VALIDATION_PRIORITY.CRITICAL
) {
  if (tasks.length === 0) return EXECUTION_STRATEGY.SEQUENTIAL;
  if (tasks.length === 1) return EXECUTION_STRATEGY.SEQUENTIAL;

  const criticalTasks = tasks.filter((t) => t.priority >= criticalThreshold);
  const nonCriticalTasks = tasks.filter((t) => t.priority < criticalThreshold);

  // If all critical, use sequential to avoid errors
  if (criticalTasks.length === tasks.length) {
    return EXECUTION_STRATEGY.SEQUENTIAL;
  }

  // If mix of critical and non-critical, use balanced
  if (criticalTasks.length > 0 && nonCriticalTasks.length > 0) {
    return EXECUTION_STRATEGY.BALANCED;
  }

  // If all non-critical, use parallel
  return EXECUTION_STRATEGY.PARALLEL;
}

/**
 * Split tasks into batches for parallel execution
 * @pure
 * @param {Array<Object>} tasks - Validation tasks
 * @param {number} batchSize - Max tasks per batch
 * @returns {Array<Array<Object>>} Task batches
 */
export function splitIntoBatches(tasks, batchSize) {
  if (batchSize <= 0) return [tasks];
  if (tasks.length === 0) return [];

  const batches = [];
  for (let i = 0; i < tasks.length; i += batchSize) {
    batches.push(tasks.slice(i, i + batchSize));
  }
  return batches;
}

/**
 * Calculate task statistics from completed tasks
 * @pure
 * @param {Array<Object>} tasks - Completed tasks
 * @returns {Object} Statistics
 */
export function calculateTaskStatistics(tasks) {
  const total = tasks.length;
  const completed = tasks.filter((t) => t.status === TASK_STATUS.COMPLETED).length;
  const failed = tasks.filter((t) => t.status === TASK_STATUS.FAILED).length;
  const timeout = tasks.filter((t) => t.status === TASK_STATUS.TIMEOUT).length;

  const totalFiles = tasks.reduce((sum, t) => sum + t.files.length, 0);
  const totalDuration = tasks.reduce((sum, t) => sum + (t.duration || 0), 0);
  const avgDuration = total > 0 ? Math.round(totalDuration / total) : 0;

  return {
    total,
    completed,
    failed,
    timeout,
    successRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    totalFiles,
    avgDuration,
    totalDuration,
  };
}

/**
 * Merge validation results from multiple tasks
 * @pure
 * @param {Array<Object>} tasks - Completed tasks
 * @returns {Object} Merged results
 */
export function mergeValidationResults(tasks) {
  const results = {
    success: true,
    categories: {},
    errors: [],
    totalFiles: 0,
    validatedFiles: 0,
    skippedFiles: 0,
  };

  for (const task of tasks) {
    results.categories[task.category] = {
      status: task.status,
      fileCount: task.files.length,
      duration: task.duration,
      result: task.result,
      error: task.error,
    };

    results.totalFiles += task.files.length;

    if (task.status === TASK_STATUS.COMPLETED) {
      results.validatedFiles += task.files.length;
    } else if (task.status === TASK_STATUS.FAILED || task.status === TASK_STATUS.TIMEOUT) {
      results.success = false;
      results.errors.push({
        category: task.category,
        error: task.error,
      });
      results.skippedFiles += task.files.length;
    }
  }

  return results;
}

/**
 * Calculate speedup from parallel execution
 * @pure
 * @param {number} sequentialTime - Estimated sequential execution time
 * @param {number} parallelTime - Actual parallel execution time
 * @returns {Object} Speedup analysis
 */
export function calculateSpeedup(sequentialTime, parallelTime) {
  const speedup = parallelTime > 0 ? sequentialTime / parallelTime : 1;
  const efficiency = speedup > 0 ? (speedup / Math.ceil(speedup)) * 100 : 0;

  return {
    speedup: Math.round(speedup * 10) / 10,
    efficiency: Math.round(efficiency),
    timeSaved: Math.max(0, sequentialTime - parallelTime),
    parallelTime,
    sequentialTime,
  };
}

/**
 * Validate task before execution
 * @pure
 * @param {Object} task - Validation task
 * @returns {boolean} True if task is valid
 */
export function isValidTask(task) {
  if (!task || typeof task !== 'object') return false;
  if (!task.category || typeof task.category !== 'string') return false;
  if (!Array.isArray(task.files)) return false;
  if (typeof task.priority !== 'number') return false;
  return true;
}

// =============================================================================
// IMPURE WRAPPER CLASS
// =============================================================================

/**
 * Step 1 Parallel Processor
 * Manages parallel validation of documentation categories
 */
export class Step1ParallelProcessor {
  /**
   * Create processor
   * @param {Object} config - Configuration options
   */
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.tasks = [];
    this.runningTasks = new Set();
    this.taskControllers = new Map();
    this.startTime = null;
    this.endTime = null;
  }

  /**
   * Validate files in parallel by category
   * @async
   * @param {Array<string>} files - Documentation files
   * @param {Function} validator - Validation function (category, files) => Promise
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Validation results
   */
  async validate(files, validator, options = {}) {
    const {
      strategy = null,
      getPriority = (_cat) => VALIDATION_PRIORITY.MEDIUM,
      onProgress = null,
    } = options;

    // Create tasks
    this.tasks = createValidationTasks(files, getPriority, Date.now());

    if (this.tasks.length === 0) {
      logger.info('Step1Parallel: No files to validate');
      return mergeValidationResults([]);
    }

    // Sort tasks by priority
    this.tasks = sortTasksByPriority(this.tasks, this.config.categoryOrder);

    // Determine strategy
    const executionStrategy =
      strategy || determineExecutionStrategy(this.tasks, VALIDATION_PRIORITY.CRITICAL);

    logger.info(
      `Step1Parallel: Validating ${files.length} files across ${this.tasks.length} categories (${executionStrategy})`
    );

    this.startTime = Date.now();

    // Execute based on strategy
    let results;
    switch (executionStrategy) {
      case EXECUTION_STRATEGY.SEQUENTIAL:
        results = await this._executeSequential(validator, onProgress);
        break;
      case EXECUTION_STRATEGY.PARALLEL:
        results = await this._executeParallel(validator, onProgress);
        break;
      case EXECUTION_STRATEGY.BALANCED:
        results = await this._executeBalanced(validator, onProgress);
        break;
      case EXECUTION_STRATEGY.PRIORITY_BASED:
        results = await this._executePriorityBased(validator, onProgress);
        break;
      default:
        results = await this._executeSequential(validator, onProgress);
    }

    this.endTime = Date.now();
    const duration = Math.round((this.endTime - this.startTime) / 1000);

    logger.info(
      `Step1Parallel: Completed validation in ${duration}s (${results.validatedFiles}/${results.totalFiles} files)`
    );

    return results;
  }

  /**
   * Execute tasks sequentially
   * @private
   * @async
   */
  async _executeSequential(validator, onProgress) {
    for (const task of this.tasks) {
      await this._executeTask(task, validator);
      if (onProgress) onProgress(task);
    }

    return mergeValidationResults(this.tasks);
  }

  /**
   * Execute tasks in parallel
   * @private
   * @async
   */
  async _executeParallel(validator, onProgress) {
    const batches = splitIntoBatches(this.tasks, this.config.maxConcurrency);

    for (const batch of batches) {
      await Promise.all(
        batch.map(async (task) => {
          await this._executeTask(task, validator);
          if (onProgress) onProgress(task);
        })
      );
    }

    return mergeValidationResults(this.tasks);
  }

  /**
   * Execute tasks with balanced strategy
   * @private
   * @async
   */
  async _executeBalanced(validator, onProgress) {
    // Execute critical tasks sequentially
    const criticalTasks = this.tasks.filter((t) => t.priority >= VALIDATION_PRIORITY.CRITICAL);
    const otherTasks = this.tasks.filter((t) => t.priority < VALIDATION_PRIORITY.CRITICAL);

    // Critical tasks first (sequential)
    for (const task of criticalTasks) {
      await this._executeTask(task, validator);
      if (onProgress) onProgress(task);
    }

    // Other tasks in parallel
    const batches = splitIntoBatches(otherTasks, this.config.maxConcurrency);
    for (const batch of batches) {
      await Promise.all(
        batch.map(async (task) => {
          await this._executeTask(task, validator);
          if (onProgress) onProgress(task);
        })
      );
    }

    return mergeValidationResults(this.tasks);
  }

  /**
   * Execute tasks by priority level
   * @private
   * @async
   */
  async _executePriorityBased(validator, onProgress) {
    // Group by priority
    const priorityGroups = new Map();
    for (const task of this.tasks) {
      if (!priorityGroups.has(task.priority)) {
        priorityGroups.set(task.priority, []);
      }
      priorityGroups.get(task.priority).push(task);
    }

    // Execute each priority group (high to low)
    const priorities = Array.from(priorityGroups.keys()).sort((a, b) => b - a);

    for (const priority of priorities) {
      const group = priorityGroups.get(priority);
      const batches = splitIntoBatches(group, this.config.maxConcurrency);

      for (const batch of batches) {
        await Promise.all(
          batch.map(async (task) => {
            await this._executeTask(task, validator);
            if (onProgress) onProgress(task);
          })
        );
      }
    }

    return mergeValidationResults(this.tasks);
  }

  /**
   * Execute a single validation task
   * @private
   * @async
   */
  async _executeTask(task, validator) {
    if (!isValidTask(task)) {
      task.status = TASK_STATUS.FAILED;
      task.error = 'Invalid task structure';
      return;
    }

    task.status = TASK_STATUS.RUNNING;
    task.startTime = Date.now();
    this.runningTasks.add(task.id);
    const controller = new AbortController();
    this.taskControllers.set(task.id, controller);

    try {
      // Execute with timeout
      const result = await this._executeWithTimeout(
        () => validator(task.category, task.files, { signal: controller.signal, task }),
        this.config.timeout,
        controller
      );

       if (result?.success === false) {
        const error = new Error(result.error || 'Validation failed');
        error.result = result;
        throw error;
      }

      task.status = TASK_STATUS.COMPLETED;
      task.result = result;
      task.endTime = Date.now();
      task.duration = Math.round((task.endTime - task.startTime) / 1000);

      logger.info(
        `Step1Parallel: Validated ${task.category} (${task.files.length} files) in ${task.duration}s`
      );
    } catch (error) {
      task.status = error.message === 'Timeout' ? TASK_STATUS.TIMEOUT : TASK_STATUS.FAILED;
      task.result = error.result ?? null;
      task.error = error.message;
      task.endTime = Date.now();
      task.duration = Math.round((task.endTime - task.startTime) / 1000);

      logger.error(`Step1Parallel: Failed to validate ${task.category}: ${error.message}`);
    } finally {
      this.runningTasks.delete(task.id);
      this.taskControllers.delete(task.id);
    }
  }

  /**
   * Execute function with timeout
   * @private
   * @async
   */
  async _executeWithTimeout(fn, timeout, controller = null) {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        controller?.abort?.();
        reject(new Error('Timeout'));
      }, timeout);
    });
    return Promise.race([fn(), timeoutPromise]).finally(() => clearTimeout(timeoutId));
  }

  /**
   * Get execution statistics
   * @returns {Object} Statistics
   */
  getStatistics() {
    const stats = calculateTaskStatistics(this.tasks);

    if (this.startTime && this.endTime) {
      const actualDuration = Math.round((this.endTime - this.startTime) / 1000);
      const estimatedSequential = stats.totalDuration;

      stats.speedup = calculateSpeedup(estimatedSequential, actualDuration);
    }

    return stats;
  }

  /**
   * Cancel all pending tasks
   * @async
   * @returns {Promise<void>}
   */
  async cancel() {
    for (const task of this.tasks) {
      if (task.status === TASK_STATUS.PENDING || task.status === TASK_STATUS.RUNNING) {
        task.status = TASK_STATUS.CANCELLED;
        task.error = 'Cancelled by user';
      }
    }

    for (const controller of this.taskControllers.values()) {
      controller.abort();
    }

    logger.warn(`Step1Parallel: Cancelled ${this.runningTasks.size} running tasks`);
    this.runningTasks.clear();
    this.taskControllers.clear();
  }

  /**
   * Reset processor state
   */
  reset() {
    this.tasks = [];
    this.runningTasks.clear();
    this.taskControllers.clear();
    this.startTime = null;
    this.endTime = null;
  }
}
