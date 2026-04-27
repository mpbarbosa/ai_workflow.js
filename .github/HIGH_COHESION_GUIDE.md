# High Cohesion Guide

High cohesion is a core design rule for `ai-workflow`.

This repository spans CLI commands, orchestrator flows, reusable library
modules, workflow steps, and contributor-facing documentation. Keeping each
component focused on one primary responsibility makes changes safer for both
human contributors and LLM-assisted edits.

## Goal

Each module, class, function, document, and script should have one clear
responsibility. Related behavior should stay together. Unrelated behavior should
be split into separate units with explicit boundaries.

## What High Cohesion Means

High cohesion means the parts inside a component naturally belong together and
support the same purpose.

A cohesive component is easy to describe in one sentence:

- "This module parses workflow logs."
- "This document defines review criteria."
- "This function normalizes repository paths."

If the best description needs repeated "and", the responsibility is probably too
broad.

## Why It Matters

1. It makes components easier to understand.
2. It keeps changes localized.
3. It improves reuse because responsibilities are explicit.
4. It makes testing and review simpler.
5. It reduces accidental coupling between unrelated concerns.

## High Cohesion and Code LLMs

High cohesion also improves the quality of LLM-assisted coding.

Code-focused models work best when the intent of a file, function, or document
is easy to infer from local context. When one component has one job, an LLM can
usually understand it faster, retrieve the right context more reliably, and make
more precise edits with fewer accidental side effects.

This does not replace normal engineering discipline. It means high cohesion is
useful twice: it helps humans reason about the system, and it helps code models
operate on the system more safely.

### Why LLMs Benefit

- Focused modules make intent clearer.
- Clear boundaries reduce hidden dependencies.
- Grouped related logic improves context retrieval.
- Localized responsibilities make refactoring safer.
- Single-purpose APIs make incorrect assumptions less likely.

### Where Low Cohesion Hurts LLMs

- Mixed responsibilities blur the real purpose of the code.
- Generic helper files encourage broad, imprecise edits.
- One change can affect several unrelated behaviors at once.
- The model may miss side effects because they are scattered across concerns.

## Required Rules

1. A file should center on one primary concern.
2. A function should do one job and expose one clear reason to change.
3. Parsing, validation, orchestration, persistence, formatting, UI, and domain
   logic should not be mixed unless a file exists specifically to compose them.
4. Utility modules must not become dumping grounds for unrelated helpers.
5. Shared abstractions should be introduced only when responsibilities are
   genuinely shared, not just similar by name.
6. Documents should cover one topic and link to related guides instead of
   duplicating them.
7. Entry points may compose multiple concerns, but reusable code beneath them
   should remain narrowly focused.

## Positive Signals

- File names match the responsibility they implement.
- Public APIs are small and intention-revealing.
- Helper functions directly support the file's main concern.
- A module's tests cluster around one behavior area.
- A document can be scanned quickly without shifting between unrelated topics.
- Changes to one behavior rarely require edits to distant, unrelated files.

## Warning Signs

- One file edits config, performs I/O, formats output, and contains business
  rules.
- A function both decides policy and performs several different side effects.
- `utils`, `helpers`, or `manager` modules accumulate unrelated responsibilities.
- A document mixes tutorial, reference, architecture, troubleshooting, and
  release notes in one place.
- A file needs large section comments to justify why unrelated logic lives
  together.
- Naming becomes generic because the component does too many things.

## Applying Cohesion by Component Type

| Component type | Cohesive responsibility |
| --- | --- |
| Domain module | Business rules and invariants for one area |
| Parser/transformer | Convert one input shape into one output shape |
| Persistence adapter | Read/write through one storage boundary |
| Transport adapter | Talk to one external protocol or service |
| UI/view module | Render or coordinate one user-facing area |
| Entry point | Compose focused modules without owning all their logic |
| Documentation file | Explain one concept, workflow, or reference area |

Keep new code and new documents in the narrowest layer that matches their real
job.

## Best Practices

### When Creating a New File

1. Define the single purpose before naming it.
2. Keep helper logic only if it supports that purpose directly.
3. Move unrelated side effects behind adapters or composition layers.
4. Prefer specific names over generic containers.

### When Creating Functions or Classes

1. Make inputs and outputs reflect one responsibility.
2. Separate policy decisions from transport or persistence details.
3. Avoid methods that fetch data, transform it, format it, and publish it in one
   pass.
4. Split behavior when callers need unrelated subsets of the API.
5. Prefer boundaries that let both humans and tools understand the purpose of a
   component from nearby context.

### When Writing Documentation

1. Keep one topic per document.
2. Use cross-references instead of repeating the same guidance across files.
3. Separate how-to guides, reference material, architecture notes, and checklists
   when they grow independently.
4. Name documents so readers can predict their contents without opening them.

## Refactoring for Higher Cohesion

When a component grows unclear or difficult to name, refactor around distinct
responsibilities.

1. List everything the component currently does.
2. Group behavior by the data it owns or the decision it makes.
3. Split unrelated groups into narrowly named modules or documents.
4. Leave composition in entry points and keep reusable rules in focused units.
5. Rename files and symbols so the single responsibility is obvious.
6. Re-check that each extracted piece can be described in one sentence.

## Review Heuristics

### One-Sentence Test

Can the component's purpose be described in one clear sentence without "and",
"also", or "plus"?

### Change-Impact Test

If one behavior changes, do unrelated parts need to change too? If yes, cohesion
is probably weak.

This matters even more in LLM-assisted work: low-impact, localized edits are much
safer for automated or semi-automated code changes.

### Naming Test

If the best name is vague, the responsibility likely is too.

### Split Test

If the component can be split into two focused parts without awkward surgery, it
may already contain multiple responsibilities.

## Preferred Fixes

1. Extract unrelated responsibilities into narrowly named modules.
2. Keep composition in entry points and business rules in reusable library code.
3. Move formatting, transport, persistence, and orchestration into their own
   layers.
4. Replace generic helper buckets with purpose-specific modules.
5. Split broad documents into focused guides with clear cross-links.

## Summary Checklist

- [ ] The file or document has one primary concern.
- [ ] The name matches the responsibility.
- [ ] Helpers support the same concern as the parent component.
- [ ] Side effects are separated from policy where practical.
- [ ] Unrelated behaviors are not hidden behind a generic API.
- [ ] The component passes the one-sentence test.
- [ ] The topic would still make sense if read in isolation.
- [ ] A reviewer or code-focused LLM could infer the component's purpose from its
  local context.
