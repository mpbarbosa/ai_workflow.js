/**
 * @file ErrorDetailPanel.test.js
 * @description Tests for ErrorDetailPanel — error/stack trace modal overlay
 */

import { jest } from '@jest/globals';
import React from 'react';
import { render, cleanup } from 'ink-testing-library';

let ErrorDetailPanel;
beforeAll(async () => {
  ({ ErrorDetailPanel } = await import('../../../../src/cli/tui/components/ErrorDetailPanel.js'));
});

afterEach(() => {
  cleanup();
});

describe('ErrorDetailPanel Component', () => {
  const baseError = {
    stepId: 'step_03',
    stepName: 'Test Generation',
    message: 'Jest exited with code 1',
    stack: 'Error: Jest exited with code 1\n  at step_03.js:42\n  at async runner.js:10',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders error message and step name (happy path)', () => {
    const { lastFrame } = render(
      React.createElement(ErrorDetailPanel, { error: baseError, onClose: jest.fn() })
    );
    expect(lastFrame()).toContain('Test Generation');
    expect(lastFrame()).toContain('Jest exited with code 1');
    expect(lastFrame()).toContain('Failed');
  });

  it('renders stack trace lines', () => {
    const { lastFrame } = render(
      React.createElement(ErrorDetailPanel, { error: baseError, onClose: jest.fn() })
    );
    expect(lastFrame()).toContain('Stack trace');
    expect(lastFrame()).toContain('step_03.js:42');
  });

  it('renders close hint', () => {
    const { lastFrame } = render(
      React.createElement(ErrorDetailPanel, { error: baseError, onClose: jest.fn() })
    );
    expect(lastFrame()).toContain('[e]');
    expect(lastFrame()).toContain('[Esc]');
    expect(lastFrame()).toContain('close');
  });

  it('calls onClose when e is pressed', () => {
    const onClose = jest.fn();
    const { stdin } = render(React.createElement(ErrorDetailPanel, { error: baseError, onClose }));
    stdin.write('e');
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when Escape is pressed', async () => {
    const onClose = jest.fn();
    const { stdin } = render(React.createElement(ErrorDetailPanel, { error: baseError, onClose }));
    stdin.write('\u001b');
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    expect(onClose).toHaveBeenCalled();
  });

  it('truncates stack trace at 20 lines', () => {
    const longStack = Array.from({ length: 30 }, (_, i) => `  at frame${i}`).join('\n');
    const errorWithLongStack = { ...baseError, stack: longStack };
    const { lastFrame } = render(
      React.createElement(ErrorDetailPanel, { error: errorWithLongStack, onClose: jest.fn() })
    );
    const frame = lastFrame();
    expect(frame).toContain('frame0');
    expect(frame).toContain('frame19');
    expect(frame).not.toContain('frame20');
  });

  it('handles missing stack gracefully', () => {
    const errorNoStack = { ...baseError, stack: null };
    const { lastFrame } = render(
      React.createElement(ErrorDetailPanel, { error: errorNoStack, onClose: jest.fn() })
    );
    expect(lastFrame()).toContain('Jest exited with code 1');
    expect(lastFrame()).not.toContain('Stack trace');
  });

  it('renders gracefully when error is null', () => {
    const { lastFrame } = render(
      React.createElement(ErrorDetailPanel, { error: null, onClose: jest.fn() })
    );
    expect(lastFrame()).toContain('No error recorded');
    expect(lastFrame()).toContain('[e]');
  });
});
