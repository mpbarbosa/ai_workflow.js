/**
 * @file useOrchestrator.stream.test.js
 * @description Tests for streaming state managed by useOrchestrator hook.
 *
 * Strategy: render a thin Ink component that consumes useOrchestrator, emit
 * WorkflowEngine events on a fake EventEmitter, and inspect rendered output.
 */

import { jest, afterEach } from '@jest/globals';
import React from 'react';
import { EventEmitter } from 'events';
import { render } from 'ink-testing-library';
import { Text, Box } from 'ink';

// ── Minimal keepLast mock (pass-through) ────────────────────────────────────
jest.unstable_mockModule('../../../src/cli/tui/helpers.js', () => ({
  keepLast: (arr, n) => arr.slice(-n),
  formatTimestamp: (t) => String(t),
}));

let useOrchestrator;
beforeAll(async () => {
  ({ useOrchestrator } = await import('../../../src/cli/tui/hooks/useOrchestrator.js'));
});

const mountedRenders = [];

afterEach(() => {
  while (mountedRenders.length > 0) {
    mountedRenders.pop()?.unmount();
  }
});

// ── Build a fake orchestrator with a real EventEmitter as workflowEngine ────

function makeFakeOrchestrator() {
  const engine = new EventEmitter();
  return {
    workflowEngine: engine,
    getStatus: jest.fn(() => ({ isComplete: false, total: 1 })),
    abort: jest.fn(),
    projectRoot: '/fake',
  };
}

/**
 * A minimal Ink component that renders `streamChunks` fields as Text nodes
 * so we can assert on `lastFrame()`.
 */
function StreamTestHarness({ orchestrator }) {
  const state = useOrchestrator(orchestrator);
  const sc = state.streamChunks;
  return React.createElement(
    Box,
    { flexDirection: 'column' },
    React.createElement(Text, null, `live:${sc.liveText}`),
    React.createElement(Text, null, `tokenCount:${sc.tokenCount}`),
    React.createElement(Text, null, `persona:${sc.persona ?? 'null'}`),
    React.createElement(Text, null, `stepId:${sc.stepId ?? 'null'}`),
    React.createElement(Text, null, `histLen:${sc.history.length}`)
  );
}

function renderHarness(orchestrator) {
  const rendered = render(React.createElement(StreamTestHarness, { orchestrator }));
  mountedRenders.push(rendered);
  return rendered;
}

// ── Helper: wait for Ink re-render ─────────────────────────────────────────
const tick = () => new Promise((r) => setTimeout(r, 20));

describe('useOrchestrator — ai:stream:chunk events', () => {
  it('starts with empty liveText', async () => {
    const orch = makeFakeOrchestrator();
    const { lastFrame } = renderHarness(orch);
    await tick();
    expect(lastFrame()).toContain('live:');
    expect(lastFrame()).toContain('tokenCount:0');
  });

  it('appends delta to liveText on each chunk event', async () => {
    const orch = makeFakeOrchestrator();
    const { lastFrame } = renderHarness(orch);
    await tick();

    // Emit two chunks, one per tick (mirrors how the accumulate test works reliably)
    orch.workflowEngine.emit('ai:stream:chunk', {
      stepId: 'step_03',
      stepName: 'Test Gen',
      persona: 'test_engineer',
      delta: 'Hello ',
    });
    await tick();
    orch.workflowEngine.emit('ai:stream:chunk', {
      stepId: 'step_03',
      stepName: 'Test Gen',
      persona: 'test_engineer',
      delta: 'world',
    });
    await tick();

    expect(lastFrame()).toContain('live:Hello world');
    expect(lastFrame()).toContain('tokenCount:2');
    expect(lastFrame()).toContain('persona:test_engineer');
    expect(lastFrame()).toContain('stepId:step_03');
  });

  it('accumulates multiple chunk deltas', async () => {
    const orch = makeFakeOrchestrator();
    const { lastFrame } = renderHarness(orch);
    await tick();

    const chunks = ['Hello ', 'world', '!'];
    for (const delta of chunks) {
      orch.workflowEngine.emit('ai:stream:chunk', {
        stepId: 's1',
        stepName: 'Step 1',
        persona: 'engineer',
        delta,
      });
      await tick();
    }

    expect(lastFrame()).toContain('live:Hello world!');
    expect(lastFrame()).toContain('tokenCount:3');
  });
});

describe('useOrchestrator — ai:stream:end events', () => {
  it('pushes live text to history and resets liveText on end', async () => {
    const orch = makeFakeOrchestrator();
    const { lastFrame } = renderHarness(orch);
    await tick();

    // Emit a chunk then end it
    orch.workflowEngine.emit('ai:stream:chunk', {
      stepId: 'step_01',
      stepName: 'Docs',
      persona: 'doc_writer',
      delta: 'Full response',
    });
    await tick();

    orch.workflowEngine.emit('ai:stream:end', {
      stepId: 'step_01',
      stepName: 'Docs',
      totalTokens: 1,
      tokensPerSec: 2,
    });
    await tick();

    // liveText should be reset to ''
    expect(lastFrame()).toContain('live:');
    expect(lastFrame()).toContain('tokenCount:0');
    // History should have one entry
    expect(lastFrame()).toContain('histLen:1');
  });

  it('caps history ring at MAX_STREAM_HISTORY (5)', async () => {
    const orch = makeFakeOrchestrator();
    const { lastFrame } = renderHarness(orch);
    await tick();

    // Emit 7 complete stream cycles
    for (let i = 0; i < 7; i++) {
      orch.workflowEngine.emit('ai:stream:chunk', {
        stepId: `s${i}`,
        stepName: `Step ${i}`,
        persona: 'p',
        delta: `text${i}`,
      });
      await tick();
      orch.workflowEngine.emit('ai:stream:end', {
        stepId: `s${i}`,
        stepName: `Step ${i}`,
        totalTokens: 1,
        tokensPerSec: 1,
      });
      await tick();
    }

    // History should be capped at 5
    expect(lastFrame()).toContain('histLen:5');
  });
});
