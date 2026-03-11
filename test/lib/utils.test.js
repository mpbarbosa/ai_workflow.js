/**
 * Tests for src/lib/utils.js
 * Smoke and functional tests for all 26 utility re-exports from olinda_shell_interface.js v0.5.9.
 */

import {
  camelCase,
  kebabCase,
  snakeCase,
  pascalCase,
  capitalize,
  truncate,
  sanitize,
  cleanWhitespace,
  escapeRegex,
  dedupe,
  chunk,
  flatten,
  groupBy,
  sortBy,
  intersection,
  difference,
  partition,
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

// ─── String Utilities ────────────────────────────────────────────────────────

describe('camelCase', () => {
  it('is a function', () => expect(typeof camelCase).toBe('function'));
  it('converts kebab-case to camelCase', () => expect(camelCase('foo-bar')).toBe('fooBar'));
  it('converts snake_case to camelCase', () => expect(camelCase('foo_bar')).toBe('fooBar'));
  it('handles already-camel strings', () => expect(camelCase('fooBar')).toBe('fooBar'));
});

describe('kebabCase', () => {
  it('is a function', () => expect(typeof kebabCase).toBe('function'));
  it('converts camelCase to kebab-case', () => expect(kebabCase('fooBar')).toBe('foo-bar'));
  it('converts snake_case to kebab-case', () => expect(kebabCase('foo_bar')).toBe('foo-bar'));
});

describe('snakeCase', () => {
  it('is a function', () => expect(typeof snakeCase).toBe('function'));
  it('converts camelCase to snake_case', () => expect(snakeCase('fooBar')).toBe('foo_bar'));
  it('converts kebab-case to snake_case', () => expect(snakeCase('foo-bar')).toBe('foo_bar'));
});

describe('pascalCase', () => {
  it('is a function', () => expect(typeof pascalCase).toBe('function'));
  it('converts kebab-case to PascalCase', () => expect(pascalCase('foo-bar')).toBe('FooBar'));
  it('converts snake_case to PascalCase', () => expect(pascalCase('foo_bar')).toBe('FooBar'));
});

describe('capitalize', () => {
  it('is a function', () => expect(typeof capitalize).toBe('function'));
  it('capitalizes the first letter', () => expect(capitalize('hello')).toBe('Hello'));
  it('does not change other letters', () => expect(capitalize('hELLO')).toBe('HELLO'));
  it('handles empty string', () => expect(capitalize('')).toBe(''));
});

describe('truncate', () => {
  it('is a function', () => expect(typeof truncate).toBe('function'));
  it('truncates a string longer than maxLength', () => {
    const result = truncate('hello world', 8);
    expect(result.length).toBeLessThanOrEqual(11);
    expect(result).toContain('hello');
  });
  it('returns string unchanged when within limit', () => {
    expect(truncate('hi', 10)).toBe('hi');
  });
});

describe('sanitize', () => {
  it('is a function', () => expect(typeof sanitize).toBe('function'));
  it('returns a string', () => expect(typeof sanitize('hello <world>')).toBe('string'));
});

describe('cleanWhitespace', () => {
  it('is a function', () => expect(typeof cleanWhitespace).toBe('function'));
  it('collapses multiple spaces', () =>
    expect(cleanWhitespace('hello   world')).toBe('hello world'));
  it('trims leading and trailing whitespace', () =>
    expect(cleanWhitespace('  hello  ')).toBe('hello'));
});

describe('escapeRegex', () => {
  it('is a function', () => expect(typeof escapeRegex).toBe('function'));
  it('escapes special regex characters', () => {
    const escaped = escapeRegex('foo.bar(baz)*');
    const regex = new RegExp(escaped);
    expect('foo.bar(baz)*').toMatch(regex);
  });
  it('escapes dots so they do not match any char', () => {
    const escaped = escapeRegex('a.b');
    expect('axb').not.toMatch(new RegExp(`^${escaped}$`));
  });
});

// ─── Array Utilities ─────────────────────────────────────────────────────────

describe('dedupe', () => {
  it('is a function', () => expect(typeof dedupe).toBe('function'));
  it('removes duplicate primitives', () =>
    expect(dedupe([1, 2, 2, 3, 1])).toEqual([1, 2, 3]));
  it('handles empty array', () => expect(dedupe([])).toEqual([]));
});

describe('chunk', () => {
  it('is a function', () => expect(typeof chunk).toBe('function'));
  it('splits array into chunks of given size', () =>
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]));
  it('returns array of arrays', () =>
    expect(Array.isArray(chunk([1, 2, 3], 2)[0])).toBe(true));
});

describe('flatten', () => {
  it('is a function', () => expect(typeof flatten).toBe('function'));
  it('flattens one level by default', () =>
    expect(flatten([[1, 2], [3, 4]])).toEqual([1, 2, 3, 4]));
  it('handles empty array', () => expect(flatten([])).toEqual([]));
});

describe('groupBy', () => {
  it('is a function', () => expect(typeof groupBy).toBe('function'));
  it('groups array elements by key', () => {
    const result = groupBy([{ type: 'a' }, { type: 'b' }, { type: 'a' }], 'type');
    expect(result.a).toHaveLength(2);
    expect(result.b).toHaveLength(1);
  });
});

