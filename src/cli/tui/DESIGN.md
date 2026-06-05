# TUI Design Document

> `src/cli/tui/` — Terminal User Interface for `ai-workflow`
>
> Stack: [Ink](https://github.com/vadimdemedes/ink) (React for terminals) + TypeScript + Node.js

---

## 1. Purpose

The TUI renders a full-terminal dashboard while the workflow engine executes a 30+ step AI pipeline. It replaces the plain-text logger when the process runs in an interactive TTY (`--tui` flag or auto-detected). In non-interactive environments (CI, pipes) the TUI is skipped and the orchestrator falls back to standard text output.

---

## 2. Screen Layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Header  (breadcrumb: ai-workflow > step_id > step_name  |  v1.6.3  05/32) │
├──────────────────────────────┬───────────────────────────────────────────┤
│                              │                                           │
│  StepsPanel  (left, ~35%)    │  LogPanel  (right, top — 60% when stream) │
│  • pending / running /       │  Timestamped log lines with [OK]/[BUSY]/  │
│    done / skipped / error    │  [ERR] badges. Scrollable, searchable.    │
│                              ├───────────────────────────────────────────┤
│                              │  StreamViewer  (right, bottom — 40%)      │
│                              │  Live AI token stream (optional, `v`)     │
├──────────────────────────────┴───────────────────────────────────────────┤
│  ProgressBar  (▪▫ squares, %, elapsed, ETA)                              │
├──────────────────────────────────────────────────────────────────────────┤
│  StatusBar  (key hints left | StatusChronometer + SYS_READY● right)      │
└──────────────────────────────────────────────────────────────────────────┘

 Overlays (full-width, rendered above main layout):
   HelpOverlay        — keyboard reference (h / Esc)
   ErrorDetailPanel   — stack trace on step failure (e / Esc)
   StepDetailOverlay  — step metadata modal (Enter on selected step / Esc)
```

Minimum terminal size: **80 columns × 20 rows**. Below that, the App renders a warning and `startTui()` falls back to `orchestrator.execute()` directly.

Layout arithmetic (in `App.js`):

- `leftWidth  = stepsPanelWidth(cols)` → 35% of cols, clamped [25, 45]
- `rightWidth = cols - leftWidth`
- `contentHeight = max(5, rows - 9)` → subtracts header (3) + progressBar (3) + statusBar (3)
- When StreamViewer is visible: LogPanel gets 60% of contentHeight, StreamViewer gets 40%, each with a floor of 8 lines

---

## 3. Component Tree

```
startTui()              ← entry point (index.js), impure: I/O, Ink render lifecycle
└── <App>               ← root component (App.js), manages all layout + keyboard + overlay state
    ├── <Header>           top breadcrumb bar
    ├── <StepsPanel>       left column — step list
    ├── <LogPanel>         right column top — live log feed
    │   └── <LogSearchBar> inline search input (rendered inside LogPanel)
    ├── <StreamViewer>     right column bottom (optional, from pajussara_tui_comp)
    ├── <ProgressBar>      full-width progress bar
    ├── <StatusBar>        bottom bar with key hints and SYS_READY indicator
    ├── <HelpOverlay>      overlay (conditional)
    ├── <ErrorDetailPanel> overlay (conditional, from pajussara_tui_comp)
    └── <StepDetailOverlay> overlay (conditional)
```

---

## 4. Data Flow

```
MainOrchestrator
    │
    │  EventEmitter events
    │  step:start / step:complete / step:error / step:skipped
    │  ai:stream:chunk / ai:stream:end
    ▼
useOrchestrator()  (hooks/useOrchestrator.js)
    │
    │  React state (useState / useEffect)
    │  steps, logs, progress, currentStepId, isComplete, lastError, streamChunks
    ▼
App.js
    │
    ├─ props ──► Header, ProgressBar, StatusBar
    ├─ props ──► StepsPanel
    ├─ props ──► LogPanel ──► LogSearchBar
    └─ props ──► StreamViewer, HelpOverlay, ErrorDetailPanel, StepDetailOverlay
```

`useOrchestrator` is the sole impure boundary between the orchestrator and the UI. No component other than `App` subscribes to orchestrator events. All state mutations happen inside this hook.

---

## 5. Architecture Pattern (v2.0.0)

The TUI follows an explicit **impure/pure split**:

| Layer                    | Files                                                                                                      | Rule                                                                                                 |
| ------------------------ | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Impure entry point       | `index.js`                                                                                                 | I/O only — Ink render, process lifecycle, console suppression                                        |
| Impure root component    | `App.js`                                                                                                   | Keyboard, terminal dimensions, overlay state, layout arithmetic                                      |
| Impure hook              | `hooks/useOrchestrator.js`                                                                                 | Event subscription, React state mutation                                                             |
| Impure leaf components   | `StepsPanel.js`, `LogPanel.js`                                                                             | `useInput` for focus-gated scrolling/search                                                          |
| Pure display components  | `Header.ts`, `StatusBar.js`, `ProgressBar.js`, `LogSearchBar.js`, `HelpOverlay.ts`, `StepDetailOverlay.js` | Props-in / render-out; no side effects                                                               |
| Pure helpers             | `helpers/reusable.ts`                                                                                      | Formatting, math, filtering — all exported as pure functions                                         |
| Project-specific helpers | `helpers/project.js`                                                                                       | Keybinding strings, step-detail formatting — pure functions that depend on workflow domain knowledge |

This split keeps business/display logic fully testable without a terminal.

---

## 6. Component Reference

### `index.js` — `startTui(orchestrator, options)`

- Checks terminal size before rendering; falls back to `orchestrator.execute()` if insufficient
- Suppresses `console.log/error/warn` for the duration of the run to prevent corrupting the TUI
- Renders `<App>` via Ink's `render()` with `patchConsole: false` and `exitOnCtrlC: false`
- Awaits `orchestrator.execute()` concurrently, then waits 3 s for the completion banner, then unmounts

### `App.js` — Root component

Owns all cross-component state:

- `focusedPanel` — `'log' | 'steps' | 'stream'`, cycled with Tab
- `selectedStepId` — step highlighted in StepsPanel (for Enter → StepDetailOverlay)
- `showHelp`, `showErrorDetail`, `showStepDetail`, `showStream` — overlay/panel visibility
- `projectVersion` — read from the target project's `package.json` on mount

Keyboard handler (via `useInput`):

| Key     | Action                                                 |
| ------- | ------------------------------------------------------ |
| `q / Q` | Quit — unmount Ink, call `onExit()`                    |
| `a / A` | Abort — call `orchestrator.abort()`                    |
| `Esc`   | Close topmost overlay (help → error → step detail)     |
| `h / H` | Toggle HelpOverlay                                     |
| `e / E` | Toggle ErrorDetailPanel (only when `lastError` is set) |
| `Tab`   | Cycle focus: log → stream (if visible) → steps → log   |
| `v / V` | Toggle StreamViewer; deselect stream focus if hiding   |
| `Enter` | Open/close StepDetailOverlay for `selectedStepId`      |

Auto-behaviors:

- ErrorDetailPanel opens automatically when a new `lastError` arrives
- App exits 3 s after `isComplete` becomes true

### `hooks/useOrchestrator.js` — `useOrchestrator(orchestrator)`

Subscribes to `orchestrator.workflowEngine` events and maintains:

| State           | Type                    | Updated by                                              |
| --------------- | ----------------------- | ------------------------------------------------------- |
| `steps`         | `Object<id, StepEntry>` | `step:start/complete/error/skipped`                     |
| `logs`          | `LogEntry[]` (max 200)  | all step events                                         |
| `progress`      | `number` 0–100          | `step:complete` → `orchestrator.getStatus()`            |
| `currentStepId` | `string\|null`          | `step:start`                                            |
| `isComplete`    | `boolean`               | 500 ms polling of `orchestrator.getStatus()`            |
| `lastError`     | `ErrorEntry\|null`      | `step:error`                                            |
| `streamChunks`  | `StreamState`           | `ai:stream:chunk / ai:stream:end` (history capped at 5) |

### `components/Header.ts`

Cybernetic breadcrumb: `ai-workflow > {step_id} > {step_name}` on the left, `[v{version}  proj:{projectVersion}]  {completed}/{total}` on the right. Uses `cyanBright` border.

### `components/StepsPanel.js`

- Renders all steps from `steps` prop as dot-indicator rows
- Auto-scrolls to keep the running step centered in the viewport
- Accepts focus via `isFocused`; when focused, `j/k/↑/↓` keys scroll the list
- Status → visual mapping:

| Status    | Dot | Color                         |
| --------- | --- | ----------------------------- |
| `running` | `●` | cyanBright + `[ACTIVE]` badge |
| `done`    | `●` | greenBright                   |
| `skipped` | `⊘` | gray dimmed                   |
| `error`   | `✗` | red                           |
| `pending` | `○` | gray dimmed                   |

### `components/LogPanel.js`

- Renders timestamped log lines with `[OK] / [BUSY] / [ERR]` badges derived from message prefix (`→ / ✓ / ✗`)
- Auto-scrolls to the bottom on new log entries
- Blinking `█` cursor at the bottom
- Search mode activated with `/`; `n/N` navigate matches; matched lines highlight in yellowBright; non-matching lines dim
- Scroll: `j/k`, `↑/↓`; jump: `g` (bottom / newest), `G` (top / oldest)

### `components/LogSearchBar.js`

Pure display. Shown at the bottom of LogPanel when `isActive`. Shows `/query█ [n/total]` or `(no matches)`.

### `components/ProgressBar.js`

Full-width bar using `▪▫` squares. Shows `PROCESS: {pct}%  {bar}  ELAPSED: {elapsed}  ETA: {eta}`. Width calculation fills remaining columns after fixed-width labels.

### `components/StatusBar.js`

- Left: key hints as `key: Label` pairs in yellow/gray
- Right: `StatusChronometer` from `pajussara_tui_comp` (when Copilot is active) + animated `SYS_READY●/○`
- Copilot status priority: `error > done > streaming > loading > idle`

### `components/StreamViewer.js`

Re-exported from `pajussara_tui_comp`. Displays live AI token stream with history navigation (`[/]` keys). Shown only when `showStream` is true.

### `components/HelpOverlay.ts`

Modal (double border, cyan). Keyboard reference built from `buildHelpLines()`. Dismissed with `h` or `Esc`.

### `components/ErrorDetailPanel.ts`

Re-exported from `pajussara_tui_comp`. Full-width overlay showing the error message and stack trace of `lastError`. Auto-opened on failure; toggled with `e`; dismissed with `Esc`.

### `components/StepDetailOverlay.js`

Round-border modal for the selected step. Delegates formatting to `helpers/project.js:formatStepDetail()`. Shows name, ID, status, duration, retry count, depends-on, exit code/error, alternatives, and a 10-line log excerpt. Border turns red on error steps.

---

## 7. Helpers

### `helpers/reusable.ts` (TypeScript, pure)

Generic formatting functions shared with `pajussara_tui_comp`-style components:

| Function                              | Purpose                                |
| ------------------------------------- | -------------------------------------- |
| `formatDuration(ms)`                  | `1234 → "1m14s"`                       |
| `formatTimestamp(ts)`                 | `Date → "[HH:MM:SS]"`                  |
| `formatEta(elapsedMs, pct)`           | Projected remaining time or `"Done"`   |
| `formatProgressBar(pct, width)`       | `"█░░░"` block bar                     |
| `formatProgressLine(...)`             | Full bar+stats string                  |
| `truncateLogLine(line, max)`          | Truncate with `…`                      |
| `keepLast(arr, n)`                    | Sliding window — last N items          |
| `terminalIsSufficient(cols, rows)`    | `cols >= 80 && rows >= 20`             |
| `stepsPanelWidth(cols)`               | `floor(cols * 0.35)`, clamped [25, 45] |
| `filterLogLines(logs, query)`         | Returns `{matchCount, matchIndices}`   |
| `highlightSearchMatch(line, query)`   | Returns `SearchMatchSegment[]`         |
| `truncateStackTrace(stack, maxLines)` | Slices error stack                     |
| `formatStepDetail(step)`              | Returns `{lines, hasError, logLines}`  |
| `formatStepIcon(status)`              | Status → Unicode icon                  |
| `statusColor(status)`                 | Status → Ink color name                |

### `helpers/project.js` (JavaScript, pure)

Workflow-domain-specific helpers:

| Function                 | Purpose                                                                                 |
| ------------------------ | --------------------------------------------------------------------------------------- |
| `buildHelpLines()`       | Static keybinding reference strings for HelpOverlay                                     |
| `formatStepDetail(step)` | Step entry → `{lines, hasError, logLines}` (JS mirror of the TS version in reusable.ts) |

### `helpers.js`

Barrel re-export: `helpers/reusable.js` + `{buildHelpLines}` from `helpers/project.js`. Preserves backward-compatible import paths for components that predate the split.

---

## 8. External Dependencies

| Package              | Used for                                                            |
| -------------------- | ------------------------------------------------------------------- |
| `ink`                | React renderer for terminal output                                  |
| `react`              | Component model and hooks                                           |
| `pajussara_tui_comp` | `StreamViewer`, `ErrorDetailPanel`, `StatusChronometer`, `wrapText` |

`pajussara_tui_comp` components are thin re-exports — their local wrapper files (`StreamViewer.js`, `ErrorDetailPanel.ts`) preserve the same API as the previous local implementations.

---

## 9. Testing Strategy

All tests live in `test/cli/tui/` mirroring the source tree.

| Layer                  | Tool                     | Approach                                               |
| ---------------------- | ------------------------ | ------------------------------------------------------ |
| Pure helpers           | Jest                     | Direct function calls, no React                        |
| Components             | `ink-testing-library`    | `render(<Component .../>)` + text assertions           |
| `useOrchestrator` hook | Jest + fake EventEmitter | Simulated engine events drive state                    |
| `App`                  | `ink-testing-library`    | Integration-style: render App with a fake orchestrator |

Components with external dependencies (`StreamViewer`, `ErrorDetailPanel`) are mocked at the module level in their test files so tests run without the `pajussara_tui_comp` package.

---

## 10. Adding a Component

1. Create `src/cli/tui/components/MyComponent.js` (or `.ts` for typed props)
2. Keep it pure if possible — accept all state as props, no `useInput` or subscriptions
3. Add pure formatting functions to `helpers/reusable.ts` if logic is generic, or `helpers/project.js` if workflow-specific
4. Import and mount it in `App.js`; pass required props from `useOrchestrator` output
5. Write a test in `test/cli/tui/components/MyComponent.test.js` using `ink-testing-library`
