/**
 * Tests for Utility Functions Module
 * @version 1.0.0
 * Part of: AI Workflow Automation v1.1.0
 */

import { describe, test, expect } from '@jest/globals';
import {
  // String utilities
  camelCase,
  kebabCase,
  snakeCase,
  pascalCase,
  capitalize,
  truncate,
  sanitize,
  cleanWhitespace,
  escapeRegex,
  // Array utilities
  dedupe,
  chunk,
  flatten,
  groupBy,
  sortBy,
  intersection,
  difference,
  partition,
  // Object utilities
  deepClone,
  deepMerge,
  pick,
  omit,
  getProperty,
  setProperty,
  hasProperty,
  deepEqual,
  isEmpty,
} from '../../src/lib/utils.js';

/**
 * STRING UTILITIES TESTS
 */

describe('String Utilities - camelCase', () => {
  test('converts kebab-case to camelCase', () => {
    expect(camelCase('hello-world')).toBe('helloWorld');
  });

  test('converts snake_case to camelCase', () => {
    expect(camelCase('hello_world')).toBe('helloWorld');
  });

  test('converts spaces to camelCase', () => {
    expect(camelCase('hello world')).toBe('helloWorld');
  });

  test('handles PascalCase input', () => {
    expect(camelCase('HelloWorld')).toBe('helloWorld');
  });

  test('handles invalid input', () => {
    expect(camelCase(null)).toBe('');
    expect(camelCase(123)).toBe('');
  });
});

describe('String Utilities - kebabCase', () => {
  test('converts camelCase to kebab-case', () => {
    expect(kebabCase('helloWorld')).toBe('hello-world');
  });

  test('converts snake_case to kebab-case', () => {
    expect(kebabCase('hello_world')).toBe('hello-world');
  });

  test('converts spaces to kebab-case', () => {
    expect(kebabCase('hello world')).toBe('hello-world');
  });

  test('removes special characters', () => {
    expect(kebabCase('hello@world!')).toBe('helloworld');
  });

  test('handles invalid input', () => {
    expect(kebabCase(null)).toBe('');
  });
});

describe('String Utilities - snakeCase', () => {
  test('converts camelCase to snake_case', () => {
    expect(snakeCase('helloWorld')).toBe('hello_world');
  });

  test('converts kebab-case to snake_case', () => {
    expect(snakeCase('hello-world')).toBe('hello_world');
  });

  test('converts spaces to snake_case', () => {
    expect(snakeCase('hello world')).toBe('hello_world');
  });

  test('removes special characters', () => {
    expect(snakeCase('hello@world!')).toBe('helloworld');
  });

  test('handles invalid input', () => {
    expect(snakeCase(null)).toBe('');
  });
});

describe('String Utilities - pascalCase', () => {
  test('converts camelCase to PascalCase', () => {
    expect(pascalCase('helloWorld')).toBe('HelloWorld');
  });

  test('converts kebab-case to PascalCase', () => {
    expect(pascalCase('hello-world')).toBe('HelloWorld');
  });

  test('converts snake_case to PascalCase', () => {
    expect(pascalCase('hello_world')).toBe('HelloWorld');
  });

  test('handles invalid input', () => {
    expect(pascalCase(null)).toBe('');
  });
});

describe('String Utilities - capitalize', () => {
  test('capitalizes first letter', () => {
    expect(capitalize('hello')).toBe('Hello');
  });

  test('handles already capitalized', () => {
    expect(capitalize('Hello')).toBe('Hello');
  });

  test('handles empty string', () => {
    expect(capitalize('')).toBe('');
  });

  test('handles invalid input', () => {
    expect(capitalize(null)).toBe('');
  });
});

