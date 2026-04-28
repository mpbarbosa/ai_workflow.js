# file_operations.js

**File Operations Module** - File system operations with referential transparency

## Overview

The File Operations module provides comprehensive file system operations with pure function validation and filtering combined with async I/O operations. It implements safe path validation, file metadata handling, and directory traversal with a clean separation between pure functions and side effects.

**Module:** `lib/file_operations`
**Version:** 2.2.16
**Architecture:** Referentially Transparent (Pure Functions + Impure Wrapper)

## Installation

```javascript
import { FileOperations, validatePath, filterByExtension } from './src/lib/file_operations.js';
```

## Architecture

### v2.0.0 Pattern: Referential Transparency

This module follows the v2.0.0 architecture pattern:

- **Pure Functions (6 functions)**: Path validation, file filtering, metadata building
  - Deterministic: Same input always produces same output
  - No side effects: No I/O, state mutation, or external dependencies
  - Easily testable: No mocks required
- **Impure Wrapper (FileOperations class)**: File I/O, directory operations
  - Handles async file system operations
  - Manages dry-run mode for safe testing
  - Logs operations and errors
  - Wraps pure functions with real file interactions

## Pure Functions

### validatePath(filePath)

Validate if a path is safe (no directory traversal, absolute paths only).

**Parameters:**

- `filePath` (string): Path to validate

**Returns:** Object with validation result

```javascript
{
  valid: boolean,
  error?: string  // Present if valid is false
}
```

**Example:**

```javascript
const result1 = validatePath('/home/user/project/file.txt');
console.log(result1); // { valid: true }

const result2 = validatePath('../../../etc/passwd');
console.log(result2); // { valid: false, error: 'Directory traversal not allowed' }

const result3 = validatePath('relative/path.txt');
console.log(result3); // { valid: false, error: 'Only absolute paths are allowed' }
```

**Input/Output Examples:**

```javascript
// Valid absolute path
validatePath('/home/user/docs/file.txt');
// → { valid: true }

// Invalid: directory traversal
validatePath('/home/user/../../etc/passwd');
// → { valid: false, error: 'Directory traversal not allowed' }

// Invalid: relative path
validatePath('src/index.js');
// → { valid: false, error: 'Only absolute paths are allowed' }

// Invalid: empty string
validatePath('');
// → { valid: false, error: 'Path must be a non-empty string' }
```

### filterByExtension(files, extensions)

Filter file list by extension (PURE).

**Parameters:**

- `files` (string[]): List of file paths
- `extensions` (string[]): Extensions to filter (e.g., `['.js', '.json']`)

**Returns:** Filtered file list (string[])

**Example:**

```javascript
const files = [
  '/home/user/app.js',
  '/home/user/config.json',
  '/home/user/README.md',
  '/home/user/test.js',
];

const jsFiles = filterByExtension(files, ['.js']);
console.log(jsFiles);
// ['/home/user/app.js', '/home/user/test.js']

const configFiles = filterByExtension(files, ['json', '.md']); // Extensions normalized
console.log(configFiles);
// ['/home/user/config.json', '/home/user/README.md']
```

**Input/Output Examples:**

```javascript
// Filter JavaScript files
filterByExtension(['/src/app.js', '/src/data.json', '/src/util.js'], ['.js']);
// → ['/src/app.js', '/src/util.js']

// Multiple extensions
filterByExtension(['/docs/README.md', '/docs/api.json', '/docs/guide.txt'], ['.md', '.json']);
// → ['/docs/README.md', '/docs/api.json']

// Extensions without leading dot (normalized internally)
filterByExtension(['/src/index.ts', '/src/types.ts'], ['ts']);
// → ['/src/index.ts', '/src/types.ts']
```

### filterByPattern(files, pattern)

Filter file list by regex pattern (PURE).

**Parameters:**

- `files` (string[]): List of file paths
- `pattern` (RegExp|string): Pattern to match

**Returns:** Filtered file list (string[])

**Example:**

