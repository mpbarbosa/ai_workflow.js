# edit_operations.js

**Edit Operations Module** - File content editing utilities with referential transparency

## Overview

The Edit Operations module provides comprehensive text editing capabilities with pure transformation functions combined with file I/O operations. It implements find/replace, line manipulation, diff generation, and content transformation with a clean separation between pure text processing and file system interactions.

**Module:** `lib/edit_operations`
**Version:** 2.3.2
**Architecture:** Referentially Transparent (Pure Functions + Impure Wrapper)

## Installation

```javascript
import {
  EditOperations,
  findMatches,
  replaceAll,
  generateDiff,
} from './src/lib/edit_operations.js';
```

## Architecture

### v2.0.0 Pattern: Referential Transparency

This module follows the v2.0.0 architecture pattern:

- **Pure Functions (13 functions)**: Text transformation, pattern matching, diff generation
  - Deterministic: Same input always produces same output
  - No side effects: No I/O, state mutation, or external dependencies
  - Easily testable: No mocks required
- **Impure Wrapper (EditOperations class)**: File reading/writing, change application
  - Handles async file system operations
  - Manages dry-run mode for safe testing
  - Logs operations and generates diffs
  - Wraps pure functions with real file interactions

## Pure Functions

### findMatches(text, pattern)

Find all matches of a pattern in text with line information (PURE).

**Parameters:**

- `text` (string): Text to search
- `pattern` (RegExp|string): Pattern to find

**Returns:** Array of match objects

```javascript
[
  {
    match: string, // Matched text
    index: number, // Character index in line
    line: number, // Line number (1-based)
    lineContent: string, // Full line content
  },
];
```

**Example:**

```javascript
const text = `function hello() {
  console.log("Hello");
  console.log("World");
}`;

const matches = findMatches(text, /console\.log/g);
console.log(matches);
// [
//   { match: 'console.log', index: 2, line: 2, lineContent: '  console.log("Hello");' },
//   { match: 'console.log', index: 2, line: 3, lineContent: '  console.log("World");' }
// ]

// String pattern (converted to RegExp)
const functionMatches = findMatches(text, 'function');
console.log(functionMatches.length); // 1
```

### replaceAll(text, pattern, replacement)

Replace all occurrences of pattern in text (PURE).

**Parameters:**

- `text` (string): Text to process
- `pattern` (RegExp|string): Pattern to find
- `replacement` (string|Function): Replacement string or function

**Returns:** Text with replacements (string)

**Example:**

```javascript
const text = 'Hello World, Hello Universe';

// Simple replacement
const result1 = replaceAll(text, 'Hello', 'Hi');
console.log(result1); // 'Hi World, Hi Universe'

// Regex pattern
const result2 = replaceAll(text, /Hello/g, 'Greetings');
console.log(result2); // 'Greetings World, Greetings Universe'

// Function replacement
const result3 = replaceAll(text, /Hello/g, (match) => match.toUpperCase());
console.log(result3); // 'HELLO World, HELLO Universe'
```

### replaceFirst(text, pattern, replacement)

Replace only the first occurrence of pattern (PURE).

**Parameters:**

- `text` (string): Text to process
- `pattern` (RegExp|string): Pattern to find
- `replacement` (string|Function): Replacement string or function

**Returns:** Text with first replacement (string)

**Example:**

```javascript
const text = 'foo bar foo baz foo';

const result = replaceFirst(text, 'foo', 'qux');
console.log(result); // 'qux bar foo baz foo'

// With regex
const result2 = replaceFirst(text, /foo/i, 'QUX');
console.log(result2); // 'QUX bar foo baz foo'
```

### insertAtLine(text, lineNumber, content, position = 'after')

Insert text at a specific line number (PURE).

**Parameters:**

- `text` (string): Original text
- `lineNumber` (number): Line number (1-based)
- `content` (string): Content to insert
- `position` (string): 'before' or 'after' the line

**Returns:** Text with insertion (string)

**Example:**

```javascript
const text = `Line 1
Line 2
Line 3`;

// Insert after line 2
const result1 = insertAtLine(text, 2, 'New Line', 'after');
console.log(result1);
// Line 1
// Line 2
// New Line
// Line 3

// Insert before line 1
const result2 = insertAtLine(text, 1, '# Header', 'before');
console.log(result2);
// # Header
// Line 1
// Line 2
// Line 3
```

