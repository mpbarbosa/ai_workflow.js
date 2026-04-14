/**
 * ANSI Color Codes Module
 * @version 1.1.0
 * @description
 * Exposes the shared ANSI color constants from `olinda_shell_interface.js`, but
 * keeps this repository's historical `colorize(text, color)` calling convention.
 * The upstream helper expects `(color, text)`, so re-exporting it directly broke
 * callers and tests by prepending invalid color strings to the output.
 *
 * @module core/colors
 */

import {
  colors,
  supportsColor,
  colorize as upstreamColorize,
} from 'olinda_shell_interface.js';

const COLOR_CODES = new Set(
  Object.values(colors).filter((value) => typeof value === 'string' && value.length > 0)
);

function resolveColorCode(color) {
  if (typeof color !== 'string' || color.length === 0) {
    return null;
  }

  if (Object.prototype.hasOwnProperty.call(colors, color)) {
    return colors[color];
  }

  return COLOR_CODES.has(color) ? color : null;
}

/**
 * Apply ANSI color formatting using the local `(text, color)` contract.
 *
 * @param {unknown} text - Text to colorize
 * @param {string} [color] - ANSI color code or color name from `colors`
 * @returns {unknown} Colored text when supported, otherwise the original value
 */
export function colorize(text, color) {
  if (text === null || text === undefined) {
    return text;
  }

  if (text === '') {
    return '';
  }

  const colorCode = resolveColorCode(color);
  if (!colorCode || !supportsColor()) {
    return text;
  }

  return upstreamColorize(colorCode, String(text));
}

export { colors, supportsColor };
