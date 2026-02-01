# edit_operations - File Editing Module

**Module:** `lib/edit_operations`  
**Version:** 2.0.0  
**Type:** Pure Functions + Wrapper

## Overview

File content editing utilities with referential transparency. Provides find, replace, insert, and extraction operations.

---

## Pure Functions

### `findMatches(text, pattern)`

Find all pattern matches in text.

**Returns:** Array of `{match, index, line, lineContent}`

**Example:**

```javascript
const matches = findMatches('Hello\nWorld\n', /o/g);
// [{match: 'o', index: 4, line: 1, lineContent: 'Hello'}, ...]
```

### `replaceAll(text, pattern, replacement)`

Replace all occurrences.

### `replaceFirst(text, pattern, replacement)`

Replace first occurrence.

### `insertAtLine(text, lineNumber, content, position)`

Insert at specific line.

**Parameters:**

- `position`: 'before' or 'after' (default: 'after')

**Example:**

```javascript
const updated = insertAtLine('Line1\nLine2', 1, 'NewLine', 'after');
// 'Line1\nNewLine\nLine2'
```

### `deleteLines(text, startLine, endLine)`

Delete line range.

### `extractLines(text, startLine, endLine)`

Extract line range.

---

## EditOperations Class

Wrapper for file editing with persistence.

**Methods:**

- `findInFile(filePath, pattern)` - Find in file
- `replaceInFile(filePath, pattern, replacement)` - Replace in file
- `insertAtLine(filePath, lineNum, content)` - Insert line
- `deleteLines(filePath, start, end)` - Delete lines

---

## Usage Examples

### Find and Replace

```javascript
import { EditOperations } from './lib/edit_operations.js';

const editor = new EditOperations(fileOps);

await editor.replaceInFile('/path/to/file.js', /oldValue/g, 'newValue');
```

### Insert Content

```javascript
await editor.insertAtLine('/path/to/file.txt', 10, 'New content here', 'after');
```

### Using Pure Functions

```javascript
import { replaceAll, findMatches } from './lib/edit_operations.js';

const text = 'foo bar foo';
const updated = replaceAll(text, /foo/g, 'baz');
// 'baz bar baz'

const matches = findMatches(text, /foo/g);
// [{match: 'foo', ...}, {match: 'foo', ...}]
```

---

## Related Modules

- **[file_operations](./file_operations.md)** - File I/O operations

---

**Last Updated:** 2026-02-01  
**Part of:** AI Workflow Automation v1.0.0
