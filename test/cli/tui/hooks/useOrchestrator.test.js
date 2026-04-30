/**
 * @fileoverview Tests for useOrchestrator hook
 *
 * Uses ink-testing-library + a thin Harness component to exercise the hook
 * without @testing-library/react-hooks (deprecated for React 18+).
 */

import { jest } from '@jest/globals';
import React from 'react';
import { act } from 'react';

// React 18 requires this global to enable act() in non-browser (Node) environments.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
import { render, cleanup } from 'ink-testing-library';
import { useOrchestrator } from '../../../../src/cli/tui/hooks/useOrchestrator.js';

jest.useFakeTimers();

// ---------------------------------------------------------------------------
// Shared state capture: the Harness component stores hook state on each render
// ---------------------------------------------------------------------------

/** @type {{ current: ReturnType<typeof useOrchestrator> | null }} */
const state = { current: null };

const Harness = ({ orchestrator }) => {
  state.current = useOrchestrator(orchestrator);
  return null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const createEngine = () => {
  const listeners = {};
  return {
    on: jest.fn((event, cb) => {
      listeners[event] = listeners[event] || [];
      listeners[event].push(cb);
    }),
    off: jest.fn((event, cb) => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter((fn) => fn !== cb);
      }
    }),
    emit: (event, payload) => (listeners[event] || []).forEach((cb) => cb(payload)),
    listeners,
  };
};