```javascript
const files = [
  '/src/components/Button.jsx',
  '/src/components/Modal.jsx',
  '/src/utils/helpers.js',
  '/test/components/Button.test.jsx',
];

// Find all JSX files
const jsxFiles = filterByPattern(files, /\.jsx$/);
console.log(jsxFiles);
// ['/src/components/Button.jsx', '/src/components/Modal.jsx', '/test/components/Button.test.jsx']

// Find test files
const testFiles = filterByPattern(files, /\.test\./);
console.log(testFiles);
// ['/test/components/Button.test.jsx']

// String pattern (converted to RegExp internally)
const componentFiles = filterByPattern(files, 'components');
console.log(componentFiles);
// ['/src/components/Button.jsx', '/src/components/Modal.jsx', '/test/components/Button.test.jsx']
```

### sortByModificationTime(files, ascending = true)

Sort files by modification time (PURE).

**Parameters:**

- `files` (Array<{path: string, mtime: Date}>): Files with metadata
- `ascending` (boolean): Sort order (true = oldest first, false = newest first)

**Returns:** Sorted files array

**Example:**

```javascript
const files = [
  { path: '/file1.txt', mtime: new Date('2024-01-15') },
  { path: '/file2.txt', mtime: new Date('2024-01-10') },
  { path: '/file3.txt', mtime: new Date('2024-01-20') },
];

const oldestFirst = sortByModificationTime(files, true);
console.log(oldestFirst.map((f) => f.path));
// ['/file2.txt', '/file1.txt', '/file3.txt']

const newestFirst = sortByModificationTime(files, false);
console.log(newestFirst.map((f) => f.path));
// ['/file3.txt', '/file1.txt', '/file2.txt']
```

### buildFileMetadata(filePath, stats)

Build file metadata object from fs.Stats (PURE).

**Parameters:**

- `filePath` (string): File path
- `stats` (Object): fs.Stats object from fs.stat()

**Returns:** File metadata object

```javascript
{
  path: string,
  size: number,           // Size in bytes
  isFile: boolean,
  isDirectory: boolean,
  isSymbolicLink: boolean,
  created: Date,          // Birth time
  modified: Date,         // Modification time
  accessed: Date          // Access time
}
```

**Example:**

```javascript
import fs from 'fs/promises';

const stats = await fs.stat('/home/user/file.txt');
const metadata = buildFileMetadata('/home/user/file.txt', stats);
console.log(metadata);
// {
//   path: '/home/user/file.txt',
//   size: 1024,
//   isFile: true,
//   isDirectory: false,
//   isSymbolicLink: false,
//   created: 2024-01-15T10:30:00.000Z,
//   modified: 2024-01-20T14:45:00.000Z,
//   accessed: 2024-01-25T09:00:00.000Z
// }
```

### calculateRelativePath(from, to)

Calculate relative path between two absolute paths (PURE).

**Parameters:**

- `from` (string): Base path
- `to` (string): Target path

**Returns:** Relative path (string)

**Example:**

```javascript
const relativePath = calculateRelativePath('/home/user/project', '/home/user/project/src/app.js');
console.log(relativePath); // 'src/app.js'

const upPath = calculateRelativePath('/home/user/project/src', '/home/user/project/docs/README.md');
console.log(upPath); // '../docs/README.md'
```

## Wrapper Class: FileOperations

The impure wrapper class that handles all file I/O operations.

### Constructor

```javascript
new FileOperations((options = {}));
```

**Parameters:**

- `options.dryRun` (boolean): Enable dry-run mode (no actual file changes)
- `options.verbose` (boolean): Enable verbose logging

**Example:**

```javascript
// Normal mode
const fileOps = new FileOperations();

// Dry-run mode (no actual changes)
const dryRunOps = new FileOperations({ dryRun: true });

// Verbose mode (detailed logging)
const verboseOps = new FileOperations({ verbose: true });
```

### Methods

#### readFile(filePath, encoding = 'utf8')

Read file contents.

**Parameters:**

- `filePath` (string): Absolute path to file
- `encoding` (string): File encoding (default: 'utf8')

**Returns:** Promise<string> - File contents

**Throws:** FileSystemError if file cannot be read

**Example:**

