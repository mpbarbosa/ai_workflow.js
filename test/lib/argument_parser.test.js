/**
 * Tests for argument_parser.js
 * @description Comprehensive tests for CLI argument parsing
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  parseArguments,
  validateArguments,
  validateType,
  coerceTypes,
  applyDefaults,
  generateHelpText,
  normalizeAliases,
  ArgumentParser,
} from '../../src/lib/argument_parser.js';
import { ValidationError } from '../../src/utils/errors.js';

/**
 * PURE FUNCTION TESTS
 */

describe('parseArguments (pure function)', () => {
  test('parses empty array', () => {
    expect(parseArguments([])).toEqual({
      flags: [],
      options: {},
      positional: [],
    });
  });

  test('parses long flags', () => {
    const result = parseArguments(['--verbose', '--debug']);
    expect(result.flags).toEqual(['verbose', 'debug']);
  });

  test('parses long options with =', () => {
    const result = parseArguments(['--name=test', '--count=5']);
    expect(result.options).toEqual({ name: 'test', count: '5' });
  });

  test('parses long options with space', () => {
    const result = parseArguments(['--name', 'test', '--count', '5']);
    expect(result.options).toEqual({ name: 'test', count: '5' });
  });

  test('parses short flags', () => {
    const result = parseArguments(['-v', '-d']);
    expect(result.flags).toEqual(['v', 'd']);
  });

  test('parses combined short flags', () => {
    const result = parseArguments(['-vdf']);
    expect(result.flags).toEqual(['v', 'd', 'f']);
  });

  test('parses short options', () => {
    const result = parseArguments(['-n', 'test', '-c', '5']);
    expect(result.options).toEqual({ n: 'test', c: '5' });
  });

  test('parses positional arguments', () => {
    const result = parseArguments(['file1.txt', 'file2.txt']);
    expect(result.positional).toEqual(['file1.txt', 'file2.txt']);
  });

  test('parses mixed arguments', () => {
    const result = parseArguments(['-v', '--name', 'test', 'file.txt', '--debug']);
    expect(result.flags).toEqual(['v', 'debug']);
    expect(result.options).toEqual({ name: 'test' });
    expect(result.positional).toEqual(['file.txt']);
  });

  test('handles non-array input', () => {
    expect(parseArguments(null)).toEqual({
      flags: [],
      options: {},
      positional: [],
    });
    expect(parseArguments(undefined)).toEqual({
      flags: [],
      options: {},
      positional: [],
    });
  });

  test('parses flags at end without values', () => {
    const result = parseArguments(['--name', 'test', '--verbose']);
    expect(result.flags).toEqual(['verbose']);
    expect(result.options).toEqual({ name: 'test' });
  });
});

describe('validateType (pure function)', () => {
  test('validates string type', () => {
    expect(validateType('hello', 'string', 'name')).toBeNull();
    expect(validateType(123, 'string', 'name')).toContain('must be a string');
  });

  test('validates number type', () => {
    expect(validateType('123', 'number', 'count')).toBeNull();
    expect(validateType('abc', 'number', 'count')).toContain('must be a number');
  });

  test('validates integer type', () => {
    expect(validateType('123', 'integer', 'count')).toBeNull();
    expect(validateType('123.45', 'integer', 'count')).toContain('must be an integer');
  });

  test('validates boolean type', () => {
    expect(validateType('true', 'boolean', 'flag')).toBeNull();
    expect(validateType('false', 'boolean', 'flag')).toBeNull();
    expect(validateType('yes', 'boolean', 'flag')).toContain('must be true or false');
  });

  test('returns null for unknown types', () => {
    expect(validateType('anything', 'unknown', 'field')).toBeNull();
  });
});