describe('String Utilities - truncate', () => {
  test('truncates long strings', () => {
    expect(truncate('hello world', 8)).toBe('hello...');
  });

  test('does not truncate short strings', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  test('uses custom suffix', () => {
    expect(truncate('hello world', 8, '…')).toBe('hello w…');
  });

  test('handles exact length', () => {
    expect(truncate('hello', 5)).toBe('hello');
  });
});

describe('String Utilities - sanitize', () => {
  test('removes special characters', () => {
    expect(sanitize('hello@world!')).toBe('helloworld');
  });

  test('allows specified characters', () => {
    expect(sanitize('hello-world_test', '-_')).toBe('hello-world_test');
  });

  test('handles alphanumeric only', () => {
    expect(sanitize('abc123XYZ', '')).toBe('abc123XYZ');
  });

  test('handles invalid input', () => {
    expect(sanitize(null)).toBe('');
  });
});

describe('String Utilities - cleanWhitespace', () => {
  test('removes extra spaces', () => {
    expect(cleanWhitespace('hello    world')).toBe('hello world');
  });

  test('trims leading and trailing spaces', () => {
    expect(cleanWhitespace('  hello world  ')).toBe('hello world');
  });

  test('handles tabs and newlines', () => {
    expect(cleanWhitespace('hello\t\nworld')).toBe('hello world');
  });

  test('handles invalid input', () => {
    expect(cleanWhitespace(null)).toBe('');
  });
});

describe('String Utilities - escapeRegex', () => {
  test('escapes regex special characters', () => {
    expect(escapeRegex('hello.world')).toBe('hello\\.world');
  });

  test('escapes multiple special characters', () => {
    expect(escapeRegex('a*b+c?')).toBe('a\\*b\\+c\\?');
  });

  test('handles parentheses and brackets', () => {
    expect(escapeRegex('(test)[value]')).toBe('\\(test\\)\\[value\\]');
  });

  test('handles invalid input', () => {
    expect(escapeRegex(null)).toBe('');
  });
});

/**
 * ARRAY UTILITIES TESTS
 */

describe('Array Utilities - dedupe', () => {
  test('removes duplicate values', () => {
    expect(dedupe([1, 2, 2, 3, 3, 3])).toEqual([1, 2, 3]);
  });

  test('handles strings', () => {
    expect(dedupe(['a', 'b', 'a', 'c'])).toEqual(['a', 'b', 'c']);
  });

  test('handles empty array', () => {
    expect(dedupe([])).toEqual([]);
  });

  test('handles invalid input', () => {
    expect(dedupe(null)).toEqual([]);
  });
});

describe('Array Utilities - chunk', () => {
  test('chunks array into specified size', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  test('handles exact division', () => {
    expect(chunk([1, 2, 3, 4], 2)).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  test('handles chunk size larger than array', () => {
    expect(chunk([1, 2], 5)).toEqual([[1, 2]]);
  });

  test('handles invalid input', () => {
    expect(chunk(null, 2)).toEqual([]);
    expect(chunk([1, 2], 0)).toEqual([]);
  });
});

describe('Array Utilities - flatten', () => {
  test('flattens nested array', () => {
    expect(flatten([1, [2, [3, 4]]])).toEqual([1, 2, 3, 4]);
  });

  test('flattens with depth limit', () => {
    expect(flatten([1, [2, [3, 4]]], 1)).toEqual([1, 2, [3, 4]]);
  });

  test('handles already flat array', () => {
    expect(flatten([1, 2, 3])).toEqual([1, 2, 3]);
  });

  test('handles invalid input', () => {
    expect(flatten(null)).toEqual([]);
  });
});

describe('Array Utilities - groupBy', () => {
  test('groups by key', () => {
    const items = [
      { type: 'a', value: 1 },
      { type: 'b', value: 2 },
      { type: 'a', value: 3 },
    ];
    expect(groupBy(items, 'type')).toEqual({
      a: [
        { type: 'a', value: 1 },
        { type: 'a', value: 3 },
      ],
      b: [{ type: 'b', value: 2 }],
    });
  });

  test('groups by function', () => {
    const items = [1, 2, 3, 4, 5, 6];
    expect(groupBy(items, (n) => (n % 2 === 0 ? 'even' : 'odd'))).toEqual({
      odd: [1, 3, 5],
      even: [2, 4, 6],
    });
  });

  test('handles invalid input', () => {
    expect(groupBy(null, 'key')).toEqual({});
  });
});

describe('Array Utilities - sortBy', () => {
  test('sorts by key ascending', () => {
    const items = [{ age: 30 }, { age: 20 }, { age: 25 }];
    expect(sortBy(items, 'age')).toEqual([{ age: 20 }, { age: 25 }, { age: 30 }]);
  });

  test('sorts by key descending', () => {
    const items = [{ age: 20 }, { age: 30 }, { age: 25 }];
    expect(sortBy(items, 'age', 'desc')).toEqual([{ age: 30 }, { age: 25 }, { age: 20 }]);
  });

  test('sorts by function', () => {
    const items = ['aaa', 'bb', 'c'];
    expect(sortBy(items, (s) => s.length)).toEqual(['c', 'bb', 'aaa']);
  });

  test('does not mutate original array', () => {
    const items = [3, 1, 2];
    const sorted = sortBy(items, (n) => n);
    expect(items).toEqual([3, 1, 2]);
    expect(sorted).toEqual([1, 2, 3]);
  });

  test('handles invalid input', () => {
    expect(sortBy(null, 'key')).toEqual([]);
  });
});

describe('Array Utilities - intersection', () => {
  test('finds common elements', () => {
    expect(intersection([1, 2, 3], [2, 3, 4], [3, 4, 5])).toEqual([3]);
  });

  test('handles two arrays', () => {
    expect(intersection([1, 2, 3], [2, 3, 4])).toEqual([2, 3]);
  });

  test('handles no common elements', () => {
    expect(intersection([1, 2], [3, 4])).toEqual([]);
  });

  test('handles invalid input', () => {
    expect(intersection()).toEqual([]);
  });
});

describe('Array Utilities - difference', () => {
  test('finds elements in first but not second', () => {
    expect(difference([1, 2, 3], [2, 3, 4])).toEqual([1]);
  });

  test('handles no differences', () => {
    expect(difference([1, 2], [1, 2, 3])).toEqual([]);
  });

  test('handles completely different arrays', () => {
    expect(difference([1, 2], [3, 4])).toEqual([1, 2]);
  });

  test('handles invalid input', () => {
    expect(difference(null, [1, 2])).toEqual([]);
  });
});

describe('Array Utilities - partition', () => {
  test('partitions by predicate', () => {
    const [evens, odds] = partition([1, 2, 3, 4, 5], (n) => n % 2 === 0);
    expect(evens).toEqual([2, 4]);
    expect(odds).toEqual([1, 3, 5]);
  });

  test('handles all true', () => {
    const [truthy, falsy] = partition([2, 4, 6], (n) => n % 2 === 0);
    expect(truthy).toEqual([2, 4, 6]);
    expect(falsy).toEqual([]);
  });

  test('handles all false', () => {
    const [truthy, falsy] = partition([1, 3, 5], (n) => n % 2 === 0);
    expect(truthy).toEqual([]);
    expect(falsy).toEqual([1, 3, 5]);
  });

  test('handles invalid input', () => {
    expect(partition(null, () => true)).toEqual([[], []]);
  });
});

/**
 * OBJECT UTILITIES TESTS
 */

describe('Object Utilities - deepClone', () => {
  test('clones simple object', () => {
    const obj = { a: 1, b: 2 };
    const clone = deepClone(obj);
    expect(clone).toEqual(obj);
    expect(clone).not.toBe(obj);
  });

  test('clones nested object', () => {
    const obj = { a: { b: { c: 1 } } };
    const clone = deepClone(obj);
    expect(clone).toEqual(obj);
    expect(clone.a).not.toBe(obj.a);
  });

  test('clones arrays', () => {
    const arr = [1, [2, [3]]];
    const clone = deepClone(arr);
    expect(clone).toEqual(arr);
    expect(clone).not.toBe(arr);
  });

  test('clones dates', () => {
    const date = new Date('2026-01-30');
    const clone = deepClone(date);
    expect(clone).toEqual(date);
    expect(clone).not.toBe(date);
  });

  test('handles null and primitives', () => {
    expect(deepClone(null)).toBe(null);
    expect(deepClone(42)).toBe(42);
    expect(deepClone('test')).toBe('test');
  });
});

describe('Object Utilities - deepMerge', () => {
  test('merges simple objects', () => {
    expect(deepMerge({ a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 });
  });

  test('merges nested objects', () => {
    expect(deepMerge({ a: { b: 1 } }, { a: { c: 2 } })).toEqual({ a: { b: 1, c: 2 } });
  });

  test('overwrites primitive values', () => {
    expect(deepMerge({ a: 1 }, { a: 2 })).toEqual({ a: 2 });
  });

  test('does not mutate original', () => {
    const obj1 = { a: 1 };
    const result = deepMerge(obj1, { b: 2 });
    expect(obj1).toEqual({ a: 1 });
    expect(result).toEqual({ a: 1, b: 2 });
  });

  test('merges multiple objects', () => {
    expect(deepMerge({ a: 1 }, { b: 2 }, { c: 3 })).toEqual({ a: 1, b: 2, c: 3 });
  });
});

describe('Object Utilities - pick', () => {
  test('picks specified keys', () => {
    const obj = { a: 1, b: 2, c: 3 };
    expect(pick(obj, ['a', 'c'])).toEqual({ a: 1, c: 3 });
  });

  test('ignores non-existent keys', () => {
    const obj = { a: 1, b: 2 };
    expect(pick(obj, ['a', 'z'])).toEqual({ a: 1 });
  });

  test('handles empty keys', () => {
    expect(pick({ a: 1 }, [])).toEqual({});
  });

  test('handles invalid input', () => {
    expect(pick(null, ['a'])).toEqual({});
  });
});

describe('Object Utilities - omit', () => {
  test('omits specified keys', () => {
    const obj = { a: 1, b: 2, c: 3 };
    expect(omit(obj, ['b'])).toEqual({ a: 1, c: 3 });
  });

  test('ignores non-existent keys', () => {
    const obj = { a: 1, b: 2 };
    expect(omit(obj, ['z'])).toEqual({ a: 1, b: 2 });
  });

  test('handles empty keys', () => {
    const obj = { a: 1, b: 2 };
    expect(omit(obj, [])).toEqual(obj);
  });

  test('handles invalid input', () => {
    expect(omit(null, ['a'])).toEqual({});
  });
});

describe('Object Utilities - getProperty', () => {
  const obj = { user: { profile: { name: 'John' } } };

  test('gets nested property', () => {
    expect(getProperty(obj, 'user.profile.name')).toBe('John');
  });

  test('returns default for non-existent path', () => {
    expect(getProperty(obj, 'user.missing', 'default')).toBe('default');
  });

  test('handles shallow property', () => {
    expect(getProperty(obj, 'user')).toEqual({ profile: { name: 'John' } });
  });

  test('handles invalid input', () => {
    expect(getProperty(null, 'path', 'default')).toBe('default');
  });
});

describe('Object Utilities - setProperty', () => {
  test('sets nested property', () => {
    const obj = { user: { name: 'John' } };
    const result = setProperty(obj, 'user.age', 30);
    expect(result).toEqual({ user: { name: 'John', age: 30 } });
  });

  test('creates missing nested structure', () => {
    const obj = {};
    const result = setProperty(obj, 'a.b.c', 'value');
    expect(result).toEqual({ a: { b: { c: 'value' } } });
  });

  test('does not mutate original', () => {
    const obj = { a: 1 };
    const result = setProperty(obj, 'b', 2);
    expect(obj).toEqual({ a: 1 });
    expect(result).toEqual({ a: 1, b: 2 });
  });

  test('handles invalid input', () => {
    expect(setProperty(null, 'path', 'value')).toBe(null);
  });
});

describe('Object Utilities - hasProperty', () => {
  const obj = { user: { profile: { name: 'John' } } };

  test('returns true for existing path', () => {
    expect(hasProperty(obj, 'user.profile.name')).toBe(true);
  });

  test('returns false for non-existent path', () => {
    expect(hasProperty(obj, 'user.missing')).toBe(false);
  });

  test('handles shallow property', () => {
    expect(hasProperty(obj, 'user')).toBe(true);
  });

  test('handles invalid input', () => {
    expect(hasProperty(null, 'path')).toBe(false);
  });
});

describe('Object Utilities - deepEqual', () => {
  test('compares primitive values', () => {
    expect(deepEqual(1, 1)).toBe(true);
    expect(deepEqual(1, 2)).toBe(false);
    expect(deepEqual('test', 'test')).toBe(true);
  });

  test('compares objects', () => {
    expect(deepEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
    expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
  });

  test('compares nested objects', () => {
    expect(deepEqual({ a: { b: 1 } }, { a: { b: 1 } })).toBe(true);
    expect(deepEqual({ a: { b: 1 } }, { a: { b: 2 } })).toBe(false);
  });

  test('compares arrays', () => {
    expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
  });

  test('compares dates', () => {
    const date1 = new Date('2026-01-30');
    const date2 = new Date('2026-01-30');
    const date3 = new Date('2026-01-31');
    expect(deepEqual(date1, date2)).toBe(true);
    expect(deepEqual(date1, date3)).toBe(false);
  });

  test('handles null and undefined', () => {
    expect(deepEqual(null, null)).toBe(true);
    expect(deepEqual(null, undefined)).toBe(false);
  });
});

describe('Object Utilities - isEmpty', () => {
  test('detects empty values', () => {
    expect(isEmpty(null)).toBe(true);
    expect(isEmpty(undefined)).toBe(true);
    expect(isEmpty('')).toBe(true);
    expect(isEmpty('   ')).toBe(true);
    expect(isEmpty([])).toBe(true);
    expect(isEmpty({})).toBe(true);
  });

  test('detects non-empty values', () => {
    expect(isEmpty('test')).toBe(false);
    expect(isEmpty([1])).toBe(false);
    expect(isEmpty({ a: 1 })).toBe(false);
    expect(isEmpty(0)).toBe(false);
    expect(isEmpty(false)).toBe(false);
  });
});
