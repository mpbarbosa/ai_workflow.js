# Bug Fix: `workflowDir` Resolved Against CWD Instead of `projectRoot`

**Date**: 2026-02-21
**Severity**: High — workflow artifacts written to wrong project directory
**Component**: `src/orchestrator/main_orchestrator.js` — `MainOrchestrator` constructor
**Status**: ✅ Fixed

---

## Symptom

When the CLI is invoked from the `ai_workflow.js` repository to run a workflow against
a different target project (e.g. `onde_estou_backend`), all workflow artifacts
(logs, checkpoints, summaries) were created inside the `ai_workflow.js` working
directory instead of inside the target project directory.

**Example**: running a workflow with `--projectRoot /home/mpb/Documents/GitHub/onde_estou_backend`
while CWD is `/home/mpb/Documents/GitHub/ai_workflow.js` produced:

```
❌ /home/mpb/Documents/GitHub/ai_workflow.js/.ai_workflow/logs/workflow_20260221_172249/
✅ /home/mpb/Documents/GitHub/onde_estou_backend/.ai_workflow/logs/workflow_20260221_172249/
```

---

## Root Cause

In the `MainOrchestrator` constructor, `workflowDir` was stored as the raw option value
without being resolved against `projectRoot`:

```js
// BEFORE (buggy)
this.workflowDir = options.workflowDir || '.ai_workflow'; // relative string
this.projectRoot = options.projectRoot || process.cwd();
```

Because `workflowDir` was a relative string (`.ai_workflow`), every downstream
`path.join(this.workflowDir, ...)` call resolved the path against Node.js's
**current working directory** — the directory the CLI was started from — rather
than against the **target project root** passed by the user.

Affected downstream calls (all in `main_orchestrator.js`):

| Line | Expression                                   | Effect                               |
| ---- | -------------------------------------------- | ------------------------------------ |
| 534  | `path.join(this.workflowDir, 'logs', runId)` | Logs written to wrong project        |
| 281  | `new CheckpointManager(this.workflowDir)`    | Checkpoints written to wrong project |
| 286  | `new WorkflowSummary(this.workflowDir)`      | Summaries written to wrong project   |
| 566  | `new CommitHistory({ workflowDir })`         | History written to wrong project     |

---

## Fix

Resolve `workflowDir` to an absolute path in the constructor, **after** `projectRoot`
is determined and using `projectRoot` as the base:

```js
// AFTER (fixed)
this.projectRoot = options.projectRoot || process.cwd();
const rawWorkflowDir = options.workflowDir || '.ai_workflow';
this.workflowDir = path.isAbsolute(rawWorkflowDir)
  ? rawWorkflowDir
  : path.join(this.projectRoot, rawWorkflowDir);
```

**Key details:**

- `projectRoot` is resolved **first** so it can be used as the base for `workflowDir`.
- Absolute `workflowDir` values (used by tests) are kept as-is.
- Relative `workflowDir` values (the common production case) are anchored to
  `projectRoot`, not to `process.cwd()`.

### Files Changed

| File                                          | Change                                                                                               |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `src/orchestrator/main_orchestrator.js`       | Reorder `projectRoot`/`workflowDir` assignment; resolve relative `workflowDir` against `projectRoot` |
| `test/orchestrator/main_orchestrator.test.js` | Use absolute `testDir`; update default `workflowDir` expectation to resolved absolute path           |

---

## Test Updates

Two expectations in `test/orchestrator/main_orchestrator.test.js` required updating:

1. **`testDir` constant** — changed from a bare relative string to an absolute path
   so that tests no longer inadvertently rely on CWD resolution:

   ```js
   // BEFORE
   const testDir = '.test_orchestrator';

   // AFTER
   const testDir = path.join(process.cwd(), '.test_orchestrator');
   ```

2. **Default `workflowDir` assertion** — now reflects the resolved absolute path:

   ```js
   // BEFORE
   expect(orchestrator.workflowDir).toBe('.ai_workflow');

   // AFTER
   expect(orchestrator.workflowDir).toBe(path.join(process.cwd(), '.ai_workflow'));
   ```

---

## Manual Remediation

The log folder created during the affected run was moved to its correct location:

```
mv ai_workflow.js/.ai_workflow/logs/workflow_20260221_172249 \
   onde_estou_backend/.ai_workflow/logs/
```

---

## Prevention

- `workflowDir` is now always an absolute path after construction. Any future
  `path.join(this.workflowDir, ...)` calls are guaranteed to land inside the
  correct project directory regardless of CWD.
- Tests use absolute `testDir` values, preventing the same CWD-sensitivity in
  the test suite itself.
