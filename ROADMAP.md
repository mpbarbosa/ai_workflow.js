# ai_workflow.js — Project Roadmap

> **Current version:** 1.6.0 · **Status:** Production Ready ✅
> **Tests:** 4,412 passing · **Coverage:** 86.79% · **Vulnerabilities:** 0

This roadmap tracks the evolution of **ai_workflow.js** from its initial architecture through
upcoming feature work and long-term vision. Phases 1–11 are complete and shipped as v1.0.0.
Active development continues on TUI enhancements, streaming, and the next release milestone.

---

## Agentic AI Vision

> **From text prompts to programmable execution.**

The AI landscape is shifting decisively from prompt-response interfaces toward **agent-driven,
programmable execution**—AI that autonomously plans, executes multi-step tasks, invokes real
tools, adapts to context, and recovers from failure. This is the paradigm described in
[*The era of AI as text is over. Execution is the new interface.*](https://github.blog/ai-and-ml/github-copilot/the-era-of-ai-as-text-is-over-execution-is-the-new-interface/)

**ai_workflow.js** is built to lead this transition. Our vision:

- **Delegate goals, not steps.** Users specify intent; intelligent agents plan and execute
  the workflow, selecting steps, invoking tools, and adapting to outcomes—without brittle
  prompt-chaining or hand-authored scripts.
- **Structured runtime context, not raw prompts.** Agents operate on structured toolsets,
  typed contexts, and well-defined protocols—making automation testable, observable, and safe.
- **Safety and oversight built in.** Guardrails, approval gates, and runtime monitoring ensure
  agents operate within user-defined boundaries, with full visibility into every decision.
- **"AI that does," not "AI that chats."** Each workflow step becomes an opportunity for
  real agentic execution: planning, tool invocation, error recovery, and self-improvement.

This vision shapes every upcoming phase and long-term investment described below.

---

## Table of Contents

- [Agentic AI Vision](#agentic-ai-vision)
- [Completed Work (Phases 1–11)](#completed-work-phases-111)
- [In Progress](#in-progress)
- [Phase 12 — Testing & Documentation](#phase-12--testing--documentation)
- [Phase 13 — Packaging & Release](#phase-13--packaging--release)
- [TUI Roadmap (Phases T1–T5)](#tui-roadmap-phases-t1t5)
- [Long-Term Vision](#long-term-vision)

---

## Completed Work (Phases 1–11)

All phases below shipped as part of the **v1.0.0 stable release** (2026-02-17), with subsequent
bug-fix releases up to v1.6.0.

| Phase | Scope | Modules | Tests | Version |
|-------|-------|---------|-------|---------|
| **1** Core Foundation | Colors, logger, system, version, executor, errors | 7 | 113 | v1.0.0 |
| **2** Configuration & State | Config, backlog, session manager, metrics | 4 | 174 | v2.0.0 |
| **3** File Operations | File ops, edit ops, utils, arg parser, cleanup | 5 | 354 | v2.0.0 |
| **4** Project Detection | Kind detection, kind config, tech stack, 3rd-party exclusion | 4 | 167 | v1.0.0 |
| **5** Git Integration | Git automation, git cache, auto-commit, change detection | 4 | 219 | v2.0.0 |
| **6** AI Integration | jq wrapper, personas, validation, AI cache, prompt builder, helpers — foundational layer for embedding Copilot agents with structured context, tool invocation, and response validation | 6 | 424 | v2.0.0 |
| **7** Workflow Orchestration | Engine, step registry, dependency resolver, step/conditional executors, checkpoints — composable execution loop designed to host agent-driven step planning and recovery | 6 | 329 | v2.0.0 |
| **8** Performance Optimization | Performance tracking, monitoring, profiles, caching, incremental & parallel analysis, ML skip prediction | 13 | ~800 | v2.0.0 |
| **9** Step Implementations | 20 workflow steps (step_00 → step_17) | 20 | ~1,047 | v2.0.0 |
| **10** Main Orchestrator | `main_orchestrator.js` — coordinates all phases | 1 | 38 | v2.0.0 |
| **11** CLI & Configuration | Entry point, commands (run/resume/config/init/status/clean), TUI baseline | 11 + TUI | 133 | v2.0.0 |

### Notable v1.x Bug Fixes

- **v1.6.0** — `workflowDir` now resolved against `projectRoot` (not CWD); Step 2 version
  fallback; `modifiedFiles` propagation from commit history; step_02_5 absolute paths;
  tsconfig JSONC false-positive; step_07 soft-block on step_12 push; step_15 fallback for
  non-UI project kinds; step_10 full-scan on large change sets; C4 compliance for `promptsDir`
  in 6 steps.

---

## In Progress

### Streaming Copilot Responses *(Unreleased)*

Token-by-token streaming for AI prompts via `CopilotSdkWrapper` and `AiHelper`. This is the
foundational building block for **agentic execution**: rather than waiting for a complete
response, agents stream output in real time, enabling mid-flight monitoring, adaptive
intervention, and live progress display.

- `CopilotSdkWrapper` accepts `streaming: true` at construction time
- `AiHelper.executeRequest(prompt, { stream: true }, onChunk)` — `onChunk(delta)` receives
  each content fragment as it arrives
- Non-streaming callers are entirely unaffected
- Enables real-time display in the TUI Stream Viewer (see Phase T3.5)
- **Planned:** Real-time error recovery and adaptive response powered by embedded Copilot
  agents — agents stream partial plans, detect failure signals, and re-route execution
  without full restarts.

---

## Phase 12 — Testing & Documentation

> **Goal:** Raise integration-test coverage and ship complete, navigable documentation.

### 12.1 Integration & End-to-End Tests

- [ ] 500+ new integration / e2e tests targeting the orchestrator and CLI layer
- [ ] Workflow smoke test: run all 20 steps against a fixture project, assert artifacts
- [ ] Cross-step data-flow tests (verify context propagation between steps)
- [ ] `npm run test:ci` pipeline that runs unit + integration in sequence

### 12.2 API Documentation

- [ ] JSDoc annotations on all public functions and classes (currently partial)
- [ ] Auto-generated HTML docs via `jsdoc` or `typedoc`
- [ ] Hosted at `/docs/api/` (served by GitHub Pages or similar)
- [ ] Type definitions (`.d.ts`) for the public API (`src/index.js` exports)

### 12.3 User-Facing Guides

- [ ] **User Guide** — end-to-end walkthrough for new users
- [ ] **Migration Guide** — bash ai_workflow v3 → ai_workflow.js
- [ ] **Configuration Reference** — every key in `.workflow-config.yaml`, with defaults
- [ ] **CLI Reference** — all commands, flags, exit codes
- [ ] **Troubleshooting Guide** — common errors and remedies

### 12.4 Automation Scripts

- [ ] `scripts/setup.sh` — bootstraps a fresh dev environment
- [ ] `scripts/test-integration.sh` — runs integration tests against a fixture project
- [ ] `scripts/validate.sh` — full pre-release validation gate

### 12.5 Agent Guardrails & Observability

> **Goal:** Ensure agentic workflow execution is safe, transparent, and auditable.

- [ ] Define and enforce agent safety constraints (e.g. file-write scope, network access
  limits, maximum retry depth) within `step_executor.js` and `conditional_executor.js`
- [ ] Build a runtime agent monitoring panel in the TUI (see T3.6) — live execution graph,
  per-agent status, and alert indicators
- [ ] Implement **user intent approval gates**: when an agent proposes a high-impact action
  (e.g. destructive file change, external API call), pause and prompt the user for
  explicit confirmation before proceeding
- [ ] Emit structured observability events (step start/end, tool invocations, retries, errors)
  to `.ai_workflow/logs/` for post-run audit
- [ ] Document guardrail configuration options in `.workflow-config.yaml` schema

---

## Phase 13 — Packaging & Release

> **Goal:** Publish `ai-workflow` to npm and automate future releases.

### 13.1 npm Package Finalization

- [ ] Set `"private": false` and finalize `package.json` metadata
- [ ] Tree-shake internal-only modules from the published bundle
- [ ] Verify `bin/ai-workflow.js` works after global install on Linux / macOS / Windows
- [ ] Test with `npm pack` before publishing

### 13.2 CI/CD Automation (GitHub Actions)

- [ ] **CI workflow** — lint + unit + integration on every PR
- [ ] **Release workflow** — bump version, generate changelog entry, tag, publish to npm
- [ ] **Security scan** — `npm audit` + CodeQL on push to `main`
- [ ] **Dependency updates** — Dependabot configuration

### 13.3 Release Process

- [ ] Automated changelog generation from conventional commits
- [ ] Semantic version bumping script (`scripts/bump-version.js`)
- [ ] GitHub Release with auto-generated release notes
- [ ] npm publish with provenance (`--provenance` flag)

### 13.4 v2.0.0 Milestone

A `v2.0.0` major release is planned after Phases 12–13 are complete and the TUI reaches
Phase T2. It will formalize the public API, drop any deprecated internals, and coincide
with the npm public launch.

---

## TUI Roadmap (Phases T1–T5)

The TUI baseline (Ink-based, `--tui` flag) shipped in Phase 11. The following phases
enhance it into a full interactive dashboard. See [`docs/guides/TUI_ROADMAP.md`](docs/guides/TUI_ROADMAP.md)
for detailed specifications of each item.

### Phase T1 — Navigation & Interactivity

> `j/k` scrolling, panel focus, step detail overlay, log search, mouse support.

| Item | Description | Status |
|------|-------------|--------|
| T1.1 | Keyboard navigation (`j/k`, `Tab`, `g/G`, `h`) | 🔲 Planned |
| T1.2 | Step detail overlay (Enter / Escape) | 🔲 Planned |
| T1.3 | Error detail panel with stack trace | 🔲 Planned |
| T1.4 | Log search / filter (`/`, `n/N`) | 🔲 Planned |
| T1.5 | Mouse support (click + scroll) | 🔲 Planned |

### Phase T2 — Workflow Control

> Pause, skip, retry, abort, approval gates, step-selection mode, intent delegation.

| Item | Description | Status |
|------|-------------|--------|
| T2.1 | Pause / resume (`p`) | 🔲 Planned |
| T2.2 | Skip current step (`s`) | 🔲 Planned |
| T2.3 | Retry failed step (`R`) | 🔲 Planned |
| T2.4 | Abort with cleanup choice overlay | 🔲 Planned |
| T2.5 | Approval gates for steps with `requiresApproval: true` | 🔲 Planned |
| T2.6 | Step selection mode (`--select` / `S`) with dependency enforcement | 🔲 Planned |
| T2.7 | **Intent Delegation Interface** — allow users to specify a high-level goal (e.g. "improve test coverage") and have agents select, order, and execute the appropriate steps autonomously | 🔲 Planned |

### Phase T3 — Rich Visualizations

> Metrics panel, dependency DAG, Gantt strip, change summary, streaming viewer, agent monitoring.

| Item | Description | Status |
|------|-------------|--------|
| T3.1 | Metrics panel (`m`) — ASCII bar chart of step timings | 🔲 Planned |
| T3.2 | Dependency graph view (`d`) — box-drawing ASCII DAG | 🔲 Planned |
| T3.3 | Timeline / Gantt strip at the bottom of the TUI | 🔲 Planned |
| T3.4 | Change summary panel (`c`) — groups by docs/tests/code/config | 🔲 Planned |
| T3.5 | Verbose stream viewer — real-time token stream (`v`, requires `--verbose`) | 🔲 Planned |
| T3.6 | **Agent Monitoring Panel** (`a`) — live per-agent execution status, tool-call trace, error alerts, and supervised task adaptation; integrates with 12.5 observability events | 🔲 Planned |

*T3.5 requires the streaming Copilot integration (currently In Progress).*
*T3.6 requires Phase 12.5 Agent Guardrails & Observability.*

### Phase T4 — TUI-First Workflows

> Init wizard, config editor, checkpoint browser, report viewer, multi-workflow monitor.

| Item | Description | Status |
|------|-------------|--------|
| T4.1 | Interactive init wizard (`ai-workflow init --tui`) | 🔲 Planned |
| T4.2 | In-TUI config editor (`ai-workflow config --tui`) | 🔲 Planned |
| T4.3 | Checkpoint browser (`ai-workflow resume --tui`) | 🔲 Planned |
| T4.4 | Backlog / report viewer (`ai-workflow status --tui`) | 🔲 Planned |
| T4.5 | Multi-workflow monitor (`ai-workflow monitor`) | 🔲 Planned |

### Phase T5 — Polish & Ecosystem

> Themes, recording/playback, log export, desktop notifications, accessibility, TUI tests.

| Item | Description | Status |
|------|-------------|--------|
| T5.1 | Color themes (default / dark-high-contrast / light / monochrome) | 🔲 Planned |
| T5.2 | Session recording & playback (asciinema format) | 🔲 Planned |
| T5.3 | TUI log export (`x` key) | 🔲 Planned |
| T5.4 | Desktop notifications on failure/completion | 🔲 Planned |
| T5.5 | Accessibility mode (`--tui=accessible`) | 🔲 Planned |
| T5.6 | TUI test infrastructure (Ink testing library, snapshot tests) | 🔲 Planned |

### TUI Priority Order

| Phase | Value | Effort | Suggested Order |
|-------|-------|--------|-----------------|
| T1 Navigation | High | Low | **First** |
| T5.6 TUI Tests | High | Low | **Alongside T1** |
| T2 Workflow Control | High | Medium | **Second** |
| T2.6 Step Selection | High | Medium | **Alongside T2** |
| T2.7 Intent Delegation | High | High | **Alongside T2** |
| T3 Visualizations | Medium | Medium | Third |
| T3.5 Stream Viewer | Medium | Medium | **Alongside T3** |
| T3.6 Agent Monitoring | High | Medium | **Alongside T3** |
| T4 TUI Workflows | Medium | High | Fourth |
| T5 Polish | Low–Medium | Low–Medium | Ongoing |

---

## Long-Term Vision

These items are not yet scoped into a specific phase but represent the intended direction
of the project beyond v2.0.0.

We commit to evolving **ai_workflow.js** into a platform for **programmable, agent-driven
execution**—"AI that does," not "AI that chats"—with scalable, safe, and adaptable workflows
ready for complex modern development environments. Every investment below is guided by this
principle: agents that plan, act, adapt, and improve, operating transparently within
guardrails that keep developers in control.

### Plugin System
Allow third-party workflow steps to be registered via npm packages. A step plugin would
export a `StepDefinition` object compatible with `step_registry.js`. Configuration would
list plugins under `workflow.plugins` in `.workflow-config.yaml`.

Beyond static step definitions, the plugin API will support **agentic step plugins**: modules
that export a planning function, a tool registry, and an execution loop—enabling third-party
agents to integrate natively with the orchestrator. Agentic plugins can perform multi-step
planning, invoke external tools, recover from errors, and report structured observability
events just like built-in steps.

### Multi-Repository Workflows
Support running a coordinated workflow across multiple git repositories (e.g. a monorepo
or a set of microservices), with cross-repo dependency graphs and a unified progress view.
Agentic orchestration is central here: a coordinating agent assigns sub-workflows to
per-repo agents, monitors their progress, reconciles cross-repo dependencies, and
aggregates results—replacing brittle sequential scripting with dynamic, adaptive execution.

### Remote Execution / Offloading
Run computationally expensive steps (AI prompts, large test suites) on a remote agent or
GitHub Codespace, with the local TUI acting as a thin observer. Remote runners will expose
an agent execution interface, allowing the local orchestrator to delegate goals (not just
shell commands) to remote agents, receive structured progress events, and trigger adaptive
re-routing if a remote step fails or times out.

### Workflow Marketplace
A registry of shareable workflow configurations and step compositions. Teams could publish
and consume project-kind–specific workflow presets (e.g. `react-spa-strict`, `python-api-fast`).
The marketplace will extend to **agentic step definitions**: reusable agent modules with
declared tool requirements, safety constraints, and intent interfaces, allowing teams to
share and compose agent-powered automation as easily as npm packages.

### Native Windows Support
Full parity on Windows (PowerShell / WSL2), including the TUI (Ink already supports Windows
terminals with color support).

### Self-Improving Workflows via ML
Expand `src/lib/ml_optimization.js` with a full agentic feedback loop: workflow agents
automatically log outcomes, errors, retries, and tool-call traces for every completed run.
This structured telemetry feeds the ML skip-prediction model, enabling agents to learn
which steps to accelerate, skip, or prioritize based on project context and historical
patterns—without requiring manual tuning. Over time, agents will propose workflow
optimizations (e.g. "step_07 consistently fails before step_05; reorder?") and surface
them as actionable suggestions in the TUI.

---

## Versioning Policy

This project follows [Semantic Versioning](https://semver.org/):

- **Patch** (x.y.**Z**) — bug fixes, no API changes
- **Minor** (x.**Y**.0) — new features, backwards-compatible API additions
- **Major** (**X**.0.0) — breaking API changes, major architectural shifts

| Milestone | Target Version | Key Deliverables |
|-----------|---------------|------------------|
| Phase 12 complete | 1.6.0 | Integration tests, full API docs |
| Phase 13 complete | 1.7.0 | npm public, CI/CD, release automation |
| TUI Phase T1+T2 complete | 1.8.0 | Interactive TUI, intent delegation |
| TUI Phase T3+T4 complete | 1.9.0 | Rich visualizations, agent monitoring panel, TUI-first workflows |
| Full TUI + npm public stable | **2.0.0** | Public API freeze, accessibility, themes |
| Agentic execution integration | **2.1.0** | Full agent orchestration, intent delegation, plugin agentic API, guardrails & observability |

---

*Last updated: 2026-03-11 · See [CHANGELOG.md](CHANGELOG.md) for release history.*
