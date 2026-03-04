// test/local-modules.test.ts

// Import ambient module types
import { logger } from '../core/logger.js';
import { SystemError, ConfigError, WorkflowError } from '../utils/errors.js';

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

  it('should handle edge cases for logger methods', () => {
    expect(() => logger.info('')).not.toThrow();
    expect(() => logger.warn(undefined as unknown as string)).not.toThrow();
    expect(() => logger.error(null as unknown as string)).not.toThrow();
  });
});

describe('Ambient Module: SystemError', () => {
  it('should instantiate with message only', () => {
    const err = new SystemError('system failure');
    expect(err).toBeInstanceOf(SystemError);
    expect(err.message).toBe('system failure');
    expect(err.code).toBeUndefined();
    expect(err.details).toBeUndefined();
  });

  it('should instantiate with message and code', () => {
    const err = new SystemError('system failure', 'E_SYS');
    expect(err.code).toBe('E_SYS');
  });

  it('should instantiate with message, code, and details', () => {
    const details = { reason: 'timeout', retry: false };
    const err = new SystemError('system failure', 'E_SYS', details);
    expect(err.details).toEqual(details);
  });

  it('should handle edge cases for details', () => {
    const err = new SystemError('system failure', 'E_SYS', undefined);
    expect(err.details).toBeUndefined();
    const err2 = new SystemError('system failure', 'E_SYS', null as unknown as Record<string, unknown>);
    expect(err2.details).toBeNull();
  });
});

describe('Ambient Module: ConfigError', () => {
  it('should instantiate with message only', () => {
    const err = new ConfigError('config missing');
    expect(err).toBeInstanceOf(ConfigError);
    expect(err.message).toBe('config missing');
  });

  it('should instantiate with all parameters', () => {
    const err = new ConfigError('config missing', 'E_CFG', { file: 'config.yaml' });
    expect(err.code).toBe('E_CFG');
    expect(err.details).toEqual({ file: 'config.yaml' });
  });

  it('should handle error scenario with empty message', () => {
    const err = new ConfigError('');
    expect(err.message).toBe('');
  });
});

describe('Ambient Module: WorkflowError', () => {
  it('should instantiate with message only', () => {
    const err = new WorkflowError('workflow failed');
    expect(err).toBeInstanceOf(WorkflowError);
    expect(err.message).toBe('workflow failed');
  });

  it('should instantiate with code and details', () => {
    const err = new WorkflowError('workflow failed', 'E_WF', { step: 3 });
    expect(err.code).toBe('E_WF');
    expect(err.details).toEqual({ step: 3 });
  });

  it('should handle edge case with undefined code', () => {
    const err = new WorkflowError('workflow failed', undefined, { step: 3 });
    expect(err.code).toBeUndefined();
    expect(err.details).toEqual({ step: 3 });
  });
});
