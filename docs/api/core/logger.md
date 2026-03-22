# logger.js API Documentation

**Module:** `core/logger`
**Version:** 1.9.0
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
const logger = new Logger();

async function loadConfig(filePath) {
  try {
    const config = await readConfigFile(filePath);
    logger.success(`Configuration loaded: ${filePath}`);
    return config;
  } catch (err) {
    logger.error(`Failed to load configuration: ${filePath}`, err);
    throw err;
  }
}
```

### Multi-Level Logging

```javascript
const logger = new Logger({ verbose: true });

function processWorkflow() {
  logger.info('Starting workflow processing');

  try {
    logger.debug('Loading configuration');
    const config = loadConfig();

    logger.debug('Validating inputs');
    validateInputs(config);

    logger.debug('Running steps');
    runSteps(config);

    logger.success('Workflow completed successfully');
  } catch (err) {
    logger.error('Workflow failed', err);
    throw err;
  }
}
```

### Conditional Logging

```javascript
const logger = new Logger();

function processData(items) {
  if (items.length === 0) {
    logger.warn('No items to process');
    return;
  }

  logger.info(`Processing ${items.length} items`);

  const processed = items
    .map((item) => {
      try {
        return processItem(item);
      } catch (err) {
        logger.error(`Failed to process item ${item.id}`, err);
        return null;
      }
    })
    .filter(Boolean);

  logger.success(`Processed ${processed.length}/${items.length} items`);
}
```

## Terminal Support

The logger automatically detects terminal capabilities:

- **Color Support:** Uses ANSI colors if terminal supports them
- **No Color:** Falls back to plain text if `NO_COLOR` environment variable is set
- **Emoji Support:** Uses Unicode symbols (✓, ⚠, ✗) for success, warn, error

## Color Scheme

| Level   | Color  | Symbol | Use Case                  |
| ------- | ------ | ------ | ------------------------- |
| DEBUG   | Dim    | (none) | Verbose debugging         |
| INFO    | Blue   | (none) | General information       |
| SUCCESS | Green  | ✓      | Successful operations     |
| WARN    | Yellow | ⚠      | Warnings and deprecations |
| ERROR   | Red    | ✗      | Errors and failures       |
| PLAIN   | None   | (none) | Unformatted output        |

## Internal Methods

### `_format(message, level)`

Internal method for message formatting (not part of public API).

**Parameters:**

- `message` (string) - Message to format
- `level` (string) - Log level ('debug', 'info', 'success', 'warn', 'error')

**Returns:** (string) Formatted message with color and prefix

## Best Practices

### 1. Use Appropriate Log Levels

```javascript
// Good
logger.debug('Variable value:', value); // For debugging
logger.info('Starting process'); // For information
logger.success('File saved'); // For success
logger.warn('Using default config'); // For warnings
logger.error('Failed to connect', err); // For errors

// Bad
logger.info('Error occurred'); // Use error() instead
logger.error('Processing complete'); // Use success() instead
```

### 2. Include Context in Messages

```javascript
// Good
logger.error(`Failed to load config: ${filePath}`, err);
logger.success(`Processed ${count} files in ${duration}ms`);

// Bad
logger.error('Error', err);
logger.success('Done');
```

### 3. Use Verbose Mode for Debugging

```javascript
const logger = new Logger({
  verbose: process.env.DEBUG === 'true',
});

logger.debug('Detailed debugging information'); // Only in DEBUG mode
logger.info('Always visible information'); // Always visible
```

### 4. Respect Quiet Mode

```javascript
// Quiet mode should suppress all output
const logger = new Logger({
  quiet: process.argv.includes('--quiet'),
});

// All logger calls respect quiet mode automatically
logger.info('This respects quiet mode');
```

## Error Handling

The logger itself does not throw errors. If console methods fail (rare), errors are silently ignored.

## Performance Considerations

- Message formatting only occurs if the message will be displayed
- Minimal overhead in quiet mode (early return)
- No file I/O - all output goes to console

## Related Modules

- **[colors](./colors.md)** - ANSI color codes used by logger
- **[errors](../utils/errors.md)** - Custom error classes that work with logger

## Migration from v0.x

If upgrading from a previous version:

```javascript
// v0.x
log('info', 'Message');

// v1.0.0
const logger = new Logger();
logger.info('Message');
```

## See Also

- [Colors API Documentation](./colors.md)
- [Architecture Overview](../../architecture/OVERVIEW.md)
- [Developer Guide](../../guides/DEVELOPER_GUIDE.md)