### appendText(text, content, ensureNewline = true)

Append text to the end of file (PURE).

**Parameters:**

- `text` (string): Original text
- `content` (string): Content to append
- `ensureNewline` (boolean): Ensure newline before appending

**Returns:** Text with appended content (string)

**Example:**

```javascript
const text = 'First line\nSecond line';

const result1 = appendText(text, 'Third line');
console.log(result1);
// First line
// Second line
// Third line

// Without ensuring newline
const result2 = appendText(text, 'Appended', false);
console.log(result2); // 'First line\nSecond lineAppended'
```

### prependText(text, content, ensureNewline = true)

Prepend text to the beginning of file (PURE).

**Parameters:**

- `text` (string): Original text
- `content` (string): Content to prepend
- `ensureNewline` (boolean): Ensure newline after prepending

**Returns:** Text with prepended content (string)

**Example:**

```javascript
const text = 'Original content';

const result1 = prependText(text, '# Header');
console.log(result1);
// # Header
// Original content

// Without ensuring newline
const result2 = prependText(text, 'Prefix: ', false);
console.log(result2); // 'Prefix: Original content'
```

### deleteLines(text, pattern)

Delete lines matching a pattern (PURE).

**Parameters:**

- `text` (string): Original text
- `pattern` (RegExp|string): Pattern to match

**Returns:** Text with matching lines removed (string)

**Example:**

```javascript
const text = `import fs from 'fs';
import path from 'path';
import debug from 'debug';
import chalk from 'chalk';`;

// Delete all debug imports
const result = deleteLines(text, /debug/);
console.log(result);
// import fs from 'fs';
// import path from 'path';
// import chalk from 'chalk';
```

### extractLines(text, pattern)

Extract lines matching a pattern (PURE).

**Parameters:**

- `text` (string): Original text
- `pattern` (RegExp|string): Pattern to match

**Returns:** Array of matching lines (string[])

**Example:**

```javascript
const text = `function test1() {}
const value = 42;
function test2() {}
let flag = true;
function test3() {}`;

const functions = extractLines(text, /^function/);
console.log(functions);
// ['function test1() {}', 'function test2() {}', 'function test3() {}']
```

### getLineRange(text, startLine, endLine)

Get a range of lines (PURE).

**Parameters:**

- `text` (string): Original text
- `startLine` (number): Start line number (1-based, inclusive)
- `endLine` (number): End line number (1-based, inclusive, or -1 for end)

**Returns:** Extracted lines as text (string)

**Example:**

```javascript
const text = `Line 1
Line 2
Line 3
Line 4
Line 5`;

const range = getLineRange(text, 2, 4);
console.log(range);
// Line 2
// Line 3
// Line 4

// Get from line 3 to end
const toEnd = getLineRange(text, 3, -1);
console.log(toEnd);
// Line 3
// Line 4
// Line 5
```

### replaceLineRange(text, startLine, endLine, replacement)

Replace a range of lines (PURE).

**Parameters:**

- `text` (string): Original text
- `startLine` (number): Start line number (1-based, inclusive)
- `endLine` (number): End line number (1-based, inclusive)
- `replacement` (string): Replacement text

**Returns:** Text with replaced range (string)

**Example:**

```javascript
const text = `Line 1
Line 2
Line 3
Line 4
Line 5`;

const result = replaceLineRange(text, 2, 4, 'REPLACED CONTENT');
console.log(result);
// Line 1
// REPLACED CONTENT
// Line 5
```

### generateDiff(oldText, newText)

Generate a simple diff between two texts (PURE).

**Parameters:**

- `oldText` (string): Original text
- `newText` (string): Modified text

**Returns:** Diff information object

```javascript
{
  totalChanges: number,
  linesAdded: number,
  linesDeleted: number,
  linesModified: number,
  changes: [{
    line: number,
    type: 'added' | 'deleted' | 'modified',
    oldContent: string | null,
    newContent: string | null
  }]
}
```

**Example:**

```javascript
const oldText = `Line 1
Line 2
Line 3`;

const newText = `Line 1
Modified Line 2
Line 3
Line 4`;

const diff = generateDiff(oldText, newText);
console.log(diff);
// {
//   totalChanges: 2,
//   linesAdded: 1,
//   linesDeleted: 0,
//   linesModified: 1,
//   changes: [
//     { line: 2, type: 'modified', oldContent: 'Line 2', newContent: 'Modified Line 2' },
//     { line: 4, type: 'added', oldContent: null, newContent: 'Line 4' }
//   ]
// }
```

