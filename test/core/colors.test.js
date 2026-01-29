import { describe, it, expect } from '@jest/globals';
import { colors, colorize, supportsColor } from '../../src/core/colors.js';

describe('colors', () => {
  it('should export color codes', () => {
    expect(colors).toBeDefined();
    expect(colors.red).toBe('\x1b[31m');
    expect(colors.green).toBe('\x1b[32m');
    expect(colors.reset).toBe('\x1b[0m');
  });

  it('should detect color support', () => {
    const result = supportsColor();
    expect(typeof result).toBe('boolean');
  });

  it('should colorize text when colors are supported', () => {
    const text = 'Hello';
    const result = colorize(text, colors.red);
    expect(result).toContain(text);
  });
});
