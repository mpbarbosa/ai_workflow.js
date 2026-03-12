# Migration Guide: `ai_workflow` (bash v3.0.0) → `ai_workflow.js` (v1.x)

**AI Workflow Automation v1.7.3**
**Last Updated:** 2026-03-11
**Audience:** Teams migrating from the bash-based `ai_workflow` to the JavaScript implementation

---

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Installation & Setup](#installation--setup)
- [Configuration Migration](#configuration-migration)
- [CLI Command Equivalents](#cli-command-equivalents)
- [Artifact Compatibility](#artifact-compatibility)
- [Step Customization](#step-customization)
- [Programmatic API](#programmatic-api)
- [Known Differences](#known-differences)
- [Troubleshooting](#troubleshooting)
- [Getting Help](#getting-help)

---

## Overview

`ai_workflow.js` is a complete architectural reimplementation of the bash-based
[`ai_workflow` v3.0.0](https://github.com/mpbarbosa/ai_workflow) in Node.js. It is **not** a
line-by-line translation — it is a full redesign using modern JavaScript (ESM), functional
programming patterns, and a proper CLI — while preserving the same configuration format,
artifact directory structure, and checkpoint schema so that existing projects migrate with
minimal friction.

### Why Migrate?

| Reason                 | Detail                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------- |
| **Parallel execution** | Steps that do not depend on each other run concurrently, reducing total workflow time |
| **Streaming output**   | Real-time log streaming replaces buffered `echo` output                               |
| **Programmatic API**   | Import any module directly into your own Node.js scripts                              |
| **Type safety**        | TypeScript definitions ship with the package                                          |
| **Rich CLI**           | 15 flags, sub-commands (`status`, `clean`, `config`), and a TUI mode                  |
| **Cross-platform**     | Works identically on Linux, macOS, and Windows                                        |
| **Testability**        | Pure-function architecture means every module is independently testable               |

### What Stays the Same

- `.workflow-config.yaml` format — **fully backward compatible**
- `.ai_workflow/` artifact directory layout
- Checkpoint JSON format — existing checkpoints can be resumed
- The 15-step workflow model and step numbering
- Git-based auto-commit behavior for artifacts

### What Changes

- Entry point: `bash run.sh` → `ai-workflow run`
- Runtime requirement: bash + yq → Node.js ≥ 20.0.0 + npm ≥ 9.0.0
- Step customization: editing `.sh` files → extending ES module classes
- Config introspection: `yq` CLI → `ai-workflow config get <key>`

---

## Prerequisites

### System Requirements

| Requirement | Minimum               | Recommended      |
| ----------- | --------------------- | ---------------- |
| Node.js     | 20.0.0                | 22 LTS or 24 LTS |
| npm         | 9.0.0                 | 10.x             |
| Git         | 2.x                   | latest           |
| OS          | Linux, macOS, Windows | Linux / macOS    |

### Check Your Node.js Version

```bash
node --version   # must print v20.0.0 or higher
npm --version    # must print 9.0.0 or higher
```

If Node.js is not installed or is too old, install the latest LTS release:

```bash
# Using nvm (recommended — works on Linux and macOS)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc            # or ~/.zshrc
nvm install --lts
nvm use --lts

# Verify
node --version
npm --version
```

On Windows, download the LTS installer from <https://nodejs.org>.

### What You No Longer Need

- `yq` — YAML is now parsed natively in Node.js
- `jq` — bundled via the `jq_wrapper` module (optional, falls back gracefully)
- Bash 4.x+ — the JavaScript CLI runs on any OS with Node.js

> **Note**: The bash scripts (`run.sh`, `resume.sh`, `setup.sh`) are **not** required after
> migration. They can be deleted or left in place — they will not interfere.

---

## Installation & Setup

### Option A — Global Install (Recommended for CLI Use)

```bash
npm install -g ai_workflow.js
```

Verify the install:

```bash
ai-workflow --version
# ai_workflow.js v1.x.x
```

### Option B — Local Install (Recommended for Programmatic Use)

```bash
cd /path/to/your-project
npm install ai_workflow.js
```

Use via `npx` or add a `scripts` entry in `package.json`:

```json
{
  "scripts": {
    "workflow": "ai-workflow run",
    "workflow:resume": "ai-workflow resume"
  }
}
```

### Initialise the Project Structure

If this is a fresh project (or you want to add any missing directories):

```bash
ai-workflow init
```

This is the equivalent of `bash setup.sh`. It:

1. Creates `.ai_workflow/{backlog,summaries,logs,metrics,checkpoints,prompts}` directories
2. Writes a starter `.workflow-config.yaml` if one does not already exist
3. Appends sensible `.gitignore` entries for cache files

If a `.workflow-config.yaml` already exists from the bash version, `init` will detect it and
**leave it untouched**.

```bash
# Example output
✅ Project already has .workflow-config.yaml — skipping template copy
✅ Created .ai_workflow/backlog/
✅ Created .ai_workflow/checkpoints/
✅ Initialisation complete
```

---

## Configuration Migration

### The Good News: Zero Changes Required

The `.workflow-config.yaml` format is identical between bash v3.0.0 and `ai_workflow.js` v1.x.
Every field the bash version reads is understood by the JavaScript version.

**Your existing config works as-is.** Copy it (or leave it in place) and run:

```bash
ai-workflow config validate
```

You should see:

```
✅ .workflow-config.yaml is valid
```

### Sample Config (Unchanged)

```yaml
# .workflow-config.yaml — unchanged from bash v3.0.0
project:
  name: 'my-project'
  primary_language: 'javascript'
  project_kind: 'nodejs_api'

workflow:
  max_retries: 3
  timeout_seconds: 300
  dry_run: false

ai:
  provider: 'github_copilot'
  model: 'gpt-4o'

git:
  auto_commit: true
  commit_prefix: 'chore(workflow)'
```

### New Optional Fields (JavaScript-Only)

These fields are **optional**. Omitting them keeps the defaults from the bash version.

```yaml
workflow:
  # NEW: run independent steps concurrently (default: true)
  parallel: true

  # NEW: select a named performance profile
  # options: fast | balanced | thorough (default: balanced)
  profile: 'balanced'

  # NEW: enable streaming log output (default: false)
  streaming: false

  # NEW: enable terminal UI (default: false)
  tui: false
```

### Introspecting Config Values

The bash pattern of piping through `yq` is replaced by a dedicated sub-command:

```bash
# bash v3.0.0
yq '.project.primary_language' .workflow-config.yaml

# ai_workflow.js v1.x
ai-workflow config get project.primary_language
```

More config sub-commands:

```bash
ai-workflow config show                          # pretty-print the entire config
ai-workflow config get workflow.max_retries      # read a single value
ai-workflow config set workflow.max_retries 5    # write a value in-place
ai-workflow config validate                      # validate schema
```

---

## CLI Command Equivalents

### Quick-Reference Table

| bash v3.0.0                        | `ai_workflow.js` v1.x                  | Notes                       |
| ---------------------------------- | -------------------------------------- | --------------------------- |
| `bash run.sh`                      | `ai-workflow run`                      | Full workflow               |
| `bash run.sh --dry-run`            | `ai-workflow run --dry-run`            | Flag name unchanged         |
| `bash run.sh --verbose`            | `ai-workflow run --verbose`            | Flag name unchanged         |
| `bash run.sh --step=5`             | `ai-workflow run --step 5`             | Space instead of `=`        |
| `bash run.sh --step=5`             | `ai-workflow run --from-step 5`        | Preferred alias             |
| `bash resume.sh <checkpoint-file>` | `ai-workflow resume --checkpoint <id>` | ID not path                 |
| `bash setup.sh`                    | `ai-workflow init`                     |                             |
| _(no equivalent)_                  | `ai-workflow status`                   | Show current workflow state |
| _(no equivalent)_                  | `ai-workflow clean`                    | Remove artifacts            |
| `yq '.key' .workflow-config.yaml`  | `ai-workflow config get key`           |                             |
| `rm -rf .ai_workflow/`             | `ai-workflow clean --all`              |                             |

### Full Flag Comparison

**bash v3.0.0 flags (3 total):**

```bash
bash run.sh --dry-run        # preview without executing
bash run.sh --step=N         # start from step N
bash run.sh --verbose        # verbose output
```

**`ai_workflow.js` v1.x flags (15 total):**

```bash
ai-workflow run --dry-run           # preview without executing (unchanged)
ai-workflow run --verbose           # verbose output (unchanged)
ai-workflow run --streaming         # stream logs in real time (new)
ai-workflow run --step N            # run only step N
ai-workflow run --from-step N       # start from step N (preferred over --step)
ai-workflow run --to-step N         # stop after step N (new)
ai-workflow run --profile fast      # use fast performance profile (new)
ai-workflow run --no-parallel       # disable concurrent step execution (new)
ai-workflow run --tui               # terminal UI mode (new)
ai-workflow run --config PATH       # use an alternate config file (new)
ai-workflow run --output json       # machine-readable output (new)
ai-workflow run --no-color          # disable ANSI color codes (new)
ai-workflow run --timeout N         # global timeout in seconds (new)
ai-workflow run --max-retries N     # override retry count (new)
ai-workflow run --checkpoint-dir P  # override checkpoint directory (new)
```

### `ai-workflow resume`

```bash
# bash v3.0.0 — pass the checkpoint file path
bash resume.sh .ai_workflow/checkpoints/checkpoint-2026-01-15T10-30-00.json

# ai_workflow.js v1.x — pass the checkpoint ID (filename without extension)
ai-workflow resume --checkpoint checkpoint-2026-01-15T10-30-00

# Or let it auto-detect the latest checkpoint
ai-workflow resume
```

### `ai-workflow status`

There is no equivalent in the bash version. This sub-command shows:

```bash
ai-workflow status
```

```
Workflow: my-project
Status:   paused (checkpoint found)
Last run: 2026-01-15 10:30 UTC
Progress: Step 5 / 15 (33%)
Artifacts:
  Backlog:    .ai_workflow/backlog/backlog-2026-01-15.md
  Last log:   .ai_workflow/logs/run-2026-01-15T10-30.log
  Checkpoint: .ai_workflow/checkpoints/checkpoint-2026-01-15T10-30-00.json
```

### `ai-workflow clean`

```bash
# bash v3.0.0
rm -rf .ai_workflow/

# ai_workflow.js v1.x — granular cleanup
ai-workflow clean --artifacts      # remove backlog, summaries, logs
ai-workflow clean --cache          # remove cache only
ai-workflow clean --checkpoints    # remove checkpoints only
ai-workflow clean --all            # remove everything (equivalent to rm -rf .ai_workflow/)
```

---

## Artifact Compatibility

### No Data Migration Required

The `.ai_workflow/` directory structure and all file formats are **identical** between the bash
and JavaScript implementations. After installing `ai_workflow.js`, you can immediately:

- Resume from any checkpoint created by the bash version
- Read any backlog or summary Markdown file
- Reference any metric JSON produced by previous runs

### Directory Layout (Unchanged)

```
.ai_workflow/
├── backlog/          # Markdown backlog reports
├── summaries/        # AI-generated summaries
├── logs/             # Run logs
├── metrics/          # Performance JSON data
├── checkpoints/      # Pause/resume state (JSON)
├── prompts/          # Saved prompt templates
└── .incremental_cache/  # Incremental analysis cache (JS-only, safe to delete)
```

### Checkpoint Format (Unchanged)

Checkpoints are JSON files in `.ai_workflow/checkpoints/`. The schema is identical:

```json
{
  "version": "3.0.0",
  "timestamp": "2026-01-15T10:30:00.000Z",
  "project": "my-project",
  "completedSteps": [0, 1, 2, 3, 4],
  "currentStep": 5,
  "context": { ... },
  "metadata": { ... }
}
```

`ai_workflow.js` reads this format natively. Checkpoints written by `ai_workflow.js` use the
same schema and are readable by bash v3.0.0 if you need to roll back.

> **Note**: `ai_workflow.js` adds an `.incremental_cache/` subdirectory for incremental analysis
> results. This directory is safe to delete at any time and will not affect the bash version.

---

## Step Customization

### How Customisation Worked in bash v3.0.0

In the bash implementation, each step is a shell script in the `steps/` directory. To customise
step 5 you edited `steps/step_05.sh` directly:

```bash
# steps/step_05.sh (bash v3.0.0)
run_step_05() {
  log_info "Running step 5: Directory Analysis"

  # Custom logic was added inline here
  local dirs
  dirs=$(find . -maxdepth 2 -type d | grep -v node_modules)
  echo "$dirs" > .ai_workflow/logs/step05-dirs.txt

  log_success "Step 5 complete"
}
```

### How Customisation Works in `ai_workflow.js`

Each step is an ES module class. Override the `execute()` method and register your subclass
with the step registry.

#### 1. Create a Custom Step File

```javascript
// my-steps/custom-step-05.js
import { Step5DirectoryAnalyzer } from 'ai_workflow.js/steps';

export class CustomStep5 extends Step5DirectoryAnalyzer {
  /**
   * Override execute() to add or replace behaviour.
   * Call super.execute(context) to retain the original logic.
   */
  async execute(context) {
    // Run original step logic first
    const result = await super.execute(context);

    // Add custom post-processing
    const customDirs = context.projectFiles
      .filter((f) => f.startsWith('src/'))
      .map((f) => f.split('/')[1]);

    context.customDirectories = [...new Set(customDirs)];
    return result;
  }
}
```

#### 2. Register the Custom Step

```javascript
// workflow.config.js  (your project-level entry point)
import { WorkflowEngine, StepRegistry } from 'ai_workflow.js';
import { CustomStep5 } from './my-steps/custom-step-05.js';

const registry = new StepRegistry();
registry.register(5, CustomStep5); // replaces the default Step5

const engine = new WorkflowEngine({ registry });
await engine.run();
```

#### 3. Run with the Custom Config

```bash
ai-workflow run --config workflow.config.js
```

### Skipping a Step

```javascript
// Bash: comment out the call in run.sh
// run_step_05

// JavaScript: mark the step as skipped in config
```

```yaml
# .workflow-config.yaml
workflow:
  skip_steps: [5, 9]
```

Or from the CLI:

```bash
ai-workflow run --from-step 6    # skip everything before step 6
ai-workflow run --to-step 4      # run only steps 0–4
```

### Accessing Step Context

The `context` object passed to each step contains everything the bash version made available
via environment variables and global state:

```javascript
async execute(context) {
  const {
    projectRoot,        // equivalent to $PROJECT_ROOT in bash
    config,             // parsed .workflow-config.yaml
    projectKind,        // e.g. 'nodejs_api'
    techStack,          // detected languages, frameworks, tools
    gitStatus,          // current git status
    changedFiles,       // files changed since last commit
    session,            // current session metadata
    metrics,            // performance metrics collector
    logger,             // structured logger
  } = context;

  logger.info(`Running in ${projectRoot}`);
}
```

---

## Programmatic API

### Importing Modules

`ai_workflow.js` exposes a public API via its main entry point. All modules listed in
`src/index.js` can be imported directly:

```javascript
import {
  // Core
  Logger,
  Colors,
  Executor,

  // Configuration
  ConfigManager,

  // File Operations
  FileOperations,
  EditOperations,

  // Git
  GitAutomation,
  AutoCommit,
  ChangeDetector,

  // AI
  AiCache,
  PromptBuilder,
  AiHelper,

  // Orchestration
  WorkflowEngine,
  StepRegistry,
  CheckpointManager,
} from 'ai_workflow.js';
```

### Running a Workflow Programmatically

**bash v3.0.0** — you called `bash run.sh` from another script:

```bash
#!/bin/bash
cd /path/to/project
bash /path/to/ai_workflow/run.sh --verbose
```

**`ai_workflow.js` v1.x** — import and call the API:

```javascript
// my-automation.js
import { WorkflowEngine, ConfigManager } from 'ai_workflow.js';
import path from 'path';

const projectRoot = process.cwd();

// Load configuration
const config = new ConfigManager();
await config.load(path.join(projectRoot, '.workflow-config.yaml'));

// Run the workflow
const engine = new WorkflowEngine({ config, projectRoot });

engine.on('step:start', ({ step }) => console.log(`→ Starting step ${step}`));
engine.on('step:complete', ({ step, duration }) =>
  console.log(`✅ Step ${step} completed in ${duration}ms`)
);
engine.on('step:error', ({ step, error }) =>
  console.error(`❌ Step ${step} failed: ${error.message}`)
);

const result = await engine.run();

if (result.success) {
  console.log(`Workflow complete in ${result.totalDuration}ms`);
  process.exit(0);
} else {
  console.error('Workflow failed:', result.error);
  process.exit(1);
}
```

### Reading and Writing Configuration

```javascript
import { ConfigManager } from 'ai_workflow.js';

const config = new ConfigManager();
await config.load('.workflow-config.yaml');

// Read a value (replaces: yq '.project.primary_language' .workflow-config.yaml)
const lang = config.get('project.primary_language');
console.log(lang); // 'javascript'

// Write a value in place
await config.set('workflow.max_retries', 5);
await config.save();
```

### Resuming from a Checkpoint

```javascript
import { WorkflowEngine, CheckpointManager } from 'ai_workflow.js';

const checkpointManager = new CheckpointManager({
  checkpointDir: '.ai_workflow/checkpoints',
});

// Load the latest checkpoint (or pass a specific ID)
const checkpoint = await checkpointManager.loadLatest();

if (checkpoint) {
  console.log(`Resuming from step ${checkpoint.currentStep}`);
  const engine = new WorkflowEngine({ checkpoint });
  await engine.resume();
} else {
  console.log('No checkpoint found — running from the beginning');
  const engine = new WorkflowEngine();
  await engine.run();
}
```

### Using Individual Modules

Any module can be used in isolation. For example, using only the git automation module:

```javascript
import { GitAutomation } from 'ai_workflow.js';

const git = new GitAutomation({ projectRoot: process.cwd() });

const status = await git.getStatus();
console.log('Modified files:', status.modified);

const diff = await git.getDiff({ staged: true });
console.log('Staged diff:', diff);
```

### TypeScript Support

Type definitions are available at `src/types/public-api.d.ts` and are automatically resolved
when `ai_workflow.js` is installed as a dependency:

```typescript
// my-automation.ts
import type { WorkflowConfig, StepResult } from 'ai_workflow.js';
import { WorkflowEngine } from 'ai_workflow.js';

const config: WorkflowConfig = {
  steps: [], // populate with StepDefinition objects
  parallel: true,
  streamingEnabled: false,
};

const engine = new WorkflowEngine(config);
const results: Record<string, StepResult> = await engine.run();

const failed = Object.values(results).filter((r) => !r.success);
if (failed.length > 0) {
  console.error(
    'Failed steps:',
    failed.map((r) => r.error)
  );
}
```

---

## Known Differences

### 1. Parallel Step Execution (New)

The bash version runs steps sequentially. `ai_workflow.js` runs independent steps concurrently
by default, which can significantly reduce total workflow time.

```bash
# Disable parallel execution to match bash behaviour exactly
ai-workflow run --no-parallel
```

Or in config:

```yaml
workflow:
  parallel: false
```

> **Impact**: If your custom steps assumed a strict sequential execution order and write to
> shared files without coordination, disable parallel execution or add file locks.

### 2. Streaming Output (New)

The bash version buffers output per step. The JavaScript version supports real-time streaming:

```bash
ai-workflow run --streaming
```

Streaming output goes to stdout line-by-line, which is useful for piping into log aggregators
or CI systems that display live output.

### 3. Terminal UI (New)

```bash
ai-workflow run --tui
```

The TUI shows a live dashboard: step progress bars, elapsed time, current log tail, and
resource usage. There is no equivalent in the bash version.

### 4. Node.js Runtime Dependency (New Requirement)

The bash version requires only bash ≥ 4 and optionally `yq`/`jq`. The JavaScript version
requires Node.js ≥ 20.0.0 and npm ≥ 9.0.0. On minimal CI images you may need to add a
Node.js installation step.

**GitHub Actions example:**

```yaml
# .github/workflows/workflow.yml
jobs:
  ai-workflow:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install -g ai_workflow.js
      - run: ai-workflow run
```

### 5. Config Parsing Differences

| Behaviour       | bash v3.0.0 (yq)       | ai_workflow.js v1.x (js-yaml) |
| --------------- | ---------------------- | ----------------------------- |
| Missing file    | Exits with error       | Exits with error              |
| Invalid YAML    | `yq` error message     | JS YAML parser error          |
| Unknown field   | Silently ignored       | Silently ignored              |
| Null values     | `null` or empty string | `null`                        |
| Boolean strings | `"true"` / `"false"`   | Native booleans               |

If your config contains YAML boolean values written as quoted strings (`"true"`, `"false"`),
the JavaScript parser will treat them as string literals, not booleans. Unquote them:

```yaml
# bash v3.0.0 — worked because yq coerced strings
dry_run: "false"

# ai_workflow.js v1.x — use native YAML boolean
dry_run: false
```

### 6. Log Format

The bash version writes plain-text logs with ANSI colour codes via `echo`. The JavaScript
version writes structured logs to `.ai_workflow/logs/` with an optional JSON format:

```bash
ai-workflow run --output json    # machine-readable JSON lines
ai-workflow run --no-color       # plain text without ANSI codes (CI-friendly)
```

### 7. Exit Codes

Exit codes are the same: `0` for success, non-zero for failure. The JavaScript version adds
a richer set of specific exit codes:

| Code | Meaning                |
| ---- | ---------------------- |
| `0`  | Success                |
| `1`  | General error          |
| `2`  | Configuration error    |
| `3`  | Step execution failure |
| `4`  | Checkpoint not found   |
| `5`  | Timeout                |

---

## Troubleshooting

### ESM Module Errors

**Symptom:**

```
SyntaxError: Cannot use import statement in a module
```

**Cause**: Your project's `package.json` does not declare `"type": "module"`, so Node.js
treats `.js` files as CommonJS.

**Fix A** — Add `"type": "module"` to `package.json`:

```json
{
  "type": "module"
}
```

**Fix B** — Use `.mjs` extension for files that import `ai_workflow.js`.

**Fix C** — Use the CommonJS compatibility shim:

```javascript
// my-script.cjs
const { createRequire } = require('module');
const require_ = createRequire(import.meta.url);
// Use dynamic import instead
(async () => {
  const { WorkflowEngine } = await import('ai_workflow.js');
  const engine = new WorkflowEngine();
  await engine.run();
})();
```

---

### Node.js Version Too Old

**Symptom:**

```
Error: The engine "node" is incompatible with this module.
Expected version ">=20.0.0". Got "16.x.x"
```

**Fix**: Upgrade Node.js to v20 LTS or later.

```bash
# With nvm
nvm install 20
nvm use 20
nvm alias default 20

# Verify
node --version   # v20.x.x
```

---

### `ai-workflow` Command Not Found After Global Install

**Symptom:**

```bash
ai-workflow run
# bash: ai-workflow: command not found
```

**Cause**: npm's global `bin` directory is not on your `PATH`.

**Fix**:

```bash
# Find the npm global bin directory
npm bin -g
# e.g. /home/user/.npm-global/bin

# Add it to PATH in ~/.bashrc or ~/.zshrc
export PATH="$HOME/.npm-global/bin:$PATH"
source ~/.bashrc

# Verify
which ai-workflow
ai-workflow --version
```

**Alternative**: Use `npx` without a global install:

```bash
npx ai_workflow.js run
```

---

### Config YAML Fails to Parse

**Symptom:**

```
Error: .workflow-config.yaml: YAMLException: bad indentation
```

**Cause**: The JavaScript YAML parser is stricter than `yq` about indentation.

**Fix**: Validate and auto-fix indentation:

```bash
# Check the file with Node.js directly
node -e "
const yaml = require('js-yaml');
const fs = require('fs');
yaml.load(fs.readFileSync('.workflow-config.yaml', 'utf8'));
console.log('YAML is valid');
"

# Or use the built-in validator
ai-workflow config validate
```

Common YAML mistakes caught by the JS parser:

- Tabs used instead of spaces for indentation
- Inconsistent indentation depth
- Unquoted special characters (`:`, `#`, `*`, `&`)

---

### Checkpoint Not Found on Resume

**Symptom:**

```
Error: No checkpoint found. Run 'ai-workflow run' first.
```

**Cause A**: The checkpoint was created by `bash resume.sh` and the path passed is a file
path, not an ID.

**Fix**: Pass only the filename stem (without `.json`):

```bash
# bash v3.0.0 — path to file
bash resume.sh .ai_workflow/checkpoints/checkpoint-2026-01-15T10-30-00.json

# ai_workflow.js v1.x — ID only
ai-workflow resume --checkpoint checkpoint-2026-01-15T10-30-00
```

**Cause B**: The checkpoint directory was cleaned.

**Fix**: Run from the beginning:

```bash
ai-workflow run
```

---

### Parallel Steps Causing File Conflicts

**Symptom**: Two steps write to the same file simultaneously, causing corruption or race
conditions.

**Fix**: Disable parallel execution:

```bash
ai-workflow run --no-parallel
```

Or disable for specific steps by declaring them as sequential in your custom step registry:

```javascript
registry.register(5, MyStep5, { sequential: true });
registry.register(6, MyStep6, { sequential: true, dependsOn: [5] });
```

---

### Steps Slower Than Bash Version

**Symptom**: The JavaScript workflow takes noticeably longer than `bash run.sh`.

**Possible causes and fixes**:

1. **Parallel execution disabled** — ensure `workflow.parallel: true` in config or remove
   `--no-parallel` flag.

2. **Wrong profile** — switch to the `fast` profile:

   ```bash
   ai-workflow run --profile fast
   ```

3. **Node.js startup overhead on many small steps** — use the `balanced` or `thorough` profile
   only when needed; use `fast` for development iterations.

4. **Cold cache** — the first run after a clean is slower because the incremental cache is
   empty. Subsequent runs are faster.

---

## Getting Help

| Resource                    | Link                                                               |
| --------------------------- | ------------------------------------------------------------------ |
| User Guide                  | [`docs/guides/USER_GUIDE.md`](USER_GUIDE.md)                       |
| Configuration Reference     | [`docs/guides/CONFIGURATION_GUIDE.md`](CONFIGURATION_GUIDE.md)     |
| CLI Reference               | [`docs/reference/CLI_REFERENCE.md`](../reference/CLI_REFERENCE.md) |
| Architecture Overview       | [`docs/architecture/OVERVIEW.md`](../architecture/OVERVIEW.md)     |
| Troubleshooting Guide       | [`docs/guides/TROUBLESHOOTING.md`](TROUBLESHOOTING.md)             |
| Developer Guide             | [`docs/guides/DEVELOPER_GUIDE.md`](DEVELOPER_GUIDE.md)             |
| Testing Guide               | [`docs/guides/TESTING_GUIDE.md`](TESTING_GUIDE.md)                 |
| Original bash `ai_workflow` | <https://github.com/mpbarbosa/ai_workflow>                         |
| GitHub Issues               | <https://github.com/mpbarbosa/ai_workflow.js/issues>               |

### Reporting Migration Issues

If you encounter a problem that is specific to migration from the bash version, open a GitHub
issue and include:

1. Your `node --version` and `npm --version`
2. The relevant section of `.workflow-config.yaml` (redact secrets)
3. The exact error message and stack trace
4. Whether the same operation worked with `bash run.sh`

---

_Last Updated: 2026-03-11 · `ai_workflow.js` v1.6.0 · [Edit this page](https://github.com/mpbarbosa/ai_workflow.js/edit/main/docs/guides/MIGRATION_GUIDE.md)_
