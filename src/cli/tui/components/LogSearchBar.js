/**
 * @fileoverview LogSearchBar — inline search input for the LogPanel
 * @module cli/tui/components/LogSearchBar
 *
 * Rendered at the bottom of LogPanel when search is active.
 * Shows the current query, match count, and cursor position.
 *
 * Architecture: v2.0.0 Pattern (pure display — state is managed by LogPanel)
 *
 * @version 1.0.0
 * @since 2026-03-07
 */

import React from 'react';
import { Box, Text } from 'ink';

/**
 * @param {{
 *   query: string,
 *   matchCount: number,
 *   matchIndex: number,
 *   isActive: boolean,
 * }} props
 */
export function LogSearchBar({ query, matchCount, matchIndex, isActive }) {
  if (!isActive) return null;

  const matchLabel =
    matchCount > 0 ? ` [${matchIndex + 1}/${matchCount}]` : query.length > 0 ? ' (no matches)' : '';

  const matchLabelColor = matchCount > 0 ? 'green' : query.length > 0 ? 'red' : 'gray';

  return React.createElement(
    Box,
    { borderStyle: 'single', borderColor: 'yellow', paddingX: 1, flexDirection: 'row' },
    React.createElement(Text, { color: 'yellow', bold: true }, '/'),
    React.createElement(Text, { color: 'white' }, query),
    React.createElement(Text, { color: 'yellow' }, '█'),
    matchLabel ? React.createElement(Text, { color: matchLabelColor }, matchLabel) : null
  );
}

export default LogSearchBar;
