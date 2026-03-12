# Roadmap

This file tracks minor future-proofing improvements and non-critical recommendations identified
during AI-assisted code review (workflow step validation).

---

## `scripts/security-audit.js`

> Source: step_18 log analysis (`code_quality_analyst`)

### Extend scan scope to cover `scripts/` directory

Currently `checkHardcodedSecrets()`, `checkCommandInjection()`, and `checkPathTraversal()` only
scan `src/`. The `scripts/` directory contains production-adjacent code that runs at install time
and in CI and should be included in all static security checks.

### Surface `moderate` and `low` npm audit findings in the report

`checkDependencies()` logs moderate/low npm audit counts to the console but does not push them into
the `findings` object. This means they are excluded from `generateReport()` totals and summary
output. Low/moderate findings should be added to `findings.low` so they appear in the structured
report and downstream tooling can act on them.

### Add `--json` output mode for CI integration

A `--json` flag that writes the `findings` object to stdout (or a file) as structured JSON would
enable downstream CI tools (e.g., GitHub SARIF upload, Slack alerts) to consume audit results
without screen-scraping the human-readable output.

---

## `scripts/postinstall.js` / `test/scripts/postinstall.test.js`

> Source: step_07 log analysis (`test_engineer`)

### Use `os.tmpdir()` for test fixture isolation

The current test suite creates a temporary `node_modules/` tree inside the project's own directory
(`test/node_modules/`). This leaks into the workspace and may interfere with npm or IDEs. Use
`fs.mkdtempSync(path.join(os.tmpdir(), 'postinstall-'))` for fully isolated, OS-managed temp dirs,
and clean up with `fs.rmSync(tmpDir, { recursive: true })` in `afterAll`.

### Add missing edge-case unit tests

The following scenarios are not currently covered:

- **Multiple export keys**: when the `exports` field contains more than one key that matches the
  patching condition, all matching keys should be updated (tests iteration over `Object.keys(exports_)`).
- **`console.log` spy**: verify that a log message is emitted when each patch is applied
  (`jest.spyOn(console, 'log')`).
- **Idempotency**: calling `patchAll()` twice on an already-patched `package.json` should not
  corrupt the file or emit extra log lines.
- **vscode-jsonrpc partial exports**: patch applies correctly when the `exports` object exists but
  lacks the `./node` key (currently the guard checks `exports['./node']` but the iteration behaviour
  when the key is absent is not tested).

### Add integration test running postinstall as a child process

A black-box integration test that spawns `node scripts/postinstall.js` as a child process against a
real (minimal) `node_modules/` fixture confirms the script works end-to-end independent of the
module import mechanism. This complements the unit tests that call `patchAll()` directly.
