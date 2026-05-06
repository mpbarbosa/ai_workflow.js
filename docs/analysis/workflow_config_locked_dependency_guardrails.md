# Workflow Config Locked-Dependency Guardrails

## Problem

`ai_workflow.js` already validates `.workflow-config.yaml` before any workflow steps run, but a historical failure showed an authoring pitfall:

- `step_11` remained enabled
- `step_13` was disabled
- the config used `dependency_comment` as if it could bypass `step_11 <- step_13`
- the config also tried to move `step_17` ahead of later review branches and then hang `step_22` / `step_23` off the summary step

That pattern is invalid. `step_11 <- step_13` is a locked canonical dependency, so preflight restores `step_13` into the effective dependency set and rejects the plan before execution starts.

## Why this fails

Some dependency overrides are allowed when they remove optional or explicitly disabled branches. Locked canonical edges are different:

- `step_09 <- step_08`
- `step_10 <- step_09`
- `step_11 <- step_13`
- `step_0f <- step_17`
- `step_12 <- step_0f`

`dependency_comment` documents an intentional override. It does **not** remove those locked prerequisites.

The summary/finalization tail has an additional rule: `step_17 -> step_0f -> step_12` stays terminal. Review branches such as `step_22` and `step_23` must feed into `step_17`; they cannot run after it.

## Important self-skip detail

The lint/context branch is easy to misconfigure because two upstream steps already degrade safely when tooling is missing:

- `step_10` returns a skipped success when no linter is configured
- `step_13` returns a skipped success when `mdl` is not installed

That means "lint tooling is missing" is usually **not** a reason to disable `step_10` or `step_13`. Keeping them enabled preserves the valid execution graph and lets the workflow report an honest skipped result instead of failing preflight.

## Safe configuration patterns

### Preferred: keep the lint branch enabled

```yaml
- id: '10'
  enabled: true

- id: '13'
  enabled: true

- id: '11'
  enabled: true
```

If lint tooling is unavailable, the runtime records skipped results for the lint steps and the downstream branch remains valid.

### Allowed: disable the whole downstream branch

If you intentionally want to remove the lint/context branch, disable the full dependent closure rather than only the locked prerequisite:

```yaml
- id: '13'
  enabled: false

- id: '11'
  enabled: false

- id: '15'
  enabled: false

- id: '19'
  enabled: false

- id: '20'
  enabled: false

- id: '22'
  enabled: false

- id: '23'
  enabled: false

- id: '17'
  enabled: false

- id: '0f'
  enabled: false

- id: '12'
  enabled: false
```

Use that shape only when you are intentionally removing the whole branch. Do not mix an excluded locked prerequisite with enabled dependents.

### Preferred: keep the summary tail terminal

For full-stage runs, treat `step_17`, `step_0f`, and `step_12` as the terminal chain. If you omit review branches like `step_11_6`, `step_20`, or `step_23` from a custom `workflow.steps` list, either disable `step_17` too or rewrite its dependency set with an evidence-bound `dependency_comment` that matches the still-enabled branches.

## What changed

The preflight dependency validator now adds a branch-specific remediation hint for the historical lint/context failure mode. When `step_11` is enabled while `step_13` is disabled, the error tells users to re-enable `step_10` and `step_13` if the only reason was missing lint tooling, because those steps already self-skip safely.

It also logs raw-vs-effective dependency diagnostics before aborting, so historical runs are easier to debug when canonical enforcement adds or removes prerequisites during preflight.

## Disabled steps and dependency_comment

A common authoring mistake is assuming that a `dependencies` override on a disabled step is harmless because the step will never execute. The validator enforces documentation parity regardless of `enabled` state.

If a disabled step has a non-canonical `dependencies` list without `dependency_comment`, preflight aborts with:

```
[WorkflowConfig] Step step_16 (Version Update) overrides canonical dependencies without
dependency_comment. ... The step is disabled in .workflow-config.yaml, but disabled steps
still require dependency_comment when they override canonical dependencies.
```

The cleanest fix for a disabled step is to remove the `dependencies` key entirely. Canonical dependencies apply but never run:

```yaml
# before (fails preflight — non-canonical dependency, no comment)
- id: '16'
  enabled: false
  dependencies:
    - step_15

# after (correct — no dependencies key; canonical step_03 applies but never executes)
- id: '16'
  enabled: false
```

If you need to document a deliberate ordering choice for future maintainers, keep the non-canonical dependency and add `dependency_comment`:

```yaml
- id: '16'
  enabled: false
  dependencies:
    - step_15
  dependency_comment: "step_03 is canonical; chaining from step_15 to document the disabled passthrough branch."
```

This failure mode is especially easy to introduce when threading a disabled passthrough chain (e.g. `step_15 → step_16 → step_18` all disabled) to show logical sequencing, without noticing that the intermediate steps deviate from their canonical predecessors.

## DEFAULT_TERMINAL_BRANCH prerequisites for step_17

`step_17` (Workflow Summary) aggregates the output of all active review branches. The engine defines a set of default terminal branch prerequisites:

```
step_17 default terminal branch deps: step_03, step_11_6, step_20, step_23
```

These are re-injected by canonical enforcement **unless the step is explicitly listed as `enabled: false` in `.workflow-config.yaml`**. This is different from ORDER_LOCKED deps: DEFAULT_TERMINAL_BRANCH deps _can_ be suppressed, but only when the step is in the disabled set — which requires an explicit config entry.

### The absent-from-config pitfall

A `dependency_comment` on `step_17` is not enough to suppress a DEFAULT_TERMINAL_BRANCH prerequisite. The step must also appear in the config with `enabled: false`:

```yaml
# WRONG — step_11_6 mentioned in comment but absent from config entirely
- id: step_17
  enabled: true
  dependencies:
    - step_03
    - step_11
  dependency_comment: "step_11_6 disabled in non-AWS repo"
# step_11_6 not listed anywhere → NOT in disabled set → canonical enforcement re-injects it → preflight fails
```

```yaml
# CORRECT — step_11_6 explicitly disabled; comment on step_17 explains the skip
- id: step_11_6
  enabled: false
  reason: "Not applicable — non-AWS, documentation-only repository"

- id: step_17
  enabled: true
  dependencies:
    - step_03
    - step_11
  dependency_comment: "step_11_6, step_20, step_23 disabled; wired to step_03 and step_11 as the active convergence points"
```

### Contrast with step_20 and step_23

If `step_20` and `step_23` appear in the config as `enabled: false`, canonical enforcement correctly excludes them from re-injection. The same rule applies to `step_11_6`. All three must be listed.

### When the warning fires

When canonical enforcement re-injects a DEFAULT_TERMINAL_BRANCH dep because it is absent from the config, a preflight warning names the step and says:

```
step_11_6 is a default terminal branch prerequisite absent from your config —
add it with 'enabled: false' to suppress this re-injection.
```

If you see this warning and proceed, preflight validation will subsequently fail with a targeted error explaining that `enabled: false` is required, not just a `dependency_comment`.

## Operator takeaway

When a step is observational and already knows how to self-skip, prefer **enabled + skipped result** over **disabled + broken dependency chain**. When disabling a step, either remove its `dependencies` key or document the override with `dependency_comment` — the validator enforces this even for steps that will never run.

For `step_17`'s DEFAULT_TERMINAL_BRANCH prerequisites (`step_11_6`, `step_20`, `step_23`): every step named in `step_17`'s `dependency_comment` must also appear in the config as `enabled: false`. Naming a step only in the comment text does not register it as disabled.
