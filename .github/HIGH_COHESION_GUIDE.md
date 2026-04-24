# High Cohesion Guide

High cohesion is mandatory for projects with code files in this workflow ecosystem.

## Goal

Each module, class, function, and script should have a single, well-focused responsibility. Related behavior should stay together; unrelated behavior should be split into separate units with clear boundaries.

## Required rules

1. A file should center on one primary concern.
2. A function should do one job and expose one clear reason to change.
3. Configuration, orchestration, parsing, persistence, UI, and domain logic should not be mixed unless the file exists specifically to compose them.
4. Utility modules must not become catch-all dumping grounds for unrelated helpers.
5. Shared abstractions must be introduced only when responsibilities are genuinely shared, not merely similar by name.

## Positive signals

- File names match the responsibility they implement.
- Public APIs are small and intention-revealing.
- Helper functions support the same main concern as the file they live in.
- Tests for a module cluster around a single behavior area.

## Warning signs

- One file edits config, performs I/O, formats output, and contains business rules.
- A function both decides policy and performs multiple kinds of side effects.
- `utils` or `helpers` modules accumulate unrelated responsibilities.
- A file requires large section comments to explain why unrelated logic lives together.

## Preferred fixes

1. Extract unrelated responsibilities into narrowly named modules.
2. Keep composition in entry points and keep business rules in reusable library code.
3. Move formatting, transport, persistence, and orchestration logic to their own layers.
4. Rename files and symbols so their single responsibility is explicit.
