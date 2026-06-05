/**
 * @file LogPanel.test.js
 * @description Tests for LogPanel — cybernetic-themed live log display
 */

import { jest } from '@jest/globals';
import React from 'react';
import { render, cleanup } from 'ink-testing-library';

const mockFormatTimestamp = jest.fn((time) => `[${time}]`);
const mockTruncateLogLine = jest.fn((msg, width) =>
  msg.length > width ? msg.slice(0, width) : msg
);
const mockKeepLast = jest.fn((arr, n) => arr.slice(-n));
const mockFilterLogLines = jest.fn(() => ({ matchCount: 0, matchIndices: [] }));
const mockHighlightSearchMatch = jest.fn((line) => [{ text: line, isMatch: false }]);

jest.unstable_mockModule('../../../../src/cli/tui/helpers/reusable.js', () => ({
  formatTimestamp: mockFormatTimestamp,
  truncateLogLine: mockTruncateLogLine,
  keepLast: mockKeepLast,
  filterLogLines: mockFilterLogLines,
  highlightSearchMatch: mockHighlightSearchMatch,
}));

afterEach(() => {
  cleanup();
});

jest.unstable_mockModule('../../../../src/cli/tui/components/LogSearchBar.js', () => ({
  LogSearchBar: () => null,
}));

let LogPanel;
beforeAll(async () => {
  ({ LogPanel } = await import('../../../../src/cli/tui/components/LogPanel.js'));
});

describe('LogPanel Component', () => {
  const makeLog = (message, time = '12:00:00') => ({ message, time });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders "Waiting for output…" when logs are empty', () => {
    const { lastFrame } = render(React.createElement(LogPanel, { logs: [], width: 40, height: 5 }));
    expect(lastFrame()).toContain('Waiting for output…');
    expect(lastFrame()).toContain('LIVE_LOGS');
  });

  it('renders log entries with timestamps', () => {
    const logs = [
      makeLog('✓ Success', '12:01:01'),
      makeLog('✗ Failure', '12:01:02'),
      makeLog('Normal log', '12:01:05'),
    ];
    const { lastFrame } = render(React.createElement(LogPanel, { logs, width: 60, height: 10 }));
    expect(lastFrame()).toContain('[12:01:01]');
    expect(lastFrame()).toContain('✓ Success');
    expect(lastFrame()).toContain('[12:01:02]');
    expect(lastFrame()).toContain('✗ Failure');
    expect(lastFrame()).toContain('Normal log');
  });

  it('renders [OK]/[BUSY]/[ERR] badges for different log prefixes', () => {
    const logs = [
      makeLog('→ Starting: something', '12:00:01'),
      makeLog('✓ Completed: something', '12:00:02'),
      makeLog('✗ Failed: something', '12:00:03'),
      makeLog('⊘ Skipped: something', '12:00:04'),
    ];
    const { lastFrame } = render(React.createElement(LogPanel, { logs, width: 70, height: 12 }));
    expect(lastFrame()).toContain('[ BUSY ]');
    expect(lastFrame()).toContain('[ OK ]');
    expect(lastFrame()).toContain('[ ERR ]');
  });

  it('shows scroll indicator when scrolled up', async () => {
    const logs = Array.from({ length: 10 }, (_, i) => makeLog(`Log ${i + 1}`, `12:0${i}:00`));
    const { stdin, lastFrame } = render(
      React.createElement(LogPanel, { logs, width: 40, height: 5 })
    );
    stdin.write('[A');
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    expect(lastFrame()).toContain('↑');
  });

  it('does not scroll when isFocused is false', () => {
    const logs = Array.from({ length: 10 }, (_, i) => makeLog(`Log ${i + 1}`, `12:0${i}:00`));
    const { stdin, lastFrame } = render(
      React.createElement(LogPanel, { logs, width: 40, height: 5, isFocused: false })
    );
    stdin.write('[A');
    expect(lastFrame()).not.toContain('↑ 1 more');
  });

  it('renders with minimum msgWidth gracefully', () => {
    const logs = [makeLog('Short log', '12:03:00')];
    const { lastFrame } = render(React.createElement(LogPanel, { logs, width: 15, height: 5 }));
    expect(lastFrame()).toContain('LIVE_LOGS');
  });

  it('renders only maxVisible logs', () => {
    const logs = Array.from({ length: 10 }, (_, i) => makeLog(`Log ${i + 1}`, `12:0${i}:00`));
    const { lastFrame } = render(React.createElement(LogPanel, { logs, width: 40, height: 5 }));
    expect(lastFrame()).toContain('Log 10');
    expect(lastFrame()).not.toContain('Log 1 ');
    expect(lastFrame()).not.toContain('Log 2');
  });

  it('handles logs with missing time property gracefully', () => {
    const logs = [{ message: 'No time' }];
    const { lastFrame } = render(React.createElement(LogPanel, { logs, width: 40, height: 5 }));
    expect(lastFrame()).toContain('No time');
  });

  it('k key scrolls up (same as up arrow)', async () => {
    const logs = Array.from({ length: 10 }, (_, i) => makeLog(`Log ${i + 1}`, `12:0${i}:00`));
    const { stdin, lastFrame } = render(
      React.createElement(LogPanel, { logs, width: 40, height: 5 })
    );
    stdin.write('k');
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    expect(lastFrame()).toContain('↑');
  });

  it('g jumps to bottom (clears scroll offset)', () => {
    const logs = Array.from({ length: 10 }, (_, i) => makeLog(`Log ${i + 1}`, `12:0${i}:00`));
    const { stdin, lastFrame } = render(
      React.createElement(LogPanel, { logs, width: 40, height: 5 })
    );
    stdin.write('[A');
    stdin.write('g');
    expect(lastFrame()).not.toContain('↑ ');
  });

  it('renders RECV_OK and CONNECTED status indicators', () => {
    const { lastFrame } = render(React.createElement(LogPanel, { logs: [], width: 60, height: 5 }));
    expect(lastFrame()).toContain('RECV_OK');
    expect(lastFrame()).toContain('CONNECTED');
  });
});
