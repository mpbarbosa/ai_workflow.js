/**
 * @fileoverview Tests for TUI pure helper functions
 * @module test/cli/tui/helpers.test
 *
 * Comprehensive tests for all functions in src/cli/tui/helpers.js.
 * All functions are pure, so tests require no mocks or setup.
 *
 * Pattern: AAA (Arrange, Act, Assert) — v2.0.0 test conventions
 */

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
  buildHelpLines,
  formatStepDetail,
} from '../../../src/cli/tui/helpers.js';

// ============================================================================
// formatStepIcon
// ============================================================================
describe('formatStepIcon', () => {
  test('returns ⚡ for running', () => {
    expect(formatStepIcon('running')).toBe('⚡');
  });

  test('returns ✅ for done', () => {
    expect(formatStepIcon('done')).toBe('✅');
  });

  test('returns ⊘ for skipped', () => {
    expect(formatStepIcon('skipped')).toBe('⊘');
  });

  test('returns ❌ for error', () => {
    expect(formatStepIcon('error')).toBe('❌');
  });

  test('returns ⏳ for pending', () => {
    expect(formatStepIcon('pending')).toBe('⏳');
  });

  test('returns ⏳ for unknown/undefined status', () => {
    expect(formatStepIcon(undefined)).toBe('⏳');
    expect(formatStepIcon('whatever')).toBe('⏳');
    expect(formatStepIcon('')).toBe('⏳');
  });
});

// ============================================================================
// statusColor
// ============================================================================
describe('statusColor', () => {
  test('returns yellow for running', () => {
    expect(statusColor('running')).toBe('yellow');
  });

  test('returns green for done', () => {
    expect(statusColor('done')).toBe('green');
  });

  test('returns gray for skipped', () => {
    expect(statusColor('skipped')).toBe('gray');
  });

  test('returns red for error', () => {
    expect(statusColor('error')).toBe('red');
  });

  test('returns gray for pending', () => {
    expect(statusColor('pending')).toBe('gray');
  });

  test('returns gray for unknown status', () => {
    expect(statusColor('unknown')).toBe('gray');
    expect(statusColor(undefined)).toBe('gray');
  });
});

// ============================================================================
// formatDuration
// ============================================================================
describe('formatDuration', () => {
  test('formats 0ms as 0s', () => {
    expect(formatDuration(0)).toBe('0s');
  });

  test('formats sub-second as 0s', () => {
    expect(formatDuration(400)).toBe('0s');
  });

  test('formats 800ms as 1s (rounds)', () => {
    expect(formatDuration(800)).toBe('1s');
  });

  test('formats whole seconds under 60', () => {
    expect(formatDuration(1200)).toBe('1s');
    expect(formatDuration(12000)).toBe('12s');
    expect(formatDuration(59000)).toBe('59s');
  });

  test('formats exactly 60s as 1m', () => {
    expect(formatDuration(60000)).toBe('1m');
  });

  test('formats minutes and seconds', () => {
    expect(formatDuration(83000)).toBe('1m23s');
    expect(formatDuration(3661000)).toBe('61m1s');
  });

  test('formats whole minutes without seconds', () => {
    expect(formatDuration(120000)).toBe('2m');
    expect(formatDuration(180000)).toBe('3m');
  });

  test('handles negative values as 0s', () => {
    expect(formatDuration(-500)).toBe('0s');
  });

  test('handles non-finite values as 0s', () => {
    expect(formatDuration(NaN)).toBe('0s');
    expect(formatDuration(Infinity)).toBe('0s');
  });
});

