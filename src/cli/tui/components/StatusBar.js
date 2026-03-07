/**
 * @fileoverview StatusBar component — bottom keybinding hints
 * @module cli/tui/components/StatusBar
 *
 * @version 1.0.0
 * @since 2026-03-07
 */

import React from 'react';
import { Box, Text } from 'ink';

const KEY_HINTS = [
  { key: 'q', label: 'Quit' },
  { key: 'a', label: 'Abort workflow' },
  { key: '↑/↓', label: 'Scroll log' },
];

/**
 * @param {{ isComplete?: boolean }} props
 */
export function StatusBar({ isComplete = false }) {
  const hints = isComplete
    ? [{ key: 'q', label: 'Exit' }]
    : KEY_HINTS;

  return React.createElement(
    Box,
    { borderStyle: 'single', borderColor: 'gray', paddingX: 1 },
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
  );
}

export default StatusBar;
