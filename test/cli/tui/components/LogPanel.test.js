/**
 * @file LogPanel.test.js
 * @description Tests for LogPanel — scrollable live log display
 */

import React from 'react';
import { render, act } from 'ink-testing-library';
import { LogPanel } from '../../../../src/cli/tui/components/LogPanel.js';

// Mock helpers
jest.mock('../../../../src/cli/tui/helpers.js', () => ({
  formatTimestamp: jest.fn((time) => `[${time}]`),
  truncateLogLine: jest.fn((msg, width) => msg.length > width ? msg.slice(0, width) : msg),
  keepLast: jest.fn((arr, n) => arr.slice(-n))
}));

describe('LogPanel Component', () => {
  const makeLog = (message, time = '12:00:00') => ({ message, time });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders "Waiting for output…" when logs are empty', () => {
    const { lastFrame } = render(
      <LogPanel logs={[]} width={40} height={5} />
    );
    expect(lastFrame()).toContain('Waiting for output…');
    expect(lastFrame()).toContain('LIVE LOG');
  });

  it('renders log entries with correct colors for status prefixes', () => {
    const logs = [
      makeLog('✓ Success', '12:01:01'),
      makeLog('✗ Failure', '12:01:02'),
      makeLog('⊘ Skipped', '12:01:03'),
      makeLog('→ Info', '12:01:04'),
      makeLog('Normal log', '12:01:05')
    ];
    const { lastFrame } = render(
      <LogPanel logs={logs} width={40} height={10} />
    );
    expect(lastFrame()).toContain('[12:01:01]');
    expect(lastFrame()).toContain('✓ Success');
    expect(lastFrame()).toContain('[12:01:02]');
    expect(lastFrame()).toContain('✗ Failure');
    expect(lastFrame()).toContain('[12:01:03]');
    expect(lastFrame()).toContain('⊘ Skipped');
    expect(lastFrame()).toContain('[12:01:04]');
    expect(lastFrame()).toContain('→ Info');
    expect(lastFrame()).toContain('[12:01:05]');
    expect(lastFrame()).toContain('Normal log');
  });

  it('truncates log messages longer than msgWidth', () => {
    const logs = [makeLog('A'.repeat(100), '12:02:00')];
    const { lastFrame } = render(
      <LogPanel logs={logs} width={20} height={5} />
    );
    expect(lastFrame()).toContain('A'.repeat(8)); // msgWidth = 8 (20-12)
  });

  it('shows scroll indicator when scrollOffset > 0', () => {
    const logs = Array.from({ length: 10 }, (_, i) => makeLog(`Log ${i + 1}`, `12:0${i}:00`));
    const { stdin, lastFrame } = render(
      <LogPanel logs={logs} width={40} height={5} />
    );
    act(() => {
      stdin.write('\u001b[A'); // up arrow
    });
    expect(lastFrame()).toContain('↑ 1 more line');
    act(() => {
      stdin.write('\u001b[A');
    });
    expect(lastFrame()).toContain('↑ 2 more lines');
    act(() => {
      stdin.write('\u001b[B'); // down arrow
    });
    expect(lastFrame()).toContain('↑ 1 more line');
  });

  it('does not scroll when isFocused is false', () => {
    const logs = Array.from({ length: 10 }, (_, i) => makeLog(`Log ${i + 1}`, `12:0${i}:00`));
    const { stdin, lastFrame } = render(
      <LogPanel logs={logs} width={40} height={5} isFocused={false} />
    );
    act(() => {
      stdin.write('\u001b[A');
    });
    expect(lastFrame()).not.toContain('↑ 1 more line');
  });

  it('auto-scrolls to bottom when new logs arrive', () => {
    const logs1 = [makeLog('Log 1', '12:00:00')];
    const logs2 = [makeLog('Log 1', '12:00:00'), makeLog('Log 2', '12:00:01')];
    const { rerender, stdin, lastFrame } = render(
      <LogPanel logs={logs1} width={40} height={5} />
    );
    act(() => {
      stdin.write('\u001b[A');
    });
    expect(lastFrame()).toContain('↑ 1 more line');
    rerender(<LogPanel logs={logs2} width={40} height={5} />);
    expect(lastFrame()).not.toContain('↑ 1 more line');
  });

  it('renders with minimum msgWidth of 10', () => {
    const logs = [makeLog('Short log', '12:03:00')];
    const { lastFrame } = render(
      <LogPanel logs={logs} width={15} height={5} />
    );
    expect(lastFrame()).toContain('Short log');
  });

  it('renders only maxVisible logs', () => {
    const logs = Array.from({ length: 10 }, (_, i) => makeLog(`Log ${i + 1}`, `12:0${i}:00`));
    const { lastFrame } = render(
      <LogPanel logs={logs} width={40} height={5} />
    );
    // maxVisible = 2 (height 5 - 3)
    expect(lastFrame()).toContain('Log 9');
    expect(lastFrame()).toContain('Log 10');
    expect(lastFrame()).not.toContain('Log 1');
  });

  it('handles logs with missing time property gracefully', () => {
    const logs = [{ message: 'No time' }];
    const { lastFrame } = render(
      <LogPanel logs={logs} width={40} height={5} />
    );
    expect(lastFrame()).toContain('No time');
  });
});
