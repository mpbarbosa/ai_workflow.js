/**
 * @fileoverview LogPanel component — scrollable live log display with search
 * @module cli/tui/components/LogPanel
 *
 * Shows timestamped log lines produced by orchestrator events.
 * Supports scrolling with ↑/↓/j/k keys, g/G jump, and / search.
 *
 * Architecture: v2.0.0 Pattern
 * - Pure helper functions delegated to reusable TUI helpers
 * - This component is the impure boundary (keyboard, state)
 *
 * @version 1.1.0
 * @since 2026-03-07
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { formatTimestamp, truncateLogLine, filterLogLines } from '../helpers/reusable.js';
import { LogSearchBar } from './LogSearchBar.js';

/**
 * @param {{
 *   logs: import('../hooks/useOrchestrator.js').LogEntry[],
 *   width: number,
 *   height?: number,
 *   isFocused?: boolean,
 * }} props
 */
export function LogPanel({ logs, width, height = 20, isFocused = true }) {
  const maxVisible = Math.max(1, height - 3);
  const [scrollOffset, setScrollOffset] = useState(0);

  // Search state (managed internally)
  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchIndex, setSearchIndex] = useState(0);

  // Auto-scroll to bottom when new logs arrive (only if already at bottom)
  useEffect(() => {
    setScrollOffset(0);
  }, [logs.length]);

  // Compute search matches
  const { matchCount, matchIndices } = filterLogLines(logs, searchQuery);

  // Clamp searchIndex when matchCount changes
  useEffect(() => {
    if (matchCount === 0) {
      setSearchIndex(0);
    } else if (searchIndex >= matchCount) {
      setSearchIndex(matchCount - 1);
    }
  }, [matchCount, searchIndex]);

  useInput(
    (input, key) => {
      // ── Search mode input ────────────────────────────────────────────────
      if (searchActive) {
        if (key.escape) {
          setSearchActive(false);
          setSearchQuery('');
          setSearchIndex(0);
          return;
        }
        if (key.backspace || key.delete) {
          setSearchQuery((prev) => prev.slice(0, -1));
          return;
        }
        if (input === 'n' || input === 'N') {
          // navigate matches
        } else if (!key.ctrl && !key.meta && input && input.length === 1) {
          setSearchQuery((prev) => prev + input);
          setSearchIndex(0);
          return;
        }
      }

      // ── n / N — navigate search matches ─────────────────────────────────
      if (input === 'n' && matchCount > 0) {
        const next = (searchIndex + 1) % matchCount;
        setSearchIndex(next);
        // Scroll so the match is visible
        const targetLog = matchIndices[next];
        if (targetLog != null) {
          const desiredOffset = Math.max(0, logs.length - targetLog - 1);
          setScrollOffset(desiredOffset);
        }
        return;
      }
      if (input === 'N' && matchCount > 0) {
        const prev = (searchIndex - 1 + matchCount) % matchCount;
        setSearchIndex(prev);
        const targetLog = matchIndices[prev];
        if (targetLog != null) {
          const desiredOffset = Math.max(0, logs.length - targetLog - 1);
          setScrollOffset(desiredOffset);
        }
        return;
      }

      // ── / — activate search ──────────────────────────────────────────────
      if (input === '/') {
        setSearchActive(true);
        setSearchQuery('');
        setSearchIndex(0);
        return;
      }

      // ── Escape — clear search ────────────────────────────────────────────
      if (key.escape) {
        setSearchActive(false);
        setSearchQuery('');
        setSearchIndex(0);
        return;
      }

      // ── Scrolling ────────────────────────────────────────────────────────
      const maxOffset = Math.max(0, logs.length - maxVisible);

      if (key.upArrow || input === 'k' || key.scrollUp) {
        setScrollOffset((prev) => Math.min(prev + 1, maxOffset));
      }
      if (key.downArrow || input === 'j' || key.scrollDown) {
        setScrollOffset((prev) => Math.max(0, prev - 1));
      }

      // g = jump to bottom (most recent)
      if (input === 'g' && !key.ctrl) {
        setScrollOffset(0);
      }
      // G = jump to top (oldest)
      if (input === 'G') {
        setScrollOffset(maxOffset);
      }
    },
    { isActive: isFocused, mouse: true }
  );

  // Show last N lines, offset by scroll position (0 = bottom)
  const totalLines = logs.length;
  const end = Math.max(0, totalLines - scrollOffset);
  const start = Math.max(0, end - maxVisible);
  const visibleLogs = logs.slice(start, end);
  const visibleStartIdx = start; // index in full logs array

  // Width available for the message text
  const msgWidth = Math.max(10, width - 12);

  const scrollIndicator =
    scrollOffset > 0 ? `↑ ${scrollOffset} more line${scrollOffset > 1 ? 's' : ''}` : '';

  return React.createElement(
    Box,
    {
      flexDirection: 'column',
      borderStyle: 'single',
      borderColor: isFocused ? 'white' : 'gray',
      flexGrow: 1,
      paddingX: 1,
    },
    // Header row
    React.createElement(
      Box,
      { flexDirection: 'row', justifyContent: 'space-between' },
      React.createElement(Text, { bold: true, color: 'white', dimColor: !isFocused }, 'LIVE LOG'),
      scrollIndicator
        ? React.createElement(Text, { color: 'gray', dimColor: true }, scrollIndicator)
        : null
    ),
    // Log lines
    visibleLogs.length === 0
      ? React.createElement(Text, { color: 'gray', dimColor: true }, 'Waiting for output…')
      : null,
    ...visibleLogs.map((entry, i) => {
      const logIdx = visibleStartIdx + i;
      const ts = formatTimestamp(entry.time);
      const msg = truncateLogLine(entry.message, msgWidth);
      const isMatch = searchQuery && matchIndices.includes(logIdx);
      const dimmed = searchQuery && !isMatch;

      let msgColor = 'white';
      if (entry.message?.startsWith('✓')) msgColor = 'green';
      else if (entry.message?.startsWith('✗')) msgColor = 'red';
      else if (entry.message?.startsWith('⊘')) msgColor = 'gray';
      else if (entry.message?.startsWith('→')) msgColor = 'cyan';

      if (isMatch) msgColor = 'yellowBright';

      return React.createElement(
        Box,
        { key: i, flexDirection: 'row', gap: 1 },
        React.createElement(Text, { color: 'gray', dimColor: true }, ts),
        React.createElement(Text, { color: msgColor, dimColor: !!dimmed }, msg)
      );
    }),
    // Search bar (rendered at bottom when active)
    React.createElement(LogSearchBar, {
      key: 'search',
      query: searchQuery,
      matchCount,
      matchIndex: searchIndex,
      isActive: searchActive,
    })
  );
}

export default LogPanel;
