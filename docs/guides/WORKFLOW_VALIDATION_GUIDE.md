# Workflow Execution Validation Guide

**Version:** 1.0.0  
**Last Updated:** 2026-02-21  
**Applies to:** ai_workflow.js v1.2.0+

This guide documents the process for validating a workflow execution run. It was formalized from the analysis of run `workflow_20260220_210720` and is designed to be reusable for future validations.

---

## Table of Contents

1. [Overview](#overview)
2. [Validation Criteria](#validation-criteria)
3. [Log Folder Structure](#log-folder-structure)
4. [Step-by-Step Validation Process](#step-by-step-validation-process)
5. [Persona Registry](#persona-registry)
6. [Which Steps Call AI](#which-steps-call-ai)
7. [Common Failure Patterns](#common-failure-patterns)
8. [Validation Checklist Template](#validation-checklist-template)

---

## Overview

Each workflow run produces a timestamped log folder under `.ai_workflow/logs/`. A complete validation confirms that every registered step:

- Was actually invoked and completed
- Left a log file behind
- Used the AI persona/prompt configured in the YAML files (when applicable)
- Saved the AI response to the `prompts/` folder (when applicable)

---

## Validation Criteria

| #      | Criterion               | What to Check                                                                                                                            |
| ------ | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **C1** | Step executed?          | `workflow.log` contains `Executing step: <name> (<id>)` and `✓ Step <id> completed`                                                      |
| **C2** | Log file created?       | File `steps/<step_id>.log` exists and is non-empty                                                                                       |
| **C3** | Correct prompt/persona? | The persona in the step log matches what is configured in `.workflow-config.yaml` AND corresponds to a registered ID in `ai_personas.js` |
| **C4** | Response saved?         | A file exists under `prompts/<step_id>/` for every AI call made                                                                          |

> **Note:** C3 and C4 only apply to steps that actually trigger an AI call. Steps can legitimately skip AI when preconditions aren't met (no source files, no changed docs, etc.).

---

## Log Folder Structure

```
.ai_workflow/logs/workflow_<YYYYMMDD_HHmmss>/
├── workflow.log          ← Master log: step order, timings, top-level errors
├── steps/
│   ├── step_00.log       ← One file per registered step
│   ├── step_01.log
│   └── ...
└── prompts/
    └── step_01/          ← One subfolder per step that made an AI call
        └── <timestamp>_<seq>_<persona>.md   ← Prompt + response saved here
```

### Reading `workflow.log`

Key patterns to `grep` for:

```bash
# All registered steps
grep "Registered step:" workflow.log

# Step execution order
grep "Executing step:" workflow.log

# Completion (success / warning / failure)
grep -E "(✓ Step|✗ Step|⚠)" workflow.log

# AI calls
grep "\[AI\]" workflow.log
```

### Reading step-level logs

Each `steps/<id>.log` contains only output from that step. Look for:

- `→ Starting:` — step begin marker
- `✓ Step <id> completed in <ms>ms` — successful finish
- `✗` — error/failure
- `[DEBUG] Persona:` — which AI persona was used
- `[AI] SDK call starting` / `[AI] SDK call completed` — AI call boundaries
- `[DEBUG] Prompt logged to:` — file name of saved response

---

## Step-by-Step Validation Process

### 1. Check C1 and C2 in bulk

```bash
LOG_DIR=".ai_workflow/logs/workflow_<run_id>"

# C1: Steps executed
grep "Executing step:" $LOG_DIR/workflow.log

# C2: Log files present
ls $LOG_DIR/steps/

# Cross-check: find any registered step without a log file
comm -23 \
  <(grep "Registered step:" $LOG_DIR/workflow.log | sed 's/.*step: //' | sort) \
  <(ls $LOG_DIR/steps/ | sed 's/\.log//' | sort)
```

### 2. Identify AI calls (C3 and C4)

```bash
# Which steps made AI calls?
grep "\[AI\] SDK call starting" $LOG_DIR/workflow.log

# Which steps saved a response?
ls $LOG_DIR/prompts/

# For each step with an AI call, check the persona used
grep "\[DEBUG\] Persona:" $LOG_DIR/steps/step_01.log
```

### 3. Validate persona against config

For each step that called AI:

1. Note the persona name from `[DEBUG] Persona: <name>` in the step log.
2. Check `.workflow-config.yaml` for the `ai_persona:` configured for that step.
3. Verify the persona ID exists in [`ai_personas.js`](#persona-registry).
4. **All three must match.** Discrepancies indicate a bug (hardcoded persona in step code overriding config, or unregistered persona name).

### 4. Validate saved response (C4)

```bash
# Each AI call should produce one file in prompts/<step_id>/
ls $LOG_DIR/prompts/step_01/
# Expected: <timestamp>_<seq>_<persona>.md

# Read it to verify prompt and response are both present
head -40 $LOG_DIR/prompts/step_01/*.md
```

The saved file must contain:

- `## Prompt` section with the actual text sent
- `## Response` section with the AI reply

---

## Persona Registry

These are the **valid persona IDs** registered in `src/lib/ai_personas.js`. Any other string used as a persona bypasses role/context configuration.

| Persona ID              | Display Name          | Primary Use                             |
| ----------------------- | --------------------- | --------------------------------------- |
| `documentation_expert`  | Documentation Expert  | Step 1 – incremental doc updates        |
| `technical_writer`      | Technical Writer      | Step 0b – bootstrap documentation       |
| `test_engineer`         | Test Engineer         | Steps 6, 7 – test review and generation |
| `code_quality_analyst`  | Code Quality Analyst  | Step 10 – code quality / linting        |
| `git_specialist`        | Git Specialist        | Step 12 – git operations                |
| `ux_analyst`            | UX Analyst            | Step 15 – UX/accessibility analysis     |
| `prompt_engineer`       | Prompt Engineer       | Step 14 – prompt analysis               |
| `security_expert`       | Security Expert       | Security scanning                       |
| `performance_engineer`  | Performance Engineer  | Performance analysis                    |
| `dependency_analyst`    | Dependency Analyst    | Step 9 – dependency validation          |
| `architecture_reviewer` | Architecture Reviewer | Architecture review                     |
| `api_designer`          | API Designer          | API documentation                       |
| `devops_engineer`       | DevOps Engineer       | CI/CD and deployment                    |
| `accessibility_expert`  | Accessibility Expert  | Accessibility audits                    |

### Common Mismatches Found

| Config / Step uses         | Should be               |
| -------------------------- | ----------------------- |
| `documentation_analyst`    | `documentation_expert`  |
| `documentation_specialist` | `documentation_expert`  |
| `consistency_checker`      | `architecture_reviewer` |
| `code_reviewer`            | `code_quality_analyst`  |

---

## Which Steps Call AI

Not every step makes an AI call on every run. The following table documents when AI is expected to be invoked and under what conditions it is skipped.

| Step    | AI Persona              | When AI is triggered                                                 | Common skip reasons           |
| ------- | ----------------------- | -------------------------------------------------------------------- | ----------------------------- |
| step_0b | `technical_writer`      | Project has < threshold doc files                                    | Sufficient docs already exist |
| step_01 | `documentation_expert`  | Changed doc or source files detected                                 | No changed files in scope     |
| step_02 | `architecture_reviewer` | Inconsistencies found (future)                                       | No issues detected            |
| step_06 | `test_engineer`         | Test files exist                                                     | No test files found           |
| step_07 | `test_engineer`         | Source files exist with no tests                                     | No source files found         |
| step_10 | `code_quality_analyst`  | Source files exist with linter configured                            | No source files / no linter   |
| step_14 | `prompt_engineer`       | Project type is `workflow-automation` or `bash-automation-framework` | Non-workflow project kind     |
| step_15 | `ux_analyst`            | Project has UI components                                            | Project kind has no UI        |

All other steps (step_00, step_02_5, step_03, step_04, step_05, step_08, step_09, step_11, step_12, step_0f, step_13, step_16, step_17) do not make AI calls.

---

## Common Failure Patterns

### Pattern 1: Unregistered persona name

**Symptom:**  
`[DEBUG] Persona: documentation_analyst` in the step log, but `documentation_analyst` is not in the registry.

**Root cause:**  
The persona string is hardcoded in the step's source file instead of being read from config. The AI call still executes but without the role/context/approach defined in `ai_prompts_project_kinds.yaml`.

**How to detect:**

```bash
grep "[DEBUG] Persona:" steps/step_01.log | grep -v -f <(grep "^    id:" src/lib/ai_personas.js | sed "s/    id: '//;s/',//")
```

**Fix:** Update the step's source file to use the correct registered persona ID.

---

### Pattern 2: `fileOps` method not found at runtime

**Symptom:**  
`✗ Workflow failed: this.fileOps.<method> is not a function`

**Root cause:**  
The step calls a method (e.g., `directoryExists`, `listFiles`) that does not exist on the `FileOperations` class.

**Available `FileOperations` methods:**

- `exists(path)` — checks if file or directory exists
- `readFile(path)`, `writeFile(path, content)`
- `stat(path)` — full stat object
- `listDirectory(dirPath, options)` — non-recursive listing
- `listDirectoryRecursive(dirPath, options)` — recursive listing with `extensions` and `pattern` filters
- `glob(pattern, options)` — glob-based search
- `copyFile`, `moveFile`, `deleteFile`, `createDirectory`, `deleteDirectory`

**Mapping for common wrong calls:**

| Wrong call                                           | Correct replacement                                    |
| ---------------------------------------------------- | ------------------------------------------------------ |
| `fileOps.directoryExists(path)`                      | `fileOps.exists(path)`                                 |
| `fileOps.listFiles(path, { extensions, recursive })` | `fileOps.listDirectoryRecursive(path, { extensions })` |

---

### Pattern 3: `projectType` shows as `unknown` in step logs

**Symptom:**  
Step log shows `Project type: unknown - analysis skipped` despite step_00 detecting a valid project kind.

**Root cause:**  
The `executionContext.projectType` in `main_orchestrator.js` is set via a broken path (`this.configManager?.config?.project?.kind`) where `configManager.config` is `undefined`.

**Diagnosis:**

```bash
grep "Project type:" steps/step_14.log
grep "project kind" steps/step_00.log
# If step_00 shows a valid kind but step_14 says "unknown", it's a context-passing bug.
```

---

### Pattern 4: Markdown enumeration fails silently

**Symptom:**  
`⚠ Failed to enumerate markdown files` + `No markdown files found` in `step_13.log`.

**Root cause:**  
`fileOps.listFiles()` is called but doesn't exist. The catch block logs a warning and returns empty array, causing the step to complete with no linting done.

---

### Pattern 5: Step skips due to project type mismatch

**Symptom:**  
Step reports skip with reason tied to project type (e.g., step_14 on a `configuration_library` project).

**Whether this is a bug or correct behavior:**

- Expected: step_15 skipping for projects with no UI components ✅
- Expected: step_14 skipping for non-workflow-automation projects ✅ (but log should show actual project type, not "unknown")
- Unexpected: step_14 skipping because projectType is null due to context-passing bug ⚠️

---

## Validation Checklist Template

Copy this checklist for each new validation:

```
## Workflow Validation — Run: workflow_<YYYYMMDD_HHmmss>
Date:
Project:
Project kind (from step_00.log):

### C1 — Steps Executed
- [ ] All registered steps appear in workflow.log as "Executing step:"
- [ ] No step is registered but missing from execution
- [ ] Note any step that errored (✗) vs completed (✓)

### C2 — Log Files Created
- [ ] steps/ directory has one .log file per registered step
- [ ] All log files are non-empty (> 5 lines)

### C3 — Correct Prompt/Persona
For each step that called AI (check workflow.log for "[AI] SDK call starting"):
- [ ] step___ : persona used = ___________ / config says = ___________ / registered? Y/N
- [ ] step___ : persona used = ___________ / config says = ___________ / registered? Y/N

### C4 — Response Saved
- [ ] prompts/ subfolder exists for each step that made an AI call
- [ ] Each .md file has both "## Prompt" and "## Response" sections
- [ ] Response is not empty / not just an error message

### Issues Found
| # | Priority | Step | Description |
|---|---|---|---|
|   |          |      |             |

### Verdict
- [ ] ✅ All clear
- [ ] ⚠️ Non-blocking issues (list above)
- [ ] ❌ Blocking issues requiring immediate fix (list above)
```
