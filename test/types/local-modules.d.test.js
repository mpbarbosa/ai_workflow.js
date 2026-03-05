/**
 * Tests for ambient type declarations in src/types/local-modules.d.ts.
 * Verifies that the real JS modules match the contracts described in the .d.ts.
 */
import { describe, it, expect } from '@jest/globals';
import { logger } from '../../src/core/logger.js';
import {
  WorkflowError,
  SystemError,
  ConfigurationError,
} from '../../src/utils/errors.js';

describe('Ambient Module: logger', () => {
  it('should have all log level methods', () => {
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
  });

  it('should call logger methods without throwing', () => {
    expect(() => logger.debug('debug message')).not.toThrow();
    expect(() => logger.info('info message')).not.toThrow();
    expect(() => logger.warn('warn message')).not.toThrow();
    expect(() => logger.error('error message')).not.toThrow();
  });

  it('should handle empty string messages', () => {
    expect(() => logger.info('')).not.toThrow();
  });
});

describe('Ambient Module: WorkflowError', () => {
  it('should instantiate with message only using default code', () => {
    const err = new WorkflowError('workflow failed');
    expect(err).toBeInstanceOf(WorkflowError);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('workflow failed');
    expect(err.code).toBe('WORKFLOW_ERROR');
    expect(err.name).toBe('WorkflowError');
  });

  it('should accept a custom code', () => {
    const err = new WorkflowError('workflow failed', 'E_WF');
    expect(err.code).toBe('E_WF');
  });

  it('should handle empty message', () => {
    const err = new WorkflowError('');
    expect(err.message).toBe('');
  });
});

describe('Ambient Module: SystemError', () => {
  it('should instantiate with message', () => {
    const err = new SystemError('system failure');
    expect(err).toBeInstanceOf(SystemError);
    expect(err).toBeInstanceOf(WorkflowError);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('system failure');
    expect(err.code).toBe('SYSTEM_ERROR');
    expect(err.name).toBe('SystemError');
  });

  it('should have a stack trace', () => {
    const err = new SystemError('oops');
    expect(err.stack).toBeDefined();
    expect(err.stack).toContain('SystemError');
  });
});

describe('Ambient Module: ConfigurationError', () => {
  it('should instantiate with message', () => {
    const err = new ConfigurationError('config missing');
    expect(err).toBeInstanceOf(ConfigurationError);
    expect(err).toBeInstanceOf(WorkflowError);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('config missing');
    expect(err.code).toBe('CONFIG_ERROR');
    expect(err.name).toBe('ConfigurationError');
  });

  it('should handle empty message', () => {
    const err = new ConfigurationError('');
    expect(err.message).toBe('');
    expect(err.code).toBe('CONFIG_ERROR');
  });
});
