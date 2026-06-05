/**
 * @fileoverview LogPanel component — cybernetic-themed live log display
 * @module cli/tui/components/LogPanel
 *
 * Shows timestamped log lines with [OK]/[BUSY]/[ERR] status badges.
 * Supports scrolling with ↑/↓/j/k, g/G jump, and / search.
 *
 * @version 2.0.0
 * @since 2026-03-07
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { formatTimestamp, truncateLogLine, filterLogLines } from '../helpers/reusable.js';
import { LogSearchBar } from './LogSearchBar.js';

/** Derive [OK]/[BUSY]/[ERR] badge from log message prefix. */
function getLogBadge(message) {
  if (message?.startsWith('→')) return { label: '[ BUSY ]', color: 'cyanBright' };
  if (message?.startsWith('✓')) return { label: '[ OK ]  ', color: 'greenBright' };
  if (message?.startsWith('✗')) return { label: '[ ERR ] ', color: 'red' };
  if (message?.startsWith('⊘')) return { label: '[ OK ]  ', color: 'gray' };
  return { label: '[ OK ]  ', color: 'gray' };
}

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
  const [cursorVisible, setCursorVisible] = useState(true);

  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchIndex, setSearchIndex] = useState(0);

  // Blinking cursor
  useEffect(() => {
    const t = setInterval(() => setCursorVisible((prev) => !prev), 500);
    return () => clearInterval(t);
  }, []);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    setScrollOffset(0);
  }, [logs.length]);

  const { matchCount, matchIndices } = filterLogLines(logs, searchQuery);

  useEffect(() => {
    if (matchCount === 0) {
      setSearchIndex(0);
    } else if (searchIndex >= matchCount) {
      setSearchIndex(matchCount - 1);
    }
  }, [matchCount, searchIndex]);

  useInput(
    (input, key) => {
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
          // fall through to navigate matches below
        } else if (!key.ctrl && !key.meta && input && input.length === 1) {
          setSearchQuery((prev) => prev + input);
          setSearchIndex(0);
          return;
        }
      }

      if (input === 'n' && matchCount > 0) {
        const next = (searchIndex + 1) % matchCount;
        setSearchIndex(next);
        const targetLog = matchIndices[next];
        if (targetLog != null) setScrollOffset(Math.max(0, logs.length - targetLog - 1));
        return;
      }
      if (input === 'N' && matchCount > 0) {
        const prev = (searchIndex - 1 + matchCount) % matchCount;
        setSearchIndex(prev);
        const targetLog = matchIndices[prev];
        if (targetLog != null) setScrollOffset(Math.max(0, logs.length - targetLog - 1));
        return;
      }

      if (input === '/') {
        setSearchActive(true);
        setSearchQuery('');
        setSearchIndex(0);
        return;
      }
      if (key.escape) {
        setSearchActive(false);
        setSearchQuery('');
        setSearchIndex(0);
        return;
      }

      const maxOffset = Math.max(0, logs.length - maxVisible);
      if (key.upArrow || input === 'k' || key.scrollUp) {
        setScrollOffset((prev) => Math.min(prev + 1, maxOffset));
      }
      if (key.downArrow || input === 'j' || key.scrollDown) {
        setScrollOffset((prev) => Math.max(0, prev - 1));
      }
      if (input === 'g' && !key.ctrl) setScrollOffset(0);
      if (input === 'G') setScrollOffset(maxOffset);
    },
    { isActive: isFocused, mouse: true }
  );

  const totalLines = logs.length;
  const end = Math.max(0, totalLines - scrollOffset);
  const start = Math.max(0, end - maxVisible);
  const visibleLogs = logs.slice(start, end);
  const visibleStartIdx = start;

  // Badge is 8 chars wide ("[ OK ]  " or "[ BUSY ]" or "[ ERR ] "), timestamp is 10 chars + space
  const BADGE_WIDTH = 8;
  const TS_WIDTH = 10;
  const msgWidth = Math.max(10, width - TS_WIDTH - BADGE_WIDTH - 4);

  const scrollIndicator = scrollOffset > 0 ? `↑ ${scrollOffset} more` : '';

  return React.createElement(
    Box,
    {
      flexDirection: 'column',
      borderStyle: 'single',
      borderColor: isFocused ? 'cyanBright' : 'gray',
      flexGrow: 1,
      paddingX: 1,
    },
    // ── Header row ──────────────────────────────────────────────────────────
    React.createElement(
      Box,
      { flexDirection: 'row', justifyContent: 'space-between' },
      React.createElement(Text, { bold: true, color: 'cyanBright' }, '[ LIVE_LOGS ]'),
      React.createElement(
        Box,
        { flexDirection: 'row', gap: 1 },
        scrollIndicator
          ? React.createElement(Text, { color: 'gray', dimColor: true }, scrollIndicator)
          : null,
        React.createElement(Text, { color: 'greenBright', bold: true }, '●'),
        React.createElement(Text, { color: 'greenBright', bold: true }, 'RECV_OK'),
        React.createElement(Text, { color: 'gray', dimColor: true }, 'CONNECTED')
      )
    ),
    // ── Log lines ───────────────────────────────────────────────────────────
    visibleLogs.length === 0
      ? React.createElement(Text, { color: 'gray', dimColor: true }, 'Waiting for output…')
      : null,
    ...visibleLogs.map((entry, i) => {
      const logIdx = visibleStartIdx + i;
      const ts = formatTimestamp(entry.time);
      const msg = truncateLogLine(entry.message, msgWidth);
      const isMatch = searchQuery && matchIndices.includes(logIdx);
      const dimmed = searchQuery && !isMatch;
      const badge = getLogBadge(entry.message);
      const badgeColor = isMatch ? 'yellowBright' : badge.color;

      return React.createElement(
        Box,
        { key: i, flexDirection: 'row', gap: 1 },
        React.createElement(Text, { color: 'gray', dimColor: true }, ts),
        React.createElement(
          Text,
          { color: badgeColor, dimColor: !!dimmed, bold: !dimmed },
          badge.label
        ),
        React.createElement(
          Text,
          { color: isMatch ? 'yellowBright' : 'white', dimColor: !!dimmed },
          msg
        )
      );
    }),
    // ── Blinking cursor ─────────────────────────────────────────────────────
    React.createElement(
      Box,
      { flexDirection: 'row', gap: 1 },
      React.createElement(Text, { color: 'gray', dimColor: true }, '_'),
      React.createElement(Text, { color: 'cyanBright' }, cursorVisible ? '█' : ' ')
    ),
    // ── Search bar ──────────────────────────────────────────────────────────
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
