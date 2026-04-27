/**
 * @fileoverview Tests for CLI Index Module
 * @module test/cli/index
 */

import {
  createProgramConfig,
  validateCliArgs,
  createProgram,
  applyGlobalOptions,
} from '../../src/cli/index.js';

describe('CLI Index - Pure Functions', () => {
  describe('createProgramConfig', () => {
    test('should create program configuration', () => {
      const config = createProgramConfig('1.0.0', 'Test CLI');

      expect(config).toHaveProperty('version', '1.0.0');
      expect(config).toHaveProperty('description', 'Test CLI');
      expect(config).toHaveProperty('name', 'ai-workflow');
      expect(config).toHaveProperty('usage');
    });

    test('should handle empty description', () => {
      const config = createProgramConfig('1.0.0', '');

      expect(config.description).toBe('');
    });
  });

  describe('validateCliArgs', () => {
    test('should validate correct arguments', () => {
      const args = ['node', 'script.js', 'command'];
      const result = validateCliArgs(args);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('should reject non-array arguments', () => {
      const result = validateCliArgs('not an array');

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(['Arguments must be an array']);
    });

    test('should reject too few arguments', () => {
      const result = validateCliArgs(['node']);

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(['Invalid arguments: missing node and script path']);
    });
  });
});

describe('CLI Index - Integration Tests', () => {
  describe('createProgram', () => {
    test('should create commander program', () => {
      const program = createProgram();

      expect(program).toBeDefined();
      expect(program.name()).toBe('ai-workflow');
      expect(program.version()).toMatch(/\d+\.\d+\.\d+/);
    });

    test('should have global options', () => {
      const program = createProgram();
      const options = program.options;

      const optionNames = options.map((opt) => opt.long);
      expect(optionNames).toContain('--verbose');
      expect(optionNames).toContain('--quiet');
      expect(optionNames).toContain('--no-color');
      expect(optionNames).toContain('--config');
    });

    test('should have required commands', () => {
      const program = createProgram();
      const commands = program.commands.map((cmd) => cmd.name());

      expect(commands).toContain('run');
      expect(commands).toContain('resume');
      expect(commands).toContain('status');
      expect(commands).toContain('config');
      expect(commands).toContain('clean');
    });
  });
});

describe('CLI Index - applyGlobalOptions', () => {
  let mockLogger;

  beforeEach(() => {
    mockLogger = { verbose: false, quiet: false };
  });

  test('should set verbose to true when opts.verbose is true', () => {
    applyGlobalOptions({ verbose: true, quiet: false }, mockLogger);
    expect(mockLogger.verbose).toBe(true);
  });

  test('should set quiet to true when opts.quiet is true', () => {
    applyGlobalOptions({ verbose: false, quiet: true }, mockLogger);
    expect(mockLogger.quiet).toBe(true);
  });

  test('should set both verbose and quiet when both are true', () => {
    applyGlobalOptions({ verbose: true, quiet: true }, mockLogger);
    expect(mockLogger.verbose).toBe(true);
    expect(mockLogger.quiet).toBe(true);
  });

  test('should default verbose and quiet to false when not provided', () => {
    applyGlobalOptions({}, mockLogger);
    expect(mockLogger.verbose).toBe(false);
    expect(mockLogger.quiet).toBe(false);
  });

  test('should reset verbose to false when opts.verbose is falsy', () => {
    mockLogger.verbose = true;
    applyGlobalOptions({ verbose: false }, mockLogger);
    expect(mockLogger.verbose).toBe(false);
  });
});