// ============================================================================
// formatTimestamp
// ============================================================================
describe('formatTimestamp', () => {
  test('returns string in [HH:MM:SS] format', () => {
    // Use a fixed timestamp to avoid flakiness
    // 2026-03-07T12:05:03.000Z (UTC)
    const ts = Date.UTC(2026, 2, 7, 12, 5, 3);
    const result = formatTimestamp(ts);
    // The hour depends on local timezone, so just verify structure
    expect(result).toMatch(/^\[\d{2}:\d{2}:\d{2}\]$/);
  });

  test('zero-pads single-digit minutes and seconds', () => {
    // Create a date where we can verify padding
    const d = new Date(2026, 0, 1, 9, 5, 3); // local time 09:05:03
    const result = formatTimestamp(d.getTime());
    const parts = result.slice(1, -1).split(':');
    expect(parts[1]).toBe('05');
    expect(parts[2]).toBe('03');
  });
});

// ============================================================================
// formatEta
// ============================================================================
describe('formatEta', () => {
  test('returns null when pct is 0', () => {
    expect(formatEta(60000, 0)).toBeNull();
  });

  test('returns null when pct is falsy', () => {
    expect(formatEta(60000, null)).toBeNull();
    expect(formatEta(60000, undefined)).toBeNull();
  });

  test('returns "Done" when pct is 100', () => {
    expect(formatEta(60000, 100)).toBe('Done');
  });

  test('returns formatted ETA string for partial progress', () => {
    // 50% done in 60 seconds → ETA 60 seconds remaining
    const result = formatEta(60000, 50);
    expect(result).toBe('ETA 1m');
  });

  test('returns ETA for small progress', () => {
    // 10% done in 10 seconds → total ~100s → remaining ~90s
    const result = formatEta(10000, 10);
    expect(result).toBe('ETA 1m30s');
  });

  test('ETA is "ETA Xs" for sub-minute remainders', () => {
    // 90% done in 90 seconds → total 100s → remaining 10s
    const result = formatEta(90000, 90);
    expect(result).toBe('ETA 10s');
  });
});

// ============================================================================
// formatProgressBar
// ============================================================================
describe('formatProgressBar', () => {
  test('produces correct filled/empty character ratio at 0%', () => {
    const bar = formatProgressBar(0, 10);
    expect(bar).toBe('░'.repeat(10));
    expect(bar.length).toBe(10);
  });

  test('produces full bar at 100%', () => {
    const bar = formatProgressBar(100, 10);
    expect(bar).toBe('█'.repeat(10));
    expect(bar.length).toBe(10);
  });

  test('produces half-filled bar at 50%', () => {
    const bar = formatProgressBar(50, 10);
    expect(bar).toBe('█████░░░░░');
  });

  test('clamps percentage above 100', () => {
    const bar = formatProgressBar(150, 8);
    expect(bar).toBe('█'.repeat(8));
  });

  test('clamps percentage below 0', () => {
    const bar = formatProgressBar(-10, 8);
    expect(bar).toBe('░'.repeat(8));
  });

  test('enforces minimum width of 4', () => {
    const bar = formatProgressBar(50, 0);
    expect(bar.length).toBe(4);
  });

  test('output length always equals requested width', () => {
    for (const width of [5, 10, 20, 40]) {
      const bar = formatProgressBar(33, width);
      expect(bar.length).toBe(width);
    }
  });
});

// ============================================================================
// formatProgressLine
// ============================================================================
describe('formatProgressLine', () => {
  test('includes percentage string', () => {
    const line = formatProgressLine(40, 60000, 20);
    expect(line).toContain('40%');
  });

  test('includes elapsed time', () => {
    const line = formatProgressLine(40, 60000, 20);
    expect(line).toContain('Elapsed');
    expect(line).toContain('1m');
  });

  test('includes ETA when pct > 0', () => {
    const line = formatProgressLine(50, 60000, 20);
    expect(line).toContain('ETA');
  });

  test('omits ETA when pct is 0', () => {
    const line = formatProgressLine(0, 60000, 20);
    expect(line).not.toContain('ETA');
  });

  test('bar portion length equals barWidth', () => {
    const barWidth = 20;
    const line = formatProgressLine(50, 60000, barWidth);
    // The bar is the first barWidth characters
    const bar = line.slice(0, barWidth);
    expect(bar.length).toBe(barWidth);
    expect(bar).toMatch(/^[█░]+$/);
  });
});

