/**
 * General Utility Functions Module (Pure Functions Only)
 * @version 1.0.0
 * @description Pure utility functions for strings, arrays, and objects
 * @module lib/utils
 * Part of: AI Workflow Automation v1.1.0
 */

/**
 * STRING UTILITIES - All pure functions
 */

/**
 * Convert string to camelCase
 * @param {string} str - String to convert
 * @returns {string} camelCase string
 */
export function camelCase(str) {
  if (typeof str !== 'string') {
    return '';
  }

  return str
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase())
    .replace(/^[A-Z]/, (char) => char.toLowerCase());
}

/**
 * Convert string to kebab-case
 * @param {string} str - String to convert
 * @returns {string} kebab-case string
 */
export function kebabCase(str) {
  if (typeof str !== 'string') {
    return '';
  }

  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '')
    .toLowerCase();
}

/**
 * Convert string to snake_case
 * @param {string} str - String to convert
 * @returns {string} snake_case string
 */
export function snakeCase(str) {
  if (typeof str !== 'string') {
    return '';
  }

  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .toLowerCase();
}

/**
 * Convert string to PascalCase
 * @param {string} str - String to convert
 * @returns {string} PascalCase string
 */
export function pascalCase(str) {
  if (typeof str !== 'string') {
    return '';
  }

  return str
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase())
    .replace(/^[a-z]/, (char) => char.toUpperCase());
}

/**
 * Capitalize first letter of string
 * @param {string} str - String to capitalize
 * @returns {string} Capitalized string
 */
export function capitalize(str) {
  if (typeof str !== 'string' || str.length === 0) {
    return '';
  }

  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Truncate string to specified length
 * @param {string} str - String to truncate
 * @param {number} length - Maximum length
 * @param {string} suffix - Suffix to add (default: '...')
 * @returns {string} Truncated string
 */
export function truncate(str, length, suffix = '...') {
  if (typeof str !== 'string' || str.length <= length) {
    return str;
  }

  return str.slice(0, length - suffix.length) + suffix;
}

/**
 * Sanitize string for safe usage (alphanumeric + basic chars)
 * @param {string} str - String to sanitize
 * @param {string} allowed - Additional allowed characters
 * @returns {string} Sanitized string
 */
export function sanitize(str, allowed = '-_') {
  if (typeof str !== 'string') {
    return '';
  }

  const pattern = new RegExp(`[^a-zA-Z0-9${allowed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]`, 'g');
  return str.replace(pattern, '');
}

/**
 * Remove extra whitespace and trim
 * @param {string} str - String to clean
 * @returns {string} Cleaned string
 */
export function cleanWhitespace(str) {
  if (typeof str !== 'string') {
    return '';
  }

  return str.replace(/\s+/g, ' ').trim();
}

/**
 * Escape special characters for regex
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
export function escapeRegex(str) {
  if (typeof str !== 'string') {
    return '';
  }

  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * ARRAY UTILITIES - All pure functions
 */

/**
 * Remove duplicate values from array
 * @param {Array} arr - Array to deduplicate
 * @returns {Array} Array without duplicates
 */
export function dedupe(arr) {
  if (!Array.isArray(arr)) {
    return [];
  }

  return [...new Set(arr)];
}

/**
 * Chunk array into smaller arrays of specified size
 * @param {Array} arr - Array to chunk
 * @param {number} size - Chunk size
 * @returns {Array<Array>} Array of chunks
 */
export function chunk(arr, size) {
  if (!Array.isArray(arr) || size < 1) {
    return [];
  }

  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }

  return chunks;
}

/**
 * Flatten nested array
 * @param {Array} arr - Array to flatten
 * @param {number} depth - Depth to flatten (default: Infinity)
 * @returns {Array} Flattened array
 */
export function flatten(arr, depth = Infinity) {
  if (!Array.isArray(arr)) {
    return [];
  }

  if (depth === 0) {
    return arr;
  }

  return arr.reduce((flat, item) => {
    if (Array.isArray(item)) {
      return flat.concat(flatten(item, depth - 1));
    }
    return flat.concat(item);
  }, []);
}

/**
 * Group array items by key or function
 * @param {Array} arr - Array to group
 * @param {string|Function} keyOrFn - Key name or grouping function
 * @returns {Object} Grouped object
 */
export function groupBy(arr, keyOrFn) {
  if (!Array.isArray(arr)) {
    return {};
  }

  const fn = typeof keyOrFn === 'function' ? keyOrFn : (item) => item[keyOrFn];

  return arr.reduce((groups, item) => {
    const key = fn(item);
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
    return groups;
  }, {});
}

/**
 * Sort array by key or function
 * @param {Array} arr - Array to sort
 * @param {string|Function} keyOrFn - Key name or comparison function
 * @param {string} order - 'asc' or 'desc'
 * @returns {Array} Sorted array
 */
export function sortBy(arr, keyOrFn, order = 'asc') {
  if (!Array.isArray(arr)) {
    return [];
  }

  const fn = typeof keyOrFn === 'function' ? keyOrFn : (item) => item[keyOrFn];
  const sorted = [...arr].sort((a, b) => {
    const valA = fn(a);
    const valB = fn(b);

    if (valA < valB) return order === 'asc' ? -1 : 1;
    if (valA > valB) return order === 'asc' ? 1 : -1;
    return 0;
  });

  return sorted;
}

/**
 * Find intersection of multiple arrays
 * @param {...Array} arrays - Arrays to intersect
 * @returns {Array} Intersection of all arrays
 */
export function intersection(...arrays) {
  if (arrays.length === 0 || !arrays.every(Array.isArray)) {
    return [];
  }

  const [first, ...rest] = arrays;
  return first.filter((item) => rest.every((arr) => arr.includes(item)));
}