### formatDiff(diff)

Format diff for display (PURE).

**Parameters:**

- `diff` (Object): Diff object from generateDiff()

**Returns:** Formatted diff string

**Example:**

```javascript
const diff = {
  totalChanges: 2,
  linesAdded: 1,
  linesDeleted: 0,
  linesModified: 1,
  changes: [
    { line: 2, type: 'modified', oldContent: 'old', newContent: 'new' },
    { line: 3, type: 'added', oldContent: null, newContent: 'added line' },
  ],
};

const formatted = formatDiff(diff);
console.log(formatted);
// Total changes: 2
//   +1 lines added
//   -0 lines deleted
//   ~1 lines modified
//
// ~ Line 2:
//   - old
//   + new
// + Line 3: added line
```

## Wrapper Class: EditOperations

The impure wrapper class that handles file I/O and applies text transformations.

### Constructor

```javascript
new EditOperations((options = {}));
```

**Parameters:**

- `options.fileOps` (FileOperations): Custom FileOperations instance
- `options.dryRun` (boolean): Enable dry-run mode (no actual file changes)
- `options.verbose` (boolean): Enable verbose logging

**Example:**

```javascript
// Normal mode
const editOps = new EditOperations();

// Dry-run mode
const dryOps = new EditOperations({ dryRun: true });

// With custom file operations
import { FileOperations } from './file_operations.js';
const fileOps = new FileOperations({ verbose: true });
const editOps = new EditOperations({ fileOps });
```

### Methods

#### findInFile(filePath, pattern)

Find all matches in a file.

**Parameters:**

- `filePath` (string): Path to file
- `pattern` (RegExp|string): Pattern to find

**Returns:** Promise<Array> - Array of matches (from findMatches)

**Example:**

```javascript
const editOps = new EditOperations();

const matches = await editOps.findInFile('/src/app.js', /console\.log/g);
console.log(`Found ${matches.length} console.log statements`);

matches.forEach((match) => {
  console.log(`Line ${match.line}: ${match.lineContent}`);
});
```

#### replaceInFile(filePath, pattern, replacement)

Replace all occurrences in a file.

**Parameters:**

- `filePath` (string): Path to file
- `pattern` (RegExp|string): Pattern to find
- `replacement` (string|Function): Replacement

**Returns:** Promise<Object> - Result with changes info

```javascript
{
  changed: boolean,
  diff: Object  // Diff object from generateDiff
}
```

**Example:**

```javascript
const editOps = new EditOperations({ verbose: true });

const result = await editOps.replaceInFile(
  '/src/config.js',
  /API_VERSION = '1\.0'/g,
  "API_VERSION = '2.0'"
);

if (result.changed) {
  console.log(`Updated ${result.diff.totalChanges} occurrences`);
}
```

#### insertAtLine(filePath, lineNumber, content, position = 'after')

Insert content at a specific line.

**Parameters:**

- `filePath` (string): Path to file
- `lineNumber` (number): Line number (1-based)
- `content` (string): Content to insert
- `position` (string): 'before' or 'after'

**Returns:** Promise<void>

**Example:**

```javascript
const editOps = new EditOperations();

// Insert comment before function
await editOps.insertAtLine('/src/app.js', 10, '// TODO: Refactor this function', 'before');
```

#### appendToFile(filePath, content)

Append content to a file.

**Parameters:**

- `filePath` (string): Path to file
- `content` (string): Content to append

**Returns:** Promise<void>

**Example:**

```javascript
const editOps = new EditOperations();

await editOps.appendToFile(
  '/data/log.txt',
  `
[${new Date().toISOString()}] Operation completed
`
);
```

#### prependToFile(filePath, content)

Prepend content to a file.

**Parameters:**

- `filePath` (string): Path to file
- `content` (string): Content to prepend

**Returns:** Promise<void>

**Example:**

```javascript
const editOps = new EditOperations();

await editOps.prependToFile('/README.md', '# Important Notice\n\n');
```

#### deleteLines(filePath, pattern)

Delete lines matching pattern from a file.

**Parameters:**

- `filePath` (string): Path to file
- `pattern` (RegExp|string): Pattern to match

**Returns:** Promise<Object> - Result with deleted lines count

