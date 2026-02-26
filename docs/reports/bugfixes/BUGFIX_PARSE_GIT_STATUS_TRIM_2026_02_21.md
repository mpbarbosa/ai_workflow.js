# Bug Fix: `parseGitStatus` Corrupts Filenames Starting with R When First Status Line Is Unstaged

**Date**: 2026-02-21  
**Severity**: High — incorrect file paths reach the incremental doc processor, causing ENOENT warnings and silently skipping documentation analysis  
**Component**: `src/lib/git_automation.js` — `parseGitStatus` pure function  
**Status**: ✅ Fixed

---

## Symptom

When the first file in `git status --porcelain` output had an unstaged-only change
(status line starts with a space, e.g. ` M README.md`), the workflow produced warnings
like:

```
⚠ Step1: Failed to read file EADME.md: ENOENT: no such file or directory, open 'EADME.md'
⚠ Step1: Failed to read file src/README.md: ENOENT: no such file or directory, open 'src/README.md'
Step1: Detected 0 changed files, 0 unchanged
✓ All documentation files unchanged - skipping AI analysis
```

The file `EADME.md` does not exist — it is `README.md` with its first character (`R`)
silently stripped. As a result the incremental hash check found zero readable files,
reported zero changes, and skipped AI documentation analysis entirely even though
documentation files had changed.

---

## Root Cause

`parseGitStatus` called `.trim()` on the **entire** output string before splitting
into lines:

```js
// BEFORE (buggy)
const lines = output
  .trim() // ← strips the leading space from the whole string
  .split('\n')
  .filter((line) => line.length > 0);
```

Git's porcelain status format uses **two mandatory status characters** at positions 0
and 1, followed by a space separator at position 2, then the file path starting at
position 3:

```
XY<space>filepath
```

When the first file in the output is unstaged-only (e.g., ` M README.md`), position 0
is a **meaningful space** (no staged change). Calling `.trim()` on the whole output
stripped that leading space, turning ` M README.md` into `M README.md`:

| Position | Before trim               | After trim (bug)                        |
| -------- | ------------------------- | --------------------------------------- |
| 0        | `' '` (no staged change)  | `'M'` (misread as staged)               |
| 1        | `'M'` (unstaged modified) | `' '`                                   |
| 2        | `' '` (separator)         | `'R'` ← first char of filename          |
| 3+       | `README.md`               | `EADME.md` ← filename with `R` stripped |

Consequences:

1. `staged` received `{ file: 'EADME.md' }` instead of `unstaged` receiving `{ file: 'README.md' }`.
2. `calculateFileHash('EADME.md')` → ENOENT (file does not exist).
3. The incremental processor saw 0 readable files → 0 changes → skipped AI analysis.

---

## Fix

Replace `.trim().split('\n')` with `.split(/\r?\n/)`. This:

- Preserves leading spaces on every line (they are part of the git format).
- Handles both Unix (`\n`) and Windows (`\r\n`) line endings.
- Empty lines are still filtered by the existing `.filter((line) => line.length > 0)`.

```js
// AFTER (fixed)
// Do NOT call .trim() on the full output — git status lines start with meaningful
// spaces (e.g. " M file" means unstaged-modified), and trimming the output would
// strip that leading space from the very first line, shifting the XY status columns
// and producing corrupt file paths (e.g. "README.md" → "EADME.md").
const lines = output.split(/\r?\n/).filter((line) => line.length > 0);
```

### Files Changed

| File                              | Change                                                                              |
| --------------------------------- | ----------------------------------------------------------------------------------- |
| `src/lib/git_automation.js`       | Replace `.trim().split('\n')` with `.split(/\r?\n/)` in `parseGitStatus`            |
| `test/lib/git_automation.test.js` | Fix stale test expectation (written against buggy behavior); add 3 regression tests |

---

## Test Updates

### Stale test corrected

The existing `'parses unstaged files'` test expected only 1 unstaged entry for
input ` M src/app.js\n D src/old.js` because the bug caused the first line to be
misread as staged. The test comment even noted `// ' M' has space first` but the
assertion did not match the intended behaviour. Updated to assert 2 unstaged entries:

```js
// BEFORE (matched the bug)
expect(result.unstaged).toHaveLength(1); // Only 'D' is deletion, ' M' has space first

// AFTER (correct)
expect(result.unstaged).toHaveLength(2); // both ' M' and ' D' are unstaged changes
expect(result.unstaged[0]).toEqual({ file: 'src/app.js', status: 'modified' });
expect(result.unstaged[1]).toEqual({ file: 'src/old.js', status: 'deleted' });
```

### Regression tests added

Three new tests guard against re-introduction of this bug:

1. **`correctly parses file starting with R when first status line is unstaged ( M)`** —
   the exact scenario that caused `README.md` → `EADME.md`.

2. **`preserves full filename when output begins with a space-prefixed status line`** —
   verifies multiple unstaged files are all classified correctly when the output
   starts with a space.

3. **`handles Windows CRLF line endings in git status output`** —
   verifies the `\r?\n` split handles `\r\n` line endings without leaving a stray
   `\r` at the end of file paths.

---

## Prevention

- The `parseGitStatus` function now includes a comment explaining why `.trim()` must
  not be applied to the full output, making the constraint visible to future editors.
- Regression tests directly encode the failure mode (file starting with `R` as first
  unstaged entry) so any future regression is caught immediately.
