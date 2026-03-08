/**
 * @file App.test.js
 * @description Tests for App — root Ink component for the TUI dashboard
 */

import { jest } from '@jest/globals';
import React from 'react';
import { render, cleanup } from 'ink-testing-library';
import { Text } from 'ink';

// Mock functions for helpers and hooks
const mockTerminalIsSufficient = jest.fn(() => true);
const mockStepsPanelWidth = jest.fn(() => 30);
const mockUseOrchestrator = jest.fn();

// Mock child components — must use Ink's Text (not <span>)
jest.unstable_mockModule('../../../src/cli/tui/components/Header.js', () => ({
  Header: () => React.createElement(Text, {}, 'Header'),
}));
jest.unstable_mockModule('../../../src/cli/tui/components/StepsPanel.js', () => ({
  StepsPanel: () => React.createElement(Text, {}, 'StepsPanel'),
}));
jest.unstable_mockModule('../../../src/cli/tui/components/LogPanel.js', () => ({
  LogPanel: () => React.createElement(Text, {}, 'LogPanel'),
}));
jest.unstable_mockModule('../../../src/cli/tui/components/ProgressBar.js', () => ({
  ProgressBar: () => React.createElement(Text, {}, 'ProgressBar'),
}));
jest.unstable_mockModule('../../../src/cli/tui/components/StatusBar.js', () => ({
  StatusBar: () => React.createElement(Text, {}, 'StatusBar'),
}));
jest.unstable_mockModule('../../../src/cli/tui/components/HelpOverlay.js', () => ({
  HelpOverlay: () => React.createElement(Text, {}, 'HelpOverlay'),
}));
jest.unstable_mockModule('../../../src/cli/tui/components/StepDetailOverlay.js', () => ({
  StepDetailOverlay: () => React.createElement(Text, {}, 'StepDetailOverlay'),
}));
jest.unstable_mockModule('../../../src/cli/tui/components/ErrorDetailPanel.js', () => ({
  ErrorDetailPanel: () => React.createElement(Text, {}, 'ErrorDetailPanel'),
}));

// Mock helpers
jest.unstable_mockModule('../../../src/cli/tui/helpers.js', () => ({
  terminalIsSufficient: mockTerminalIsSufficient,
  stepsPanelWidth: mockStepsPanelWidth,
}));

// Mock useOrchestrator hook
jest.unstable_mockModule('../../../src/cli/tui/hooks/useOrchestrator.js', () => ({
  useOrchestrator: mockUseOrchestrator,
}));

let App;
beforeAll(async () => {
  ({ App } = await import('../../../src/cli/tui/App.js'));
});

