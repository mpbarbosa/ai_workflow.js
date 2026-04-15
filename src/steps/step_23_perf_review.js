/**
 * Step 23: Performance Review
 * @module steps/step_23_perf_review
 * @version 2.0.0
 *
 * Uses the `performance_engineer` persona to review JavaScript/TypeScript source
 * files for general performance issues: algorithmic complexity, synchronous blocking
 * operations in hot paths, memory allocation hotspots, missing memoization,
 * data structure choice, and bundle/build size concerns.
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
import { CommitHistory } from '../lib/commit_history.js';
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
 * Determine whether a list of file paths represents a performance-sensitive project.
 *
 * Returns `true` if at least one `.js`, `.mjs`, `.cjs`, `.ts`, or `.tsx` file is present.
 *
 * @param {string[]} files - Relative or absolute file paths
 * @returns {boolean}
 */
export function isPerformanceSensitiveProject(files) {
  return files.some((f) => /\.[cm]?[jt]sx?$/i.test(f));
}

/**
 * Determine whether a file path is a valid step_23 review target.
 *
 * @param {string} filePath - Relative or absolute file path
 * @returns {boolean}
 */
export function isPerformanceReviewTarget(filePath) {
  const normalized = String(filePath ?? '').replace(/\\/g, '/');

  return (
    /\.[cm]?[jt]sx?$/i.test(normalized) &&
    !/\.d\.ts$/i.test(normalized) &&
    !normalized.startsWith('.ai_workflow/')
  );
}

/**
 * Filter and deduplicate a list of file paths down to step_23 review targets.
 *
 * @param {string[]} files - File paths to normalize
 * @returns {string[]}
 */
export function filterPerformanceReviewTargets(files) {
  const seen = new Set();

  return (Array.isArray(files) ? files : []).filter((filePath) => {
    const normalized = String(filePath ?? '').replace(/\\/g, '/');
    if (!isPerformanceReviewTarget(normalized) || seen.has(normalized)) {
      return false;
    }
    seen.add(normalized);
    return true;
  });
}

/**
 * Score the density of common performance anti-patterns across an array of
 * source file contents.
 *
 * Scoring heuristics (per-file occurrences):
 * - Nested loops (`for`/`while` inside `for`/`while`) → O(n²) risk
 * - `JSON.parse(` or `JSON.stringify(` on potentially large data
 * - `readFileSync(` / `writeFileSync(` — synchronous I/O blocking event loop
 * - Object creation inside loops (`new ` inside a for/while context)
 * - Repeated regex construction (`new RegExp(` inside loops)
 *
 * @param {string[]} fileContents - Array of source file content strings
 * @returns {{
 *   nestedLoopCount: number,
 *   syncIoCount: number,
 *   jsonParseCount: number,
 *   objectInLoopCount: number,
 *   totalIssues: number
 * }}
 */
