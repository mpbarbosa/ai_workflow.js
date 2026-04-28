/**
 * @fileoverview HelpOverlay — keyboard shortcut reference modal
 * @module cli/tui/components/HelpOverlay
 *
 * Renders a centered overlay listing all TUI keybindings.
 * Press h or Escape to dismiss.
 *
 * Architecture: v2.0.0 Pattern (impure UI boundary, pure content via helpers.js)
 *
 * @version 1.0.0
 * @since 2026-03-07
 */

import React, { type ReactElement } from 'react';
import { Box, Text, useInput, type Key } from 'ink';
import { buildHelpLines } from '../helpers.js';

export interface HelpOverlayProps {
  onClose?: () => void;
}

export function HelpOverlay({ onClose }: HelpOverlayProps): ReactElement {
  const lines: string[] = buildHelpLines();

  useInput((input: string, key: Key): void => {
    if (input === 'h' || input === 'H' || key.escape) {
      onClose?.();
    }
  });

  return React.createElement(
    Box,
    { flexDirection: 'column', borderStyle: 'double', borderColor: 'cyan', padding: 1, marginX: 4 },
    React.createElement(Text, { bold: true, color: 'cyan' }, '⌨  Keyboard Shortcuts'),
    React.createElement(Text, null, ''),
    ...lines.map((line: string, index: number) =>
      React.createElement(
        Text,
        {
          key: index,
          color:
            line === ''
              ? 'gray'
              : line.startsWith('  ')
                ? 'white'
                : line.startsWith('When') || line.startsWith('Mouse')
                  ? 'yellow'
                  : 'white',
        },
        line === '' ? ' ' : line
      )
    ),
    React.createElement(Text, null, ''),
    React.createElement(Text, { color: 'gray', dimColor: true }, 'Press [h] or [Esc] to close')
  );
}

export default HelpOverlay;
