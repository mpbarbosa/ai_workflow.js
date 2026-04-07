/**
 * @file StatusBar.test.js
 * @description Tests for StatusBar — bottom keybinding hints with SDK status indicator
 */

import React from 'react';
import { render } from 'ink-testing-library';
import { StatusBar } from '../../../../src/cli/tui/components/StatusBar.js';

describe('StatusBar Component', () => {
  it('renders default key hints when isComplete is false (happy path)', () => {
    const { lastFrame } = render(React.createElement(StatusBar, {}));
    expect(lastFrame()).toContain('[q]');
    expect(lastFrame()).toContain('Quit');
    expect(lastFrame()).toContain('[a]');
    expect(lastFrame()).toContain('Abort');
    expect(lastFrame()).toContain('[↑/↓ j/k]');
    expect(lastFrame()).toContain('Scroll');
  });

  it('renders only exit hint when isComplete is true', () => {
    const { lastFrame } = render(React.createElement(StatusBar, { isComplete: true }));
    expect(lastFrame()).toContain('[q]');
    expect(lastFrame()).toContain('Exit');
    expect(lastFrame()).not.toContain('Abort');
    expect(lastFrame()).not.toContain('Scroll');
  });

  it('renders with isComplete explicitly false', () => {
    const { lastFrame } = render(React.createElement(StatusBar, { isComplete: false }));
    expect(lastFrame()).toContain('[q]');
    expect(lastFrame()).toContain('Quit');
    expect(lastFrame()).toContain('[a]');
    expect(lastFrame()).toContain('Abort');
    expect(lastFrame()).toContain('[↑/↓ j/k]');
    expect(lastFrame()).toContain('Scroll');
  });

  it('renders correct spacing between hints', () => {
    const { lastFrame } = render(React.createElement(StatusBar, {}));
    expect(lastFrame()).toMatch(/Quit\s+.*Abort\s+.*Scroll/);
  });

  it('renders with unexpected prop values gracefully', () => {
    const { lastFrame } = render(React.createElement(StatusBar, { isComplete: null }));
    expect(lastFrame()).toContain('[q]');
    expect(lastFrame()).toContain('Quit');
    expect(lastFrame()).toContain('[a]');
    expect(lastFrame()).toContain('Abort');
    expect(lastFrame()).toContain('[↑/↓ j/k]');
    expect(lastFrame()).toContain('Scroll');
  });

  // ── StatusChronometer integration ────────────────────────────────────────

  it("copilotStatus='idle' renders no badge (default)", () => {
    const { lastFrame } = render(
      React.createElement(StatusBar, { copilotStatus: 'idle', width: 80 })
    );
    const frame = lastFrame();
    expect(frame).not.toContain('Loading…');
    expect(frame).not.toContain('Streaming…');
    expect(frame).not.toContain('Done');
    // hints still present
    expect(frame).toContain('[q]');
  });

  it("copilotStatus='loading' renders spinner or Loading…", () => {
    const { lastFrame } = render(
      React.createElement(StatusBar, { copilotStatus: 'loading', width: 80 })
    );
    const frame = lastFrame();
    const hasSpinner = ['⠋', '⠙', '⠸', '⠴', '⠦', '⠇'].some((c) => frame.includes(c));
    expect(hasSpinner || frame.includes('Loading…')).toBe(true);
  });

  it("copilotStatus='streaming' renders Streaming…", () => {
    const { lastFrame } = render(
      React.createElement(StatusBar, { copilotStatus: 'streaming', width: 80 })
    );
    // 'Streaming…' may be split across Ink visual rows (e.g. 'Streamin' / 'g…');
    // use a cross-line regex to verify both halves are present.
    expect(lastFrame()).toMatch(/Stream[\s\S]*g…/);
  });

  it("copilotStatus='done' renders ✓ Done", () => {
    const { lastFrame } = render(
      React.createElement(StatusBar, { copilotStatus: 'done', width: 80 })
    );
    expect(lastFrame()).toContain('✓');
    expect(lastFrame()).toContain('Done');
  });

  it("copilotStatus='error' renders ✗ and the error message", () => {
    const { lastFrame } = render(
      React.createElement(StatusBar, {
        copilotStatus: 'error',
        copilotErrorMessage: 'SDK timeout',
        width: 80,
      })
    );
    expect(lastFrame()).toContain('✗');
    // Error message words may wrap across Ink visual rows; check each word separately.
    expect(lastFrame()).toContain('SDK');
    expect(lastFrame()).toContain('timeout');
  });

  it('hints are still visible alongside the badge (loading)', () => {
    const { lastFrame } = render(
      React.createElement(StatusBar, { copilotStatus: 'loading', width: 80 })
    );
    const frame = lastFrame();
    expect(frame).toContain('[q]');
    expect(frame).toContain('Quit');
  });
});
