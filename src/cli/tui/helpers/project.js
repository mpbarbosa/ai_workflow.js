/**
 * @fileoverview ai-workflow-specific TUI helper functions
 * @module cli/tui/helpers/project
 *
 * Pure helpers that encode workflow-specific labels and keybindings for this
 * repository's TUI while delegating generic step-detail formatting to the
 * shared reusable helper module.
 */

/**
 * Return the static list of TUI keybinding descriptions for the help overlay.
 *
 * @returns {string[]}
 */
export function buildHelpLines() {
  return [
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
}

export { formatStepDetail } from './reusable.js';
