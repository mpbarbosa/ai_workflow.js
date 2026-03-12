# logger - Logging Module

**Module:** `core/logger`
**Version:** 1.7.3
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

## Usage Examples

### Basic Logging

```javascript
import { logger } from './core/logger.js';

logger.info('Starting workflow...');
logger.success('Step 1 complete');
logger.warn('Missing optional configuration');
logger.error('Critical failure');
logger.debug('Debug info'); // Not shown unless verbose
```

### Custom Logger with Prefix

```javascript
import { Logger } from './core/logger.js';

const stepLogger = new Logger({ prefix: '[Step 5]' });

stepLogger.info('Analyzing files');
stepLogger.success('Found 42 matches');
// Output: ✓ [Step 5] Found 42 matches
```

### Quiet Mode (Suppress Non-Critical)

```javascript
import { Logger } from './core/logger.js';

const quietLogger = new Logger({ quiet: true });

quietLogger.info('This will not appear');
quietLogger.success('This will not appear');
quietLogger.warn('This WILL appear'); // Warnings always shown
quietLogger.error('This WILL appear'); // Errors always shown
```

### Verbose Mode (Debug Messages)

```javascript
import { Logger } from './core/logger.js';

const verboseLogger = new Logger({ verbose: true });

verboseLogger.debug('Checking cache...');
verboseLogger.debug('Cache hit: true');
// Debug messages only appear in verbose mode
```

### Combining Options

```javascript
import { Logger } from './core/logger.js';

const advancedLogger = new Logger({
  prefix: '[Validator]',
  verbose: true,
  quiet: false,
});

advancedLogger.debug('Validating schema...');
advancedLogger.info('Processing entry 1 of 100');
advancedLogger.success('Validation passed');
```

### Contextual Loggers

```javascript
import { Logger } from './core/logger.js';

function processFiles(files, options) {
  const logger = new Logger({
    prefix: '[FileProcessor]',
    quiet: options.quiet || false,
    verbose: options.verbose || false,
  });

  logger.info(`Processing ${files.length} files`);

  files.forEach((file, index) => {
    logger.debug(`Processing file ${index + 1}: ${file}`);
  });

  logger.success('All files processed');
}
```

---

## Output Formatting

### Message Format by Level

| Level     | Format                       | Example                      |
| --------- | ---------------------------- | ---------------------------- |
| `debug`   | `[DEBUG] {prefix} {message}` | `[DEBUG] [App] Variable: 42` |
| `info`    | `{prefix} {message}`         | `[App] Starting process`     |
| `success` | `✓ {prefix} {message}`       | `✓ [App] Complete`           |
| `warn`    | `⚠ {prefix} {message}`       | `⚠ [App] Deprecated`         |
| `error`   | `✗ {prefix} {message}`       | `✗ [App] Failed`             |

### Color Scheme

- **Debug:** Dim gray (subtle)
- **Info:** Cyan (informative)
- **Success:** Green (positive)
- **Warn:** Yellow (caution)
- **Error:** Red (critical)

**Note:** Colors automatically disabled when terminal doesn't support them (see [colors](./core/colors.md) module).

---

## Log Level Behavior

### Quiet Mode (`quiet: true`)

| Method      | Shown? |
| ----------- | ------ |
| `debug()`   | ❌ No  |
| `info()`    | ❌ No  |
| `success()` | ❌ No  |
| `warn()`    | ✅ Yes |
| `error()`   | ✅ Yes |

### Verbose Mode (`verbose: true`)

| Method      | Shown? |
| ----------- | ------ |
| `debug()`   | ✅ Yes |
| `info()`    | ✅ Yes |
| `success()` | ✅ Yes |
| `warn()`    | ✅ Yes |
| `error()`   | ✅ Yes |

### Default Mode (`quiet: false`, `verbose: false`)

| Method      | Shown? |
| ----------- | ------ |
| `debug()`   | ❌ No  |
| `info()`    | ✅ Yes |
| `success()` | ✅ Yes |
| `warn()`    | ✅ Yes |
| `error()`   | ✅ Yes |

---

## Related Modules

- **[colors](./core/colors.md)** - Provides ANSI color codes and color support detection (re-exported from `olinda_shell_interface.js`)
- **[errors](./utils/errors.md)** - Custom error types often logged with `logger.error()`

---

## Best Practices

1. **Use appropriate log levels:**

   ```javascript
   logger.debug('Cache size: 1024KB'); // Development info
   logger.info('Processing...'); // User-facing info
   logger.success('Done!'); // Positive outcome
   logger.warn('Deprecated'); // Non-critical issue
   logger.error('Failed'); // Critical issue
   ```

2. **Create contextual loggers:**

   ```javascript
   // ✅ Good - clear context
   const dbLogger = new Logger({ prefix: '[Database]' });
   const apiLogger = new Logger({ prefix: '[API]' });

   // ❌ Less clear
   logger.info('[Database] Connected');
   logger.info('[API] Server started');
   ```

3. **Respect quiet mode in non-critical operations:**

   ```javascript
   if (!options.quiet) {
     logger.info('Optional status update');
   }

   // Or use a logger configured with quiet mode
   const optionalLogger = new Logger({ quiet: options.quiet });
   ```

4. **Use verbose mode for debugging:**
   ```javascript
   // Enable with --verbose flag
   const logger = new Logger({ verbose: process.argv.includes('--verbose') });
   logger.debug('Internal state:', state);
   ```

---

## Implementation Notes

- **Console API:** Uses `console.log()`, `console.warn()`, and `console.error()`
- **Immutable instances:** Logger state is set at construction and doesn't change
- **Thread-safe:** All operations are synchronous
- **No file output:** Logs only to console (use shell redirection for files)

---

**Last Updated:** 2026-02-01
**Part of:** AI Workflow Automation v1.7.3
