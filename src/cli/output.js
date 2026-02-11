/**
 * @fileoverview CLI Output Utilities
 * @module cli/output
 *
 * Output formatting utilities for tables, boxes, and structured data display.
 *
 * Architecture: v2.0.0 Pattern
 * - Pure functions for formatting
 * - Impure wrappers for console output
 *
 * @version 1.0.0
 * @since 2026-02-11
 */

import chalk from 'chalk';

// ============================================================================
// PURE FUNCTIONS - Output Formatting
// ============================================================================

/**
 * Calculate column widths for table
 * @pure
 * @param {Array<Array<string>>} rows - Table rows
 * @returns {Array<number>} Column widths
 */
export function calculateColumnWidths(rows) {
  if (!rows || rows.length === 0) return [];

  const colCount = rows[0].length;
  const widths = new Array(colCount).fill(0);

  rows.forEach((row) => {
    row.forEach((cell, i) => {
      const cellStr = String(cell || '');
      widths[i] = Math.max(widths[i], cellStr.length);
    });
  });

  return widths;
}

/**
 * Pad string to width
 * @pure
 * @param {string} str - String to pad
 * @param {number} width - Target width
 * @param {string} align - Alignment ('left', 'right', 'center')
 * @returns {string} Padded string
 */
export function padString(str, width, align = 'left') {
  const cellStr = String(str || '');
  const padding = width - cellStr.length;

  if (padding <= 0) return cellStr;

  switch (align) {
    case 'right':
      return ' '.repeat(padding) + cellStr;
    case 'center': {
      const leftPad = Math.floor(padding / 2);
      const rightPad = padding - leftPad;
      return ' '.repeat(leftPad) + cellStr + ' '.repeat(rightPad);
    }
    default: // 'left'
      return cellStr + ' '.repeat(padding);
  }
}

/**
 * Format table row
 * @pure
 * @param {Array<string>} row - Row data
 * @param {Array<number>} widths - Column widths
 * @param {Array<string>} alignments - Column alignments
 * @returns {string} Formatted row
 */
export function formatTableRow(row, widths, alignments = []) {
  const cells = row.map((cell, i) => {
    const align = alignments[i] || 'left';
    return padString(cell, widths[i], align);
  });

  return `│ ${cells.join(' │ ')} │`;
}

/**
 * Create table border
 * @pure
 * @param {Array<number>} widths - Column widths
 * @param {string} position - Border position ('top', 'middle', 'bottom')
 * @returns {string} Border string
 */
export function createTableBorder(widths, position = 'middle') {
  const segments = widths.map((w) => '─'.repeat(w + 2));

  switch (position) {
    case 'top':
      return `┌${segments.join('┬')}┐`;
    case 'bottom':
      return `└${segments.join('┴')}┘`;
    default: // 'middle'
      return `├${segments.join('┼')}┤`;
  }
}

/**
 * Format data as table
 * @pure
 * @param {Array<Array<string>>} rows - Table data (including header)
 * @param {Array<string>} alignments - Column alignments
 * @returns {string} Formatted table
 */
export function formatTable(rows, alignments = []) {
  if (!rows || rows.length === 0) {
    return 'No data';
  }

  const widths = calculateColumnWidths(rows);
  const lines = [];

  // Top border
  lines.push(createTableBorder(widths, 'top'));

  // Header row
  lines.push(formatTableRow(rows[0], widths, alignments));

  // Middle border (after header)
  if (rows.length > 1) {
    lines.push(createTableBorder(widths, 'middle'));
  }

  // Data rows
  for (let i = 1; i < rows.length; i++) {
    lines.push(formatTableRow(rows[i], widths, alignments));
  }

  // Bottom border
  lines.push(createTableBorder(widths, 'bottom'));

  return lines.join('\n');
}

/**
 * Create a box around text
 * @pure
 * @param {string} text - Text to box
 * @param {Object} options - Box options
 * @returns {string} Boxed text
 */
