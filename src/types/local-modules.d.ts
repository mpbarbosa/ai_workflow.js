/**
 * Ambient type declarations for local JavaScript modules imported by
 * copilot_sdk_wrapper.ts.  These stubs give TypeScript enough information to
 * type-check the .ts file without converting the JS modules to TypeScript.
 */

declare module '../core/logger.js' {
  interface Logger {
    debug(msg: string): void;
    info(msg: string): void;
    warn(msg: string): void;
    error(msg: string): void;
  }
  export const logger: Logger;
}

declare module '../utils/errors.js' {
  export class SystemError extends Error {
    constructor(message: string, code?: string, details?: Record<string, unknown>);
  }
  export class ConfigError extends Error {
    constructor(message: string, code?: string, details?: Record<string, unknown>);
  }
  export class WorkflowError extends Error {
    constructor(message: string, code?: string, details?: Record<string, unknown>);
  }
}
