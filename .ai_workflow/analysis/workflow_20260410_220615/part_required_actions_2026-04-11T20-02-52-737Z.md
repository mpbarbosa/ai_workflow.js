# Part Analysis: REQUIRED ACTIONS

**Run:** workflow_20260410_220615  
**Section:** REQUIRED ACTIONS  
**Generated:** 2026-04-11T20:02:52.748Z

---

## Alignment Score: 9/10

## Summary
The "REQUIRED ACTIONS" section provides a comprehensive checklist for identifying performance and complexity issues in a codebase. The items are technically accurate, relevant, and actionable for a reviewer or automated analyzer. The section covers a wide range of performance pitfalls and best practices, and its instructions are clear and unambiguous. No prompt flaws are present. The only limitation is that the provided CODEBASE CONTEXT is truncated, so not all items can be verified against actual code, but this does not reflect a flaw in the prompt section itself.

## Findings
- Prompt flaw: None. All listed actions are clear, relevant, and technically correct for performance/code quality review.
- Context limitation: The CODEBASE CONTEXT is truncated and does not show enough source code to verify the presence or absence of the specific issues listed (e.g., O(n²) loops, memory allocation hotspots, etc.).

## Suggestions
1. No prompt change needed — current wording is aligned.

**SECTION LABEL**: REQUIRED ACTIONS

**SECTION CONTENT**:
1. Identify algorithmic complexity issues: O(n²) or worse loops, nested iterations over large datasets
2. Find synchronous blocking operations in hot paths: synchronous file I/O, large JSON.parse(), blocking regex
3. Detect memory allocation hotspots: objects created inside tight loops, missing object pooling, closure leaks
4. Review data structure choices: Object vs Map, Array vs Set for membership tests, typed arrays for numeric data
5. Identify missing memoization: repeated expensive computations without caching
6. Analyse bundle/build impact: large imports that could be tree-shaken, missing dynamic imports for lazy loading
7. Review benchmarking coverage: identify computational hot paths with no benchmark (npm bench / vitest bench)
8. Flag regex performance risks: catastrophic backtracking patterns, unanchored patterns on large strings