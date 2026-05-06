# argument_parser.js

**Argument Parser Module** - CLI argument parsing with schema validation and help generation

## Overview

The Argument Parser module provides comprehensive CLI argument parsing with schema-based validation, type coercion, default values, and auto-generated help text. It implements pure parsing and validation functions combined with an impure wrapper class for error handling and logging.

**Module:** `lib/argument_parser`
**Version:** 2.3.1
**Architecture:** Referentially Transparent (Pure Functions + Impure Wrapper)

## Installation

```javascript
import { ArgumentParser, parseArguments, validateArguments } from './src/lib/argument_parser.js';
```

## Architecture

### v2.0.0 Pattern: Referential Transparency

This module follows the v2.0.0 architecture pattern:

- **Pure Functions (8 functions)**: Argument parsing, validation, type coercion
  - Deterministic: Same input always produces same output
  - No side effects: No I/O, state mutation, or external dependencies
  - Easily testable: No mocks required
- **Impure Wrapper (ArgumentParser class)**: Process parsing, error handling
  - Handles process.argv extraction
  - Logs validation errors
  - Throws ValidationError for invalid arguments
  - Wraps pure functions with real CLI interactions

## Pure Functions

### parseArguments(args)

Parse raw argument array into structured format supporting flags, options, and positional arguments.

**Parameters:**

- `args` (string[]): Raw argument array (e.g., process.argv.slice(2))

**Returns:** Object with parsed arguments

```javascript
{
  flags: string[],           // Boolean flags: --verbose, -v
  options: Object,           // Key-value options: --name=value, -n value
  positional: string[]       // Positional arguments
}
```

**Example:**

```javascript
const args = ['build', '--verbose', '--output', 'dist', '-f', 'src/app.js'];
const parsed = parseArguments(args);
console.log(parsed);
// {
//   flags: ['verbose', 'f'],
//   options: { output: 'dist' },
//   positional: ['build', 'src/app.js']
// }
```

**Argument Formats Supported:**

- Long flags: `--verbose`, `--help`
- Short flags: `-v`, `-h`
- Chained short flags: `-vhf` → `['v', 'h', 'f']`
- Long options: `--output dist`, `--output=dist`
- Short options: `-o dist` (last flag in chain gets value)
- Positional: `command arg1 arg2`

### validateArguments(parsed, schema)

Validate parsed arguments against a schema definition.

**Parameters:**

- `parsed` (Object): Parsed arguments from parseArguments()
- `schema` (Object): Validation schema

**Schema Format:**

```javascript
{
  description: "Program description",
  flags: {
    verbose: {
      alias: 'v',
      description: 'Enable verbose output',
      required: false
    }
  },
  options: {
    output: {
      alias: 'o',
      type: 'string',
      required: true,
      description: 'Output directory',
      choices: ['dist', 'build'],
      default: 'dist'
    },
    port: {
      type: 'number',
      description: 'Server port'
    }
  },
  positional: [
    { name: 'command', required: true, description: 'Command to run' },
    { name: 'file', required: false, description: 'Input file' }
  ]
}
```

**Returns:** Object with validation result

```javascript
{
  valid: boolean,
  errors: string[]
}
```

**Example:**

```javascript
const schema = {
  options: {
    output: { type: 'string', required: true },
  },
};

const parsed = { flags: [], options: {}, positional: [] };
const result = validateArguments(parsed, schema);
console.log(result);
// { valid: false, errors: ['Required option missing: --output'] }
```

### validateType(value, type, name)

Validate that a value matches expected type.

**Parameters:**

- `value` (\*): Value to validate
- `type` (string): Expected type: 'string', 'number', 'integer', 'boolean'
- `name` (string): Argument name for error messages

**Returns:** Error message string or null if valid

**Example:**

```javascript
validateType('42', 'number', 'port'); // null (valid)
validateType('abc', 'number', 'port'); // '--port must be a number'
validateType('true', 'boolean', 'flag'); // null (valid)
```

### coerceTypes(parsed, schema)

Coerce argument values to their specified types.

**Parameters:**

