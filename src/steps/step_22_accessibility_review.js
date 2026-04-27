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
import { filterReviewTargets, loadReadableReviewFiles } from '../lib/review_prompt_scope.js';
import { loadResolvedAiHelpers, buildYamlStepPrompt } from '../lib/ai_prompt_builder.js';
import {
  buildPartitionFilePathsContext,
  buildReviewFileContentsBlock,
  buildReviewPromptPartitions,
  MAX_PROMPT_ENTRY_CHARS,
  MAX_PROMPT_ENTRIES_PER_PARTITION,
  MAX_PROMPT_PARTITION_CHARS,
  runPartitionedAiAnalysis,
  splitReviewPromptEntry,
} from '../lib/review_step_helpers.js';
import { ReviewStepBase } from '../lib/review_step_base.js';
import { initializeStepAiContext } from './step_execution_helpers.js';

export {
  buildReviewFileContentsBlock as buildAccessibilityFileContentsBlock,
  buildReviewPromptPartitions as buildAccessibilityPromptPartitions,
  MAX_PROMPT_ENTRY_CHARS,
  MAX_PROMPT_PARTITION_CHARS,
  MAX_PROMPT_ENTRIES_PER_PARTITION,
  splitReviewPromptEntry as splitAccessibilityPromptEntry,
};

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
export class Step22AccessibilityReview extends ReviewStepBase {
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
      const { analysisMode, baselineHash, relativeFiles } = await this._resolveAnalysisScope(
        projectRoot,
        options,
        {
          extensions: ['.html', '.htm', '.vue', '.jsx', '.tsx', '.css'],
          filterFn: filterAccessibilityReviewTargets,
        }
      );

      const skipResult = this._buildSkipResult(relativeFiles, isAccessibleProject, {
        emptyMessage: 'No HTML/UI files found',
        sinceLastRunMessage: 'No HTML/UI files changed since last successful run',
        analysisMode,
      });
      if (skipResult) {
        logger.info(`Step 22: ${skipResult.message} — skipping`);
        return skipResult;
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
      const aiAvailable = await initializeStepAiContext({
        aiHelper: this.aiHelper,
        aiCache: this.aiCache,
      });

      if (aiAvailable) {
        try {
          const parsedYaml = await loadResolvedAiHelpers(this.fileOps);
          const promptPartitions =
            fileEntries.length > 0 ? buildReviewPromptPartitions(fileEntries) : [];
          const partitionsToAnalyze =
            promptPartitions.length > 0 ? promptPartitions : [{ entries: [], scopePaths: [] }];

          if (partitionsToAnalyze.length > 1) {
            logger.info(
              `[step_22] Running AI analysis in ${partitionsToAnalyze.length} partition(s) to avoid prompt truncation`
            );
          }

          aiContent = await runPartitionedAiAnalysis({
            partitions: partitionsToAnalyze,
            buildPrompt: (partition, { index: i, total }) => {
              const filePathsContext = buildPartitionFilePathsContext(partition.entries);
              const fileContentBlock = buildReviewFileContentsBlock(partition.entries);
              return buildYamlStepPrompt(parsedYaml, 'accessibility_review_prompt', {
                partition_header:
                  total > 1
                    ? `[Partition ${i + 1} of ${total} — analyze ONLY the files or file-parts listed below for this request]`
                    : '',
                partition_scope_note:
                  total > 1
                    ? `This request covers ${partition.scopePaths.length} of ${relativeFiles.length} HTML/UI file(s) in the current accessibility-review run. Entries labeled "(part X/Y)" are sequential chunks of oversized files that were split across multiple prompt logs to avoid truncated code excerpts.`
                    : `This request contains the full readable HTML/UI scope for this run (${fileEntries.length} readable file(s)).`,
                project_name: options.projectName ?? path.basename(projectRoot),
                project_description: options.projectDescription ?? 'Web application',
                framework: options.framework ?? 'vanilla',
                source_file_count:
                  total > 1
                    ? `${relativeFiles.length} total (${partition.scopePaths.length} covered in this request)`
                    : String(relativeFiles.length),
                file_paths:
                  filePathsContext || '      - (no readable HTML/UI files were available)',
                file_content_block:
                  fileContentBlock ||
                  '_No readable file excerpts were available in the current context window._',
              });
            },
            buildCacheKey: (_partition, { index: i, total }) =>
              `step_22:accessibility_expert:part:${i + 1}/${total}:signals:${scores.totalIssues}`,
            persona: 'accessibility_expert',
            aiCache: this.aiCache,
            aiHelper: this.aiHelper,
          });
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
