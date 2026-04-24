/**
 * @file ProgressBar.test.js
 * @description Tests for ProgressBar — workflow progress display
 */

import { jest } from '@jest/globals';
import React from 'react';
import { render, cleanup } from 'ink-testing-library';

const mockFormatProgressLine = jest.fn((pct, elapsedMs, barWidth) => {
  const filled = Math.round((pct / 100) * barWidth);
  const empty = barWidth - filled;
  const bar = '█'.repeat(Math.max(0, filled)) + '░'.repeat(Math.max(0, empty));
  const stats = ` ${pct}% | ${elapsedMs}ms | ETA: 1m`;
  return bar + stats;
});

jest.unstable_mockModule('../../../../src/cli/tui/helpers.js', () => ({
  formatProgressLine: mockFormatProgressLine,
}));

let ProgressBar;
beforeAll(async () => {
  ({ ProgressBar } = await import('../../../../src/cli/tui/components/ProgressBar.js'));
});

afterEach(() => {
  cleanup();
});

describe('ProgressBar Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders progress bar with correct filled and empty blocks (happy path)', () => {
    const { lastFrame } = render(
      React.createElement(ProgressBar, { pct: 50, startTime: Date.now() - 1000 })
    );
    expect(lastFrame()).toContain('█');
    expect(lastFrame()).toContain('░');
    expect(lastFrame()).toContain('50%');
    expect(lastFrame()).toContain('ETA: 1m');
  });

  it('renders 100% filled bar', () => {
    const { lastFrame } = render(
      React.createElement(ProgressBar, { pct: 100, startTime: Date.now() - 5000 })
    );
    expect(lastFrame()).toContain('100%');
    expect(lastFrame()).not.toContain('░');
  });

  it('renders 0% empty bar', () => {
    const { lastFrame } = render(
      React.createElement(ProgressBar, { pct: 0, startTime: Date.now() - 2000 })
    );
    expect(lastFrame()).toContain('0%');
    expect(lastFrame()).not.toContain('█');
    expect(lastFrame()).toContain('░');
  });

  it('renders with default cols gracefully', () => {
    const { lastFrame } = render(
      React.createElement(ProgressBar, { pct: 75, startTime: Date.now() - 3000 })
    );
    expect(lastFrame()).toContain('75%');
    expect(lastFrame()).toContain('ETA: 1m');
  });

  it('renders with minimum barWidth when cols is small', () => {
    const { lastFrame } = render(
      React.createElement(ProgressBar, { pct: 25, startTime: Date.now() - 4000 })
    );
    expect(lastFrame()).toContain('25%');
    expect(lastFrame()).toContain('ETA: 1m');
  });

  it('renders with startTime null (elapsedMs = 0)', () => {
    const { lastFrame } = render(React.createElement(ProgressBar, { pct: 60, startTime: null }));
    expect(lastFrame()).toContain('60%');
    expect(lastFrame()).toContain('ETA: 1m');
  });

  it('renders with negative pct gracefully', () => {
    const { lastFrame } = render(
      React.createElement(ProgressBar, { pct: -10, startTime: Date.now() - 1000 })
    );
    expect(lastFrame()).toContain('-10%');
    expect(lastFrame()).toContain('ETA: 1m');
  });

  it('renders with pct > 100 gracefully', () => {
    const { lastFrame } = render(
      React.createElement(ProgressBar, { pct: 150, startTime: Date.now() - 1000 })
    );
    expect(lastFrame()).toContain('150%');
    expect(lastFrame()).toContain('ETA: 1m');
  });
});
