/**
 * @fileoverview Tests for useOrchestrator hook
 */

import { renderHook, act } from '@testing-library/react-hooks';
import useOrchestrator from '../../../src/cli/tui/hooks/useOrchestrator';

jest.useFakeTimers();

const createMockEngine = () => {
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
    emit: (event, payload) => {
      (listeners[event] || []).forEach((cb) => cb(payload));
    },
    listeners,
  };
};

const createMockOrchestrator = (engineOverrides = {}, status = { status: 'running', progress: 0 }) => {
  const workflowEngine = createMockEngine();
  Object.assign(workflowEngine, engineOverrides);
  return {
    workflowEngine,
    getStatus: jest.fn(() => status),
  };
};

describe('useOrchestrator', () => {
  afterEach(() => {
    jest.clearAllTimers();
    jest.clearAllMocks();
  });

  it('should initialize with default state', () => {
    const orchestrator = createMockOrchestrator();
    const { result } = renderHook(() => useOrchestrator(orchestrator));
    expect(result.current.steps).toEqual({});
    expect(result.current.logs).toEqual([]);
    expect(result.current.progress).toBe(0);
    expect(result.current.currentStepId).toBeNull();
    expect(result.current.isComplete).toBe(false);
    expect(result.current.lastError).toBeNull();
    expect(result.current.streamChunks).toMatchObject({
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
    const orchestrator = createMockOrchestrator();
    const { result } = renderHook(() => useOrchestrator(orchestrator));
    const step = { id: 's1', name: 'Step 1' };

    act(() => {
      orchestrator.workflowEngine.emit('step:start', { step });
    });

    expect(result.current.currentStepId).toBe('s1');
    expect(result.current.steps['s1']).toMatchObject({
      id: 's1',
      name: 'Step 1',
      status: 'running',
      duration: null,
    });
    expect(result.current.logs[result.current.logs.length - 1].message).toContain('→ Starting: Step 1');
  });

  it('should handle step:complete event and update state and progress', () => {
    const orchestrator = createMockOrchestrator(undefined, { status: 'running', progress: 42 });
    const { result } = renderHook(() => useOrchestrator(orchestrator));
    const step = { id: 's2', name: 'Step 2' };

    act(() => {
      orchestrator.workflowEngine.emit('step:start', { step });
      orchestrator.workflowEngine.emit('step:complete', { step, result: { duration: 1234 } });
    });

    expect(result.current.steps['s2'].status).toBe('done');
    expect(result.current.steps['s2'].duration).toBe(1234);
    expect(result.current.progress).toBe(42);
    expect(result.current.logs[result.current.logs.length - 1].message).toContain('✓ Completed: Step 2');
  });

  it('should handle step:error event and update state and lastError', () => {
    const orchestrator = createMockOrchestrator();
    const { result } = renderHook(() => useOrchestrator(orchestrator));
    const step = { id: 's3', name: 'Step 3' };
    const error = { message: 'fail', exitCode: 1, stack: 'stacktrace' };

    act(() => {
      orchestrator.workflowEngine.emit('step:start', { step });
      orchestrator.workflowEngine.emit('step:error', { step, error });
    });

    expect(result.current.steps['s3'].status).toBe('error');
    expect(result.current.steps['s3'].exitCode).toBe(1);
    expect(result.current.steps['s3'].errorMessage).toBe('fail');
    expect(result.current.lastError).toMatchObject({
      stepId: 's3',
      stepName: 'Step 3',
      message: 'fail',
      stack: 'stacktrace',
    });
    expect(result.current.logs[result.current.logs.length - 1].message).toContain('✗ Failed: Step 3');
  });

  it('should handle step:skipped event and update state', () => {
    const orchestrator = createMockOrchestrator();
    const { result } = renderHook(() => useOrchestrator(orchestrator));
    const step = { id: 's4', name: 'Step 4' };

    act(() => {
      orchestrator.workflowEngine.emit('step:start', { step });
      orchestrator.workflowEngine.emit('step:skipped', { step, result: { reason: 'no changes' } });
    });

    expect(result.current.steps['s4'].status).toBe('skipped');
    expect(result.current.logs[result.current.logs.length - 1].message).toContain('⊘ Skipped: Step 4 (no changes)');
  });

  it('should handle ai:stream:chunk and ai:stream:end events', () => {
    const orchestrator = createMockOrchestrator();
    const { result } = renderHook(() => useOrchestrator(orchestrator));

    act(() => {
      orchestrator.workflowEngine.emit('ai:stream:chunk', {
        stepId: 's5',
        stepName: 'Step 5',
        persona: 'ai',
        delta: 'Hello ',
      });
      orchestrator.workflowEngine.emit('ai:stream:chunk', {
        stepId: 's5',
        stepName: 'Step 5',
        persona: 'ai',
        delta: 'World',
      });
    });

    expect(result.current.streamChunks).toMatchObject({
      stepId: 's5',
      stepName: 'Step 5',
      persona: 'ai',
      liveText: 'Hello World',
      tokenCount: 2,
    });

    act(() => {
      orchestrator.workflowEngine.emit('ai:stream:end', {
        stepId: 's5',
        stepName: 'Step 5',
        totalTokens: 2,
        tokensPerSec: 10,
      });
    });

    expect(result.current.streamChunks.liveText).toBe('');
    expect(result.current.streamChunks.history.length).toBe(1);
    expect(result.current.streamChunks.history[0]).toMatchObject({
      stepId: 's5',
      stepName: 'Step 5',
      persona: 'ai',
      fullText: 'Hello World',
      tokenCount: 2,
      tokensPerSec: 10,
    });
  });

  it('should keep only the last MAX_LOG_LINES logs', () => {
    const orchestrator = createMockOrchestrator();
    const { result } = renderHook(() => useOrchestrator(orchestrator));
    const step = { id: 's6', name: 'Step 6' };

    act(() => {
      for (let i = 0; i < 210; i++) {
        orchestrator.workflowEngine.emit('step:start', { step: { id: `s6-${i}`, name: `Step 6-${i}` } });
      }
    });

    expect(result.current.logs.length).toBeLessThanOrEqual(200);
    expect(result.current.logs[0].message).toContain('→ Starting: Step 6-10');
  });

  it('should keep only the last MAX_STREAM_HISTORY ai responses', () => {
    const orchestrator = createMockOrchestrator();
    const { result } = renderHook(() => useOrchestrator(orchestrator));

    act(() => {
      for (let i = 0; i < 7; i++) {
        orchestrator.workflowEngine.emit('ai:stream:chunk', {
          stepId: `s${i}`,
          stepName: `Step ${i}`,
          persona: 'ai',
          delta: `msg${i}`,
        });
        orchestrator.workflowEngine.emit('ai:stream:end', {
          stepId: `s${i}`,
          stepName: `Step ${i}`,
          totalTokens: 1,
          tokensPerSec: 1,
        });
      }
    });

    expect(result.current.streamChunks.history.length).toBeLessThanOrEqual(5);
    expect(result.current.streamChunks.history[0].stepId).toBe('s2');
    expect(result.current.streamChunks.history[4].stepId).toBe('s6');
  });

  it('should mark isComplete and set progress when orchestrator signals success', () => {
    let status = { status: 'running', progress: 10 };
    const orchestrator = createMockOrchestrator(undefined, status);
    const { result, rerender } = renderHook(() => useOrchestrator(orchestrator));

    act(() => {
      status.status = 'success';
      status.progress = 100;
      jest.advanceTimersByTime(500);
    });

    expect(result.current.isComplete).toBe(true);
    expect(result.current.progress).toBe(100);
  });

  it('should mark isComplete and set progress when orchestrator signals failed', () => {
    let status = { status: 'running', progress: 10 };
    const orchestrator = createMockOrchestrator(undefined, status);
    const { result } = renderHook(() => useOrchestrator(orchestrator));

    act(() => {
      status.status = 'failed';
      status.progress = 80;
      jest.advanceTimersByTime(500);
    });

    expect(result.current.isComplete).toBe(true);
    expect(result.current.progress).toBe(80);
  });

  it('should handle missing orchestrator gracefully', () => {
    const { result } = renderHook(() => useOrchestrator(null));
    expect(result.current.steps).toEqual({});
    expect(result.current.logs).toEqual([]);
    expect(result.current.progress).toBe(0);
    expect(result.current.currentStepId).toBeNull();
    expect(result.current.isComplete).toBe(false);
    expect(result.current.lastError).toBeNull();
    expect(result.current.streamChunks).toMatchObject({
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
    const { result } = renderHook(() => useOrchestrator(orchestrator));
    expect(result.current.steps).toEqual({});
    expect(result.current.logs).toEqual([]);
  });

  it('should handle missing step or error fields in events', () => {
    const orchestrator = createMockOrchestrator();
    const { result } = renderHook(() => useOrchestrator(orchestrator));

    act(() => {
      orchestrator.workflowEngine.emit('step:start', { });
      orchestrator.workflowEngine.emit('step:complete', { });
      orchestrator.workflowEngine.emit('step:error', { });
      orchestrator.workflowEngine.emit('step:skipped', { });
    });

    expect(result.current.steps['unknown']).toBeDefined();
    expect(result.current.lastError).toBeDefined();
    expect(result.current.logs.length).toBeGreaterThan(0);
  });

  it('should not throw if orchestrator.getStatus throws', () => {
    const orchestrator = createMockOrchestrator();
    orchestrator.getStatus = jest.fn(() => { throw new Error('fail'); });
    const { result } = renderHook(() => useOrchestrator(orchestrator));
    const step = { id: 's7', name: 'Step 7' };

    act(() => {
      orchestrator.workflowEngine.emit('step:complete', { step, result: { duration: 100 } });
      jest.advanceTimersByTime(500);
    });

    expect(result.current.steps['s7'].status).toBe('done');
    expect(result.current.isComplete).toBe(false);
  });
});
