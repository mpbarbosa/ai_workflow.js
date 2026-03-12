# ai_workflow.js — Project Roadmap

> **Current version:** 1.6.3 · **Status:** Production Ready ✅
> **Tests:** 5,837 passing · **Coverage:** 86.79% · **Vulnerabilities:** 0

This roadmap tracks the evolution of **ai_workflow.js** from its initial architecture through
upcoming feature work and long-term vision. Phases 1–11 are complete and shipped as v1.0.0.
Active development continues on TUI enhancements, streaming, and the next release milestone.

---

## Table of Contents

- [Completed Work (Phases 1–11)](#completed-work-phases-111)
- [In Progress](#in-progress)
- [Phase 12 — Testing & Documentation](#phase-12--testing--documentation)
- [Phase 13 — Packaging & Release](#phase-13--packaging--release)
- [Phase 14 — Prompt Engineering Enhancements](#phase-14--prompt-engineering-enhancements)
- [TUI Roadmap (Phases T1–T5)](#tui-roadmap-phases-t1t5)
- [Long-Term Vision](#long-term-vision)

---

## Completed Work (Phases 1–11)

All phases below shipped as part of the **v1.0.0 stable release** (2026-02-17), with subsequent
bug-fix releases up to v1.6.3.

| Phase                          | Scope                                                                                                    | Modules  | Tests  | Version |
| ------------------------------ | -------------------------------------------------------------------------------------------------------- | -------- | ------ | ------- |
| **1** Core Foundation          | Colors, logger, system, version, executor, errors                                                        | 7        | 113    | v1.0.0  |
| **2** Configuration & State    | Config, backlog, session manager, metrics                                                                | 4        | 174    | v2.0.0  |
| **3** File Operations          | File ops, edit ops, utils, arg parser, cleanup                                                           | 5        | 354    | v2.0.0  |
| **4** Project Detection        | Kind detection, kind config, tech stack, 3rd-party exclusion                                             | 4        | 167    | v1.0.0  |
| **5** Git Integration          | Git automation, git cache, auto-commit, change detection                                                 | 4        | 219    | v2.0.0  |
| **6** AI Integration           | jq wrapper, personas, validation, AI cache, prompt builder, helpers                                      | 6        | 424    | v2.0.0  |
|                                | _Prompt patterns already implemented: Template (#2), Persona (#3), Recipe (#5), Context Manager (#16)_   |          |        |         |
| **7** Workflow Orchestration   | Engine, step registry, dependency resolver, step/conditional executors, checkpoints                      | 6        | 329    | v2.0.0  |
| **8** Performance Optimization | Performance tracking, monitoring, profiles, caching, incremental & parallel analysis, ML skip prediction | 13       | ~800   | v2.0.0  |
| **9** Step Implementations     | 20 workflow steps (step_00 → step_17)                                                                    | 20       | ~1,047 | v2.0.0  |
| **10** Main Orchestrator       | `main_orchestrator.js` — coordinates all phases                                                          | 1        | 38     | v2.0.0  |
| **11** CLI & Configuration     | Entry point, commands (run/resume/config/init/status/clean), TUI baseline                                | 11 + TUI | 133    | v2.0.0  |

### Notable v1.x Bug Fixes

- **v1.6.3** — `workflowDir` now resolved against `projectRoot` (not CWD); Step 2 version
  fallback; `modifiedFiles` propagation from commit history; step_02_5 absolute paths;
  tsconfig JSONC false-positive; step_07 soft-block on step_12 push; step_15 fallback for
  non-UI project kinds; step_10 full-scan on large change sets; C4 compliance for `promptsDir`
  in 6 steps.

---

## In Progress

### Streaming Copilot Responses _(Implemented — pending release)_

Token-by-token streaming for AI prompts via `CopilotSdkWrapper` and `AiHelper`.

- `CopilotSdkWrapper` accepts `streaming: true` at construction time
- `AiHelper.executeRequest(prompt, { stream: true }, onChunk)` — `onChunk(delta)` receives
  each content fragment as it arrives
- Non-streaming callers are entirely unaffected
- Enables real-time display in the TUI Stream Viewer (see Phase T3.5)

### Verbose & Streaming Propagation _(Implemented — pending release)_

The `--verbose` CLI flag and TUI mode now fully propagate `streamingEnabled` into the
orchestrator, enabling live token display without extra configuration.

- `run.js` `createOrchestratorOptions()` derives `streamingEnabled: !!(verbose || tui)`
- `resume.js` `resumeCommand()` carries the same derivation for checkpoint-resume runs
- `MainOrchestrator` injects a streaming-capable `AiHelper` into every step when `streamingEnabled`
- Token deltas forwarded as `ai:stream:chunk` events on `WorkflowEngine` for TUI consumption
- See [`docs/guides/TUI_ROADMAP.md`](docs/guides/TUI_ROADMAP.md) §T3.5 for TUI integration

---

## Phase 12 — Testing & Documentation

> **Goal:** Raise integration-test coverage and ship complete, navigable documentation.

### Phase 12 — Progress

Many 12.3 and 12.4 deliverables already exist from earlier phases. The genuine gaps are
integration/e2e test volume, the Migration Guide, TypeScript type definitions, and
auto-generated HTML docs.

| Sub-phase | Item                                           | Status                                                                                                         |
| --------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **12.1**  | 500+ integration / e2e tests                   | ✅ Done (452 integration/e2e tests; 6,234 total)                                                               |
| **12.1**  | Workflow smoke test against fixture project    | ✅ Done (`test/e2e/workflow-smoke.e2e.test.js`)                                                                |
| **12.1**  | Cross-step data-flow tests                     | ✅ Done (3 files in `test/integration/cross-step/`)                                                            |
| **12.1**  | `npm run test:ci` pipeline                     | ✅ Done (`test:fast` + `test:slow` + `test:e2e`)                                                               |
| **12.2**  | JSDoc annotations (partial)                    | ⚠️ Partial — key modules annotated                                                                             |
| **12.2**  | Auto-generated HTML docs (`typedoc`)           | ✅ Done (`npm run docs:generate` → `docs/api/html/`)                                                           |
| **12.2**  | Type definitions `.d.ts` for public API        | ✅ Done (`src/types/public-api.d.ts`)                                                                          |
| **12.3**  | User Guide                                     | ✅ Done (`docs/guides/USER_GUIDE.md`, 597 lines)                                                               |
| **12.3**  | Migration Guide (bash v3 → ai_workflow.js)     | ✅ Done (`docs/guides/MIGRATION_GUIDE.md`, ~1,000 lines)                                                       |
| **12.3**  | Configuration Reference                        | ✅ Done (`docs/guides/CONFIGURATION_GUIDE.md`, 907 lines; `docs/reference/CONFIGURATION_SCHEMA.md`, 815 lines) |
| **12.3**  | CLI Reference                                  | ✅ Done (`docs/reference/CLI_REFERENCE.md`, 646 lines)                                                         |
| **12.3**  | Troubleshooting Guide                          | ✅ Done (`docs/guides/TROUBLESHOOTING.md`, 763 lines)                                                          |
| **12.4**  | `scripts/setup.sh`                             | ✅ Done                                                                                                        |
| **12.4**  | `scripts/test-integration.sh`                  | ✅ Done                                                                                                        |
| **12.4**  | `scripts/validate.sh`                          | ✅ Done                                                                                                        |
| **12.5**  | `verbose`/`streamingEnabled` propagation wired | ✅ Done (v1.6.x)                                                                                               |

---

### 12.1 Integration & End-to-End Tests

**Infrastructure** (prerequisite for all integration runs):

- [x] `test/fixtures/nodejs-api/` — minimal realistic Node.js REST API fixture project
      (`package.json`, `src/`, `test/`, `README.md`, `.gitignore`) used as the target in all
      integration and e2e runs
- [x] `test/helpers/integration.js` — shared utilities: `createTempProject(fixture)`,
      `cleanupTempProject(dir)`, `runCLI(args, cwd)`, `createMockAiHelper()`
- [x] `jest.integration.config.json` — dedicated Jest project covering `test/integration/**`
      and `test/e2e/**`

**CLI integration tests** (`test/integration/cli/`, ~150 tests across 6 files):

- [x] `run.integration.test.js` — `runCommand()` with `--dry-run`, `--step`, `--profile`,
      `--verbose`, `--no-parallel` flags against a temp fixture copy
- [x] `resume.integration.test.js` — `resumeCommand()` with a pre-written checkpoint file;
      invalid ID handling
- [x] `init.integration.test.js` — `initCommand()` creates `.ai_workflow/` directory tree,
      copies config template
- [x] `status-clean.integration.test.js` — `statusCommand()` reads real artifacts;
      `cleanCommand()` prunes `.ai_workflow/` directories
- [x] `config.integration.test.js` — `configCommand()` reads/writes `.workflow-config.yaml`
      in isolated temp dirs
- [x] `streaming.integration.test.js` — verify `verbose: true` → `streamingEnabled: true`
      propagation through `createOrchestratorOptions` to `MainOrchestrator`

**Orchestrator integration tests** (`test/integration/orchestrator/`, ~150 tests across 5 files):

- [x] `lifecycle.integration.test.js` — instantiate `MainOrchestrator` against the fixture,
      run step_00 (safe: project-detection only), assert `executionContext` fields populated
- [x] `checkpoint.integration.test.js` — simulate mid-run failure, verify checkpoint written
      to `.ai_workflow/checkpoints/`, re-instantiate with `resumeFromCheckpoint`, verify correct
      step resume
- [x] `context.integration.test.js` — verify step `contextUpdate` fields are merged into
      `executionContext` before the next step executes
- [x] `dry-run.integration.test.js` — full workflow in `dryRun: true` mode; assert no
      artifact files are written and every step returns `{ success: true, dryRun: true }`
- [x] `parallel.integration.test.js` — configure independent steps for parallel execution;
      verify they complete correctly

**Cross-step data-flow tests** (`test/integration/cross-step/`, ~100 tests across 3 files):

- [x] `detection-to-analysis.test.js` — verify `projectType`, `modifiedFiles`, `gitStats`
      from step_00 are available in the context when step_01/step_02 execute (AI calls mocked)
- [x] `test-review-to-gen.test.js` — verify step_06 test review results influence step_07
      test generation decisions
- [x] `git-finalization.test.js` — step_12 reads real git state from a `git init`-ed temp
      fixture repo; commit message generation; no-changes graceful skip

**E2E smoke tests** (`test/e2e/`, ~80 tests across 3 files):

- [x] `workflow-smoke.e2e.test.js` — run all 20 workflow steps in `dryRun: true` mode
      against the fixture project; assert every step is invoked and returns a valid `StepResult`
      with no unhandled exceptions
- [x] `workflow-artifacts.e2e.test.js` — run a partial real workflow (step_00 + step_0f +
      step_17) against the fixture; verify `.ai_workflow/` artifact files are created with the
      correct structure and schema
- [x] `step_00_extended.e2e.test.js` — extend existing `step_00_project_detection.e2e.test.js`
      with additional fixture variants: Python project, React SPA, generic project

**Pipeline**: `npm run test:ci` already runs `test:fast` (unit) → `test:slow` (orchestrator);
extend to include the new integration and e2e suites.

### 12.2 API Documentation

- [x] JSDoc annotation pass on key modules: `config.js`, `workflow_engine.js`,
      `main_orchestrator.js`, `file_operations.js`, `git_automation.js` — fill missing
      `@param`, `@returns`, `@throws`, `@example` tags
- [x] Install `typedoc` as dev dependency; create `typedoc.json` pointing at `src/`
- [x] Add `npm run docs:generate` script; add `docs/api/html/` to `.gitignore`
- [ ] Hosted at `/docs/api/` (served by GitHub Pages or similar)
- [x] `src/types/public-api.d.ts` — hand-crafted TypeScript declarations for every export
      in `src/index.js`; update `package.json` with `"types": "src/types/public-api.d.ts"`

### 12.3 User-Facing Guides

- [x] **User Guide** — `docs/guides/USER_GUIDE.md` (597 lines)
- [x] **Migration Guide** — `docs/guides/MIGRATION_GUIDE.md` — bash `ai_workflow` v3 →
      `ai_workflow.js`: concept mapping, CLI command equivalents, configuration differences,
      step customization, known behavioral changes, troubleshooting migration issues
- [x] **Configuration Reference** — `docs/guides/CONFIGURATION_GUIDE.md` (907 lines)
      and `docs/reference/CONFIGURATION_SCHEMA.md` (815 lines)
- [x] **CLI Reference** — `docs/reference/CLI_REFERENCE.md` (646 lines)
- [x] **Troubleshooting Guide** — `docs/guides/TROUBLESHOOTING.md` (763 lines)

### 12.4 Automation Scripts

- [x] `scripts/setup.sh` — bootstraps a fresh dev environment
- [x] `scripts/test-integration.sh` — runs integration tests against a fixture project
- [x] `scripts/validate.sh` — full pre-release validation gate

### 12.5 Streaming & Verbose _(Implemented — pending release)_

The `--verbose` flag and TUI mode now propagate `streamingEnabled` end-to-end through
the CLI → orchestrator → step injection chain.

- [x] `run.js` `createOrchestratorOptions()` derives `streamingEnabled: !!(verbose || tui)`
- [x] `resume.js` `resumeCommand()` carries the same derivation for checkpoint-resume runs
- [x] `MainOrchestrator` injects a streaming `AiHelper` into every step when enabled
- [x] Tests: `test/cli/commands/run.test.js` covers `verbose`/`streamingEnabled` cases

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

## Phase 14 — Prompt Engineering Enhancements

> **Goal:** Apply established prompt patterns from the literature to make every AI step
> smarter, more accurate, and more actionable.
>
> _Based on: "A Prompt Pattern Catalog to Enhance Prompt Engineering with ChatGPT"_
> _(Vanderbilt University, 2023) — [arXiv:2302.11382](https://arxiv.org/abs/2302.11382)_

Phase 6 already implements four foundational patterns (Template, Persona, Recipe, Context
Manager). Phase 14 adds the next tier of patterns that directly improve output quality
and developer experience.

### 14.1 Reflection Layer _(Error Identification — Pattern #8)_

Prompt the AI to self-critique its own step output before it reaches validation. After
each primary Copilot response, a lightweight follow-up prompt asks the model to identify
any inaccuracies, gaps, or improvements — catching hallucinations earlier and reducing
false positives in `ai_validation.js`.

- [ ] Add `reflectionPrompt()` helper to `ai_prompt_builder.js`
- [ ] Wire into `ai_helpers.js` as an optional post-response pass (`reflect: true`)
- [ ] Expose `workflow.ai.reflection` toggle in `.workflow-config.yaml`
- [ ] Add tests covering reflection output parsing and merge into validated result

### 14.2 Cognitive Verifier _(Prompt Improvement — Pattern #11)_

Break complex, multi-file analysis prompts into smaller sub-questions before sending to
Copilot. Each sub-answer is combined into a final structured response. Steps processing
large change sets (step_01, step_03, step_10) benefit most: accuracy improves, token
usage per call stays manageable.

- [ ] Add `decomposePrompt(question, subQuestions[])` to `ai_prompt_builder.js`
- [ ] Implement sub-answer aggregation in `ai_helpers.js`
- [ ] Apply automatically when `modifiedFiles.length > N` (configurable threshold)
- [ ] Validate that combined answer quality exceeds single-shot baseline

### 14.3 Alternative Approaches _(Prompt Improvement — Pattern #10)_

Steps that produce recommendations (step_03 test generation, step_04 config validation,
step_10 code quality) offer two or more solution options with explicit trade-offs, instead
of a single prescription. Developers choose; the workflow logs their selection for ML
skip-prediction feedback.

- [x] Add `alternativesDirective` option to step prompt templates in `ai_prompt_builder.js`
- [x] Update step_03, step_04, step_10 to request and surface multiple alternatives
- [x] Persist selected alternative in `executionContext` for downstream use
- [x] Surface alternatives in the TUI step detail overlay (T1.2)

### 14.4 Output Automater _(Output Customization — Pattern #6, enhanced)_

When an AI step identifies concrete remediations (lint errors, missing tests, config
issues), automatically generate a runnable script alongside the human-readable report.
Developers can apply all fixes in one command rather than manually interpreting each
suggestion.

- [ ] New module `src/lib/ai_script_generator.js` — converts structured AI remediation
      output into idiomatic shell/Node.js fix scripts
- [ ] Integrate with step_07 (linting) and step_04 (config) as a post-step artifact
- [ ] Save generated scripts to `.ai_workflow/fixes/` alongside step reports
- [ ] Add `--apply-fixes` CLI flag to execute the generated script with confirmation

### 14.5 Prompt Pre-flight / Question Refinement _(Prompt Improvement — Pattern #9)_

Before submitting a prompt to Copilot, run a lightweight self-refinement pass that
rewrites ambiguous or underspecified prompts for clarity. Reduces wasted token budget on
low-quality initial prompts and produces more consistent step outputs.

- [ ] Add `refinePrompt(rawPrompt)` to `ai_prompt_builder.js` (single Copilot round-trip)
- [ ] Apply as opt-in pre-flight step: `workflow.ai.promptRefinement: true`
- [ ] Cache refined prompts in `ai_cache.js` to avoid redundant refinement on re-runs
- [ ] Benchmark: compare output quality scores before/after refinement on 5 representative steps

---

## TUI Roadmap (Phases T1–T5)

The TUI baseline (Ink-based, `--tui` flag) shipped in Phase 11. The following phases
enhance it into a full interactive dashboard. See [`docs/guides/TUI_ROADMAP.md`](docs/guides/TUI_ROADMAP.md)
for detailed specifications of each item.

### Phase T1 — Navigation & Interactivity

> `j/k` scrolling, panel focus, step detail overlay, log search, mouse support.

| Item | Description                                    | Status     |
| ---- | ---------------------------------------------- | ---------- |
| T1.1 | Keyboard navigation (`j/k`, `Tab`, `g/G`, `h`) | 🔲 Planned |
| T1.2 | Step detail overlay (Enter / Escape)           | 🔲 Planned |
| T1.3 | Error detail panel with stack trace            | 🔲 Planned |
| T1.4 | Log search / filter (`/`, `n/N`)               | 🔲 Planned |
| T1.5 | Mouse support (click + scroll)                 | 🔲 Planned |

### Phase T2 — Workflow Control

> Pause, skip, retry, abort, approval gates, step-selection mode.

| Item | Description                                                        | Status     |
| ---- | ------------------------------------------------------------------ | ---------- |
| T2.1 | Pause / resume (`p`)                                               | 🔲 Planned |
| T2.2 | Skip current step (`s`)                                            | 🔲 Planned |
| T2.3 | Retry failed step (`R`)                                            | 🔲 Planned |
| T2.4 | Abort with cleanup choice overlay                                  | 🔲 Planned |
| T2.5 | Approval gates for steps with `requiresApproval: true`             | 🔲 Planned |
| T2.6 | Step selection mode (`--select` / `S`) with dependency enforcement | 🔲 Planned |

### Phase T3 — Rich Visualizations

> Metrics panel, dependency DAG, Gantt strip, change summary, streaming viewer.

| Item | Description                                                                                                           | Status     |
| ---- | --------------------------------------------------------------------------------------------------------------------- | ---------- |
| T3.1 | Metrics panel (`m`) — ASCII bar chart of step timings                                                                 | 🔲 Planned |
| T3.2 | Dependency graph view (`d`) — box-drawing ASCII DAG; optionally AI-generated via Visualization Generator pattern (#4) | 🔲 Planned |
| T3.3 | Timeline / Gantt strip at the bottom of the TUI                                                                       | 🔲 Planned |
| T3.4 | Change summary panel (`c`) — groups by docs/tests/code/config                                                         | 🔲 Planned |
| T3.5 | Verbose stream viewer — real-time token stream (`v`, requires `--verbose`)                                            | 🔲 Planned |

_T3.5 requires the streaming Copilot integration (currently In Progress)._

### Phase T4 — TUI-First Workflows

> Init wizard, config editor, checkpoint browser, report viewer, multi-workflow monitor.

| Item | Description                                                                                                                                                          | Status     |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| T4.1 | Interactive init wizard (`ai-workflow init --tui`) — uses Flipped Interaction pattern (#13): AI asks clarifying questions about the project before generating config | 🔲 Planned |
| T4.2 | In-TUI config editor (`ai-workflow config --tui`)                                                                                                                    | 🔲 Planned |
| T4.3 | Checkpoint browser (`ai-workflow resume --tui`)                                                                                                                      | 🔲 Planned |
| T4.4 | Backlog / report viewer (`ai-workflow status --tui`)                                                                                                                 | 🔲 Planned |
| T4.5 | Multi-workflow monitor (`ai-workflow monitor`)                                                                                                                       | 🔲 Planned |

### Phase T5 — Polish & Ecosystem

> Themes, recording/playback, log export, desktop notifications, accessibility, TUI tests.

| Item | Description                                                      | Status     |
| ---- | ---------------------------------------------------------------- | ---------- |
| T5.1 | Color themes (default / dark-high-contrast / light / monochrome) | 🔲 Planned |
| T5.2 | Session recording & playback (asciinema format)                  | 🔲 Planned |
| T5.3 | TUI log export (`x` key)                                         | 🔲 Planned |
| T5.4 | Desktop notifications on failure/completion                      | 🔲 Planned |
| T5.5 | Accessibility mode (`--tui=accessible`)                          | 🔲 Planned |
| T5.6 | TUI test infrastructure (Ink testing library, snapshot tests)    | 🔲 Planned |

### TUI Priority Order

| Phase               | Value      | Effort     | Suggested Order  |
| ------------------- | ---------- | ---------- | ---------------- |
| T1 Navigation       | High       | Low        | **First**        |
| T5.6 TUI Tests      | High       | Low        | **Alongside T1** |
| T2 Workflow Control | High       | Medium     | **Second**       |
| T2.6 Step Selection | High       | Medium     | **Alongside T2** |
| T3 Visualizations   | Medium     | Medium     | Third            |
| T3.5 Stream Viewer  | Medium     | Medium     | **Alongside T3** |
| T4 TUI Workflows    | Medium     | High       | Fourth           |
| T5 Polish           | Low–Medium | Low–Medium | Ongoing          |

---

## Long-Term Vision

These items are not yet scoped into a specific phase but represent the intended direction
of the project beyond v2.0.0.

### Plugin System

Allow third-party workflow steps to be registered via npm packages. A step plugin would
export a `StepDefinition` object compatible with `step_registry.js`. Configuration would
list plugins under `workflow.plugins` in `.workflow-config.yaml`.

### Multi-Repository Workflows

Support running a coordinated workflow across multiple git repositories (e.g. a monorepo
or a set of microservices), with cross-repo dependency graphs and a unified progress view.

### Remote Execution / Offloading

Run computationally expensive steps (AI prompts, large test suites) on a remote agent or
GitHub Codespace, with the local TUI acting as a thin observer.

### Workflow Marketplace

A registry of shareable workflow configurations and step compositions. Teams could publish
and consume project-kind–specific workflow presets (e.g. `react-spa-strict`, `python-api-fast`).

### Native Windows Support

Full parity on Windows (PowerShell / WSL2), including the TUI (Ink already supports Windows
terminals with color support).

### Self-Improving Workflows via ML

Expand `src/lib/ml_optimization.js` with a feedback loop: completed workflow runs contribute
anonymized timing/skip data to refine the ML skip-prediction model over time.

### Workflow DSL — Compact Step Notation

Inspired by the Meta Language Creation prompt pattern (#1): define a compact shorthand
notation for step selection and chaining directly in the CLI (e.g. `ai-workflow run
01>03,10` meaning "run steps 01, 03, and 10 with 01→03 dependency"). Reduces verbosity
for power users running partial workflows without full YAML configuration.

### AI-Generated Architecture Diagrams

Apply the Visualization Generator prompt pattern (#4): analysis steps (step_01, step_10)
emit Mermaid or PlantUML source alongside their text reports. The TUI can render these as
inline ASCII art; CI pipelines can commit them as living architecture documentation that
updates automatically on every workflow run.

---

## Versioning Policy

This project follows [Semantic Versioning](https://semver.org/):

- **Patch** (x.y.**Z**) — bug fixes, no API changes
- **Minor** (x.**Y**.0) — new features, backwards-compatible API additions
- **Major** (**X**.0.0) — breaking API changes, major architectural shifts

| Milestone                    | Target Version | Key Deliverables                                                         |
| ---------------------------- | -------------- | ------------------------------------------------------------------------ |
| Phase 12 complete            | 1.7.3          | Integration tests, full API docs                                         |
| Phase 13 complete            | 1.8.0          | npm public, CI/CD, release automation                                    |
| TUI Phase T1+T2 complete     | 1.9.0          | Interactive TUI                                                          |
| TUI Phase T3+T4 complete     | 1.10.0         | Rich visualizations, TUI-first workflows                                 |
| Phase 14 complete            | 1.11.0         | Reflection, Cognitive Verifier, Alternative Approaches, Output Automater |
| Full TUI + npm public stable | **2.0.0**      | Public API freeze, accessibility, themes                                 |

---

_Last updated: 2026-03-10 · See [CHANGELOG.md](CHANGELOG.md) for release history._
