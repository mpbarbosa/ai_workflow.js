/**
 * Step 22: Accessibility Review
 * @module steps/step_22_accessibility_review
 * @version 2.0.0
 *
 * Uses the `accessibility_expert` persona to review HTML, Vue, JSX/TSX, and CSS
 * source files for WCAG 2.1 AA/AAA compliance issues: missing ARIA attributes,
 * insufficient colour contrast, keyboard navigation gaps, semantic HTML violations,
 * and missing reduced-motion guards.
 *
 * Skips gracefully when no HTML/UI files are found in the project.
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
import { CommitHistory } from '../lib/commit_history.js';
import {
  DEFAULT_MAX_PROMPT_ENTRY_CHARS,
  DEFAULT_MAX_PROMPT_ENTRIES_PER_PARTITION,
  DEFAULT_MAX_PROMPT_PARTITION_CHARS,
  buildPromptFileContentsBlock,
  buildPromptPartitions,
  filterReviewTargets,
  loadReadableReviewFiles,
  splitPromptEntry,
} from '../lib/review_prompt_scope.js';
import { loadResolvedAiHelpers, buildYamlStepPrompt } from '../lib/ai_prompt_builder.js';

const MAX_FILE_PATHS_IN_CONTEXT = 20;
export const MAX_PROMPT_ENTRY_CHARS = DEFAULT_MAX_PROMPT_ENTRY_CHARS;
export const MAX_PROMPT_PARTITION_CHARS = DEFAULT_MAX_PROMPT_PARTITION_CHARS;
export const MAX_PROMPT_ENTRIES_PER_PARTITION = DEFAULT_MAX_PROMPT_ENTRIES_PER_PARTITION;

const GENERATED_ACCESSIBILITY_PATH_PREFIXES = [
  '.ai_workflow/',
  'docs/api/html/',
  'api-generated/',
  'typedoc/',
  'api-docs/',
  'jsdoc/',
  'lcov-report/',
];
const IMG_TAG_PATTERN = /<img\b/gi;
const IMG_ALT_PATTERN = /<img\b[^>]*\balt=/gi;
const ONCLICK_PATTERN = /\bonclick\s*=/gi;
const TABINDEX_NEG_PATTERN = /tabindex\s*=\s*["']-1["']/gi;
const INTERACTIVE_ELEMENT_PATTERN = /<(button|input|select|textarea)\b/gi;
const ARIA_LABEL_PATTERN = /\baria-label(ledby)?\s*=/gi;
const ANIMATION_PATTERN = /\b(animation|transition)\s*:/g;
const REDUCED_MOTION_PATTERN = /prefers-reduced-motion/g;

// ============================================================================
// PURE FUNCTIONS
// ============================================================================

/**
 * Determine whether a list of file paths contains HTML or UI component files
 * that warrant an accessibility review.
 *
 * Returns `true` if at least one `.html`, `.vue`, `.jsx`, `.tsx`, or `.css` file
 * is present.
 *
 * @param {string[]} files - Relative or absolute file paths
 * @returns {boolean}
 */
export function isAccessibleProject(files) {
  return files.some((f) => /\.(html?|vue|[jt]sx|css)$/i.test(f));
}

/**
 * Determine whether a file path is a valid step_22 accessibility-review target.
 *
 * @param {string} filePath - Relative or absolute file path
 * @returns {boolean}
 */
export function isAccessibilityReviewTarget(filePath) {
  const normalized = String(filePath ?? '').replace(/\\/g, '/');

  return (
    /\.(html?|vue|[jt]sx|css)$/i.test(normalized) &&
    !GENERATED_ACCESSIBILITY_PATH_PREFIXES.some((prefix) => normalized.startsWith(prefix))
  );
}

/**
 * Filter and deduplicate a list of file paths down to step_22 review targets.
 *
 * @param {string[]} files - File paths to normalize
 * @returns {string[]}
 */
export function filterAccessibilityReviewTargets(files) {
  return filterReviewTargets(files, isAccessibilityReviewTarget);
}

