/**
 * @fileoverview LogPanel component — scrollable live log display
 * @module cli/tui/components/LogPanel
 *
 * Shows timestamped log lines produced by orchestrator events.
 * Supports scrolling with ↑/↓ keys via Ink's useInput.
 *
 * @version 1.0.0
 * @since 2026-03-07
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { formatTimestamp, truncateLogLine, keepLast } from '../helpers.js';

/**
 * @param {{
 *   logs: import('../hooks/useOrchestrator.js').LogEntry[],
 *   width: number,
 *   height?: number,
 *   isFocused?: boolean,
 * }} props
 */
export function LogPanel({ logs, width, height = 20, isFocused = true }) {
  const maxVisible = Math.max(1, height - 3); // leave room for border + title
  const [scrollOffset, setScrollOffset] = useState(0);

  // Auto-scroll to bottom when new logs arrive (only if already at bottom)
  useEffect(() => {
    setScrollOffset(0);
  }, [logs.length]);

  useInput(
    (input, key) => {
      if (key.upArrow) {
        setScrollOffset((prev) => Math.min(prev + 1, Math.max(0, logs.length - maxVisible)));
      }
      if (key.downArrow) {
        setScrollOffset((prev) => Math.max(0, prev - 1));
      }
    },
    { isActive: isFocused }
  );

  // Show last N lines, offset by scroll position (0 = bottom)
  const totalLines = logs.length;
  const end = Math.max(0, totalLines - scrollOffset);
  const start = Math.max(0, end - maxVisible);
  const visibleLogs = logs.slice(start, end);

  // Width available for the message text (subtract timestamp + space)
  const msgWidth = Math.max(10, width - 12);

  const scrollIndicator =
    scrollOffset > 0 ? `↑ ${scrollOffset} more line${scrollOffset > 1 ? 's' : ''}` : '';

  return React.createElement(
    Box,
    { flexDirection: 'column', borderStyle: 'single', borderColor: 'gray', flexGrow: 1, paddingX: 1 },
    React.createElement(
      Box,
      { flexDirection: 'row', justifyContent: 'space-between' },
      React.createElement(Text, { bold: true, color: 'white', dimColor: true }, 'LIVE LOG'),
      scrollIndicator
        ? React.createElement(Text, { color: 'gray', dimColor: true }, scrollIndicator)
        : null
    ),
    visibleLogs.length === 0
      ? React.createElement(Text, { color: 'gray', dimColor: true }, 'Waiting for output…')
      : null,
    ...visibleLogs.map((entry, i) => {
      const ts = formatTimestamp(entry.time);
      const msg = truncateLogLine(entry.message, msgWidth);

      let msgColor = 'white';
      if (entry.message.startsWith('✓')) msgColor = 'green';
      else if (entry.message.startsWith('✗')) msgColor = 'red';
      else if (entry.message.startsWith('⊘')) msgColor = 'gray';
      else if (entry.message.startsWith('→')) msgColor = 'cyan';

      return React.createElement(
        Box,
        { key: i, flexDirection: 'row', gap: 1 },
        React.createElement(Text, { color: 'gray', dimColor: true }, ts),
        React.createElement(Text, { color: msgColor }, msg)
      );
    })
  );
}

export default LogPanel;
