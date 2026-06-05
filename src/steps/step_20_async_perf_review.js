/**
 * Step 20: Async Performance Review
 * @module steps/step_20_async_perf_review
 * @version 2.0.0
 *
 * Uses the `async_performance_engineer` persona to review JavaScript/TypeScript
 * source files for async performance issues: overfetching, promise overhead,
 * event loop congestion, memory leaks, API call batching, debouncing/throttling,
 * error handling, promise anti-patterns, and resource cleanup.
 *
 * Skips gracefully when no JavaScript/TypeScript files are found in the project.
 *
 * Architecture: v2.0.0 Referential Transparency
 * - Pure functions for file detection, issue scoring, and report formatting
 * - Impure wrapper class for file I/O, AI calls, and backlog persistence
 */

import path from 'path';
import yaml from 'js-yaml';
import { STEP_KIND } from './step_contract.js';
import { logger } from '../core/logger.js';
import { FileOperations } from '../lib/file_operations.js';
import { Backlog } from '../lib/backlog.js';
import { AiHelper } from '../lib/ai_helpers.js';
import { AiCache } from '../lib/ai_cache.js';
import { TechStackDetector } from '../lib/tech_stack.js';
import { loadResolvedAiHelpers, buildYamlStepPrompt } from '../lib/ai_prompt_builder.js';
import { initializeStepAiContext } from './step_execution_helpers.js';

