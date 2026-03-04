# utils - General Utilities Module

> **Moved to `olinda_utils.js`**
> As of ai_workflow.js v1.3.0, the utility functions previously in `src/lib/utils.js` have been moved to the [`olinda_utils.js`](https://github.com/mpbarbosa/olinda_utils.js) package (v0.3.0+).

## Import

```javascript
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
} from 'olinda_utils.js';
```

## Full API Reference

See [`olinda_utils.js` — utils.md](https://github.com/mpbarbosa/olinda_utils.js/blob/main/docs/utils.md) for the complete API documentation.

---

## Overview (archived)

26 pure utility functions in 3 groups:

- **String utilities (9):** `camelCase`, `kebabCase`, `snakeCase`, `pascalCase`, `capitalize`, `truncate`, `sanitize`, `cleanWhitespace`, `escapeRegex`
- **Array utilities (8):** `dedupe`, `chunk`, `flatten`, `groupBy`, `sortBy`, `intersection`, `difference`, `partition`
- **Object utilities (9):** `deepClone`, `deepMerge`, `pick`, `omit`, `getProperty`, `setProperty`, `hasProperty`, `deepEqual`, `isEmpty`

---

**Last Updated:** 2026-02-01
**Part of:** AI Workflow Automation v1.3.0

<!-- ARCHIVED CONTENT BELOW -- kept for historical reference -->

## String Utilities

### `camelCase(str)`, `kebabCase(str)`, `snakeCase(str)`, `pascalCase(str)`

Convert string to different cases.

**Example:**

```javascript
camelCase('foo-bar'); // 'fooBar'
kebabCase('fooBar'); // 'foo-bar'
snakeCase('fooBar'); // 'foo_bar'
pascalCase('foo-bar'); // 'FooBar'
```

### `capitalize(str)`

Capitalize first letter.

### `truncate(str, length, suffix)`

Truncate string to length.

**Example:**

```javascript
truncate('Long text here', 10); // 'Long text...'
```

---

## Array Utilities

### `unique(array)`

Remove duplicates.

### `chunk(array, size)`

Split array into chunks.

**Example:**

```javascript
chunk([1, 2, 3, 4, 5], 2); // [[1,2], [3,4], [5]]
```

### `flatten(array, depth)`

Flatten nested arrays.

### `groupBy(array, key)`

Group by property.

---

## Object Utilities

### `deepClone(obj)`

Deep clone object.

### `deepMerge(obj1, obj2)`

Deep merge objects.

### `pick(obj, keys)`

Pick specific keys.

### `omit(obj, keys)`

Omit specific keys.

**Example:**

```javascript
pick({ a: 1, b: 2, c: 3 }, ['a', 'c']); // {a:1, c:3}
omit({ a: 1, b: 2, c: 3 }, ['b']); // {a:1, c:3}
```

---

## Date Utilities

### `formatDate(date, format)`

Format date string.

### `parseDate(str)`

Parse date string.

### `addDays(date, days)`

Add days to date.

---

## Usage Examples

### String Manipulation

```javascript
import { camelCase, truncate } from './lib/utils.js';

const varName = camelCase('my-variable-name'); // 'myVariableName'
const short = truncate('Very long description', 20); // 'Very long descripti...'
```

### Array Operations

```javascript
import { chunk, unique } from './lib/utils.js';

const batches = chunk([1, 2, 3, 4, 5, 6], 3); // [[1,2,3], [4,5,6]]
const deduped = unique([1, 2, 2, 3, 3, 3]); // [1,2,3]
```

### Object Operations

```javascript
import { pick, deepMerge } from './lib/utils.js';

const subset = pick(largeObj, ['id', 'name']);
const merged = deepMerge(defaults, userConfig);
```

---

**Last Updated:** 2026-02-01
**Part of:** AI Workflow Automation v1.0.0