```javascript
const fileOps = new FileOperations();

try {
  const content = await fileOps.readFile('/home/user/config.json');
  const config = JSON.parse(content);
  console.log('Config loaded:', config);
} catch (error) {
  console.error('Failed to read file:', error.message);
}

// Read binary file
const buffer = await fileOps.readFile('/home/user/image.png', null);
```

#### writeFile(filePath, content, options = {})

Write file contents.

**Parameters:**

- `filePath` (string): Absolute path to file
- `content` (string|Buffer): Content to write
- `options` (Object): Write options (passed to fs.writeFile)

**Returns:** Promise<void>

**Throws:** FileSystemError if file cannot be written

**Example:**

```javascript
const fileOps = new FileOperations();

// Write text file
await fileOps.writeFile('/home/user/output.txt', 'Hello, World!');

// Write JSON file
const data = { name: 'test', version: '1.0.0' };
await fileOps.writeFile('/home/user/data.json', JSON.stringify(data, null, 2));

// Dry-run mode
const dryOps = new FileOperations({ dryRun: true });
await dryOps.writeFile('/home/user/test.txt', 'test');
// Logs: [DRY RUN] Would write to file: /home/user/test.txt (4 bytes)
```

#### exists(filePath)

Check if path exists.

**Parameters:**

- `filePath` (string): Absolute path to check

**Returns:** Promise<boolean> - True if path exists

**Example:**

```javascript
const fileOps = new FileOperations();

if (await fileOps.exists('/home/user/config.json')) {
  console.log('Config file exists');
} else {
  console.log('Config file not found');
}
```

#### stat(filePath)

Get file metadata.

**Parameters:**

- `filePath` (string): Absolute path to file

**Returns:** Promise<Object> - File metadata (from buildFileMetadata)

**Throws:** FileSystemError if stats cannot be retrieved

**Example:**

```javascript
const fileOps = new FileOperations();

const stats = await fileOps.stat('/home/user/file.txt');
console.log(`File size: ${stats.size} bytes`);
console.log(`Last modified: ${stats.modified}`);
console.log(`Is directory: ${stats.isDirectory}`);
```

#### listDirectory(dirPath, options = {})

List directory contents.

**Parameters:**

- `dirPath` (string): Absolute directory path
- `options.extensions` (string[]): Filter by extensions
- `options.pattern` (RegExp|string): Filter by pattern

**Returns:** Promise<string[]> - Array of absolute file paths

**Throws:** FileSystemError if directory cannot be listed

**Example:**

```javascript
const fileOps = new FileOperations();

// List all files
const allFiles = await fileOps.listDirectory('/home/user/project');
console.log(allFiles);

// List only JavaScript files
const jsFiles = await fileOps.listDirectory('/home/user/project', {
  extensions: ['.js'],
});

// List files matching pattern
const testFiles = await fileOps.listDirectory('/home/user/project', {
  pattern: /\.test\.js$/,
});
```

#### listDirectoryRecursive(dirPath, options = {})

List directory contents recursively.

**Parameters:**

- `dirPath` (string): Absolute directory path
- `options.extensions` (string[]): Filter by extensions
- `options.pattern` (RegExp|string): Filter by pattern
- `options.includeDirectories` (boolean): Include directories in results

**Returns:** Promise<string[]> - Array of absolute file paths

**Throws:** FileSystemError if directory cannot be traversed

**Example:**

```javascript
const fileOps = new FileOperations();

// Recursively list all JavaScript files
const jsFiles = await fileOps.listDirectoryRecursive('/home/user/project', {
  extensions: ['.js'],
});

// List all markdown files
const docs = await fileOps.listDirectoryRecursive('/home/user/docs', {
  extensions: ['.md'],
  includeDirectories: false,
});

// List test files recursively
const tests = await fileOps.listDirectoryRecursive('/home/user/project', {
  pattern: /\.test\./,
});
```

#### copyFile(sourcePath, destPath)

Copy file.

**Parameters:**

- `sourcePath` (string): Source file path
- `destPath` (string): Destination file path

**Returns:** Promise<void>

**Throws:** FileSystemError if file cannot be copied

**Example:**

