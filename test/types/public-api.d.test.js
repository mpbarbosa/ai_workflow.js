/**
 * Tests for public API type declarations in src/types/public-api.d.ts.
 * Verifies that every key symbol declared in the public-API surface is
 * actually exported from the package entry point (src/index.js) with the
 * correct runtime shape.
 */
import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';

// Core — Colors
import { colors, colorize, supportsColor } from '../../src/index.js';

// Core — Logger
import { Logger, logger, LogLevel } from '../../src/index.js';

// Core — Executor
import { execute, executeStream, executeSudo } from '../../src/index.js';

// Core — System
import { detectOS, detectPackageManager, commandExists, getSystemInfo } from '../../src/index.js';

// Core — Version
import {
  parseVersion,
  compareVersions,
  isGreaterThan,
  isLessThan,
  isEqual,
  getLatestVersion,
} from '../../src/index.js';

// Utils — Errors
import {
  WorkflowError,
  SystemError,
  ExecutionError,
  ConfigurationError,
  ValidationError,
  FileSystemError,
} from '../../src/index.js';

// Lib — Config / Session / Backlog / Metrics
import { Config, SessionManager, Backlog, Metrics } from '../../src/index.js';

// Lib — File / Edit Operations (pure functions)
import { validatePath, filterByExtension, FileOperations } from '../../src/index.js';

// ─── Colors ──────────────────────────────────────────────────────────────────

describe('Public API: colors', () => {
  it('exports colors object with standard ANSI keys', () => {
    expect(colors).toBeDefined();
    expect(typeof colors).toBe('object');
    for (const key of ['reset', 'red', 'green', 'yellow', 'blue', 'cyan', 'white']) {
      expect(typeof colors[key]).toBe('string');
    }
  });

  it('exports colorize as a function', () => {
    expect(typeof colorize).toBe('function');
  });

  it('exports supportsColor as a function', () => {
    expect(typeof supportsColor).toBe('function');
    expect(typeof supportsColor()).toBe('boolean');
  });
});

// ─── Logger ──────────────────────────────────────────────────────────────────

describe('Public API: logger', () => {
  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    console.log.mockRestore();
    console.warn.mockRestore();
    console.error.mockRestore();
  });

  it('exports logger as a Logger instance', () => {
    expect(logger).toBeDefined();
    expect(logger).toBeInstanceOf(Logger);
  });

  it('Logger class is exported and constructable', () => {
    expect(typeof Logger).toBe('function');
    const l = new Logger();
    expect(l).toBeInstanceOf(Logger);
  });

  it('exports LogLevel enum with expected keys', () => {
    expect(LogLevel).toBeDefined();
    for (const key of ['DEBUG', 'INFO', 'WARN', 'ERROR']) {
      expect(LogLevel[key]).toBeDefined();
    }
  });

  it('logger exposes standard log methods', () => {
    for (const method of ['debug', 'info', 'warn', 'error']) {
      expect(typeof logger[method]).toBe('function');
    }
  });
});

// ─── Executor ────────────────────────────────────────────────────────────────

describe('Public API: executor', () => {
  it('exports execute as a function', () => {
    expect(typeof execute).toBe('function');
  });

  it('exports executeStream as a function', () => {
    expect(typeof executeStream).toBe('function');
  });

  it('exports executeSudo as a function', () => {
    expect(typeof executeSudo).toBe('function');
  });
});

// ─── System ──────────────────────────────────────────────────────────────────

describe('Public API: system', () => {
  it('exports detectOS as a function', () => {
    expect(typeof detectOS).toBe('function');
  });

  it('exports detectPackageManager as a function', () => {
    expect(typeof detectPackageManager).toBe('function');
  });

  it('exports commandExists as a function', () => {
    expect(typeof commandExists).toBe('function');
  });

  it('exports getSystemInfo as a function', () => {
    expect(typeof getSystemInfo).toBe('function');
  });
});

// ─── Version ─────────────────────────────────────────────────────────────────

describe('Public API: version', () => {
  it('exports parseVersion and returns a Version object', () => {
    expect(typeof parseVersion).toBe('function');
    const v = parseVersion('1.2.3');
    expect(v).toMatchObject({ major: 1, minor: 2, patch: 3 });
  });

  it('exports compareVersions correctly', () => {
    expect(typeof compareVersions).toBe('function');
    expect(compareVersions('1.0.0', '2.0.0')).toBe(-1);
    expect(compareVersions('2.0.0', '1.0.0')).toBe(1);
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
  });

  it('exports isGreaterThan, isLessThan, isEqual as functions', () => {
    expect(typeof isGreaterThan).toBe('function');
    expect(typeof isLessThan).toBe('function');
    expect(typeof isEqual).toBe('function');
  });

  it('exports getLatestVersion as a function', () => {
    expect(typeof getLatestVersion).toBe('function');
    expect(getLatestVersion(['1.0.0', '2.0.0', '1.5.0'])).toBe('2.0.0');
  });
});

// ─── Error classes ───────────────────────────────────────────────────────────

describe('Public API: error classes', () => {
  it('WorkflowError is constructable and extends Error', () => {
    const e = new WorkflowError('test');
    expect(e).toBeInstanceOf(Error);
    expect(e).toBeInstanceOf(WorkflowError);
    expect(e.message).toBe('test');
  });

  it('SystemError extends WorkflowError', () => {
    const e = new SystemError('sys');
    expect(e).toBeInstanceOf(WorkflowError);
    expect(e).toBeInstanceOf(SystemError);
  });

  it('ExecutionError extends WorkflowError', () => {
    const e = new ExecutionError('exec');
    expect(e).toBeInstanceOf(WorkflowError);
    expect(e).toBeInstanceOf(ExecutionError);
  });

  it('ConfigurationError extends WorkflowError', () => {
    const e = new ConfigurationError('config');
    expect(e).toBeInstanceOf(WorkflowError);
    expect(e).toBeInstanceOf(ConfigurationError);
  });

  it('ValidationError extends WorkflowError', () => {
    const e = new ValidationError('val');
    expect(e).toBeInstanceOf(WorkflowError);
    expect(e).toBeInstanceOf(ValidationError);
  });

  it('FileSystemError extends WorkflowError', () => {
    const e = new FileSystemError('fs');
    expect(e).toBeInstanceOf(WorkflowError);
    expect(e).toBeInstanceOf(FileSystemError);
  });
});

// ─── Lib classes ─────────────────────────────────────────────────────────────

describe('Public API: lib classes', () => {
  it('exports Config as a constructor', () => {
    expect(typeof Config).toBe('function');
  });

  it('exports SessionManager as a constructor', () => {
    expect(typeof SessionManager).toBe('function');
  });

  it('exports Backlog as a constructor', () => {
    expect(typeof Backlog).toBe('function');
  });

  it('exports Metrics as a constructor', () => {
    expect(typeof Metrics).toBe('function');
  });
});

// ─── File / Edit Operations ───────────────────────────────────────────────────

describe('Public API: file operations', () => {
  it('exports validatePath as a function', () => {
    expect(typeof validatePath).toBe('function');
  });

  it('exports filterByExtension as a function', () => {
    expect(typeof filterByExtension).toBe('function');
    expect(filterByExtension(['a.js', 'b.ts', 'c.js'], ['.js'])).toEqual(['a.js', 'c.js']);
  });

  it('exports FileOperations as a constructor', () => {
    expect(typeof FileOperations).toBe('function');
  });
});
