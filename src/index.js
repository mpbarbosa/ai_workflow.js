/**
 * AI Workflow Automation - Core Module
 * @version 1.0.0
 * @description Entry point for the core functionality and public API
 * @module index
 * Part of: AI Workflow Automation v1.0.0
 */

export { colors, colorize, supportsColor } from './core/colors.js';
export { Logger, logger, LogLevel } from './core/logger.js';
export { execute, executeStream, executeSudo } from './core/executor.js';
export {
  OS,
  PackageManager,
  detectOS,
  detectPackageManager,
  commandExists,
  getSystemInfo,
} from './core/system.js';
export {
  parseVersion,
  compareVersions,
  isGreaterThan,
  isLessThan,
  isEqual,
  getLatestVersion,
} from './core/version.js';
export {
  WorkflowError,
  SystemError,
  ExecutionError,
  ConfigurationError,
  ValidationError,
} from './utils/errors.js';