const MAX_FILE_PATHS_IN_CONTEXT = 20;
export const MAX_PROMPT_ENTRY_CHARS = 4_000;
export const MAX_PROMPT_PARTITION_CHARS = 9_000;
export const MAX_PROMPT_ENTRIES_PER_PARTITION = 4;
export const MAX_PARTITIONS_PER_RUN = 15;
const ASYNC_GENERATED_PATH_PATTERNS = [
  /(^|\/)(dist|build|out|coverage|node_modules|vendor|\.next|\.nuxt|\.svelte-kit|\.cache|\.parcel-cache|\.ai_workflow)(\/|$)/,
  /(^|\/)docs\/api(\/|$)/,
  /(^|\/)public\/v[^/]+\/assets(\/|$)/,
  /(^|\/)assets\/js(\/|$)/,
  /\.min\.js$/i,
];
const NON_RUNTIME_ASYNC_PATH_PATTERN = /(^|\/)(scripts|script)(\/|$)/i;
const ASYNC_SPLIT_PART_RE = /\s+\(part\s+(\d+)\/(\d+)\)$/i;
const ASYNC_SIGNAL_PATTERN =
  /\basync\s+function\b|=\s*async\b|\bawait\b|new\s+Promise\s*\(|\.then\s*\(|\.catch\s*\(|\bfetch\s*\(|\baxios(?:\.[A-Za-z_$][\w$]*)?\s*\(|\bsetTimeout\s*\(|\bsetInterval\s*\(|\baddEventListener\s*\(|\bremoveEventListener\s*\(|\bwatchPosition\s*\(|\bclearWatch\s*\(|\bsubscribe\s*\(|\bunsubscribe\s*\(|\bobserve\s*\(|\bdisconnect\s*\(|\bdispose\s*\(|\bdestroy\s*\(|\bclose\s*\(/i;

/** Relative path (inside .ai_workflow/cache/) for the async-pattern history file. */
export const ASYNC_HISTORY_CACHE_PATH = '.ai_workflow/cache/step_20_async_history.json';

// ============================================================================
// PURE FUNCTIONS
// ============================================================================

/**
 * Determine whether a list of file paths contains JavaScript or TypeScript source.
 *
 * Returns `true` if at least one `.js`, `.mjs`, `.cjs`, `.ts`, or `.tsx` file is present.
 *
 * @param {string[]} files - Relative or absolute file paths
 * @returns {boolean}
 */
export function isAsyncHeavyProject(files) {
  return files.some((f) => /\.[cm]?[jt]sx?$/i.test(f));
}

export function isAsyncGeneratedArtifactPath(filePath) {
  if (typeof filePath !== 'string' || filePath.length === 0) return false;
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  return ASYNC_GENERATED_PATH_PATTERNS.some((pattern) => pattern.test(normalized));
}

/**
 * Determine whether a file path is a runtime-oriented async review target.
 *
 * Excludes tests, declarations, submodules, and common tooling/config files so
 * the async-performance review stays focused on production code paths by
 * default.
 *
 * @param {string} filePath - Relative or absolute file path
 * @returns {boolean}
 */
export function isAsyncRuntimeTarget(filePath) {
  const normalized = String(filePath ?? '').replace(/\\/g, '/');

  if (!/\.[cm]?[jt]sx?$/i.test(normalized) || /\.d\.ts$/i.test(normalized)) {
    return false;
  }

  if (isAsyncGeneratedArtifactPath(normalized)) {
    return false;
  }

  if (
    NON_RUNTIME_ASYNC_PATH_PATTERN.test(normalized) ||
    normalized.startsWith('.workflow_core/') ||
    normalized.startsWith('.workflow_fspec/') ||
    normalized.startsWith('.github/') ||
    normalized.startsWith('docs/api-generated/') ||
    /(^|\/)(__tests__|__mocks__|test|tests|venv|vendor|third_party|site-packages)\//.test(
      normalized
    ) ||
    /\.(test|spec)\.[cm]?[jt]sx?$/i.test(normalized)
  ) {
    return false;
  }

  return !/(^|\/)(eslint|jest|vite|vitest|babel|webpack|rollup|karma|playwright|cypress)(?:\.[\w-]+)?\.config\.[cm]?[jt]sx?$/i.test(
    normalized
  );
}

/**
 * Filter a file list down to runtime-oriented async review targets.
 *
 * @param {string[]} files - Relative or absolute file paths
 * @returns {string[]}
 */
export function filterAsyncRuntimeTargets(files) {
  return files.filter((filePath) => isAsyncRuntimeTarget(filePath));
}

/**
 * Score the density of common async anti-patterns across an array of
 * source file contents.
 *
 * Scoring heuristics (per-file occurrences, case-insensitive):
 * - `new Promise(` inside an async function  → explicit Promise constructor anti-pattern
 * - Floating promises: `await`-less async call not stored or `.catch()`-ed
 * - Unhandled rejection risk: `.then(` without a following `.catch(` on the same chain
 * - Missing cleanup signals: `addEventListener` without a paired `removeEventListener`
 *
 * @param {string[]} fileContents - Array of source file content strings
 * @returns {{
 *   promiseConstructorCount: number,
 *   unhandledRejectionCount: number,
 *   missingCleanupCount: number,
 *   totalIssues: number
 * }}
 */
export function scoreAsyncIssues(fileContents) {
  const combined = (Array.isArray(fileContents) ? fileContents : [])
    .map((content) => stripJavaScriptComments(content))
    .join('\n');

  // Explicit Promise constructor wrapping async code
  const promiseConstructorCount = (combined.match(/new\s+Promise\s*\(/g) || []).length;

  // .then() calls that are not immediately followed by .catch() on the same expression
  const thenCount = (combined.match(/\.then\s*\(/g) || []).length;
  const catchCount = (combined.match(/\.catch\s*\(/g) || []).length;
  const unhandledRejectionCount = Math.max(0, thenCount - catchCount);

  // addEventListener without removeEventListener
  const addCount = (combined.match(/addEventListener\s*\(/g) || []).length;
  const removeCount = (combined.match(/removeEventListener\s*\(/g) || []).length;
  const missingCleanupCount = Math.max(0, addCount - removeCount);

  return {
    promiseConstructorCount,
    unhandledRejectionCount,
    missingCleanupCount,
    totalIssues: promiseConstructorCount + unhandledRejectionCount + missingCleanupCount,
  };
}

export function scoreAsyncRuntimeEntry(entry) {
  const content = stripJavaScriptComments(entry?.content ?? '');
  const relativePath = entry?.relativePath ?? '';
  const keywordScore = (content.match(new RegExp(ASYNC_SIGNAL_PATTERN.source, 'gi')) || []).length;
  const issueScore = scoreAsyncIssues([content]).totalIssues * 10;
  const hotPathScore = /(src|lib|server|api|routes|controllers|services|hooks|middleware)\//i.test(
    relativePath
  )
    ? 5
    : 0;

  return issueScore + keywordScore + hotPathScore;
}

export function selectAsyncReviewEntries(
  fileEntries,
  maxPartitionsPerRun = MAX_PARTITIONS_PER_RUN,
  maxEntriesPerPartition = MAX_PROMPT_ENTRIES_PER_PARTITION
) {
  if (!Array.isArray(fileEntries) || fileEntries.length === 0) {
    return [];
  }

  const maxEntries = Math.max(1, maxPartitionsPerRun * maxEntriesPerPartition);
  return [...fileEntries]
    .map((entry, index) => ({ entry, index, score: scoreAsyncRuntimeEntry(entry) }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      if ((right.entry.content?.length ?? 0) !== (left.entry.content?.length ?? 0)) {
        return (right.entry.content?.length ?? 0) - (left.entry.content?.length ?? 0);
      }
      return left.index - right.index;
    })
    .slice(0, maxEntries)
    .map(({ entry }) => entry);
}

export function inferAsyncProjectKind(techStackResult = {}) {
  const frameworks = Array.isArray(techStackResult.frameworks) ? techStackResult.frameworks : [];
  const packages = new Set(frameworks.map((framework) => framework?.package).filter(Boolean));

  if (
    packages.has('vue') ||
    packages.has('react') ||
    packages.has('svelte') ||
    packages.has('@angular/core') ||
    packages.has('next') ||
    packages.has('nuxt')
  ) {
    return 'frontend_spa';
  }

  if (
    techStackResult.build_system &&
    ['npm', 'pnpm', 'yarn'].includes(techStackResult.build_system)
  ) {
    return 'javascript_project';
  }

  return 'source_code_project';
}

export async function resolveAsyncProjectKind(
  projectKind,
  projectRoot,
  fileOps,
  techStackResult = {}
) {
  if (projectKind) {
    return projectKind;
  }

  try {
    const configPath = path.join(projectRoot, '.workflow-config.yaml');
    if (await fileOps.exists(configPath)) {
      const configContent = await fileOps.readFile(configPath);
      const parsed = yaml.load(configContent);
      const configuredKind = parsed?.project?.kind;
      if (typeof configuredKind === 'string' && configuredKind.trim()) {
        return configuredKind.trim();
      }
    }
  } catch {
    // Fall back to inferred kind below when workflow config is unavailable.
  }

  return inferAsyncProjectKind(techStackResult);
}

/**
 * Split a single source file into prompt-safe entries without dropping content.
 *
 * Oversized files are sliced into labeled `(part X/Y)` segments so the AI sees
 * the complete file across multiple prompt logs instead of a single truncated
 * excerpt.
 *
 * @param {{relativePath: string, content: string}} entry - Source file entry
 * @param {number} [maxEntryChars=MAX_PROMPT_ENTRY_CHARS] - Max chars per entry
 * @returns {Array<{relativePath: string, sourcePath: string, content: string}>}
 */
export function splitAsyncPromptEntry(entry, maxEntryChars = MAX_PROMPT_ENTRY_CHARS) {
  const sourcePath = entry?.relativePath ?? '';
  const content = entry?.content ?? '';

  if (content.length <= maxEntryChars) {
    return [{ relativePath: sourcePath, sourcePath, content }];
  }

  const parts = [];
  let start = 0;
  while (start < content.length) {
    let end = Math.min(start + maxEntryChars, content.length);
    if (end < content.length) {
      const cutAt = content.lastIndexOf('\n', end);
      if (cutAt > start) end = cutAt;
    }
    if (end <= start) end = Math.min(start + maxEntryChars, content.length);
    parts.push(content.slice(start, end));
    start = end;
    if (content[start] === '\n') start += 1;
  }

  return parts.map((partContent, index) => ({
    relativePath: `${sourcePath} (part ${index + 1}/${parts.length})`,
    sourcePath,
    content: partContent,
  }));
}

function estimatePromptEntryChars(entry) {
  return (entry?.relativePath?.length ?? 0) + (entry?.content?.length ?? 0) + 32;
}

/**
 * Partition the async-performance source payload into prompt-safe batches.
 *
 * @param {Array<{relativePath: string, content: string}>} fileEntries - Raw file entries
 * @param {number} [maxPartitionChars=MAX_PROMPT_PARTITION_CHARS] - Max chars per prompt batch
 * @param {number} [maxEntryChars=MAX_PROMPT_ENTRY_CHARS] - Max chars per prompt entry
 * @returns {Array<{entries: Array<{relativePath: string, sourcePath: string, content: string}>, scopePaths: string[]}>}
 */
export function buildAsyncPromptPartitions(
  fileEntries,
  maxPartitionChars = MAX_PROMPT_PARTITION_CHARS,
  maxEntryChars = MAX_PROMPT_ENTRY_CHARS
) {
  if (!Array.isArray(fileEntries) || fileEntries.length === 0) return [];

  const promptEntries = fileEntries.flatMap((entry) => splitAsyncPromptEntry(entry, maxEntryChars));
  const partitions = [];
  let currentEntries = [];
  let currentChars = 0;

  const flush = () => {
    if (currentEntries.length === 0) return;
    partitions.push({
      entries: currentEntries,
      scopePaths: [...new Set(currentEntries.map((entry) => entry.sourcePath))],
    });
    currentEntries = [];
    currentChars = 0;
  };

  for (const entry of promptEntries) {
    const entryChars = estimatePromptEntryChars(entry);
    const wouldOverflow =
      currentEntries.length > 0 &&
      (currentChars + entryChars > maxPartitionChars ||
        currentEntries.length >= MAX_PROMPT_ENTRIES_PER_PARTITION);

    if (wouldOverflow) flush();

    currentEntries.push(entry);
    currentChars += entryChars;
  }

  flush();
  return partitions;
}

/**
 * Build a markdown block for the current async-performance prompt partition.
 *
 * @param {Array<{relativePath: string, sourcePath: string, content: string}>} entries - Prompt entries
 * @returns {string} Markdown file-content block
 */
export function buildAsyncFileContentsBlock(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return '';

  return entries
    .map(({ relativePath, sourcePath, content }) => {
      const ext = (sourcePath || relativePath).split('.').pop() ?? '';
      const numbered = String(content ?? '')
        .split('\n')
        .map((line, i) => `${String(i + 1).padStart(4, ' ')} ${line}`)
        .join('\n');
      return `### \`${relativePath}\`\n\`\`\`${ext}\n${numbered}\n\`\`\``;
    })
    .join('\n\n');
}

export function buildAsyncPartitionScopeNote({
  coveredRuntimeCount,
  readableRuntimeCount,
  excludedRuntimeCount,
  hasSplitEntries = false,
}) {
  const coversAllVisible = coveredRuntimeCount >= readableRuntimeCount;
  const coverageSentence = coversAllVisible
    ? `This request covers all ${readableRuntimeCount} readable runtime JavaScript/TypeScript file(s) that contained detectable async patterns in this review run.`
    : `This request covers ${coveredRuntimeCount} of ${readableRuntimeCount} readable runtime JavaScript/TypeScript file(s) that contained detectable async patterns in this review run.`;
  const excludedSentence =
    excludedRuntimeCount > 0
      ? ` ${excludedRuntimeCount} additional runtime file(s) were excluded by the async-pattern filter and are not shown here. Treat coverage as partial, include the warning "⚠️ Coverage may be partial — not all source files were provided", and mark Memory Leaks and Resource Cleanup as inconclusive unless every lifecycle path needed for a claim is fully visible in the listed excerpts.`
      : '';
  const splitSentence = hasSplitEntries
    ? ' Entries labeled "(part X/Y)" are sequential chunks of oversized files split across multiple prompt logs.'
    : '';

  return `${coverageSentence}${excludedSentence}${splitSentence}`;
}

/**
 * Format the AI response and heuristic scores into a markdown summary block
 * suitable for saving to the backlog.
 *
 * @param {string} aiContent - Raw AI-generated review text
 * @param {{
 *   promiseConstructorCount: number,
 *   unhandledRejectionCount: number,
 *   missingCleanupCount: number,
 *   totalIssues: number
 * }} scores - Heuristic issue counts
 * @returns {string} Formatted markdown report
 */
export function formatAsyncPerfReport(aiContent, scores) {
  const lines = [
    '## Async Performance Review',
    '',
    '### Heuristic Pre-scan',
    `| Indicator | Count |`,
    `| --- | --- |`,
    `| Explicit Promise constructors | ${scores.promiseConstructorCount} |`,
    `| Potential unhandled rejections (.then without .catch) | ${scores.unhandledRejectionCount} |`,
    `| Missing event listener cleanup | ${scores.missingCleanupCount} |`,
    `| **Total heuristic signals** | **${scores.totalIssues}** |`,
    '',
    '### AI Analysis',
    '',
    aiContent || '_No AI analysis available._',
  ];
  return lines.join('\n');
}

// ============================================================================
// PURE FUNCTIONS — Async Pattern Detection + Consolidation
// ============================================================================

/**
 * Strip JavaScript/TypeScript comments while preserving string literals.
 *
 * This keeps async-pattern heuristics from firing on docblocks, commented-out
 * examples, and explanatory prose without corrupting quoted source snippets.
 *
 * @param {string} content - Raw source content
 * @returns {string}
 */
export function stripJavaScriptComments(content) {
  const source = String(content ?? '');
  if (!source) return '';

  let result = '';
  let state = 'code';
  let quote = '';

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];

    if (state === 'code') {
      if (char === "'" || char === '"' || char === '`') {
        quote = char;
        state = 'string';
        result += char;
        continue;
      }

      if (char === '/' && next === '/') {
        state = 'line-comment';
        result += ' ';
        i += 1;
        continue;
      }

      if (char === '/' && next === '*') {
        state = 'block-comment';
        result += ' ';
        i += 1;
        continue;
      }

      result += char;
      continue;
    }

    if (state === 'string') {
      result += char;
      if (char === '\\' && i + 1 < source.length) {
        result += source[i + 1];
        i += 1;
        continue;
      }
      if (char === quote) {
        state = 'code';
      }
      continue;
    }

    if (state === 'line-comment') {
      if (char === '\n') {
        result += '\n';
        state = 'code';
      }
      continue;
    }

    if (state === 'block-comment') {
      if (char === '\n') {
        result += '\n';
        continue;
      }
      if (char === '*' && next === '/') {
        state = 'code';
        i += 1;
      }
    }
  }

  return result;
}

/**
 * Detect whether source content contains async-relevant patterns.
 *
 * Covers the operational patterns that step 20 heuristics and scoring use,
 * while ignoring comment-only examples and filename references.
 *
 * @param {string} content - Source file content
 * @returns {boolean}
 */
export function hasAsyncPatterns(content) {
  return new RegExp(ASYNC_SIGNAL_PATTERN.source, 'i').test(stripJavaScriptComments(content));
}

export function buildAsyncSplitCoverage(entries) {
  const splitFiles = new Map();

  for (const entry of Array.isArray(entries) ? entries : []) {
    const relativePath = String(entry?.relativePath ?? '');
    const sourcePath = String(entry?.sourcePath ?? entry?.relativePath ?? '');
    const match = relativePath.match(ASYNC_SPLIT_PART_RE);
    if (!match || !sourcePath) {
      continue;
    }

    const partNumber = Number(match[1]);
    const totalParts = Number(match[2]);
    if (!Number.isInteger(partNumber) || !Number.isInteger(totalParts) || totalParts <= 0) {
      continue;
    }

    if (!splitFiles.has(sourcePath)) {
      splitFiles.set(sourcePath, { totalParts, partsSeen: new Set() });
    }

    const current = splitFiles.get(sourcePath);
    current.totalParts = Math.max(current.totalParts, totalParts);
    current.partsSeen.add(partNumber);
  }

  const splitFileCoverage = [...splitFiles.entries()].map(([sourcePath, value]) => {
    const partsSeen = [...value.partsSeen].sort((left, right) => left - right);
    return {
      sourcePath,
      totalParts: value.totalParts,
      partsSeen,
      complete: partsSeen.length === value.totalParts,
    };
  });

  return {
    splitFileCoverage,
    completeSplitSourcePaths: splitFileCoverage
      .filter((entry) => entry.complete)
      .map((entry) => entry.sourcePath),
    incompleteSplitSourcePaths: splitFileCoverage
      .filter((entry) => !entry.complete)
      .map((entry) => entry.sourcePath),
  };
}

export function buildAsyncConsolidationPrompt({
  projectName,
  projectDescription,
  projectKind,
  buildSystem,
  testFramework,
  runtimeFileCount,
  readableRuntimeCount,
  excludedRuntimeCount,
  completeSplitEntries = [],
  incompleteSplitSourcePaths = [],
  partitionAnalyses = [],
}) {
  const fullyCoveredSplitList =
    completeSplitEntries.length > 0
      ? completeSplitEntries.map((entry) => `- ${entry.relativePath}`).join('\n')
      : '- None';
  const incompleteSplitList =
    incompleteSplitSourcePaths.length > 0
      ? incompleteSplitSourcePaths.map((filePath) => `- ${filePath}`).join('\n')
      : '- None';
  const fullSplitFileBlock =
    completeSplitEntries.length > 0
      ? buildAsyncFileContentsBlock(completeSplitEntries)
      : '_No fully covered split files are available for file-level consolidation._';

  return [
    '**Role**: You are a Senior JavaScript/TypeScript Asynchronous Performance Specialist.',
    '',
    '**Task**: Consolidate the partition findings below into one folder-scoped async performance review.',
    '',
    '**Consolidation context:**',
    `- Project: ${projectName}`,
    `- Project Summary: ${projectDescription}`,
    `- Project Kind: ${projectKind}`,
    '- Primary Language: JavaScript/TypeScript',
    `- Build System: ${buildSystem}`,
    `- Test Framework: ${testFramework}`,
    `- Runtime Files Considered: ${runtimeFileCount}`,
    `- Readable Runtime Files with Detected Async Patterns: ${readableRuntimeCount}`,
    `- Runtime Files Excluded by the Async-Pattern Filter: ${excludedRuntimeCount}`,
    '- Fully covered split files (all parts were analyzed):',
    fullyCoveredSplitList,
    '- Split files that remain incomplete in this run:',
    incompleteSplitList,
    '',
    '**Rules:**',
    '- Preserve only findings supported by the partition analyses and the fully covered split-file excerpts below.',
    '- If a partition labels something as a finding but the visible evidence only supports "already handled", "acceptable as-is", or "no changes required", demote that item to a clean verdict or omit it.',
    '- If a partition suggests debounce/throttle, loading-state, or extra try/catch changes without concrete evidence of duplicate work, burst-triggered requests, floating promises, or observable failure handling gaps, downgrade that item to inconclusive or omit it.',
    '- You may promote a conclusion to a file-scoped verdict only for files listed under "Fully covered split files".',
    '- If runtime files were excluded by the async-pattern filter, keep repository-wide or cross-file Memory Leaks and Resource Cleanup conclusions inconclusive unless the fully covered split-file evidence is sufficient for a file-scoped claim.',
    '- Remove duplicate partition boilerplate, conflicting summaries, and repeated tables.',
    '- Do not introduce findings for files that are not mentioned below.',
    '- Do not emit pseudo-findings such as "Severity: None", "Fix: N/A", or "Impact: N/A".',
    '- Recommendations must contain only actionable next steps for findings that remain supported after consolidation.',
    '- If the evidence is still insufficient, say so plainly.',
    '',
    '**Required output:** Produce one consolidated async performance review with the same structure used in the partition reviews: overview, the 9 dimensions, prioritized recommendations, and a summary table.',
    '',
    '**Partition findings:**',
    partitionAnalyses.join('\n\n') || '_No partition findings were available._',
    '',
    '**Fully covered split-file contents:**',
    fullSplitFileBlock,
  ].join('\n');
}

/**
 * Load and validate a persisted async-pattern history object from raw JSON.
 *
 * Returns an empty history when the input is null, unparseable, has an
 * unexpected version, or contains a structurally invalid `entries` object.
 * Individual entries that fail shape validation are silently dropped.
 *
 * @param {string|null} raw - Raw JSON string (or null if the file was absent)
 * @returns {{ version: 1, entries: Record<string, { mtimeMs: number, hasAsyncPatterns: boolean }> }}
 */
export function loadAsyncHistory(raw) {
  const empty = { version: 1, entries: {} };
  if (!raw) return empty;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return empty;
  }

  if (!parsed || typeof parsed !== 'object' || parsed.version !== 1) return empty;
  if (!parsed.entries || typeof parsed.entries !== 'object' || Array.isArray(parsed.entries)) {
    return empty;
  }

  const validEntries = {};
  for (const [key, entry] of Object.entries(parsed.entries)) {
    if (
      entry &&
      typeof entry === 'object' &&
      typeof entry.mtimeMs === 'number' &&
      isFinite(entry.mtimeMs) &&
      typeof entry.hasAsyncPatterns === 'boolean'
    ) {
      validEntries[key] = { mtimeMs: entry.mtimeMs, hasAsyncPatterns: entry.hasAsyncPatterns };
    }
  }

  return { version: 1, entries: validEntries };
}

/**
 * Build a single async-pattern history entry.
 *
 * @param {number} mtimeMs - Last-modified timestamp in milliseconds
 * @param {boolean} hasAsync - Whether the file contains async patterns
 * @returns {{ mtimeMs: number, hasAsyncPatterns: boolean }}
 */
export function buildAsyncHistoryEntry(mtimeMs, hasAsync) {
  return { mtimeMs, hasAsyncPatterns: hasAsync };
}

/**
 * Merge new/updated file entries into an existing history, pruning stale paths.
 *
 * Only paths present in `currentPaths` are kept in the output, preventing
 * unbounded growth from deleted files.
 *
 * @param {{ version: 1, entries: Record<string, { mtimeMs: number, hasAsyncPatterns: boolean }> }} existingHistory
 * @param {Map<string, { mtimeMs: number, hasAsyncPatterns: boolean }>} updates - New or updated entries
 * @param {string[]} currentPaths - The full set of runtime paths seen this run
 * @returns {{ version: 1, entries: Record<string, { mtimeMs: number, hasAsyncPatterns: boolean }> }}
 */
export function mergeAsyncHistory(existingHistory, updates, currentPaths) {
  const pathSet = new Set(currentPaths);
  const merged = {};

  for (const p of pathSet) {
    if (updates.has(p)) {
      merged[p] = updates.get(p);
    } else if (existingHistory.entries[p]) {
      merged[p] = existingHistory.entries[p];
    }
  }

  return { version: 1, entries: merged };
}

// ============================================================================
// STEP CONTRACT
// ============================================================================

export const STEP_DEFINITION = {
  id: 'step_20',
  name: 'Async Performance Review',
  kind: STEP_KIND.ANALYSIS,
  description:
    'AI-powered async performance review (overfetching, event loop, memory leaks, promise anti-patterns)',
  dependencies: ['step_19'],
};

// ============================================================================
// IMPURE WRAPPER
// ============================================================================

/**
 * Step 20: Async Performance Review
 *
 * Discovers JavaScript/TypeScript source files, builds a structured prompt using
 * the `async_perf_engineer_prompt` persona from ai_helpers.yaml, and generates a
 * detailed async performance review report.
 *
 * Skips gracefully when the project contains no JavaScript/TypeScript files.
 */
export class Step20AsyncPerfReview {
  constructor(options = {}) {
    this.fileOps = options.fileOps || new FileOperations();
    this.backlog = options.backlog || new Backlog();
    this.aiHelper = options.aiHelper || new AiHelper({ promptsDir: options.promptsDir ?? null });
    this.aiCache = options.aiCache || new AiCache();
    this.techStack = options.techStack || new TechStackDetector();
  }

  /**
   * Execute the async performance review step.
   *
   * @param {string} projectRoot - Project root directory
   * @param {Object} [options]
   * @param {string[]} [options.sourceFiles] - Override JS/TS files to analyze
   * @param {string}   [options.projectName] - Project name for prompt context
   * @param {string}   [options.projectDescription] - Short project description
   * @param {string}   [options.projectKind] - Project kind for prompt context
   * @returns {Promise<Object>} Step result
   */
  async execute(projectRoot, options = {}) {
    logger.step('Step 20: Async Performance Review');

    try {
      // Discover JS/TS source files
      const allFiles =
        options.sourceFiles ??
        (await this.fileOps.listDirectoryRecursive(projectRoot, {
          extensions: ['.js', '.mjs', '.cjs', '.ts', '.tsx'],
          exclude: ['node_modules', 'dist', 'build', 'coverage', '.git'],
        }));

      const relativeFiles = allFiles.map((f) =>
        path.isAbsolute(f) ? path.relative(projectRoot, f) : f
      );
      const runtimeFiles = filterAsyncRuntimeTargets(relativeFiles);

      if (!isAsyncHeavyProject(relativeFiles)) {
        logger.info('Step 20: No JavaScript/TypeScript files found — skipping');
        return { success: true, skipped: true, message: 'No JS/TS files found' };
      }

      if (runtimeFiles.length === 0) {
        logger.info('Step 20: Only test/tooling JS/TS files found — skipping runtime review');
        return { success: true, skipped: true, message: 'No runtime JS/TS files found' };
      }

      logger.info(`Step 20: Analyzing ${runtimeFiles.length} runtime JS/TS files`);

      // Load async-pattern history to skip unchanged files that have no async patterns
      const historyPath = path.join(projectRoot, ASYNC_HISTORY_CACHE_PATH);
      let history = loadAsyncHistory(null);
      try {
        const raw = await this.fileOps.readFile(historyPath);
        history = loadAsyncHistory(raw);
      } catch {
        // History absent or unreadable — start fresh
      }

      const historyUpdates = new Map();
      const fileContents = [];
      const fileEntries = [];

      for (const relFile of runtimeFiles) {
        const absPath = path.isAbsolute(relFile) ? relFile : path.join(projectRoot, relFile);

        // Attempt cheap stat to check against history
        let mtimeMs = null;
        try {
          const stat = await this.fileOps.stat(absPath);
          mtimeMs = stat?.modified instanceof Date ? stat.modified.getTime() : null;
        } catch {
          // Stat failed — force a read below; do not persist to history
        }

        const cached = history.entries[relFile];
        const cacheHit = mtimeMs !== null && cached && cached.mtimeMs === mtimeMs;

        if (cacheHit && !cached.hasAsyncPatterns) {
          // File unchanged and has no async patterns — skip read entirely
          continue;
        }

        // Read the file (new, modified, no cache hit, or cached as having patterns)
        try {
          const content = await this.fileOps.readFile(absPath);

          // Update history only when we have a reliable mtime
          if (mtimeMs !== null) {
            historyUpdates.set(relFile, buildAsyncHistoryEntry(mtimeMs, hasAsyncPatterns(content)));
          }

          if (!hasAsyncPatterns(content)) {
            // File was read but has no async patterns — exclude from analysis
            continue;
          }

          fileContents.push(content);
          fileEntries.push({ relativePath: relFile, content });
        } catch {
          // Skip unreadable files silently
        }
      }

      // Persist updated history
      const updatedHistory = mergeAsyncHistory(history, historyUpdates, runtimeFiles);
      try {
        await this.fileOps.writeFile(historyPath, JSON.stringify(updatedHistory, null, 2));
      } catch {
        // Non-fatal — history will be rebuilt next run
      }

      const readableRuntimeCount = fileEntries.length;
      const skippedCount = runtimeFiles.length - readableRuntimeCount;
      if (skippedCount > 0) {
        logger.info(
          `[step_20] Skipped ${skippedCount} file(s) with no async patterns (history cache)`
        );
      }

      // Heuristic pre-scan
      const scores = scoreAsyncIssues(fileContents);
      logger.info(
        `Step 20: Heuristic signals — ${scores.totalIssues} total ` +
          `(${scores.promiseConstructorCount} promise constructors, ` +
          `${scores.unhandledRejectionCount} unhandled rejections, ` +
          `${scores.missingCleanupCount} missing cleanups)`
      );

      // Build AI prompt
      let aiContent = '';
      let degraded = false;
      const warnings = [];
      const aiAvailable = await initializeStepAiContext({
        aiHelper: this.aiHelper,
        aiCache: this.aiCache,
      });

      if (aiAvailable) {
        try {
          // Detect tech stack for richer prompt context
          let buildSystem = 'npm';
          let testFramework = 'jest';
          let techStackResult = {};
          try {
            techStackResult = await this.techStack.detectAll(projectRoot);
            buildSystem = techStackResult.build_system || 'npm';
            testFramework = techStackResult.test_framework || 'jest';
          } catch {
            // Non-fatal: fall back to defaults
          }
          const resolvedProjectKind = await resolveAsyncProjectKind(
            options.projectKind,
            projectRoot,
            this.fileOps,
            techStackResult
          );

          const parsedYaml = await loadResolvedAiHelpers(this.fileOps);
          const selectedEntries = selectAsyncReviewEntries(fileEntries);
          if (selectedEntries.length < fileEntries.length) {
            warnings.push(
              `Scoped async review to ${selectedEntries.length} high-signal runtime file(s) out of ${fileEntries.length}`
            );
            logger.info(
              `[step_20] Scoped async review to ${selectedEntries.length}/${fileEntries.length} high-signal runtime files`
            );
          }

          const promptPartitions =
            selectedEntries.length > 0 ? buildAsyncPromptPartitions(selectedEntries) : [];
          if (promptPartitions.length > MAX_PARTITIONS_PER_RUN) {
            warnings.push(
              `Limited async AI review to ${MAX_PARTITIONS_PER_RUN} partitions out of ${promptPartitions.length}`
            );
            logger.warn(
              `[step_20] Limiting AI analysis to ${MAX_PARTITIONS_PER_RUN}/${promptPartitions.length} partitions`
            );
          }
          const partitionsToAnalyze = promptPartitions.slice(0, MAX_PARTITIONS_PER_RUN);

          if (partitionsToAnalyze.length > 1) {
            logger.info(
              `[step_20] Running AI analysis in ${partitionsToAnalyze.length} partition(s) to avoid prompt truncation`
            );
          }

          const aiSections = [];
          const partitionResponses = [];
          for (let i = 0; i < partitionsToAnalyze.length; i += 1) {
            const partition = partitionsToAnalyze[i];
            const partitionDisplayPaths = partition.entries.map((entry) => entry.relativePath);
            const filePathList = partitionDisplayPaths
              .slice(0, MAX_FILE_PATHS_IN_CONTEXT)
              .map((f) => `      - ${f}`)
              .join('\n');
            const filePathsContext =
              partitionDisplayPaths.length > MAX_FILE_PATHS_IN_CONTEXT
                ? `${filePathList}\n      ... and ${partitionDisplayPaths.length - MAX_FILE_PATHS_IN_CONTEXT} more`
                : filePathList;
            const fileContentBlock = buildAsyncFileContentsBlock(partition.entries);
            const prompt = buildYamlStepPrompt(parsedYaml, 'async_perf_engineer_prompt', {
              partition_header:
                partitionsToAnalyze.length > 1
                  ? `[Partition ${i + 1} of ${partitionsToAnalyze.length} — analyze ONLY the files or file-parts listed below for this request]`
                  : '',
              partition_scope_note: buildAsyncPartitionScopeNote({
                coveredRuntimeCount: partition.scopePaths.length,
                readableRuntimeCount,
                excludedRuntimeCount: runtimeFiles.length - readableRuntimeCount,
                hasSplitEntries: partition.entries.some((entry) =>
                  /\(part \d+\/\d+\)/.test(entry.relativePath)
                ),
              }),
              project_name: options.projectName ?? path.basename(projectRoot),
              project_description: options.projectDescription ?? 'JavaScript/TypeScript project',
              project_kind: resolvedProjectKind,
              primary_language: 'JavaScript/TypeScript',
              build_system: buildSystem,
              test_framework: testFramework,
              source_file_count:
                partitionsToAnalyze.length > 1
                  ? `${runtimeFiles.length} total runtime (${readableRuntimeCount} with async patterns; ${partition.scopePaths.length} covered in this request)`
                  : `${runtimeFiles.length} total runtime (${readableRuntimeCount} with async patterns)`,
              modified_count: String(readableRuntimeCount),
              file_paths:
                filePathsContext ||
                '      - (no readable JavaScript/TypeScript files were available)',
              file_content_block:
                fileContentBlock ||
                '_No readable file excerpts were available in the current context window._',
            });

            if (!prompt) continue;

            const cacheContext = `step_20|project:${projectRoot}|partition:${i + 1}/${partitionsToAnalyze.length}|signals:${scores.totalIssues}`;
            const aiResult = await this.aiCache.withCache(prompt, cacheContext, () =>
              this.aiHelper.executeRequest(prompt, {
                persona: 'async_performance_engineer',
              })
            );
            const response = typeof aiResult === 'string' ? aiResult : (aiResult?.content ?? '');

            if (response) {
              partitionResponses.push({
                index: i,
                response,
                partition,
              });
              aiSections.push(
                partitionsToAnalyze.length > 1
                  ? `#### Partition ${i + 1} of ${partitionsToAnalyze.length}\n\n${response}`
                  : response
              );
            }
          }

          aiContent = aiSections.join('\n\n');

          if (aiContent && partitionsToAnalyze.length > 1) {
            const splitCoverage = buildAsyncSplitCoverage(
              partitionsToAnalyze.flatMap((partition) => partition.entries)
            );
            const completeSplitEntries = fileEntries.filter((entry) =>
              splitCoverage.completeSplitSourcePaths.includes(entry.relativePath)
            );

            try {
              const consolidationPrompt = buildAsyncConsolidationPrompt({
                projectName: options.projectName ?? path.basename(projectRoot),
                projectDescription: options.projectDescription ?? 'JavaScript/TypeScript project',
                projectKind: resolvedProjectKind,
                buildSystem,
                testFramework,
                runtimeFileCount: runtimeFiles.length,
                readableRuntimeCount,
                excludedRuntimeCount: runtimeFiles.length - readableRuntimeCount,
                completeSplitEntries,
                incompleteSplitSourcePaths: splitCoverage.incompleteSplitSourcePaths,
                partitionAnalyses: partitionResponses.map(
                  ({ index, response }) =>
                    `#### Partition ${index + 1} of ${partitionsToAnalyze.length}\n\n${response}`
                ),
              });
              const consolidationCacheContext =
                `step_20|project:${projectRoot}|consolidated|partitions:${partitionsToAnalyze.length}` +
                `|fullSplits:${splitCoverage.completeSplitSourcePaths.join(',') || 'none'}` +
                `|signals:${scores.totalIssues}`;
              const consolidatedResult = await this.aiCache.withCache(
                consolidationPrompt,
                consolidationCacheContext,
                () =>
                  this.aiHelper.executeRequest(consolidationPrompt, {
                    persona: 'async_performance_engineer',
                  })
              );
              const consolidatedContent =
                typeof consolidatedResult === 'string'
                  ? consolidatedResult
                  : (consolidatedResult?.content ?? '');

              if (consolidatedContent) {
                aiContent = consolidatedContent;
              }
            } catch (consolidationError) {
              warnings.push(`Async review consolidation skipped: ${consolidationError.message}`);
              logger.warn(
                `[step_20] Async review consolidation skipped — ${consolidationError.message}`
              );
            }
          }
        } catch (promptError) {
          degraded = true;
          warnings.push(`AI analysis skipped: ${promptError.message}`);
          logger.warn(`Step 20: AI analysis skipped — ${promptError.message}`);
        }
      } else {
        degraded = true;
        warnings.push('AI helper not available');
        logger.warn('Step 20: AI analysis skipped — AI helper not available');
      }

      // Format and persist report
      const report = formatAsyncPerfReport(aiContent, scores);
      await this.backlog.saveStepSummary(20, 'Async Performance Review', report);

      logger.success('Step 20: Async Performance Review complete');

      return {
        success: true,
        degraded,
        skipped: false,
        fileCount: readableRuntimeCount,
        skippedCount,
        scores,
        report,
        warnings,
      };
    } catch (error) {
      logger.error(`Step 20 failed: ${error.message}`);
      throw error;
    }
  }
}

export default Step20AsyncPerfReview;
