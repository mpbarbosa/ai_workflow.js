/**
 * @fileoverview StepDetailOverlay — step metadata modal
 * @module cli/tui/components/StepDetailOverlay
 *
 * Shows detailed information about a selected step: name, ID, depends-on,
 * status, duration, retry count, exit code/error, and step-specific logs.
 * Press Escape to dismiss.
 *
 * Architecture: v2.0.0 Pattern (impure UI boundary, pure formatting via project helpers)
 *
 * @version 1.0.0
 * @since 2026-03-07
 */

import React from 'react';
import { Box, Text, useInput } from 'ink';
import { formatStepDetail } from '../helpers/project.js';

/**
 * @param {{
 *   step: import('../hooks/useOrchestrator.js').StepEntry | null,
 *   onClose: () => void,
 * }} props
 */
export function StepDetailOverlay({ step, onClose }) {
  useInput((_input, key) => {
    if (key.escape) {
      onClose?.();
    }
  });

  if (!step) {
    return React.createElement(
      Box,
      {
        flexDirection: 'column',
        borderStyle: 'round',
        borderColor: 'yellow',
        padding: 1,
        marginX: 4,
      },
      React.createElement(Text, { color: 'gray' }, 'No step selected.'),
      React.createElement(Text, { color: 'gray', dimColor: true }, 'Press [Esc] to close')
    );
  }

  const { lines, hasError, logLines } = formatStepDetail(step);
  const borderColor = hasError ? 'red' : 'yellow';
  const titleColor = hasError ? 'red' : 'yellow';

  return React.createElement(
    Box,
    { flexDirection: 'column', borderStyle: 'round', borderColor, padding: 1, marginX: 4 },
    React.createElement(Text, { bold: true, color: titleColor }, `📋 Step Detail`),
    React.createElement(Text, null, ''),
    ...lines.map((line, i) =>
      React.createElement(
        Text,
        {
          key: `l${i}`,
          color: line.startsWith('Error:') || line.startsWith('Exit code:') ? 'red' : 'white',
        },
        line
      )
    ),
    logLines.length > 0
      ? React.createElement(
          React.Fragment,
          { key: 'logs' },
          React.createElement(Text, { key: 'sep', color: 'gray' }, ''),
          React.createElement(
            Text,
            { key: 'logtitle', bold: true, color: 'gray', dimColor: true },
            `── Log excerpt (last ${logLines.length} lines) ──`
          ),
          ...logLines.map((l, i) => React.createElement(Text, { key: `log${i}`, color: 'gray' }, l))
        )
      : null,
    React.createElement(Text, null, ''),
    React.createElement(Text, { color: 'gray', dimColor: true }, 'Press [Esc] to close')
  );
}

export default StepDetailOverlay;
