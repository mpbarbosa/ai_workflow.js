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
commits that are ahead of the remote and have not been pushed.
If such commits exist, **warn the user** and ask what to do, because
Step 3 will orphan them.

Use `--no-pager` to prevent the output from opening an interactive pager:

```bash
git --no-pager submodule foreach --recursive \
  "git --no-pager log origin/main..HEAD --oneline 2>/dev/null || true"
```

> **Important:** the range is `origin/main..HEAD` (not `HEAD..origin/main`).
> `origin/main..HEAD` lists commits that exist locally but not on the remote —
> exactly the commits that Step 3 would orphan. The reversed form checks the
> opposite direction (remote-ahead of local) and gives a false "safe" signal
> when local work is ahead.

If this shows commits for any submodule, present **three options** to the user:

1. **Push first, then continue** — push the unpushed commits to the remote
   (`git push origin main` inside the submodule), then proceed with Step 3.
   This is the safe default when the commits are intentional local work.
2. **Skip push and continue anyway** — proceed with Step 3 immediately.
   The local commits will be orphaned (detached, unreachable after the
   checkout is reset). Only choose this if the commits are truly disposable.
3. **Abort** — stop here without making any changes.

Stop if the user chooses option 3.

### Step 3 — Initialise and update submodule checkouts

Fetch the commits recorded in the parent repo and check them out:

```bash
git submodule update --init --recursive
```

### Step 4 — Pull the latest remote commits

After `update --init`, submodules are in **detached HEAD** state, so plain
`git pull` always fails. Checkout the default branch first, then pull:

```bash
git submodule foreach --recursive "git checkout main && git pull origin main"
```

> **Note:** If a submodule tracks a branch other than `main`, substitute
> that branch name accordingly.

### Step 5 — Show the result

Display the final submodule state so the user can confirm everything is current:

```bash
git submodule status --recursive
```

### Step 6 — Commit updated submodule pointers

If any submodule line from Step 5 is prefixed with `+` (the checked-out commit
is ahead of what the parent repo has recorded), stage and commit the pointer
update:

```bash
git add .workflow_core .workflow_fspec
git commit -m "chore: update submodules to latest

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

Use the actual short SHAs and commit subjects from `git submodule status` to
make the message more descriptive, e.g.:

```
chore: update .workflow_core submodule to <sha>

Points to <commit subject>

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

If no submodule shows `+`, the parent repo is already up to date and this step
can be skipped.

## Expected output

Each submodule line in `git submodule status` output begins with a space
(checked-out at the recorded commit) or `+` (ahead of the recorded commit
after the pull). A `-` prefix means the submodule is still uninitialised and
the update failed.

## Related files

- `.gitmodules` — declares submodule names, paths, and remote URLs
- `.workflow_core/` — ai_workflow_core shared configuration templates
- `.workflow_fspec/` — functional specification submodule
