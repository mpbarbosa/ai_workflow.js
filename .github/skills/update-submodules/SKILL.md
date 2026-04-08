---
name: update-submodules
description: >
  Update all git submodule folders and sync them with this project using git pull.
  Use this skill when asked to update, sync, refresh, or pull the latest changes
  for submodules, or when .workflow_core or .workflow_fspec are out of date.
---

# update-submodules

## Overview

This project has two git submodules:

- `.workflow_core` — shared workflow configuration templates
  (`https://github.com/mpbarbosa/ai_workflow_core.git`)
- `.workflow_fspec` — functional specification
  (`https://github.com/mpbarbosa/ai_workflow_fspec.git`)

This skill re-syncs submodule URLs, initialises any uninitialised submodules,
and pulls the latest commit from each submodule's configured remote.

## Execution steps

Run each command in sequence from the repository root. If any step fails,
report the error and stop.

### Step 1 — Sync submodule URLs

Ensure `.git/config` reflects the latest URLs from `.gitmodules`:

```bash
git submodule sync --recursive
```

### Step 2 — Check for unpushed local commits (safety check)

Before resetting submodule checkouts, check whether any submodule has local
commits that are ahead of the parent-pinned pointer and have not been pushed.
If such commits exist, **warn the user** and ask whether to proceed, because
Step 3 will orphan them.

```bash
git submodule foreach --recursive "git log HEAD..origin/main --oneline 2>/dev/null || true"
```

If this shows commits, ask the user: "Submodule <name> has local unpushed
commits. Proceeding will orphan them. Continue? (y/n)"

Stop if the user answers no.

### Step 3 — Initialise and update submodule checkouts

Fetch the commits recorded in the parent repo and check them out:

```bash
git submodule update --init --recursive
```

### Step 4 — Pull the latest remote commits

After `update --init`, submodules are in **detached HEAD** state, so plain
`git pull` always fails. Checkout the default branch first, then pull:

```bash
git submodule foreach --recursive "git pull origin main"
```

> **Note:** If a submodule tracks a branch other than `main`, substitute
> that branch name accordingly.

### Step 5 — Show the result

Display the final submodule state so the user can confirm everything is current:

```bash
git submodule status --recursive
```

## Expected output

Each submodule line in `git submodule status` output begins with a space
(checked-out at the recorded commit) or `+` (ahead of the recorded commit
after the pull). A `-` prefix means the submodule is still uninitialised and
the update failed.

## After updating

If any submodule has advanced to a new commit, the parent repo will show an
unstaged change to the submodule path. Optionally stage and commit with:

```bash
git add .workflow_core .workflow_fspec
git commit -m "chore: update submodules to latest"
```

Ask the user whether to commit before doing so.

## Related files

- `.gitmodules` — declares submodule names, paths, and remote URLs
- `.workflow_core/` — ai_workflow_core shared configuration templates
- `.workflow_fspec/` — functional specification submodule
