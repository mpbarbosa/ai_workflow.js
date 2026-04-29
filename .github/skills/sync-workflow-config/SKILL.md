---
name: sync-workflow-config
description: >
  Analyze the project's .workflow-config.yaml against the actual codebase and
  the .workflow_core template, report all gaps (missing sections, stale version,
  missing lint_commands map, etc.), apply every fix, and commit the result.
  Use this skill when asked to sync, audit, update, or validate .workflow-config.yaml,
  or after bumping the .workflow_core submodule.
---

# sync-workflow-config

## Overview

`.workflow-config.yaml` is the project-level configuration file consumed by
`ai_workflow.js` steps at runtime. Over time it can drift from:

1. **The canonical template** — `.workflow_core/config/.workflow-config.yaml.template`
   gains new sections (e.g. `workflow.settings` in v4.0.0+).
2. **The actual codebase** — step files read specific keys that may not yet
   be declared in the project's config:
   - `step_0b` reads `project.description` and `tech_stack.primary_language`
   - `step_10` reads `tech_stack.lint_commands` (a keyed map by language, **not**
     `lint_command` singular)
   - `step_16` reads `project.version`, `version.config_files`,
     `version.service_worker_files`, and `skills.version_sync`
   - `cli/commands/deploy` reads the optional `deploy:` section
3. **Package metadata** — `project.version` in the config file may lag behind
   `package.json` or the latest CHANGELOG entry.

This skill performs a full assessment and applies every gap as a targeted edit.

---

## Execution steps

### Step 1 — Confirm prerequisites

Verify that the following files exist in the project root:

```bash
ls .workflow-config.yaml \
   .workflow_core/config/.workflow-config.yaml.template \
   package.json
```

If `.workflow-config.yaml` is missing, create it by copying the template:

```bash
cp .workflow_core/config/.workflow-config.yaml.template .workflow-config.yaml
```

Then inform the user that all placeholders (e.g. `{{PROJECT_NAME}}`) must be
filled in before proceeding.

If the `.workflow_core` submodule is not initialised, run the `update-submodules`
skill first.

---

### Step 2 — Read current state

Read three sources in parallel:

1. **Current config** — parse `.workflow-config.yaml` as YAML into memory.
2. **Template** — read `.workflow_core/config/.workflow-config.yaml.template`
   for the canonical structure and expected keys.
3. **Package version** — extract `version` from `package.json`:

```bash
node -e "const p = require('./package.json'); console.log(p.version);"
```

Also read the first `## [x.y.z]` version line from `CHANGELOG.md` as a
secondary version reference.

---

### Step 3 — Gap analysis

Check each known category in order. For each gap found, note the field path,
the current value (or "missing"), and the required value or action.

#### 3.1 Required top-level fields

Verify these fields are present and not still placeholder values
(`{{...}}`):

| Field                         | Notes                                                                                                                                                                                                 |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `project.name`                | Must match the project name                                                                                                                                                                           |
| `project.type`                | e.g. `nodejs-application`                                                                                                                                                                             |
| `project.description`         | Used by `step_0b` for context                                                                                                                                                                         |
| `project.kind`                | Must be one of: `shell_script_automation`, `nodejs_api`, `nodejs_automation`, `react_spa`, `client_spa`, `static_website`, `python_app`, `configuration_library`, `generic`, `location_based_service` |
| `project.version`             | Must match `package.json` version (see §3.2)                                                                                                                                                          |
| `tech_stack.primary_language` | Used by `step_0b` for persona selection                                                                                                                                                               |
| `tech_stack.build_system`     | e.g. `npm`, `none`, `webpack`                                                                                                                                                                         |
| `tech_stack.test_framework`   | e.g. `jest`, `pytest`                                                                                                                                                                                 |
| `tech_stack.test_command`     | Used for test execution guidance                                                                                                                                                                      |
| `tech_stack.lint_command`     | Singular — human reference / legacy                                                                                                                                                                   |
| `structure.source_dirs`       | List of source directories                                                                                                                                                                            |
| `structure.test_dirs`         | List of test directories                                                                                                                                                                              |
| `structure.docs_dirs`         | List of docs directories                                                                                                                                                                              |

#### 3.2 Version drift check

Compare `project.version` in the config with the version from `package.json`.
If they differ, the config version is stale and must be updated.

> **Rule:** always follow `package.json` as the authoritative source.
> If `package.json` itself looks stale (e.g. CHANGELOG has a newer version),
> flag it but do **not** change `package.json` — only update the config.

#### 3.3 `tech_stack.lint_commands` (step_10)

`step_10` reads `tech_stack.lint_commands:` as a **keyed map** of
`{ language: command }`. It does **not** read `lint_command` (singular scalar).

Check whether `lint_commands:` is present. If missing, add it. Derive the
commands from `tech_stack.lint_command` or from `package.json → scripts`:

```yaml
# Example for a JavaScript/TypeScript project using ESLint:
lint_commands:
  javascript: 'npm run lint'
  typescript: 'npm run lint'
```

For Python projects add `python: 'pylint src/'` or whatever the project uses.
For multi-language projects add one entry per language.

