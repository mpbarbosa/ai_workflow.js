/**
 * @file StepDetailOverlay.test.js
 * @description Tests for StepDetailOverlay — step metadata modal
 */

import { jest } from '@jest/globals';
import React from 'react';
import { render } from 'ink-testing-library';

const mockFormatStepDetail = jest.fn((step) => ({
  lines: step
    ? [
        `Name:       ${step.name}`,
        `ID:         ${step.id}`,
        `Status:     ${step.status}`,
        step.errorMessage ? `Error:      ${step.errorMessage}` : null,
      ].filter(Boolean)
    : [],
  hasError: !!step?.errorMessage,
  logLines: step?.stepLogs ?? [],
}));
const mockStatusColor = jest.fn(() => 'white');

jest.unstable_mockModule('../../../../src/cli/tui/helpers.js', () => ({
  formatStepDetail: mockFormatStepDetail,
  statusColor: mockStatusColor,
}));

let StepDetailOverlay;
beforeAll(async () => {
  ({ StepDetailOverlay } = await import('../../../../src/cli/tui/components/StepDetailOverlay.js'));
});

describe('StepDetailOverlay Component', () => {
  const baseStep = {
    id: 'step_01',
    name: 'Documentation Validation',
    status: 'done',
    duration: 5000,
    retryCount: 0,
    dependsOn: [],
    exitCode: null,
    errorMessage: null,
    stepLogs: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders step metadata (happy path)', () => {
    const { lastFrame } = render(
      React.createElement(StepDetailOverlay, { step: baseStep, onClose: jest.fn() })
    );
    expect(lastFrame()).toContain('Step Detail');
    expect(lastFrame()).toContain('Documentation Validation');
    expect(lastFrame()).toContain('step_01');
    expect(lastFrame()).toContain('done');
  });

  it('renders close hint', () => {
    const { lastFrame } = render(
      React.createElement(StepDetailOverlay, { step: baseStep, onClose: jest.fn() })
    );
    expect(lastFrame()).toContain('[Esc]');
    expect(lastFrame()).toContain('close');
  });

  it('calls onClose when Escape is pressed', async () => {
    const onClose = jest.fn();
    const { stdin } = render(React.createElement(StepDetailOverlay, { step: baseStep, onClose }));
    stdin.write('\u001b');
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders error info for failed steps', () => {
    const failedStep = { ...baseStep, status: 'error', errorMessage: 'Command failed: eslint' };
    const { lastFrame } = render(
      React.createElement(StepDetailOverlay, { step: failedStep, onClose: jest.fn() })
    );
    expect(lastFrame()).toContain('Command failed: eslint');
  });

  it('renders step-specific log excerpt when stepLogs provided', () => {
    const stepWithLogs = { ...baseStep, stepLogs: ['Log line 1', 'Log line 2', 'Log line 3'] };
    mockFormatStepDetail.mockReturnValue({
      lines: ['Name:       Documentation Validation'],
      hasError: false,
      logLines: ['Log line 1', 'Log line 2', 'Log line 3'],
    });
    const { lastFrame } = render(
      React.createElement(StepDetailOverlay, { step: stepWithLogs, onClose: jest.fn() })
    );
    expect(lastFrame()).toContain('Log line 1');
    expect(lastFrame()).toContain('Log line 2');
    expect(lastFrame()).toContain('Log line 3');
  });

  it('renders gracefully when step is null', () => {
    const { lastFrame } = render(
      React.createElement(StepDetailOverlay, { step: null, onClose: jest.fn() })
    );
    expect(lastFrame()).toContain('No step selected');
    expect(lastFrame()).toContain('[Esc]');
  });
});
