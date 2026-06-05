/**
 * @file StatusBar.test.js
 * @description Tests for StatusBar — bottom keybinding hints with SDK status indicator
 */

import React from 'react';
import { render } from 'ink-testing-library';
import { StatusBar } from '../../../../src/cli/tui/components/StatusBar.js';

const mountedRenders = [];

afterEach(() => {
  while (mountedRenders.length > 0) {
    mountedRenders.pop()?.unmount();
  }
});

function renderStatusBar(props) {
  const rendered = render(React.createElement(StatusBar, props));
  mountedRenders.push(rendered);
  return rendered;
}

describe('StatusBar Component', () => {
  it('renders default key hints in key: Label format (happy path)', () => {
    const { lastFrame } = renderStatusBar({});
    expect(lastFrame()).toContain('q:');
    expect(lastFrame()).toContain('Quit');
    expect(lastFrame()).toContain('a:');
    expect(lastFrame()).toContain('Abort');
    expect(lastFrame()).toContain('j/k:');
    expect(lastFrame()).toContain('Scroll');
  });

  it('renders only exit hint when isComplete is true', () => {
    const { lastFrame } = renderStatusBar({ isComplete: true });
    expect(lastFrame()).toContain('q:');
    expect(lastFrame()).toContain('Exit');
    expect(lastFrame()).not.toContain('Abort');
    expect(lastFrame()).not.toContain('Scroll');
  });

  it('renders with isComplete explicitly false', () => {
    const { lastFrame } = renderStatusBar({ isComplete: false });
    expect(lastFrame()).toContain('q:');
    expect(lastFrame()).toContain('Quit');
    expect(lastFrame()).toContain('a:');
    expect(lastFrame()).toContain('Abort');
    expect(lastFrame()).toContain('j/k:');
    expect(lastFrame()).toContain('Scroll');
  });

  it('renders correct ordering of hints', () => {
    const { lastFrame } = renderStatusBar({});
    expect(lastFrame()).toMatch(/Quit[\s\S]*Abort[\s\S]*Scroll/);
  });

  it('renders SYS_READY indicator', () => {
    const { lastFrame } = renderStatusBar({});
    expect(lastFrame()).toContain('SYS_READY');
  });

  it('renders with unexpected prop values gracefully', () => {
    const { lastFrame } = renderStatusBar({ isComplete: null });
    expect(lastFrame()).toContain('q:');
    expect(lastFrame()).toContain('Quit');
    expect(lastFrame()).toContain('a:');
    expect(lastFrame()).toContain('Abort');
  });

  // ── StatusChronometer integration ────────────────────────────────────────

  it("copilotStatus='idle' renders no badge (default)", () => {
    const { lastFrame } = renderStatusBar({ copilotStatus: 'idle', width: 80 });
    const frame = lastFrame();
    expect(frame).not.toContain('Loading…');
    expect(frame).not.toContain('Streaming…');
    expect(frame).not.toContain('Done');
    expect(frame).toContain('q:');
  });

  it("copilotStatus='loading' renders spinner or Loading…", () => {
    const { lastFrame } = renderStatusBar({ copilotStatus: 'loading', width: 80 });
    const frame = lastFrame();
    const hasSpinner = ['⠋', '⠙', '⠸', '⠴', '⠦', '⠇'].some((c) => frame.includes(c));
    expect(hasSpinner || frame.includes('Loading…')).toBe(true);
  });

  it("copilotStatus='streaming' renders Streaming…", () => {
    const { lastFrame } = renderStatusBar({ copilotStatus: 'streaming', width: 80 });
    expect(lastFrame()).toMatch(/Stream[\s\S]*g…/);
  });

  it("copilotStatus='done' renders ✓ Done", () => {
    const { lastFrame } = renderStatusBar({ copilotStatus: 'done', width: 80 });
    expect(lastFrame()).toContain('✓');
    expect(lastFrame()).toContain('Done');
  });

  it("copilotStatus='error' renders ✗ and the error message", () => {
    const { lastFrame } = renderStatusBar({
      copilotStatus: 'error',
      copilotErrorMessage: 'SDK timeout',
      width: 80,
    });
    expect(lastFrame()).toContain('✗');
    expect(lastFrame()).toContain('SDK');
    expect(lastFrame()).toContain('timeout');
  });

  it('hints are still visible alongside the badge (loading)', () => {
    const { lastFrame } = renderStatusBar({ copilotStatus: 'loading', width: 80 });
    const frame = lastFrame();
    expect(frame).toContain('q:');
    expect(frame).toContain('Quit');
  });
});