describe('sortBy', () => {
  it('is a function', () => expect(typeof sortBy).toBe('function'));
  it('sorts array by a key', () => {
    const result = sortBy([{ n: 3 }, { n: 1 }, { n: 2 }], 'n');
    expect(result.map((x) => x.n)).toEqual([1, 2, 3]);
  });
});

describe('intersection', () => {
  it('is a function', () => expect(typeof intersection).toBe('function'));
  it('returns elements present in both arrays', () =>
    expect(intersection([1, 2, 3], [2, 3, 4])).toEqual([2, 3]));
  it('returns empty array for disjoint sets', () =>
    expect(intersection([1, 2], [3, 4])).toEqual([]));
});

describe('difference', () => {
  it('is a function', () => expect(typeof difference).toBe('function'));
  it('returns elements in first array not in second', () =>
    expect(difference([1, 2, 3], [2, 3])).toEqual([1]));
  it('returns empty array when all elements present in second', () =>
    expect(difference([1, 2], [1, 2, 3])).toEqual([]));
});

describe('partition', () => {
  it('is a function', () => expect(typeof partition).toBe('function'));
  it('splits into [matching, not-matching]', () => {
    const [evens, odds] = partition([1, 2, 3, 4], (n) => n % 2 === 0);
    expect(evens).toEqual([2, 4]);
    expect(odds).toEqual([1, 3]);
  });
});

// ─── Object Utilities ─────────────────────────────────────────────────────────

describe('deepClone', () => {
  it('is a function', () => expect(typeof deepClone).toBe('function'));
  it('creates a deep copy', () => {
    const original = { a: { b: 1 } };
    const clone = deepClone(original);
    clone.a.b = 99;
    expect(original.a.b).toBe(1);
  });
  it('returns a new object reference', () => {
    const obj = { x: 1 };
    expect(deepClone(obj)).not.toBe(obj);
  });
});

describe('deepMerge', () => {
  it('is a function', () => expect(typeof deepMerge).toBe('function'));
  it('merges two objects deeply', () => {
    const result = deepMerge({ a: 1, b: { c: 2 } }, { b: { d: 3 }, e: 4 });
    expect(result.a).toBe(1);
    expect(result.b.c).toBe(2);
    expect(result.b.d).toBe(3);
    expect(result.e).toBe(4);
  });
});

describe('pick', () => {
  it('is a function', () => expect(typeof pick).toBe('function'));
  it('returns object with only picked keys', () => {
    expect(pick({ a: 1, b: 2, c: 3 }, ['a', 'c'])).toEqual({ a: 1, c: 3 });
  });
  it('ignores keys not present in the object', () => {
    expect(pick({ a: 1 }, ['a', 'z'])).toEqual({ a: 1 });
  });
});

describe('omit', () => {
  it('is a function', () => expect(typeof omit).toBe('function'));
  it('returns object without omitted keys', () => {
    expect(omit({ a: 1, b: 2, c: 3 }, ['b'])).toEqual({ a: 1, c: 3 });
  });
  it('returns the full object when omitting non-existent keys', () => {
    expect(omit({ a: 1 }, ['z'])).toEqual({ a: 1 });
  });
});

describe('getProperty', () => {
  it('is a function', () => expect(typeof getProperty).toBe('function'));
  it('gets a nested property by dot path', () => {
    expect(getProperty({ a: { b: 42 } }, 'a.b')).toBe(42);
  });
  it('returns undefined for missing path', () => {
    expect(getProperty({ a: 1 }, 'a.b.c')).toBeUndefined();
  });
});

describe('setProperty', () => {
  it('is a function', () => expect(typeof setProperty).toBe('function'));
  it('sets a nested property by dot path', () => {
    const obj = { a: {} };
    const result = setProperty(obj, 'a.b', 99);
    expect(result.a.b).toBe(99);
  });
});

describe('hasProperty', () => {
  it('is a function', () => expect(typeof hasProperty).toBe('function'));
  it('returns true when nested path exists', () => {
    expect(hasProperty({ a: { b: 1 } }, 'a.b')).toBe(true);
  });
  it('returns false when nested path does not exist', () => {
    expect(hasProperty({ a: 1 }, 'a.b.c')).toBe(false);
  });
});

describe('deepEqual', () => {
  it('is a function', () => expect(typeof deepEqual).toBe('function'));
  it('returns true for deeply equal objects', () => {
    expect(deepEqual({ a: { b: 1 } }, { a: { b: 1 } })).toBe(true);
  });
  it('returns false for different objects', () => {
    expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
  });
  it('returns true for equal primitives', () => {
    expect(deepEqual(42, 42)).toBe(true);
  });
});

describe('isEmpty', () => {
  it('is a function', () => expect(typeof isEmpty).toBe('function'));
  it('returns true for null', () => expect(isEmpty(null)).toBe(true));
  it('returns true for undefined', () => expect(isEmpty(undefined)).toBe(true));
  it('returns true for empty string', () => expect(isEmpty('')).toBe(true));
  it('returns true for empty array', () => expect(isEmpty([])).toBe(true));
  it('returns true for empty object', () => expect(isEmpty({})).toBe(true));
  it('returns false for non-empty string', () => expect(isEmpty('hi')).toBe(false));
  it('returns false for non-empty array', () => expect(isEmpty([1])).toBe(false));
  it('returns false for non-empty object', () => expect(isEmpty({ a: 1 })).toBe(false));
});
