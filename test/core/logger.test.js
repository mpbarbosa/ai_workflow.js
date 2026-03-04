// test/core/logger.test.js

import { jest } from '@jest/globals';
import * as loggerModule from '../../src/core/logger.js';

describe('core/logger module exports', () => {
  it('should export Logger, logger, LogLevel, and stripAnsi', () => {
    expect(loggerModule).toHaveProperty('Logger');
    expect(loggerModule).toHaveProperty('logger');
    expect(loggerModule).toHaveProperty('LogLevel');
    expect(loggerModule).toHaveProperty('stripAnsi');
  });

  it('should export default as logger', () => {
    expect(loggerModule.default).toBe(loggerModule.logger);
  });
});

describe('Logger class basic usage', () => {
  let Logger;
  let LogLevel;
  let stripAnsi;

  beforeAll(() => {
    Logger = loggerModule.Logger;
    LogLevel = loggerModule.LogLevel;
    stripAnsi = loggerModule.stripAnsi;
  });

  it('should instantiate Logger and log messages at different levels', () => {
    const logs = [];
    const spyLog = jest.spyOn(console, 'log').mockImplementation((...args) => logs.push(args.join(' ')));
    const spyWarn = jest.spyOn(console, 'warn').mockImplementation((...args) => logs.push(args.join(' ')));
    const spyError = jest.spyOn(console, 'error').mockImplementation((...args) => logs.push(args.join(' ')));

    const customLogger = new Logger({ verbose: false });
    customLogger.info('Info message');
    customLogger.warn('Warning message');
    customLogger.error('Error message');
    customLogger.debug('Debug message');

    spyLog.mockRestore();
    spyWarn.mockRestore();
    spyError.mockRestore();

    expect(logs.some(msg => msg.includes('Info message'))).toBe(true);
    expect(logs.some(msg => msg.includes('Warning message'))).toBe(true);
    expect(logs.some(msg => msg.includes('Error message'))).toBe(true);
    // Debug should not log when verbose is false
    expect(logs.some(msg => msg.includes('Debug message'))).toBe(false);
  });

  it('should log debug messages when verbose is true', () => {
    const logs = [];
    const spyLog = jest.spyOn(console, 'log').mockImplementation((...args) => logs.push(args.join(' ')));

    const customLogger = new Logger({ verbose: true });
    customLogger.debug('Debug verbose message');

    spyLog.mockRestore();

    expect(logs.some(msg => msg.includes('Debug verbose message'))).toBe(true);
  });

  it('should strip ANSI codes from log output', () => {
    const ansiString = '\u001b[31mRed Text\u001b[0m';
    const stripped = stripAnsi(ansiString);
    expect(stripped).toBe('Red Text');
  });

  it('should handle logging empty and null messages gracefully', () => {
    const logs = [];
    const spyLog = jest.spyOn(console, 'log').mockImplementation((...args) => logs.push(args.join(' ')));

    const customLogger = new Logger();
    customLogger.info('');
    customLogger.info(null);

    spyLog.mockRestore();

    expect(logs.length).toBe(2);
    expect(typeof logs[0]).toBe('string');
    expect(logs[1]).toContain('null');
  });

  it('should instantiate Logger without throwing for any valid options', () => {
    expect(() => new Logger()).not.toThrow();
    expect(() => new Logger({ quiet: true })).not.toThrow();
    expect(() => new Logger({ verbose: true })).not.toThrow();
    expect(() => new Logger({ prefix: 'TEST' })).not.toThrow();
  });

  it('should suppress output when quiet is true', () => {
    const logs = [];
    const spyLog = jest.spyOn(console, 'log').mockImplementation((...args) => logs.push(args.join(' ')));

    const quietLogger = new Logger({ quiet: true });
    quietLogger.info('Quiet info message');

    spyLog.mockRestore();

    expect(logs.some(msg => msg.includes('Quiet info message'))).toBe(false);
  });
});
