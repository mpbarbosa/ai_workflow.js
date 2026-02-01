# file_operations - File System Operations Module

**Module:** `lib/file_operations`  
**Version:** 2.0.0  
**Type:** Pure Functions + Wrapper

## Overview

File system operations with referential transparency. Core logic is pure, I/O is wrapped in FileOperations class.

---

## Pure Functions

### `validatePath(filePath)`

Validate file path for safety (no directory traversal).

**Returns:** `{valid: boolean, error?: string}`

**Example:**

```javascript
validatePath('/tmp/file.txt'); // {valid: true}
validatePath('../../../etc/passwd'); // {valid: false, error: '...'}
```

### `filterByExtension(files, extensions)`

Filter files by extension.

**Example:**

```javascript
filterByExtension(['file.js', 'file.py', 'file.txt'], ['.js', '.py']);
// ['file.js', 'file.py']
```

### `filterByPattern(files, pattern)`

Filter files by regex pattern.

### `sortByModificationTime(files, ascending)`

Sort files by mtime.

---

## FileOperations Class

Wrapper for file I/O operations.

**Methods:**

- `readFile(path)` - Read file content
- `writeFile(path, content)` - Write file
- `listFiles(dir)` - List directory files
- `fileExists(path)` - Check file existence
- `deleteFile(path)` - Delete file
- `copyFile(src, dest)` - Copy file
- `moveFile(src, dest)` - Move file

---

## Usage Examples

### Reading Files

```javascript
import { FileOperations } from './lib/file_operations.js';

const fileOps = new FileOperations();
const content = await fileOps.readFile('/path/to/file.txt');
```

### Filtering Files

```javascript
import { filterByExtension } from './lib/file_operations.js';

const jsFiles = filterByExtension(allFiles, ['.js', '.ts']);
```

### Safe Path Validation

```javascript
import { validatePath } from './lib/file_operations.js';

const result = validatePath(userInput);
if (!result.valid) {
  throw new Error(result.error);
}
```

---

## Related Modules

- **[edit_operations](./edit_operations.md)** - File editing utilities
- **[errors](./errors.md)** - `FileSystemError`

---

**Last Updated:** 2026-02-01  
**Part of:** AI Workflow Automation v1.0.0
