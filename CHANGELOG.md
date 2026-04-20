## CHANGELOG

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- **Step 12 git commit prompt grounding** (`.workflow_core/config/ai_helpers/workflow_steps.yaml`) — Hardened the prompt so partial evidence no longer justifies file-specific body claims, inferred benefits, or a forced "No breaking changes detected" line. The prompt now prefers shorter commit messages when the visible diff is insufficient for a grounded body or breaking-change conclusion.
- **Step 1.5 Copilot instructions prompt grounding** (`.workflow_core/config/ai_helpers/workflow_steps.yaml`) — Hardened the prompt so repo-specific Copilot guidance claims must be supported by the surfaced repo-facts block or the visible current file content. `supported guidance` findings now require explicit repo-fact support, invented repo-fact citations are disallowed, and findings for absent current-file topics are blocked unless the omission is explicitly required by the task. Unsupported-but-plausible details are now omitted or generalized instead of being restated as verified repository facts.

## [2.2.12] - 2026-04-10

### Changed

- **`.workflow_core` submodule bumped to v1.4.1** (commit `2055f83`): Contains prompt-template quality fixes for steps 3, 4, 8, 10, 12, 13 and `version_manager_prompt`; new `python_developer_prompt` specialist persona (v7.0.0); four new prompt roles (`python_developer`, `workflow_orchestration_engineer`, `workflow_step_engineer`, `copilot_sdk_engineer`); and `listPersonas()` / `validateConfig()` additions to the TypeScript loader API. These prompt improvements are consumed automatically at runtime — no code changes are required for the template fixes.

### Added

- **`listPersonas(parsedYaml)` pure function** (`src/lib/ai_prompt_builder.js`): Returns a sorted `string[]` of all persona keys in a parsed `ai_helpers.yaml` object. An entry is treated as a persona if it is a plain object with a `role_ref` string property. Mirrors `.workflow_core/src/loader.ts → listPersonas()`. Exported from `src/index.js` as `listPersonas`.
- **`validateConfig(parsedYaml, roles)` pure function** (`src/lib/ai_prompt_builder.js`): Validates that every persona's `role_ref` resolves to an own-property of `roles.roles`. Unlike `resolveAllRoleRefs` (which throws on the first bad reference), this function collects **all** unresolvable `role_ref` errors and returns `{ valid: boolean, errors: string[] }`. Suitable for pre-flight CI checks. Mirrors `.workflow_core/src/loader.ts → validateConfig()`. Exported from `src/index.js` as `validateAiHelpersConfig`.

### Fixed

- **`resolveRoleRef` prototype-chain false positive** (`src/lib/ai_prompt_builder.js`): The truthiness check `if (!roleEntry)` could silently resolve prototype-chain keys such as `"constructor"` or `"toString"` to real JavaScript functions. Replaced with `Object.prototype.hasOwnProperty.call(roles.roles, persona.role_ref)`, matching the fix applied in `.workflow_core/src/loader.ts`. Two regression tests added.

### Tests

- **`resolveRoleRef` prototype-chain tests** (`test/lib/ai_prompt_builder.test.js`): Added two tests verifying that `"constructor"` and `"toString"` role_refs throw instead of silently resolving to prototype functions.
- **`listPersonas` test suite** (6 tests): Sorted output, exclusion of non-persona entries, exclusion of arrays, empty/null input, deterministic order.
- **`validateConfig` test suite** (8 tests): All-valid config, single error, multi-error (sorted), prototype-chain key rejection, non-persona entries ignored, empty YAML, null YAML, missing roles object. Test count: prior count + 16.

### Added

- **`serializeWorkflow(workflow, format)` pure function** (`src/orchestrator/workflow_engine.js`): Converts a workflow object to a JSON or YAML string. Accepts `"json"`, `"yaml"`, `"yml"` (with or without a leading dot). Throws `SystemError` for unsupported formats or serialization failures. This is the inverse of `parseWorkflowFile` introduced in v2.1.0.
- **`WorkflowEngine.saveWorkflow(path)` method** (`src/orchestrator/workflow_engine.js`): Writes the currently loaded workflow to a `.json`, `.yaml`, or `.yml` file. Extension validation happens before the write so an unsupported-extension error is immediate. Throws `SystemError` if no workflow is loaded or the write fails.
- **`serializeWorkflow` re-exported** from `src/index.js` (public API, consistent with `parseWorkflowFile`).

