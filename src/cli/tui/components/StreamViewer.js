/**
 * @fileoverview StreamViewer — live AI token stream panel
 * @module cli/tui/components/StreamViewer
 *
 * Displays real-time AI token output as it streams from CopilotSdkWrapper.
 * Shows a header (step + persona), scrollable live token body, a token-rate
 * footer, and allows history navigation with [ / ] keys.
 *
 * Only rendered when the TUI is started with --verbose or the user presses `v`.
 *
 * Architecture: v2.0.0 Pattern
 * - Pure display logic only; all state lives in useOrchestrator (streamChunks)
 * - This component is the impure boundary (keyboard input)
 *
 * @version 1.0.0
 * @since 2026-03-10
 */

import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, useInput } from 'ink';

/** Chars wide reserved for the header border characters. */
const BORDER_OVERHEAD = 2;

/**
 * Wraps a long string into lines of at most `maxWidth` characters.
 *
 * @param {string} text
 * @param {number} maxWidth
 * @returns {string[]}
 */
function wrapText(text, maxWidth) {
  if (!text || maxWidth <= 0) return [];
  const lines = [];
  let remaining = text;
  while (remaining.length > 0) {
    lines.push(remaining.slice(0, maxWidth));
    remaining = remaining.slice(maxWidth);
  }
  return lines;
}

/**
 * @param {{
 *   streamChunks: import('../hooks/useOrchestrator.js').StreamState,
 *   width: number,
 *   height?: number,
 *   isFocused?: boolean,
 * }} props
 */
export function StreamViewer({ streamChunks, width, height = 12, isFocused = false }) {
  const innerWidth = Math.max(10, width - BORDER_OVERHEAD);
  const bodyHeight = Math.max(1, height - 3); // header + footer = 2 lines overhead + border

  // ── History navigation ─────────────────────────────────────────────────────
  // historyIndex === -1  → show live stream
  // historyIndex >= 0   → show history entry at that index
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Reset to live view whenever a new live chunk arrives
  const prevLiveText = useRef(streamChunks.liveText);
  useEffect(() => {
    if (streamChunks.liveText !== prevLiveText.current) {
      prevLiveText.current = streamChunks.liveText;
      setHistoryIndex(-1);
    }
  }, [streamChunks.liveText]);

  // ── Keyboard ───────────────────────────────────────────────────────────────
  useInput(
    (input) => {
      const histLen = streamChunks.history.length;
      if (input === '[') {
        // Navigate backward in history (older entries have lower index)
        setHistoryIndex((prev) => Math.max(0, prev === -1 ? histLen - 1 : prev - 1));
      } else if (input === ']') {
        // Navigate forward; -1 means "return to live"
        setHistoryIndex((prev) => {
          const next = prev + 1;
          return next >= histLen ? -1 : next;
        });
      }
    },
    { isActive: isFocused }
  );

  // ── Resolve what to display ────────────────────────────────────────────────
  const isLive = historyIndex === -1 || streamChunks.history.length === 0;
  const displayEntry = isLive
    ? {
        stepId: streamChunks.stepId,
        stepName: streamChunks.stepName,
        persona: streamChunks.persona,
        text: streamChunks.liveText,
        tokenCount: streamChunks.tokenCount,
        tokensPerSec: streamChunks.tokensPerSec,
      }
    : (() => {
        const h = streamChunks.history[historyIndex];
        return h
          ? {
              stepId: h.stepId,
              stepName: h.stepName,
              persona: h.persona,
              text: h.fullText,
              tokenCount: h.tokenCount,
              tokensPerSec: h.tokensPerSec,
            }
          : null;
      })();

  // ── Header label ───────────────────────────────────────────────────────────
  const stepLabel = displayEntry?.stepId ? `${displayEntry.stepId}` : '—';
  const personaLabel = displayEntry?.persona ?? '—';
  const histLen = streamChunks.history.length;
  const historyLabel =
    histLen > 0
      ? isLive
        ? ` [live]`
        : ` [history ${historyIndex + 1}/${histLen}]`
      : '';
  const headerText = `▶ stream · ${stepLabel} · persona: ${personaLabel}${historyLabel}`;

  // ── Body lines ─────────────────────────────────────────────────────────────
  const rawText = displayEntry?.text ?? '';
  const wrapped = wrapText(rawText, innerWidth);
  // Show the last bodyHeight lines (most recent content visible at bottom)
  const visibleLines = wrapped.slice(-bodyHeight);
  // Pad to fill the body area
  while (visibleLines.length < bodyHeight) visibleLines.unshift('');

  // ── Footer: token stats ────────────────────────────────────────────────────
  const tokenCount = displayEntry?.tokenCount ?? 0;
  const tokRate = displayEntry?.tokensPerSec ?? 0;
  const footerText =
    tokenCount > 0
      ? `${tokRate} tok/s · ${tokenCount.toLocaleString()} tokens${isFocused ? '  [/] nav history' : ''}`
      : isFocused
        ? 'Waiting for AI response…  [/] nav history'
        : 'Waiting for AI response…';

  // ── Render ─────────────────────────────────────────────────────────────────
  return React.createElement(
    Box,
    {
      flexDirection: 'column',
      width,
      borderStyle: 'single',
      borderColor: isFocused ? 'cyan' : 'gray',
    },
    // Header
    React.createElement(
      Box,
      { paddingX: 1 },
      React.createElement(
        Text,
        { bold: true, color: isLive ? 'cyan' : 'yellow', wrap: 'truncate' },
        headerText
      )
    ),
    // Body lines
    ...visibleLines.map((line, i) =>
      React.createElement(
        Box,
        { key: i, paddingX: 1 },
        React.createElement(Text, { wrap: 'truncate', dimColor: !line }, line || ' ')
      )
    ),
    // Footer
    React.createElement(
      Box,
      { paddingX: 1 },
      React.createElement(Text, { color: 'gray', wrap: 'truncate' }, footerText)
    )
  );
}

export default StreamViewer;
