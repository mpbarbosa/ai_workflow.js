# jq_wrapper

**Module:** `src/lib/jq_wrapper.js`
**Version:** 2.3.2
**Architecture:** Pure functions + Impure wrapper

Safe JSON operations with jq command-line tool integration.

---

## Overview

The `jq_wrapper` module provides a safe wrapper for `jq` command execution with validation, logging, and error handling. It prevents common jq errors like empty `--argjson` values and provides clear error messages with context.

### Key Features

- **Argument Validation**: Prevents empty `--argjson` values
- **Safe Execution**: Validates JSON inputs before passing to jq
- **Error Handling**: Clear error messages with caller context
- **Debug Logging**: Optional debug output for troubleshooting
- **JSON Parsing**: Automatic result parsing with error recovery
- **Command Building**: Proper escaping and argument formatting

### Supported Operations

- JSON validation and sanitization
- Safe jq command execution
- --argjson argument validation
- Command string building
- JSON parsing of jq output

---

## Installation

```javascript
import { JqWrapper, validateJson, sanitizeArgjsonValue } from './lib/jq_wrapper.js';
```

---

## Pure Functions

### validateJson

Validate if a string is well-formed JSON.

**Signature:**

```javascript
function validateJson(jsonString: string): boolean
```

**Parameters:**

- `jsonString` (string): JSON string to validate

**Returns:**

- (boolean): True if valid JSON, false otherwise

**Pure:** ✅ Yes

**Example:**

```javascript
validateJson('{"foo": "bar"}'); // true
validateJson('{invalid}'); // false
validateJson(''); // false
validateJson('null'); // true
validateJson('[1, 2, 3]'); // true
```

---

### sanitizeArgjsonValue

Sanitize a value for use with jq `--argjson` flag. Ensures value is a valid JSON primitive (number, boolean, null, or object/array).

**Signature:**

```javascript
function sanitizeArgjsonValue(value: any, defaultValue?: any): number | boolean | null | string
```

**Parameters:**

- `value` (any): Value to sanitize
- `defaultValue` (any, optional): Default value if sanitization fails (default: 0)

**Returns:**

- (number | boolean | null | string): Sanitized JSON primitive

**Pure:** ✅ Yes

**Example:**

```javascript
sanitizeArgjsonValue(42); // 42
sanitizeArgjsonValue('true'); // true
sanitizeArgjsonValue('invalid', 0); // 0
sanitizeArgjsonValue({ foo: 'bar' }); // {foo: 'bar'} (parsed object)
sanitizeArgjsonValue(''); // 0 (default)
sanitizeArgjsonValue(NaN, 99); // 99
sanitizeArgjsonValue([1, 2, 3]); // [1, 2, 3]
```

---

### parseJqArguments

Parse jq command arguments to extract `--argjson` pairs.

**Signature:**

```javascript
function parseJqArguments(args: string[]): {
  argjsonPairs: Array<{name: string, value: string}>,
  otherArgs: string[]
}
```

**Parameters:**

- `args` (string[]): jq command arguments

**Returns:**

- (Object): Object with `argjsonPairs` array and `otherArgs` array

**Pure:** ✅ Yes

**Example:**

```javascript
parseJqArguments(['--argjson', 'count', '5', '.foo']);
// {
//   argjsonPairs: [{name: 'count', value: '5'}],
//   otherArgs: ['.foo']
// }

parseJqArguments(['-n', '--argjson', 'x', '10', '--argjson', 'y', '20', '{sum: ($x + $y)}']);
// {
//   argjsonPairs: [
//     {name: 'x', value: '10'},
//     {name: 'y', value: '20'}
//   ],
//   otherArgs: ['-n', '{sum: ($x + $y)}']
// }
```

---

### validateArgjsonPairs

Validate `--argjson` argument pairs.

**Signature:**

```javascript
function validateArgjsonPairs(argjsonPairs: Array<{name: string, value: string}>): {
  valid: boolean,
  errors: string[]
}
```

**Parameters:**

- `argjsonPairs` (Array): Parsed `--argjson` pairs from `parseJqArguments`

**Returns:**

- (Object): Validation result with `valid` boolean and `errors` array

**Pure:** ✅ Yes