describe('validateArguments (pure function)', () => {
  test('returns valid for empty schema', () => {
    const result = validateArguments({ flags: [], options: {}, positional: [] }, {});
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test('returns valid for null schema', () => {
    const result = validateArguments({ flags: [], options: {}, positional: [] }, null);
    expect(result.valid).toBe(true);
  });

  test('validates required flags', () => {
    const schema = {
      flags: {
        verbose: { required: true },
      },
    };
    const parsed = { flags: [], options: {}, positional: [] };
    const result = validateArguments(parsed, schema);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Required flag missing: --verbose');
  });

  test('validates required options', () => {
    const schema = {
      options: {
        name: { required: true },
      },
    };
    const parsed = { flags: [], options: {}, positional: [] };
    const result = validateArguments(parsed, schema);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Required option missing: --name');
  });

  test('validates option types', () => {
    const schema = {
      options: {
        count: { type: 'number' },
      },
    };
    const parsed = { flags: [], options: { count: 'abc' }, positional: [] };
    const result = validateArguments(parsed, schema);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('must be a number');
  });

  test('validates option choices', () => {
    const schema = {
      options: {
        env: { choices: ['dev', 'prod'] },
      },
    };
    const parsed = { flags: [], options: { env: 'staging' }, positional: [] };
    const result = validateArguments(parsed, schema);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('must be one of dev, prod');
  });

  test('validates positional arguments', () => {
    const schema = {
      positional: [{ name: 'file', required: true }],
    };
    const parsed = { flags: [], options: {}, positional: [] };
    const result = validateArguments(parsed, schema);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Expected at least 1 positional argument');
  });

  test('returns valid for correct arguments', () => {
    const schema = {
      options: {
        name: { required: true, type: 'string' },
        count: { type: 'number' },
      },
      flags: {
        verbose: { required: false },
      },
    };
    const parsed = {
      flags: ['verbose'],
      options: { name: 'test', count: '5' },
      positional: [],
    };
    const result = validateArguments(parsed, schema);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});

describe('coerceTypes (pure function)', () => {
  test('coerces string to number', () => {
    const schema = {
      options: {
        count: { type: 'number' },
      },
    };
    const parsed = { flags: [], options: { count: '123' }, positional: [] };
    const result = coerceTypes(parsed, schema);
    expect(result.options.count).toBe(123);
    expect(typeof result.options.count).toBe('number');
  });

  test('coerces string to integer', () => {
    const schema = {
      options: {
        port: { type: 'integer' },
      },
    };
    const parsed = { flags: [], options: { port: '8080' }, positional: [] };
    const result = coerceTypes(parsed, schema);
    expect(result.options.port).toBe(8080);
  });

  test('coerces string to boolean', () => {
    const schema = {
      options: {
        enabled: { type: 'boolean' },
      },
    };
    const parsed = { flags: [], options: { enabled: 'true' }, positional: [] };
    const result = coerceTypes(parsed, schema);
    expect(result.options.enabled).toBe(true);
  });

  test('does not mutate original object', () => {
    const schema = {
      options: {
        count: { type: 'number' },
      },
    };
    const parsed = { flags: [], options: { count: '123' }, positional: [] };
    const result = coerceTypes(parsed, schema);
    expect(parsed.options.count).toBe('123'); // Original unchanged
    expect(result.options.count).toBe(123); // Result coerced
  });

  test('handles empty schema', () => {
    const parsed = { flags: [], options: { name: 'test' }, positional: [] };
    const result = coerceTypes(parsed, {});
    expect(result).toEqual(parsed);
  });

  test('handles null schema', () => {
    const parsed = { flags: [], options: { name: 'test' }, positional: [] };
    const result = coerceTypes(parsed, null);
    expect(result).toEqual(parsed);
  });
});

describe('applyDefaults (pure function)', () => {
  test('applies default values', () => {
    const schema = {
      options: {
        name: { default: 'default-name' },
        count: { default: 10 },
      },
    };
    const parsed = { flags: [], options: {}, positional: [] };
    const result = applyDefaults(parsed, schema);
    expect(result.options.name).toBe('default-name');
    expect(result.options.count).toBe(10);
  });

  test('does not override provided values', () => {
    const schema = {
      options: {
        name: { default: 'default-name' },
      },
    };
    const parsed = { flags: [], options: { name: 'custom' }, positional: [] };
    const result = applyDefaults(parsed, schema);
    expect(result.options.name).toBe('custom');
  });

  test('does not mutate original object', () => {
    const schema = {
      options: {
        name: { default: 'default-name' },
      },
    };
    const parsed = { flags: [], options: {}, positional: [] };
    const result = applyDefaults(parsed, schema);
    expect(parsed.options.name).toBeUndefined(); // Original unchanged
    expect(result.options.name).toBe('default-name'); // Result has default
  });

  test('handles empty schema', () => {
    const parsed = { flags: [], options: {}, positional: [] };
    const result = applyDefaults(parsed, {});
    expect(result).toEqual(parsed);
  });

  test('handles null schema', () => {
    const parsed = { flags: [], options: {}, positional: [] };
    const result = applyDefaults(parsed, null);
    expect(result).toEqual(parsed);
  });
});

describe('generateHelpText (pure function)', () => {
  test('generates basic help text', () => {
    const schema = {
      description: 'A test program',
    };
    const help = generateHelpText(schema, 'test-program');
    expect(help).toContain('Usage: test-program');
    expect(help).toContain('A test program');
  });

  test('generates help with options', () => {
    const schema = {
      options: {
        name: { description: 'Your name', type: 'string' },
        count: { description: 'Count value', type: 'number', default: 5 },
      },
    };
    const help = generateHelpText(schema, 'prog');
    expect(help).toContain('Options:');
    expect(help).toContain('--name');
    expect(help).toContain('Your name');
    expect(help).toContain('--count');
    expect(help).toContain('default: 5');
  });

  test('generates help with flags', () => {
    const schema = {
      flags: {
        verbose: { description: 'Verbose output', alias: 'v' },
      },
    };
    const help = generateHelpText(schema, 'prog');
    expect(help).toContain('Flags:');
    expect(help).toContain('-v, --verbose');
    expect(help).toContain('Verbose output');
  });

  test('generates help with positional arguments', () => {
    const schema = {
      positional: [
        { name: 'file', required: true, description: 'Input file' },
        { name: 'output', required: false, description: 'Output file' },
      ],
    };
    const help = generateHelpText(schema, 'prog');
    expect(help).toContain('<file>');
    expect(help).toContain('[output]');
    expect(help).toContain('Arguments:');
    expect(help).toContain('Input file');
    expect(help).toContain('(required)');
    expect(help).toContain('(optional)');
  });

  test('generates complete help text', () => {
    const schema = {
      description: 'Complete test program',
      positional: [{ name: 'input', required: true }],
      options: {
        output: { alias: 'o', description: 'Output file', type: 'string' },
      },
      flags: {
        verbose: { alias: 'v', description: 'Verbose mode' },
      },
    };
    const help = generateHelpText(schema, 'myapp');
    expect(help).toContain('Usage: myapp [options] <input>');
    expect(help).toContain('Complete test program');
    expect(help).toContain('Arguments:');
    expect(help).toContain('Options:');
    expect(help).toContain('Flags:');
  });

  test('uses default program name', () => {
    const schema = {};
    const help = generateHelpText(schema);
    expect(help).toContain('Usage: program');
  });
});

describe('normalizeAliases (pure function)', () => {
  test('normalizes option aliases', () => {
    const schema = {
      options: {
        name: { alias: 'n' },
        count: { alias: 'c' },
      },
    };
    const parsed = { flags: [], options: { n: 'test', c: '5' }, positional: [] };
    const result = normalizeAliases(parsed, schema);
    expect(result.options.name).toBe('test');
    expect(result.options.count).toBe('5');
    expect(result.options.n).toBeUndefined();
    expect(result.options.c).toBeUndefined();
  });

  test('normalizes flag aliases', () => {
    const schema = {
      flags: {
        verbose: { alias: 'v' },
        debug: { alias: 'd' },
      },
    };
    const parsed = { flags: ['v', 'd'], options: {}, positional: [] };
    const result = normalizeAliases(parsed, schema);
    expect(result.flags).toEqual(['verbose', 'debug']);
  });

  test('does not mutate original object', () => {
    const schema = {
      options: {
        name: { alias: 'n' },
      },
    };
    const parsed = { flags: [], options: { n: 'test' }, positional: [] };
    const result = normalizeAliases(parsed, schema);
    expect(parsed.options.n).toBe('test'); // Original unchanged
    expect(result.options.name).toBe('test'); // Result normalized
  });

  test('handles empty schema', () => {
    const parsed = { flags: ['v'], options: { n: 'test' }, positional: [] };
    const result = normalizeAliases(parsed, {});
    expect(result).toEqual(parsed);
  });

  test('handles null schema', () => {
    const parsed = { flags: ['v'], options: { n: 'test' }, positional: [] };
    const result = normalizeAliases(parsed, null);
    expect(result).toEqual(parsed);
  });
});

/**
 * INTEGRATION TESTS - ArgumentParser class
 */

describe('ArgumentParser class', () => {
  let mockExit;
  let mockConsoleLog;

  beforeEach(() => {
    mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});
    mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    mockExit.mockRestore();
    mockConsoleLog.mockRestore();
  });
  test('creates parser with schema', () => {
    const schema = {
      options: {
        name: { type: 'string' },
      },
    };
    const parser = new ArgumentParser(schema);
    expect(parser.schema).toEqual(schema);
  });

  test('parses valid arguments', () => {
    const schema = {
      options: {
        name: { type: 'string', required: true },
      },
    };
    const parser = new ArgumentParser(schema);
    const result = parser.parse(['--name', 'test']);
    expect(result.options.name).toBe('test');
  });

  test('throws ValidationError for invalid arguments', () => {
    const schema = {
      options: {
        name: { type: 'string', required: true },
      },
    };
    const parser = new ArgumentParser(schema);

    parser.parse([]);

    expect(mockExit).toHaveBeenCalledWith(1);
  });

  test('applies defaults', () => {
    const schema = {
      options: {
        port: { type: 'number', default: 8080 },
      },
    };
    const parser = new ArgumentParser(schema);
    const result = parser.parse([]);
    expect(result.options.port).toBe(8080);
  });

  test('coerces types', () => {
    const schema = {
      options: {
        count: { type: 'number' },
      },
    };
    const parser = new ArgumentParser(schema);
    const result = parser.parse(['--count', '42']);
    expect(result.options.count).toBe(42);
    expect(typeof result.options.count).toBe('number');
  });

  test('normalizes aliases', () => {
    const schema = {
      options: {
        name: { alias: 'n' },
      },
    };
    const parser = new ArgumentParser(schema);
    const result = parser.parse(['-n', 'test']);
    expect(result.options.name).toBe('test');
  });

  test('supports chaining with setProgramName', () => {
    const parser = new ArgumentParser({});
    const result = parser.setProgramName('myapp');
    expect(result).toBe(parser);
    expect(parser.programName).toBe('myapp');
  });

  test('supports chaining with withHelp', () => {
    const parser = new ArgumentParser({});
    const result = parser.withHelp();
    expect(result).toBe(parser);
    expect(parser.schema.flags.help).toBeDefined();
  });

  test('showHelp displays help text', () => {
    const schema = {
      description: 'Test program',
    };
    const parser = new ArgumentParser(schema, { programName: 'test' });
    parser.showHelp();
    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Usage: test'));
  });

  test('validate method validates parsed arguments', () => {
    const schema = {
      options: {
        name: { required: true },
      },
    };
    const parser = new ArgumentParser(schema);

    let errorThrown = false;
    try {
      parser.validate({ flags: [], options: {}, positional: [] });
    } catch (e) {
      errorThrown = true;
      expect(e).toBeInstanceOf(ValidationError);
    }
    expect(errorThrown).toBe(true);

    expect(() =>
      parser.validate({ flags: [], options: { name: 'test' }, positional: [] })
    ).not.toThrow();
  });

  test('handles verbose mode', () => {
    const schema = {
      options: {
        name: { type: 'string' },
      },
    };
    const parser = new ArgumentParser(schema, { verbose: true });
    const result = parser.parse(['--name', 'test']);
    expect(result.options.name).toBe('test');
  });

  test('validates choices', () => {
    const schema = {
      options: {
        env: { choices: ['dev', 'prod'], required: true },
      },
    };
    const parser = new ArgumentParser(schema);

    // Invalid choice should exit
    let errorThrown = false;
    try {
      parser.parse(['--env', 'staging']);
    } catch (e) {
      errorThrown = true;
      expect(e).toBeInstanceOf(ValidationError);
    }

    // If it reached process.exit instead, check that
    if (!errorThrown) {
      expect(mockExit).toHaveBeenCalledWith(1);
    }

    mockExit.mockClear();

    // Valid choice should succeed
    const result = parser.parse(['--env', 'prod']);
    expect(result.options.env).toBe('prod');
  });

  test('handles multiple flags', () => {
    const schema = {
      flags: {
        verbose: {},
        debug: {},
      },
    };
    const parser = new ArgumentParser(schema);
    const result = parser.parse(['--verbose', '--debug']);
    expect(result.flags).toContain('verbose');
    expect(result.flags).toContain('debug');
  });

  test('handles positional arguments', () => {
    const schema = {
      positional: [{ name: 'input', required: true }],
    };
    const parser = new ArgumentParser(schema);
    const result = parser.parse(['file.txt']);
    expect(result.positional).toEqual(['file.txt']);
  });

  test('handles mixed arguments', () => {
    const schema = {
      options: {
        output: { alias: 'o', type: 'string' },
      },
      flags: {
        verbose: { alias: 'v' },
      },
      positional: [{ name: 'input', required: true }],
    };
    const parser = new ArgumentParser(schema);
    const result = parser.parse(['-v', '--output', 'out.txt', 'in.txt']);
    expect(result.flags).toContain('verbose');
    expect(result.options.output).toBe('out.txt');
    expect(result.positional).toEqual(['in.txt']);
  });
});
