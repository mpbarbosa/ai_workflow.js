// test/cli/tui/helpers/reusable.test.ts

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
  StepDetailInput,
  StepDetailResult,
  LogSearchEntry,
  SearchMatchSegment,
} from '../../../../src/cli/tui/helpers/reusable.js';

describe('formatStepIcon', () => {
  it('returns correct icon for known statuses', () => {
    expect(formatStepIcon('running')).toBe('⚡');
    expect(formatStepIcon('done')).toBe('✅');
    expect(formatStepIcon('skipped')).toBe('⊘');
    expect(formatStepIcon('error')).toBe('❌');
    expect(formatStepIcon('pending')).toBe('⏳');
  });
  it('returns default icon for unknown status', () => {
    expect(formatStepIcon('unknown')).toBe('⏳');
    expect(formatStepIcon('')).toBe('⏳');
  });
});

describe('statusColor', () => {
  it('returns correct color for known statuses', () => {
    expect(statusColor('running')).toBe('yellow');
    expect(statusColor('done')).toBe('green');
    expect(statusColor('skipped')).toBe('gray');
    expect(statusColor('error')).toBe('red');
    expect(statusColor('pending')).toBe('gray');
  });
  it('returns default color for unknown status', () => {
    expect(statusColor('unknown')).toBe('gray');
    expect(statusColor('')).toBe('gray');
  });
});

describe('formatDuration', () => {
  it('formats durations under 60s as seconds', () => {
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(15000)).toBe('15s');
    expect(formatDuration(59999)).toBe('1m');
  });
  it('formats durations over 60s as Xm or XmYs', () => {
    expect(formatDuration(60000)).toBe('1m');
    expect(formatDuration(61000)).toBe('1m1s');
    expect(formatDuration(125000)).toBe('2m5s');
    expect(formatDuration(120000)).toBe('2m');
  });
  it('returns 0s for negative or invalid input', () => {
    expect(formatDuration(-1)).toBe('0s');
    expect(formatDuration(NaN)).toBe('0s');
    expect(formatDuration(Infinity)).toBe('0s');
    expect(formatDuration(undefined as any)).toBe('0s');
  });
});

describe('formatTimestamp', () => {
  it('formats a timestamp as [HH:MM:SS]', () => {
    const date = new Date('2023-01-01T05:06:07Z');
    expect(formatTimestamp(date.getTime())).toMatch(/^\[\d{2}:\d{2}:\d{2}\]$/);
    expect(formatTimestamp(0)).toMatch(/^\[\d{2}:\d{2}:\d{2}\]$/);
  });
});

describe('formatEta', () => {
  it('returns null for pct 0 or less', () => {
    expect(formatEta(1000, 0)).toBeNull();
    expect(formatEta(1000, -5)).toBeNull();
    expect(formatEta(1000, null as any)).toBeNull();
  });
  it('returns "Done" for pct >= 100', () => {
    expect(formatEta(1000, 100)).toBe('Done');
    expect(formatEta(1000, 150)).toBe('Done');
  });
  it('returns ETA string for valid pct', () => {
    const result = formatEta(5000, 50);
    expect(result).toMatch(/^ETA \d+[ms]/);
  });
});

describe('formatProgressBar', () => {
  it('renders a full bar for 100%', () => {
    expect(formatProgressBar(100, 10)).toBe('██████████');
  });
  it('renders an empty bar for 0%', () => {
    expect(formatProgressBar(0, 10)).toBe('░░░░░░░░░░');
  });
  it('respects minimum width of 4', () => {
    expect(formatProgressBar(50, 2)).toHaveLength(4);
  });
  it('handles edge cases', () => {
    expect(formatProgressBar(-10, 10)).toBe('░░░░░░░░░░');
    expect(formatProgressBar(110, 10)).toBe('██████████');
  });
});

