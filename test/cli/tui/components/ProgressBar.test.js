/**
 * @file ProgressBar.test.js
 * @description Tests for ProgressBar — cybernetic block-square progress display
 *
 * Uses ▪ (filled) and ▫ (empty) square chars with PROCESS: label.
 */

import React from 'react';
import { render, cleanup } from 'ink-testing-library';

let ProgressBar;
beforeAll(async () => {
  ({ ProgressBar } = await import('../../../../src/cli/tui/components/ProgressBar.js'));
});

afterEach(() => {
  cleanup();
});

describe('ProgressBar Component', () => {
  it('renders PROCESS label and percentage (happy path)', () => {
    const { lastFrame } = render(
      React.createElement(ProgressBar, { pct: 50, startTime: Date.now() - 1000 })
    );
    expect(lastFrame()).toContain('PROCESS:');
    expect(lastFrame()).toContain('50%');
    expect(lastFrame()).toContain('ELAPSED:');
  });

  it('renders filled squares for non-zero progress', () => {
    const { lastFrame } = render(
      React.createElement(ProgressBar, { pct: 50, startTime: Date.now() - 1000 })
    );
    expect(lastFrame()).toContain('▪');
    expect(lastFrame()).toContain('▫');
  });

  it('renders 100% with all filled squares and no empty squares', () => {
    const { lastFrame } = render(
      React.createElement(ProgressBar, { pct: 100, startTime: Date.now() - 5000 })
    );
    expect(lastFrame()).toContain('100%');
    expect(lastFrame()).not.toContain('▫');
  });

  it('renders 0% with no filled squares', () => {
    const { lastFrame } = render(
      React.createElement(ProgressBar, { pct: 0, startTime: Date.now() - 2000 })
    );
    expect(lastFrame()).toContain('0%');
    expect(lastFrame()).not.toContain('▪');
    expect(lastFrame()).toContain('▫');
  });

  it('shows ETA when pct is between 1 and 99', () => {
    const { lastFrame } = render(
      React.createElement(ProgressBar, { pct: 50, startTime: Date.now() - 60000 })
    );
    expect(lastFrame()).toContain('ETA:');
  });

  it('renders with default cols gracefully', () => {
    const { lastFrame } = render(
      React.createElement(ProgressBar, { pct: 75, startTime: Date.now() - 3000 })
    );
    expect(lastFrame()).toContain('75%');
    expect(lastFrame()).toContain('PROCESS:');
  });

  it('renders with startTime null (elapsedMs = 0)', () => {
    const { lastFrame } = render(React.createElement(ProgressBar, { pct: 60, startTime: null }));
    expect(lastFrame()).toContain('60%');
    expect(lastFrame()).toContain('PROCESS:');
    expect(lastFrame()).toContain('ELAPSED:');
  });

  it('renders elapsed time in Xm XXs format', () => {
    const { lastFrame } = render(
      React.createElement(ProgressBar, { pct: 25, startTime: Date.now() - 90000 })
    );
    expect(lastFrame()).toContain('1m');
    expect(lastFrame()).toContain('ELAPSED:');
  });

  it('renders with pct > 100 gracefully (clamps bar but shows raw pct)', () => {
    const { lastFrame } = render(
      React.createElement(ProgressBar, { pct: 150, startTime: Date.now() - 1000 })
    );
    expect(lastFrame()).toContain('150%');
    expect(lastFrame()).not.toContain('▫');
  });
});
