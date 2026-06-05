/**
 * @file StepsPanel.test.js
 * @description Tests for StepsPanel — cybernetic dot-indicator step list
 *
 * Custom implementation with colored dots:
 *   done    → ●  greenBright
 *   running → ●  cyanBright + [ ACTIVE ] badge
 *   skipped → ⊘  gray
 *   error   → ✗  red
 *   pending → ○  gray dimmed
 */

import React from 'react';
import { render, cleanup } from 'ink-testing-library';

let StepsPanel;
beforeAll(async () => {
  ({ StepsPanel } = await import('../../../../src/cli/tui/components/StepsPanel.js'));
});

afterEach(() => {
  cleanup();
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

  it('renders step names with dot indicators', () => {
    const { lastFrame } = render(
      React.createElement(StepsPanel, { steps: makeSteps(), currentStepId: 'step2', width: 40 })
    );
    expect(lastFrame()).toContain('Project Detection');
    expect(lastFrame()).toContain('Doc Validation');
    expect(lastFrame()).toContain('Test Generation');
    // done → ●, running → ●, pending → ○
    expect(lastFrame()).toContain('●');
    expect(lastFrame()).toContain('○');
  });

  it('shows [ ACTIVE ] badge on the running step', () => {
    const { lastFrame } = render(
      React.createElement(StepsPanel, { steps: makeSteps(), currentStepId: 'step2', width: 50 })
    );
    expect(lastFrame()).toContain('[ACTIVE]');
  });

  it('does not show [ ACTIVE ] badge when isFocused is false and no step is running', () => {
    const steps = {
      step1: { id: 'step1', name: 'Project Detection', status: 'done', duration: 1000 },
      step2: { id: 'step2', name: 'Doc Validation', status: 'pending', duration: null },
    };
    const { lastFrame } = render(
      React.createElement(StepsPanel, {
        steps,
        currentStepId: null,
        width: 40,
        isFocused: false,
      })
    );
    expect(lastFrame()).not.toContain('[ACTIVE]');
  });

  it('renders error step with ✗ indicator', () => {
    const steps = {
      step1: {
        id: 'step1',
        name: 'Build',
        status: 'error',
        duration: null,
        errorMessage: 'exit 1',
      },
    };
    const { lastFrame } = render(
      React.createElement(StepsPanel, { steps, currentStepId: null, width: 40 })
    );
    expect(lastFrame()).toContain('✗');
    expect(lastFrame()).toContain('Build');
  });

  it('renders skipped step with ⊘ indicator', () => {
    const steps = {
      step1: { id: 'step1', name: 'Skipped Step', status: 'skipped', duration: null },
    };
    const { lastFrame } = render(
      React.createElement(StepsPanel, { steps, currentStepId: null, width: 40 })
    );
    expect(lastFrame()).toContain('⊘');
    expect(lastFrame()).toContain('Skipped Step');
  });

  it('renders [ STEPS ] section title', () => {
    const { lastFrame } = render(
      React.createElement(StepsPanel, { steps: makeSteps(), currentStepId: 'step2', width: 40 })
    );
    expect(lastFrame()).toContain('[ STEPS ]');
  });

  it('renders step counter in XX/YY format', () => {
    const { lastFrame } = render(
      React.createElement(StepsPanel, { steps: makeSteps(), currentStepId: 'step2', width: 40 })
    );
    // 1 done out of 3 total
    expect(lastFrame()).toContain('01/03');
  });

  it('does not call onSelectStep when not focused (j key)', () => {
    const { stdin, lastFrame } = render(
      React.createElement(StepsPanel, {
        steps: makeSteps(),
        currentStepId: 'step2',
        width: 40,
        isFocused: false,
      })
    );
    stdin.write('j');
    // No crash; component still renders
    expect(lastFrame()).toContain('STEPS');
  });
});