/**
 * Score the density of common accessibility anti-patterns across an array of
 * source file contents without concatenating the full review scope into a
 * single large string.
 *
 * Scoring heuristics (per-file occurrences, case-insensitive):
 * - `<img` without `alt=`       → missing image alt text (WCAG 1.1.1)
 * - `onclick=` on non-button    → potential keyboard inaccessibility (WCAG 2.1.1)
 * - `tabindex="-1"` on focusable → removing focusability without alt path (WCAG 2.1.1)
 * - Missing `aria-label`/`aria-labelledby` on interactive elements (WCAG 4.1.2)
 * - CSS `animation`/`transition` without `prefers-reduced-motion` guard (WCAG 2.3.3)
 *
 * @param {string[]} fileContents - Array of source file content strings
 * @returns {{
 *   missingAltCount: number,
 *   keyboardTrapRisk: number,
 *   missingAriaCount: number,
 *   missingReducedMotionCount: number,
 *   totalIssues: number
 * }}
 */
function countMatches(content, pattern) {
  if (typeof content !== 'string' || content.length === 0) {
    return 0;
  }

  pattern.lastIndex = 0;
  let count = 0;

  while (pattern.exec(content) !== null) {
    count += 1;
  }

  return count;
}

export function scoreAccessibilityIssues(fileContents) {
  const contents = Array.isArray(fileContents) ? fileContents : [];
  const imgCount = contents.reduce(
    (total, content) => total + countMatches(content, IMG_TAG_PATTERN),
    0
  );
  const altCount = contents.reduce(
    (total, content) => total + countMatches(content, IMG_ALT_PATTERN),
    0
  );
  const missingAltCount = Math.max(0, imgCount - altCount);

  // onclick handlers outside of button/a elements (heuristic: onclick= not preceded by <button or <a)
  const onclickCount = contents.reduce(
    (total, content) => total + countMatches(content, ONCLICK_PATTERN),
    0
  );

  // Interactive elements with tabindex="-1" (removing focus without alternative)
  const tabindexNegCount = contents.reduce(
    (total, content) => total + countMatches(content, TABINDEX_NEG_PATTERN),
    0
  );
  const keyboardTrapRisk = onclickCount + tabindexNegCount;

  // <button>, <input>, <select>, <textarea> without associated aria-label or aria-labelledby
  const interactiveCount = contents.reduce(
    (total, content) => total + countMatches(content, INTERACTIVE_ELEMENT_PATTERN),
    0
  );
  const ariaLabelledCount = contents.reduce(
    (total, content) => total + countMatches(content, ARIA_LABEL_PATTERN),
    0
  );
  const missingAriaCount = Math.max(0, interactiveCount - ariaLabelledCount);

  // CSS animation/transition without prefers-reduced-motion
  const animationCount = contents.reduce(
    (total, content) => total + countMatches(content, ANIMATION_PATTERN),
    0
  );
  const reducedMotionCount = contents.reduce(
    (total, content) => total + countMatches(content, REDUCED_MOTION_PATTERN),
    0
  );
  const missingReducedMotionCount = Math.max(0, animationCount - reducedMotionCount);

  return {
    missingAltCount,
    keyboardTrapRisk,
    missingAriaCount,
    missingReducedMotionCount,
    totalIssues: missingAltCount + keyboardTrapRisk + missingAriaCount + missingReducedMotionCount,
  };
}

/**
 * Split a single accessibility-review source file into prompt-safe entries
 * without dropping content.
 *
 * Oversized files are sliced into labeled `(part X/Y)` segments so the AI sees
 * the complete file across multiple prompt logs instead of a single truncated
 * excerpt.
 *
 * @param {{relativePath: string, content: string}} entry - Source file entry
 * @param {number} [maxEntryChars=MAX_PROMPT_ENTRY_CHARS] - Max chars per entry
 * @returns {Array<{relativePath: string, sourcePath: string, content: string}>}
 */
export function splitAccessibilityPromptEntry(entry, maxEntryChars = MAX_PROMPT_ENTRY_CHARS) {
  return splitPromptEntry(entry, maxEntryChars);
}

/**
 * Partition the accessibility-review source payload into prompt-safe batches.
 *
 * @param {Array<{relativePath: string, content: string}>} fileEntries - Raw file entries
 * @param {number} [maxPartitionChars=MAX_PROMPT_PARTITION_CHARS] - Max chars per prompt batch
 * @param {number} [maxEntryChars=MAX_PROMPT_ENTRY_CHARS] - Max chars per prompt entry
 * @returns {Array<{entries: Array<{relativePath: string, sourcePath: string, content: string}>, scopePaths: string[]}>}
 */
export function buildAccessibilityPromptPartitions(
  fileEntries,
  maxPartitionChars = MAX_PROMPT_PARTITION_CHARS,
  maxEntryChars = MAX_PROMPT_ENTRY_CHARS
) {
  return buildPromptPartitions(fileEntries, {
    maxPartitionChars,
    maxEntryChars,
    maxEntriesPerPartition: MAX_PROMPT_ENTRIES_PER_PARTITION,
  });
}

