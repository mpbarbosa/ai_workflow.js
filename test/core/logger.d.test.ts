import { logger, Logger } from '../../src/core/logger';

describe('Logger interface', () => {
  it('should have all required methods', () => {
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
  });

  describe('logger.debug', () => {
    it('should not throw when called with a normal message', () => {
      expect(() => logger.debug('Debug message')).not.toThrow();
    });
    it('should handle empty string', () => {
      expect(() => logger.debug('')).not.toThrow();
    });
    it('should handle long messages', () => {
      const longMsg = 'a'.repeat(10000);
      expect(() => logger.debug(longMsg)).not.toThrow();
    });
    it('should handle special characters', () => {
      expect(() => logger.debug('!@#$%^&*()_+')).not.toThrow();
    });
    it('should throw if called with undefined', () => {
      // @ts-expect-error
      expect(() => logger.debug(undefined)).toThrow();
    });
    it('should throw if called with null', () => {
      // @ts-expect-error
      expect(() => logger.debug(null)).toThrow();
    });
  });

  describe('logger.info', () => {
    it('should not throw when called with a normal message', () => {
      expect(() => logger.info('Info message')).not.toThrow();
    });
    it('should handle empty string', () => {
      expect(() => logger.info('')).not.toThrow();
    });
    it('should handle long messages', () => {
      const longMsg = 'b'.repeat(10000);
      expect(() => logger.info(longMsg)).not.toThrow();
    });
    it('should handle special characters', () => {
      expect(() => logger.info('[]{};:\'",.<>?/|')).not.toThrow();
    });
    it('should throw if called with undefined', () => {
      // @ts-expect-error
      expect(() => logger.info(undefined)).toThrow();
    });
    it('should throw if called with null', () => {
      // @ts-expect-error
      expect(() => logger.info(null)).toThrow();
    });
  });

  describe('logger.warn', () => {
    it('should not throw when called with a normal message', () => {
      expect(() => logger.warn('Warn message')).not.toThrow();
    });
    it('should handle empty string', () => {
      expect(() => logger.warn('')).not.toThrow();
    });
    it('should handle long messages', () => {
      const longMsg = 'c'.repeat(10000);
      expect(() => logger.warn(longMsg)).not.toThrow();
    });
    it('should handle special characters', () => {
      expect(() => logger.warn('`~\\')).not.toThrow();
    });
    it('should throw if called with undefined', () => {
      // @ts-expect-error
      expect(() => logger.warn(undefined)).toThrow();
    });
    it('should throw if called with null', () => {
      // @ts-expect-error
      expect(() => logger.warn(null)).toThrow();
    });
  });

  describe('logger.error', () => {
    it('should not throw when called with a normal message', () => {
      expect(() => logger.error('Error message')).not.toThrow();
    });
    it('should handle empty string', () => {
      expect(() => logger.error('')).not.toThrow();
    });
    it('should handle long messages', () => {
      const longMsg = 'd'.repeat(10000);
      expect(() => logger.error(longMsg)).not.toThrow();
    });
    it('should handle special characters', () => {
      expect(() => logger.error('💥🔥🚨')).not.toThrow();
    });
    it('should throw if called with undefined', () => {
      // @ts-expect-error
      expect(() => logger.error(undefined)).toThrow();
    });
    it('should throw if called with null', () => {
      // @ts-expect-error
      expect(() => logger.error(null)).toThrow();
    });
  });
});
