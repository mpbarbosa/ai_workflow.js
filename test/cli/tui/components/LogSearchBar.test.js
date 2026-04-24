/**
 * @file LogSearchBar.test.js
 * @description Tests for LogSearchBar — inline search bar for LogPanel
 */

import React from 'react';
import { render, cleanup } from 'ink-testing-library';
import { LogSearchBar } from '../../../../src/cli/tui/components/LogSearchBar.js';

afterEach(() => {
  cleanup();
});

describe('LogSearchBar Component', () => {
  it('renders nothing when isActive is false', () => {
    const { lastFrame } = render(
      React.createElement(LogSearchBar, {
        query: 'hello',
        matchCount: 2,
        matchIndex: 0,
        isActive: false,
      })
    );
    // Should render an empty / minimal frame
    expect(lastFrame()).not.toContain('hello');
    expect(lastFrame()).not.toContain('/');
  });

  it('renders search prompt and query when isActive (happy path)', () => {
    const { lastFrame } = render(
      React.createElement(LogSearchBar, {
        query: 'error',
        matchCount: 3,
        matchIndex: 1,
        isActive: true,
      })
    );
    expect(lastFrame()).toContain('/');
    expect(lastFrame()).toContain('error');
    expect(lastFrame()).toContain('[2/3]');
  });

  it('renders cursor indicator', () => {
    const { lastFrame } = render(
      React.createElement(LogSearchBar, {
        query: 'test',
        matchCount: 1,
        matchIndex: 0,
        isActive: true,
      })
    );
    expect(lastFrame()).toContain('█');
  });

  it('shows "no matches" when matchCount is 0 and query is non-empty', () => {
    const { lastFrame } = render(
      React.createElement(LogSearchBar, {
        query: 'xyz',
        matchCount: 0,
        matchIndex: 0,
        isActive: true,
      })
    );
    expect(lastFrame()).toContain('no matches');
    expect(lastFrame()).toContain('/');
  });

  it('renders empty query with cursor only', () => {
    const { lastFrame } = render(
      React.createElement(LogSearchBar, { query: '', matchCount: 0, matchIndex: 0, isActive: true })
    );
    expect(lastFrame()).toContain('/');
    expect(lastFrame()).toContain('█');
    expect(lastFrame()).not.toContain('no matches');
  });

  it('shows match count [1/5] correctly', () => {
    const { lastFrame } = render(
      React.createElement(LogSearchBar, {
        query: 'warn',
        matchCount: 5,
        matchIndex: 0,
        isActive: true,
      })
    );
    expect(lastFrame()).toContain('[1/5]');
  });
});
