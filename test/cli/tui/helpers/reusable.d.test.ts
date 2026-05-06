// test/cli/tui/helpers/reusable.d.test.ts

import type {
  SearchMatchSegment,
  LogSearchEntry,
  LogSearchResult,
  StepAlternative,
  StepDetailInput,
  StepDetailResult,
} from '../../../../src/cli/tui/helpers/reusable.d.ts';

import {
  formatStepIcon,
  statusColor,
  formatDuration,
  formatTimestamp,
  formatEta,
  formatProgressBar,
  formatProgressLine,
  truncateLogLine,
  keepLast,
  terminalIsSufficient,
  stepsPanelWidth,
  filterLogLines,
  highlightSearchMatch,
  truncateStackTrace,
  formatStepDetail,
} from '../../../../src/cli/tui/helpers/reusable.js';

describe('TypeScript declarations for reusable helpers', () => {
  it('formatStepIcon returns a string for any status', () => {
    expect(typeof formatStepIcon('running')).toBe('string');
    expect(typeof formatStepIcon('done')).toBe('string');
    expect(typeof formatStepIcon('unknown')).toBe('string');
  });

  it('statusColor returns a string for any status', () => {
    expect(typeof statusColor('running')).toBe('string');
    expect(typeof statusColor('done')).toBe('string');
    expect(typeof statusColor('unknown')).toBe('string');
  });

  it('formatDuration returns a string for any ms', () => {
    expect(typeof formatDuration(0)).toBe('string');
    expect(typeof formatDuration(12345)).toBe('string');
    expect(typeof formatDuration(-1)).toBe('string');
  });

  it('formatTimestamp returns a string for any timestamp', () => {
    expect(typeof formatTimestamp(0)).toBe('string');
    expect(typeof formatTimestamp(Date.now())).toBe('string');
  });

  it('formatEta returns string or null', () => {
    expect(['string', 'object']).toContain(typeof formatEta(1000, 50));
    expect(formatEta(1000, 0)).toBeNull();
  });

  it('formatProgressBar returns a string of correct length', () => {
    expect(typeof formatProgressBar(50, 10)).toBe('string');
    expect(formatProgressBar(100, 5)).toHaveLength(5);
  });

  it('formatProgressLine returns a string', () => {
    expect(typeof formatProgressLine(50, 1000, 10)).toBe('string');
  });

  it('truncateLogLine returns a string', () => {
    expect(typeof truncateLogLine('hello', 3)).toBe('string');
    expect(truncateLogLine('hello', 3)).toMatch(/…|hel/);
  });

  it('keepLast returns last n elements or empty array', () => {
    expect(keepLast([1, 2, 3], 2)).toEqual([2, 3]);
    expect(keepLast(null, 2)).toEqual([]);
    expect(keepLast(undefined, 2)).toEqual([]);
  });

  it('terminalIsSufficient returns boolean', () => {
    expect(typeof terminalIsSufficient(80, 20)).toBe('boolean');
    expect(terminalIsSufficient(10, 10)).toBe(false);
  });

  it('stepsPanelWidth returns a number', () => {
    expect(typeof stepsPanelWidth(100)).toBe('number');
  });

  it('filterLogLines returns LogSearchResult', () => {
    const logs: LogSearchEntry[] = [{ message: 'foo' }, { message: 'bar' }];
    const result: LogSearchResult = filterLogLines(logs, 'foo');
    expect(typeof result.matchCount).toBe('number');
    expect(Array.isArray(result.matchIndices)).toBe(true);
  });

  it('highlightSearchMatch returns array of SearchMatchSegment', () => {
    const segments: SearchMatchSegment[] = highlightSearchMatch('hello world', 'world');
    expect(Array.isArray(segments)).toBe(true);
    expect(typeof segments[0].text).toBe('string');
    expect(typeof segments[0].isMatch).toBe('boolean');
  });

  it('truncateStackTrace returns array of strings', () => {
    const stack = 'line1\nline2\nline3';
    const result = truncateStackTrace(stack, 2);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(2);
  });

  it('formatStepDetail returns StepDetailResult', () => {
    const input: StepDetailInput = {
      id: '1',
      name: 'Test Step',
      status: 'done',
      duration: 1000,
      retryCount: 1,
      exitCode: 0,
      errorMessage: null,
      dependsOn: ['a', 'b'],
      stepLogs: ['log1', 'log2'],
      alternatives: [{ number: 1, title: 'Alt', description: 'desc', tradeoffs: 'trade' }],
      recommendedAlternative: 'Alt',
    };
    const result: StepDetailResult = formatStepDetail(input);
    expect(Array.isArray(result.lines)).toBe(true);
    expect(typeof result.hasError).toBe('boolean');
    expect(Array.isArray(result.logLines)).toBe(true);
  });

  it('formatStepDetail handles null/undefined input', () => {
    expect(formatStepDetail(null)).toHaveProperty('lines');
    expect(formatStepDetail(undefined)).toHaveProperty('lines');
  });
});
