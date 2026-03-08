/**
 * @file StepsPanel.test.js
 * @description Tests for StepsPanel — step list with keyboard selection
 */

import { jest } from '@jest/globals';
import React from 'react';
import { render } from 'ink-testing-library';

const mockFormatStepIcon = jest.fn((status) => {
  const icons = { running: '⚡', done: '✅', skipped: '⊘', error: '❌', pending: '⏳' };
  return icons[status] ?? '⏳';
});
const mockStatusColor = jest.fn(() => 'white');
const mockFormatDuration = jest.fn((ms) => `${Math.round(ms / 1000)}s`);

jest.unstable_mockModule('../../../../src/cli/tui/helpers.js', () => ({
  formatStepIcon: mockFormatStepIcon,
  statusColor: mockStatusColor,
  formatDuration: mockFormatDuration,
}));

let StepsPanel;
beforeAll(async () => {
  ({ StepsPanel } = await import('../../../../src/cli/tui/components/StepsPanel.js'));
});

describe('StepsPanel Component', () => {
  const makeSteps = () => ({
    step1: { id: 'step1', name: 'Project Detection', status: 'done', duration: 1000 },
    step2: { id: 'step2', name: 'Doc Validation', status: 'running', duration: null },
    step3: { id: 'step3', name: 'Test Generation', status: 'pending', duration: null },
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders "Waiting for steps…" when steps are empty (happy path)', () => {
    const { lastFrame } = render(
      React.createElement(StepsPanel, { steps: {}, currentStepId: null, width: 30 })
    );
    expect(lastFrame()).toContain('Waiting for steps…');
    expect(lastFrame()).toContain('STEPS');
  });

  it('renders step names and icons', () => {
    const { lastFrame } = render(
      React.createElement(StepsPanel, { steps: makeSteps(), currentStepId: 'step2', width: 40 })
    );
    expect(lastFrame()).toContain('Project Detection');
    expect(lastFrame()).toContain('Doc Validation');
    expect(lastFrame()).toContain('Test Generation');
    expect(lastFrame()).toContain('✅');
    expect(lastFrame()).toContain('⚡');
    expect(lastFrame()).toContain('⏳');
  });

  it('shows cursor (>) for selected step when isFocused', () => {
    const { lastFrame } = render(
      React.createElement(StepsPanel, {
        steps: makeSteps(),
        currentStepId: 'step2',
        width: 40,
        isFocused: true,
        selectedStepId: 'step1',
      })
    );
    expect(lastFrame()).toContain('>');
  });

  it('does not show cursor when isFocused is false', () => {
    const { lastFrame } = render(
      React.createElement(StepsPanel, {
        steps: makeSteps(),
        currentStepId: 'step2',
        width: 40,
        isFocused: false,
        selectedStepId: 'step1',
      })
    );
    // The cursor char > should not appear prominently
    expect(lastFrame()).not.toMatch(/^>/m);
  });

  it('calls onSelectStep with next step id on j key when focused', () => {
    const onSelectStep = jest.fn();
    const { stdin } = render(
      React.createElement(StepsPanel, {
        steps: makeSteps(),
        currentStepId: 'step2',
        width: 40,
        isFocused: true,
        selectedStepId: 'step1',
        onSelectStep,
      })
    );
    stdin.write('j');
    expect(onSelectStep).toHaveBeenCalledWith('step2');
  });

  it('calls onSelectStep with previous step id on k key when focused', () => {
    const onSelectStep = jest.fn();
    const { stdin } = render(
      React.createElement(StepsPanel, {
        steps: makeSteps(),
        currentStepId: 'step2',
        width: 40,
        isFocused: true,
        selectedStepId: 'step2',
        onSelectStep,
      })
    );
    stdin.write('k');
    expect(onSelectStep).toHaveBeenCalledWith('step1');
  });

  it('does not call onSelectStep when not focused', () => {
    const onSelectStep = jest.fn();
    const { stdin } = render(
      React.createElement(StepsPanel, {
        steps: makeSteps(),
        currentStepId: 'step2',
        width: 40,
        isFocused: false,
        selectedStepId: 'step1',
        onSelectStep,
      })
    );
    stdin.write('j');
    expect(onSelectStep).not.toHaveBeenCalled();
  });

  it('renders durations for completed steps', () => {
    const { lastFrame } = render(
      React.createElement(StepsPanel, { steps: makeSteps(), currentStepId: 'step2', width: 40 })
    );
    expect(lastFrame()).toContain('1s');
  });
});
