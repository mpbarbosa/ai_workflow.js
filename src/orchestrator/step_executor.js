/**
 * @fileoverview Step Executor - Executes workflow steps with validation and error handling
 * @module orchestrator/step_executor
 * @version 2.0.0
 *
 * Provides step execution with timeout handling, retry logic, input/output validation,
 * and progress reporting. Follows referential transparency pattern with pure functions
 * for business logic and StepExecutor class for I/O and state management.
 *
 * Architecture:
 * - Pure functions: Validation, timeout calculation, retry logic, result formatting
 * - Impure wrapper: StepExecutor class for execution and side effects
 */

import { EventEmitter } from 'events';
import { logger } from '../core/logger.js';
import { ValidationError, SystemError } from '../utils/errors.js';

/**
 * Validates step input against schema
 *
 * @param {*} input - Input data to validate
 * @param {Object} [schema] - Optional validation schema
 * @returns {Object} Validation result with valid flag and errors
 * @pure
 *
 * @example
 * const result = validateStepInput({ data: 'test' }, { requiredFields: ['data'] });
 * // => { valid: true, errors: [] }
 */
export function validateStepInput(input, schema = null) {
  const result = {
    valid: true,
    errors: [],
  };

  if (!schema) {
    return result; // No schema = always valid
  }

  // Required fields validation
  if (schema.requiredFields && Array.isArray(schema.requiredFields)) {
    for (const field of schema.requiredFields) {
      if (input?.[field] === undefined) {
        result.valid = false;
        result.errors.push(`Missing required field: ${field}`);
      }
    }
  }

  // Type validation
  if (schema.types && typeof schema.types === 'object') {
    for (const [field, expectedType] of Object.entries(schema.types)) {
      if (input?.[field] !== undefined) {
        const actualType = typeof input[field];
        if (actualType !== expectedType) {
          result.valid = false;
          result.errors.push(`Field '${field}' must be ${expectedType}, got ${actualType}`);
        }
      }
    }
  }

  // Custom validator function
  if (schema.validate && typeof schema.validate === 'function') {
    try {
      const customResult = schema.validate(input);
      if (customResult !== true) {
        result.valid = false;
        result.errors.push(customResult || 'Custom validation failed');
      }
    } catch (error) {
      result.valid = false;
      result.errors.push(`Validation error: ${error.message}`);
    }
  }

  return result;
}

/**
 * Validates step output against schema
 *
 * @param {*} output - Output data to validate
 * @param {Object} [schema] - Optional validation schema
 * @returns {Object} Validation result with valid flag and errors
 * @pure
 */
export function validateStepOutput(output, schema = null) {
  const result = {
    valid: true,
    errors: [],
  };

  if (!schema) {
    return result;
  }

  // Required fields validation
  if (schema.requiredFields && Array.isArray(schema.requiredFields)) {
    for (const field of schema.requiredFields) {
      if (output?.[field] === undefined) {
        result.valid = false;
        result.errors.push(`Missing required output field: ${field}`);
      }
    }
  }

  // Success flag validation
  if (schema.requireSuccess && output?.success !== true) {
    result.valid = false;
    result.errors.push('Step did not report success');
  }

  // Custom validator function
  if (schema.validate && typeof schema.validate === 'function') {
    try {
      const customResult = schema.validate(output);
      if (customResult !== true) {
        result.valid = false;
        result.errors.push(customResult || 'Output validation failed');
      }
    } catch (error) {
      result.valid = false;
      result.errors.push(`Validation error: ${error.message}`);
    }
  }

  return result;
}

/**
 * Calculates timeout for a step based on configuration
 *
 * @param {Object} step - Step definition with optional timeout
 * @param {number} baseTimeout - Base timeout in seconds
 * @returns {number} Calculated timeout in milliseconds
 * @pure
 */
export function calculateTimeout(step, baseTimeout = 300) {
  const stepTimeout = step?.timeout || baseTimeout;
  return stepTimeout * 1000; // Convert to milliseconds
}

/**
 * Determines if a step should be retried after failure
 *
 * @param {Error} error - Error that occurred
 * @param {number} attempt - Current attempt number (0-indexed)
 * @param {number} maxRetries - Maximum retry attempts
 * @returns {boolean} True if step should be retried
 * @pure
 */
export function shouldRetryStep(error, attempt, maxRetries = 3) {
  if (attempt >= maxRetries) {
    return false;
  }

  // Don't retry validation errors
  if (error instanceof ValidationError) {
    return false;
  }

  // Retry system errors and unknown errors
  return true;
}

/**
 * Calculates retry delay with exponential backoff
 *
 * @param {number} attempt - Current attempt number (0-indexed)
 * @param {number} baseDelay - Base delay in milliseconds
 * @returns {number} Delay in milliseconds
 * @pure
 */
