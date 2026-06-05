/**
 * @file Header.test.js
 * @description Tests for Header — cybernetic breadcrumb top bar
 */

import React from 'react';
import { render, cleanup } from 'ink-testing-library';
import { Header } from '../../../../src/cli/tui/components/Header.js';

afterEach(() => {
  cleanup();
});

describe('Header Component', () => {
  it('renders breadcrumb with stage and version (happy path)', () => {
    const { lastFrame } = render(
      React.createElement(Header, { stage: 'run', completed: 3, total: 5, version: '2.0.0' })
    );
    expect(lastFrame()).toContain('ai-workflow');
    expect(lastFrame()).toContain('[v2.0.0]');
    expect(lastFrame()).toContain('03/05');
  });

  it('renders default version when version prop is not provided', () => {
    const { lastFrame } = render(
      React.createElement(Header, { stage: 'init', completed: 0, total: 10 })
    );
    expect(lastFrame()).toContain('[v1.6.3]');
    expect(lastFrame()).toContain('00/10');
  });

  it('shows "initializing" when no currentStepId is provided', () => {
    const { lastFrame } = render(
      React.createElement(Header, { stage: 'setup', completed: 0, total: 0, version: '3.1.0' })
    );
    expect(lastFrame()).toContain('initializing');
    expect(lastFrame()).toContain('[v3.1.0]');
  });

  it('shows currentStepId and currentStepName in breadcrumb', () => {
    const { lastFrame } = render(
      React.createElement(Header, {
        stage: 'run',
        completed: 5,
        total: 10,
        version: '1.0.0',
        currentStepId: 'step_05',
        currentStepName: 'consistency_analysis',
      })
    );
    expect(lastFrame()).toContain('ai-workflow');
    expect(lastFrame()).toContain('step_05');
    expect(lastFrame()).toContain('consistency_analysis');
  });

  it('shows step counter padded', () => {
    const { lastFrame } = render(
      React.createElement(Header, {
        stage: 'run',
        completed: 1,
        total: 32,
        version: '1.0.0',
      })
    );
    expect(lastFrame()).toContain('01/32');
  });

  it('shows projectVersion in version badge when provided', () => {
    const { lastFrame } = render(
      React.createElement(Header, {
        stage: 'run',
        completed: 0,
        total: 5,
        version: '2.0.0',
        projectVersion: '1.5.0',
      })
    );
    expect(lastFrame()).toContain('[v2.0.0');
    expect(lastFrame()).toContain('1.5.0');
  });

  it('handles empty stage gracefully', () => {
    const { lastFrame } = render(
      React.createElement(Header, { stage: '', completed: 1, total: 2, version: '1.0.0' })
    );
    expect(lastFrame()).toContain('ai-workflow');
    expect(lastFrame()).toContain('[v1.0.0]');
    expect(lastFrame()).toContain('01/02');
  });
});
