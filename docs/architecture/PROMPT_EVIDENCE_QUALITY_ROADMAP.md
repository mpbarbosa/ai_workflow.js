# Prompt Evidence Quality Roadmap

**AI Workflow Automation**
**Last Updated:** 2026-05-06
**Audience:** Architects, Senior Developers

---

## Table of Contents

- [Motivation](#motivation)
- [Current State Diagnosis](#current-state-diagnosis)
- [Design Principles Applied](#design-principles-applied)
- [Phase 1 — Consolidate truncation into a single TokenBudget module](#phase-1--consolidate-truncation-into-a-single-tokenbudget-module)
- [Phase 2 — Introduce the Artifact domain model](#phase-2--introduce-the-artifact-domain-model)
- [Phase 3 — Per-slot budget allocation via EvidenceSlot](#phase-3--per-slot-budget-allocation-via-evidenceslot)
- [Phase 4 — Surface the completeness manifest in the prompt](#phase-4--surface-the-completeness-manifest-in-the-prompt)
- [Phase 5 — Continuation prompting for overflow artifacts](#phase-5--continuation-prompting-for-overflow-artifacts)
- [Dependency Order](#dependency-order)

---

## Motivation

When test files (or other artifacts) exceed the token budget, their contents are
truncated before being injected into the prompt. The AI is instructed to mark
conclusions about truncated evidence as inconclusive, but the current
implementation makes this unreliable for two reasons:

1. The truncation is invisible to the AI as a structured fact — it only appears
   as a `(truncated)` string embedded inside a code fence, which the model can
   overlook when writing per-file conclusions.
2. There is no control over _which_ artifacts get truncated. Files are served in
   discovery order; a large low-priority file can crowd out a small high-priority
   one that fits entirely.

The goal of this roadmap is to make truncation a first-class, predictable domain
concept — something the assembler controls precisely and the prompt communicates
explicitly — rather than an emergent side-effect of string slicing.

---

## Current State Diagnosis

Three independent truncation layers exist with no shared abstraction:

| Layer                  | Location                     | Limit                 | Logic              |
| ---------------------- | ---------------------------- | --------------------- | ------------------ |
| Per-test-file          | `step_06_test_review.js:504` | 5 000 chars           | `slice(0, 5000)`   |
| Per-file (code review) | `ai_prompt_builder.js:984`   | 4 000 chars           | cut at last `\n`   |
| Total context          | `ai_prompt_builder.js:471`   | `maxTokens × 4` chars | leading truncation |

Additional observations:

- File contents are collapsed into a flat markdown string before reaching the
  prompt builder, losing structural metadata (path, language, git status, size).
- Prioritization logic (`sortByPriority` in `step10_partition_cache.js`) exists
  but is **not wired into step_06** — test files are served in discovery order.
- Token estimation uses the rough heuristic `chars / 4` in multiple unrelated
  call sites.
- Magic-number limits are hardcoded across `step_06`, `ai_prompt_builder`, and
  `step_10_ai_review`.

---

## Design Principles Applied

### Low coupling

Steps declare _what evidence they need_; a shared assembler decides _how to fit
it within the budget_. No step contains truncation arithmetic or file-reading
logic. The truncation policy is injected, not hardcoded.

### High cohesion

Each module owns exactly one responsibility:

- `TokenBudgetManager` — token counting and limit enforcement
- `ArtifactRepository` — file reading and caching
- `ContextAssembler` — fitting artifacts into a `ReviewContext`
- Each step — declaring its artifact requirements and slot budgets

### Domain-driven design

The domain language is _evidence_. Key domain entities:

- `Artifact` — a file with metadata (path, content, language, size, git status,
  priority)
- `EvidenceSlot` — a named section of a prompt with its own token budget and
  truncation policy
- `TokenBudget` — an explicit constraint, not an implicit string length
- `ReviewContext` — the fully assembled, budget-aware evidence package sent to
  the AI, including a completeness manifest

Steps and templates speak this language. File I/O and string formatting are
infrastructure details behind repository and assembler interfaces.

---

## Phase 1 — Consolidate truncation into a single `TokenBudget` module

**Goal:** eliminate the three independent truncation layers and establish one
source of truth for limits.

### Changes

- Create `src/lib/token_budget.js`:
  - `estimateTokens(str)` — single implementation of the `chars / 4` heuristic,
    replacing all call-site copies. Can be upgraded to a proper tokenizer later
    without touching callers.
  - `fitToTokens(str, budget, policy)` — single truncation entry point. `policy`
    is one of:
    - `'tail'` — current default, truncates from the end
    - `'line-boundary'` — cuts at the last `\n` before the limit (the smarter
      variant already in `ai_prompt_builder.js`)
    - `'skip'` — returns `null` if the content does not fit; caller decides
      whether to omit or note the absence
  - Named budget constants replacing the hardcoded magic numbers:
    `DEFAULT_PER_FILE_TOKENS`, `DEFAULT_TOTAL_TOKENS`, etc.

- Remove the `5 000` char cap from `step_06_test_review.js:504` and the `4 000`
  char cap from `ai_prompt_builder.js:984`. Both delegate to `fitToTokens`.

### Acceptance criteria

- A single test file in `test/lib/token_budget.test.js` covers all three
  policies and the estimator.
- No other file contains a `/4` token estimation expression or a hardcoded
  per-file character limit.

---

## Phase 2 — Introduce the `Artifact` domain model

**Goal:** preserve file metadata until the last moment so downstream decisions
(prioritization, truncation policy selection, manifest generation) can use it.

### Changes

- Define the `Artifact` shape:

  ```js
  {
    path: string,        // relative path
    content: string,     // raw file content
    language: string,    // derived from extension
    byteSize: number,
    isModified: boolean, // from git diff --name-only
    priority: number,    // 0 = highest
  }
  ```

- Create `src/lib/artifact_repository.js`:
  - `loadArtifacts(paths, modifiedFiles) → Artifact[]` — the only module that
    calls `fs.readFileSync` for prompt context; returns sorted artifacts
  - Wires `sortByPriority` from `step10_partition_cache.js` so callers always
    receive artifacts in priority order: modified first, then unreviewed, then
    lowest quality

- Update `step_06_test_review.js` to call `ArtifactRepository.loadArtifacts`
  instead of its current inline file-reading loop (lines 497–510). The step no
  longer owns collection or ordering.

### Acceptance criteria

- `step_06` contains no `fs.readFileSync` calls.
- Modified test files appear before unmodified ones in the assembled context.

---

## Phase 3 — Per-slot budget allocation via `EvidenceSlot`

**Goal:** give each named section of a prompt its own declared budget so overflow
is predictable and isolated rather than a function of insertion order.

### Changes

- Define the `EvidenceSlot` shape:

  ```js
  {
    name: string,
    artifacts: Artifact[],
    tokenBudget: number,   // absolute token count for this slot
    policy: 'tail' | 'line-boundary' | 'skip',
  }
  ```

- Create `src/lib/context_assembler.js` with `assemble(slots) → ReviewContext`:
  - Fills each slot in declaration order, fitting as many full artifacts as
    possible before truncating the last one that partially fits
  - Any artifact that cannot fit at all is recorded as **absent** in the manifest
    (not silently dropped)
  - Returns a `ReviewContext` that carries both the assembled text and a
    completeness manifest (see Phase 4)

- `step_06` declares its slots explicitly rather than using a single global
  budget:
  ```js
  [
    { name: 'primary_test_files', budget: 0.7, policy: 'line-boundary' },
    { name: 'config_files', budget: 0.15, policy: 'skip' },
    { name: 'project_context', budget: 0.15, policy: 'tail' },
  ];
  ```
  Percentages are resolved to token counts by `ContextAssembler` against the
  step's declared total budget.

### Acceptance criteria

- Removing the largest test file from a fixture set does not change which other
  files appear or their order.
- An artifact that exceeds its slot budget appears in the manifest as `absent`,
  not as a truncated entry with empty content.

---

## Phase 4 — Surface the completeness manifest in the prompt

**Goal:** give the AI explicit, structured knowledge of what evidence is missing
so it can calibrate confidence without relying on `(truncated)` markers buried
inside code fences.

### Changes

- `ReviewContext` exposes a completeness manifest:

  ```js
  [
    { slot: 'primary_test_files', file: 'src/__tests__/orchestrator.test.ts', status: 'full' },
    {
      slot: 'primary_test_files',
      file: 'src/__tests__/step_registry.test.ts',
      status: 'truncated',
      includedLines: 312,
      totalLines: 489,
    },
    {
      slot: 'primary_test_files',
      file: 'src/__tests__/generic_step_registry.test.ts',
      status: 'full',
    },
    { slot: 'primary_test_files', file: 'src/__tests__/index.test.ts', status: 'absent' },
  ];
  ```

- `ContextAssembler` serialises the manifest as a structured preamble injected
  via a new `{evidence_manifest}` placeholder before the file-contents block:

  ```
  **Evidence completeness (3 of 4 files fully included):**
  - src/__tests__/orchestrator.test.ts             — full
  - src/__tests__/step_registry.test.ts            — truncated (line 312 of 489)
  - src/__tests__/generic_step_registry.test.ts    — full
  - src/__tests__/index.test.ts                    — absent (exceeded slot budget)
  ```

- Update the YAML note in `workflow_steps.yaml` (step_06 block) to reference the
  manifest format:
  - `truncated` status → conclusions about the visible portion are valid;
    execution-risk conclusions are **inconclusive**
  - `absent` status → all conclusions about that file are **unavailable**

### Acceptance criteria

- A prompt generated from a fixture where one file exceeds the budget contains
  the manifest preamble with the correct `absent` entry.
- The YAML note no longer relies on detecting the string `(truncated)` in code
  fences.

---

## Phase 5 — Continuation prompting for overflow artifacts

**Goal:** recover full coverage for large files without raising the per-prompt
token limit.

### Changes

- When `ReviewContext` contains `absent` or heavily-truncated artifacts, the
  step scheduler creates follow-up slices automatically — same YAML template,
  different slot contents populated from the overflow set.

- Add `src/lib/review_synthesizer.js`:
  - Merges results from multiple slices for the same step
  - Deduplicates signals that appear in more than one slice
  - Labels each finding with the slice index it came from

- The orchestrator marks a step complete only when all declared artifact slots
  have reached `full` or `truncated` status (no remaining `absent` entries) or
  when the step explicitly opts out of continuation.

### Acceptance criteria

- A test suite with a file large enough to be absent from the first slice
  receives its own dedicated slice and its findings appear in the merged output.
- A step that opts out of continuation (`continuation: false`) completes after
  the first slice regardless of absent artifacts.

---

## Dependency Order

```
Phase 1 — TokenBudget
    └── Phase 2 — Artifact + ArtifactRepository
            └── Phase 3 — EvidenceSlot + ContextAssembler
                    ├── Phase 4 — completeness manifest in prompt
                    └── Phase 5 — continuation slicing + ReviewSynthesizer
```

Phases 1 and 2 are pure refactors with no user-visible change. Phase 3 is the
first change that affects which content gets truncated. Phases 4 and 5 improve
response quality directly. Each phase is independently shippable and testable.
