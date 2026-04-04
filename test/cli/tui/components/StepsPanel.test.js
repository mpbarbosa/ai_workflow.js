/**
 * @file StepsPanel.test.js
 * @description Tests for StepsPanel — backward-compatible adapter over ListPanel
 *
 * StepsPanel now delegates to ListPanel from pajussara_tui_comp, so icons and
 * duration formatting follow that package's helpers:
 *   done → '✔', running → '●', pending → '○', error → '✘'
 *   duration 1000ms → '1.0s'
 */

import { jest } from '@jest/globals';
import React from 'react';
import { render } from 'ink-testing-library';

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
    expect(lastFrame()).toContain('✔');
    expect(lastFrame()).toContain('●');
    expect(lastFrame()).toContain('○');
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
    expect(lastFrame()).toContain('1.0s');
  });

  // ── StatusBadge integration ──────────────────────────────────────────────

  it("copilotStatus='loading' renders spinner/Loading when currentStepId is set", () => {
    const { lastFrame } = render(
      React.createElement(StepsPanel, {
        steps: makeSteps(),
        currentStepId: 'step2',
        width: 40,
        copilotStatus: 'loading',
      })
    );
    const frame = lastFrame();
    const hasSpinner = ['⠋', '⠙', '⠸', '⠴', '⠦', '⠇'].some((c) => frame.includes(c));
    expect(hasSpinner || frame.includes('Loading…')).toBe(true);
  });

  it("copilotStatus='streaming' renders Streaming… label", () => {
    const { lastFrame } = render(
      React.createElement(StepsPanel, {
        steps: makeSteps(),
        currentStepId: 'step2',
        width: 40,
        copilotStatus: 'streaming',
      })
    );
    expect(lastFrame()).toContain('Streaming…');
  });

  it("copilotStatus='done' renders ✓ Done", () => {
    const { lastFrame } = render(
      React.createElement(StepsPanel, {
        steps: makeSteps(),
        currentStepId: null,
        width: 40,
        copilotStatus: 'done',
      })
    );
    expect(lastFrame()).toContain('✓');
    expect(lastFrame()).toContain('Done');
  });

  it("copilotStatus='error' renders ✗ and the error message", () => {
    const { lastFrame } = render(
      React.createElement(StepsPanel, {
        steps: makeSteps(),
        currentStepId: null,
        width: 40,
        copilotStatus: 'error',
        copilotErrorMessage: 'SDK timeout',
      })
    );
    expect(lastFrame()).toContain('✗');
    expect(lastFrame()).toContain('SDK timeout');
  });

  it("copilotStatus='idle' renders no badge", () => {
    const { lastFrame } = render(
      React.createElement(StepsPanel, {
        steps: makeSteps(),
        currentStepId: 'step2',
        width: 40,
        copilotStatus: 'idle',
      })
    );
    const frame = lastFrame();
    expect(frame).not.toContain('Loading…');
    expect(frame).not.toContain('Streaming…');
    expect(frame).not.toContain('Done');
    expect(frame).not.toContain('✓');
    expect(frame).not.toContain('✗');
  });

  it('badge is hidden when currentStepId is null and status is loading', () => {
    const { lastFrame } = render(
      React.createElement(StepsPanel, {
        steps: makeSteps(),
        currentStepId: null,
        width: 40,
        copilotStatus: 'loading',
      })
    );
    expect(lastFrame()).not.toContain('Loading…');
  });
});