- `parsed` (Object): Parsed arguments
- `schema` (Object): Schema with type definitions

**Returns:** New object with coerced types

**Example:**

```javascript
const parsed = { options: { port: '3000', verbose: 'true' } };
const schema = {
  options: {
    port: { type: 'number' },
    verbose: { type: 'boolean' },
  },
};

const coerced = coerceTypes(parsed, schema);
console.log(coerced.options);
// { port: 3000, verbose: true }
```

**Type Coercion Rules:**

- `number`: Converts string to Number
- `integer`: Converts string to Number (must be whole)
- `boolean`: Converts 'true'/'false' strings to boolean
- `string`: No conversion

### applyDefaults(parsed, schema)

Apply default values from schema to missing options.

**Parameters:**

- `parsed` (Object): Parsed arguments
- `schema` (Object): Schema with default values

**Returns:** New object with defaults applied

**Example:**

```javascript
const parsed = { options: {} };
const schema = {
  options: {
    port: { default: 3000 },
    host: { default: 'localhost' },
  },
};

const withDefaults = applyDefaults(parsed, schema);
console.log(withDefaults.options);
// { port: 3000, host: 'localhost' }
```

### normalizeAliases(parsed, schema)

Convert short aliases to full option names.

**Parameters:**

- `parsed` (Object): Parsed arguments
- `schema` (Object): Schema with alias definitions

**Returns:** New object with normalized names

**Example:**

```javascript
const parsed = {
  flags: ['v'],
  options: { o: 'dist' },
};
const schema = {
  flags: { verbose: { alias: 'v' } },
  options: { output: { alias: 'o' } },
};

const normalized = normalizeAliases(parsed, schema);
console.log(normalized);
// {
//   flags: ['verbose'],
//   options: { output: 'dist' }
// }
```

### generateHelpText(schema, programName)

Generate formatted help text from schema.

**Parameters:**

- `schema` (Object): Argument schema
- `programName` (string): Program name (default: 'program')

**Returns:** Formatted help text string

**Example:**

```javascript
const schema = {
  description: 'Build and deploy application',
  options: {
    output: {
      alias: 'o',
      type: 'string',
      description: 'Output directory',
      default: 'dist',
    },
  },
  flags: {
    verbose: { alias: 'v', description: 'Verbose output' },
  },
  positional: [{ name: 'command', required: true, description: 'Command to run' }],
};

console.log(generateHelpText(schema, 'ai-workflow'));
```

**Output:**

```
Usage: ai-workflow [options] <command>

Build and deploy application

Arguments:
  command               Command to run (required)

Options:
  -o, --output <string>      Output directory (default: dist)

Flags:
  -v, --verbose              Verbose output
```

## Impure Wrapper Class

### ArgumentParser

Wrapper class that combines pure functions with process argument handling and error management.

#### Constructor

```javascript
new ArgumentParser(schema, options);
```

**Parameters:**

- `schema` (Object): Validation schema
- `options` (Object): Parser options
  - `programName` (string): Program name for help text
  - `verbose` (boolean): Enable verbose logging

**Example:**

```javascript
const parser = new ArgumentParser(
  {
    description: 'AI Workflow CLI',
    options: {
      config: {
        type: 'string',
        description: 'Config file path',
        default: '.workflow-config.yaml',
      },
    },
  },
  {
    programName: 'ai-workflow',
    verbose: true,
  }
);
```

#### Methods

##### parse(args)

Parse and validate arguments (combines all pure functions).

**Parameters:**

- `args` (string[]): Arguments to parse (defaults to process.argv.slice(2))

**Returns:** Parsed, validated, and normalized arguments

**Throws:** ValidationError if validation fails

**Example:**

```javascript
try {
  const args = parser.parse(['--config', 'custom.yaml', '--verbose']);
  console.log(args);
  // {
  //   flags: ['verbose'],
  //   options: { config: 'custom.yaml' },
  //   positional: []
  // }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
```

##### showHelp()

Display generated help text and exit.

**Example:**

