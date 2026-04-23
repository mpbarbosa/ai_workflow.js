---
name: update-olinda-copilot-sdk
description: >
  Update the olinda_copilot_sdk.ts dependency in ai_workflow.js to the latest
  (or a specified) release. Use this skill when asked to bump, upgrade, or
  refresh olinda_copilot_sdk.ts, or when the update-olinda-copilot-sdk GitHub
  Actions workflow needs to be triggered, debugged, or explained.
---

# update-olinda-copilot-sdk

## Overview

`olinda_copilot_sdk.ts` is consumed by this project via its GitHub tarball CDN
URL stored in `package.json`. A dedicated GitHub Actions workflow handles the
update process end-to-end.

## Workflow location

```text
.github/workflows/update-olinda-copilot-sdk.yml
```

## What the workflow does

1. **Resolve version** — queries the GitHub API for the latest
   `olinda_copilot_sdk.ts` release tag (or uses the `version` input if provided
   via `workflow_dispatch`).
2. **Early-exit guard** — compares the resolved tag against the tarball URL
   already in `package.json`; skips the rest if already up to date.
3. **Update `package.json`** — replaces the old tarball URL with the new one.
4. **Install dependencies** — runs a targeted
   `npm install "olinda_copilot_sdk.ts@<url>"` to keep the lockfile
   deterministic.
5. **Lint** — runs ESLint (`npm run lint`) to catch issues introduced by the
   new version.
6. **Run tests** — runs the full Jest suite to confirm nothing regressed.
7. **Adjust related code** — `sed`-replaces old version strings in `src/`.
8. **Update documentation** — replaces old tarball URLs and version strings in
   all `*.md` files (single-pass, guarded by pre-check grep).
9. **Adjust related tests** — replaces old version strings in `test/` and
   `__tests__/`, then re-runs only the affected test files.
10. **Open pull request** — uses `peter-evans/create-pull-request` to open
    (or update) a PR on branch `chore/update-olinda-copilot-sdk-ts-<version>`.

## How to trigger manually

```shell
gh workflow run update-olinda-copilot-sdk.yml --field version=v0.5.1
```

Leave `version` blank to use the latest published release.

## Idempotency guarantees

- A `concurrency` group (`update-olinda-copilot-sdk-ts`) prevents simultaneous
  runs from racing on the same PR branch.
- The early-exit guard in step 2 ensures no changes are committed if the
  dependency is already at the target version.
- `peter-evans/create-pull-request` updates an existing PR rather than opening
  a duplicate.

## Tarball URL pattern

```text
https://github.com/mpbarbosa/olinda_copilot_sdk.ts/archive/refs/tags/<TAG>.tar.gz
```

## Related files

- `.github/workflows/update-olinda-copilot-sdk.yml` — the full workflow
  definition
- `package.json` — contains the `olinda_copilot_sdk.ts` tarball URL dependency
