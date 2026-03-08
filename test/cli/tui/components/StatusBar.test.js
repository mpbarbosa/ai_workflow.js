/**
 * @file StatusBar.test.js
 * @description Tests for StatusBar — bottom keybinding hints
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
});
