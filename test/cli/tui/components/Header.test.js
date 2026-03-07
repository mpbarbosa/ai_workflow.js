/**
 * @file Header.test.js
 * @description Tests for Header — top bar of the TUI dashboard
 */

import React from 'react';
import { render } from 'ink-testing-library';
import { Header } from '../../../../src/cli/tui/components/Header.js';

describe('Header Component', () => {
  it('renders project name, version, stage, and step counter (happy path)', () => {
    const { lastFrame } = render(
      <Header stage="run" completed={3} total={5} version="2.0.0" />
    );
    expect(lastFrame()).toContain('AI Workflow');
    expect(lastFrame()).toContain('v2.0.0');
    expect(lastFrame()).toContain('stage: run');
    expect(lastFrame()).toContain('Step 3/5');
  });

  it('renders default version when version prop is not provided', () => {
    const { lastFrame } = render(
      <Header stage="init" completed={0} total={10} />
    );
    expect(lastFrame()).toContain('v1.5.4');
    expect(lastFrame()).toContain('stage: init');
    expect(lastFrame()).toContain('Step 0/10');
  });

  it('shows "Initializing…" when total is 0', () => {
    const { lastFrame } = render(
      <Header stage="setup" completed={0} total={0} version="3.1.0" />
    );
    expect(lastFrame()).toContain('Initializing…');
    expect(lastFrame()).toContain('v3.1.0');
    expect(lastFrame()).toContain('stage: setup');
  });

  it('handles negative completed and total values gracefully', () => {
    const { lastFrame } = render(
      <Header stage="error" completed={-1} total={-5} version="0.0.1" />
    );
    expect(lastFrame()).toContain('Initializing…');
    expect(lastFrame()).toContain('v0.0.1');
    expect(lastFrame()).toContain('stage: error');
  });

  it('renders with completed greater than total', () => {
    const { lastFrame } = render(
      <Header stage="finalize" completed={10} total={5} version="4.2.0" />
    );
    expect(lastFrame()).toContain('Step 10/5');
    expect(lastFrame()).toContain('v4.2.0');
    expect(lastFrame()).toContain('stage: finalize');
  });

  it('renders with empty stage string', () => {
    const { lastFrame } = render(
      <Header stage="" completed={1} total={2} version="1.0.0" />
    );
    expect(lastFrame()).toContain('stage: ');
    expect(lastFrame()).toContain('Step 1/2');
    expect(lastFrame()).toContain('v1.0.0');
  });
});
