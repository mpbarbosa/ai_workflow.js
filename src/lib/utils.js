/**
 * General Utilities Module
 * @module lib/utils
 * @description Re-exports 26 pure utility functions (string, array, object) from
 * olinda_shell_interface.js, which in turn re-exports them from olinda_utils.js v0.3.14+.
 * @see https://github.com/mpbarbosa/olinda_shell_interface.js
 * @see https://github.com/mpbarbosa/olinda_utils.js
 */

// String utilities
export {
  camelCase,
  kebabCase,
  snakeCase,
  pascalCase,
  capitalize,
  truncate,
  sanitize,
  cleanWhitespace,
  escapeRegex,
} from 'olinda_shell_interface.js';

// Array utilities
export {
  dedupe,
  chunk,
  flatten,
  groupBy,
  sortBy,
  intersection,
  difference,
  partition,
} from 'olinda_shell_interface.js';

// Object utilities
export {
  deepClone,
  deepMerge,
  pick,
  omit,
  getProperty,
  setProperty,
  hasProperty,
  deepEqual,
  isEmpty,
} from 'olinda_shell_interface.js';