describe('formatProgressLine', () => {
  it('includes bar, percent, elapsed, and ETA when applicable', () => {
    const line = formatProgressLine(50, 10000, 10);
    expect(line).toMatch(/█|░/);
    expect(line).toMatch(/50%/);
    expect(line).toMatch(/Elapsed/);
    expect(line).toMatch(/ETA/);
  });
  it('omits ETA if pct is 0', () => {
    const line = formatProgressLine(0, 10000, 10);
    expect(line).not.toMatch(/ETA/);
  });
});

describe('truncateLogLine', () => {
  it('returns empty string for non-string input', () => {
    expect(truncateLogLine(null as any, 10)).toBe('');
    expect(truncateLogLine(undefined as any, 10)).toBe('');
    expect(truncateLogLine(123 as any, 10)).toBe('');
  });
  it('returns empty string for maxWidth <= 0', () => {
    expect(truncateLogLine('abc', 0)).toBe('');
    expect(truncateLogLine('abc', -1)).toBe('');
  });
  it('returns original line if short enough', () => {
    expect(truncateLogLine('abc', 5)).toBe('abc');
  });
  it('truncates and adds ellipsis if too long', () => {
    expect(truncateLogLine('abcdef', 4)).toBe('abc…');
  });
});

describe('keepLast', () => {
  it('returns last n elements of array', () => {
    expect(keepLast([1, 2, 3, 4], 2)).toEqual([3, 4]);
  });
  it('returns empty array for non-array input', () => {
    expect(keepLast(null, 2)).toEqual([]);
    expect(keepLast(undefined, 2)).toEqual([]);
  });
  it('returns empty array for n <= 0', () => {
    expect(keepLast([1, 2, 3], 0)).toEqual([]);
    expect(keepLast([1, 2, 3], -1)).toEqual([]);
  });
  it('returns full array if n > length', () => {
    expect(keepLast([1, 2], 5)).toEqual([1, 2]);
  });
});

describe('terminalIsSufficient', () => {
  it('returns true for sufficient cols and rows', () => {
    expect(terminalIsSufficient(80, 20)).toBe(true);
    expect(terminalIsSufficient(100, 30)).toBe(true);
  });
  it('returns false for insufficient cols or rows', () => {
    expect(terminalIsSufficient(79, 20)).toBe(false);
    expect(terminalIsSufficient(80, 19)).toBe(false);
    expect(terminalIsSufficient(60, 10)).toBe(false);
  });
});

describe('stepsPanelWidth', () => {
  it('returns 35% of totalCols, clamped between 25 and 45', () => {
    expect(stepsPanelWidth(200)).toBe(45);
    expect(stepsPanelWidth(100)).toBe(35);
    expect(stepsPanelWidth(50)).toBe(25);
    expect(stepsPanelWidth(10)).toBe(25);
  });
});

describe('filterLogLines', () => {
  it('returns 0 matches for non-array logs or empty query', () => {
    expect(filterLogLines(null, 'foo')).toEqual({ matchCount: 0, matchIndices: [] });
    expect(filterLogLines([], '')).toEqual({ matchCount: 0, matchIndices: [] });
    expect(filterLogLines([{ message: 'foo' }], '')).toEqual({ matchCount: 0, matchIndices: [] });
  });
  it('finds matches case-insensitively', () => {
    const logs: LogSearchEntry[] = [{ message: 'Hello' }, { message: 'world' }, { message: 'HELLO' }];
    expect(filterLogLines(logs, 'hello')).toEqual({ matchCount: 2, matchIndices: [0, 2] });
  });
  it('handles logs with missing or non-string message', () => {
    const logs: LogSearchEntry[] = [{}, { message: 123 as any }, { message: 'foo' }];
    expect(filterLogLines(logs, 'foo')).toEqual({ matchCount: 1, matchIndices: [2] });
  });
});

