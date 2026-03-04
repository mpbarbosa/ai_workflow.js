// test/core/logger.test.js

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
    const customLogger = new Logger({
      log: msg => logs.push(msg),
      level: LogLevel.INFO,
    });

    customLogger.info('Info message');
    customLogger.warn('Warning message');
    customLogger.error('Error message');
    customLogger.debug('Debug message');

    expect(logs.some(msg => msg.includes('Info message'))).toBe(true);
    expect(logs.some(msg => msg.includes('Warning message'))).toBe(true);
    expect(logs.some(msg => msg.includes('Error message'))).toBe(true);
    // Debug should not log at INFO level
    expect(logs.some(msg => msg.includes('Debug message'))).toBe(false);
  });

  it('should log debug messages when level is DEBUG', () => {
    const logs = [];
    const customLogger = new Logger({
      log: msg => logs.push(msg),
      level: LogLevel.DEBUG,
    });

    customLogger.debug('Debug message');
    expect(logs.some(msg => msg.includes('Debug message'))).toBe(true);
  });

  it('should strip ANSI codes from log output', () => {
    const ansiString = '\u001b[31mRed Text\u001b[0m';
    const stripped = stripAnsi(ansiString);
    expect(stripped).toBe('Red Text');
  });

  it('should handle logging empty and null messages gracefully', () => {
    const logs = [];
    const customLogger = new Logger({
      log: msg => logs.push(msg),
      level: LogLevel.INFO,
    });

    customLogger.info('');
    customLogger.info(null);
    expect(logs.length).toBe(2);
    expect(logs[0]).toContain('');
    expect(logs[1]).toContain('null');
  });

  it('should throw error for invalid log level', () => {
    expect(() => new Logger({ level: 'INVALID' })).toThrow();
  });

  it('should not log if log function throws', () => {
    const customLogger = new Logger({
      log: () => { throw new Error('Log failed'); },
      level: LogLevel.INFO,
    });
    expect(() => customLogger.info('Test')).toThrow('Log failed');
  });
});