#### 3.4 `version.config_files` (step_16)

`step_16` reads `version.config_files` — an array of relative file paths
whose version strings it will update when bumping the version.

Check whether `version.config_files` is present. If missing, add it. At
minimum include `package.json` for Node.js projects. Include other
version-carrying files if they exist (`pyproject.toml`, `Cargo.toml`,
`VERSION`, `src/version.ts`, etc.):

```bash
# Heuristics — check for common version files:
ls pyproject.toml Cargo.toml VERSION src/version.ts 2>/dev/null
```

#### 3.5 `version.service_worker_files` (step_16, PWA only)

Only relevant for PWA / static-site projects that include a service worker.
Skip this check unless `project.kind` is `react_spa`, `client_spa`, or
`static_website`.

If the project has a `service-worker.js` or `sw.js` that contains a version
string, add it under `version.service_worker_files:`.

#### 3.6 `skills.version_sync` (step_16)

`step_16` reads `skills.version_sync` — a project-specific command to run
after its own file-scan pass in order to propagate the new version through
project-specific files.

Check whether `skills.version_sync.command` is present. Add it if the project
has a dedicated version-sync script. At minimum look for:

```bash
node -e "const p = require('./package.json'); const s = p.scripts || {}; \
  ['version:sync','version-sync','validate:versions','validate'].forEach(k => { \
    if (s[k]) console.log(k + ': ' + s[k]); \
  });"
```

If a relevant npm script is found, use it:

```yaml
skills:
  version_sync:
    command: 'npm run <sync-script>'
    check_command: 'npm run <check-script>' # optional
    description: '<short description>'
```

#### 3.7 `workflow.settings` (orchestrator)

Check whether `workflow.settings` is present. If missing, add it with
the default values from the template:

```yaml
workflow:
  settings:
    auto_mode: false
    parallel_execution: true
    smart_execution: true
    ml_optimize: false
    multi_stage: false
    auto_commit: false
```

#### 3.8 `deploy:` section (optional)

Only add this section if the project has a deployment script or command
(e.g. `deploy.sh`, `npm run deploy`). Skip if not applicable.

---

### Step 4 — Report findings

Before making any changes, present a concise table of all gaps found:

```
Gap  | Field                          | Current          | Required
-----|--------------------------------|------------------|---------------------------
  1  | project.version                | 1.0.0            | 2.2.17 (from package.json)
  2  | tech_stack.lint_commands       | missing          | {javascript: npm run lint}
  3  | version.config_files           | missing          | [package.json]
  4  | skills.version_sync            | missing          | command: npm run validate
  5  | workflow.settings              | missing          | default flags from template
```

If no gaps are found, report "✅ .workflow-config.yaml is fully in sync with
the codebase." and stop.

---

### Step 5 — Apply fixes

For each gap identified in Step 4, make the minimal targeted edit to
`.workflow-config.yaml`. Apply all changes in a single pass — read the file,
apply all edits, write the result.

**Important rules:**

- Do not remove or reorder existing fields.
- Do not change values that are already correct.
- Add new sections at the logical end of their parent block.
- Preserve existing comments.
- Use single-quoted strings for YAML values unless double-quotes are needed.

---

### Step 6 — Validate the result

Verify the updated YAML parses cleanly:

```bash
node -e "const yaml = require('js-yaml'); \
  const fs = require('fs'); \
  yaml.load(fs.readFileSync('.workflow-config.yaml', 'utf8')); \
  console.log('YAML valid');"
```

If this fails, fix the YAML syntax error and repeat.

---

### Step 7 — Commit the changes

Stage and commit only `.workflow-config.yaml`:

```bash
git add .workflow-config.yaml
git commit -m "chore(config): sync .workflow-config.yaml with codebase and template

<summary of gaps fixed, e.g.:>
- Fix project.version: 1.0.0 → 2.2.17
- Add tech_stack.lint_commands map (step_10 parity)
- Add version.config_files: [package.json] (step_16)
- Add skills.version_sync (step_16)
- Add workflow.settings block (template v4.0.0+)

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

Replace the bullet list with the actual gaps that were fixed. If only one gap
was fixed, use a single-line description instead of a bullet list.

---

## Expected output

A one-line summary per gap applied:

```
✅ project.version updated: 1.0.0 → 2.2.17
✅ tech_stack.lint_commands added (javascript, typescript)
✅ version.config_files added: [package.json]
✅ skills.version_sync added (check_command: npm run validate:versions)
✅ workflow.settings added (defaults from template v4.0.0+)
✅ .workflow-config.yaml committed
```

---

## Related files

- `.workflow-config.yaml` — the project-level config file this skill maintains
- `.workflow_core/config/.workflow-config.yaml.template` — canonical template
- `src/steps/step_10_code_quality.js` — reads `tech_stack.lint_commands`
- `src/steps/step_16_version_update.js` — reads `version.*` and `skills.version_sync`
- `src/steps/step_0b_bootstrap_docs.js` — reads `project.description` and `tech_stack.primary_language`
- `src/cli/commands/deploy.js` — reads `deploy:` section
