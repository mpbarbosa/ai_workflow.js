/**
 * @fileoverview StatusBar component — bottom keybinding hints with SDK status indicator
 * @module cli/tui/components/StatusBar
 *
 * Renders the bottom hints bar.  When the Copilot SDK is active (copilotStatus is
 * not 'idle') a {@link StatusChronometer} from pajussara_tui_comp is displayed on
 * the right-hand side of the bar, keeping the elapsed-time / execution-state badge
 * in sync with StepsPanel (both receive the same copilotStatus value from App.js).
 *
 * ### `copilotStatus` values
 * | Value        | Badge shown                         |
 * |--------------|-------------------------------------|
 * | `'idle'`     | *(nothing)*                         |
 * | `'loading'`  | Animated braille spinner + Loading… |
 * | `'streaming'`| Animated braille spinner + Streaming… |
 * | `'done'`     | ✓ Done                              |
 * | `'error'`    | ✗ \<copilotErrorMessage\>           |
 *
 * @version 2.0.0
 * @since 2026-03-07
 */

import React from 'react';
import { Box, Text } from 'ink';
import { StatusChronometer } from 'pajussara_tui_comp';

const KEY_HINTS = [
  { key: 'q', label: 'Quit' },
  { key: 'a', label: 'Abort' },
  { key: 'Tab', label: 'Focus' },
  { key: '↑/↓ j/k', label: 'Scroll' },
  { key: '/', label: 'Search' },
  { key: 'h', label: 'Help' },
  { key: 'e', label: 'Error' },
];

/**
 * @param {{
 *   isComplete?: boolean,
 *   copilotStatus?: 'idle'|'loading'|'streaming'|'done'|'error',
 *   copilotErrorMessage?: string|null,
 *   width?: number,
 * }} props
 */
export function StatusBar({
  isComplete = false,
  copilotStatus = 'idle',
  copilotErrorMessage = null,
  width = 80,
}) {
  const hints = isComplete ? [{ key: 'q', label: 'Exit' }] : KEY_HINTS;

  const showBadge =
    copilotStatus !== 'idle' &&
    (copilotStatus === 'done' ||
      copilotStatus === 'error' ||
      copilotStatus === 'loading' ||
      copilotStatus === 'streaming');
  const forceRunning = copilotStatus === 'loading' || copilotStatus === 'streaming';

  // Budget: use roughly 1/3 of the bar width for the chronometer (min 20).
  const chronometerWidth = Math.max(20, Math.floor(width / 3));

  return React.createElement(
    Box,
    {
      borderStyle: 'single',
      borderColor: 'gray',
      paddingX: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    React.createElement(
      Box,
      { flexDirection: 'row' },
      ...hints.map(({ key, label }, i) =>
        React.createElement(
          React.Fragment,
          { key },
          i > 0 ? React.createElement(Text, { color: 'gray' }, '   ') : null,
          React.createElement(
            Text,
            null,
            React.createElement(Text, { color: 'cyan', bold: true }, `[${key}]`),
            React.createElement(Text, { color: 'white' }, ` ${label}`)
          )
        )
      )
    ),
    showBadge
      ? React.createElement(StatusChronometer, {
          status: copilotStatus,
          errorMessage: copilotErrorMessage ?? undefined,
          width: chronometerWidth,
          isFocused: false,
          forceRunning,
          showLabel: false,
          showBorder: false,
          showHints: false,
        })
      : null
  );
}

export default StatusBar;