const setup = (mockStatus = { status: 'running', progress: 0 }) => {
  const workflowEngine = createEngine();
  const orchestrator = {
    workflowEngine,
    getStatus: jest.fn(() => mockStatus),
  };

  // ink-testing-library triggers async updates; wrap initial render in act() to
  // avoid React 18 warnings being treated as failures in CI.
  let rendered;
  act(() => {
    rendered = render(React.createElement(Harness, { orchestrator }));
  });

  return { orchestrator, workflowEngine, unmount: rendered.unmount, rerender: rendered.rerender };
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useOrchestrator', () => {
  afterEach(() => {
    // Ensure Ink unmount/cleanup happens within act() to avoid:
    // "An update to Root inside a test was not wrapped in act(...)".
    act(() => {
      cleanup();
    });
    jest.clearAllTimers();
    jest.clearAllMocks();
    state.current = null;
  });

  it('should initialize with default state', () => {
    setup();
    expect(state.current.steps).toEqual({});
    expect(state.current.logs).toEqual([]);
    expect(state.current.progress).toBe(0);
    expect(state.current.currentStepId).toBeNull();
    expect(state.current.isComplete).toBe(false);
    expect(state.current.lastError).toBeNull();
    expect(state.current.streamChunks).toMatchObject({
      stepId: null,
      stepName: null,
      persona: null,
      liveText: '',
      tokenCount: 0,
      tokensPerSec: 0,
      history: [],
    });
  });

  it('should handle step:start event and update state', () => {
    const { workflowEngine } = setup();
    const step = { id: 's1', name: 'Step 1' };

    act(() => {
      workflowEngine.emit('step:start', { step });
    });

    expect(state.current.currentStepId).toBe('s1');
    expect(state.current.steps['s1']).toMatchObject({
      id: 's1',
      name: 'Step 1',
      status: 'running',
      duration: null,
    });
    expect(state.current.logs[state.current.logs.length - 1].message).toContain('→ Starting: Step 1');
  });

  it('should handle step:complete event and update state and progress', () => {
    const mockStatus = { status: 'running', progress: 42 };
    const { workflowEngine } = setup(mockStatus);
    const step = { id: 's2', name: 'Step 2' };

    act(() => {
      workflowEngine.emit('step:start', { step });
      workflowEngine.emit('step:complete', { step, result: { duration: 1234 } });
    });

    expect(state.current.steps['s2'].status).toBe('done');
    expect(state.current.steps['s2'].duration).toBe(1234);
    expect(state.current.progress).toBe(42);
    expect(state.current.logs[state.current.logs.length - 1].message).toContain('✓ Completed: Step 2');
  });

  it('should handle step:error event and update state and lastError', () => {
    const { workflowEngine } = setup();
    const step = { id: 's3', name: 'Step 3' };
    const error = { message: 'fail', exitCode: 1, stack: 'stacktrace' };

    act(() => {
      workflowEngine.emit('step:start', { step });
      workflowEngine.emit('step:error', { step, error });
    });

    expect(state.current.steps['s3'].status).toBe('error');
    expect(state.current.steps['s3'].exitCode).toBe(1);
    expect(state.current.steps['s3'].errorMessage).toBe('fail');
    expect(state.current.lastError).toMatchObject({
      stepId: 's3',
      stepName: 'Step 3',
      message: 'fail',
      stack: 'stacktrace',
    });
    expect(state.current.logs[state.current.logs.length - 1].message).toContain('✗ Failed: Step 3');
  });

  it('should handle step:skipped event and update state', () => {
    const { workflowEngine } = setup();
    const step = { id: 's4', name: 'Step 4' };

    act(() => {
      workflowEngine.emit('step:start', { step });
      workflowEngine.emit('step:skipped', { step, result: { reason: 'no changes' } });
    });

    expect(state.current.steps['s4'].status).toBe('skipped');
    expect(state.current.logs[state.current.logs.length - 1].message).toContain('⊘ Skipped: Step 4 (no changes)');
  });

  it('should handle ai:stream:chunk and ai:stream:end events', () => {
    const { workflowEngine } = setup();

    act(() => {
      workflowEngine.emit('ai:stream:chunk', { stepId: 's5', stepName: 'Step 5', persona: 'ai', delta: 'Hello ' });
      workflowEngine.emit('ai:stream:chunk', { stepId: 's5', stepName: 'Step 5', persona: 'ai', delta: 'World' });
    });

    expect(state.current.streamChunks).toMatchObject({
      stepId: 's5',
      stepName: 'Step 5',
      persona: 'ai',
      liveText: 'Hello World',
      tokenCount: 2,
    });

    act(() => {
      workflowEngine.emit('ai:stream:end', { stepId: 's5', stepName: 'Step 5', totalTokens: 2, tokensPerSec: 10 });
    });

    expect(state.current.streamChunks.liveText).toBe('');
    expect(state.current.streamChunks.history.length).toBe(1);
    expect(state.current.streamChunks.history[0]).toMatchObject({
      stepId: 's5',
      stepName: 'Step 5',
      persona: 'ai',
      fullText: 'Hello World',
      tokenCount: 2,
      tokensPerSec: 10,
    });
  });

  it('should keep only the last MAX_LOG_LINES logs', () => {
    const { workflowEngine } = setup();

    act(() => {
      for (let i = 0; i < 210; i++) {
        workflowEngine.emit('step:start', { step: { id: `s6-${i}`, name: `Step 6-${i}` } });
      }
    });

    expect(state.current.logs.length).toBeLessThanOrEqual(200);
    expect(state.current.logs[0].message).toContain('→ Starting: Step 6-10');
  });

  it('should keep only the last MAX_STREAM_HISTORY ai responses', () => {
    const { workflowEngine } = setup();

    act(() => {
      for (let i = 0; i < 7; i++) {
        workflowEngine.emit('ai:stream:chunk', { stepId: `s${i}`, stepName: `Step ${i}`, persona: 'ai', delta: `msg${i}` });
        workflowEngine.emit('ai:stream:end', { stepId: `s${i}`, stepName: `Step ${i}`, totalTokens: 1, tokensPerSec: 1 });
      }
    });

    expect(state.current.streamChunks.history.length).toBeLessThanOrEqual(5);
    expect(state.current.streamChunks.history[0].stepId).toBe('s2');
    expect(state.current.streamChunks.history[4].stepId).toBe('s6');
  });

  it('should mark isComplete and set progress when orchestrator signals success', () => {
    const mockStatus = { status: 'running', progress: 10 };
    setup(mockStatus);

    act(() => {
      mockStatus.status = 'success';
      mockStatus.progress = 100;
      jest.advanceTimersByTime(500);
    });

    expect(state.current.isComplete).toBe(true);
    expect(state.current.progress).toBe(100);
  });

  it('should mark isComplete and set progress when orchestrator signals failed', () => {
    const mockStatus = { status: 'running', progress: 10 };
    setup(mockStatus);

    act(() => {
      mockStatus.status = 'failed';
      mockStatus.progress = 80;
      jest.advanceTimersByTime(500);
    });

    expect(state.current.isComplete).toBe(true);
    expect(state.current.progress).toBe(80);
  });

  it('should handle missing orchestrator gracefully', () => {
    act(() => {
      render(React.createElement(Harness, { orchestrator: null }));
    });
    expect(state.current.steps).toEqual({});
    expect(state.current.logs).toEqual([]);
    expect(state.current.progress).toBe(0);
    expect(state.current.currentStepId).toBeNull();
    expect(state.current.isComplete).toBe(false);
    expect(state.current.lastError).toBeNull();
    expect(state.current.streamChunks).toMatchObject({
      stepId: null,
      stepName: null,
      persona: null,
      liveText: '',
      tokenCount: 0,
      tokensPerSec: 0,
      history: [],
    });
  });

  it('should handle missing workflowEngine gracefully', () => {
    const orchestrator = {};
    act(() => {
      render(React.createElement(Harness, { orchestrator }));
    });
    expect(state.current.steps).toEqual({});
    expect(state.current.logs).toEqual([]);
  });

  it('should handle missing step or error fields in events', () => {
    const { workflowEngine } = setup();

    act(() => {
      workflowEngine.emit('step:start', {});
      workflowEngine.emit('step:complete', {});
      workflowEngine.emit('step:error', {});
      workflowEngine.emit('step:skipped', {});
    });

    expect(state.current.steps['unknown']).toBeDefined();
    expect(state.current.lastError).toBeDefined();
    expect(state.current.logs.length).toBeGreaterThan(0);
  });

  it('should not throw if orchestrator.getStatus throws', () => {
    const { orchestrator, workflowEngine } = setup();
    orchestrator.getStatus = jest.fn(() => {
      throw new Error('fail');
    });
    const step = { id: 's7', name: 'Step 7' };

    act(() => {
      workflowEngine.emit('step:complete', { step, result: { duration: 100 } });
      jest.advanceTimersByTime(500);
    });

    expect(state.current.steps['s7'].status).toBe('done');
    expect(state.current.isComplete).toBe(false);
  });
});
