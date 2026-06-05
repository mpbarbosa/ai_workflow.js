/**
 * @fileoverview Header component — top bar of the TUI dashboard
 * @module cli/tui/components/Header
 *
 * Cybernetic breadcrumb header: ai-workflow > step_id > step_name
 *
 * @version 2.0.0
 * @since 2026-03-07
 */

import React, { type ReactElement } from 'react';
import { Box, Text } from 'ink';

export interface HeaderProps {
  stage: string;
  completed: number;
  total: number;
  version?: string;
  projectRoot?: string;
  projectVersion?: string | null;
  currentStepId?: string | null;
  currentStepName?: string | null;
}

export function Header({
  stage,
  completed,
  total,
  version = '1.6.3',
  projectVersion = null,
  currentStepId = null,
  currentStepName = null,
}: HeaderProps): ReactElement {
  const completedPad = String(completed).padStart(2, '0');
  const totalPad = total > 0 ? String(total).padStart(2, '0') : '--';
  const stepCounter = `${completedPad}/${totalPad}`;

  const breadcrumbStep = currentStepId ?? stage;
  const breadcrumbLabel = currentStepName ?? (currentStepId ? stage : 'initializing');

  return React.createElement(
    Box,
    {
      borderStyle: 'single',
      borderColor: 'cyanBright',
      paddingX: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    React.createElement(
      Box,
      { flexDirection: 'row', gap: 1 },
      React.createElement(Text, { color: 'gray', dimColor: true }, 'ai-workflow'),
      React.createElement(Text, { color: 'gray', dimColor: true }, '>'),
      React.createElement(Text, { color: 'gray' }, breadcrumbStep),
      React.createElement(Text, { color: 'gray', dimColor: true }, '>'),
      React.createElement(Text, { color: 'cyanBright', bold: true }, breadcrumbLabel)
    ),
    React.createElement(
      Box,
      { flexDirection: 'row', gap: 2 },
      React.createElement(
        Text,
        { color: 'cyanBright' },
        `[v${version}${projectVersion ? `  proj:${projectVersion}` : ''}]`
      ),
      React.createElement(Text, { color: 'gray' }, stepCounter)
    )
  );
}

export default Header;
