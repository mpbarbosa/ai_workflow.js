/**
 * Logger Module
 * @version 1.0.0
 * @description Colored output and logging utilities for workflow automation
 * @module core/logger
 * Part of: AI Workflow Automation v1.0.0
 */

import { colorize, colors, supportsColor } from './colors.js';
import fs from 'fs';
import path from 'path';

/**
 * Strip ANSI escape codes from a string so log files are plain text.
 * @param {string} str
 * @returns {string}
 */
export function stripAnsi(str) {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B\[[0-9;]*m/g, '');
}

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
    this._logStream = null;
    this._stepLogStream = null;
  }

  /**
   * Open a per-step secondary log file. All log lines are written to both
   * the main workflow log and this step log until closeStepLogFile() is called.
   * @param {string} filePath - Absolute path to the step log file
   */
  openStepLogFile(filePath) {
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      if (this._stepLogStream) {
        this._stepLogStream.end();
      }
      this._stepLogStream = fs.createWriteStream(filePath, { flags: 'a' });
    } catch {
      // Best-effort; do not crash the workflow
    }
  }

  /** Close the per-step log file stream. */
  closeStepLogFile() {
    if (this._stepLogStream) {
      this._stepLogStream.end();
      this._stepLogStream = null;
    }
  }

  /**
   * Configure file logging. Creates the directory if needed and opens an
   * append stream to the given file path. All subsequent log calls will
   * be written there (without ANSI codes) in addition to the console.
   * @param {string} filePath - Absolute path to the log file
   */
  setLogFile(filePath) {
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      if (this._logStream) {
        this._logStream.end();
      }
      this._logStream = fs.createWriteStream(filePath, { flags: 'a' });
    } catch {
      // File logging is best-effort; do not crash the workflow
    }
  }

  /** Close the log file stream (call at end of workflow run). */
  closeLogFile() {
    if (this._logStream) {
      this._logStream.end();
      this._logStream = null;
    }
  }

  /**
   * Log a step header - visually prominent banner marking the start of a workflow step.
   * Always written to file; respects the quiet flag for console output.
   * @param {string} title - Step title (e.g. 'Step 1: AI-Powered Documentation Updates')
   */
  step(title) {
    const separator = '═'.repeat(60);
    const headerText = `🔷  ${title}`;
    if (!this.quiet) {
      if (supportsColor()) {
        const sep = `${colors.bold}${colors.brightMagenta}${separator}${colors.reset}`;
        const hdr = `${colors.bold}${colors.brightMagenta}${headerText}${colors.reset}`;
        console.log(sep);
        console.log(hdr);
        console.log(sep);
      } else {
        console.log(separator);
        console.log(headerText);
        console.log(separator);
      }
    }
    this._writeFile(separator);
    this._writeFile(headerText);
    this._writeFile(separator);
  }

  /**
   * Log debug message (only in verbose mode)
   */
  debug(message) {
    if (this.verbose && !this.quiet) {
      const formatted = this._format(message, 'debug');
      console.log(formatted);
      this._writeFile(formatted);
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
    this._writeFile(this._format(message, 'info'));
  }

  /**
   * Log success message
   */
  success(message) {
    if (!this.quiet) {
      const formatted = this._format(message, 'success');
      console.log(formatted);
    }
    this._writeFile(this._format(message, 'success'));
  }

  /**
   * Log warning message
   */
  warn(message) {
    const formatted = this._format(message, 'warn');
    console.warn(formatted);
    this._writeFile(formatted);
  }

  /**
   * Log error message
   */
  error(message) {
    const formatted = this._format(message, 'error');
    console.error(formatted);
    this._writeFile(formatted);
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

  /**
   * Write a plain-text line to the log file (best-effort, no throw).
   * @param {string} formatted - Already-formatted (possibly ANSI) string
   */
  _writeFile(formatted) {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ${stripAnsi(formatted)}\n`;
    if (this._logStream) {
      try {
        this._logStream.write(line);
      } catch {
        /* ignore */
      }
    }
    if (this._stepLogStream) {
      try {
        this._stepLogStream.write(line);
      } catch {
        /* ignore */
      }
    }
  }
}

/**
 * Default logger instance
 */
export const logger = new Logger();

export default logger;
