# Roadmap

This file tracks minor future-proofing improvements and non-critical recommendations identified
during AI-assisted code review (workflow step validation).

---

## ✅ `scripts/security-audit.js` — COMPLETED in v1.9.4

> Source: step_18 log analysis (`code_quality_analyst`)

### ~~Extend scan scope to cover `scripts/` directory~~ ✅

`getAllJSFiles()` now accepts a string or an array of directories and silently skips missing
directories. All three scan functions (`checkHardcodedSecrets`, `checkCommandInjection`,
`checkPathTraversal`) scan both `src/` and `scripts/`.

### ~~Surface `moderate` and `low` npm audit findings in the report~~ ✅

`checkDependencies()` now pushes moderate findings to `findings.medium[]` and low findings to
`findings.low[]`. They appear in `generateReport()` totals and the `--json` output.

### ~~Add `--json` output mode for CI integration~~ ✅

`node scripts/security-audit.js --json` writes the `findings` object as structured JSON to stdout
and suppresses all human-readable output.

---

## ✅ `scripts/postinstall.js` / `test/scripts/postinstall.test.js` — COMPLETED in v1.9.4

> Source: step_07 log analysis (`test_engineer`)

### ~~Use `os.tmpdir()` for test fixture isolation~~ ✅

Fixtures are created with `fs.mkdtempSync(path.join(os.tmpdir(), 'postinstall-'))` in `beforeAll`
and removed in `afterAll`.

### ~~Add missing edge-case unit tests~~ ✅

Added: multiple export keys, `console.log` spy, idempotency, vscode-jsonrpc partial exports.

### ~~Add integration test running postinstall as a child process~~ ✅

A `describe('integration – child process')` block spawns `node scripts/postinstall.js` via
`spawnSync` against a real fixture in `os.tmpdir()` and asserts exit code 0 and correct patches.
