/**
 * Tests for src/utils/errors.js
 *
 * Covers the custom error class hierarchy:
 * - WorkflowError (base), SystemError, ExecutionError,
 *   ConfigurationError, ValidationError, FileSystemError
 * - Prototype chain, field defaults, edge cases, and error wrapping
 *
 * @jest-environment node
 */

import {
  WorkflowError,
  SystemError,
  ExecutionError,
  ConfigurationError,
  ValidationError,
  FileSystemError,
} from '../../src/utils/errors.js';

// Shared helper: assert common WorkflowError subclass base properties
function expectBaseError(err, { instanceOf, name, code }) {
  expect(err).toBeInstanceOf(Error);
  expect(err).toBeInstanceOf(WorkflowError);
  expect(err).toBeInstanceOf(instanceOf);
  expect(err.name).toBe(name);
  expect(err.code).toBe(code);
}

describe('WorkflowError', () => {
  it('should set name, message, and default code', () => {
    const err = new WorkflowError('Test error');
    expectBaseError(err, { instanceOf: WorkflowError, name: 'WorkflowError', code: 'WORKFLOW_ERROR' });
    expect(err.message).toBe('Test error');
    expect(err.stack).toContain('WorkflowError');
  });

  it('should allow custom code', () => {
    const err = new WorkflowError('Custom code', 'CUSTOM_ERROR');
    expect(err.code).toBe('CUSTOM_ERROR');
  });
});

describe.each([
  ['SystemError', SystemError, 'SYSTEM_ERROR', 'System failure'],
  ['ConfigurationError', ConfigurationError, 'CONFIG_ERROR', 'Config missing'],
])('%s', (name, ErrorClass, code, msg) => {
  it('should set name, message, and code', () => {
    const err = new ErrorClass(msg);
    expectBaseError(err, { instanceOf: ErrorClass, name, code });
    expect(err.message).toBe(msg);
  });
});

describe('ExecutionError', () => {
  it('should set name, message, code, exitCode, stdout, stderr', () => {
    const err = new ExecutionError('Exec failed', 127, 'output', 'error');
    expectBaseError(err, { instanceOf: ExecutionError, name: 'ExecutionError', code: 'EXECUTION_ERROR' });
    expect(err.message).toBe('Exec failed');
    expect(err.exitCode).toBe(127);
    expect(err.stdout).toBe('output');
    expect(err.stderr).toBe('error');
  });

  it('should use default values for exitCode, stdout, stderr', () => {
    const err = new ExecutionError('Default values');
    expect(err.exitCode).toBe(1);
    expect(err.stdout).toBe('');
    expect(err.stderr).toBe('');
  });
});

describe('ValidationError', () => {
  it('should set name, message, code, and field', () => {
    const err = new ValidationError('Invalid value', 'username');
    expectBaseError(err, { instanceOf: ValidationError, name: 'ValidationError', code: 'VALIDATION_ERROR' });
    expect(err.message).toBe('Invalid value');
    expect(err.field).toBe('username');
  });

  it('should set field to null if not provided', () => {
    const err = new ValidationError('Missing field');
    expect(err.field).toBeNull();
  });
});

describe('FileSystemError', () => {
  it('should set name, message, code, and details', () => {
    const details = {
      path: '/tmp/file.txt',
      destination: '/tmp/dest.txt',
      originalError: new Error('FS fail'),
    };
    const err = new FileSystemError('FS error', details);
    expectBaseError(err, { instanceOf: FileSystemError, name: 'FileSystemError', code: 'FILE_SYSTEM_ERROR' });
    expect(err.message).toBe('FS error');
    expect(err.path).toBe('/tmp/file.txt');
    expect(err.destination).toBe('/tmp/dest.txt');
    expect(err.originalError).toBe(details.originalError);
  });

  it('should set details to null if not provided', () => {
    const err = new FileSystemError('No details');
    expect(err.path).toBeNull();
    expect(err.destination).toBeNull();
    expect(err.originalError).toBeNull();
  });

  it('should handle partial details object', () => {
    const err = new FileSystemError('Partial', { path: '/a/b' });
    expect(err.path).toBe('/a/b');
    expect(err.destination).toBeNull();
    expect(err.originalError).toBeNull();
  });
});

describe('Error inheritance and instanceof checks', () => {
  it('should maintain correct prototype chain', () => {
    const errors = [
      new WorkflowError('w'),
      new SystemError('s'),
      new ExecutionError('e'),
      new ConfigurationError('c'),
      new ValidationError('v'),
      new FileSystemError('f'),
    ];
    errors.forEach((err) => {
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(WorkflowError);
    });
  });
});

describe('Edge cases and error scenarios', () => {
  it('should handle empty message', () => {
    const err = new WorkflowError();
    expect(err.message).toBe('');
  });

  it('should handle non-string message', () => {
    const err = new WorkflowError(12345);
    expect(err.message).toBe('12345');
  });

  it('should handle undefined details in FileSystemError', () => {
    const err = new FileSystemError('Undefined details', undefined);
    expect(err.path).toBeNull();
    expect(err.destination).toBeNull();
    expect(err.originalError).toBeNull();
  });

  it('should support error wrapping via originalError', () => {
    const cause = new Error('disk full');
    const err = new FileSystemError('Write failed', { path: '/tmp/out.txt', originalError: cause });
    expect(err.path).toBe('/tmp/out.txt');
    expect(err.originalError).toBe(cause);
    expect(err.originalError.message).toBe('disk full');
  });

  it('should expose code and name as enumerable properties', () => {
    const err = new ConfigurationError('bad config');
    expect(err.code).toBe('CONFIG_ERROR');
    expect(err.name).toBe('ConfigurationError');
    // Ensure both survive round-trip through Object.assign
    const copy = Object.assign({}, err);
    expect(copy.code).toBe('CONFIG_ERROR');
  });
});
