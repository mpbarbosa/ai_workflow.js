# Cross-Step Integration Tests

This directory contains integration tests that verify correct behaviour **across
workflow step boundaries** — specifically the data contracts and pure-function
handoffs between consecutive steps.

## What is covered

| Test file                       | Steps exercised   | What it verifies                                                                                      |
| ------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------- |
| `detection-to-analysis.test.js` | step_00 → step_02 | Project-detection output (analyzePackageJson, detectProjectKind) feeds the analysis context correctly |
| `test-review-to-gen.test.js`    | step_07 → step_08 | Test-strategy results produced by step_07 drive test-generation in step_08                            |
| `git-finalization.test.js`      | step_06 → step_12 | Git-automation pure functions used by step_06 are consistent with the finalization logic in step_12   |

## Running these tests

```bash
# Run all cross-step integration tests
npx jest test/integration/cross-step --no-coverage

# Run a single file
npx jest test/integration/cross-step/detection-to-analysis.test.js --no-coverage
```

## Guidelines for new cross-step tests

- Name the file `<source-step>-to-<target-step>.test.js` (e.g. `config-to-metrics.test.js`).
- Import only **pure functions** from `src/`; do not instantiate wrapper classes or touch the file system.
- Keep each test focused on the **data contract** at the step boundary, not on the internal logic of either step (those are covered by unit tests under `test/lib/` and `test/steps/`).