```javascript
{
  deletedLines: number;
}
```

**Example:**

```javascript
const editOps = new EditOperations();

// Remove all TODO comments
const result = await editOps.deleteLines('/src/app.js', /\/\/\s*TODO/);
console.log(`Removed ${result.deletedLines} TODO comments`);
```

#### replaceLineRange(filePath, startLine, endLine, replacement)

Replace a range of lines in a file.

**Parameters:**

- `filePath` (string): Path to file
- `startLine` (number): Start line (1-based)
- `endLine` (number): End line (1-based)
- `replacement` (string): Replacement text

**Returns:** Promise<void>

**Example:**

```javascript
const editOps = new EditOperations();

// Replace lines 5-10 with new implementation
await editOps.replaceLineRange(
  '/src/app.js',
  5,
  10,
  'const newImplementation = () => { /* new code */ };'
);
```

#### previewChanges(filePath, transformFn)

Preview changes before applying them.

**Parameters:**

- `filePath` (string): Path to file
- `transformFn` (Function): Function that transforms content (string => string)

**Returns:** Promise<Object> - Preview with diff

```javascript
{
  diff: Object,
  formatted: string,
  hasChanges: boolean
}
```

**Example:**

```javascript
const editOps = new EditOperations();

const preview = await editOps.previewChanges('/src/app.js', (content) => {
  return content.replace(/var /g, 'let ');
});

if (preview.hasChanges) {
  console.log('Preview of changes:');
  console.log(preview.formatted);

  // Decide whether to apply
  if (confirm('Apply changes?')) {
    await editOps.applyTransform('/src/app.js', transformFn);
  }
}
```

#### applyTransform(filePath, transformFn)

Apply a transformation function to a file.

**Parameters:**

- `filePath` (string): Path to file
- `transformFn` (Function): Function that transforms content (string => string)

**Returns:** Promise<Object> - Result with diff

```javascript
{
  applied: boolean,
  diff: Object
}
```

**Example:**

```javascript
const editOps = new EditOperations({ verbose: true });

// Convert all var declarations to let
const result = await editOps.applyTransform('/src/legacy.js', (content) => {
  return content.replace(/\bvar\b/g, 'let');
});

console.log(`Applied: ${result.applied}`);
console.log(`Changes: ${result.diff.totalChanges}`);
```

## Usage Examples

### Example 1: Code Refactoring

```javascript
import { EditOperations } from './src/lib/edit_operations.js';

async function refactorImports(filePath) {
  const editOps = new EditOperations({ verbose: true });

  // Find all require() statements
  const matches = await editOps.findInFile(filePath, /const .+ = require\(['"](.*?)['"]\)/g);
  console.log(`Found ${matches.length} require() statements`);

  // Convert to ES6 imports
  await editOps.applyTransform(filePath, (content) => {
    return content.replace(/const (.+) = require\(['"](.*?)['"]\)/g, "import $1 from '$2'");
  });

  console.log('Refactoring complete');
}

await refactorImports('/src/app.js');
```

### Example 2: Automated Documentation Updates

```javascript
import { EditOperations, generateDiff } from './src/lib/edit_operations.js';

async function updateDocVersion(readmePath, newVersion) {
  const editOps = new EditOperations({ dryRun: true });

  // Preview changes first
  const preview = await editOps.previewChanges(readmePath, (content) => {
    return content.replace(/Version: \d+\.\d+\.\d+/g, `Version: ${newVersion}`);
  });

  console.log('Preview of changes:');
  console.log(preview.formatted);

  if (preview.hasChanges) {
    // Apply changes
    const realOps = new EditOperations({ dryRun: false, verbose: true });
    await realOps.applyTransform(readmePath, (content) => {
      return content.replace(/Version: \d+\.\d+\.\d+/g, `Version: ${newVersion}`);
    });
  }
}

await updateDocVersion('/README.md', '2.0.0');
```

### Example 3: Batch Code Cleanup

```javascript
import { EditOperations } from './src/lib/edit_operations.js';
import { FileOperations } from './src/lib/file_operations.js';

async function cleanupDebugStatements(srcDir) {
  const fileOps = new FileOperations();
  const editOps = new EditOperations({ verbose: true });

  // Find all JavaScript files
  const jsFiles = await fileOps.listDirectoryRecursive(srcDir, {
    extensions: ['.js'],
  });

  let totalRemoved = 0;

  // Remove console.log and debugger statements
  for (const filePath of jsFiles) {
    const result = await editOps.deleteLines(filePath, /console\.(log|debug)/);
    totalRemoved += result.deletedLines;

    await editOps.deleteLines(filePath, /debugger;/);
  }

  console.log(
    `Cleanup complete: removed ${totalRemoved} debug statements from ${jsFiles.length} files`
  );
}

await cleanupDebugStatements('/src');
```