/**
 * Build a markdown block for the current accessibility-review prompt partition.
 *
 * @param {Array<{relativePath: string, sourcePath: string, content: string}>} entries - Prompt entries
 * @returns {string} Markdown file-content block
 */
export function buildAccessibilityFileContentsBlock(entries) {
  return buildPromptFileContentsBlock(entries);
}

/**
 * Format the AI response and heuristic scores into a markdown summary block
 * suitable for saving to the backlog.
 *
 * @param {string} aiContent - Raw AI-generated review text
 * @param {{
 *   missingAltCount: number,
 *   keyboardTrapRisk: number,
 *   missingAriaCount: number,
 *   missingReducedMotionCount: number,
 *   totalIssues: number
 * }} scores - Heuristic issue counts
 * @returns {string} Formatted markdown report
 */
export function formatAccessibilityReport(aiContent, scores) {
  const lines = [
    '## Accessibility Review',
    '',
    '### Heuristic Pre-scan',
    `| Indicator | Count |`,
    `| --- | --- |`,
    `| Images missing alt attribute (WCAG 1.1.1) | ${scores.missingAltCount} |`,
    `| Keyboard accessibility risks (onclick/tabindex=-1) | ${scores.keyboardTrapRisk} |`,
    `| Interactive elements missing ARIA labels (WCAG 4.1.2) | ${scores.missingAriaCount} |`,
    `| Animations without reduced-motion guard (WCAG 2.3.3) | ${scores.missingReducedMotionCount} |`,
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
  id: 'step_22',
  name: 'Accessibility Review',
  kind: STEP_KIND.ANALYSIS,
  description:
    'AI-powered WCAG 2.1 AA/AAA accessibility review (ARIA, keyboard navigation, colour contrast, reduced-motion)',
  dependencies: ['step_21'],
};

// ============================================================================
// IMPURE WRAPPER
// ============================================================================

/**
 * Step 22: Accessibility Review
 *
 * Discovers HTML, Vue, JSX/TSX, and CSS files, builds a structured prompt using
 * the `accessibility_review_prompt` persona from ai_helpers.yaml, and generates a
 * detailed WCAG compliance report.
 *
 * Skips gracefully when the project contains no HTML/UI files.
 */
export class Step22AccessibilityReview {
  constructor(options = {}) {
    this.fileOps = options.fileOps || new FileOperations();
    this.backlog = options.backlog || new Backlog();
    this.aiHelper = options.aiHelper || new AiHelper({ promptsDir: options.promptsDir ?? null });
    this.aiCache = options.aiCache || new AiCache();
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
      files: filterAccessibilityReviewTargets(mergedFiles.map((file) => file.file || file)),
      baselineHash,
    };
  }

  /**
   * Execute the accessibility review step.
   *
   * @param {string} projectRoot - Project root directory
   * @param {Object} [options]
   * @param {string[]} [options.sourceFiles] - Override UI files to analyze
   * @param {string}   [options.projectName] - Project name for prompt context
   * @param {string}   [options.projectDescription] - Short project description
   * @param {string}   [options.framework] - UI framework (vue, react, vanilla, etc.)
   * @returns {Promise<Object>} Step result
   */
  async execute(projectRoot, options = {}) {
    logger.step('Step 22: Accessibility Review');

    try {
      let analysisMode = 'full-scan';
      let baselineHash = null;
      let relativeFiles;

      if (Array.isArray(options.sourceFiles)) {
        analysisMode = 'override';
        relativeFiles = filterAccessibilityReviewTargets(
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
          relativeFiles = filterAccessibilityReviewTargets(
            options.modifiedFiles.map((file) =>
              path.isAbsolute(file) ? path.relative(projectRoot, file) : file
            )
          );
        } else {
          const allFiles = await this.fileOps.listDirectoryRecursive(projectRoot, {
            extensions: ['.html', '.htm', '.vue', '.jsx', '.tsx', '.css'],
            exclude: ['node_modules', 'dist', 'build', 'coverage', '.git'],
          });

          relativeFiles = filterAccessibilityReviewTargets(
            allFiles.map((file) =>
              path.isAbsolute(file) ? path.relative(projectRoot, file) : file
            )
          );
        }
      }

      if (!isAccessibleProject(relativeFiles)) {
        if (analysisMode === 'since-last-successful-run') {
          logger.info('Step 22: No HTML/UI files changed since last successful run — skipping');
          return {
            success: true,
            skipped: true,
            message: 'No HTML/UI files changed since last successful run',
          };
        }

        logger.info('Step 22: No HTML/UI files found — skipping');
        return { success: true, skipped: true, message: 'No HTML/UI files found' };
      }

      if (analysisMode === 'since-last-successful-run') {
        logger.info(
          `Step 22: Analyzing ${relativeFiles.length} HTML/UI file(s) changed since last successful run (${baselineHash?.substring(0, 7) ?? 'unknown'})`
        );
      } else {
        logger.info(`Step 22: Analyzing ${relativeFiles.length} HTML/UI files`);
      }

      const { fileContents, fileEntries } = await loadReadableReviewFiles(
        this.fileOps,
        projectRoot,
        relativeFiles
      );

      const scores = scoreAccessibilityIssues(fileContents);
      logger.info(
        `Step 22: Heuristic signals — ${scores.totalIssues} total ` +
          `(${scores.missingAltCount} missing alt, ` +
          `${scores.keyboardTrapRisk} keyboard risks, ` +
          `${scores.missingAriaCount} missing ARIA, ` +
          `${scores.missingReducedMotionCount} missing reduced-motion)`
      );

      let aiContent = '';
      const aiAvailable = await this.aiHelper.initialize();

      if (aiAvailable) {
        await this.aiCache.init();
        try {
          const parsedYaml = await loadResolvedAiHelpers(this.fileOps);
          const promptPartitions =
            fileEntries.length > 0 ? buildAccessibilityPromptPartitions(fileEntries) : [];
          const partitionsToAnalyze =
            promptPartitions.length > 0 ? promptPartitions : [{ entries: [], scopePaths: [] }];

          if (partitionsToAnalyze.length > 1) {
            logger.info(
              `[step_22] Running AI analysis in ${partitionsToAnalyze.length} partition(s) to avoid prompt truncation`
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
            const fileContentBlock = buildAccessibilityFileContentsBlock(partition.entries);
            const prompt = buildYamlStepPrompt(parsedYaml, 'accessibility_review_prompt', {
              partition_header:
                partitionsToAnalyze.length > 1
                  ? `[Partition ${i + 1} of ${partitionsToAnalyze.length} — analyze ONLY the files or file-parts listed below for this request]`
                  : '',
              partition_scope_note:
                partitionsToAnalyze.length > 1
                  ? `This request covers ${partition.scopePaths.length} of ${relativeFiles.length} HTML/UI file(s) in the current accessibility-review run. Entries labeled "(part X/Y)" are sequential chunks of oversized files that were split across multiple prompt logs to avoid truncated code excerpts.`
                  : `This request contains the full readable HTML/UI scope for this run (${fileEntries.length} readable file(s)).`,
              project_name: options.projectName ?? path.basename(projectRoot),
              project_description: options.projectDescription ?? 'Web application',
              framework: options.framework ?? 'vanilla',
              source_file_count:
                partitionsToAnalyze.length > 1
                  ? `${relativeFiles.length} total (${partition.scopePaths.length} covered in this request)`
                  : String(relativeFiles.length),
              file_paths: filePathsContext || '      - (no readable HTML/UI files were available)',
              file_content_block:
                fileContentBlock ||
                '_No readable file excerpts were available in the current context window._',
            });

            if (!prompt) continue;

            const response = await this.aiCache.withCache(
              prompt,
              `step_22:accessibility_expert:part:${i + 1}/${partitionsToAnalyze.length}:signals:${scores.totalIssues}`,
              async () => {
                const aiResult = await this.aiHelper.executeRequest(prompt, {
                  persona: 'accessibility_expert',
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
          logger.warn(`Step 22: AI analysis skipped — ${promptError.message}`);
        }
      } else {
        logger.warn('Step 22: AI analysis skipped — AI helper not available');
      }

      const report = formatAccessibilityReport(aiContent, scores);
      await this.backlog.saveStepSummary(22, 'Accessibility Review', report);

      logger.success('Step 22: Accessibility Review complete');

      return {
        success: true,
        skipped: false,
        fileCount: relativeFiles.length,
        scores,
        report,
      };
    } catch (error) {
      logger.error(`Step 22 failed: ${error.message}`);
      throw error;
    }
  }
}

export default Step22AccessibilityReview;
