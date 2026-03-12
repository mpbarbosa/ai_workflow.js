# Commit History Schema

**File:** `.ai_workflow/commit_history.json`
**Version:** 1.7.3

## Overview

Tracks which git commits have had the AI workflow executed against them. Used by `auto_commit.js` and `change_detection.js` to determine whether a workflow run is needed for the current HEAD commit, and to avoid re-processing already-processed commits.

## Schema

```json
{
  "version": "1.0.0",
  "lastRunCommit": "<git-sha>",
  "runs": [
    {
      "hash": "<git-sha>",
      "runId": "<workflow-run-id>",
      "timestamp": "<ISO-8601>"
    }
  ]
}
```

## Fields

### Root

| Field           | Type     | Required | Description                                                         |
| --------------- | -------- | -------- | ------------------------------------------------------------------- |
| `version`       | `string` | Yes      | Schema version (semver). Current: `"1.0.0"`.                        |
| `lastRunCommit` | `string` | Yes      | Full SHA-1 of the most recent commit that completed a workflow run. |
| `runs`          | `array`  | Yes      | Ordered list of all recorded workflow runs (oldest first).          |

### `runs[]` entries

| Field       | Type     | Required | Description                                                             |
| ----------- | -------- | -------- | ----------------------------------------------------------------------- |
| `hash`      | `string` | Yes      | Full 40-character git SHA-1 of the commit at the time of the run.       |
| `runId`     | `string` | Yes      | Unique workflow run identifier — format `workflow_<unix-ms-timestamp>`. |
| `timestamp` | `string` | Yes      | ISO 8601 UTC timestamp when the run was recorded.                       |

## Notes

- Multiple runs may share the same `hash` if the workflow was re-run on the same commit.
- `lastRunCommit` always reflects the `hash` from the most recently appended entry.
- This file is written by the workflow engine and should not be edited manually.
- Stored under `.ai_workflow/` which is gitignored by default.

## Related

- `src/lib/auto_commit.js` — writes entries after successful artifact commits
- `src/lib/change_detection.js` — reads `lastRunCommit` to detect new changes
