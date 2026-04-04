## logger

# logger.js API Documentation

**Module:** `core/logger`
**Version:** 1.9.3
**Architecture:** Class-based

## Overview

The logger module provides a colored logging system with multiple severity levels, terminal support detection, and customizable formatting for consistent output across the workflow automation system.

## Installation

```javascript
import { Logger, LogLevel } from 'ai-workflow';
// or
import { Logger, LogLevel } from 'ai-workflow/core/logger';
```

## API Reference

### Classes

#### `Logger`

Main logger class for formatted console output.

**Constructor:**

```javascript
new Logger(options);
```

**Parameters:**

- `options` (Object, optional) - Configuration options
  - `options.quiet` (boolean) - Suppress all output (default: `false`)
  - `options.verbose` (boolean) - Enable verbose/debug output (default: `false`)
  - `options.prefix` (string) - Prefix for all messages (default: `''`)

**Example:**

```javascript
const logger = new Logger({
  quiet: false,
  verbose: true,
  prefix: '[MyApp]',
});
```

### Methods

#### `debug(message)`

Log a debug message (only visible in verbose mode).

**Parameters:**

- `message` (string) - Message to log

**Example:**

```javascript
logger.debug('Debugging information');
// Output (verbose mode): [MyApp] Debugging information (in dim gray)
```

#### `info(message)`

Log an informational message.

**Parameters:**

- `message` (string) - Message to log

**Example:**

```javascript
logger.info('Processing started');
// Output: [MyApp] Processing started (in blue)
```

#### `success(message)`

Log a success message.

**Parameters:**

- `message` (string) - Message to log

**Example:**

```javascript
logger.success('Operation completed successfully');
// Output: [MyApp] ✓ Operation completed successfully (in green)
```

#### `warn(message)`

Log a warning message.

**Parameters:**

- `message` (string) - Message to log

**Example:**

```javascript
logger.warn('Configuration file not found, using defaults');
// Output: [MyApp] ⚠ Configuration file not found, using defaults (in yellow)
```

#### `error(message, error)`

Log an error message with optional error object.

**Parameters:**

- `message` (string) - Error message
- `error` (Error, optional) - Error object with stack trace

**Example:**

```javascript
try {
  // Some operation
} catch (err) {
  logger.error('Failed to process file', err);
  // Output: [MyApp] ✗ Failed to process file
  //         Error: <error message>
  //         Stack trace... (in red)
}
```

#### `plain(message)`

Log a message without formatting.

**Parameters:**

- `message` (string) - Message to log

**Example:**

```javascript
logger.plain('Raw output message');
// Output: [MyApp] Raw output message (no color)
```

### Constants

#### `LogLevel`

Enumeration of available log levels.

```javascript
export const LogLevel = {
  DEBUG: 'debug',
  INFO: 'info',
  SUCCESS: 'success',
  WARN: 'warn',
  ERROR: 'error',
};
```

**Usage:**

```javascript
const level = LogLevel.INFO;
if (level === LogLevel.DEBUG) {
  // Debug mode logic
}
```

## Usage Examples

### Basic Logging

```javascript
import { Logger } from 'ai-workflow';

const logger = new Logger();

logger.info('Application started');
logger.success('Connected to database');
logger.warn('Deprecated API usage detected');
logger.error('Failed to save file');
```

### Verbose Mode

```javascript
const logger = new Logger({ verbose: true });

logger.debug('Entering function processData()');
logger.debug('Processing 100 records');
logger.info('Processing complete');
```

### Quiet Mode

```javascript
// Suppress all output
const logger = new Logger({ quiet: true });

logger.info('This will not be displayed');
logger.error('This will not be displayed either');
```

### Custom Prefix

```javascript
const logger = new Logger({ prefix: '[Workflow]' });

logger.info('Step 1: Validate documentation');
// Output: [Workflow] Step 1: Validate documentation
```

### Error Handling

