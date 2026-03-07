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
