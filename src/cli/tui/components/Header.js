/**
 * @fileoverview Header component — top bar of the TUI dashboard
 * @module cli/tui/components/Header
 *
 * Displays project name, version, active stage, and step counter.
 *
 * @version 1.0.0
 * @since 2026-03-07
 */

import React from 'react';
import { Box, Text } from 'ink';

/**
 * @param {{ stage: string, completed: number, total: number, version?: string, projectRoot?: string, projectVersion?: string | null }} props
 */
export function Header({
  stage,
  completed,
  total,
  version = '1.6.3',
  projectRoot = '',
  projectVersion = null,
}) {
  const stepLabel = total > 0 ? `Step ${completed}/${total}` : 'Initializing…';

  return React.createElement(
    Box,
    {
      borderStyle: 'single',
      borderColor: 'blue',
      paddingX: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    React.createElement(
      Text,
      { bold: true, color: 'blueBright' },
      'AI Workflow ',
      React.createElement(Text, { color: 'gray', bold: false }, `v${version}`),
      '  ',
      React.createElement(Text, { color: 'cyan' }, `stage: ${stage}`),
      projectRoot
        ? React.createElement(
            Text,
            { color: 'gray', bold: false },
            `  ${projectRoot}`,
            projectVersion
              ? React.createElement(Text, { color: 'yellow', bold: false }, ` v${projectVersion}`)
              : null
          )
        : null
    ),
    React.createElement(Text, { color: 'gray' }, stepLabel)
  );
}

export default Header;
