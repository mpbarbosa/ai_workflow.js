# `.test-e2e`

This directory holds temporary end-to-end test workspaces created during local
and CI test runs. Its contents are disposable and are intentionally ignored by
git, except for this README.

Common subdirectory patterns:

- `detect-<timestamp>-<suffix>/` - project-detection scratch workspaces
- `step-02-<timestamp>-<suffix>/` - temporary step 02 test projects
- `step-02-artefacts-<timestamp>-<suffix>/` - captured outputs from step 02 test
  runs

These folders are safe to delete when no test run is using them.
