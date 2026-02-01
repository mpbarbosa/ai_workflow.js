# argument_parser - CLI Argument Parser

**Module:** `lib/argument_parser`  
**Version:** 2.0.0  
**Type:** Pure Functions + Wrapper

## Overview

CLI argument parsing with validation. Parses flags, options, and positional arguments.

---

## Pure Functions

### `parseArguments(args)`

Parse raw argument array.

**Returns:** `{flags: [], options: {}, positional: []}`

**Example:**

```javascript
const args = ['--verbose', '--output', 'file.txt', 'input.txt'];
const parsed = parseArguments(args);
// {
//   flags: ['verbose'],
//   options: {output: 'file.txt'},
//   positional: ['input.txt']
// }
```

### `validateArguments(parsed, schema)`

Validate parsed arguments against schema.

**Returns:** `{valid: boolean, errors: string[]}`

---

## ArgumentParser Class

Wrapper with schema validation.

**Constructor:**

```javascript
new ArgumentParser(schema);
```

**Methods:**

- `parse(args)` - Parse and validate arguments
- `getHelp()` - Generate help text

---

## Usage Examples

### Basic Parsing

```javascript
import { ArgumentParser } from './lib/argument_parser.js';

const parser = new ArgumentParser({
  flags: {
    verbose: { description: 'Verbose output' },
  },
  options: {
    output: { type: 'string', required: true },
  },
});

const args = parser.parse(process.argv.slice(2));
console.log(args.options.output);
```

---

**Last Updated:** 2026-02-01  
**Part of:** AI Workflow Automation v1.0.0