// ============================================================================
// truncateLogLine
// ============================================================================
describe('truncateLogLine', () => {
  test('returns string unchanged when within limit', () => {
    expect(truncateLogLine('hello', 10)).toBe('hello');
  });

  test('truncates to maxWidth and appends ellipsis', () => {
    const result = truncateLogLine('hello world', 8);
    expect(result.length).toBe(8);
    expect(result.endsWith('…')).toBe(true);
  });

  test('returns empty string for maxWidth <= 0', () => {
    expect(truncateLogLine('hello', 0)).toBe('');
    expect(truncateLogLine('hello', -5)).toBe('');
  });

  test('returns empty string for non-string input', () => {
    expect(truncateLogLine(null, 10)).toBe('');
    expect(truncateLogLine(undefined, 10)).toBe('');
    expect(truncateLogLine(42, 10)).toBe('');
  });

  test('returns full string when exactly at limit', () => {
    expect(truncateLogLine('hello', 5)).toBe('hello');
  });
});

// ============================================================================
// keepLast
// ============================================================================
describe('keepLast', () => {
  test('returns last N items', () => {
    expect(keepLast([1, 2, 3, 4, 5], 3)).toEqual([3, 4, 5]);
  });

  test('returns all items when fewer than N', () => {
    expect(keepLast([1, 2], 10)).toEqual([1, 2]);
  });

  test('returns empty array for n <= 0', () => {
    expect(keepLast([1, 2, 3], 0)).toEqual([]);
    expect(keepLast([1, 2, 3], -1)).toEqual([]);
  });

  test('returns empty array for non-array input', () => {
    expect(keepLast(null, 5)).toEqual([]);
    expect(keepLast(undefined, 5)).toEqual([]);
    expect(keepLast('string', 5)).toEqual([]);
  });

  test('does not mutate the original array', () => {
    const original = [1, 2, 3, 4, 5];
    keepLast(original, 2);
    expect(original).toEqual([1, 2, 3, 4, 5]);
  });

  test('returns a new array reference', () => {
    const original = [1, 2, 3];
    const result = keepLast(original, 5);
    expect(result).not.toBe(original);
  });
});

// ============================================================================
// terminalIsSufficient
// ============================================================================
describe('terminalIsSufficient', () => {
  test('returns true for exactly minimum size (80×20)', () => {
    expect(terminalIsSufficient(80, 20)).toBe(true);
  });

  test('returns true for large terminals', () => {
    expect(terminalIsSufficient(220, 50)).toBe(true);
  });

  test('returns false when columns too small', () => {
    expect(terminalIsSufficient(79, 24)).toBe(false);
  });

  test('returns false when rows too small', () => {
    expect(terminalIsSufficient(120, 19)).toBe(false);
  });

  test('returns false for tiny terminal', () => {
    expect(terminalIsSufficient(40, 10)).toBe(false);
  });
});

// ============================================================================
// stepsPanelWidth
// ============================================================================
describe('stepsPanelWidth', () => {
  test('returns minimum of 25 for narrow terminals', () => {
    expect(stepsPanelWidth(40)).toBe(25);
    expect(stepsPanelWidth(60)).toBe(25);
  });

  test('returns 35% of columns for normal terminals', () => {
    // 80 * 0.35 = 28 → within [25,45]
    expect(stepsPanelWidth(80)).toBe(28);
    // 100 * 0.35 = 35
    expect(stepsPanelWidth(100)).toBe(35);
  });

  test('returns maximum of 45 for very wide terminals', () => {
    expect(stepsPanelWidth(200)).toBe(45);
    expect(stepsPanelWidth(500)).toBe(45);
  });

  test('result is always an integer', () => {
    for (const cols of [80, 95, 110, 130, 160]) {
      const result = stepsPanelWidth(cols);
      expect(Number.isInteger(result)).toBe(true);
    }
  });
});

