/**
 * @file App.test.js
 * @description Tests for App — root Ink component for the TUI dashboard
 */

import React from 'react';
import { render, act } from 'ink-testing-library';
import { App } from '../../../src/cli/tui/App.js';

// Mock child components
jest.mock('../../../src/cli/tui/components/Header.js', () => ({
  Header: () => React.createElement('header', {}, 'Header')
}));
jest.mock('../../../src/cli/tui/components/StepsPanel.js', () => ({
  StepsPanel: () => React.createElement('steps-panel', {}, 'StepsPanel')
}));
jest.mock('../../../src/cli/tui/components/LogPanel.js', () => ({
  LogPanel: () => React.createElement('log-panel', {}, 'LogPanel')
}));
jest.mock('../../../src/cli/tui/components/ProgressBar.js', () => ({
  ProgressBar: () => React.createElement('progress-bar', {}, 'ProgressBar')
}));
jest.mock('../../../src/cli/tui/components/StatusBar.js', () => ({
  StatusBar: () => React.createElement('status-bar', {}, 'StatusBar')
}));

// Mock helpers
jest.mock('../../../src/cli/tui/helpers.js', () => ({
  terminalIsSufficient: jest.fn(() => true),
  stepsPanelWidth: jest.fn(() => 30)
}));

// Mock useOrchestrator hook
const mockUseOrchestrator = ({
  steps = {},
  logs = [],
  progress = 0,
  currentStepId = 'step1',
  isComplete = false
} = {}) => ({
  steps,
  logs,
  progress,
  currentStepId,
  isComplete
});
jest.mock('../../../src/cli/tui/hooks/useOrchestrator.js', () => ({
  useOrchestrator: jest.fn()
}));

describe('App TUI Component', () => {
  const orchestratorMock = {
    getStatus: jest.fn(() => ({ total: 5 })),
    abort: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    require('../../../src/cli/tui/helpers.js').terminalIsSufficient.mockReturnValue(true);
    require('../../../src/cli/tui/helpers.js').stepsPanelWidth.mockReturnValue(30);
    require('../../../src/cli/tui/hooks/useOrchestrator.js').useOrchestrator.mockImplementation(() =>
      mockUseOrchestrator({
        steps: {
          step1: { status: 'done' },
          step2: { status: 'skipped' },
          step3: { status: 'pending' }
        },
        logs: ['log1', 'log2'],
        progress: 60,
        currentStepId: 'step3',
        isComplete: false
      })
    );
  });

  it('renders dashboard with all panels on happy path', () => {
    const { lastFrame } = render(
      <App orchestrator={orchestratorMock} stage="run" version="1.0.0" />
    );
    expect(lastFrame()).toContain('Header');
    expect(lastFrame()).toContain('StepsPanel');
    expect(lastFrame()).toContain('LogPanel');
    expect(lastFrame()).toContain('progress-bar');
    expect(lastFrame()).toContain('status-bar');
    expect(lastFrame()).not.toContain('✓ Workflow complete');
  });

  it('shows workflow complete message when isComplete is true', () => {
    require('../../../src/cli/tui/hooks/useOrchestrator.js').useOrchestrator.mockImplementation(() =>
      mockUseOrchestrator({
        steps: {
          step1: { status: 'done' },
          step2: { status: 'skipped' }
        },
        logs: [],
        progress: 100,
        currentStepId: 'step2',
        isComplete: true
      })
    );
    const { lastFrame } = render(
      <App orchestrator={orchestratorMock} stage="run" version="1.0.0" />
    );
    expect(lastFrame()).toContain('✓ Workflow complete');
  });

  it('calls onExit and exit on q/Q input', () => {
    const onExit = jest.fn();
    const { stdin } = render(
      <App orchestrator={orchestratorMock} stage="run" version="1.0.0" onExit={onExit} />
    );
    act(() => {
      stdin.write('q');
    });
    expect(onExit).toHaveBeenCalled();
  });

  it('calls orchestrator.abort on a/A input when not complete', () => {
    const orchestrator = { ...orchestratorMock, abort: jest.fn() };
    const { stdin } = render(
      <App orchestrator={orchestrator} stage="run" version="1.0.0" />
    );
    act(() => {
      stdin.write('a');
    });
    expect(orchestrator.abort).toHaveBeenCalled();
  });

  it('does not call abort on a/A input when isComplete is true', () => {
    require('../../../src/cli/tui/hooks/useOrchestrator.js').useOrchestrator.mockImplementation(() =>
      mockUseOrchestrator({ isComplete: true })
    );
    const orchestrator = { ...orchestratorMock, abort: jest.fn() };
    const { stdin } = render(
      <App orchestrator={orchestrator} stage="run" version="1.0.0" />
    );
    act(() => {
      stdin.write('a');
    });
    expect(orchestrator.abort).not.toHaveBeenCalled();
  });

  it('shows terminal too small warning when terminalIsSufficient returns false', () => {
    require('../../../src/cli/tui/helpers.js').terminalIsSufficient.mockReturnValue(false);
    const { lastFrame } = render(
      <App orchestrator={orchestratorMock} stage="run" version="1.0.0" />
    );
    expect(lastFrame()).toContain('⚠ Terminal too small for TUI mode');
    expect(lastFrame()).toContain('Minimum size: 80×20');
  });

  it('handles orchestrator.getStatus throwing error gracefully', () => {
    const orchestrator = {
      ...orchestratorMock,
      getStatus: jest.fn(() => { throw new Error('fail'); })
    };
    const { lastFrame } = render(
      <App orchestrator={orchestrator} stage="run" version="1.0.0" />
    );
    expect(lastFrame()).toContain('Header');
    // Should not crash, total steps defaults to 0
  });

  it('auto-exits after completion and calls onExit', () => {
    jest.useFakeTimers();
    const onExit = jest.fn();
    require('../../../src/cli/tui/hooks/useOrchestrator.js').useOrchestrator.mockImplementation(() =>
      mockUseOrchestrator({ isComplete: true })
    );
    render(
      <App orchestrator={orchestratorMock} stage="run" version="1.0.0" onExit={onExit} />
    );
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(onExit).toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('renders with default version when version prop is not provided', () => {
    const { lastFrame } = render(
      <App orchestrator={orchestratorMock} stage="run" />
    );
    expect(lastFrame()).toContain('Header');
  });
});
