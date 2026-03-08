/**
 * @file HelpOverlay.test.js
 * @description Tests for HelpOverlay — keyboard shortcut reference modal
 */

import { jest } from '@jest/globals';
import React from 'react';
import { render } from 'ink-testing-library';

const mockBuildHelpLines = jest.fn(() => [
  'q / Q          Quit TUI',
  'a / A          Abort workflow',
  '',
  'Tab            Cycle panel focus',
]);

jest.unstable_mockModule('../../../../src/cli/tui/helpers.js', () => ({
  buildHelpLines: mockBuildHelpLines,
}));

let HelpOverlay;
beforeAll(async () => {
  ({ HelpOverlay } = await import('../../../../src/cli/tui/components/HelpOverlay.js'));
});

describe('HelpOverlay Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders title and keybinding content (happy path)', () => {
    const onClose = jest.fn();
    const { lastFrame } = render(React.createElement(HelpOverlay, { onClose }));
    expect(lastFrame()).toContain('Keyboard Shortcuts');
    expect(lastFrame()).toContain('q / Q');
    expect(lastFrame()).toContain('Quit TUI');
    expect(lastFrame()).toContain('Tab');
    expect(lastFrame()).toContain('Cycle panel focus');
  });

  it('renders close hint at bottom', () => {
    const { lastFrame } = render(React.createElement(HelpOverlay, { onClose: jest.fn() }));
    expect(lastFrame()).toContain('[h]');
    expect(lastFrame()).toContain('[Esc]');
    expect(lastFrame()).toContain('close');
  });

  it('calls onClose when h is pressed', () => {
    const onClose = jest.fn();
    const { stdin } = render(React.createElement(HelpOverlay, { onClose }));
    stdin.write('h');
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when Escape is pressed', async () => {
    const onClose = jest.fn();
    const { stdin } = render(React.createElement(HelpOverlay, { onClose }));
    stdin.write('\u001b');
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders all lines from buildHelpLines()', () => {
    const { lastFrame } = render(React.createElement(HelpOverlay, { onClose: jest.fn() }));
    expect(lastFrame()).toContain('a / A');
    expect(lastFrame()).toContain('Abort workflow');
  });

  it('handles empty buildHelpLines() gracefully', () => {
    mockBuildHelpLines.mockReturnValue([]);
    const { lastFrame } = render(React.createElement(HelpOverlay, { onClose: jest.fn() }));
    expect(lastFrame()).toContain('Keyboard Shortcuts');
  });
});