// ============================================================================
// filterLogLines
// ============================================================================
describe('filterLogLines', () => {
  const logs = [
    { message: 'Starting workflow', time: 1 },
    { message: 'Error: build failed', time: 2 },
    { message: 'Warning: deprecated API', time: 3 },
    { message: 'Error: lint failed', time: 4 },
    { message: 'Done', time: 5 },
  ];

  test('returns empty matchIndices for empty query', () => {
    const result = filterLogLines(logs, '');
    expect(result.matchCount).toBe(0);
    expect(result.matchIndices).toEqual([]);
  });

  test('returns empty matchIndices for null query', () => {
    const result = filterLogLines(logs, null);
    expect(result.matchCount).toBe(0);
    expect(result.matchIndices).toEqual([]);
  });

  test('returns empty matchIndices for non-array logs', () => {
    const result = filterLogLines('not an array', 'error');
    expect(result.matchCount).toBe(0);
    expect(result.matchIndices).toEqual([]);
  });

  test('finds case-insensitive matches', () => {
    const result = filterLogLines(logs, 'ERROR');
    expect(result.matchCount).toBe(2);
    expect(result.matchIndices).toEqual([1, 3]);
  });

  test('finds partial matches', () => {
    const result = filterLogLines(logs, 'ork');
    expect(result.matchCount).toBe(1);
    expect(result.matchIndices).toEqual([0]);
  });

  test('returns zero matchCount when no matches', () => {
    const result = filterLogLines(logs, 'zzzzz');
    expect(result.matchCount).toBe(0);
    expect(result.matchIndices).toEqual([]);
  });

  test('handles empty logs array', () => {
    const result = filterLogLines([], 'error');
    expect(result.matchCount).toBe(0);
    expect(result.matchIndices).toEqual([]);
  });

  test('handles log entries with non-string messages', () => {
    const weirdLogs = [
      { message: 123, time: 1 },
      { message: null, time: 2 },
    ];
    const result = filterLogLines(weirdLogs, 'test');
    expect(result.matchCount).toBe(0);
  });
});

// ============================================================================
// highlightSearchMatch
// ============================================================================
describe('highlightSearchMatch', () => {
  test('returns full line as non-match when query is empty', () => {
    const result = highlightSearchMatch('hello world', '');
    expect(result).toEqual([{ text: 'hello world', isMatch: false }]);
  });

  test('returns full line as non-match when query is null', () => {
    const result = highlightSearchMatch('hello world', null);
    expect(result).toEqual([{ text: 'hello world', isMatch: false }]);
  });

  test('returns empty text for non-string input', () => {
    const result = highlightSearchMatch(null, 'test');
    expect(result).toEqual([{ text: '', isMatch: false }]);
  });

  test('marks single match at start', () => {
    const result = highlightSearchMatch('error: build failed', 'error');
    expect(result[0]).toEqual({ text: 'error', isMatch: true });
    expect(result[1]).toEqual({ text: ': build failed', isMatch: false });
  });

  test('marks match in middle', () => {
    const result = highlightSearchMatch('build failed here', 'failed');
    expect(result).toEqual([
      { text: 'build ', isMatch: false },
      { text: 'failed', isMatch: true },
      { text: ' here', isMatch: false },
    ]);
  });

  test('marks match at end', () => {
    const result = highlightSearchMatch('build error', 'error');
    expect(result).toEqual([
      { text: 'build ', isMatch: false },
      { text: 'error', isMatch: true },
    ]);
  });

  test('case-insensitive matching', () => {
    const result = highlightSearchMatch('ERROR occurred', 'error');
    expect(result[0]).toEqual({ text: 'ERROR', isMatch: true });
  });

  test('multiple matches in one line', () => {
    const result = highlightSearchMatch('a b a b a', 'a');
    const matches = result.filter((s) => s.isMatch);
    expect(matches).toHaveLength(3);
    expect(matches.every((m) => m.text === 'a')).toBe(true);
  });
});

