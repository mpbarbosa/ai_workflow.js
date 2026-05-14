/**
 * @fileoverview Step Executor wrapper around olinda_orchestrator
 * @module orchestrator/step_executor
 *
 * Reuses the shared StepExecutor implementation from `olinda_orchestrator`
 * while preserving ai-workflow's existing logger wiring and local
 * ValidationError/SystemError contract.
 */

import * as olindaOrchestrator from 'olinda_orchestrator';
import { logger } from '../core/logger.js';
import { ValidationError, SystemError } from '../utils/errors.js';

const {
  validateStepInput: olindaValidateStepInput,
  validateStepOutput: olindaValidateStepOutput,
  calculateTimeout: olindaCalculateTimeout,
  shouldRetryStep: olindaShouldRetryStep,
  calculateRetryDelay: olindaCalculateRetryDelay,
  formatStepResult: olindaFormatStepResult,
  createExecutionContext: olindaCreateExecutionContext,
  isTimedOut: olindaIsTimedOut,
  buildErrorMessage: olindaBuildErrorMessage,
  WorkflowStepExecutor,
  StepExecutorValidationError,
  StepExecutorSystemError,
} = olindaOrchestrator;

export const validateStepInput = olindaValidateStepInput;
export const validateStepOutput = olindaValidateStepOutput;
export const calculateTimeout = olindaCalculateTimeout;
export const calculateRetryDelay = olindaCalculateRetryDelay;
export const formatStepResult = olindaFormatStepResult;
export const createExecutionContext = olindaCreateExecutionContext;
export const isTimedOut = olindaIsTimedOut;
export const buildErrorMessage = olindaBuildErrorMessage;

function createDefaultLogger() {
  return {
    debug: (message) => logger.debug(message),
    info: (message) => logger.info(message),
    warn: (message) => logger.warn(message),
    error: (message) => logger.error(message),
  };
}

function translateExecutorError(error) {
  if (error instanceof ValidationError || error instanceof SystemError) {
    return error;
  }

  if (error instanceof StepExecutorValidationError) {
    return new ValidationError(error.message);
  }

  if (error instanceof StepExecutorSystemError) {
    return new SystemError(error.message);
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error(String(error));
}

export function shouldRetryStep(error, attempt, maxRetries = 3) {
  if (error instanceof ValidationError || error instanceof StepExecutorValidationError) {
    return false;
  }

  return olindaShouldRetryStep(error, attempt, maxRetries);
}

export class StepExecutor extends WorkflowStepExecutor {
  constructor(options = {}) {
    super({
      ...options,
      logger: {
        ...createDefaultLogger(),
        ...(options.logger || {}),
      },
    });
  }

  async execute(step, context = {}) {
    try {
      return await super.execute(step, context);
    } catch (error) {
      throw translateExecutorError(error);
    }
  }

  async executeWithRetry(step, context = {}, maxRetries = null) {
    const retries = maxRetries !== null ? maxRetries : this.options.maxRetries;
    let lastError = null;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        const result = await this.execute(step, context);
        result.attempts = attempt + 1;
        return result;
      } catch (error) {
        lastError = error;

        if (attempt < retries && shouldRetryStep(error, attempt, retries)) {
          const delay = calculateRetryDelay(attempt, this.options.retryDelay);
          this.options.logger.warn(
            `Step '${step.id}' failed (attempt ${attempt + 1}/${retries + 1}), retrying in ${delay}ms`
          );
          this.emit('step:retry', { stepId: step.id, attempt, delay });

          await this._sleep(delay);
        } else {
          break;
        }
      }
    }

    throw new SystemError(buildErrorMessage(step, lastError, retries + 1));
  }
}
