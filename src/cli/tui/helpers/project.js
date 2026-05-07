/**
 * @fileoverview ai-workflow-specific TUI helper functions
 * @module cli/tui/helpers/project
 *
 * Pure helpers that encode workflow-specific labels, keybindings, and step
 * metadata presentation for this repository's TUI.
 */

import { formatDuration } from './reusable.js';

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

/**
 * Format a workflow step entry into display lines for the step detail overlay.
 *
 * @param {{
 *   id?: string,
 *   name?: string,
 *   status?: string,
 *   duration?: number|null,
 *   retryCount?: number,
 *   exitCode?: number|null,
 *   errorMessage?: string|null,
 *   dependsOn?: string[],
 *   stepLogs?: string[],
 *   alternatives?: Array<{
 *     number?: number,
 *     title?: string,
 *     description?: string,
 *     tradeoffs?: string
 *   }>,
 *   recommendedAlternative?: string|null
 * }} step
 * @returns {{ lines: string[], hasError: boolean, logLines: string[] }}
 */
export function formatStepDetail(step) {
  if (!step) return { lines: [], hasError: false, logLines: [] };
  const lines = [
    `Name:       ${step.name ?? '(unknown)'}`,
    `ID:         ${step.id ?? '(unknown)'}`,
    `Status:     ${step.status ?? 'pending'}`,
  ];
  if (step.duration != null) lines.push(`Duration:   ${formatDuration(step.duration)}`);
  if (step.retryCount != null && step.retryCount > 0) lines.push(`Retries:    ${step.retryCount}`);
  const deps = Array.isArray(step.dependsOn) ? step.dependsOn : [];
  lines.push(`Depends-on: ${deps.length > 0 ? deps.join(', ') : '(none)'}`);
  const hasError = !!(step.exitCode != null || step.errorMessage);
  if (step.exitCode != null) lines.push(`Exit code:  ${step.exitCode}`);
  if (step.errorMessage) lines.push(`Error:      ${step.errorMessage}`);
  if (Array.isArray(step.alternatives) && step.alternatives.length > 0) {
    lines.push('');
    lines.push('Alternatives:');
    step.alternatives.forEach((alt) => {
      lines.push(`  [${alt.number ?? '?'}] ${alt.title ?? ''}`);
      if (alt.description) lines.push(`       ${alt.description.slice(0, 80)}`);
      if (alt.tradeoffs) lines.push(`       Trade-offs: ${alt.tradeoffs.slice(0, 80)}`);
    });
    if (step.recommendedAlternative) {
      lines.push(`  → Recommended: ${step.recommendedAlternative}`);
    }
  }
  const logLines = Array.isArray(step.stepLogs) ? step.stepLogs.slice(-10) : [];
  return { lines, hasError, logLines };
}