export function calculateRetryDelay(attempt, baseDelay = 1000) {
  return baseDelay * Math.pow(2, attempt);
}

/**
 * Formats step execution result into standard structure
 *
 * @param {Object} step - Step definition
 * @param {Object} execution - Execution details
 * @returns {Object} Formatted result
 * @pure
 */
export function formatStepResult(step, execution) {
  return {
    stepId: step.id,
    name: step.name,
    success: execution.success === true,
    duration: execution.duration || 0,
    output: execution.output || null,
    error: execution.error || null,
    attempts: execution.attempts || 1,
    skipped: execution.skipped === true,
    timestamp: execution.timestamp || Date.now(),
  };
}

/**
 * Creates execution context for a step
 *
 * @param {Object} step - Step definition
 * @param {Object} globalContext - Global execution context
 * @param {Object} previousResults - Results from previous steps
 * @returns {Object} Execution context
 * @pure
 */
export function createExecutionContext(step, globalContext = {}, previousResults = {}) {
  return {
    step,
    global: globalContext,
    results: previousResults,
    metadata: {
      stepId: step.id,
      stepName: step.name,
      phase: step.phase || 'execution',
    },
  };
}

/**
 * Checks if step execution timed out
 *
 * @param {number} startTime - Execution start time (ms)
 * @param {number} timeout - Timeout duration (ms)
 * @returns {boolean} True if timed out
 * @pure
 */
export function isTimedOut(startTime, timeout) {
  return Date.now() - startTime >= timeout;
}

/**
 * Builds error message for step failure
 *
 * @param {Object} step - Step definition
 * @param {Error} error - Error that occurred
 * @param {number} attempts - Number of attempts made
 * @returns {string} Formatted error message
 * @pure
 */
export function buildErrorMessage(step, error, attempts) {
  const attemptStr = attempts > 1 ? ` (after ${attempts} attempts)` : '';
  return `Step '${step.id}' failed${attemptStr}: ${error.message}`;
}

/**
 * Step Executor - Manages step execution with validation and error handling
 *
 * Impure wrapper class that provides:
 * - Step execution with timeout
 * - Retry logic with exponential backoff
 * - Input/output validation
 * - Pre/post execution hooks
 * - Progress reporting via events
 * - Parallel execution
 *
 * Side effects:
 * - Executes step handlers (async functions)
 * - Console logging via logger
 * - Event emission (extends EventEmitter)
 * - Maintains execution state (mutable)
 *
 * Events:
 * - step:start - Step execution started
 * - step:complete - Step completed successfully
 * - step:error - Step failed
 * - step:retry - Step being retried
 * - step:timeout - Step timed out
 * - step:validation:error - Validation failed
 *
 * @class
 * @extends EventEmitter
 */
