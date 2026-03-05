/**
 * @fileoverview Tests for CLI Progress Utilities
 * @module test/cli/progress.test
 */

import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import {
  calculateProgress,
  formatProgressText,
  createProgressBar,
  formatDuration,
  estimateTimeRemaining,
  updateSpinner,
  succeedSpinner,
  failSpinner,
  displayProgressBar,
  displayStepProgress,
  createProgressTracker,
} from '../../src/cli/progress.js';

describe('CLI Progress - Pure Functions', () => {
  describe('calculateProgress', () => {
    test('should calculate progress percentage', () => {
      expect(calculateProgress(5, 10)).toBe(50);
      expect(calculateProgress(3, 4)).toBe(75);
      expect(calculateProgress(1, 3)).toBe(33);
    });

    test('should return 0 for zero total', () => {
      expect(calculateProgress(5, 0)).toBe(0);
    });

    test('should handle 100% completion', () => {
      expect(calculateProgress(10, 10)).toBe(100);
    });
  });

  describe('formatProgressText', () => {
    test('should format progress text with default unit', () => {
      const text = formatProgressText(5, 10);
      expect(text).toContain('5/10');
      expect(text).toContain('50%');
      expect(text).toContain('items');
    });

    test('should format with custom unit', () => {
      const text = formatProgressText(3, 5, 'steps');
      expect(text).toContain('3/5');
      expect(text).toContain('steps');
    });
  });

  describe('createProgressBar', () => {
    test('should create progress bar at 50%', () => {
      const bar = createProgressBar(50, 10);
      expect(bar).toHaveLength(10);
      expect(bar).toContain('█');
      expect(bar).toContain('░');
    });

    test('should create full bar at 100%', () => {
      const bar = createProgressBar(100, 10);
      expect(bar).toBe('█'.repeat(10));
    });

    test('should create empty bar at 0%', () => {
      const bar = createProgressBar(0, 10);
      expect(bar).toBe('░'.repeat(10));
    });

    test('should handle custom characters', () => {
      const bar = createProgressBar(50, 10, '#', '-');
      expect(bar).toContain('#');
      expect(bar).toContain('-');
    });
  });

  describe('formatDuration', () => {
    test('should format milliseconds', () => {
      expect(formatDuration(500)).toBe('500ms');
    });

    test('should format seconds', () => {
      expect(formatDuration(5000)).toBe('5s');
      expect(formatDuration(45000)).toBe('45s');
    });

    test('should format minutes and seconds', () => {
      expect(formatDuration(90000)).toBe('1m 30s');
      expect(formatDuration(125000)).toBe('2m 5s');
    });
  });

  describe('estimateTimeRemaining', () => {
    test('should estimate time remaining', () => {
      // 5 items in 10 seconds = 0.5 items/sec
      // 5 items remaining = 10 seconds
      const estimate = estimateTimeRemaining(5, 10, 10000);
      expect(estimate).toContain('10s');
    });

    test('should return calculating for zero progress', () => {
      const estimate = estimateTimeRemaining(0, 10, 5000);
      expect(estimate).toBe('calculating...');
    });

    test('should handle completed state', () => {
      const estimate = estimateTimeRemaining(10, 10, 20000);
      expect(estimate).toContain('0');
    });
  });
});

