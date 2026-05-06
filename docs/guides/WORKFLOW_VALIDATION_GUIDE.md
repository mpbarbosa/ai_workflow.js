# Workflow Execution Validation Guide

<<<<<<< HEAD
**Version:** 1.9.11
=======
**Version:** 1.9.11

> > > > > > > a4c4d4d (chore(workflow): update docs and metrics [skip ci])
> > > > > > > **Last Updated:** 2026-02-21
> > > > > > > **Applies to:** ai_workflow.js v1.2.0+

This guide documents the process for validating a workflow execution run. It was formalized from the analysis of run `workflow_20260220_210720` and is designed to be reusable for future validations.

---

## Table of Contents

1. [Overview](#overview)
2. [Validation Criteria](#validation-criteria)
3. [Log Folder Structure](#log-folder-structure)
4. [Step-by-Step Validation Process](#step-by-step-validation-process)
5. [Persona Registry](#persona-registry)
6. [Which Steps Call AI](#which-steps-call-ai)
   - [Prompt Key Reference](#prompt-key-reference)
7. [Common Failure Patterns](#common-failure-patterns)
8. [Validated Run Examples](#validated-run-examples)
9. [AI Workflow Execution Report](#ai-workflow-execution-report)
10. [Validation Checklist Template](#validation-checklist-template)

---

## Overview

Each workflow run produces a timestamped log folder under `.ai_workflow/logs/`. A complete validation confirms that every registered step:

- Was actually invoked and completed
- Left a log file behind
- Used the AI persona/prompt configured in the YAML files (when applicable)
- Saved the AI response to the `prompts/` folder (when applicable)
- For steps gated by project kind (e.g., `step_11_5`, `step_11_6`), verify correct registration and conditional execution

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

| Persona ID                | Display Name                  | Primary Use                                                                                         |
| ------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------- |
| `documentation_expert`    | Documentation Expert          | Step 1 – incremental doc updates                                                                    |
| `technical_writer`        | Technical Writer              | Steps 0b, 13 – bootstrap docs, markdown linting                                                     |
| `test_engineer`           | Test Engineer                 | Steps 6, 8 – test review and execution                                                              |
| `code_quality_analyst`    | Code Quality Analyst          | Steps 2, 4 (supplementary), 10 – consistency analysis, config quality review, code quality review   |
| `git_specialist`          | Git Specialist                | Step 12 – git commit message generation                                                             |
| `ux_analyst`              | UX Analyst                    | Step 15 – UX/accessibility analysis                                                                 |
| `prompt_engineer`         | Prompt Engineer               | Step 14 – prompt analysis                                                                           |
| `security_expert`         | Security Expert               | Security scanning _(no workflow step — step_04 uses `devops_engineer` for broader config coverage)_ |
| `performance_engineer`    | Performance Engineer          | Performance analysis _(no workflow step)_                                                           |
| `dependency_analyst`      | Dependency Analyst            | Step 9 – dependency validation                                                                      |
| `architecture_reviewer`   | Architecture Reviewer         | Step 5 – directory structure                                                                        |
| `api_designer`            | API Designer                  | API documentation _(no workflow step)_                                                              |
| `devops_engineer`         | DevOps Engineer               | Steps 3, 4, 16 – script refs, config validation, version update                                     |
| `accessibility_expert`    | Accessibility Expert          | Accessibility audits _(no workflow step)_                                                           |
| `aws_serverless_engineer` | AWS Serverless Engineer       | Step 11.6 – AWS serverless AI review (FULL stage, `aws_lbs_backend_setup` projects only)            |
| `typescript_reviewer`     | TypeScript Reviewer (Strider) | Step 19 – TypeScript type safety review                                                             |

### Common Mismatches Found

| Config / Step uses            | Should be              |
| ----------------------------- | ---------------------- |
| `documentation_analyst`       | `documentation_expert` |
| `documentation_specialist`    | `documentation_expert` |
| `requirements_engineer`       | `documentation_expert` |
| `consistency_checker`         | `code_quality_analyst` |
| `code_reviewer`               | `code_quality_analyst` |
| `ux_designer`                 | `ux_analyst`           |
| `version_manager`             | `devops_engineer`      |
| `typescript_developer_prompt` | `typescript_reviewer`  |

---

## Which Steps Call AI

Not every step makes an AI call on every run. The following table documents when AI is expected to be invoked and under what conditions it is skipped. Steps are listed in execution order; **step_12 always runs last**.

| Step      | AI Persona                                                   | Prompt Key                                                                                           | When AI is triggered                                                                           | Common skip reasons                     |
| --------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------- |
| step_0b   | `technical_writer`                                           | `technical_writer_prompt`                                                                            | Project has < threshold doc files                                                              | Sufficient docs already exist           |
| step_01   | `documentation_expert`                                       | `doc_analysis_prompt`                                                                                | Changed doc files detected                                                                     | No changed doc files in scope           |
| step_02   | `documentation_expert`                                       | `step2_consistency_prompt`                                                                           | Source / doc files analyzed                                                                    | No issues detected                      |
| step_03   | `devops_engineer`                                            | `step3_script_refs_prompt`                                                                           | Shell script files found                                                                       | No script files in scope                |
| step_04   | `devops_engineer` (call 1) + `code_quality_analyst` (call 2) | `configuration_specialist_prompt` + `quality_prompt`                                                 | Config files found                                                                             | No config files found                   |
| step_05   | `architecture_reviewer`                                      | `step5_directory_prompt`                                                                             | Directory structure analyzed                                                                   | N/A (always runs analysis)              |
| step_06   | `test_engineer`                                              | `step6_test_review_prompt`                                                                           | Test files exist                                                                               | No test files found                     |
| step_08   | `test_engineer`                                              | `step8_test_exec_prompt`                                                                             | Test execution ran                                                                             | No test command configured / no tests   |
| step_09   | `dependency_analyst`                                         | `step9_dependencies_prompt`                                                                          | Dependency files exist                                                                         | No dependency manager found             |
| step_10   | `code_quality_analyst`                                       | `step10_code_quality_prompt`                                                                          | Source files exist with linter configured                                                      | No source files / no linter             |
| step_11_5 | `aws_lbs_validator`                                          | Structural file/schema checks only (no AI)                                                           | Project kind is `aws_lbs_backend_setup`                                                        | Any other project kind (skips silently) |
| step_11_6 | `aws_serverless_engineer`                                    | `buildAwsServerlessPrompt` (programmatic)                                                            | Project kind is `aws_lbs_backend_setup`                                                        | Any other project kind (skips silently) |
| step_12   | `git_specialist`                                             | `step12_git_commit_prompt`                                                                           | Changes staged for commit                                                                      | No changes to commit / non-git repo     |
| step_13   | `technical_writer`                                           | `markdown_lint_prompt`                                                                               | Markdown files found                                                                           | No markdown files / enumeration failed  |
| step_14   | `prompt_engineer`                                            | `step14_prompt_engineer_prompt`                                                                      | Project type is `workflow-automation`, `bash-automation-framework`, or `configuration_library` | Non-eligible project kind               |
| step_15   | `ux_analyst`                                                 | `ui_ux_designer_prompt`                                                                              | Project has UI components                                                                      | Project kind has no UI                  |
| step_16   | `devops_engineer`                                            | `version_manager_prompt`                                                                             | Source files analyzed                                                                          | N/A (always runs analysis)              |
| step_18   | `code_quality_analyst`                                       | `async_flow_debugger_prompt` / `observer_pattern_debugger_prompt` / `data_structure_debugger_prompt` | Source files found                                                                             | No source files in scope                |
| step_19   | `typescript_reviewer`                                        | `typescript_developer_prompt`                                                                        | TypeScript files (`.ts`/`.tsx`) found                                                          | No `.ts`/`.tsx` files in project        |

> **step_02 persona note:** Step 2 performs documentation consistency analysis (version sync, cross-references, link validation), so it uses `documentation_expert` despite the step name including "consistency". This matches the YAML `step2_consistency_prompt` role definition which also describes a documentation specialist.

> **step_18 persona note:** The step selects a YAML prompt key (`async_flow_debugger_prompt`, `observer_pattern_debugger_prompt`, or `data_structure_debugger_prompt`) based on code patterns in the source files. All three prompt keys share `code_quality_analyst` as the registered persona ID for the AI context window.

> **step_19 persona note:** The YAML template lookup key is `typescript_developer_prompt` (used with `buildYamlStepPrompt()`), but the registered persona ID passed to `executeRequest()` is `typescript_reviewer`. These are distinct values — do not confuse them in validation.

**Steps with no AI calls** (by design):

| Step      | Name               | Reason                            |
| --------- | ------------------ | --------------------------------- |
| step_00   | Pre-Analysis       | Structural project detection only |
| step_02_5 | Doc Optimization   | Heuristics-based analysis         |
| step_07   | Test Generation    | Runs test commands directly       |
| step_11   | Context Management | File aggregation                  |
| step_0f   | Commit Artifacts   | Git operations                    |
| step_17   | Workflow Summary   | Aggregation of step results       |

### Prompt Key Reference

Each AI-calling step loads its prompt at runtime from `.workflow_core/config/ai_helpers.yaml` using `buildYamlStepPrompt()` from `src/lib/ai_prompt_builder.js`. The **Prompt Key** column above is the top-level YAML key passed to that function.

Six steps use dedicated programmatic builders instead of YAML loading:

| Step      | Builder Function             | Source                 |
| --------- | ---------------------------- | ---------------------- |
| step_01   | `buildDocAnalysisPrompt`     | `ai_prompt_builder.js` |
| step_02   | `buildConsistencyPrompt`     | `ai_prompt_builder.js` |
| step_06   | `buildTestReviewPrompt`      | `ai_prompt_builder.js` |
| step_0b   | `buildTechnicalWriterPrompt` | `ai_prompt_builder.js` |
| step_10   | `buildCodeQualityPrompt`     | `ai_prompt_builder.js` |
| step_11_6 | `buildAwsServerlessPrompt`   | `ai_prompt_builder.js` |

All programmatic builders fall back to a hardcoded generic prompt if `ai_helpers.yaml` is unavailable.

> For the full prompt key ↔ step mapping table, see [`docs/prompts_steps.md`](../prompts_steps.md).

---

## Common Failure Patterns

### Pattern 8: `projectType` always `null` — `getProjectKind()` does not exist

**Symptom:**
step_14 (and any other step reading `context.projectType`) receives `null` even though step_00 correctly detected a project kind. step_14 backlog shows `"Skipped - project type unknown not eligible for prompt analysis."` instead of a real project type name.

**Root cause:**
`main_orchestrator.js` built `executionContext.projectType` using:

```js
projectType: (await this.projectKindConfig?.getProjectKind()) ?? null,
```

`ProjectKindConfigManager` has no `getProjectKind()` method. Optional chaining (`?.()`) silently returns `undefined`; `?? null` collapses that to `null`. Every step then sees `context.projectType === null`.

**How to detect:**

```bash
grep "project type" .ai_workflow/logs/<run_id>/steps/step_14.log
# Symptom: "project type unknown not eligible" when step_00 detected a valid kind
grep "project kind\|kind:" .ai_workflow/logs/<run_id>/steps/step_00.log
```

**Fix applied in `src/orchestrator/main_orchestrator.js`:**

```js
// Before (broken — method does not exist on ProjectKindConfigManager):
projectType: (await this.projectKindConfig?.getProjectKind()) ?? null,

// After (correct — uses ProjectKindDetector.detectProjectKind):
projectType: (await this.projectDetection.detectProjectKind(this.projectRoot))?.kind ?? null,
```

---

### Pattern 9: step_04 flags `.ai_cache/index.json` as a syntax error

**Symptom:**
`step_04.log` shows:

```
Syntax validation: 1 error(s)
```

The flagged file is `.ai_workflow/.ai_cache/index.json` with message `"Only absolute paths are allowed"`. The file is a valid internal cache index, not a project configuration file.

**Root cause:**
`Step4ConfigAnalyzer.discoverConfigFiles()` fallback scan included `**/*.json` without excluding the `.ai_cache/` directory. The cache index matched the glob and was passed to JSON syntax validation, which rejected the internal path format.

**Fix applied in `src/steps/step_04_config_validation.js`:**

```js
// Before:
const exclude = ['node_modules', '.git', 'dist', 'build', 'coverage'];

// After:
const exclude = ['node_modules', '.git', 'dist', 'build', 'coverage', '.ai_cache'];
```

---

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
- Expected: step_14 skipping for non-eligible project types ✅ (but log should show actual project type, not "unknown")
- Fixed: step_14 now runs for `configuration_library` projects (e.g., `ai_workflow_core`), which contain prompt file configurations ✅
- Unexpected: step_14 skipping because projectType is null due to context-passing bug ⚠️

---

### Pattern 6: step_04 false-positive YAML syntax error in block scalars

**Symptom:**
`Syntax validation: 1 error(s)` in `step_04.log` for a YAML file that is structurally valid. The flagged line is content inside a `|` or `>` block scalar (e.g., a prose bullet list with 7-space indentation inside a `prompt:` field).

**Root cause:**
`validateYamlSyntax()` in `step_04_config_validation.js` checked _every_ line for odd indentation, including literal content lines inside block scalars where indentation is prose formatting, not YAML structure.

**Fix applied in `src/steps/step_04_config_validation.js`:**
Added block-scalar tracking: when a line ending with `|` or `>` is encountered, the function enters block-scalar mode and skips the indentation check until the content returns to the key's indentation level.

**How to diagnose before the fix:**

```bash
# Find the flagged file from the step log — step_04 logs filename in the report
grep "Syntax errors" .ai_workflow/logs/workflow_<run_id>/steps/step_04.log
# Then check the reported line number manually
```

---

### Pattern 7: step_12 does not push when ahead with no local changes

**Symptom:**
`step_12.log` shows:

```
No changes to commit
Local is N commit(s) ahead of remote
✓ Step step_12 completed
```

But `git log --oneline origin/main..HEAD` confirms commits were never pushed.

**Root cause:**
`_handleNoChanges()` logged the ahead-of-remote state but contained only a comment (`// Would push existing commits here`) with no actual push call. Step 12 only pushed inside `_generateReport()`, which is only reached when there are new staged changes.

**Fix applied in `src/steps/step_12_git_finalization.js`:**
`_handleNoChanges()` now calls `_pushToRemote()` when `commitsAhead > 0`, with proper backlog summary and return value reflecting push outcome.

---

### Pattern 10: Step class implemented but never registered — step silently absent from all runs

**Symptom:**
A step's backlog `.md` file is completely absent from every workflow run, even for projects where it should apply (e.g., no `step_11_5.md` in any `aws_lbs_backend_setup` run).

**Root cause:**
The step class was fully implemented in `src/steps/` but never imported or registered in `main_orchestrator.js`. The `getStepsForStage()` FULL array did not include it, so `buildExecutionPlan()` never schedules it. No error is raised — it simply does not exist in the plan.

**Confirmed case — `onde_estou_backend/workflow_20260221_183838`:**
Project kind: `aws_lbs_backend_setup`. Backlog folder contained step_00 through step_16 but no `step_11_5.md`. `Step11_5AwsLbsValidator` was a complete implementation but had no import or step definition in `main_orchestrator.js`.

**Fix applied (2026-02-21):**

- Added import for `Step11_5AwsLbsValidator` in `main_orchestrator.js`.
- Added step definition `{ id: 'step_11_5', ..., dependencies: ['step_11'] }`.
- Added `'step_11_5'` to FULL stage in `getStepsForStage()`.
- Created `step_11_6_aws_serverless_review.js` (new AI step) depending on `step_11_5`, also registered.

**How to detect:**
Search for step class names in `src/steps/` vs. imports in `main_orchestrator.js`:

```bash
grep -h "^export class" src/steps/*.js | sed 's/export class //' | sed 's/ {.*//'
grep "from '../steps/" src/orchestrator/main_orchestrator.js | sed "s/.*\///;s/\.js.*//"
```

Any class not matching an import is unregistered.

---

### Pattern 11: AI response hallucinates content not in the prompt — missing prompt context variables

**Symptom:**
The `## Response` block of a prompt-response log file references scripts, files, or modules that do not appear anywhere in the `## Prompt` block. The model's output is plausible but describes a _different_ project (typically one from its training data).

**Root cause:**
`buildYamlStepPrompt()` substitutes `{placeholder}` variables into the YAML `task_template`. If a variable is not supplied in the context dict, the placeholder is replaced with an empty string. The model then receives a context field with no value (e.g., `- Primary Language: ` or `- Available Scripts: `) and falls back to its priors, inventing content.

A secondary cause is an approach field that is missing a grounding instruction — the model is not told to restrict its analysis to the data explicitly provided in the prompt.

**Confirmed case — `paraty_geocore.js/workflow_20260227_202534`, `step_03`:**
Prompt listed **1 available script: `cdn-delivery.sh`**. Response named five scripts (`setup.sh`, `test-integration.sh`, `cleanup_artifacts.sh`, `validate.sh`, `prepare-release.sh`) that belong to `ai_workflow.js`, not `paraty_geocore.js`. The model also declared `cdn-delivery.sh` "not found" despite it being explicitly listed. Root causes: (1) `primary_language`, `project_description`, `change_scope` were missing from the context passed to `buildYamlStepPrompt`; (2) `all_scripts` fallback was `''` instead of `'none'`; (3) the `approach` field started with `**Output:**` and had no grounding instruction.

**Fix applied (2026-02-28):**

| File                                    | Change                                                                                                                                                                                                        |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/steps/step_03_script_refs.js`      | Added `primary_language`, `project_description`, `change_scope` to context; changed `all_scripts` empty fallback to `'none'`                                                                                  |
| `.workflow_core/config/ai_helpers.yaml` | `step3_script_refs_prompt.approach` — prepended: _"Analyze ONLY the scripts explicitly listed under 'Available Scripts'. Do not reference, invent, or assume the existence of any scripts not in that list."_ |

**How to detect:**

1. Open the prompt-response `.md` file.
2. In `## Prompt`, check every `- Context field:` line — flag any that have an empty value after the colon.
3. In `## Prompt`, find the `**Available Scripts:**` (or equivalent) block and collect the listed items.
4. In `## Response`, check whether any file/script is named that was **not** in step 3's list.
5. Check that `**Approach**:` is not immediately followed by another `**bold header**` — if it is, the YAML `approach` field is missing a body.

**Prevention checklist for new AI-calling steps:**

- [ ] All `{placeholder}` variables in the YAML `task_template` have a corresponding key in the context dict passed to `buildYamlStepPrompt()`.
- [ ] List-type placeholders (scripts, files, symbols) use `'none'` as the empty fallback, not `''`.
- [ ] The YAML `approach` field starts with a grounding instruction restricting the model to the data in the prompt.

---

## Validated Run Examples

This section records real workflow executions and their step 12 (Git Finalization) outcomes, to serve as a reference baseline for future validations.

---

### Run: `workflow_20260301_160006` — Pattern 11 in step_02/step_05; step_04 timeout (2026-03-01)

**Project:** `paraty_geocore.js`
**Project kind:** `location_based_service`
**Stage:** FULL | **Mode:** automatic
**Duration:** ~5m 47s | **Steps:** 23/24 ✓ (step_12 completion unconfirmed in logs)
**Result:** ⚠️ Non-blocking — 8 issues found, 7 fixed in same session

#### Findings

**C1 ✅** All 24 registered steps executed. step_12 ran last (correct). Note: `✓ Step step_12 completed` absent from `workflow.log` — log ends at `Pushing to origin/main...` with no result line.

**C2 ✅** All 24 `steps/*.log` files present and non-empty.

**C3 ✅** All 13 AI-calling steps used registered persona IDs matching the guide's expected mapping. `.workflow-config.yaml` has no `ai_persona` overrides.

**C4 ✅** All 13 AI-calling steps have prompt subdirectories; all `.md` files contain `## Prompt` and `## Response` sections with non-empty content. step_04: 2 files; step_05: 2 files; step_08: 2 files; step_09: 2 files; step_10: 3 files; all others: 1 file.

**C5 ⚠ (Pattern 11)** — 7 violations across 6 steps:

| File                                      | Rule 1 (empty context)  | Rule 3 (approach body missing) |
| ----------------------------------------- | ----------------------- | ------------------------------ |
| `step_02/…_documentation_expert.md`       | Primary Language, Scope | ✅                             |
| `step_05/…_0001_architecture_reviewer.md` | Primary Language        | —                              |
| `step_05/…_0002_architecture_reviewer.md` | Primary Language        | —                              |
| `step_09/…_0002_dependency_analyst.md`    | —                       | ✅                             |
| `step_12/…_git_specialist.md`             | —                       | ✅                             |
| `step_13/…_technical_writer.md`           | —                       | ✅                             |
| `step_18/…_code_quality_analyst.md`       | —                       | ✅                             |

#### Issues found and fixed

| #   | Pattern      | Step    | Description                                                                                       | Fix                                                                                                                                                  |
| --- | ------------ | ------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Pattern 11   | step_02 | `primary_language` + `change_scope` missing from context; `_options` parameter shadowed `options` | Added `TechStackDetector`, `detectLanguage()`, renamed `_options`→`options`, added all 3 fields to `buildYamlStepPrompt` in `step_02_consistency.js` |
| 2   | Pattern 11   | step_05 | `primary_language` missing from both prompt partitions; no `detectLanguage()` fallback            | Added `TechStackDetector`, `detectLanguage()`, replaced `options.language \|\| ''` with detected language in `step_05_directory.js`                  |
| 3   | Pattern 11   | step_09 | `javascript_developer_prompt.approach` body missing (YAML Rule 3)                                 | Prepended grounding sentence in `.workflow_core/config/ai_helpers.yaml`                                                                              |
| 4   | Pattern 11   | step_12 | `step12_git_commit_prompt.approach` body missing (YAML Rule 3)                                    | Prepended grounding sentence                                                                                                                         |
| 5   | Pattern 11   | step_13 | `markdown_lint_prompt.approach` body missing (YAML Rule 3)                                        | Prepended grounding sentence                                                                                                                         |
| 6   | Pattern 11   | step_18 | `async_flow_debugger_prompt.approach` body missing (YAML Rule 3)                                  | Prepended grounding sentence                                                                                                                         |
| 7   | step_02 YAML | step_02 | `step2_consistency_prompt.approach` body missing (YAML Rule 3)                                    | Prepended grounding sentence                                                                                                                         |
| 8   | Timeout      | step_04 | First `devops_engineer` SDK call hit 60s timeout → retry → 100s total step duration               | Changed `executeRequest` call to `{ persona: 'devops_engineer', timeout: 120000 }` in `step_04_config_validation.js`                                 |

#### Outstanding (not fixed this session)

- **step_12 log completeness** (medium): `✓ Step step_12 completed` not written to `workflow.log`. Commit + tag push confirmed; `origin/main` push initiated but result not logged. Investigate log-flush timing in engine after step_12.
- **step_14 eligibility** (low): `location_based_service` not in `shouldRunPromptAnalysis()` → 2ms skip. Add if prompt quality analysis is desired for this project kind.

#### Validation report

Full checklist + AI Workflow Execution Report saved at:
`paraty_geocore.js/.ai_workflow/logs/workflow_20260301_160006/workflow_validation_report.md`

---

### Run: `workflow_20260227_202534` — AI hallucination in step_03 (Pattern 11) (2026-02-28)

**Project:** `paraty_geocore.js`
**Stage:** FULL | **Triggered by:** Manual prompt-log validation

#### Finding

Validation of `prompts/step_03/2026-02-27T23-29-12-785Z_0001_devops_engineer.md` revealed the AI response was completely invalid:

- Prompt supplied 1 script (`cdn-delivery.sh`); response described 5 unrelated scripts from `ai_workflow.js`.
- Response declared `cdn-delivery.sh` "not found" despite it being listed in `Available Scripts`.
- `**Approach**:` rendered as `**Approach**: **Output:**` with no actual approach text.
- `Primary Language:` and `Scope:` were blank in the rendered prompt.

#### Root cause

Three bugs in `step_03_script_refs.js` + `ai_helpers.yaml` (see Pattern 11):

1. Missing context variables (`primary_language`, `project_description`, `change_scope`).
2. Empty `all_scripts` fallback (`''` → should be `'none'`).
3. `step3_script_refs_prompt.approach` in `ai_helpers.yaml` had no body — only a `**Output:**` header.

#### Issues found and fixed

| #   | Pattern    | Step    | Description                                                                    | Fix                                                                              |
| --- | ---------- | ------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| 1   | Pattern 11 | step_03 | `primary_language`, `project_description`, `change_scope` missing from context | Added all three to `buildYamlStepPrompt()` context in `step_03_script_refs.js`   |
| 2   | Pattern 11 | step_03 | `all_scripts` passed as `''` when no scripts found                             | Changed fallback to `'none'`                                                     |
| 3   | Pattern 11 | step_03 | `approach` field in YAML rendered as `**Approach**: **Output:**`               | Added grounding instruction as first line of `step3_script_refs_prompt.approach` |

#### Post-fix validation

42 existing step_03 tests all pass after the fix. Next workflow run on `paraty_geocore.js` should produce a step_03 response that references only `cdn-delivery.sh`.

---

### Run: `workflow_20260220_202333` — pre-structured-logging run, two new patterns identified (2026-02-20)

**Project:** `ai_workflow.js` (nodejs_api)
**Stage:** full | **Mode:** interactive | **Version:** 2.3.1 (shell-based predecessor)
**Duration:** 50m 26s | **Steps:** 20/20 ✅
**Result:** ⚠️ Validation non-conformant — structural gaps + 2 code bugs found and fixed

#### Structural observations

This run predates the `logs/steps/` and `prompts/` infrastructure. Artifacts are stored in non-standard locations:

| Artifact            | Expected path                                                         | Actual path                                                   | Status                             |
| ------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------- |
| `workflow.log`      | `.ai_workflow/logs/workflow_20260220_202333/workflow.log`             | does not exist                                                | MISSING                            |
| `steps/*.log`       | `.ai_workflow/logs/workflow_20260220_202333/steps/`                   | does not exist                                                | MISSING                            |
| `prompts/`          | `.ai_workflow/logs/workflow_20260220_202333/prompts/`                 | does not exist                                                | MISSING                            |
| Backlog `.md` files | `.ai_workflow/backlog/workflow_20260220_202333/`                      | `.ai_workflow/.ai_workflow/backlog/workflow_20260220_202333/` | MISPLACED (cwd bug in old version) |
| Workflow summary    | `.ai_workflow/summaries/workflow_20260220_202333/workflow_summary.md` | ✅ correct                                                    | OK                                 |

These gaps are artefacts of the older shell-based engine and do not reflect defects in ai_workflow.js.

#### Criteria results

- **C1** ⚠️ Partially verified — `workflow_summary.md` confirms 20/20 steps, but no `workflow.log` for registration/execution order. `step_0a` (present in old engine) has no backlog file.
- **C2** ❌ No `steps/*.log` directory — C2 cannot be met for this run.
- **C3** ⚠️ step_14 confirmed **Pattern 8** — backlog shows `"project type unknown"` despite step_00 detecting configuration-scope changes. Caused by broken `getProjectKind()` call in `main_orchestrator.js` (now fixed). step_04 confirmed **Pattern 9** — `.ai_cache/index.json` flagged as syntax error (now fixed).
- **C4** ❌ No `prompts/` folder — prompt-saving did not exist in v2.3.1.

#### Bugs found and fixed

| #   | Pattern   | Step    | Fix                                                                                                                                           |
| --- | --------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Pattern 8 | step_14 | `main_orchestrator.js`: replace broken `projectKindConfig.getProjectKind()` call with `projectDetection.detectProjectKind(projectRoot)?.kind` |
| 2   | Pattern 9 | step_04 | `step_04_config_validation.js`: add `.ai_cache` to the `exclude` list in `discoverConfigFiles()`                                              |
| 3   | Pattern 4 | step_13 | Already fixed in current code: `_enumerateMarkdownFiles()` uses `listDirectoryRecursive()`, not `listFiles()`                                 |

---

### Run: `workflow_20260220_213310` — cross-project execution with `--project-root` (2026-02-21)

**Project:** `ai_workflow_core` (configuration_library)
**Triggered from:** `ai_workflow.js` via `node bin/ai-workflow.js run --project-root /path/to/ai_workflow_core --auto`
**Stage:** full | **Mode:** automatic
**Result:** ⚠️ 20/21 steps — **Step 12 failed** (root cause identified and fixed before re-run)

#### Step 12 failure analysis

**Symptom:**

```
✗ Git finalization failed: Command failed: git commit -F "/tmp/workflow_commit_<ts>.txt"
```

Git status showed both modified files (`config/ai_helpers.yaml`, `.github/copilot-instructions.md`) still unstaged after the step reported "Changes staged successfully".

**Root cause — missing `cwd` in `_executeGit()`:**
`Step12GitFinalization._executeGit()` called the executor without a `cwd` option, so every git command ran in `process.cwd()` — the `ai_workflow.js` directory — not the target project root. `git add -A` staged nothing in the target repo; the subsequent `git commit` had an empty index and failed.

**Diagnosis commands:**

```bash
# Confirm git ran in wrong directory by checking status of target repo after failed step
cd /path/to/ai_workflow_core && git status
# Expected (wrong): files still show as "Changes not staged for commit"

# Compare changed-file count in step log vs actual git status
grep "Changes:" .ai_workflow/logs/workflow_<run_id>/steps/step_12.log
# 1 file reported — but 2 were actually modified (step_00 ran in correct dir; step_12 did not)
```

**Fix applied in `src/steps/step_12_git_finalization.js`:**

1. Added `this.projectRoot = options.projectRoot || null` to the constructor.
2. Resolved `this._projectRoot` from `context.projectRoot` at the start of `execute()`:
   ```js
   this._projectRoot = context.projectRoot || this.projectRoot || process.cwd();
   ```
3. Passed `cwd: this._projectRoot` to all `_executeGit()` invocations:
   ```js
   const result = await this.executor.execute(command, { shell: true, cwd });
   ```

> `Step12GitFinalization.stepKind = STEP_KIND.CONTEXT`, so `context.projectRoot` is always populated by `main_orchestrator.js` when `--project-root` is passed.

---

### Run: `workflow_20260220_213516` — re-run after fix (2026-02-21)

**Project:** `ai_workflow_core` (configuration_library)
**Stage:** full | **Mode:** automatic
**Result:** ✅ 21/21 steps — **Step 12 succeeded**

**Step 12 log (key lines):**

```
Branch: main (ahead: 0, behind: 0)
Changes: 2 files
Inferred commit type: docs(documentation)
Staging all changes...
Changes staged successfully
Generating commit message...
Commit message generated
Creating commit...
Changes committed successfully
Local branch is up to date with origin/main
✓ Step step_12 completed in 41ms
```

**Files committed:** `config/ai_helpers.yaml` (v6.3.1 → v6.4.0, +aws_cloud_architect_prompt persona) and `.github/copilot-instructions.md` (updated persona count 16→17, added AWS persona documentation).

**Key validation checks:**

- C1 ✅ All 21 steps executed and completed
- C2 ✅ All step log files present and non-empty
- C3 ✅ step_01 used `documentation_expert` persona (only AI-calling step triggered)
- C4 ✅ Response saved in `prompts/step_01/`
- Step 12 ✅ Committed to correct repository (`ai_workflow_core`), not the invoking repo (`ai_workflow.js`)

---

### Run: `workflow_20260220_214108` — post-fix re-run (2026-02-21)

**Project:** `ai_workflow_core` (configuration_library)
**Stage:** full | **Mode:** automatic
**Result:** ⚠️ 21/21 steps — 4 non-blocking issues identified and fixed

**Key validation checks:**

- C1 ✅ All 21 steps executed and completed (no ✗ failures)
- C2 ✅ All 21 step log files present and non-empty
- C3 ⚠️ step_01 used `documentation_expert` (registered ✅), but `.workflow-config.yaml` had `ai_persona: "documentation_specialist"` (unregistered) — step ran correctly despite config bug
- C4 ✅ `prompts/step_01/2026-02-21T00-41-15-424Z_0001_documentation_expert.md` present with both `## Prompt` and `## Response` sections

**Issues found and fixed:**

| #   | Pattern     | Step    | Description                                                                                | Fix                                                                         |
| --- | ----------- | ------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| 1   | C3 mismatch | step_01 | `.workflow-config.yaml` had 6 unregistered `ai_persona` IDs                                | Corrected all 6 in `.workflow-config.yaml` — see Common Mismatches table    |
| 2   | Pattern 6   | step_04 | Block scalar content in `config/ai_helpers.yaml` flagged as odd-indentation error          | Fixed `validateYamlSyntax()` to skip indentation check inside block scalars |
| 3   | step_05 ⚠️  | step_05 | 4 `.md` files in project root classified as misplaced (108 structure issues also reported) | Moved 4 files: 3 → `docs/reports/analysis/`, 1 → `docs/misc/`               |
| 4   | Pattern 7   | step_12 | `_handleNoChanges()` logged "1 commit ahead" but did not push                              | Fixed to call `_pushToRemote()` whenever `commitsAhead > 0`                 |

**Step 12 log (key lines — no new changes, 1 commit already ahead):**

```
No changes to commit
Local is 1 commit(s) ahead of remote
✓ Step step_12 completed in 18ms
```

> ⚠️ Push was silently skipped this run (Pattern 7). Fixed in the same session; future runs will push automatically.

---

### Fix: `step_14` now runs on `configuration_library` projects (2026-02-21)

**Change:** `src/steps/step_14_prompt_engineer.js` — `shouldRunPromptAnalysis()` and `PROJECT_TYPES`

**Root cause:**
`shouldRunPromptAnalysis()` only permitted `workflow-automation` and `bash-automation-framework` project types. The `ai_workflow_core` repository is classified as `configuration_library` because it is a prompt-file configuration package — its primary artifact is `config/ai_helpers.yaml`. Step 14 was skipping it with "project type not eligible", meaning prompt quality analysis was never executed on the project most likely to need it.

**Fix applied in `src/steps/step_14_prompt_engineer.js`:**

1. Added `configurationLibrary: 'configuration_library'` to `PROJECT_TYPES`.
2. Updated `shouldRunPromptAnalysis()` to return `true` for `configuration_library`:
   ```js
   export function shouldRunPromptAnalysis(projectType) {
     return (
       projectType === PROJECT_TYPES.workflowAutomation ||
       projectType === PROJECT_TYPES.bashFramework ||
       projectType === PROJECT_TYPES.configurationLibrary
     );
   }
   ```
3. Added a test case in `test/steps/step_14_prompt_engineer.test.js`.

**Expected behavior after fix:**
When `ai_workflow_core` (or any other `configuration_library` project) is processed, step 14 will attempt to load `configPath` (default: `.workflow_core/config/ai_helpers.yaml`). If the file exists, prompts are analyzed; if not, the step gracefully skips with reason `configuration not found`.

**"Which Steps Call AI" table updated** to reflect `configuration_library` as a trigger condition.

---

### Run: `workflow_20260221_183838` — unregistered step_11_5 found; step_11_5 + step_11_6 added (2026-02-21)

**Project:** `onde_estou_backend` (aws_lbs_backend_setup)
**Stage:** FULL | **Triggered by:** Manual analysis of missing backlog entries

#### Finding

Backlog folder `.ai_workflow/backlog/workflow_20260221_183838/` contained entries for step_00 through step_16 but **no `step_11_5.md`**, despite the project kind being `aws_lbs_backend_setup` — the exact kind that step should gate on.

#### Root cause

`Step11_5AwsLbsValidator` was a complete implementation in `src/steps/step_11_5_aws_lbs_validation.js` (structural file/schema checks for LBS deployments) but had **never been imported or registered** in `main_orchestrator.js`. It was absent from the FULL stage in `getStepsForStage()`. No error surfaces; the step simply does not appear in the execution plan.

Additionally, the `aws_serverless_engineer` AI persona defined in `ai_personas.js` was **orphaned** — referenced by no workflow step.

#### Fixes applied (all in same session)

| Change                                                              | File                                                 |
| ------------------------------------------------------------------- | ---------------------------------------------------- |
| Added import `Step11_5AwsLbsValidator`                              | `src/orchestrator/main_orchestrator.js`              |
| Added step definition `step_11_5` (depends on `step_11`)            | `src/orchestrator/main_orchestrator.js`              |
| Added `'step_11_5'` to FULL stage                                   | `src/orchestrator/main_orchestrator.js`              |
| Added `buildAwsServerlessPrompt()` pure function                    | `src/lib/ai_prompt_builder.js`                       |
| Created `step_11_6_aws_serverless_review.js` (new AI step)          | `src/steps/step_11_6_aws_serverless_review.js`       |
| Added import + step definition `step_11_6` (depends on `step_11_5`) | `src/orchestrator/main_orchestrator.js`              |
| Added 32 tests for step_11_6 (all passing ✅)                       | `test/steps/step_11_6_aws_serverless_review.test.js` |

#### Post-fix FULL stage order (relevant slice)

```
step_11 → step_11_5 → step_11_6 → step_13 → step_14 → … → step_0f → step_12
```

Both steps skip silently for any project kind other than `aws_lbs_backend_setup`.

> This run documented as **Pattern 10** in the Common Failure Patterns section above.

---

---

## AI Workflow Execution Report

An **AI Workflow Execution Report** is a per-run artifact that consolidates, for every workflow step, the seven key items needed to audit, reproduce, or debug an execution. It complements the validation criteria (C1–C4) by providing a single structured view of what each step asked, what model was used, and exactly where the artifacts live on disk.

> **Scope:** Only steps that produced at least one `[AI] SDK call starting` log entry have items 3–6 populated. All other steps show `N/A` for those columns. Item 8 (Duration) is populated for every executed step.

> **Storage rule:** The report file must be saved inside the session log folder for the run being validated: `.ai_workflow/logs/workflow_<run_id>/`.

---

### Items Collected Per Step

#### 1 — Step Name

The step identifier (e.g., `step_01`, `step_0b`, `step_14`) as registered in the workflow engine.

**How to obtain:**

```bash
# List all steps that made at least one AI call in a run
grep "\[AI\] SDK call starting" $LOG_DIR/workflow.log \
  | grep -oP "step_[0-9a-f_]+" | sort -u
```

---

#### 2 — Step Execution Status

Whether the step completed successfully, failed, or produced a warning.

| Symbol | Meaning                |
| ------ | ---------------------- |
| `✓`    | Completed (success)    |
| `✗`    | Failed                 |
| `⚠`    | Completed with warning |

**How to obtain:**

```bash
# Status for every step in the run
grep -E "(✓ Step|✗ Step|⚠ Step)" $LOG_DIR/workflow.log
```

---

#### 3 — AI Model Used

The model identifier passed to the Copilot SDK for the AI call (e.g., `gpt-4o`, `claude-3-5-sonnet`). Recorded in the step-level log at the `[AI] SDK call starting` line.

**How to obtain:**

```bash
# Model used by step_01 (replace step_01 with any step ID)
grep "\[AI\] SDK call starting" $LOG_DIR/steps/step_01.log \
  | grep -oP "model: \K[^,]+"
```

The model is also recorded at the top of every prompt-response `.md` file:

```bash
grep "^\*\*Model:\*\*" $LOG_DIR/prompts/step_01/*.md
```

---

#### 4 — Prompt(s) Used

The exact text sent to the AI, captured in the `## Prompt` block of each prompt-response log file under `prompts/<step_id>/`. Each AI call within a step produces one file, so a step may have multiple prompts.

**How to obtain:**

```bash
# Print the prompt section from every call made by step_01
for f in $LOG_DIR/prompts/step_01/*.md; do
  echo "=== $f ==="
  awk '/^## Prompt$/,/^## Response$/' "$f" | grep -v "^## Response"
done
```

---

#### 5 — AI Workflow Step Execution Log File — Absolute Path

The step-level log file containing all output produced by that step, including AI call boundaries, persona, model, timings, and debug messages.

**Path pattern:**

```
<ABS_LOG_DIR>/steps/<step_id>.log
```

**How to resolve the absolute path:**

```bash
realpath $LOG_DIR/steps/step_01.log
```

---

#### 6 — AI Workflow Step Prompt(s) Response(s) Log File(s) — Absolute Path(s)

One `.md` file per AI call made by the step. The file contains the timestamp, persona, model, the full prompt, and the full AI response.

**File-name format:**

```
<ISO_timestamp>_<seq>_<persona>.md
# Example: 2026-02-21T00-41-15-424Z_0001_documentation_expert.md
```

**Path pattern:**

```
<ABS_LOG_DIR>/prompts/<step_id>/<timestamp>_<seq>_<persona>.md
```

**How to list all prompt-response files for a step:**

```bash
ls -1 $(realpath $LOG_DIR/prompts/step_01/)
```

---

#### 7 — Step Skip Reason

If a step was not executed (i.e., it does not appear in the `Executing step:` lines of `workflow.log`), the reason it was skipped. Common values are a precondition not met (e.g., no changed files, sufficient docs already exist, ineligible project type) or an explicit skip decision logged by the step itself.

**How to obtain:**

```bash
# Find steps that were registered but never executed
comm -23 \
  <(grep "Registered step:" $LOG_DIR/workflow.log | grep -oP "step_[0-9a-f_]+" | sort) \
  <(grep "Executing step:" $LOG_DIR/workflow.log | grep -oP "step_[0-9a-f_]+" | sort)

# For each skipped step, read its log for the reason (step may still produce a log even when skipped)
grep -i "skip\|not eligible\|skipping\|no.*found\|sufficient" $LOG_DIR/steps/<step_id>.log | head -5
```

---

#### 8 — Duration

The wall-clock execution time of the step, in milliseconds, as reported by the workflow engine. Recorded in `workflow.log` at the `✓ Step <id> completed in <ms>ms` line.

**How to obtain:**

```bash
# Duration for every step in the run
grep "completed in" $LOG_DIR/workflow.log

# Duration for a specific step
grep "completed in" $LOG_DIR/workflow.log | grep "step_01"
```

---

### Report Generation Script

The following script prints a compact AI Workflow Execution Report for all AI-calling steps in a given run. Run it from the repository root.

```bash
#!/usr/bin/env bash
# Usage: LOG_DIR=".ai_workflow/logs/workflow_<run_id>" bash generate_ai_report.sh

ABS_LOG_DIR="$(realpath "${LOG_DIR:-.ai_workflow/logs/$(ls -1t .ai_workflow/logs/ | head -1)}")"

echo "# AI Workflow Execution Report"
echo "Run: $(basename "$ABS_LOG_DIR")"
echo ""

# Collect AI-calling step IDs
AI_STEPS=$(grep "\[AI\] SDK call starting" "$ABS_LOG_DIR/workflow.log" 2>/dev/null \
  | grep -oP "step_[0-9a-f_]+" | sort -u)

if [[ -z "$AI_STEPS" ]]; then
  echo "No AI calls detected in this run."
  exit 0
fi

for STEP in $AI_STEPS; do
  STEP_LOG="$ABS_LOG_DIR/steps/$STEP.log"
  PROMPTS_DIR="$ABS_LOG_DIR/prompts/$STEP"

  # 2 — status
  STATUS=$(grep -E "(✓ Step $STEP|✗ Step $STEP|⚠ Step $STEP)" "$ABS_LOG_DIR/workflow.log" \
    | head -1 | grep -oP "(✓|✗|⚠)")

  # 3 — model
  MODEL=$(grep "\[AI\] SDK call starting" "$STEP_LOG" 2>/dev/null \
    | grep -oP "model: \K[^,]+" | head -1)

  # 8 — duration
  DURATION=$(grep "✓ Step $STEP completed in" "$ABS_LOG_DIR/workflow.log" \
    | grep -oP "\d+ms" | head -1)

  echo "## $STEP"
  echo "  Status   : ${STATUS:-unknown}"
  echo "  Model    : ${MODEL:-unknown}"
  echo "  Duration : ${DURATION:-unknown}"
  echo "  Exec log : $STEP_LOG"
  echo ""

  # 4+6 — prompts and response log paths
  if [[ -d "$PROMPTS_DIR" ]]; then
    IDX=1
    for F in "$PROMPTS_DIR"/*.md; do
      PROMPT_TEXT=$(awk '/^## Prompt$/{ found=1; next } /^## Response$/{ found=0 } found{ print }' "$F" \
        | grep -v '^\`\`\`' | head -5 | tr '\n' ' ')
      echo "  Prompt $IDX :"
      echo "    Text (truncated) : ${PROMPT_TEXT:0:120}..."
      echo "    Response log     : $F"
      IDX=$((IDX + 1))
    done
  else
    echo "  Prompts: N/A (no prompts directory)"
  fi
  echo ""
done
```

---

### Report Template Table

Use the following table to document the AI Workflow Execution Report for a given run inline (e.g., in a validated-run entry or a post-mortem). Add one row for every AI-calling step.

```
## AI Workflow Execution Report — Run: workflow_<YYYYMMDD_HHmmss>

| Step | Status | Duration | AI Model | Prompt(s) summary | Execution log (abs path) | Prompt-response log(s) (abs path) |
|------|--------|----------|----------|--------------------|--------------------------|-----------------------------------|
| step_01 | ✓ | 10100ms | gpt-4o | "Update README with new API surface…" (1 call) | `/abs/path/.ai_workflow/logs/workflow_<run_id>/steps/step_01.log` | `/abs/path/.ai_workflow/logs/workflow_<run_id>/prompts/step_01/2026-02-21T00-41-15-424Z_0001_documentation_expert.md` |
| step_0b | N/A (skipped) | 19ms | N/A | N/A | `/abs/path/.ai_workflow/logs/workflow_<run_id>/steps/step_0b.log` | N/A |
```

> **Tip:** Run `realpath $LOG_DIR` once to get the absolute base path, then append `steps/<id>.log` or `prompts/<id>/<file>.md` as needed.

---

## Validation Checklist Template

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

### C5 — Prompt Context & Response Grounding (Pattern 11)
For each prompt-response .md file, spot-check at least one AI-calling step:
- [ ] No context field line (e.g., `- Primary Language:`, `- Scope:`) has a blank value after the colon
- [ ] `**Approach**:` line is NOT immediately followed by another `**bold header**` (missing approach body)
- [ ] Every file/script/symbol named in `## Response` appears in the corresponding list in `## Prompt`
- [ ] If a list placeholder is empty (e.g., `Available Scripts: none`), response does not invent items

### Issues Found
| # | Priority | Step | Description |
|---|---|---|---|
|   |          |      |             |

### Verdict
- [ ] ✅ All clear
- [ ] ⚠️ Non-blocking issues (list above)
- [ ] ❌ Blocking issues requiring immediate fix (list above)
```
