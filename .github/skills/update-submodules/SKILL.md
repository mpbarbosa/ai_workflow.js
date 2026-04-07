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

### Step 2 — Initialise and update submodule checkouts

Fetch the commits recorded in the parent repo and check them out:

```bash
git submodule update --init --recursive
```

### Step 3 — Pull the latest remote commits

Pull from each submodule's tracked remote branch so it advances to `HEAD`
rather than staying at the pinned parent-repo commit:

```bash
git submodule foreach --recursive git pull
```

> **Note:** If a specific branch is requested (e.g. `main`), use
> `git submodule foreach --recursive "git pull origin main"` instead.

### Step 4 — Show the result

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
