# Partition + Synthesis Guide

**Version**: 1.0.0
**Last Updated**: 2026-04-23

## Overview

This guide describes the reusable solution implemented in Step 04 to prevent
AI review quality from degrading when a step must split a large prompt into
multiple partitions.

The pattern is intended for any step that:

- reviews many files in one logical scope,
- has to split prompts to stay under token or payload limits,
- needs whole-scope reasoning that can be lost when related files land in
  different partitions,
- runs a secondary AI review that previously covered only a capped subset of
  files.

---

## Problem

Partitioning solves prompt-size limits, but naive partitioning creates two
quality failures:

1. **Cross-partition contradictions are missed**
   - Example: `package.json` is reviewed in one partition and
     `.github/workflows/release.yml` in another, so the AI never sees that
     `"private": true` conflicts with `npm publish`.

2. **Secondary reviews silently drop scope**
   - Example: a supplementary quality review only inspects the first 10 files,
     so issues in files 11+ never reach the model.

The result is technically valid prompt construction but weaker codebase
validation.

---

## Solution Pattern

Use a **three-part orchestration pattern**:

1. **Partitioned primary review**
   - Split the primary file set into prompt-safe partitions.
   - Keep evidence-boundary instructions in every partition prompt.
   - Preserve `(part X/Y)` labels for split files.

2. **Whole-scope synthesis pass**
   - After all primary partitions complete, run one extra AI call over:
     - the full logical file scope,
     - compact per-file excerpts,
     - the per-partition findings,
     - the static issue totals already computed by code.
   - This pass exists only to detect issues that require cross-partition
     reasoning.

3. **Partitioned supplementary review**
   - If a secondary AI review exists, partition it too.
   - Do **not** cap it to an arbitrary first-N subset.

---

## When to Apply This Pattern

Apply it when all of the following are true:

- the step reviews a logically shared scope,
- prompt partitioning is required or likely,
- findings may depend on relationships between files,
- accuracy matters more than minimizing AI calls to the absolute minimum.

Good candidates:

- config validation
- workflow/script validation
- code-quality review over many related source files
- documentation consistency checks across multiple docs and source files

---

## Implementation Blueprint

### 1. Build prompt-safe partitions

Start with the full readable file list, then:

- summarize machine-generated files when possible,
- split oversized files into labeled parts,
- group entries into prompt-safe partitions.

Important rules:

- never silently drop files from the logical scope,
- keep the authoritative file list separate from the current partition,
- preserve file labels exactly as shown to the model.

### 2. Run the primary partition loop

For each partition:

- render a prompt with:
  - partition header,
  - partition scope note,
  - exact file list for that partition,
  - visible file contents,
- execute the AI request,
- validate evidence handling,
- store the result for synthesis.

Capture at least:

- partition index,
- partition scope paths,
- visible prompt-entry labels,
- normalized AI output.

### 3. Run a whole-scope synthesis pass

Only run this when `partitionCount > 1`.

The synthesis prompt should include:

- the full file scope,
- a scope note describing any excerpt-limited or unavailable files,
- bounded whole-scope excerpts,
- static analysis counts already known in code,
- all per-partition summaries.

The synthesis prompt should explicitly tell the AI to:

- focus on cross-partition contradictions,
- avoid repeating partition output,
- cite the exact file paths involved in any new confirmed issue.

### 4. Partition supplementary review over full scope

If the step also runs a lightweight or quality-focused prompt:

- build its scope from the full discovered file set,
- partition that scope safely,
- keep separate cache keys per partition,
- append all partition outputs to the final step summary.

Do not do this:

- `files.slice(0, 10)`
- `take first N entries`
- `skip overflow files for the supplementary pass`

---

## Caching Rules

Use distinct cache keys for:

- primary partition reviews,
- whole-scope synthesis,
- supplementary review partitions.

Recommended shape:

- `step_xx_p0`, `step_xx_p1`, ...
- `step_xx_synthesis`
- `step_xx_quality_p0`, `step_xx_quality_p1`, ...

Why:

- synthesis depends on both file content and partition outputs,
- supplementary review should not reuse primary-review cache entries,
- cache invalidation stays precise.

---

## Evidence-Boundary Rules

Every partitioned or synthesized review must preserve these guarantees:

- if a file is truncated, say so,
- if a file is unavailable, say so,
- do not claim full validation when evidence is partial,
- keep praise scoped to visible evidence only.

The synthesis pass does **not** remove these constraints. It broadens reasoning,
not evidence.

---

## Minimal Pseudocode

```js
const partitions = buildPromptPartitions(fileEntries);
const partitionResults = [];

for (const partition of partitions) {
  const response = await runPrimaryPartition(partition);
  partitionResults.push({
    scopePaths: partition.scopePaths,
    promptEntries: partition.entries.map((entry) => entry.relativePath),
    content: response,
  });
}

if (partitions.length > 1) {
  const synthesis = await runSynthesis({
    fullScopePaths,
    boundedScopeEntries,
    partitionResults,
    staticIssueCounts,
  });
}

const supplementaryPartitions = buildPromptPartitions(fullSupplementaryEntries);
for (const partition of supplementaryPartitions) {
  await runSupplementaryPartition(partition);
}
```

---

## Step 04 Reference Implementation

The Step 04 implementation is the canonical reference:

- `src/steps/step_04_config_validation.js`
- `test/steps/step_04_config_validation.test.js`

Key behaviors to mirror:

- partition-safe primary config review,
- whole-scope synthesis only when needed,
- full-scope supplementary quality review,
- regression tests for missed contradictions and files beyond index 9.

---

## Test Requirements for Other Steps

If another step adopts this pattern, add regressions for:

1. **Cross-partition contradiction**
   - two related files forced into different partitions,
   - issue only detectable when both are considered together.

2. **Overflow supplementary scope**
   - more files than the old cap,
   - assert later files still appear in supplementary prompts.

3. **Evidence-boundary preservation**
   - truncated or unavailable files remain marked inconclusive.

4. **Cache separation**
   - primary, synthesis, and supplementary phases use distinct cache keys.

---

## Common Mistakes

- Partitioning the primary review but not the supplementary review
- Running synthesis without passing partition outputs
- Passing the full scope list but only partial visible contents without saying so
- Reusing the same cache key across different AI phases
- Treating synthesis as a replacement for partition reviews instead of a
  reconciliation layer

---

## Adoption Checklist

- [ ] Full logical scope is preserved even when prompts are split
- [ ] Primary review uses prompt-safe partitions
- [ ] Whole-scope synthesis runs when more than one partition exists
- [ ] Supplementary review covers the full scope without a hard cap
- [ ] Cache keys are unique per phase/partition
- [ ] Evidence-boundary instructions survive partitioning
- [ ] Regression tests cover cross-partition contradictions and overflow scope

---

## Summary

The reusable fix is:

- **partition for size,**
- **synthesize for whole-scope reasoning,**
- **never drop overflow files from secondary reviews.**

That combination preserves prompt safety without sacrificing validation quality.
