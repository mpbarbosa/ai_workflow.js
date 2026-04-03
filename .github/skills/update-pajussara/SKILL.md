---
name: update-pajussara
description: >
  Update the pajussara_tui_comp dependency in ai_workflow.js to the latest
  (or a specified) release. Use this skill when asked to bump, upgrade, or
  refresh pajussara_tui_comp, or when the update-pajussara GitHub Actions
  workflow needs to be triggered, debugged, or explained.
---

# update-pajussara

## Overview

`pajussara_tui_comp` is consumed by this project via its GitHub tarball CDN URL
stored in `package.json`. A dedicated GitHub Actions workflow handles the
update process end-to-end.

## Workflow location

```text
.github/workflows/update-pajussara.yml
```

## What the workflow does

1. **Resolve version** — queries the GitHub API for the latest
   pajussara_tui_comp release tag (or uses the `version` input if provided via
   `workflow_dispatch`).
2. **Early-exit guard** — compares the resolved tag against the tarball URL
   already in `package.json`; skips the rest if already up to date.
3. **Update `package.json`** — replaces the old tarball URL with the new one.
4. **Install dependencies** — runs a targeted `npm install "pajussara_tui_comp@<url>"`
   to keep the lockfile deterministic.
5. **Lint** — runs ESLint (`npm run lint`) to catch issues introduced by the
   new version.
6. **Run tests** — runs the full Jest suite to confirm nothing regressed.
7. **Adjust related code** — `sed`-replaces old version strings in `src/`.
8. **Update documentation** — replaces old tarball URLs and version strings in
   all `*.md` files (single-pass, guarded by pre-check grep).
9. **Adjust related tests** — replaces old version strings in `test/` and
   `__tests__/`, then re-runs only the affected test files.
10. **Open pull request** — uses `peter-evans/create-pull-request` to open
    (or update) a PR on branch `chore/update-pajussara-tui-comp-<version>`.

## How to trigger manually

```shell
gh workflow run update-pajussara.yml --field version=v1.2.0
```

Leave `version` blank to use the latest published release.

## Idempotency guarantees

- A `concurrency` group (`update-pajussara-tui-comp`) prevents simultaneous
  runs from racing on the same PR branch.
- The early-exit guard in step 2 ensures no changes are committed if the
  dependency is already at the target version.
- `peter-evans/create-pull-request` updates an existing PR rather than opening
  a duplicate.

## Tarball URL pattern

```text
https://github.com/mpbarbosa/pajussara_tui_comp/archive/refs/tags/<TAG>.tar.gz
```

## Related files

- `.github/workflows/update-pajussara.yml` — the full workflow definition
- `package.json` — contains the `pajussara_tui_comp` tarball URL dependency
