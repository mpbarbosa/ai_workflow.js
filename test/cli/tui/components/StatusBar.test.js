/**
 * @file StatusBar.test.js
 * @description Tests for StatusBar — bottom keybinding hints
 */

import React from 'react';
import { render } from 'ink-testing-library';
import { StatusBar } from '../../../../src/cli/tui/components/StatusBar.js';

describe('StatusBar Component', () => {
  it('renders default key hints when isComplete is false (happy path)', () => {
    const { lastFrame } = render(<StatusBar />);
    expect(lastFrame()).toContain('[q]');
    expect(lastFrame()).toContain('Quit');
    expect(lastFrame()).toContain('[a]');
    expect(lastFrame()).toContain('Abort workflow');
    expect(lastFrame()).toContain('[↑/↓]');
    expect(lastFrame()).toContain('Scroll log');
  });

  it('renders only exit hint when isComplete is true', () => {
    const { lastFrame } = render(<StatusBar isComplete={true} />);
    expect(lastFrame()).toContain('[q]');
    expect(lastFrame()).toContain('Exit');
    expect(lastFrame()).not.toContain('Abort workflow');
    expect(lastFrame()).not.toContain('Scroll log');
  });

  it('renders with isComplete explicitly false', () => {
    const { lastFrame } = render(<StatusBar isComplete={false} />);
    expect(lastFrame()).toContain('[q]');
    expect(lastFrame()).toContain('Quit');
    expect(lastFrame()).toContain('[a]');
    expect(lastFrame()).toContain('Abort workflow');
    expect(lastFrame()).toContain('[↑/↓]');
    expect(lastFrame()).toContain('Scroll log');
  });

  it('renders correct spacing between hints', () => {
    const { lastFrame } = render(<StatusBar />);
    // There should be at least two spaces between hints
    expect(lastFrame()).toMatch(/Quit\s+.*Abort workflow\s+.*Scroll log/);
  });

  it('renders with unexpected prop values gracefully', () => {
    const { lastFrame } = render(<StatusBar isComplete={null} />);
    expect(lastFrame()).toContain('[q]');
    expect(lastFrame()).toContain('Quit');
    expect(lastFrame()).toContain('[a]');
    expect(lastFrame()).toContain('Abort workflow');
    expect(lastFrame()).toContain('[↑/↓]');
    expect(lastFrame()).toContain('Scroll log');
  });
});
