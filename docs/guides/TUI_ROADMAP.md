# ai_workflow.js TUI Roadmap

## Current Baseline (Implemented)

| Component | File | Status |
|---|---|---|
| Root App + keyboard (q/a) | `src/cli/tui/App.js` | ✅ |
| Header bar (project + step counter) | `src/cli/tui/Header.js` | ✅ |
| Steps panel (35% width, icons, durations) | `src/cli/tui/StepsPanel.js` | ✅ |
| Log panel (200 lines, live scroll) | `src/cli/tui/LogPanel.js` | ✅ |
| ASCII progress bar + ETA | `src/cli/tui/ProgressBar.js` | ✅ |
| Status bar (completion + 3 s exit) | `src/cli/tui/StatusBar.js` | ✅ |
| Orchestrator hook (events → state) | `src/cli/tui/useOrchestrator.js` | ✅ |
| Pure helpers | `src/cli/tui/helpers.js` | ✅ |
| CLI `--tui` flag on `run` + `resume` | `src/cli/index.js` | ✅ |
| Terminal size guard (≥ 80×20) | `src/cli/tui/index.js` | ✅ |

---

## Phase T1 — Navigation & Interactivity

> Goal: Users can move around the TUI with the keyboard and inspect step details.

### T1.1 Keyboard Navigation
- `j/k` or `↑/↓` to scroll the **log panel** (focus stays on current step by default)
- `Tab` to cycle focus between panels (Steps ↔ Log)
- `g/G` jump to top/bottom of log
- `h` toggle help overlay listing all keybindings

### T1.2 Step Detail Overlay
- Press `Enter` on a selected step to open a modal showing:
  - Step metadata (name, id, depends-on list)
  - Step-specific log excerpt
  - Duration + retry count
  - Exit code / error message if failed
- `Escape` to close

### T1.3 Error Detail Panel
- On step failure, auto-open the error overlay (replaces current generic red icon)
- Show stack trace excerpt, truncated to 20 lines
- Shortcut `e` to re-open last error at any time

### T1.4 Log Search / Filter
- `/` key activates an inline search bar at the bottom of the log panel
- Matching lines highlighted; non-matching dimmed
- `n / N` for next/previous match, `Escape` to clear filter

### T1.5 Mouse Support
- Click on a step in StepsPanel to select it and open detail overlay
- Scroll wheel in log/steps panels

---

## Phase T2 — Workflow Control

> Goal: Users can influence the running workflow from inside the TUI.

### T2.1 Pause / Resume
- `p` pauses the workflow (sends pause signal to MainOrchestrator)
- Visual indicator: header badge `[PAUSED]` in yellow
- `p` again or `r` resumes

### T2.2 Skip Current Step
- `s` prompts "Skip current step? (y/N)" inline
- Integrates with orchestrator `skipStep(id)` API
- Skipped steps shown with `⊘` + "skipped by user" annotation

### T2.3 Retry Failed Step
- When a step is in error state, `R` retries it in-place
- Retry count shown in step detail

### T2.4 Abort with Cleanup Choice
- `a` (existing) shows a confirmation overlay:
  - `[Abort & clean up]` — rollback artifacts
  - `[Abort & keep artifacts]` — fast exit
  - `[Cancel]` — back to workflow

### T2.5 Approval Gates
- Steps that declare `requiresApproval: true` pause workflow and show a banner:
  `"⚠ Step 07 requires approval — [Y]es / [N]o / [D]iff"`
- `D` opens a diff viewer in-TUI before confirming

### T2.6 Step Selection Mode
- Activated via `ai-workflow run --tui --select` (or `S` hotkey before the workflow starts)
- The left panel switches from the live steps view to a **checkbox list** of all known
  steps, pre-populated from the step registry
- Each row shows: `[ ] step_id  Step Name  (depends on: …)`
- Keyboard controls:
  - `↑ / ↓` or `j / k` — move cursor
  - `Space` — toggle checkbox on/off
  - `a` — select all / deselect all
  - `i` — invert selection
  - `D` — show dependency tooltip for the focused step
  - `Enter` — confirm selection and start the workflow
  - `Esc` / `q` — cancel and exit
- **Dependency enforcement**: when a step is checked, all steps it depends on are
  automatically checked and shown with a locked icon `🔒`; deselecting a step also
  deselects any steps that depend on it, with a prompt `"Remove N dependent steps?"`
- **Visual feedback**: selected steps shown with `[✓]`, locked-by-dependency with `[🔒]`,
  unselected with `[ ]`; a footer counter shows `Selected: 12 / 20 steps`
- The confirmed selection is passed to `MainOrchestrator` as an `allowList` that the
  `StepExecutor` checks before executing each step — unselected steps are auto-skipped
  with reason `"excluded by user selection"`
- Integrates with `src/orchestrator/dependency_resolver.js` to compute the transitive
  dependency closure for locked steps

---

## Phase T3 — Rich Visualizations

> Goal: Turn the TUI into an information-rich dashboard.

### T3.1 Metrics Panel
- Toggle with `m` — replaces log panel with a metrics view:
  - Wall-clock time per completed step (bar chart drawn in ASCII)
  - Total elapsed / estimated remaining
  - Steps: done / skipped / pending / failed counts
- Pull data from `src/lib/metrics.js`

### T3.2 Dependency Graph View
- Toggle with `d` — renders a box-drawing ASCII DAG of step dependencies
- Current step highlighted; completed steps dimmed
- Scrollable if graph exceeds terminal height

### T3.3 Timeline / Gantt Strip
- Narrow horizontal bar at bottom (above status bar) showing step start/end marks on a time axis
- Each step = colored segment; overlapping = parallel execution visible

