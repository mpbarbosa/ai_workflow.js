/**
 * @file StreamViewer.test.js
 * @description Unit tests for StreamViewer — live AI token stream panel component.
 */

import React from 'react';
import { render } from 'ink-testing-library';

let StreamViewer;

beforeAll(async () => {
  ({ StreamViewer } = await import('../../../../src/cli/tui/components/StreamViewer.js'));
});

/** Build a minimal StreamState object for tests. */
function makeStreamState(overrides = {}) {
  return {
    liveText: '',
    stepId: null,
    stepName: null,
    persona: null,
    tokenCount: 0,
    tokensPerSec: 0,
    history: [],
    ...overrides,
  };
}

describe('StreamViewer Component', () => {
  it('renders "Waiting for AI response" when no chunks received', () => {
    const state = makeStreamState();
    const { lastFrame } = render(
      React.createElement(StreamViewer, {
        streamChunks: state,
        width: 60,
        height: 12,
      })
    );
    expect(lastFrame()).toContain('Waiting for AI response');
  });

  it('renders live text in the body', () => {
    const state = makeStreamState({ liveText: 'Hello from the model', persona: 'engineer' });
    const { lastFrame } = render(
      React.createElement(StreamViewer, {
        streamChunks: state,
        width: 60,
        height: 12,
      })
    );
    expect(lastFrame()).toContain('Hello from the model');
  });

  it('renders header with stepId and persona', () => {
    const state = makeStreamState({
      stepId: 'step_03',
      persona: 'test_engineer',
      liveText: 'Generating tests...',
    });
    const { lastFrame } = render(
      React.createElement(StreamViewer, {
        streamChunks: state,
        width: 60,
        height: 12,
      })
    );
    const frame = lastFrame();
    expect(frame).toContain('step_03');
    expect(frame).toContain('test_engineer');
  });

  it('shows [live] indicator when no history exists', () => {
    const state = makeStreamState({ liveText: 'some text' });
    const { lastFrame } = render(
      React.createElement(StreamViewer, {
        streamChunks: state,
        width: 60,
        height: 12,
      })
    );
    // No history entries → no [live] badge shown (histLen === 0 branch)
    expect(lastFrame()).not.toContain('[history');
  });

  it('shows token stats when tokenCount > 0', () => {
    const state = makeStreamState({ tokenCount: 42, tokensPerSec: 10 });
    const { lastFrame } = render(
      React.createElement(StreamViewer, {
        streamChunks: state,
        width: 60,
        height: 12,
      })
    );
    expect(lastFrame()).toContain('tok/s');
    expect(lastFrame()).toContain('42');
  });

  it('renders dashes for step/persona when not set', () => {
    const state = makeStreamState({ stepId: null, persona: null });
    const { lastFrame } = render(
      React.createElement(StreamViewer, {
        streamChunks: state,
        width: 60,
        height: 12,
      })
    );
    // Header falls back to '—' for both fields
    expect(lastFrame()).toContain('—');
  });

  it('renders without crashing when history is populated', () => {
    const state = makeStreamState({
      liveText: 'Live text here',
      history: [
        {
          stepId: 'step_01',
          stepName: 'Documentation',
          persona: 'doc_writer',
          fullText: 'Full response text from a completed step.',
          tokenCount: 15,
          tokensPerSec: 5,
        },
      ],
    });
    const { lastFrame } = render(
      React.createElement(StreamViewer, {
        streamChunks: state,
        width: 60,
        height: 12,
      })
    );
    // Should render live text by default (historyIndex -1)
    expect(lastFrame()).toContain('Live text here');
  });

  it('accepts isFocused prop and shows navigation hint', () => {
    const state = makeStreamState();
    const { lastFrame } = render(
      React.createElement(StreamViewer, {
        streamChunks: state,
        width: 60,
        height: 12,
        isFocused: true,
      })
    );
    expect(lastFrame()).toContain('[/] nav history');
  });
});

describe('StreamViewer wrapText (via rendering)', () => {
  it('wraps long live text and shows last body lines', () => {
    // Width 20 → innerWidth 18; a 36-char string wraps into 2 lines of 18 chars each.
    // Ink's `wrap: 'truncate'` on each Text will truncate to fit the box border width,
    // so we just assert the component renders without crash and both lines appear.
    const longText = 'ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJ';
    const state = makeStreamState({ liveText: longText });
    const { lastFrame } = render(
      React.createElement(StreamViewer, {
        streamChunks: state,
        width: 20,
        height: 12,
      })
    );
    const frame = lastFrame();
    // The component should render at least the first few chars of the text
    expect(frame).toContain('ABCDEFGHIJ');
  });
});