```javascript
if (args.flags.includes('help')) {
  parser.showHelp();
  // Prints help text and exits process
}
```

## Usage Examples

### Basic CLI Application

```javascript
import { ArgumentParser } from './src/lib/argument_parser.js';

const schema = {
  description: 'File processor utility',
  options: {
    input: {
      alias: 'i',
      type: 'string',
      required: true,
      description: 'Input file path',
    },
    output: {
      alias: 'o',
      type: 'string',
      default: 'output.txt',
      description: 'Output file path',
    },
    threads: {
      alias: 't',
      type: 'integer',
      default: 4,
      description: 'Number of threads',
    },
  },
  flags: {
    verbose: { alias: 'v', description: 'Verbose output' },
    help: { alias: 'h', description: 'Show help' },
  },
};

const parser = new ArgumentParser(schema, { programName: 'fileproc' });

try {
  const args = parser.parse();

  if (args.flags.includes('help')) {
    parser.showHelp();
  }

  console.log('Processing:', args.options.input);
  console.log('Output:', args.options.output);
  console.log('Threads:', args.options.threads);
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
```

### Custom Validation

```javascript
const schema = {
  options: {
    port: {
      type: 'integer',
      description: 'Server port',
      validate: (value) => {
        if (value < 1024 || value > 65535) {
          return 'Port must be between 1024 and 65535';
        }
        return null;
      },
    },
    env: {
      type: 'string',
      choices: ['dev', 'staging', 'prod'],
      description: 'Environment',
    },
  },
};
```

### Multiple Positional Arguments

```javascript
const schema = {
  positional: [
    { name: 'source', required: true, description: 'Source directory' },
    { name: 'dest', required: true, description: 'Destination directory' },
    { name: 'pattern', required: false, description: 'File pattern to copy' },
  ],
};

// Usage: mycli src/ dest/ "*.js"
```

## Testing

### Testing Pure Functions

```javascript
import { parseArguments, validateArguments, coerceTypes } from './src/lib/argument_parser.js';

describe('Pure Functions', () => {
  test('parseArguments handles mixed arguments', () => {
    const args = ['cmd', '--verbose', '-o', 'dist', 'file.js'];
    const result = parseArguments(args);

    expect(result.positional).toEqual(['cmd', 'file.js']);
    expect(result.flags).toContain('verbose');
    expect(result.options.o).toBe('dist');
  });

  test('coerceTypes converts string to number', () => {
    const parsed = { options: { port: '3000' } };
    const schema = { options: { port: { type: 'number' } } };

    const result = coerceTypes(parsed, schema);
    expect(result.options.port).toBe(3000);
  });
});
```

### Integration Testing

```javascript
import { ArgumentParser } from './src/lib/argument_parser.js';

describe('ArgumentParser Integration', () => {
  test('parse validates and normalizes', () => {
    const parser = new ArgumentParser({
      options: {
        output: { alias: 'o', type: 'string', default: 'dist' },
      },
    });

    const result = parser.parse(['-o', 'build']);
    expect(result.options.output).toBe('build'); // Alias normalized
  });
});
```

## Error Handling

**ValidationError:** Thrown when arguments fail validation

```javascript
try {
  const args = parser.parse(['--invalid']);
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Validation failed:', error.message);
    // Show help or usage information
    parser.showHelp();
  }
}
```

## Best Practices

1. **Define Complete Schemas**: Include descriptions for auto-generated help
2. **Use Type Coercion**: Leverage automatic type conversion for cleaner code
3. **Provide Defaults**: Set sensible defaults for optional parameters
4. **Use Aliases**: Support both short and long forms for better UX
5. **Validate Early**: Parse and validate arguments before business logic
6. **Show Help**: Always provide `-h`/`--help` flag with clear documentation

## Related Modules

- `utils/errors.js` - ValidationError class
- `core/logger.js` - Logging for verbose mode

## References

- Test Suite: `test/lib/argument_parser.test.js`
- Source Code: `src/lib/argument_parser.js`

---

**Last Updated:** 2026-02-07
**Module Version:** 2.0.0
**Architecture:** Referentially Transparent
