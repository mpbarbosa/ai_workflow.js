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
    const colored = colorize('Hello', 'red');
    expect(typeof colored).toBe('string');
    expect(colored).toContain('Hello');
    // Should contain ANSI escape code for red
    expect(colored).toMatch(/\x1b\[31m.*Hello.*\x1b\[0m/);
  });

  it('should return original text for invalid color', () => {
    const text = 'World';
    const result = colorize(text, 'notacolor');
    expect(result).toBe(text);
  });

  it('should handle empty string input', () => {
    expect(colorize('', 'green')).toContain('\x1b');
  });

  it('should handle null and undefined input gracefully', () => {
    expect(colorize(null, 'blue')).toBe('');
    expect(colorize(undefined, 'yellow')).toBe('');
  });

  it('should handle missing color argument', () => {
    const text = 'NoColor';
    const result = colorize(text);
    expect(result).toBe(text);
  });
});