```javascript
const fileOps = new FileOperations();

await fileOps.copyFile('/home/user/source.txt', '/home/user/backup/source.txt');
console.log('File copied successfully');
```

#### moveFile(sourcePath, destPath)

Move/rename file.

**Parameters:**

- `sourcePath` (string): Source file path
- `destPath` (string): Destination file path

**Returns:** Promise<void>

**Throws:** FileSystemError if file cannot be moved

**Example:**

```javascript
const fileOps = new FileOperations();

// Move file
await fileOps.moveFile('/home/user/old-name.txt', '/home/user/archive/new-name.txt');

// Rename file
await fileOps.moveFile('/home/user/temp.txt', '/home/user/final.txt');
```

#### deleteFile(filePath)

Delete file.

**Parameters:**

- `filePath` (string): Path to file

**Returns:** Promise<void>

**Throws:** FileSystemError if file cannot be deleted

**Example:**

```javascript
const fileOps = new FileOperations();

await fileOps.deleteFile('/home/user/temp.txt');
console.log('File deleted');
```

#### createDirectory(dirPath, options = { recursive: true })

Create directory.

**Parameters:**

- `dirPath` (string): Directory path
- `options` (Object): Options (recursive: true by default)

**Returns:** Promise<void>

**Throws:** FileSystemError if directory cannot be created

**Example:**

```javascript
const fileOps = new FileOperations();

// Create single directory
await fileOps.createDirectory('/home/user/new-dir');

// Create nested directories
await fileOps.createDirectory('/home/user/a/b/c/d', { recursive: true });
```

#### deleteDirectory(dirPath)

Delete directory recursively.

**Parameters:**

- `dirPath` (string): Directory path

**Returns:** Promise<void>

**Throws:** FileSystemError if directory cannot be deleted

**Example:**

```javascript
const fileOps = new FileOperations();

await fileOps.deleteDirectory('/home/user/temp-dir');
console.log('Directory deleted');
```

## Usage Examples

### Example 1: Safe File Processing

```javascript
import { FileOperations, validatePath } from './src/lib/file_operations.js';

async function safeFileRead(filePath) {
  // Validate path using pure function
  const validation = validatePath(filePath);
  if (!validation.valid) {
    throw new Error(`Invalid path: ${validation.error}`);
  }

  // Use wrapper for I/O
  const fileOps = new FileOperations();
  const content = await fileOps.readFile(filePath);
  return content;
}

// Usage
try {
  const content = await safeFileRead('/home/user/data.json');
  console.log('File content:', content);
} catch (error) {
  console.error('Error:', error.message);
}
```

### Example 2: Batch File Processing with Filtering

```javascript
import {
  FileOperations,
  filterByExtension,
  sortByModificationTime,
} from './src/lib/file_operations.js';

async function processOldLogFiles(logDir, maxAgeMs) {
  const fileOps = new FileOperations({ verbose: true });

  // List all log files
  const allFiles = await fileOps.listDirectoryRecursive(logDir, {
    extensions: ['.log'],
  });

  // Get metadata
  const filesWithStats = [];
  for (const filePath of allFiles) {
    const stats = await fileOps.stat(filePath);
    filesWithStats.push(stats);
  }

  // Sort by modification time (oldest first)
  const sorted = sortByModificationTime(filesWithStats, true);

  // Process old files
  const now = Date.now();
  for (const file of sorted) {
    const age = now - file.modified.getTime();
    if (age > maxAgeMs) {
      await fileOps.deleteFile(file.path);
      console.log(`Deleted old log: ${file.path}`);
    }
  }
}

// Delete logs older than 30 days
await processOldLogFiles('/var/log/myapp', 30 * 24 * 60 * 60 * 1000);
```

### Example 3: Directory Backup with Dry-Run

```javascript
import { FileOperations } from './src/lib/file_operations.js';
import path from 'path';

async function backupDirectory(sourceDir, backupDir, dryRun = false) {
  const fileOps = new FileOperations({ dryRun, verbose: true });

  // Create backup directory
  await fileOps.createDirectory(backupDir);

  // List all files recursively
  const files = await fileOps.listDirectoryRecursive(sourceDir);

  // Copy each file
  for (const sourcePath of files) {
    const relativePath = path.relative(sourceDir, sourcePath);
    const destPath = path.join(backupDir, relativePath);

    await fileOps.copyFile(sourcePath, destPath);
  }

  console.log(`Backup completed: ${files.length} files`);
}

// Test with dry-run first
await backupDirectory('/home/user/project', '/backup/project', true);

// Then do real backup
await backupDirectory('/home/user/project', '/backup/project', false);
```

