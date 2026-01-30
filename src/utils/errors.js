/**
 * Custom Error Classes Module
 * @version 1.0.0
 * @description Custom error types for workflow automation
 * @module utils/errors
 * Part of: AI Workflow Automation v1.0.0
 */

/**
 * Base error class for all application errors
 */
export class WorkflowError extends Error {
  constructor(message, code = 'WORKFLOW_ERROR') {
    super(message);
    this.name = 'WorkflowError';
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error for system-related issues (OS detection, permissions, etc.)
 */
export class SystemError extends WorkflowError {
  constructor(message) {
    super(message, 'SYSTEM_ERROR');
    this.name = 'SystemError';
  }
}

/**
 * Error for command execution failures
 */
export class ExecutionError extends WorkflowError {
  constructor(message, exitCode = 1, stdout = '', stderr = '') {
    super(message, 'EXECUTION_ERROR');
    this.name = 'ExecutionError';
    this.exitCode = exitCode;
    this.stdout = stdout;
    this.stderr = stderr;
  }
}

/**
 * Error for configuration issues
 */
export class ConfigurationError extends WorkflowError {
  constructor(message) {
    super(message, 'CONFIG_ERROR');
    this.name = 'ConfigurationError';
  }
}

/**
 * Error for validation failures
 */
export class ValidationError extends WorkflowError {
  constructor(message, field = null) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    this.field = field;
  }
}

export default {
  WorkflowError,
  SystemError,
  ExecutionError,
  ConfigurationError,
  ValidationError,
};
