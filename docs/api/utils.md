# utils - General Utilities Module

**Module:** `lib/utils`  
**Version:** 1.0.0  
**Type:** Pure Functions Only

## Overview

Pure utility functions for strings, arrays, objects, and dates. All functions are referentially transparent.

---

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
