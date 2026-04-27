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

declare module '../../core/logger.js' {
  interface Logger {
    debug(msg: string): void;
    info(msg: string): void;
    warn(msg: string): void;
    error(msg: string): void;
    success(msg: string): void;
  }

  export const logger: Logger;
}

declare module '../../lib/cleanup_handlers.js' {
  export interface CleanupSummary {
    filesDeleted?: number;
    bytesFreed?: number;
  }

  export interface CleanupArtifactsOptions {
    dryRun?: boolean;
    olderThanDays?: number;
  }

  export interface CleanupCacheOptions {
    dryRun?: boolean;
  }

  export interface CleanupCheckpointsOptions {
    dryRun?: boolean;
    keepLast?: number;
  }

  export class CleanupManager {
    constructor(workflowDir?: string);
    cleanupArtifacts(options?: CleanupArtifactsOptions): Promise<CleanupSummary>;
    cleanupCache(options?: CleanupCacheOptions): Promise<CleanupSummary>;
    cleanupCheckpoints(options?: CleanupCheckpointsOptions): Promise<CleanupSummary>;
  }
}

declare module '../../core/executor.js' {
  export interface ExecuteStreamOptions {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    timeout?: number;
    onStdout?: (line: string) => void;
    onStderr?: (line: string) => void;
  }

  export interface ExecuteStreamResult {
    stdout: string;
    stderr: string;
    exitCode: number;
    success: boolean;
  }

  export function executeStream(
    command: string,
    options?: ExecuteStreamOptions
  ): Promise<ExecuteStreamResult>;
}

declare module '../../lib/ai_helpers.js' {
  export interface AiHelperConfig {
    promptsDir?: string | null;
  }

  export interface AiExecuteRequestOptions {
    persona?: string;
    model?: string;
    validate?: boolean;
    stream?: boolean;
    timeout?: number;
  }

  export interface AiHelperResponse {
    content: string;
    metadata?: Record<string, unknown>;
    confidence?: number;
    success?: boolean;
    error?: string;
  }

  export class AiHelper {
    constructor(config?: AiHelperConfig);
    initialize(): Promise<boolean>;
    executeRequest(
      prompt: string,
      options?: AiExecuteRequestOptions,
      onChunk?: ((delta: string) => void) | null
    ): Promise<AiHelperResponse>;
    cleanup(): Promise<void>;
  }
}

declare module '../../lib/log_parser.js' {
  export interface DiscoverLogFilesAsyncFileSystem {
    readdir(
      directoryPath: string,
      options: { withFileTypes: true }
    ): Promise<Array<string | { name: string; isDirectory?(): boolean }>>;
    stat(filePath: string): Promise<{ isDirectory(): boolean }>;
  }

  export interface DiscoveredLogRun {
    runDir: string;
    files: string[];
  }

  export function discoverLogFilesAsync(
    logDir: string,
    latestOnly: boolean,
    fileSystem: DiscoverLogFilesAsyncFileSystem
  ): Promise<DiscoveredLogRun[]>;
}
