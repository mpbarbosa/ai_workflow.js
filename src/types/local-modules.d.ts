/**
 * Ambient type declarations for local JavaScript modules imported by TypeScript
 * source files.  These stubs give TypeScript enough information to type-check
 * .ts files without converting the JS modules to TypeScript.
 */

declare module '../core/logger.js' {
  interface Logger {
    debug(msg: string): void;
    info(msg: string): void;
    warn(msg: string): void;
    error(msg: string): void;
    success(msg: string): void;
  }
  export const logger: Logger;
}

declare module '../utils/errors.js' {
  export class WorkflowError extends Error {
    constructor(message: string, code?: string, details?: Record<string, unknown>);
  }
  export class SystemError extends WorkflowError {
    constructor(message: string, code?: string, details?: Record<string, unknown>);
  }
  export class ExecutionError extends WorkflowError {
    constructor(message: string, code?: string, details?: Record<string, unknown>);
  }
  export class ConfigurationError extends WorkflowError {
    constructor(message: string, code?: string, details?: Record<string, unknown>);
  }
  export class ValidationError extends WorkflowError {
    constructor(message: string, code?: string, details?: Record<string, unknown>);
  }
  export class FileSystemError extends WorkflowError {
    constructor(message: string, code?: string, details?: Record<string, unknown>);
  }
}

declare module '../helpers.js' {
  export function truncateStackTrace(
    stack: string | null | undefined,
    maxLines?: number
  ): string[];
}