export class StepExecutor extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      baseTimeout: options.baseTimeout || 300,
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 1000,
      validateInputs: options.validateInputs !== false,
      validateOutputs: options.validateOutputs !== false,
      ...options,
    };
    this.executionHistory = [];
  }

  /**
   * Executes a single step
   *
   * @param {Object} step - Step definition with id, name, handler
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Execution result
   * @throws {ValidationError} If validation fails
   * @throws {SystemError} If execution fails
   */
  async execute(step, context = {}) {
    const startTime = Date.now();

    logger.debug(`Executing step: ${step.id}`);
    this.emit('step:start', { stepId: step.id, name: step.name });

    try {
      // Validate step has handler
      if (!step.handler || typeof step.handler !== 'function') {
        throw new ValidationError(`Step '${step.id}' has no valid handler function`);
      }

      // Validate input if schema provided
      if (this.options.validateInputs && step.inputSchema) {
        const inputValidation = validateStepInput(context, step.inputSchema);
        if (!inputValidation.valid) {
          const error = new ValidationError(
            `Input validation failed: ${inputValidation.errors.join(', ')}`
          );
          this.emit('step:validation:error', { stepId: step.id, errors: inputValidation.errors });
          throw error;
        }
      }

      // Execute step handler with timeout
      const timeout = calculateTimeout(step, this.options.baseTimeout);
      const output = await this._executeWithTimeout(step.handler, context, timeout);

      // Validate output if schema provided
      if (this.options.validateOutputs && step.outputSchema) {
        const outputValidation = validateStepOutput(output, step.outputSchema);
        if (!outputValidation.valid) {
          const error = new ValidationError(
            `Output validation failed: ${outputValidation.errors.join(', ')}`
          );
          this.emit('step:validation:error', { stepId: step.id, errors: outputValidation.errors });
          throw error;
        }
      }

      const duration = Date.now() - startTime;
      const result = formatStepResult(step, {
        success: true,
        duration,
        output,
        timestamp: startTime,
      });

      this.executionHistory.push(result);
      this.emit('step:complete', result);
      logger.info(`Step '${step.id}' completed in ${duration}ms`);

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const result = formatStepResult(step, {
        success: false,
        duration,
        error: error.message,
        timestamp: startTime,
      });

      this.executionHistory.push(result);
      this.emit('step:error', { ...result, error });
      logger.error(`Step '${step.id}' failed: ${error.message}`);

      throw error;
    }
  }

  /**
   * Executes a step with retry logic
   *
   * @param {Object} step - Step definition
   * @param {Object} context - Execution context
   * @param {number} [maxRetries] - Override max retries
   * @returns {Promise<Object>} Execution result
   */
  async executeWithRetry(step, context = {}, maxRetries = null) {
    const retries = maxRetries !== null ? maxRetries : this.options.maxRetries;
    let lastError = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const result = await this.execute(step, context);
        result.attempts = attempt + 1;
        return result;
      } catch (error) {
        lastError = error;

        // Check if should retry
        if (attempt < retries && shouldRetryStep(error, attempt, retries)) {
          const delay = calculateRetryDelay(attempt, this.options.retryDelay);
          logger.warn(
            `Step '${step.id}' failed (attempt ${attempt + 1}/${retries + 1}), retrying in ${delay}ms`
          );
          this.emit('step:retry', { stepId: step.id, attempt, delay });

          await this._sleep(delay);
        } else {
          break;
        }
      }
    }

    // All retries exhausted
    const errorMsg = buildErrorMessage(step, lastError, retries + 1);
    throw new SystemError(errorMsg);
  }

  /**
   * Executes multiple steps in parallel
   *
   * @param {Array<Object>} steps - Array of step definitions
   * @param {Object} context - Shared execution context
   * @returns {Promise<Array<Object>>} Array of results
   */
  async executeInParallel(steps, context = {}) {
    logger.debug(`Executing ${steps.length} steps in parallel`);

    const promises = steps.map((step) => {
      return this.execute(step, context).catch((error) => {
        // Don't fail fast - collect all results
        return formatStepResult(step, {
          success: false,
          error: error.message,
          timestamp: Date.now(),
        });
      });
    });

    const results = await Promise.all(promises);

    const successful = results.filter((r) => r.success).length;
    logger.info(`Parallel execution complete: ${successful}/${steps.length} succeeded`);

    return results;
  }

  /**
   * Validates step execution against expected outcomes
   *
   * @param {Object} step - Step definition
   * @param {Object} result - Execution result
   * @returns {Object} Validation result
   */
  validateExecution(step, result) {
    const validation = {
      valid: true,
      errors: [],
    };

    // Check success flag
    if (!result.success) {
      validation.valid = false;
      validation.errors.push('Step execution failed');
    }

    // Check if critical step
    if (step.critical && !result.success) {
      validation.valid = false;
      validation.errors.push('Critical step failed');
    }

    // Check expected output structure
    if (step.expectedOutput && result.output) {
      for (const field of step.expectedOutput) {
        if (result.output[field] === undefined) {
          validation.valid = false;
          validation.errors.push(`Missing expected output: ${field}`);
        }
      }
    }

    return validation;
  }

  /**
   * Gets execution history
   *
   * @returns {Array<Object>} Execution history
   */
  getHistory() {
    return [...this.executionHistory];
  }

  /**
   * Gets execution statistics
   *
   * @returns {Object} Execution statistics
   */
  getStats() {
    const total = this.executionHistory.length;
    const successful = this.executionHistory.filter((r) => r.success).length;
    const failed = total - successful;
    const totalDuration = this.executionHistory.reduce((sum, r) => sum + r.duration, 0);

    return {
      total,
      successful,
      failed,
      successRate: total > 0 ? (successful / total) * 100 : 0,
      totalDuration,
      averageDuration: total > 0 ? totalDuration / total : 0,
    };
  }

  /**
   * Clears execution history
   */
  clearHistory() {
    this.executionHistory = [];
    logger.debug('Cleared execution history');
  }

  /**
   * Executes handler with timeout
   *
   * @private
   * @param {Function} handler - Step handler function
   * @param {Object} context - Execution context
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<*>} Handler result
   */
  async _executeWithTimeout(handler, context, timeout) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const error = new SystemError(`Step execution timed out after ${timeout}ms`);
        this.emit('step:timeout', { timeout });
        reject(error);
      }, timeout);

      Promise.resolve(handler(context))
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Sleep utility for retry delays
   *
   * @private
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