/**
 * Find difference between two arrays (items in first but not in second)
 * @param {Array} arr1 - First array
 * @param {Array} arr2 - Second array
 * @returns {Array} Difference
 */
export function difference(arr1, arr2) {
  if (!Array.isArray(arr1) || !Array.isArray(arr2)) {
    return [];
  }

  return arr1.filter((item) => !arr2.includes(item));
}

/**
 * Partition array into two arrays based on predicate
 * @param {Array} arr - Array to partition
 * @param {Function} predicate - Function to test each element
 * @returns {Array<Array>} Two arrays: [truthy, falsy]
 */
export function partition(arr, predicate) {
  if (!Array.isArray(arr) || typeof predicate !== 'function') {
    return [[], []];
  }

  return arr.reduce(
    ([truthy, falsy], item) => {
      if (predicate(item)) {
        truthy.push(item);
      } else {
        falsy.push(item);
      }
      return [truthy, falsy];
    },
    [[], []]
  );
}

/**
 * OBJECT UTILITIES - All pure functions
 */

/**
 * Deep clone an object
 * @param {*} obj - Object to clone
 * @returns {*} Cloned object
 */
export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime());
  }

  if (obj instanceof Array) {
    return obj.map((item) => deepClone(item));
  }

  if (obj instanceof Object) {
    const cloned = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        cloned[key] = deepClone(obj[key]);
      }
    }
    return cloned;
  }

  return obj;
}

/**
 * Deep merge objects
 * @param {Object} target - Target object
 * @param {...Object} sources - Source objects
 * @returns {Object} Merged object
 */
export function deepMerge(target, ...sources) {
  if (!sources.length) {
    return target;
  }

  const result = deepClone(target);

  for (const source of sources) {
    if (source && typeof source === 'object' && !Array.isArray(source)) {
      for (const key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
          if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            result[key] = deepMerge(result[key] || {}, source[key]);
          } else {
            result[key] = deepClone(source[key]);
          }
        }
      }
    }
  }

  return result;
}

/**
 * Pick specified keys from object
 * @param {Object} obj - Source object
 * @param {Array<string>} keys - Keys to pick
 * @returns {Object} New object with picked keys
 */
export function pick(obj, keys) {
  if (!obj || typeof obj !== 'object' || !Array.isArray(keys)) {
    return {};
  }

  return keys.reduce((result, key) => {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      result[key] = obj[key];
    }
    return result;
  }, {});
}

/**
 * Omit specified keys from object
 * @param {Object} obj - Source object
 * @param {Array<string>} keys - Keys to omit
 * @returns {Object} New object without omitted keys
 */
export function omit(obj, keys) {
  if (!obj || typeof obj !== 'object' || !Array.isArray(keys)) {
    return {};
  }

  const result = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key) && !keys.includes(key)) {
      result[key] = obj[key];
    }
  }

  return result;
}

/**
 * Get nested property value using dot notation
 * @param {Object} obj - Source object
 * @param {string} path - Dot-separated path (e.g., 'user.address.city')
 * @param {*} defaultValue - Default value if path doesn't exist
 * @returns {*} Value at path or default value
 */
export function getProperty(obj, path, defaultValue = undefined) {
  if (!obj || typeof obj !== 'object' || typeof path !== 'string') {
    return defaultValue;
  }

  const keys = path.split('.');
  let result = obj;

  for (const key of keys) {
    if (result && typeof result === 'object' && key in result) {
      result = result[key];
    } else {
      return defaultValue;
    }
  }

  return result;
}

/**
 * Set nested property value using dot notation
 * @param {Object} obj - Source object
 * @param {string} path - Dot-separated path
 * @param {*} value - Value to set
 * @returns {Object} New object with property set
 */
export function setProperty(obj, path, value) {
  if (!obj || typeof obj !== 'object' || typeof path !== 'string') {
    return obj;
  }

  const result = deepClone(obj);
  const keys = path.split('.');
  let current = result;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current) || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key];
  }

  current[keys[keys.length - 1]] = value;
  return result;
}

/**
 * Check if object has nested property
 * @param {Object} obj - Source object
 * @param {string} path - Dot-separated path
 * @returns {boolean} True if property exists
 */
export function hasProperty(obj, path) {
  if (!obj || typeof obj !== 'object' || typeof path !== 'string') {
    return false;
  }

  const keys = path.split('.');
  let current = obj;

  for (const key of keys) {
    if (!current || typeof current !== 'object' || !(key in current)) {
      return false;
    }
    current = current[key];
  }

  return true;
}

/**
 * Check if two values are deeply equal
 * @param {*} a - First value
 * @param {*} b - Second value
 * @returns {boolean} True if deeply equal
 */
export function deepEqual(a, b) {
  if (a === b) {
    return true;
  }

  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
    return false;
  }

  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false;
    }
    return a.every((item, index) => deepEqual(item, b[index]));
  }

  if (Array.isArray(a) || Array.isArray(b)) {
    return false;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) {
    return false;
  }

  return keysA.every((key) => keysB.includes(key) && deepEqual(a[key], b[key]));
}

/**
 * Check if value is empty (null, undefined, empty string, array, or object)
 * @param {*} value - Value to check
 * @returns {boolean} True if empty
 */
export function isEmpty(value) {
  if (value === null || value === undefined) {
    return true;
  }

  if (typeof value === 'string') {
    return value.trim().length === 0;
  }

  if (Array.isArray(value)) {
    return value.length === 0;
  }

  if (typeof value === 'object') {
    return Object.keys(value).length === 0;
  }

  return false;
}
