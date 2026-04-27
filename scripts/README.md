# Scripts and Entry Points

This directory contains automation scripts for development, testing, validation, documentation generation, and release workflows. The published CLI command is exposed through [`../bin/ai-workflow.js`](../bin/ai-workflow.js).

## Executable Entry Points

| Path                 | Invocation                          | Purpose                                             | Related docs                                     |
| -------------------- | ----------------------------------- | --------------------------------------------------- | ------------------------------------------------ |
| `bin/ai-workflow.js` | `ai-workflow <command>`             | Package CLI entry point declared in `package.json`. | [CLI_USAGE_GUIDE.md](../docs/CLI_USAGE_GUIDE.md) |
| `bin/ai-workflow.js` | `node bin/ai-workflow.js <command>` | Direct local invocation without a global install.   | [CLI_USAGE_GUIDE.md](../docs/CLI_USAGE_GUIDE.md) |

The CLI entry point requires Node.js and the project dependencies to be installed. It delegates to `src/cli/index.js`, writes command output to stdout/stderr, and exits non-zero when startup or command execution fails.

## Shell Scripts

| Script                         | Purpose                                                        | Guide                                                       |
| ------------------------------ | -------------------------------------------------------------- | ----------------------------------------------------------- |
| `scripts/setup.sh`             | Set up development environment (deps, submodules, directories) | [SETUP.md](../docs/guides/SETUP.md)                         |
| `scripts/test-integration.sh`  | Run integration tests with optional coverage report            | [TEST_INTEGRATION.md](../docs/guides/TEST_INTEGRATION.md)   |
| `scripts/validate.sh`          | Full validation pipeline (lint, format, tests, versions)       | [VALIDATE.md](../docs/guides/VALIDATE.md)                   |
| `scripts/prepare-release.sh`   | Prepare a versioned release (tests, version bump, changelog)   | [PREPARE_RELEASE.md](../docs/guides/PREPARE_RELEASE.md)     |
| `scripts/cleanup_artifacts.sh` | Clean up `.ai_workflow/` artifacts by age/type                 | [CLEANUP_ARTIFACTS.md](../docs/guides/CLEANUP_ARTIFACTS.md) |
| `scripts/run-tests-docker.sh`  | Run the test suite inside a Docker container (requires Docker) | —                                                           |
| `scripts/colors.sh`            | ANSI colour helpers sourced by other shell scripts             | —                                                           |

## Node.js Scripts (via npm)

These scripts are invoked through `npm run <script>` as defined in `package.json`.

### Testing

| npm script             | Command                                     | Purpose                                                           |
| ---------------------- | ------------------------------------------- | ----------------------------------------------------------------- |
| `test`                 | `jest`                                      | Run full test suite                                               |
| `test:watch`           | `jest --watch`                              | Run tests in watch mode                                           |
| `test:coverage`        | `jest --coverage`                           | Run tests with coverage report                                    |
| `test:unit`            | `jest` (ignores orchestrator)               | Run unit tests only (fast)                                        |
| `test:integration`     | `jest` (orchestrator only)                  | Run orchestrator integration tests                                |
| `test:fast`            | alias for `test:unit`                       | Quick feedback during development                                 |
| `test:slow`            | integration + coverage                      | Full integration run with coverage                                |
| `test:ci`              | `test:fast` + `test:slow`                   | Complete CI test pipeline                                         |
| `test:docker`          | `scripts/run-tests-docker.sh`               | Run full test suite inside Docker                                 |
| `test:docker:coverage` | `scripts/run-tests-docker.sh -- --coverage` | Run tests with coverage inside Docker                             |
| `test:docker:e2e`      | `scripts/run-tests-docker.sh --e2e`         | Run e2e tests inside Docker                                       |
| `test:smoke:copilot`   | `node scripts/smoke-test-copilot-sdk.js`    | Smoke-test the GitHub Copilot SDK connection and available models |

### Validation

| npm script          | Command                                  | Purpose                                               |
| ------------------- | ---------------------------------------- | ----------------------------------------------------- |
| `validate`          | `validate:exports` + `validate:versions` | Run all validators                                    |
| `validate:exports`  | `scripts/validate-exports.js`            | Verify all public exports are correctly defined       |
| `validate:versions` | `scripts/check-version-consistency.js`   | Check version numbers are consistent across all files |

### Analysis

| npm script                | Command                             | Purpose                                       |
| ------------------------- | ----------------------------------- | --------------------------------------------- |
| `analyze:readability`     | `scripts/analyze-readability.js`    | Analyse code readability metrics              |
| `analyze:changes`         | `scripts/analyze-change-impact.js`  | Analyse impact of recent git changes          |
| `analyze:changes:verbose` | same with `--verbose`               | Verbose change impact output                  |
| `analyze:changes:json`    | same with `--json`                  | JSON-formatted change impact output           |
| `analyze:jsdoc`           | `scripts/analyze-jsdoc-coverage.js` | Report JSDoc coverage across all source files |

### Code Quality

| npm script       | Command                                | Purpose                                          |
| ---------------- | -------------------------------------- | ------------------------------------------------ |
| `lint`           | `eslint .`                             | Check code style                                 |
| `lint:fix`       | `eslint . --fix`                       | Auto-fix linting issues                          |
| `lint:md`        | `node scripts/fix-markdown.js --check` | Check markdown files for linting violations      |
| `lint:md:fix`    | `node scripts/fix-markdown.js`         | Auto-fix markdown linting violations             |
| `fix:md`         | `node scripts/fix-markdown.js`         | Alias for `lint:md:fix`                          |
| `format`         | `prettier --write`                     | Format all JS/JSON/MD files                      |
| `format:check`   | `prettier --check`                     | Check formatting without modifying files         |
| `security:audit` | `node scripts/security-audit.js`       | Run a security audit of dependencies and configs |

### Lifecycle (automatic)

| npm script       | Triggered by  | Purpose                                                          |
| ---------------- | ------------- | ---------------------------------------------------------------- |
| `prepare`        | `npm install` | Install git hooks via Husky                                      |
| `prepublishOnly` | `npm publish` | Run validate + lint + full CI tests before publish               |
| `prepack`        | `npm pack`    | Validate exports before packaging                                |
| `postinstall`    | `npm install` | Run `scripts/postinstall.js` to verify environment after install |

## Documentation Tooling

| Path                                         | Invocation                                        | Purpose                                                                   | Prerequisites                                         | Outputs / side effects                                             |
| -------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------ |
| `scripts/postprocess-typedoc-media-links.js` | `node scripts/postprocess-typedoc-media-links.js` | Rewrites broken relative links in generated TypeDoc media markdown files. | Generated TypeDoc output under `docs/api/html/media/` | Updates matching files in place and prints how many files changed. |

This script is also part of `npm run docs:generate`, which runs `typedoc --options typedoc.json && node scripts/postprocess-typedoc-media-links.js`.
