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

  if (
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
  const combined = fileContents.join('\n');

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
  const content = entry?.content ?? '';
  const relativePath = entry?.relativePath ?? '';
  const keywordScore = (
    content.match(
      /\b(await|async|Promise|setTimeout|setInterval|fetch|axios|addEventListener)\b/g
    ) || []
  ).length;
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
// PURE FUNCTIONS — Async Pattern History
// ============================================================================

/**
 * Detect whether source content contains async-relevant patterns.
 *
 * Covers all patterns that step 20 heuristics and scoring use:
 * `async`, `await`, `Promise`, `.then(`, `new Promise`, `fetch`, `axios`,
 * `setTimeout`, `setInterval`, `addEventListener`, `removeEventListener`.
 *
 * @param {string} content - Source file content
 * @returns {boolean}
 */
export function hasAsyncPatterns(content) {
  return /\b(async|await|Promise|fetch|axios|setTimeout|setInterval|addEventListener|removeEventListener|watchPosition|clearWatch|subscribe|unsubscribe|observe|disconnect|dispose|destroy|close)\b|\.then\s*\(|\.catch\s*\(/i.test(
    String(content ?? '')
  );
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
              partition_scope_note:
                partitionsToAnalyze.length > 1
                  ? `This request covers ${partition.scopePaths.length} of ${readableRuntimeCount} runtime JavaScript/TypeScript files that contained detectable async patterns in this review run (${runtimeFiles.length - readableRuntimeCount} runtime file(s) were excluded by the async-pattern filter and are not shown; their resource-lifecycle code may still be relevant to Memory Leak and Resource Cleanup dimensions). Entries labeled "(part X/Y)" are sequential chunks of oversized files split across multiple prompt logs.`
                  : `This request covers all ${readableRuntimeCount} runtime JavaScript/TypeScript file(s) that contained detectable async patterns for this run. ${runtimeFiles.length - readableRuntimeCount} additional runtime file(s) were excluded by the async-pattern filter and are not shown here; they may contain resource-lifecycle code relevant to Memory Leak and Resource Cleanup dimensions.`,
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
              aiSections.push(
                partitionsToAnalyze.length > 1
                  ? `#### Partition ${i + 1} of ${partitionsToAnalyze.length}\n\n${response}`
                  : response
              );
            }
          }

          aiContent = aiSections.join('\n\n');
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