### Tests

- **`serializeWorkflow` pure-function tests** (`test/orchestrator/workflow_engine.test.js`): 8 unit tests covering JSON/YAML/yml output, JSON and YAML round-trips through `parseWorkflowFile`, leading-dot format, and error paths for unsupported/empty formats.
- **`saveWorkflow` integration tests**: 5 tests covering no-workflow-loaded error, unsupported extension, JSON round-trip v

---

## CHANGELOG

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.2.12] - 2026-04-10

### Changed

- **`.workflow_core` submodule bumped to v1.4.1** (commit `2055f83`): Contains prompt-template quality fixes for steps 3, 4, 8, 10, 12, 13 and `version_manager_prompt`; new `python_developer_prompt` specialist persona (v7.0.0); four new prompt roles (`python_developer`, `workflow_orchestration_engineer`, `workflow_step_engineer`, `copilot_sdk_engineer`); and `listPersonas()` / `validateConfig()` additions to the TypeScript loader API. These prompt improvements are consumed automatically at runtime — no code changes are required for the template fixes.

### Added

- **`listPersonas(parsedYaml)` pure function** (`src/lib/ai_prompt_builder.js`): Returns a sorted `string[]` of all persona keys in a parsed `ai_helpers.yaml` object. An entry is treated as a persona if it is a plain object with a `role_ref` string property. Mirrors `.workflow_core/src/loader.ts → listPersonas()`. Exported from `src/index.js` as `listPersonas`.
- **`validateConfig(parsedYaml, roles)` pure function** (`src/lib/ai_prompt_builder.js`): Validates that every persona's `role_ref` resolves to an own-property of `roles.roles`. Unlike `resolveAllRoleRefs` (which throws on the first bad reference), this function collects **all** unresolvable `role_ref` errors and returns `{ valid: boolean, errors: string[] }`. Suitable for pre-flight CI checks. Mirrors `.workflow_core/src/loader.ts → validateConfig()`. Exported from `src/index.js` as `validateAiHelpersConfig`.

### Fixed

- **`resolveRoleRef` prototype-chain false positive** (`src/lib/ai_prompt_builder.js`): The truthiness check `if (!roleEntry)` could silently resolve prototype-chain keys such as `"constructor"` or `"toString"` to real JavaScript functions. Replaced with `Object.prototype.hasOwnProperty.call(roles.roles, persona.role_ref)`, matching the fix applied in `.workflow_core/src/loader.ts`. Two regression tests added.

### Tests

- **`resolveRoleRef` prototype-chain tests** (`test/lib/ai_prompt_builder.test.js`): Added two tests verifying that `"constructor"` and `"toString"` role_refs throw instead of silently resolving to prototype functions.
- **`listPersonas` test suite** (6 tests): Sorted output, exclusion of non-persona entries, exclusion of arrays, empty/null input, deterministic order.
- **`validateConfig` test suite** (8 tests): All-valid config, single error, multi-error (sorted), prototype-chain key rejection, non-persona entries ignored, empty YAML, null YAML, missing roles object. Test count: prior count + 16.

### Added

- **`serializeWorkflow(workflow, format)` pure function** (`src/orchestrator/workflow_engine.js`): Converts a workflow object to a JSON or YAML string. Accepts `"json"`, `"yaml"`, `"yml"` (with or without a leading dot). Throws `SystemError` for unsupported formats or serialization failures. This is the inverse of `parseWorkflowFile` introduced in v2.1.0.
- **`WorkflowEngine.saveWorkflow(path)` method** (`src/orchestrator/workflow_engine.js`): Writes the currently loaded workflow to a `.json`, `.yaml`, or `.yml` file. Extension validation happens before the write so an unsupported-extension error is immediate. Throws `SystemError` if no workflow is loaded or the write fails.
- **`serializeWorkflow` re-exported** from `src/index.js` (public API, consistent with `parseWorkflowFile`).

### Tests

- **`serializeWorkflow` pure-function tests** (`test/orchestrator/workflow_engine.test.js`): 8 unit tests covering JSON/YAML/yml output, JSON and YAML round-trips through `parseWorkflowFile`, leading-dot format, and error paths for unsupported/empty formats.
- **`saveWorkflow` integration tests**: 5 tests covering no-workflow-loaded error, unsupported extension, JSON round-trip v
