# Low Coupling Guide

Low coupling is mandatory for projects with code files in this workflow ecosystem.

## Goal

Modules should depend on as few other modules, layers, and global states as practical. Dependencies should be explicit, stable, and directed through clear interfaces.

## Required rules

1. Depend on the narrowest stable abstraction available.
2. Keep dependency direction aligned with the project architecture.
3. Avoid hidden coupling through globals, mutable shared state, ambient configuration, or implicit filesystem conventions.
4. Entry points may compose multiple modules, but reusable modules should not reach across unrelated layers.
5. Tests should not require broad fixture setup when only one focused dependency is needed.

## Positive signals

- Dependencies are injected or imported for a clear reason.
- Call chains are easy to trace.
- Public interfaces are small and stable.
- A change in one module rarely forces edits in distant modules.

## Warning signs

- Modules import across layers for convenience.
- Helpers know too much about callers, storage, transport, and presentation details.
- Shared mutable state coordinates unrelated components.
- Refactors require synchronized edits across many files with no clear boundary.

## Preferred fixes

1. Introduce clear interfaces at layer boundaries.
2. Move composition to top-level orchestrators and keep leaf modules focused.
3. Replace hidden shared state with explicit inputs, outputs, or scoped context objects.
4. Split modules that both own logic and manage many external dependencies.
