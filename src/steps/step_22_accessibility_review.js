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
import {
  loadResolvedAiHelpers,
  buildYamlStepPrompt,
  buildFileContentBlock,
  MAX_CHARS_PER_FILE,
  MAX_CHARS_TOTAL_CONTENTS,
} from '../lib/ai_prompt_builder.js';

const MAX_FILE_PATHS_IN_CONTEXT = 20;

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
 * Score the density of common accessibility anti-patterns across an array of
 * source file contents.
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
export function scoreAccessibilityIssues(fileContents) {
  const combined = fileContents.join('\n');

  // <img without alt= attribute
  const imgCount = (combined.match(/<img\b/gi) || []).length;
  const altCount = (combined.match(/<img\b[^>]*\balt=/gi) || []).length;
  const missingAltCount = Math.max(0, imgCount - altCount);

  // onclick handlers outside of button/a elements (heuristic: onclick= not preceded by <button or <a)
  const onclickCount = (combined.match(/\bonclick\s*=/gi) || []).length;

  // Interactive elements with tabindex="-1" (removing focus without alternative)
  const tabindexNegCount = (combined.match(/tabindex\s*=\s*["']-1["']/gi) || []).length;
  const keyboardTrapRisk = onclickCount + tabindexNegCount;

  // <button>, <input>, <select>, <textarea> without associated aria-label or aria-labelledby
  const interactiveCount = (combined.match(/<(button|input|select|textarea)\b/gi) || []).length;
  const ariaLabelledCount = (combined.match(/\baria-label(ledby)?\s*=/gi) || []).length;
  const missingAriaCount = Math.max(0, interactiveCount - ariaLabelledCount);

  // CSS animation/transition without prefers-reduced-motion
  const animationCount = (combined.match(/\b(animation|transition)\s*:/g) || []).length;
  const reducedMotionCount = (combined.match(/prefers-reduced-motion/g) || []).length;
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
export class Step22AccessibilityReview {
  constructor(options = {}) {
    this.fileOps = options.fileOps || new FileOperations();
    this.backlog = options.backlog || new Backlog();
    this.aiHelper = options.aiHelper || new AiHelper({ promptsDir: options.promptsDir ?? null });
    this.aiCache = options.aiCache || new AiCache();
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
      const allFiles =
        options.sourceFiles ??
        (await this.fileOps.listDirectoryRecursive(projectRoot, {
          extensions: ['.html', '.htm', '.vue', '.jsx', '.tsx', '.css'],
          exclude: ['node_modules', 'dist', 'build', 'coverage', '.git'],
        }));

      const relativeFiles = allFiles.map((f) =>
        path.isAbsolute(f) ? path.relative(projectRoot, f) : f
      );

      if (!isAccessibleProject(relativeFiles)) {
        logger.info('Step 22: No HTML/UI files found — skipping');
        return { success: true, skipped: true, message: 'No HTML/UI files found' };
      }

      logger.info(`Step 22: Analyzing ${relativeFiles.length} HTML/UI files`);

      let totalChars = 0;
      const fileContents = [];
      const fileBlocks = [];

      for (const relFile of relativeFiles) {
        if (totalChars >= MAX_CHARS_TOTAL_CONTENTS) break;
        try {
          const absPath = path.isAbsolute(relFile) ? relFile : path.join(projectRoot, relFile);
          let content = await this.fileOps.readFile(absPath);
          if (content.length > MAX_CHARS_PER_FILE) {
            content = content.slice(0, MAX_CHARS_PER_FILE) + '\n... [truncated]';
          }
          fileContents.push(content);
          fileBlocks.push(buildFileContentBlock(relFile, content));
          totalChars += content.length;
        } catch {
          // Skip unreadable files silently
        }
      }

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
          const filePathList = relativeFiles
            .slice(0, MAX_FILE_PATHS_IN_CONTEXT)
            .map((f) => `      - ${f}`)
            .join('\n');
          const filePathsContext =
            relativeFiles.length > MAX_FILE_PATHS_IN_CONTEXT
              ? `${filePathList}\n      ... and ${relativeFiles.length - MAX_FILE_PATHS_IN_CONTEXT} more`
              : filePathList;

          const parsedYaml = await loadResolvedAiHelpers(this.fileOps);
          const prompt = buildYamlStepPrompt(parsedYaml, 'accessibility_review_prompt', {
            project_name: options.projectName ?? path.basename(projectRoot),
            project_description: options.projectDescription ?? 'Web application',
            framework: options.framework ?? 'vanilla',
            source_file_count: String(relativeFiles.length),
            file_paths: filePathsContext,
          });

          if (prompt) {
            const fullPrompt = `${prompt}\n\n${fileBlocks.join('\n\n')}`;
            const cacheKey = `step_22:${projectRoot}:${scores.totalIssues}`;
            const cached = await this.aiCache.get(cacheKey);

            if (cached) {
              aiContent = cached;
              logger.info('Step 22: Using cached AI response');
            } else {
              const aiResult = await this.aiHelper.executeRequest(fullPrompt, {
                persona: 'accessibility_expert',
              });
              aiContent = aiResult?.content ?? '';
              if (aiContent) {
                await this.aiCache.set(cacheKey, aiContent);
              }
            }
          }
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
