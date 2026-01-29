/**
 * AI Workflow Automation - Core Module
 * Entry point for the core functionality
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
