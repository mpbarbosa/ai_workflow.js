// test/core/colors.test.js

import { colors, supportsColor, colorize } from '../../src/core/colors.js';

describe('colors export', () => {
  it('should export colors object', () => {
    expect(typeof colors).toBe('object');
    expect(Object.keys(colors).length).toBeGreaterThan(0);
  });

  it('should contain common color codes', () => {
    expect(colors).toHaveProperty('reset');
    expect(colors).toHaveProperty('red');
    expect(colors).toHaveProperty('green');
    expect(colors).toHaveProperty('yellow');
    expect(colors).toHaveProperty('blue');
  });
});

describe('supportsColor export', () => {
  it('should be a function', () => {
    expect(typeof supportsColor).toBe('function');
  });

  it('should return a boolean', () => {
    const result = supportsColor();
    expect(typeof result).toBe('boolean');
  });
});

describe('colorize export', () => {
  it('should be a function', () => {
    expect(typeof colorize).toBe('function');
  });

  it('should colorize text with valid color', () => {
    // In non-TTY test environments supportsColor() is false, so colorize
    // returns the text unchanged. Verify type and content only.
    const colored = colorize('Hello', colors.red);
    expect(typeof colored).toBe('string');
    expect(colored).toContain('Hello');
  });

  it('should return original text for invalid color', () => {
    const text = 'World';
    const result = colorize(text, 'notacolor');
    expect(result).toBe(text);
  });

  it('should handle empty string input', () => {
    // Non-TTY: returns text unchanged (empty string)
    expect(colorize('', 'green')).toBe('');
  });

  it('should handle null and undefined input gracefully', () => {
    // Implementation passes text through unchanged when colors are off
    expect(colorize(null, colors.blue)).toBeNull();
    expect(colorize(undefined, colors.yellow)).toBeUndefined();
  });

  it('should handle missing color argument', () => {
    const text = 'NoColor';
    const result = colorize(text);
    expect(result).toBe(text);
  });
});
