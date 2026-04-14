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
import { STEP_KIND } from './step_contract.js';
import { logger } from '../core/logger.js';
import { FileOperations } from '../lib/file_operations.js';
import { Backlog } from '../lib/backlog.js';
import { AiHelper } from '../lib/ai_helpers.js';
import { AiCache } from '../lib/ai_cache.js';
import { TechStackDetector } from '../lib/tech_stack.js';
import {
  loadResolvedAiHelpers,
  buildYamlStepPrompt,
} from '../lib/ai_prompt_builder.js';

const MAX_FILE_PATHS_IN_CONTEXT = 20;
export const MAX_PROMPT_ENTRY_CHARS = 4_000;
export const MAX_PROMPT_PARTITION_CHARS = 9_000;
export const MAX_PROMPT_ENTRIES_PER_PARTITION = 4;

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

  const promptEntries = fileEntries.flatMap((entry) =>
    splitAsyncPromptEntry(entry, maxEntryChars)
  );
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
      return `### \`${relativePath}\`\n\`\`\`${ext}\n${content}\n\`\`\``;
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

      if (!isAsyncHeavyProject(relativeFiles)) {
        logger.info('Step 20: No JavaScript/TypeScript files found — skipping');
        return { success: true, skipped: true, message: 'No JS/TS files found' };
      }

      logger.info(`Step 20: Analyzing ${relativeFiles.length} JS/TS files`);

      const fileContents = [];
      const fileEntries = [];

      for (const relFile of relativeFiles) {
        try {
          const absPath = path.isAbsolute(relFile) ? relFile : path.join(projectRoot, relFile);
          const content = await this.fileOps.readFile(absPath);
          fileContents.push(content);
          fileEntries.push({ relativePath: relFile, content });
        } catch {
          // Skip unreadable files silently
        }
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
      const aiAvailable = await this.aiHelper.initialize();

      if (aiAvailable) {
        await this.aiCache.init();
        try {
          // Detect tech stack for richer prompt context
          let buildSystem = 'npm';
          let testFramework = 'jest';
          try {
            const techStackResult = await this.techStack.detectAll(projectRoot);
            buildSystem = techStackResult.build_system || 'npm';
            testFramework = techStackResult.test_framework || 'jest';
          } catch {
            // Non-fatal: fall back to defaults
          }

          const parsedYaml = await loadResolvedAiHelpers(this.fileOps);
          const promptPartitions =
            fileEntries.length > 0 ? buildAsyncPromptPartitions(fileEntries) : [];
          const partitionsToAnalyze =
            promptPartitions.length > 0 ? promptPartitions : [{ entries: [], scopePaths: [] }];

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
                  ? `This request covers ${partition.scopePaths.length} of ${relativeFiles.length} JavaScript/TypeScript files in the current async-performance review run. Entries labeled "(part X/Y)" are sequential chunks of oversized files that were split across multiple prompt logs to avoid truncated code excerpts.`
                  : `This request contains the full readable JavaScript/TypeScript scope for this run (${fileEntries.length} readable file(s)).`,
              project_name: options.projectName ?? path.basename(projectRoot),
              project_description: options.projectDescription ?? 'JavaScript/TypeScript project',
              project_kind: options.projectKind ?? 'nodejs_api',
              primary_language: 'JavaScript/TypeScript',
              build_system: buildSystem,
              test_framework: testFramework,
              source_file_count:
                partitionsToAnalyze.length > 1
                  ? `${relativeFiles.length} total (${partition.scopePaths.length} covered in this request)`
                  : String(relativeFiles.length),
              modified_count: String(relativeFiles.length),
              file_paths:
                filePathsContext || '      - (no readable JavaScript/TypeScript files were available)',
              file_content_block:
                fileContentBlock || '_No readable file excerpts were available in the current context window._',
            });

            if (!prompt) continue;

            const cacheKey = `step_20:${projectRoot}:part:${i + 1}/${partitionsToAnalyze.length}:signals:${scores.totalIssues}`;
            const cached = await this.aiCache.get(cacheKey);
            const response = cached
              ? cached
              : (
                  await this.aiHelper.executeRequest(prompt, {
                    persona: 'async_performance_engineer',
                  })
                )?.content ?? '';

            if (cached) {
              logger.info(`Step 20: Using cached AI response for partition ${i + 1}`);
            } else if (response) {
              await this.aiCache.set(cacheKey, response);
            }

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
          logger.warn(`Step 20: AI analysis skipped — ${promptError.message}`);
        }
      } else {
        logger.warn('Step 20: AI analysis skipped — AI helper not available');
      }

      // Format and persist report
      const report = formatAsyncPerfReport(aiContent, scores);
      await this.backlog.saveStepSummary(20, 'Async Performance Review', report);

      logger.success('Step 20: Async Performance Review complete');

      return {
        success: true,
        skipped: false,
        fileCount: relativeFiles.length,
        scores,
        report,
      };
    } catch (error) {
      logger.error(`Step 20 failed: ${error.message}`);
      throw error;
    }
  }
}

export default Step20AsyncPerfReview;