**Example:**

```javascript
validateArgjsonPairs([{ name: 'count', value: '5' }]);
// { valid: true, errors: [] }

validateArgjsonPairs([{ name: 'count', value: '' }]);
// { valid: false, errors: ['--argjson variable "count" has empty value'] }

validateArgjsonPairs([{ name: 'data', value: 'not-json' }]);
// { valid: false, errors: ['--argjson variable "data" value "not-json" may not be valid JSON'] }
```

---

### buildJqCommand

Build jq command string from arguments with proper escaping.

**Signature:**

```javascript
function buildJqCommand(args: string[]): string
```

**Parameters:**

- `args` (string[]): jq command arguments

**Returns:**

- (string): Escaped command string ready for execution

**Pure:** ✅ Yes

**Example:**

```javascript
buildJqCommand(['-n', '--arg', 'name', 'test', '{name: $name}']);
// "jq -n --arg name test '{name: $name}'"

buildJqCommand(['-n', '{foo: "bar with spaces"}']);
// "jq -n '{foo: \"bar with spaces\"}'"
```

---

## Wrapper Class

### JqWrapper

Safe jq command execution with validation and logging.

**Constructor:**

```javascript
new JqWrapper(options?: {
  debug?: boolean,
  callerContext?: string
})
```

**Options:**

- `debug` (boolean, optional): Enable debug logging (default: false)
- `callerContext` (string, optional): Caller context for error messages (default: 'unknown')

**Side Effects:** Executes shell commands, logs to console, performs file I/O

---

### Methods

#### execute

Execute jq command with validation.

**Signature:**

```javascript
execute(args: string[], options?: {
  throwOnError?: boolean
}): string
```

**Parameters:**

- `args` (string[]): jq command arguments
- `options.throwOnError` (boolean, optional): Throw error on validation/execution failure (default: true)

**Returns:**

- (string): jq command output (empty string on error if throwOnError=false)

**Throws:**

- `ExecutionError`: If validation fails or jq execution fails (when throwOnError=true)

**Side Effects:** Executes shell command, logs errors/debug info

**Example:**

```javascript
const wrapper = new JqWrapper({ debug: true, callerContext: 'test-script' });

// Simple execution
const result = wrapper.execute(['-n', '{foo: "bar"}']);
// => '{\n  "foo": "bar"\n}\n'

// With --argjson
const result2 = wrapper.execute(['-n', '--argjson', 'count', '5', '{count: $count}']);
// => '{\n  "count": 5\n}\n'

// Non-throwing mode
const result3 = wrapper.execute(['invalid syntax'], { throwOnError: false });
// => '' (empty string, error logged)
```

---

#### executeAndParse

Execute jq command and parse result as JSON.

**Signature:**

```javascript
executeAndParse(args: string[], options?: {
  throwOnError?: boolean
}): any
```

**Parameters:**

- `args` (string[]): jq command arguments
- `options` (Object, optional): Execution options (same as execute)

**Returns:**

- (any): Parsed JSON result

**Throws:**

- `ExecutionError`: If execution or JSON parsing fails

**Side Effects:** Executes shell command, logs errors/debug info

**Example:**

```javascript
const wrapper = new JqWrapper();

const obj = wrapper.executeAndParse(['-n', '{foo: "bar", count: 42}']);
// => { foo: 'bar', count: 42 }

const arr = wrapper.executeAndParse(['-n', '[1, 2, 3]']);
// => [1, 2, 3]
```

---

## Usage Examples

### Example 1: Basic JSON Processing

```javascript
import { JqWrapper } from './lib/jq_wrapper.js';

const wrapper = new JqWrapper({ debug: true });

// Simple object creation
const result = wrapper.execute(['-n', '{name: "Alice", age: 30}']);
console.log(result);
// {
//   "name": "Alice",
//   "age": 30
// }
```

---

### Example 2: Using --argjson with Validation

```javascript
import { JqWrapper } from './lib/jq_wrapper.js';

const wrapper = new JqWrapper({ callerContext: 'user-processor' });

// Safe --argjson usage (validated)
const result = wrapper.executeAndParse([
  '-n',
  '--argjson',
  'count',
  '5',
  '--argjson',
  'active',
  'true',
  '{count: $count, active: $active}',
]);

console.log(result);
// { count: 5, active: true }
```

