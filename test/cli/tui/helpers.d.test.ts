import { truncateStackTrace } from '../../../src/cli/tui/helpers';

describe('truncateStackTrace', () => {
  it('returns empty array for null stack', () => {
    expect(truncateStackTrace(null)).toEqual([]);
  });

  it('returns empty array for undefined stack', () => {
    expect(truncateStackTrace(undefined)).toEqual([]);
  });

  it('returns empty array for empty string stack', () => {
    expect(truncateStackTrace('')).toEqual([]);
  });

  it('returns all lines if stack has fewer lines than maxLines', () => {
    const stack = 'Error: fail\n    at foo (a.js:1:1)\n    at bar (b.js:2:2)';
    expect(truncateStackTrace(stack, 5)).toEqual([
      'Error: fail',
      '    at foo (a.js:1:1)',
      '    at bar (b.js:2:2)',
    ]);
  });

  it('truncates stack to maxLines if stack has more lines', () => {
    const stack = [
      'Error: fail',
      '    at foo (a.js:1:1)',
      '    at bar (b.js:2:2)',
      '    at baz (c.js:3:3)',
    ].join('\n');
    expect(truncateStackTrace(stack, 2)).toEqual([
      'Error: fail',
      '    at foo (a.js:1:1)',
    ]);
  });

  it('defaults to 10 lines if maxLines is not provided', () => {
    const stack = Array.from({ length: 15 }, (_, i) => `at line${i}`).join('\n');
    expect(truncateStackTrace(stack)).toEqual(
      Array.from({ length: 10 }, (_, i) => `at line${i}`)
    );
  });

  it('handles maxLines of 0', () => {
    const stack = 'Error: fail\n    at foo (a.js:1:1)';
    expect(truncateStackTrace(stack, 0)).toEqual([]);
  });

  it('handles negative maxLines as zero', () => {
    const stack = 'Error: fail\n    at foo (a.js:1:1)';
    expect(truncateStackTrace(stack, -5)).toEqual([]);
  });

  it('handles stack with only whitespace lines', () => {
    const stack = '   \n   \n';
    expect(truncateStackTrace(stack)).toEqual(['   ', '   ']);
  });

  it('handles stack with mixed line endings', () => {
    const stack = 'Error: fail\r\n    at foo (a.js:1:1)\n    at bar (b.js:2:2)\r\n';
    expect(truncateStackTrace(stack, 3)).toEqual([
      'Error: fail',
      '    at foo (a.js:1:1)',
      '    at bar (b.js:2:2)',
    ]);
  });
});