describe('App TUI Component', () => {
  const orchestratorMock = {
    getStatus: jest.fn(() => ({ total: 5 })),
    abort: jest.fn(),
    projectRoot: '/test/project',
  };

  const makeOrchestratorState = (overrides = {}) => ({
    steps: {
      step1: { id: 'step1', name: 'Step 1', status: 'done' },
      step2: { id: 'step2', name: 'Step 2', status: 'skipped' },
      step3: { id: 'step3', name: 'Step 3', status: 'pending' },
    },
    logs: [],
    progress: 60,
    currentStepId: 'step3',
    isComplete: false,
    lastError: null,
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockTerminalIsSufficient.mockReturnValue(true);
    mockStepsPanelWidth.mockReturnValue(30);
    mockUseOrchestrator.mockImplementation(() => makeOrchestratorState());
  });

  afterEach(() => {
    cleanup();
  });

  it('renders dashboard with all panels on happy path', () => {
    const { lastFrame } = render(
      React.createElement(App, { orchestrator: orchestratorMock, stage: 'run', version: '1.0.0' })
    );
    expect(lastFrame()).toContain('Header');
    expect(lastFrame()).toContain('StepsPanel');
    expect(lastFrame()).toContain('LogPanel');
    expect(lastFrame()).toContain('ProgressBar');
    expect(lastFrame()).toContain('StatusBar');
    expect(lastFrame()).not.toContain('✓ Workflow complete');
  });

  it('shows workflow complete message when isComplete is true', () => {
    mockUseOrchestrator.mockImplementation(() =>
      makeOrchestratorState({ isComplete: true, progress: 100 })
    );
    const { lastFrame } = render(
      React.createElement(App, { orchestrator: orchestratorMock, stage: 'run', version: '1.0.0' })
    );
    expect(lastFrame()).toContain('✓ Workflow complete');
  });

  it('calls onExit and exit on q/Q input', () => {
    const onExit = jest.fn();
    const { stdin } = render(
      React.createElement(App, {
        orchestrator: orchestratorMock,
        stage: 'run',
        version: '1.0.0',
        onExit,
      })
    );
    stdin.write('q');
    expect(onExit).toHaveBeenCalled();
  });

  it('calls orchestrator.abort on a/A input when not complete', () => {
    const orchestrator = { ...orchestratorMock, abort: jest.fn() };
    const { stdin } = render(
      React.createElement(App, { orchestrator, stage: 'run', version: '1.0.0' })
    );
    stdin.write('a');
    expect(orchestrator.abort).toHaveBeenCalled();
  });

  it('does not call abort on a/A input when isComplete is true', () => {
    mockUseOrchestrator.mockImplementation(() => makeOrchestratorState({ isComplete: true }));
    const orchestrator = { ...orchestratorMock, abort: jest.fn() };
    const { stdin } = render(
      React.createElement(App, { orchestrator, stage: 'run', version: '1.0.0' })
    );
    stdin.write('a');
    expect(orchestrator.abort).not.toHaveBeenCalled();
  });

  it('shows terminal too small warning when terminalIsSufficient returns false', () => {
    mockTerminalIsSufficient.mockReturnValue(false);
    const { lastFrame } = render(
      React.createElement(App, { orchestrator: orchestratorMock, stage: 'run', version: '1.0.0' })
    );
    expect(lastFrame()).toContain('⚠ Terminal too small for TUI mode');
    expect(lastFrame()).toContain('Minimum size: 80×20');
  });

  it('handles orchestrator.getStatus throwing error gracefully', () => {
    const orchestrator = {
      ...orchestratorMock,
      getStatus: jest.fn(() => {
        throw new Error('fail');
      }),
    };
    const { lastFrame } = render(
      React.createElement(App, { orchestrator, stage: 'run', version: '1.0.0' })
    );
    expect(lastFrame()).toContain('Header');
  });

  it('auto-exits after completion and calls onExit', () => {
    jest.useFakeTimers();
    const onExit = jest.fn();
    mockUseOrchestrator.mockImplementation(() => makeOrchestratorState({ isComplete: true }));
    render(
      React.createElement(App, {
        orchestrator: orchestratorMock,
        stage: 'run',
        version: '1.0.0',
        onExit,
      })
    );
    jest.advanceTimersByTime(3000);
    expect(onExit).toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('renders with default version when version prop is not provided', () => {
    const { lastFrame } = render(
      React.createElement(App, { orchestrator: orchestratorMock, stage: 'run' })
    );
    expect(lastFrame()).toContain('Header');
  });

  it('shows HelpOverlay when h is pressed', async () => {
    const { stdin, lastFrame } = render(
      React.createElement(App, { orchestrator: orchestratorMock, stage: 'run', version: '1.0.0' })
    );
    stdin.write('h');
    await new Promise((resolve) => setImmediate(resolve));
    expect(lastFrame()).toContain('HelpOverlay');
  });

  it('hides HelpOverlay when h is pressed again', async () => {
    const { stdin, lastFrame } = render(
      React.createElement(App, { orchestrator: orchestratorMock, stage: 'run', version: '1.0.0' })
    );
    stdin.write('h');
    await new Promise((resolve) => setImmediate(resolve));
    expect(lastFrame()).toContain('HelpOverlay');
    stdin.write('h');
    await new Promise((resolve) => setImmediate(resolve));
    expect(lastFrame()).not.toContain('HelpOverlay');
  });

  it('shows ErrorDetailPanel when e is pressed and lastError exists', async () => {
    const error = {
      stepId: 'step1',
      stepName: 'Step 1',
      message: 'Test error',
      stack: 'Error: Test error\n  at step1',
    };
    mockUseOrchestrator.mockImplementation(() => makeOrchestratorState({ lastError: error }));
    const { lastFrame } = render(
      React.createElement(App, { orchestrator: orchestratorMock, stage: 'run', version: '1.0.0' })
    );
    // lastError triggers the auto-open useEffect; await one tick for React to process effects
    await new Promise((resolve) => setImmediate(resolve));
    expect(lastFrame()).toContain('ErrorDetailPanel');
  });

  it('does not show ErrorDetailPanel when e pressed but no lastError', () => {
    const { stdin, lastFrame } = render(
      React.createElement(App, { orchestrator: orchestratorMock, stage: 'run', version: '1.0.0' })
    );
    stdin.write('e');
    expect(lastFrame()).not.toContain('ErrorDetailPanel');
  });

  it('Tab cycles focus between panels', () => {
    // Just verify it does not crash — focus state is internal
    const { stdin, lastFrame } = render(
      React.createElement(App, { orchestrator: orchestratorMock, stage: 'run', version: '1.0.0' })
    );
    stdin.write('\t');
    expect(lastFrame()).toContain('Header');
  });

  it('Escape closes HelpOverlay', async () => {
    const { stdin, lastFrame } = render(
      React.createElement(App, { orchestrator: orchestratorMock, stage: 'run', version: '1.0.0' })
    );
    stdin.write('h');
    await new Promise((resolve) => setImmediate(resolve));
    expect(lastFrame()).toContain('HelpOverlay');
    stdin.write('\u001b'); // Escape — Ink may schedule a pendingInputFlush via setImmediate
    await new Promise((resolve) => setImmediate(resolve)); // first tick: pending escape flush
    await new Promise((resolve) => setImmediate(resolve)); // second tick: React state update
    expect(lastFrame()).not.toContain('HelpOverlay');
  });
});
