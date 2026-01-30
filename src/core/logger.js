/**
 * Logger Module
 * @version 1.0.0
 * @description Colored output and logging utilities for workflow automation
 * @module core/logger
 * Part of: AI Workflow Automation v1.0.0
 */

import { colorize, colors } from './colors.js';

/**
 * Log levels with corresponding colors
 */
export const LogLevel = {
  DEBUG: 'debug',
  INFO: 'info',
  SUCCESS: 'success',
  WARN: 'warn',
  ERROR: 'error',
};

/**
 * Logger class for consistent output formatting
 */
export class Logger {
  constructor(options = {}) {
    this.quiet = options.quiet || false;
    this.verbose = options.verbose || false;
    this.prefix = options.prefix || '';
  }

  /**
   * Log debug message (only in verbose mode)
   */
  debug(message) {
    if (this.verbose && !this.quiet) {
      const formatted = this._format(message, 'debug');
      console.log(formatted);
    }
  }

  /**
   * Log info message
   */
  info(message) {
    if (!this.quiet) {
      const formatted = this._format(message, 'info');
      console.log(formatted);
    }
  }

  /**
   * Log success message
   */
  success(message) {
    if (!this.quiet) {
      const formatted = this._format(message, 'success');
      console.log(formatted);
    }
  }

  /**
   * Log warning message
   */
  warn(message) {
    const formatted = this._format(message, 'warn');
    console.warn(formatted);
  }

  /**
   * Log error message
   */
  error(message) {
    const formatted = this._format(message, 'error');
    console.error(formatted);
  }

  /**
   * Format message with color and prefix
   */
  _format(message, level) {
    const prefix = this.prefix ? `${this.prefix} ` : '';

    switch (level) {
      case 'debug':
        return colorize(`[DEBUG] ${prefix}${message}`, colors.dim);
      case 'info':
        return colorize(`${prefix}${message}`, colors.cyan);
      case 'success':
        return colorize(`✓ ${prefix}${message}`, colors.green);
      case 'warn':
        return colorize(`⚠ ${prefix}${message}`, colors.yellow);
      case 'error':
        return colorize(`✗ ${prefix}${message}`, colors.red);
      default:
        return `${prefix}${message}`;
    }
  }
}

/**
 * Default logger instance
 */
export const logger = new Logger();

export default logger;
