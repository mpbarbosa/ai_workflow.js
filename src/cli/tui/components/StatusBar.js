/**
 * @fileoverview StatusBar component — cybernetic bottom bar with key hints and SYS_READY
 * @module cli/tui/components/StatusBar
 *
 * Key hints displayed as `key: Label` (colon-separated, warning color for key).
 * Right side shows StatusChronometer when Copilot SDK is active, plus an
 * animated SYS_READY dot indicator.
 *
 * @version 3.0.0
 * @since 2026-03-07
 */

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { StatusChronometer } from 'pajussara_tui_comp';

const KEY_HINTS = [
  { key: 'q', label: 'Quit' },
  { key: 'a', label: 'Abort' },
  { key: 'Tab', label: 'Focus' },
  { key: 'j/k', label: 'Scroll' },
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
  const [dotVisible, setDotVisible] = useState(true);

  useEffect(() => {
    const t = setInterval(() => setDotVisible((prev) => !prev), 800);
    return () => clearInterval(t);
  }, []);

  const hints = isComplete ? [{ key: 'q', label: 'Exit' }] : KEY_HINTS;

  const showBadge =
    copilotStatus !== 'idle' &&
    (copilotStatus === 'done' ||
      copilotStatus === 'error' ||
      copilotStatus === 'loading' ||
      copilotStatus === 'streaming');
  const forceRunning = copilotStatus === 'loading' || copilotStatus === 'streaming';
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
    // ── Key hints ────────────────────────────────────────────────────────────
    React.createElement(
      Box,
      { flexDirection: 'row' },
      ...hints.map(({ key, label }, i) =>
        React.createElement(
          React.Fragment,
          { key },
          i > 0 ? React.createElement(Text, { color: 'gray', dimColor: true }, '  ') : null,
          React.createElement(
            Text,
            null,
            React.createElement(Text, { color: 'yellow', bold: true }, `${key}:`),
            React.createElement(Text, { color: 'gray' }, ` ${label}`)
          )
        )
      )
    ),
    // ── Right: chronometer + SYS_READY ──────────────────────────────────────
    React.createElement(
      Box,
      { flexDirection: 'row', gap: 1 },
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
        : null,
      React.createElement(Text, { color: 'gray', dimColor: true }, '|'),
      React.createElement(Text, { color: 'cyanBright', bold: true }, 'SYS_READY'),
      React.createElement(Text, { color: 'cyanBright' }, dotVisible ? '●' : '○')
    )
  );
}

export default StatusBar;
