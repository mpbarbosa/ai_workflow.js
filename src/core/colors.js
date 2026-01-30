/**
 * ANSI Color Codes Module
 * @version 1.0.0
 * @description ANSI color codes for terminal output with color support detection
 * @module core/colors
 * Part of: AI Workflow Automation v1.0.0
 */

export const colors = {
  // Basic colors
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',

  // Foreground colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',

  // Bright foreground colors
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',
};

/**
 * Check if colors should be enabled
 * @returns {boolean} true if terminal supports colors
 */
export function supportsColor() {
  return process.stdout.isTTY && process.env.TERM !== 'dumb' && !process.env.NO_COLOR;
}

/**
 * Colorize text if terminal supports it
 * @param {string} text - Text to colorize
 * @param {string} color - Color code from colors object
 * @returns {string} Colorized text or plain text
 */
export function colorize(text, color) {
  if (!supportsColor()) {
    return text;
  }
  return `${color}${text}${colors.reset}`;
}

export default colors;