---

### Example 3: Validating JSON Before Processing

```javascript
import { validateJson, JqWrapper } from './lib/jq_wrapper.js';

const userInput = '{"name": "Bob", "age": 25}';

if (validateJson(userInput)) {
  const wrapper = new JqWrapper();
  const result = wrapper.executeAndParse([userInput, '.name']);
  console.log(`User: ${result}`);
  // User: Bob
} else {
  console.error('Invalid JSON input');
}
```

---

### Example 4: Sanitizing Values for --argjson

```javascript
import { sanitizeArgjsonValue, JqWrapper } from './lib/jq_wrapper.js';

const userCount = 'invalid-number';
const sanitized = sanitizeArgjsonValue(userCount, 0);

const wrapper = new JqWrapper();
const result = wrapper.executeAndParse([
  '-n',
  '--argjson',
  'count',
  String(sanitized),
  '{count: $count}',
]);

console.log(result);
// { count: 0 } (used default value)
```

---

### Example 5: Error Handling with Context

```javascript
import { JqWrapper } from './lib/jq_wrapper.js';

const wrapper = new JqWrapper({
  debug: true,
  callerContext: 'data-processor',
});

try {
  // Invalid --argjson (empty value)
  wrapper.execute(['-n', '--argjson', 'count', '', '{count: $count}']);
} catch (error) {
  console.error(`Error in ${error.context}: ${error.message}`);
  // Error in data-processor: jq_safe validation failed in data-processor:
  //   - --argjson variable "count" has empty value
}
```

---

### Example 6: Non-Throwing Error Mode

```javascript
import { JqWrapper } from './lib/jq_wrapper.js';

const wrapper = new JqWrapper({ callerContext: 'batch-processor' });

// Process multiple items, continue on error
const items = ['valid', '', 'also-valid'];

for (const item of items) {
  const result = wrapper.execute(
    ['-n', '--argjson', 'item', item, '{item: $item}'],
    { throwOnError: false } // Don't throw, return empty string on error
  );

  if (result) {
    console.log('Processed:', result);
  } else {
    console.log('Skipped invalid item');
  }
}
```

---

### Example 7: Parsing Arguments for Debugging

```javascript
import { parseJqArguments, validateArgjsonPairs } from './lib/jq_wrapper.js';

const args = ['--argjson', 'x', '10', '--argjson', 'y', '', '.result'];

const { argjsonPairs, otherArgs } = parseJqArguments(args);
console.log('Pairs:', argjsonPairs);
// Pairs: [ {name: 'x', value: '10'}, {name: 'y', value: ''} ]

const validation = validateArgjsonPairs(argjsonPairs);
if (!validation.valid) {
  console.error('Validation errors:', validation.errors);
  // Validation errors: ['--argjson variable "y" has empty value']
}
```

---

## Related Modules

- **[executor](../core/executor.md)** - Command execution utilities
- **[logger](../core/logger.md)** - Logging system
- **[errors](../utils/errors.md)** - Error classes

---

## Notes

### jq Availability

This module requires the `jq` command-line tool to be installed:

```bash
# macOS
brew install jq

# Ubuntu/Debian
sudo apt-get install jq

# Alpine
apk add jq
```

### Performance Considerations

- Each `execute()` call spawns a new jq process
- Maximum buffer size: 10MB (configurable in source)
- For bulk operations, consider batching jq operations

### Common Pitfalls

1. **Empty --argjson values**: Always validate with `validateArgjsonPairs` or use `sanitizeArgjsonValue`
2. **JSON escaping**: Use `buildJqCommand` for proper escaping
3. **Large output**: Set `maxBuffer` appropriately for large JSON processing
4. **Error context**: Set `callerContext` for better debugging

### Migration Notes

Migrated from `src/workflow/lib/jq_wrapper.sh` (v1.0.1) with enhancements:

- Added pure function architecture
- Improved validation logic
- Enhanced error messages with context
- Added JSON parsing support

---

**Last Updated:** 2026-02-07
**Stability:** Stable
**Test Coverage:** 100%
