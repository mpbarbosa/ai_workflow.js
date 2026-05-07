# Utils Module API Documentation

**Module:** `lib/utils`
**Version:** 2.6.0
**Architecture:** Pure Functions Only

## Overview

The Utils module provides general-purpose utility functions for string manipulation, array operations, object handling, and data validation. All functions are pure (referentially transparent) with no side effects.

**Key Features:**

- ✅ String utilities (trim, capitalize, truncate, format)
- ✅ Array utilities (unique, flatten, chunk, group)
- ✅ Object utilities (deep clone, merge, pick, omit)
- ✅ Validation utilities (is empty, is valid, type checks)
- ✅ Path utilities (normalize, join, resolve)
- ✅ 100% pure functions (no side effects)
- ✅ Immutable transformations

## Architecture

```
┌────────────────────────────────────┐
│  Pure Utility Functions Only       │
│  - No state                        │
│  - No I/O operations               │
│  - No side effects                 │
│  - Fully deterministic             │
└────────────────────────────────────┘
```

## String Utilities

### `trim(str)`

Remove leading and trailing whitespace.

### `capitalize(str)`

Capitalize first letter of string.

### `truncate(str, maxLength, suffix = '...')`

Truncate string to maximum length with optional suffix.

### `formatList(items, conjunction = 'and')`

Format array as human-readable list (e.g., "a, b, and c").

## Array Utilities

### `unique(array)`

Return array with duplicate elements removed.

### `flatten(array, depth = 1)`

Flatten nested arrays to specified depth.

### `chunk(array, size)`

Split array into chunks of specified size.

### `groupBy(array, keyFn)`

Group array elements by key function result.

## Object Utilities

### `deepClone(obj)`

Create deep copy of object (immutable clone).

### `merge(target, ...sources)`

Merge multiple objects immutably.

### `pick(obj, keys)`

Create new object with only specified keys.

### `omit(obj, keys)`

Create new object without specified keys.

## Validation Utilities

### `isEmpty(value)`

Check if value is empty (null, undefined, '', [], {}).

### `isValidEmail(email)`

Validate email format.

### `isValidUrl(url)`

Validate URL format.

### `hasProperty(obj, path)`

Check if object has nested property at path.

## Path Utilities

### `normalizePath(path)`

Normalize file path (cross-platform).

### `joinPaths(...parts)`

Join path components safely.

### `resolvePath(basePath, relativePath)`

Resolve relative path against base path.

## Usage Examples

```javascript
import {
  trim,
  capitalize,
  truncate,
  unique,
  flatten,
  deepClone,
  merge,
  isEmpty,
  normalizePath,
} from './lib/utils.js';

// String utilities
const name = trim('  John Doe  '); // 'John Doe'
const title = capitalize('hello world'); // 'Hello world'
const short = truncate('Long text here', 10); // 'Long te...'

// Array utilities
const nums = unique([1, 2, 2, 3, 1]); // [1, 2, 3]
const flat = flatten([
  [1, 2],
  [3, 4],
]); // [1, 2, 3, 4]

// Object utilities
const obj = { a: 1, b: { c: 2 } };
const copy = deepClone(obj); // Deep immutable copy
const merged = merge({ a: 1 }, { b: 2 }); // { a: 1, b: 2 }

// Validation
isEmpty(null); // true
isEmpty([]); // true
isEmpty({ a: 1 }); // false

// Path utilities
const path = normalizePath('docs/api/lib'); // Cross-platform normalized
```

## Properties

- ✅ **Pure functions**: No side effects, deterministic
- ✅ **Immutable**: Original data never modified
- ✅ **Composable**: Functions can be freely combined
- ✅ **Type-safe**: Input validation with meaningful errors
- ✅ **Cross-platform**: Works on Linux, macOS, Windows

## Related Modules

- [file_operations](./file_operations.md) - File system operations
- [edit_operations](./edit_operations.md) - File editing utilities
- [argument_parser](./argument_parser.md) - CLI argument parsing

## See Also

- Source: `src/lib/utils.js` (551 LOC)
- Tests: `test/lib/utils.test.js` (354 tests)
- Architecture: [Pure Functions](../../architecture/DESIGN_PRINCIPLES.md)
