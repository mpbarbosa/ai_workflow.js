/**
 * @fileoverview CLI Progress Utilities
 * @module cli/progress
 *
 * Progress indicators and bars for long-running CLI operations.
 *
 * Architecture: v2.0.0 Pattern
 * - Pure functions for progress calculation
 * - Impure wrappers for terminal output
 *
 * @version 1.0.0
 * @since 2026-02-11
 */

import ora from 'ora';
import chalk from 'chalk';

// ============================================================================
// PURE FUNCTIONS - Progress Calculation
// ============================================================================

/**
 * Calculate progress percentage
 * @pure
 * @param {number} current - Current value
 * @param {number} total - Total value
 * @returns {number} Progress percentage (0-100)
 */
export function calculateProgress(current, total) {
  if (total === 0) return 0;
  return Math.round((current / total) * 100);
}

/**
 * Format progress text
 * @pure
 * @param {number} current - Current value
 * @param {number} total - Total value
 * @param {string} unit - Unit label (e.g., 'steps', 'files')
 * @returns {string} Formatted progress text
 */
export function formatProgressText(current, total, unit = 'items') {
  const percentage = calculateProgress(current, total);
  return `${current}/${total} ${unit} (${percentage}%)`;
}

/**
 * Create progress bar string
 * @pure
 * @param {number} percentage - Progress percentage (0-100)
 * @param {number} width - Bar width in characters
 * @param {string} fillChar - Fill character
 * @param {string} emptyChar - Empty character
 * @returns {string} Progress bar string
 */
export function createProgressBar(percentage, width = 40, fillChar = '█', emptyChar = '░') {
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;
  return fillChar.repeat(filled) + emptyChar.repeat(empty);
}

/**
 * Format duration for display
 * @pure
 * @param {number} milliseconds - Duration in milliseconds
 * @returns {string} Formatted duration
 */
export function formatDuration(milliseconds) {
  if (milliseconds < 1000) {
    return `${milliseconds}ms`;
  }

  const seconds = Math.floor(milliseconds / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Estimate time remaining
 * @pure
 * @param {number} current - Current progress
 * @param {number} total - Total items
 * @param {number} elapsed - Elapsed time in milliseconds
 * @returns {string} Estimated time remaining
 */
export function estimateTimeRemaining(current, total, elapsed) {
  if (current === 0) return 'calculating...';

  const rate = current / elapsed; // items per millisecond
  const remaining = total - current;
  const estimatedMs = remaining / rate;

  return formatDuration(estimatedMs);
}

// ============================================================================
// IMPURE WRAPPERS - Terminal Output
// ============================================================================

/**
 * Create a spinner with custom text
 * @param {string} text - Spinner text
 * @param {string} color - Spinner color
 * @returns {Object} Ora spinner instance
 */
export function createSpinner(text, color = 'cyan') {
  return ora({
    text,
    color,
    spinner: 'dots',
  });
}

/**
 * Start a spinner
 * @param {string} text - Spinner text
 * @param {string} color - Spinner color
 * @returns {Object} Started spinner instance
 */
export function startSpinner(text, color = 'cyan') {
  const spinner = createSpinner(text, color);
  return spinner.start();
}

/**
 * Update spinner text
 * @param {Object} spinner - Ora spinner instance
 * @param {string} text - New text
 * @returns {void}
 */
export function updateSpinner(spinner, text) {
  if (spinner && spinner.isSpinning) {
    spinner.text = text;
  }
}

/**
 * Succeed spinner with message
 * @param {Object} spinner - Ora spinner instance
 * @param {string} message - Success message
 * @returns {void}
 */
export function succeedSpinner(spinner, message) {
  if (spinner && spinner.isSpinning) {
    spinner.succeed(chalk.green(message));
  }
}

/**
 * Fail spinner with message
 * @param {Object} spinner - Ora spinner instance
 * @param {string} message - Error message
 * @returns {void}
 */
export function failSpinner(spinner, message) {
  if (spinner && spinner.isSpinning) {
    spinner.fail(chalk.red(message));
  }
}

/**
 * Display progress bar
 * @param {number} current - Current progress
 * @param {number} total - Total items
 * @param {string} label - Progress label
 * @returns {void}
 */
export function displayProgressBar(current, total, label = 'Progress') {
  const percentage = calculateProgress(current, total);
  const bar = createProgressBar(percentage);
  const progressText = formatProgressText(current, total);

  // Clear line and write progress
  process.stdout.clearLine(0);
  process.stdout.cursorTo(0);
  process.stdout.write(`${chalk.cyan(label)}: ${bar} ${chalk.white(progressText)}`);

  // New line when complete
  if (current >= total) {
    process.stdout.write('\n');
  }
}

/**
 * Display step progress
 * @param {number} stepNumber - Current step number
 * @param {number} totalSteps - Total number of steps
 * @param {string} stepName - Step name
 * @returns {void}
 */
export function displayStepProgress(stepNumber, totalSteps, stepName) {
  const progressText = formatProgressText(stepNumber, totalSteps, 'steps');
  console.log();
  console.log(chalk.cyan.bold(`Step ${stepNumber}/${totalSteps}: ${stepName}`));
  console.log(chalk.gray(`Progress: ${progressText}`));
}

/**
 * Create progress tracker for workflow steps
 * @param {number} totalSteps - Total number of steps
 * @returns {Object} Progress tracker with methods
 */
export function createProgressTracker(totalSteps) {
  let current = 0;
  let startTime = Date.now();
  let spinner = null;

  return {
    start(stepName) {
      current++;
      const progressText = formatProgressText(current, totalSteps, 'steps');
      const text = `${progressText} - ${stepName}`;

      if (spinner) {
        updateSpinner(spinner, text);
      } else {
        spinner = startSpinner(text);
      }
    },

    update(message) {
      if (spinner) {
        const progressText = formatProgressText(current, totalSteps, 'steps');
        updateSpinner(spinner, `${progressText} - ${message}`);
      }
    },

    succeed(message) {
      if (spinner) {
        succeedSpinner(spinner, message);
        spinner = null;
      }
    },

    fail(message) {
      if (spinner) {
        failSpinner(spinner, message);
        spinner = null;
      }
    },

    complete() {
      if (spinner) {
        const elapsed = Date.now() - startTime;
        const duration = formatDuration(elapsed);
        succeedSpinner(spinner, `All steps completed in ${duration}`);
        spinner = null;
      }
    },

    getCurrent() {
      return current;
    },

    getElapsed() {
      return Date.now() - startTime;
    },
  };
}

export default {
  // Pure functions
  calculateProgress,
  formatProgressText,
  createProgressBar,
  formatDuration,
  estimateTimeRemaining,
  // Impure wrappers
  createSpinner,
  startSpinner,
  updateSpinner,
  succeedSpinner,
  failSpinner,
  displayProgressBar,
  displayStepProgress,
  createProgressTracker,
};
