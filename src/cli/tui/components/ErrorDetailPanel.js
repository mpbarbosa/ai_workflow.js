/**
 * @fileoverview ErrorDetailPanel — error/stack trace modal overlay
 * @module cli/tui/components/ErrorDetailPanel
 *
 * Shown automatically when a step fails and when the user presses 'e'.
 * Displays the failed step name, error message, and a truncated stack trace.
 * Press e or Escape to dismiss.
 *
 * Architecture: v2.0.0 Pattern (impure UI boundary, pure truncation via helpers.js)
 *
 * @version 1.0.0
 * @since 2026-03-07
 */
import React from 'react';
import { Box, Text, useInput } from 'ink';
import { truncateStackTrace } from '../helpers.js';
export function ErrorDetailPanel({ error, onClose, }) {
    useInput((input, key) => {
        if (key.escape || input === 'e' || input === 'E') {
            onClose();
        }
    });
    if (!error) {
        return React.createElement(Box, {
            flexDirection: 'column',
            borderStyle: 'single',
            borderColor: 'red',
            padding: 1,
            marginX: 4,
        }, React.createElement(Text, { color: 'gray' }, 'No error recorded.'), React.createElement(Text, { color: 'gray', dimColor: true }, 'Press [e] or [Esc] to close'));
    }
    const stackLines = truncateStackTrace(error.stack, 20);
    return React.createElement(Box, { flexDirection: 'column', borderStyle: 'single', borderColor: 'red', padding: 1, marginX: 4 }, React.createElement(Text, { bold: true, color: 'red' }, `✗ Failed: ${error.stepName || '(unknown)'}`), React.createElement(Text, { color: 'white' }, error.message || 'Unknown error'), stackLines.length > 0
        ? React.createElement(React.Fragment, { key: 'stack' }, React.createElement(Text, { key: 'sep', color: 'gray' }, ''), React.createElement(Text, { key: 'title', bold: true, color: 'gray', dimColor: true }, '── Stack trace ──'), ...stackLines.map((line, index) => React.createElement(Text, { key: `s${index}`, color: 'gray', dimColor: true }, line)))
        : null, React.createElement(Text, null, ''), React.createElement(Text, { color: 'gray', dimColor: true }, 'Press [e] or [Esc] to close'));
}
export default ErrorDetailPanel;