export function scorePerfIssues(fileContents) {
  const combined = fileContents.join('\n');

  // Nested loops heuristic: two consecutive for/while keywords within close proximity
  const nestedLoopCount = (
    combined.match(/\b(for|while)\s*\([\s\S]{1,200}?\b(for|while)\s*\(/g) || []
  ).length;

  // Synchronous file I/O
  const syncIoCount = (
    combined.match(
      /\b(readFileSync|writeFileSync|appendFileSync|existsSync|mkdirSync|readdirSync)\s*\(/g
    ) || []
  ).length;

  // Large JSON operations
  const jsonParseCount = (combined.match(/\bJSON\.(parse|stringify)\s*\(/g) || []).length;

  // Object/class instantiation inside loops (heuristic: new keyword after for/while on same line or adjacent)
  const objectInLoopCount = (
    combined.match(/\b(for|while)\s*\([^)]*\)[^{]*\{[^}]*\bnew\s+\w/g) || []
  ).length;

  return {
    nestedLoopCount,
    syncIoCount,
    jsonParseCount,
    objectInLoopCount,
    totalIssues: nestedLoopCount + syncIoCount + jsonParseCount + objectInLoopCount,
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
export function splitPerformancePromptEntry(entry, maxEntryChars = MAX_PROMPT_ENTRY_CHARS) {
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
 * Partition the performance-review source payload into prompt-safe batches.
 *
 * @param {Array<{relativePath: string, content: string}>} fileEntries - Raw file entries
 * @param {number} [maxPartitionChars=MAX_PROMPT_PARTITION_CHARS] - Max chars per prompt batch
 * @param {number} [maxEntryChars=MAX_PROMPT_ENTRY_CHARS] - Max chars per prompt entry
 * @returns {Array<{entries: Array<{relativePath: string, sourcePath: string, content: string}>, scopePaths: string[]}>}
 */
export function buildPerformancePromptPartitions(
  fileEntries,
  maxPartitionChars = MAX_PROMPT_PARTITION_CHARS,
  maxEntryChars = MAX_PROMPT_ENTRY_CHARS
) {
  if (!Array.isArray(fileEntries) || fileEntries.length === 0) return [];

  const promptEntries = fileEntries.flatMap((entry) =>
    splitPerformancePromptEntry(entry, maxEntryChars)
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
 * Build a markdown block for the current performance-review prompt partition.
 *
 * @param {Array<{relativePath: string, sourcePath: string, content: string}>} entries - Prompt entries
 * @returns {string} Markdown file-content block
 */
export function buildPerformanceFileContentsBlock(entries) {
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
 *   nestedLoopCount: number,
 *   syncIoCount: number,
 *   jsonParseCount: number,
 *   objectInLoopCount: number,
 *   totalIssues: number
 * }} scores - Heuristic issue counts
 * @returns {string} Formatted markdown report
 */
export function formatPerfReport(aiContent, scores) {
  const lines = [
    '## Performance Review',
    '',
    '### Heuristic Pre-scan',
    `| Indicator | Count |`,
    `| --- | --- |`,
    `| Nested loops (O(n²) risk) | ${scores.nestedLoopCount} |`,
    `| Synchronous I/O operations | ${scores.syncIoCount} |`,
    `| JSON.parse/stringify calls | ${scores.jsonParseCount} |`,
    `| Object instantiation inside loops | ${scores.objectInLoopCount} |`,
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
  id: 'step_23',
  name: 'Performance Review',
  kind: STEP_KIND.ANALYSIS,
  description:
    'AI-powered performance review (algorithmic complexity, sync I/O, memory hotspots, missing memoization)',
  dependencies: ['step_22'],
};

// ============================================================================
// IMPURE WRAPPER
// ============================================================================

/**
 * Step 23: Performance Review
 *
 * Discovers JavaScript/TypeScript source files, builds a structured prompt using
 * the `performance_review_prompt` from ai_helpers.yaml, and generates a detailed
 * performance analysis report.
 *
 * Skips gracefully when the project contains no JavaScript/TypeScript files.
 */
export class Step23PerfReview {
  constructor(options = {}) {
    this.fileOps = options.fileOps || new FileOperations();
    this.backlog = options.backlog || new Backlog();
    this.aiHelper = options.aiHelper || new AiHelper({ promptsDir: options.promptsDir ?? null });
    this.aiCache = options.aiCache || new AiCache();
    this.techStack = options.techStack || new TechStackDetector();
    this.gitOps = options.gitOps || null;
  }

  _getLastSuccessfulRunCommit(workflowDir) {
    const commitHistory = new CommitHistory({ workflowDir });
    return commitHistory.getLastRunCommit();
  }

  async _getFilesSinceLastSuccessfulRun(projectRoot, options = {}) {
    if (
      !this.gitOps ||
      typeof this.gitOps.getChangedFilesSince !== 'function' ||
      typeof this.gitOps.status !== 'function'
    ) {
      return { available: false, files: [] };
    }

    const rawWorkflowDir = options.workflowDir || '.ai_workflow';
    const workflowDir = path.isAbsolute(rawWorkflowDir)
      ? rawWorkflowDir
      : path.join(projectRoot, rawWorkflowDir);
    const baselineHash = this._getLastSuccessfulRunCommit(workflowDir);

    if (!baselineHash) {
      return { available: false, files: [] };
    }

    let committedChangedFiles;
    try {
      committedChangedFiles = this.gitOps
        .getChangedFilesSince(baselineHash)
        .filter((file) => file.status !== 'deleted' && !file.file?.startsWith('.ai_workflow/'));
    } catch {
      return { available: false, files: [] };
    }

    const status = await this.gitOps.status();
    const uncommittedFiles = [
      ...(status.staged || []),
      ...(status.unstaged || []),
      ...(status.untracked || []),
    ].filter((file) => file.status !== 'deleted');

    const seenPaths = new Set(committedChangedFiles.map((file) => file.file));
    const mergedFiles = [
      ...committedChangedFiles,
      ...uncommittedFiles.filter((file) => !seenPaths.has(file.file)),
    ];

    return {
      available: true,
      files: filterPerformanceReviewTargets(mergedFiles.map((file) => file.file || file)),
      baselineHash,
    };
  }

  /**
   * Execute the performance review step.
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
    logger.step('Step 23: Performance Review');

    try {
      let analysisMode = 'full-scan';
      let baselineHash = null;
      let relativeFiles;

      if (Array.isArray(options.sourceFiles)) {
        analysisMode = 'override';
        relativeFiles = filterPerformanceReviewTargets(
          options.sourceFiles.map((file) =>
            path.isAbsolute(file) ? path.relative(projectRoot, file) : file
          )
        );
      } else {
        const successfulScope = await this._getFilesSinceLastSuccessfulRun(projectRoot, options);

        if (successfulScope.available) {
          analysisMode = 'since-last-successful-run';
          baselineHash = successfulScope.baselineHash;
          relativeFiles = successfulScope.files;
        } else if (Array.isArray(options.modifiedFiles) && options.modifiedFiles.length > 0) {
          analysisMode = 'modified-files';
          relativeFiles = filterPerformanceReviewTargets(
            options.modifiedFiles.map((file) =>
              path.isAbsolute(file) ? path.relative(projectRoot, file) : file
            )
          );
        } else {
          const allFiles = await this.fileOps.listDirectoryRecursive(projectRoot, {
            extensions: ['.js', '.mjs', '.cjs', '.ts', '.tsx'],
            exclude: ['node_modules', 'dist', 'build', 'coverage', '.git'],
          });
          relativeFiles = filterPerformanceReviewTargets(
            allFiles.map((file) => (path.isAbsolute(file) ? path.relative(projectRoot, file) : file))
          );
        }
      }

      if (!isPerformanceSensitiveProject(relativeFiles)) {
        if (analysisMode === 'since-last-successful-run') {
          logger.info('Step 23: No JavaScript/TypeScript files changed since last successful run — skipping');
          return {
            success: true,
            skipped: true,
            message: 'No JS/TS files changed since last successful run',
          };
        }

        logger.info('Step 23: No JavaScript/TypeScript files found — skipping');
        return { success: true, skipped: true, message: 'No JS/TS files found' };
      }

      if (analysisMode === 'since-last-successful-run') {
        logger.info(
          `Step 23: Analyzing ${relativeFiles.length} JS/TS file(s) changed since last successful run (${baselineHash?.substring(0, 7) ?? 'unknown'})`
        );
      } else {
        logger.info(`Step 23: Analyzing ${relativeFiles.length} JS/TS files`);
      }

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

      const scores = scorePerfIssues(fileContents);
      logger.info(
        `Step 23: Heuristic signals — ${scores.totalIssues} total ` +
          `(${scores.nestedLoopCount} nested loops, ` +
          `${scores.syncIoCount} sync I/O, ` +
          `${scores.jsonParseCount} JSON ops, ` +
          `${scores.objectInLoopCount} objects in loops)`
      );

      let aiContent = '';
      const aiAvailable = await this.aiHelper.initialize();

      if (aiAvailable) {
        await this.aiCache.init();
        try {
          let buildSystem = 'npm';
          try {
            const techStackResult = await this.techStack.detectAll(projectRoot);
            buildSystem = techStackResult.build_system || 'npm';
          } catch {
            // Non-fatal: fall back to default
          }

          const parsedYaml = await loadResolvedAiHelpers(this.fileOps);
          const promptPartitions =
            fileEntries.length > 0 ? buildPerformancePromptPartitions(fileEntries) : [];
          const partitionsToAnalyze =
            promptPartitions.length > 0 ? promptPartitions : [{ entries: [], scopePaths: [] }];

          if (partitionsToAnalyze.length > 1) {
            logger.info(
              `[step_23] Running AI analysis in ${partitionsToAnalyze.length} partition(s) to avoid prompt truncation`
            );
          }

          const aiSections = [];
          for (let i = 0; i < partitionsToAnalyze.length; i++) {
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
            const fileContentBlock = buildPerformanceFileContentsBlock(partition.entries);
            const prompt = buildYamlStepPrompt(parsedYaml, 'performance_review_prompt', {
              partition_header:
                partitionsToAnalyze.length > 1
                  ? `[Partition ${i + 1} of ${partitionsToAnalyze.length} — analyze ONLY the files or file-parts listed below for this request]`
                  : '',
              partition_scope_note:
                partitionsToAnalyze.length > 1
                  ? `This request covers ${partition.scopePaths.length} of ${relativeFiles.length} JavaScript/TypeScript files in the current performance-review run. Entries labeled "(part X/Y)" are sequential chunks of oversized files that were split across multiple prompt logs to avoid truncated code excerpts.`
                  : `This request contains the full readable JavaScript/TypeScript scope for this run (${fileEntries.length} readable file(s)).`,
              project_name: options.projectName ?? path.basename(projectRoot),
              project_description: options.projectDescription ?? 'JavaScript/TypeScript project',
              primary_language: 'JavaScript/TypeScript',
              build_system: buildSystem,
              source_file_count:
                partitionsToAnalyze.length > 1
                  ? `${relativeFiles.length} total (${partition.scopePaths.length} covered in this request)`
                  : String(relativeFiles.length),
              file_paths:
                filePathsContext || '      - (no readable JavaScript/TypeScript files were available)',
              file_content_block:
                fileContentBlock || '_No readable file excerpts were available in the current context window._',
            });

            if (!prompt) continue;

            const response = await this.aiCache.withCache(
              prompt,
              `step_23:performance_engineer:part:${i + 1}/${partitionsToAnalyze.length}:signals:${scores.totalIssues}`,
              async () => {
                const aiResult = await this.aiHelper.executeRequest(prompt, {
                  persona: 'performance_engineer',
                });
                return aiResult?.content ?? '';
              }
            );

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
          logger.warn(`Step 23: AI analysis skipped — ${promptError.message}`);
        }
      } else {
        logger.warn('Step 23: AI analysis skipped — AI helper not available');
      }

      const report = formatPerfReport(aiContent, scores);
      await this.backlog.saveStepSummary(23, 'Performance Review', report);

      logger.success('Step 23: Performance Review complete');

      return {
        success: true,
        skipped: false,
        fileCount: relativeFiles.length,
        scores,
        report,
      };
    } catch (error) {
      logger.error(`Step 23 failed: ${error.message}`);
      throw error;
    }
  }
}

export default Step23PerfReview;