describe('highlightSearchMatch', () => {
  it('returns full line as non-match if query is empty or not found', () => {
    expect(highlightSearchMatch('abc', '')).toEqual([{ text: 'abc', isMatch: false }]);
    expect(highlightSearchMatch('abc', null as any)).toEqual([{ text: 'abc', isMatch: false }]);
    expect(highlightSearchMatch('abc', 'z')).toEqual([{ text: 'abc', isMatch: false }]);
  });
  it('returns empty string for non-string line', () => {
    expect(highlightSearchMatch(null as any, 'a')).toEqual([{ text: '', isMatch: false }]);
  });
  it('highlights all matches in the line', () => {
    expect(highlightSearchMatch('abcabc', 'a')).toEqual([
      { text: 'a', isMatch: true },
      { text: 'bc', isMatch: false },
      { text: 'a', isMatch: true },
      { text: 'bc', isMatch: false },
    ]);
    expect(highlightSearchMatch('abcabc', 'ab')).toEqual([
      { text: 'ab', isMatch: true },
      { text: 'c', isMatch: false },
      { text: 'ab', isMatch: true },
      { text: 'c', isMatch: false },
    ]);
  });
});

describe('truncateStackTrace', () => {
  it('returns empty array for non-string or empty input', () => {
    expect(truncateStackTrace(null)).toEqual([]);
    expect(truncateStackTrace(undefined)).toEqual([]);
    expect(truncateStackTrace(123 as any)).toEqual([]);
  });
  it('returns at least one line', () => {
    expect(truncateStackTrace('foo')).toEqual(['foo']);
  });
  it('truncates to maxLines', () => {
    const stack = Array(30).fill('line').join('\n');
    expect(truncateStackTrace(stack, 5)).toHaveLength(5);
    expect(truncateStackTrace(stack)).toHaveLength(20);
  });
});

describe('formatStepDetail', () => {
  it('returns default structure for null/undefined step', () => {
    expect(formatStepDetail(null)).toEqual({ lines: [], hasError: false, logLines: [] });
    expect(formatStepDetail(undefined)).toEqual({ lines: [], hasError: false, logLines: [] });
  });
  it('formats step with all fields', () => {
    const step: StepDetailInput = {
      name: 'Test Step',
      id: 'step1',
      status: 'done',
      duration: 61000,
      retryCount: 2,
      dependsOn: ['a', 'b'],
      exitCode: 1,
      errorMessage: 'Something went wrong',
      alternatives: [
        { number: 1, title: 'Alt1', description: 'desc', tradeoffs: 'trade' },
      ],
      recommendedAlternative: 'Alt1',
      stepLogs: ['log1', 'log2', 'log3'],
    };
    const result = formatStepDetail(step);
    expect(result.lines).toEqual(
      expect.arrayContaining([
        'Name:       Test Step',
        'ID:         step1',
        'Status:     done',
        'Duration:   1m1s',
        'Retries:    2',
        'Depends-on: a, b',
        'Exit code:  1',
        'Error:      Something went wrong',
        '  [1] Alt1',
        '       desc',
        '       Trade-offs: trade',
        '  → Recommended: Alt1',
      ])
    );
    expect(result.hasError).toBe(true);
    expect(result.logLines).toEqual(['log1', 'log2', 'log3']);
  });
  it('handles missing/empty fields gracefully', () => {
    const step: StepDetailInput = {};
    const result = formatStepDetail(step);
    expect(result.lines).toEqual(
      expect.arrayContaining([
        'Name:       (unknown)',
        'ID:         (unknown)',
        'Status:     pending',
        'Depends-on: (none)',
      ])
    );
    expect(result.hasError).toBe(false);
    expect(result.logLines).toEqual([]);
  });
  it('limits logLines to last 10 entries', () => {
    const logs = Array.from({ length: 15 }, (_, i) => `log${i}`);
    const step: StepDetailInput = { stepLogs: logs };
    const result = formatStepDetail(step);
    expect(result.logLines).toEqual(logs.slice(-10));
  });
});