### T3.4 Change Summary Panel
- Toggle with `c` — shows what files changed before workflow started
- Groups by category: docs / tests / code / config (from `src/lib/change_detection.js`)
- Useful context while workflow runs

### T3.5 Verbose Stream Viewer
- Active only when the CLI is started with `--verbose` flag
- Adds a **Stream panel** below the log panel (or as a right-hand split pane) that
  renders the AI model's token stream in real-time as each step's prompt is answered
- Per-token streaming: characters appear progressively as the model generates them,
  matching the visual feel of a chat interface
- Panel header shows the active AI persona and step ID, e.g.
  `▶ stream · step_03 · persona: test-engineer`
- Completed responses are kept in a scrollable history buffer (last 5 responses)
  navigable with `[` / `]` or `←` / `→`
- When `--verbose` is not set the panel is entirely absent — no layout overhead
- Integrates with `src/lib/ai_helpers.js` streaming callbacks; the orchestrator
  emits `aiStreamChunk` and `aiStreamEnd` events that `useOrchestrator` forwards
  to a new `streamChunks` state slice
- Token throughput and total token count shown in the panel footer:
  `42 tok/s · 1 234 tokens`
- `v` key toggles the panel on/off at runtime (even without `--verbose`, if the
  CLI supports streaming; panel content appears only once the first chunk arrives)

---

## Phase T4 — TUI-First Workflows

> Goal: Entire user journeys completable without leaving the TUI.

### T4.1 Interactive Init Wizard
- `ai-workflow init --tui` launches a full multi-step form using Ink:
  1. Project name (text input)
  2. Project kind (select list, 8 options)
  3. Stage (quick / medium / full)
  4. Workflow directory (text, default `.ai_workflow/`)
  5. Confirm & generate `.workflow-config.yaml`

### T4.2 In-TUI Config Editor
- `ai-workflow config --tui` opens a YAML key-value editor:
  - Navigate fields with `↑/↓`, edit with `Enter`
  - Validates on save using `src/lib/config.js` pure validators
  - Live validation errors shown inline

### T4.3 Checkpoint Browser
- `ai-workflow resume --tui` (no ID) opens a checkpoint list:
  - Table of checkpoints: ID, date, step reached, stage
  - Select with `Enter` to resume, `d` to delete, `i` to inspect

### T4.4 Backlog / Report Viewer
- `ai-workflow status --tui` renders the latest backlog report in-TUI:
  - Sections: summary, completed steps, issues, metrics
  - Scrollable, searchable (`/`)

### T4.5 Multi-Workflow Monitor
- `ai-workflow monitor` (new command) watches `.ai_workflow/` for multiple concurrent runs
- Each run shown as a collapsible card in the TUI
- Useful for monorepos or parallel project workflows

---

## Phase T5 — Polish & Ecosystem

> Goal: Production-quality TUI that is accessible, extensible, and debuggable.

### T5.1 Color Themes
- Built-in themes: **default** (current), **dark-high-contrast**, **light**, **monochrome**
- Configurable in `.workflow-config.yaml` under `tui.theme`
- Respects `NO_COLOR` env var

### T5.2 Session Recording & Playback
- `--record` flag saves TUI frames to `.ai_workflow/recordings/<timestamp>.cast` (asciinema format)
- `ai-workflow replay <file>` plays back a recording for sharing/debugging

### T5.3 TUI Log Export
- `x` keybinding exports visible log buffer to `.ai_workflow/logs/tui-export-<ts>.txt`
- Confirmation in status bar: `"✓ Log exported to .ai_workflow/logs/..."`

### T5.4 Desktop Notifications
- On step failure or workflow completion, fire a system notification
- Linux: `notify-send`; macOS: `osascript`; configurable on/off

### T5.5 Accessibility
- Screen-reader friendly alternative output mode (`--tui=accessible`)
- Outputs structured text updates to stdout without Ink rendering
- Respects `TERM_PROGRAM=Apple_Terminal` reduced-motion preference

### T5.6 Test Infrastructure for TUI
- Ink testing utilities (`@testing-library/react` + `ink-testing-library`)
- Unit tests for all pure helpers in `helpers.js` (currently untested)
- Snapshot tests for each component in isolation
- Integration test: launch TUI against a mock orchestrator, assert frame output

---

## Dependency Map

```
T1 (Navigation)     — no blockers; builds on existing components
T2 (Control)        — depends on MainOrchestrator exposing pause/skip/retry APIs
T2.6 (Step Select)  — depends on step_registry.js + dependency_resolver.js (both ✅)
T3 (Visualizations) — depends on metrics.js + change_detection.js integration (both ✅)
T3.5 (Stream Viewer)— depends on ai_helpers.js streaming callbacks + useOrchestrator event bus
T4 (TUI Workflows)  — depends on T1 (input handling) + existing config/backlog modules
T5 (Polish)         — depends on T1–T4 being stable
```

## Priority Order (suggested)

| Phase | Value | Effort | Priority |
|---|---|---|---|
| T1 Navigation | High | Low | **First** |
| T2 Workflow Control | High | Medium | **Second** |
| T2.6 Step Selection | High | Medium | **Alongside T2** |
| T5.6 TUI Tests | High | Low | **Alongside T1** |
| T3 Visualizations | Medium | Medium | Third |
| T3.5 Stream Viewer | Medium | Medium | **Alongside T3** |
| T4 TUI Workflows | Medium | High | Fourth |
| T5 Polish | Low | Low–Medium | Ongoing |
