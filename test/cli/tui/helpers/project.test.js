// test/cli/tui/helpers/project.test.js

import { buildHelpLines } from '../../../../src/cli/tui/helpers/project.js';

describe('buildHelpLines', () => {
  it('should return the expected static list of help lines', () => {
    const expected = [
      'q / Q          Quit TUI',
      'a / A          Abort workflow',
      'Tab            Cycle panel focus (Steps ↔ Log ↔ Stream)',
      'v              Toggle stream viewer panel',
      'h              Toggle this help overlay',
      'e              Show/hide last error detail',
      '',
      'When Steps panel focused:',
      '  j / ↓        Select next step',
      '  k / ↑        Select previous step',
      '  Enter        Open step detail overlay',
      '',
      'When Log panel focused:',
      '  j / ↓        Scroll down (newer)',
      '  k / ↑        Scroll up (older)',
      '  g            Jump to bottom (newest)',
      '  G            Jump to top (oldest)',
      '  /            Open search bar',
      '  n / N        Next / previous match',
      '  Esc          Clear search / close overlay',
      '',
      'When Stream panel focused:',
      '  [            Navigate to older AI response',
      '  ]            Navigate to newer AI response / return to live',
      '',
      'Mouse:',
      '  Scroll wheel  Scroll active panel',
      '  Click step    Select step',
    ];
    expect(buildHelpLines()).toEqual(expected);
  });

  it('should always return a new array instance', () => {
    const arr1 = buildHelpLines();
    const arr2 = buildHelpLines();
    expect(arr1).not.toBe(arr2);
    expect(arr1).toEqual(arr2);
  });

  it('should return an array of only strings', () => {
    const result = buildHelpLines();
    expect(Array.isArray(result)).toBe(true);
    result.forEach(line => {
      expect(typeof line).toBe('string');
    });
  });

  it('should include key sections for Steps, Log, and Stream panels', () => {
    const lines = buildHelpLines();
    expect(lines).toEqual(
      expect.arrayContaining([
        expect.stringContaining('When Steps panel focused:'),
        expect.stringContaining('When Log panel focused:'),
        expect.stringContaining('When Stream panel focused:'),
        expect.stringContaining('Mouse:'),
      ])
    );
  });

  it('should include at least one empty string as a separator', () => {
    const lines = buildHelpLines();
    expect(lines).toContain('');
  });
});
