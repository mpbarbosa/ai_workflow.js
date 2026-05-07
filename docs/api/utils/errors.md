# errors - Custom Error Types Module

**Module:** `utils/errors`
**Version:** 2.4.0
**Type:** Error Classes

## Overview

Custom error types for workflow automation with additional context and error codes. All errors extend `WorkflowError` base class.

---

## Error Classes

### `WorkflowError`

Base error class for all application errors.

**Properties:**

- `message` (string) - Error description
- `code` (string) - Error code (default: 'WORKFLOW_ERROR')
- `name` (string) - Error class name

**Example:**

```javascript
throw new WorkflowError('Operation failed', 'CUSTOM_ERROR');
```

---

### `SystemError`

System-related issues (OS detection, permissions, etc.).

**Code:** `'SYSTEM_ERROR'`

**Example:**

```javascript
throw new SystemError('Failed to detect package manager');
```

---

### `ExecutionError`

Command execution failures.

**Code:** `'EXECUTION_ERROR'`

**Properties:**

- `exitCode` (number) - Process exit code
- `stdout` (string) - Standard output
- `stderr` (string) - Standard error

**Example:**

```javascript
throw new ExecutionError('Command failed', 1, stdout, stderr);
```

---

### `ConfigurationError`

Configuration issues (missing/invalid config).

**Code:** `'CONFIG_ERROR'`

**Example:**

```javascript
throw new ConfigurationError('Invalid workflow config');
```

---

### `ValidationError`

Validation failures.

**Code:** `'VALIDATION_ERROR'`

**Properties:**

- `field` (string|null) - Field that failed validation

**Example:**

```javascript
throw new ValidationError('Invalid email format', 'email');
```

---

### `FileSystemError`

File system operation failures.

**Code:** `'FILE_SYSTEM_ERROR'`

**Properties:**

- `path` (string|null) - File path
- `destination` (string|null) - Destination path (for copy/move)
- `originalError` (Error|null) - Underlying error

**Example:**

```javascript
throw new FileSystemError('File not found', {
  path: '/path/to/file.txt',
  originalError: err,
});
```

---

## Usage Examples

### Basic Error Handling

```javascript
import { WorkflowError } from '../utils/errors.js';

try {
  // ... operation ...
} catch (error) {
  if (error instanceof WorkflowError) {
    console.error(`${error.code}: ${error.message}`);
  } else {
    throw error;
  }
}
```

### Execution Error with Context

```javascript
import { ExecutionError } from '../utils/errors.js';

try {
  await execute('failing-command');
} catch (error) {
  throw new ExecutionError('Build failed', error.code, error.stdout, error.stderr);
}
```

### Validation with Field Info

```javascript
import { ValidationError } from '../utils/errors.js';

function validateEmail(email) {
  if (!email.includes('@')) {
    throw new ValidationError('Invalid email format', 'email');
  }
}

try {
  validateEmail('invalid');
} catch (error) {
  console.error(`Field '${error.field}': ${error.message}`);
}
```

### File System Error with Details

```javascript
import { FileSystemError } from '../utils/errors.js';
import fs from 'fs/promises';

try {
  await fs.readFile('/nonexistent');
} catch (err) {
  throw new FileSystemError('Failed to read file', {
    path: '/nonexistent',
    originalError: err,
  });
}
```

---

## Error Type Selection Guide

| Scenario                    | Error Type           |
| --------------------------- | -------------------- |
| OS/platform detection fails | `SystemError`        |
| Shell command fails         | `ExecutionError`     |
| Config file missing/invalid | `ConfigurationError` |
| Input validation fails      | `ValidationError`    |
| File read/write fails       | `FileSystemError`    |
| General workflow error      | `WorkflowError`      |

---

## Error Handling Patterns

### Catch by Type

```javascript
import { ValidationError, FileSystemError, ExecutionError } from '../utils/errors.js';

try {
  await processFile(path);
} catch (error) {
  if (error instanceof ValidationError) {
    logger.warn(`Validation: ${error.message}`);
  } else if (error instanceof FileSystemError) {
    logger.error(`File error: ${error.path}`);
  } else if (error instanceof ExecutionError) {
    logger.error(`Command failed (${error.exitCode})`);
  } else {
    throw error;
  }
}
```

### Error Chaining

```javascript
import { ConfigurationError } from '../utils/errors.js';

try {
  const config = await loadConfig();
} catch (err) {
  throw new ConfigurationError(`Failed to load config: ${err.message}`);
}
```

---

## Stack Traces

All errors capture stack traces automatically:

```javascript
try {
  throw new WorkflowError('Something went wrong');
} catch (error) {
  console.error(error.stack);
  // Includes full call stack
}
```

---

## Related Modules

- **[executor](../core/executor.md)** - Throws `ExecutionError`
- **[system](../core/system.md)** - Throws `SystemError`
- **[file_operations](../lib/file_operations.md)** - Throws `FileSystemError`

---

## Best Practices

1. **Use specific error types:**

   ```javascript
   // ✅ Good - specific
   throw new ValidationError('Invalid format', 'email');

   // ❌ Less informative
   throw new Error('Invalid format');
   ```

2. **Include context:**

   ```javascript
   throw new FileSystemError('Read failed', {
     path: filePath,
     originalError: err,
   });
   ```

3. **Check error instanceof:**
   ```javascript
   if (error instanceof ValidationError) {
     // Handle validation error
   }
   ```

**Type:** Error Classes

---

**Last Updated:** 2026-03-12
**Part of:** AI Workflow Automation v1.9.11