export function createBox(text, options = {}) {
  const {
    padding = 1,
    title = null,
    style = 'single', // 'single', 'double', 'rounded'
  } = options;

  const borders = {
    single: { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│' },
    double: { tl: '╔', tr: '╗', bl: '╚', br: '╝', h: '═', v: '║' },
    rounded: { tl: '╭', tr: '╮', bl: '╰', br: '╯', h: '─', v: '│' },
  };

  const b = borders[style] || borders.single;
  const lines = text.split('\n');
  const maxWidth = Math.max(...lines.map((l) => l.length));
  const width = maxWidth + padding * 2;

  const output = [];

  // Top border
  if (title) {
    const titleStr = ` ${title} `;
    const remainingWidth = width - titleStr.length;
    const leftWidth = Math.floor(remainingWidth / 2);
    const rightWidth = remainingWidth - leftWidth;
    output.push(b.tl + b.h.repeat(leftWidth) + titleStr + b.h.repeat(rightWidth) + b.tr);
  } else {
    output.push(b.tl + b.h.repeat(width) + b.tr);
  }

  // Content lines
  lines.forEach((line) => {
    const padded = line + ' '.repeat(maxWidth - line.length);
    output.push(b.v + ' '.repeat(padding) + padded + ' '.repeat(padding) + b.v);
  });

  // Bottom border
  output.push(b.bl + b.h.repeat(width) + b.br);

  return output.join('\n');
}

/**
 * Format key-value pairs
 * @pure
 * @param {Object} data - Data object
 * @param {Object} options - Formatting options
 * @returns {string} Formatted output
 */
export function formatKeyValue(data, options = {}) {
  const { indent = 0, separator = ': ', keyColor = null, valueColor = null } = options;

  const entries = Object.entries(data);
  const maxKeyLength = Math.max(...entries.map(([key]) => key.length));

  const lines = entries.map(([key, value]) => {
    const paddedKey = key.padEnd(maxKeyLength);
    const formattedKey = keyColor ? chalk[keyColor](paddedKey) : paddedKey;
    const formattedValue = valueColor ? chalk[valueColor](value) : value;
    return ' '.repeat(indent) + formattedKey + separator + formattedValue;
  });

  return lines.join('\n');
}

/**
 * Format list with bullets
 * @pure
 * @param {Array<string>} items - List items
 * @param {Object} options - Formatting options
 * @returns {string} Formatted list
 */
export function formatList(items, options = {}) {
  const { bullet = '•', indent = 0, color = null } = options;

  const lines = items.map((item) => {
    const line = ' '.repeat(indent) + bullet + ' ' + item;
    return color ? chalk[color](line) : line;
  });

  return lines.join('\n');
}

/**
 * Truncate string with ellipsis
 * @pure
 * @param {string} str - String to truncate
 * @param {number} maxLength - Maximum length
 * @param {string} ellipsis - Ellipsis string
 * @returns {string} Truncated string
 */
export function truncateString(str, maxLength, ellipsis = '...') {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - ellipsis.length) + ellipsis;
}

// ============================================================================
// IMPURE WRAPPERS - Console Output
// ============================================================================

/**
 * Print table to console
 * @param {Array<Array<string>>} rows - Table data
 * @param {Array<string>} alignments - Column alignments
 * @returns {void}
 */
export function printTable(rows, alignments = []) {
  console.log(formatTable(rows, alignments));
}

/**
 * Print box to console
 * @param {string} text - Text to box
 * @param {Object} options - Box options
 * @returns {void}
 */
export function printBox(text, options = {}) {
  console.log(createBox(text, options));
}

/**
 * Print banner
 * @param {string} text - Banner text
 * @param {string} color - Text color
 * @returns {void}
 */
export function printBanner(text, color = 'blue') {
  console.log();
  console.log(chalk[color]('━'.repeat(60)));
  console.log(chalk[color].bold(`  ${text}`));
  console.log(chalk[color]('━'.repeat(60)));
  console.log();
}

/**
 * Print section header
 * @param {string} text - Header text
 * @param {string} color - Text color
 * @returns {void}
 */
export function printHeader(text, color = 'cyan') {
  console.log();
  console.log(chalk[color].bold(text));
  console.log(chalk.gray('─'.repeat(60)));
}

/**
 * Print key-value pairs
 * @param {Object} data - Data object
 * @param {Object} options - Formatting options
 * @returns {void}
 */
export function printKeyValue(data, options = {}) {
  console.log(formatKeyValue(data, options));
}

/**
 * Print list
 * @param {Array<string>} items - List items
 * @param {Object} options - Formatting options
 * @returns {void}
 */
export function printList(items, options = {}) {
  console.log(formatList(items, options));
}

/**
 * Print success message
 * @param {string} message - Success message
 * @returns {void}
 */
export function printSuccess(message) {
  console.log(chalk.green(`✓ ${message}`));
}

/**
 * Print error message
 * @param {string} message - Error message
 * @returns {void}
 */
export function printError(message) {
  console.log(chalk.red(`✗ ${message}`));
}

/**
 * Print warning message
 * @param {string} message - Warning message
 * @returns {void}
 */
export function printWarning(message) {
  console.log(chalk.yellow(`⚠ ${message}`));
}

/**
 * Print info message
 * @param {string} message - Info message
 * @returns {void}
 */
export function printInfo(message) {
  console.log(chalk.cyan(`ℹ ${message}`));
}

export default {
  // Pure functions
  calculateColumnWidths,
  padString,
  formatTableRow,
  createTableBorder,
  formatTable,
  createBox,
  formatKeyValue,
  formatList,
  truncateString,
  // Impure wrappers
  printTable,
  printBox,
  printBanner,
  printHeader,
  printKeyValue,
  printList,
  printSuccess,
  printError,
  printWarning,
  printInfo,
};