```javascript
const l

---

## logger

# logger - Logging Module

**Module:** `core/logger`
**Version:** 1.9.3
**Type:** Class-based with singleton instance

## Overview

Provides colored console output and logging utilities with multiple log levels, prefix support, and quiet/verbose modes. Built on top of the `colors` module for automatic color support detection.

---

## Exports

### `LogLevel` Enum

Log level constants for categorizing messages.

**Type:** `Object<string, string>`

**Values:**

| Level     | Value       | Description           | Color    |
| --------- | ----------- | --------------------- | -------- |
| `DEBUG`   | `'debug'`   | Debugging information | Dim gray |
| `INFO`    | `'info'`    | General information   | Cyan     |
| `SUCCESS` | `'success'` | Success messages      | Green    |
| `WARN`    | `'warn'`    | Warning messages      | Yellow   |
| `ERROR`   | `'error'`   | Error messages        | Red      |

---

### `Logger` Class

Main logger class with configurable output formatting.

#### Constructor

```javascript
new Logger(options?)
```

**Parameters:**

| Name              | Type      | Default | Description                   |
| ----------------- | --------- | ------- | ----------------------------- |
| `options`         | `Object`  | `{}`    | Logger configuration          |
| `options.quiet`   | `boolean` | `false` | Suppress all non-error output |
| `options.verbose` | `boolean` | `false` | Enable debug messages         |
| `options.prefix`  | `string`  | `''`    | Prefix for all messages       |

**Example:**

```javascript
import { Logger } from './core/logger.js';

const logger = new Logger({
  quiet: false,
  verbose: true,
  prefix: '[Workflow]',
});
```

---

#### Methods

### `debug(message)`

Log debug message (only shown in verbose mode).

**Parameters:**

| Name      | Type     | Description    |
| --------- | -------- | -------------- |
| `message` | `string` | Message to log |

**Output:** `[DEBUG] {prefix} {message}` (dim gray, only if `verbose` enabled)

**Example:**

```javascript
logger.debug('Variable value: 42');
// Output (if verbose): [DEBUG] [Workflow] Variable value: 42
```

---

### `info(message)`

Log informational message.

**Parameters:**

| Name      | Type     | Description    |
| --------- | -------- | -------------- |
| `message` | `string` | Message to log |

**Output:** `{prefix} {message}` (cyan)

**Example:**

```javascript
logger.info('Processing files...');
// Output: [Workflow] Processing files...
```

---

### `success(message)`

Log success message.

**Parameters:**

| Name      | Type     | Description    |
| --------- | -------- | -------------- |
| `message` | `string` | Message to log |

**Output:** `✓ {prefix} {message}` (green)

**Example:**

```javascript
logger.success('Build completed');
// Output: ✓ [Workflow] Build completed
```

---

### `warn(message)`

Log warning message (not suppressed by quiet mode).

**Parameters:**

| Name      | Type     | Description    |
| --------- | -------- | -------------- |
| `message` | `string` | Message to log |

**Output:** `⚠ {prefix} {message}` (yellow)

**Example:**

```javascript
logger.warn('Deprecated API usage');
// Output: ⚠ [Workflow] Deprecated API usage
```

---

### `error(message)`

Log error message (never suppressed).

**Parameters:**

| Name      | Type     | Description    |
| --------- | -------- | -------------- |
| `message` | `string` | Message to log |

**Output:** `✗ {prefix} {message}` (red)

**Example:**

```javascript
logger.error('Failed to read file');
// Output: ✗ [Workflow] Failed to read file
```

---

### Default Logger Instance

A pre-configured logger instance for convenience.

**Import:**

```javascript
import { logger } from './core/logger.js';
```

**Configuration:**

- No prefix
- Quiet: `false`
- Verbose: `false`

**Example:**

```javascript
import { logger } from './core/logger.js';

logger.info('Application started');
logger.success('Configuration loaded');
logger.warn('Using default settings');
```

---