describe('spinner helper functions', () => {
  test('updateSpinner updates text when spinner is spinning', () => {
    const spinner = { isSpinning: true, text: '' };
    updateSpinner(spinner, 'new text');
    expect(spinner.text).toBe('new text');
  });

  test('updateSpinner is no-op when spinner is not spinning', () => {
    const spinner = { isSpinning: false, text: 'old' };
    updateSpinner(spinner, 'new text');
    expect(spinner.text).toBe('old');
  });

  test('updateSpinner is no-op for null spinner', () => {
    expect(() => updateSpinner(null, 'text')).not.toThrow();
  });

  test('succeedSpinner calls succeed when spinner is spinning', () => {
    const spinner = { isSpinning: true, succeed: jest.fn() };
    succeedSpinner(spinner, 'done');
    expect(spinner.succeed).toHaveBeenCalledWith(expect.stringContaining('done'));
  });

  test('succeedSpinner is no-op when spinner is not spinning', () => {
    const spinner = { isSpinning: false, succeed: jest.fn() };
    succeedSpinner(spinner, 'done');
    expect(spinner.succeed).not.toHaveBeenCalled();
  });

  test('succeedSpinner is no-op for null spinner', () => {
    expect(() => succeedSpinner(null, 'msg')).not.toThrow();
  });

  test('failSpinner calls fail when spinner is spinning', () => {
    const spinner = { isSpinning: true, fail: jest.fn() };
    failSpinner(spinner, 'error');
    expect(spinner.fail).toHaveBeenCalledWith(expect.stringContaining('error'));
  });

  test('failSpinner is no-op when spinner is not spinning', () => {
    const spinner = { isSpinning: false, fail: jest.fn() };
    failSpinner(spinner, 'error');
    expect(spinner.fail).not.toHaveBeenCalled();
  });

  test('failSpinner is no-op for null spinner', () => {
    expect(() => failSpinner(null, 'msg')).not.toThrow();
  });
});

describe('displayStepProgress', () => {
  let consoleSpy;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  test('outputs step number, total, and step name', () => {
    displayStepProgress(3, 10, 'Code Analysis');
    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join(' ');
    expect(output).toMatch(/3\/10/);
    expect(output).toMatch(/Code Analysis/);
  });

  test('outputs progress for first step', () => {
    displayStepProgress(1, 5, 'Init');
    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join(' ');
    expect(output).toMatch(/1\/5/);
    expect(output).toMatch(/Init/);
  });
});

describe('createProgressTracker', () => {
  test('getCurrent returns 0 initially', () => {
    const tracker = createProgressTracker(10);
    expect(tracker.getCurrent()).toBe(0);
  });

  test('getElapsed returns a non-negative number', () => {
    const tracker = createProgressTracker(5);
    expect(tracker.getElapsed()).toBeGreaterThanOrEqual(0);
  });

  test('succeed is no-op when no spinner started', () => {
    const tracker = createProgressTracker(3);
    expect(() => tracker.succeed('done')).not.toThrow();
  });

  test('fail is no-op when no spinner started', () => {
    const tracker = createProgressTracker(3);
    expect(() => tracker.fail('error')).not.toThrow();
  });

  test('update is no-op when no spinner started', () => {
    const tracker = createProgressTracker(3);
    expect(() => tracker.update('updating...')).not.toThrow();
  });

  test('complete is no-op when no spinner started', () => {
    const tracker = createProgressTracker(3);
    expect(() => tracker.complete()).not.toThrow();
  });
});

describe('displayProgressBar', () => {
  let origClearLine, origCursorTo, origWrite;

  beforeEach(() => {
    origClearLine = process.stdout.clearLine;
    origCursorTo = process.stdout.cursorTo;
    origWrite = process.stdout.write;
    process.stdout.clearLine = jest.fn(() => true);
    process.stdout.cursorTo = jest.fn(() => true);
    process.stdout.write = jest.fn(() => true);
  });

  afterEach(() => {
    process.stdout.clearLine = origClearLine;
    process.stdout.cursorTo = origCursorTo;
    process.stdout.write = origWrite;
  });

  test('clears line and writes progress text', () => {
    displayProgressBar(3, 10, 'Loading');
    expect(process.stdout.clearLine).toHaveBeenCalledWith(0);
    expect(process.stdout.cursorTo).toHaveBeenCalledWith(0);
    expect(process.stdout.write).toHaveBeenCalledWith(expect.stringContaining('Loading'));
  });

  test('writes newline when complete (current >= total)', () => {
    displayProgressBar(10, 10, 'Done');
    const writes = process.stdout.write.mock.calls.map((c) => c[0]);
    expect(writes).toContain('\n');
  });

  test('does not write newline when not complete', () => {
    displayProgressBar(5, 10, 'Loading');
    const writes = process.stdout.write.mock.calls.map((c) => c[0]);
    expect(writes).not.toContain('\n');
  });

  test('uses default label when none provided', () => {
    displayProgressBar(2, 10);
    expect(process.stdout.write).toHaveBeenCalledWith(expect.stringContaining('Progress'));
  });
});
