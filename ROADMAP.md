# ai_workflow.js — Project Roadmap

> **Current version:** 2.3.1 · **Status:** Production Ready ✅
> **Tests:** 7,434 passing · **Coverage:** 87.62% · **Vulnerabilities:** 0

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
- [Phase 15 — Python Packaging Step](#phase-15--python-packaging-step)
- [Phase 16 — Submodule Sync / Loader API Parity](#phase-16--submodule-sync--loader-api-parity)
- [Phase W — Web Interface](#phase-w--web-interface)
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

### Workflow Execution Hardening _(Planned from workflow forensics review)_

Follow-up work from execution-log analysis to reduce false failures, prompt sprawl, and
misleading workflow summaries.

- [ ] **Profile planner hardening** — make profile selection compute the dependency closure of
      intended focus steps, and fall back to `full_validation` when an `infrastructure` or
      other focused profile would otherwise collapse into an unrelated docs-only plan
- [ ] **Step 0b bootstrap gate fix** — honor `needsBootstrap` when README / CHANGELOG
      prerequisites are missing so doc-count shortcuts cannot skip required bootstrapping
- [ ] **Project config prompt grounding** — always include `/<project>/.workflow-config.yaml`
      in prompt context and, if it is missing, generate a minimal project-local config before
      AI-heavy analysis continues
- [ ] **Copilot instructions routing** — exclude `.github/copilot-instructions.md` from
      generic Step 1 document review and reserve it for Step 1.5 so the same file is not
      analyzed twice in adjacent steps
- [ ] **Planner-first profile enforcement** — apply profile-derived step filtering before
      workflow load so `docs_only` runs cannot fall through to the full step plan
- [ ] **Step 8 precondition reclassification** — treat `no tests` / `no test command`
      conditions in docs-only or markdown-only repositories as skip / not-applicable,
      not critical failure
- [ ] **Step 5 scope reduction** — remove or isolate the requirements-engineering
      subprompt from directory validation so structure review stays evidence-bound
- [ ] **Step 2 issue accounting cleanup** — report scan candidates separately from
      confirmed issues so false positives do not inflate workflow summaries

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
- [x] Tests: `test/cli/commands/run.test.ts` covers `verbose`/`streamingEnabled` cases

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

## Phase 15 — Python Packaging Step

> **Goal:** Add a dedicated workflow step that uses the `python_developer_prompt` specialist
> persona to review and improve Python packaging manifests for `python_app` projects.
>
> _Prompt template:_ `python_developer_prompt` (`.workflow_core` v7.0.0+)

### Background

The `python_developer_prompt` template was added to `.workflow_core` in v7.0.0. It is a
specialist persona focused exclusively on the **manifest layer** of Python projects:
`pyproject.toml`, `requirements*.txt`, `setup.cfg`, `tox.ini`, `.python-version`. It covers
dependency management, dependency groups, project metadata, build backend consistency,
security, and tooling configuration (`[tool.pytest.ini_options]`, `[tool.ruff]`, etc.).

### 15.1 — `step_24_python_packaging.js`

- [ ] Create `src/steps/step_24_python_packaging.js` following the v2.0.0 referential
      transparency pattern (pure functions + `Step24PythonPackaging` wrapper class)
- [ ] Activate only for `project_kind === 'python_app'`; return a graceful no-op skip for
      all other project kinds
- [ ] Collect manifest files from the project root: `pyproject.toml`, `requirements*.txt`,
      `setup.cfg`, `tox.ini`, `.python-version` — pass as `{python_manifest_files}` context
- [ ] Build prompt via `PromptBuilder` using `python_developer_prompt` template; inject
      standard context fields (`project_name`, `project_description`, `project_kind`,
      `primary_language`, `build_system`, `test_framework`, `test_command`, `lint_command`,
      `modified_count`)
- [ ] Apply the manifest layout rule: `pyproject.toml` present → canonical source;
      `requirements*.txt` only → requirements-only workflow; neither → report the gap
- [ ] Parse AI response with `AiHelper`; validate with `ai_validation.js`; write structured
      findings to `.ai_workflow/logs/step_24_python_packaging.json`
- [ ] Register step in `src/orchestrator/step_registry.js` with: - `id: 'step_24'` - `name: 'Python Packaging Review'` - `condition: ctx => ctx.projectKind === 'python_app'` - `dependsOn: ['step_00']` (project detection must have run first)

### 15.2 — Tests

- [ ] Unit tests for pure functions: manifest file collection, context building, layout-rule
      branching (pyproject.toml present / requirements-only / neither)
- [ ] Integration tests: mock `AiHelper`; verify the step produces a valid `StepResult` and
      writes the expected artifact file
- [ ] Conditional skip test: verify the step returns `{ skipped: true }` for non-Python
      project kinds
- [ ] Add `step_24` to the workflow smoke test (`test/e2e/workflow-smoke.e2e.test.js`)

### 15.3 — Configuration & Documentation

- [ ] Add `step24` toggle to `.workflow-config.yaml` under `workflow.steps`
- [ ] Update `docs/reference/CLI_REFERENCE.md` step list with step_24 entry
- [ ] Update `README.md` step table (currently lists steps up to step_23)

> **Prerequisite met ✅**: `python_developer_prompt` is available in `.workflow_core` v7.0.0+
> (submodule at commit `2055f83`, tag `v1.4.1`).

---

## Phase 16 — Submodule Sync / Loader API Parity

> **Goal:** Keep the JavaScript codebase in sync with new capabilities introduced in the
> `.workflow_core` submodule, specifically mirroring the TypeScript loader API additions
> that are not consumed via the npm package but duplicated manually in
> `src/lib/ai_prompt_builder.js`.

### Background

`ai_workflow.js` reads `.workflow_core` YAML config files directly via path references —
it does not import the TypeScript package (`src/loader.ts`) as an npm dependency.
Whenever new loader functions are published in `.workflow_core`, the corresponding JS
implementations must be added manually to `ai_prompt_builder.js` for full parity.

The assessment of `.workflow_core` v1.3.0 → v1.4.1 (commits `f1950d2`…`2055f83`)
revealed the following gaps, which were closed in **v2.3.1**:

| Gap                                                                                                                | Severity | Status             |
| ------------------------------------------------------------------------------------------------------------------ | -------- | ------------------ |
| `resolveRoleRef` used truthiness check instead of `hasOwnProperty.call()` — same bug that was fixed in `loader.ts` | Medium   | ✅ Fixed in v2.3.1 |
| No `listPersonas()` equivalent reading from YAML                                                                   | Low      | ✅ Added in v2.3.1 |
| No `validateConfig()` JS mirror for cross-validating `role_ref` integrity                                          | Low      | ✅ Added in v2.3.1 |
| CHANGELOG did not mention `.workflow_core` v1.4.1                                                                  | Low      | ✅ Fixed in v2.3.1 |
| `step_24_python_packaging.js` not yet implemented                                                                  | Future   | See Phase 15       |

### 16.1 — Completed (v2.3.1)

- [x] Fix `resolveRoleRef` in `src/lib/ai_prompt_builder.js` to use `Object.prototype.hasOwnProperty.call()` — prevents prototype-chain false positives for keys like `"constructor"` / `"toString"`
- [x] Add `listPersonas(parsedYaml)` pure function to `src/lib/ai_prompt_builder.js` — sorted `string[]` of persona keys, mirroring `loader.ts → listPersonas()`
- [x] Add `validateConfig(parsedYaml, roles)` pure function to `src/lib/ai_prompt_builder.js` — collects all unresolvable `role_ref` errors, returns `{ valid, errors }`, mirroring `loader.ts → validateConfig()`
- [x] Export `listPersonas` and `validateAiHelpersConfig` from `src/index.js`
- [x] Add 16 new tests (2 regression, 6 for `listPersonas`, 8 for `validateConfig`)
- [x] Update CHANGELOG.md with `.workflow_core` v1.4.1 bump notes

### 16.2 — Ongoing process

Whenever `.workflow_core` receives new public loader API functions, apply the same pattern:

1. Identify the new function and its TypeScript signature
2. Mirror it as a pure function in `src/lib/ai_prompt_builder.js`
3. Export from `src/index.js` with an unambiguous alias if the name collides
4. Add unit tests matching the TypeScript test cases
5. Note the submodule bump in CHANGELOG.md

---

## Phase W — Web Interface

> **Goal:** Provide a browser-based dashboard that mirrors and extends the CLI/TUI
> experience, enabling teams to monitor, control, and inspect ai_workflow.js runs from
> any device without requiring a local terminal.
>
> **Stack:** Node.js · [Fastify](https://fastify.dev/) REST API · Server-Sent Events for
> real-time streaming · Vanilla JS + [htmx](https://htmx.org/) frontend (no build step
> required) · optional Docker packaging.

The web interface is architecturally layered on top of the existing orchestrator and CLI
modules — it does not duplicate business logic. The Fastify server imports `MainOrchestrator`,
`WorkflowEngine`, `CheckpointManager`, and the CLI command handlers directly, keeping the
surface area of new code minimal.

---

### Phase W1 — Backend API Server

> **Goal:** A Fastify HTTP server exposing every CLI capability as a JSON REST API,
> with Server-Sent Events (SSE) for real-time workflow progress.

#### W1.1 — Project Scaffold

- [ ] Create `src/web/server.js` — Fastify app factory (accepts config, returns server instance)
- [ ] Create `src/web/index.js` — entry point (`node src/web/index.js` or `ai-workflow web`)
- [ ] Add `web` command to `src/cli/commands/web.js` — starts the server, respects `--port` / `--host` / `--open`
- [ ] Register `web` in `src/cli/index.js` command registry
- [ ] Add `fastify`, `@fastify/cors`, `@fastify/static` to `dependencies` in `package.json`

#### W1.2 — Workflow Control Endpoints

| Method   | Path                            | Action                                          |
| -------- | ------------------------------- | ----------------------------------------------- |
| `POST`   | `/api/workflow/run`             | Start a workflow run (body mirrors CLI options) |
| `POST`   | `/api/workflow/resume`          | Resume from a checkpoint                        |
| `POST`   | `/api/workflow/cancel`          | Cancel the active run                           |
| `GET`    | `/api/workflow/status`          | Current run status + active step                |
| `GET`    | `/api/workflow/checkpoints`     | List available checkpoints                      |
| `DELETE` | `/api/workflow/checkpoints/:id` | Delete a checkpoint                             |

- [ ] Implement route handlers in `src/web/routes/workflow.js`
- [ ] Serialize `WorkflowEngine` events into JSON responses
- [ ] Enforce single-run constraint (reject `/run` if a run is already active)

#### W1.3 — Real-Time Streaming (SSE)

- [ ] `GET /api/workflow/stream` — SSE endpoint; emits `step:start`, `step:complete`,
      `step:error`, `ai:stream:chunk`, `workflow:complete`, `workflow:error` events
- [ ] Implement `src/web/sse.js` — manages open SSE connections, subscribes to `WorkflowEngine`
      event emitter, fans out to all connected clients
- [ ] Reconnection support (`Last-Event-ID` header, replay last N events from in-memory ring buffer)

#### W1.4 — Configuration & Project Endpoints

| Method | Path           | Action                                |
| ------ | -------------- | ------------------------------------- |
| `GET`  | `/api/config`  | Return parsed `.workflow-config.yaml` |
| `PUT`  | `/api/config`  | Validate and save updated config      |
| `GET`  | `/api/project` | Project kind, tech stack, git status  |
| `GET`  | `/api/steps`   | Registered steps with metadata        |

- [ ] Implement `src/web/routes/config.js` and `src/web/routes/project.js`
- [ ] Reuse `ConfigManager`, `ProjectKindDetection`, `TechStack`, `GitAutomation`

#### W1.5 — Metrics & Logs Endpoints

| Method | Path                   | Action                                         |
| ------ | ---------------------- | ---------------------------------------------- |
| `GET`  | `/api/metrics`         | Aggregated performance metrics (latest run)    |
| `GET`  | `/api/metrics/history` | Per-run metrics (last N runs)                  |
| `GET`  | `/api/logs`            | Paginated log lines (supports `?step=` filter) |
| `GET`  | `/api/backlog`         | Workflow backlog / summary report              |

- [ ] Implement `src/web/routes/metrics.js` and `src/web/routes/logs.js`
- [ ] Reuse `MetricsCollector` and `BacklogManager`

#### W1.6 — Tests

- [ ] Unit tests for each route module (`test/web/routes/`)
- [ ] SSE fan-out tests with mock `WorkflowEngine` event emitter
- [ ] Integration tests: start real Fastify instance, exercise all endpoints

---

### Phase W2 — Frontend Dashboard

> **Goal:** A single-page dashboard served by Fastify at `/`. No build step: plain HTML,
> CSS, and htmx for dynamic updates. Progressive enhancement — the API remains fully
> usable without the browser UI.

#### W2.1 — Static Asset Serving

- [ ] Create `src/web/public/` — static assets served by `@fastify/static`
- [ ] `index.html` — dashboard shell with sidebar navigation
- [ ] `style.css` — minimal CSS (CSS custom properties for theming; supports dark mode via `prefers-color-scheme`)
- [ ] `app.js` — htmx configuration, SSE connection management, toast notifications

#### W2.2 — Workflow Control Panel

- [ ] **Run** form: project path, step selection checkboxes, dry-run toggle, verbose toggle
- [ ] **Status bar**: active step name, elapsed time, progress indicator (steps done / total)
- [ ] **Cancel** button (disabled when no run is active)
- [ ] **Resume** dropdown: lists checkpoints from `GET /api/workflow/checkpoints`
- [ ] htmx `hx-sse` attribute connects status bar to `/api/workflow/stream`

#### W2.3 — Live Log Viewer

- [ ] Scrollable log pane that appends `ai:stream:chunk` and `step:*` SSE events in real time
- [ ] Filter toolbar: by step, by log level (info / warn / error)
- [ ] "Jump to bottom" / "Pause scroll" toggle
- [ ] Download button: exports current log as `.txt`

#### W2.4 — Step Dependency Graph

- [ ] Fetch step metadata from `GET /api/steps` on load
- [ ] Render a directed acyclic graph using [D3.js](https://d3js.org/) (added as a static asset; no npm build)
- [ ] Color-code nodes by state: pending (grey) · running (blue) · done (green) · skipped (dim) · error (red)
- [ ] Click a node to open a detail panel showing step description, duration, and output summary

#### W2.5 — Metrics Dashboard

- [ ] Summary cards: total duration, steps run/skipped, AI calls, tokens used
- [ ] Per-step duration bar chart (D3 or CSS-only bar chart)
- [ ] Run history table: links to per-run detail (reads from `GET /api/metrics/history`)

---

### Phase W3 — Configuration & Management UI

> **Goal:** In-browser editing of `.workflow-config.yaml` and project settings, with
> live validation feedback.

#### W3.1 — Config Editor

- [ ] Embed [CodeMirror 6](https://codemirror.net/) YAML editor (loaded from CDN; no build step)
- [ ] On save, `PUT /api/config` — server validates via `ConfigManager.validate()` and returns
      structured errors highlighted in the editor gutter
- [ ] Show diff of pending vs. saved config before committing

#### W3.2 — Step Management

- [ ] Enable / disable individual steps from the UI (persisted to config)
- [ ] Drag-and-drop step reordering (writes `workflow.stepOrder` override to config)
- [ ] Reset to defaults button

#### W3.3 — Project Inspector

- [ ] Display detected project kind, tech stack, third-party exclusions
- [ ] Git status panel: branch, last commit, modified files count
- [ ] "Refresh" button re-calls `GET /api/project` without page reload

---

### Phase W4 — Authentication & Multi-Project Support

> **Goal:** Make the web interface safe to expose on a local network and capable of
> managing multiple projects from a single server instance.

#### W4.1 — Local Authentication

- [ ] Optional token-based auth (`workflow.web.auth.token` in config; env-var override `AI_WORKFLOW_WEB_TOKEN`)
- [ ] `POST /api/auth/login` — exchanges token for a short-lived session cookie
- [ ] Protect all `/api/*` routes with `@fastify/auth` preHandler when token is configured
- [ ] Login page served at `/login`

#### W4.2 — Multi-Project Support

- [ ] Config key `workflow.web.projects[]` — list of `{ name, path }` project roots
- [ ] `GET /api/projects` — list registered projects
- [ ] All `/api/workflow/*` and `/api/config` routes accept optional `?project=<name>` query param
- [ ] Project switcher dropdown in the sidebar; persists selection in `localStorage`

---

### Phase W5 — Packaging & Deployment

> **Goal:** Zero-friction startup for local use; optional containerised deployment for
> shared team environments.

#### W5.1 — CLI Integration

- [ ] `ai-workflow web` command (Phase W1.1) with flags: `--port` (default 4242),
      `--host` (default `127.0.0.1`), `--open` (launch browser), `--auth` (require token)
- [ ] `ai-workflow web --init` generates a `web.config.yaml` with annotated defaults

#### W5.2 — Docker Support

- [ ] `Dockerfile` in `docker/web/` — Node.js 20 Alpine base, `COPY src/web`, exposes port 4242
- [ ] `docker-compose.yml` — mounts project root as a volume; sets `AI_WORKFLOW_WEB_TOKEN`
- [ ] Document usage in `docs/guides/WEB_INTERFACE.md`

#### W5.3 — Tests & Documentation

- [ ] E2E tests using [Playwright](https://playwright.dev/): dashboard load, run workflow,
      observe SSE updates, check step graph colours
- [ ] `docs/guides/WEB_INTERFACE.md` — installation, configuration, screenshots, security notes
- [ ] Update `README.md` and `docs/README.md` with web interface entry point

### Phase W — Priority Order

| Sub-phase            | Value  | Effort | Suggested Order  |
| -------------------- | ------ | ------ | ---------------- |
| W1 Backend API       | High   | Medium | **First**        |
| W2.1–W2.3 Core UI    | High   | Medium | **Second**       |
| W2.4 Step Graph      | Medium | Medium | Third            |
| W2.5 Metrics         | Medium | Low    | Third            |
| W3 Config UI         | Medium | Medium | Fourth           |
| W4 Auth & Multi-proj | Medium | Medium | Fourth           |
| W5 Packaging         | High   | Low    | **Alongside W2** |

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

- [ ] Fix the unrelated `test/cli/tui/components/StatusBar.test.js` spacing failure
      (`renders correct spacing between hints`). The current render inserts
      `[Tab] Focus` between `Abort` and `Scroll`, so the test expectation and the
      `StatusBar` hint-order contract need to be aligned.

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
| Phase 12 complete            | 1.9.11         | Integration tests, full API docs                                         |
| Phase 13 complete            | 1.9.11         | npm public, CI/CD, release automation                                    |
| TUI Phase T1+T2 complete     | 1.9.11         | Interactive TUI                                                          |
| TUI Phase T3+T4 complete     | 1.10.0         | Rich visualizations, TUI-first workflows                                 |
| Phase 14 complete            | 1.11.0         | Reflection, Cognitive Verifier, Alternative Approaches, Output Automater |
| Phase W1+W2 complete         | 1.12.0         | Web API server, live dashboard, SSE streaming                            |
| Phase W3+W4+W5 complete      | 1.13.0         | Config UI, multi-project, auth, Docker packaging                         |
| Full TUI + npm public stable | **2.0.0**      | Public API freeze, accessibility, themes                                 |

---

_Last updated: 2026-03-18 · See [CHANGELOG.md](CHANGELOG.md) for release history._