## Testing Examples

### Unit Tests (Pure Functions)

```javascript
import {
  findMatches,
  replaceAll,
  insertAtLine,
  generateDiff,
  formatDiff,
} from './src/lib/edit_operations.js';

describe('Pure Functions', () => {
  test('findMatches returns all matches with line info', () => {
    const text = 'foo\nbar foo\nbaz';
    const matches = findMatches(text, /foo/g);

    expect(matches).toHaveLength(2);
    expect(matches[0].line).toBe(1);
    expect(matches[1].line).toBe(2);
  });

  test('replaceAll replaces all occurrences', () => {
    const text = 'hello world hello universe';
    const result = replaceAll(text, 'hello', 'hi');

    expect(result).toBe('hi world hi universe');
  });

  test('insertAtLine inserts after specified line', () => {
    const text = 'line1\nline2\nline3';
    const result = insertAtLine(text, 2, 'inserted', 'after');

    expect(result).toBe('line1\nline2\ninserted\nline3');
  });

  test('generateDiff calculates correct changes', () => {
    const oldText = 'a\nb\nc';
    const newText = 'a\nB\nc\nd';
    const diff = generateDiff(oldText, newText);

    expect(diff.totalChanges).toBe(2);
    expect(diff.linesModified).toBe(1);
    expect(diff.linesAdded).toBe(1);
  });
});
```

### Integration Tests (Wrapper Class)

```javascript
import { EditOperations } from './src/lib/edit_operations.js';
import { FileOperations } from './src/lib/file_operations.js';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

describe('EditOperations Integration', () => {
  let tmpDir;
  let editOps;
  let fileOps;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-'));
    fileOps = new FileOperations();
    editOps = new EditOperations({ fileOps });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  test('replaceInFile modifies file correctly', async () => {
    const filePath = path.join(tmpDir, 'test.txt');
    await fileOps.writeFile(filePath, 'hello world hello');

    const result = await editOps.replaceInFile(filePath, /hello/g, 'hi');

    expect(result.changed).toBe(true);
    expect(result.diff.totalChanges).toBeGreaterThan(0);

    const content = await fileOps.readFile(filePath);
    expect(content).toBe('hi world hi');
  });

  test('appendToFile adds content', async () => {
    const filePath = path.join(tmpDir, 'log.txt');
    await fileOps.writeFile(filePath, 'line1\nline2');

    await editOps.appendToFile(filePath, 'line3');

    const content = await fileOps.readFile(filePath);
    expect(content).toContain('line3');
  });
});
```

## Error Handling

All EditOperations methods throw `FileSystemError` on file operation failures:

```javascript
import { EditOperations } from './src/lib/edit_operations.js';
import { FileSystemError } from './src/utils/errors.js';

const editOps = new EditOperations();

try {
  await editOps.replaceInFile('/nonexistent/file.js', /foo/, 'bar');
} catch (error) {
  if (error instanceof FileSystemError) {
    console.error('Edit operation failed:', error.message);
    console.error('File path:', error.context.path);
  }
}
```

## Best Practices

1. **Preview changes with dry-run mode** - Test transformations before applying
2. **Use pure functions for testing** - Unit test transformations separately
3. **Generate diffs for code review** - Show what will change before applying
4. **Use regex carefully** - Test patterns thoroughly to avoid unintended changes
5. **Handle multiline patterns** - Use appropriate regex flags (g, m, s)
6. **Validate transformations** - Ensure transformed code is syntactically valid
7. **Back up before batch operations** - Save originals when editing many files

## Related Modules

- **file_operations.js** - File system operations
- **utils.js** - String utilities for text processing
- **utils/errors.js** - Custom error classes

## References

- Source: `src/lib/edit_operations.js`
- Tests: `test/lib/edit_operations.test.js`
- Related: `.github/REFERENTIAL_TRANSPARENCY.md`

---

**Last Updated:** 2026-01-30
**Module Version:** 2.0.0