// ============================================================================
// truncateStackTrace
// ============================================================================
describe('truncateStackTrace', () => {
  test('returns empty array for null/undefined', () => {
    expect(truncateStackTrace(null)).toEqual([]);
    expect(truncateStackTrace(undefined)).toEqual([]);
    expect(truncateStackTrace('')).toEqual([]);
  });

  test('returns all lines when under limit', () => {
    const stack = 'Error: fail\n  at foo.js:1\n  at bar.js:2';
    const result = truncateStackTrace(stack, 20);
    expect(result).toHaveLength(3);
    expect(result[0]).toBe('Error: fail');
  });

  test('truncates at maxLines', () => {
    const lines = Array.from({ length: 30 }, (_, i) => `  at frame${i}`);
    const stack = lines.join('\n');
    const result = truncateStackTrace(stack, 20);
    expect(result).toHaveLength(20);
    expect(result[0]).toBe('  at frame0');
    expect(result[19]).toBe('  at frame19');
  });

  test('defaults to 20 maxLines', () => {
    const lines = Array.from({ length: 25 }, (_, i) => `line${i}`);
    const result = truncateStackTrace(lines.join('\n'));
    expect(result).toHaveLength(20);
  });

  test('returns non-string as empty array', () => {
    expect(truncateStackTrace(42)).toEqual([]);
    expect(truncateStackTrace({})).toEqual([]);
  });
});

// ============================================================================
// buildHelpLines
// ============================================================================
describe('buildHelpLines', () => {
  test('returns an array of strings', () => {
    const result = buildHelpLines();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    result.forEach((line) => expect(typeof line).toBe('string'));
  });

  test('is deterministic (same output every call)', () => {
    expect(buildHelpLines()).toEqual(buildHelpLines());
  });

  test('contains q/Q entry', () => {
    const result = buildHelpLines();
    const hasQ = result.some((line) => line.includes('q') && line.toLowerCase().includes('quit'));
    expect(hasQ).toBe(true);
  });

  test('contains Tab entry', () => {
    const result = buildHelpLines();
    const hasTab = result.some((line) => line.includes('Tab'));
    expect(hasTab).toBe(true);
  });

  test('contains search / entry', () => {
    const result = buildHelpLines();
    const hasSearch = result.some(
      (line) => line.includes('/') && line.toLowerCase().includes('search')
    );
    expect(hasSearch).toBe(true);
  });
});