## Testing Examples

### Unit Tests (Pure Functions)

```javascript
import {
  validatePath,
  filterByExtension,
  sortByModificationTime,
} from './src/lib/file_operations.js';

describe('Pure Functions', () => {
  test('validatePath rejects relative paths', () => {
    const result = validatePath('relative/path.txt');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Only absolute paths are allowed');
  });

  test('validatePath rejects directory traversal', () => {
    const result = validatePath('/home/user/../../etc/passwd');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Directory traversal not allowed');
  });

  test('filterByExtension filters correctly', () => {
    const files = ['/app.js', '/data.json', '/test.js'];
    const jsFiles = filterByExtension(files, ['.js']);
    expect(jsFiles).toEqual(['/app.js', '/test.js']);
  });

  test('sortByModificationTime sorts oldest first', () => {
    const files = [
      { path: '/b.txt', mtime: new Date('2024-01-15') },
      { path: '/a.txt', mtime: new Date('2024-01-10') },
      { path: '/c.txt', mtime: new Date('2024-01-20') },
    ];
    const sorted = sortByModificationTime(files, true);
    expect(sorted[0].path).toBe('/a.txt');
    expect(sorted[2].path).toBe('/c.txt');
  });
});
```

### Integration Tests (Wrapper Class)

```javascript
import { FileOperations } from './src/lib/file_operations.js';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

describe('FileOperations Integration', () => {
  let tmpDir;
  let fileOps;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-'));
    fileOps = new FileOperations();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  test('writeFile and readFile work correctly', async () => {
    const filePath = path.join(tmpDir, 'test.txt');
    const content = 'Hello, World!';

    await fileOps.writeFile(filePath, content);
    const readContent = await fileOps.readFile(filePath);

    expect(readContent).toBe(content);
  });

  test('listDirectory filters by extension', async () => {
    await fileOps.writeFile(path.join(tmpDir, 'a.js'), 'code');
    await fileOps.writeFile(path.join(tmpDir, 'b.json'), 'data');
    await fileOps.writeFile(path.join(tmpDir, 'c.js'), 'more code');

    const jsFiles = await fileOps.listDirectory(tmpDir, {
      extensions: ['.js'],
    });

    expect(jsFiles).toHaveLength(2);
    expect(jsFiles.every((f) => f.endsWith('.js'))).toBe(true);
  });
});
```

## Error Handling

All FileOperations methods throw `FileSystemError` on failure:

```javascript
import { FileOperations } from './src/lib/file_operations.js';
import { FileSystemError } from './src/utils/errors.js';

const fileOps = new FileOperations();

try {
  await fileOps.readFile('/nonexistent/file.txt');
} catch (error) {
  if (error instanceof FileSystemError) {
    console.error('File operation failed:', error.message);
    console.error('Path:', error.context.path);
    console.error('Original error:', error.context.originalError);
  }
}
```

## Best Practices

1. **Always use absolute paths** - Relative paths are rejected for security
2. **Use pure functions for validation** - Test path safety before I/O
3. **Use dry-run mode for testing** - Verify operations before applying
4. **Enable verbose mode for debugging** - See detailed operation logs
5. **Filter files with pure functions** - Separate filtering logic from I/O
6. **Handle errors gracefully** - Catch FileSystemError and provide context

## Related Modules

- **edit_operations.js** - File content editing operations
- **cleanup_handlers.js** - File cleanup and maintenance
- **utils/errors.js** - Custom error classes

## References

- Source: `src/lib/file_operations.js`
- Tests: `test/lib/file_operations.test.js`
- Related: `.github/REFERENTIAL_TRANSPARENCY.md`

---

**Last Updated:** 2026-01-30
**Module Version:** 2.0.0