// ============================================================================
// formatStepDetail
// ============================================================================
describe('formatStepDetail', () => {
  const baseStep = {
    id: 'step_01',
    name: 'Documentation Validation',
    status: 'done',
    duration: 5000,
    retryCount: 0,
    dependsOn: ['step_00'],
    exitCode: null,
    errorMessage: null,
    stepLogs: ['log line 1', 'log line 2'],
  };

  test('returns empty result for null/undefined step', () => {
    expect(formatStepDetail(null)).toEqual({ lines: [], hasError: false, logLines: [] });
    expect(formatStepDetail(undefined)).toEqual({ lines: [], hasError: false, logLines: [] });
  });

  test('includes name, id, and status', () => {
    const { lines } = formatStepDetail(baseStep);
    expect(lines.some((l) => l.includes('Documentation Validation'))).toBe(true);
    expect(lines.some((l) => l.includes('step_01'))).toBe(true);
    expect(lines.some((l) => l.includes('done'))).toBe(true);
  });

  test('includes duration in human-readable form', () => {
    const { lines } = formatStepDetail(baseStep);
    expect(lines.some((l) => l.includes('Duration') && l.includes('5s'))).toBe(true);
  });

  test('includes depends-on list', () => {
    const { lines } = formatStepDetail(baseStep);
    expect(lines.some((l) => l.includes('step_00'))).toBe(true);
  });

  test('shows (none) when no dependencies', () => {
    const { lines } = formatStepDetail({ ...baseStep, dependsOn: [] });
    expect(lines.some((l) => l.includes('(none)'))).toBe(true);
  });

  test('hasError is false for successful step', () => {
    const { hasError } = formatStepDetail(baseStep);
    expect(hasError).toBe(false);
  });

  test('hasError is true when errorMessage is set', () => {
    const { hasError } = formatStepDetail({ ...baseStep, errorMessage: 'Something failed' });
    expect(hasError).toBe(true);
  });

  test('includes error message in lines', () => {
    const { lines } = formatStepDetail({ ...baseStep, errorMessage: 'Build failed' });
    expect(lines.some((l) => l.includes('Build failed'))).toBe(true);
  });

  test('includes exit code when set', () => {
    const { lines } = formatStepDetail({ ...baseStep, exitCode: 1 });
    expect(lines.some((l) => l.includes('Exit code') && l.includes('1'))).toBe(true);
  });

  test('returns last 10 stepLogs as logLines', () => {
    const manyLogs = Array.from({ length: 15 }, (_, i) => `log ${i}`);
    const { logLines } = formatStepDetail({ ...baseStep, stepLogs: manyLogs });
    expect(logLines).toHaveLength(10);
    expect(logLines[0]).toBe('log 5');
    expect(logLines[9]).toBe('log 14');
  });

  test('returns empty logLines when stepLogs is not an array', () => {
    const { logLines } = formatStepDetail({ ...baseStep, stepLogs: null });
    expect(logLines).toEqual([]);
  });

  test('renders alternatives section when step has alternatives', () => {
    const step = {
      ...baseStep,
      alternatives: [
        {
          number: 1,
          title: 'Use Redis',
          description: 'Fast in-memory cache',
          tradeoffs: 'Requires extra infra',
        },
        {
          number: 2,
          title: 'Use in-memory Map',
          description: 'Simpler approach',
          tradeoffs: 'Not persistent',
        },
      ],
      recommendedAlternative: '1 — Redis is faster for this workload',
    };
    const { lines } = formatStepDetail(step);
    expect(lines.some((l) => l.includes('Alternatives:'))).toBe(true);
    expect(lines.some((l) => l.includes('[1]') && l.includes('Use Redis'))).toBe(true);
    expect(lines.some((l) => l.includes('[2]') && l.includes('Use in-memory Map'))).toBe(true);
    expect(lines.some((l) => l.includes('Recommended:'))).toBe(true);
  });

  test('skips alternatives section when array is empty', () => {
    const step = { ...baseStep, alternatives: [] };
    const { lines } = formatStepDetail(step);
    expect(lines.some((l) => l.includes('Alternatives:'))).toBe(false);
  });

  test('skips alternatives section when field is absent', () => {
    const { lines } = formatStepDetail(baseStep);
    expect(lines.some((l) => l.includes('Alternatives:'))).toBe(false);
  });

  test('truncates long description and tradeoffs to 80 chars', () => {
    const longText = 'A'.repeat(100);
    const step = {
      ...baseStep,
      alternatives: [{ number: 1, title: 'Alt', description: longText, tradeoffs: longText }],
    };
    const { lines } = formatStepDetail(step);
    const descLine = lines.find((l) => l.includes('A'.repeat(10)));
    expect(descLine).toBeDefined();
    expect(descLine.length).toBeLessThanOrEqual(90); // 6-char indent + up to 80 chars content
  });

  test('skips recommendedAlternative line when absent', () => {
    const step = {
      ...baseStep,
      alternatives: [{ number: 1, title: 'Use Redis', description: '', tradeoffs: '' }],
    };
    const { lines } = formatStepDetail(step);
    expect(lines.some((l) => l.includes('Recommended:'))).toBe(false);
  });
});
