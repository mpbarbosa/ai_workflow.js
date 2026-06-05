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
import { detectFrameworksFromPackageJson } from '../lib/tech_stack.js';
import {
  buildPartitionFilePathsContext,
  buildReviewFileContentsBlock,
  buildReviewPromptPartitions,
  buildSplitFileCoverage,
  MAX_PROMPT_ENTRY_CHARS,
  MAX_PROMPT_ENTRIES_PER_PARTITION,
  MAX_PROMPT_PARTITION_CHARS,
  runPartitionedAiResponses,
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
const NON_RUNTIME_ACCESSIBILITY_PATH_PATTERN =
  /(^|\/)(?:test|tests|__tests__|__mocks__|fixtures?|cypress|e2e)(\/|$)/i;
const TEST_FILE_SUFFIX_PATTERN = /\.(?:test|spec)\.(?:html?|css|vue|[jt]sx?)$/i;
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
    !NON_RUNTIME_ACCESSIBILITY_PATH_PATTERN.test(normalized) &&
    !TEST_FILE_SUFFIX_PATTERN.test(normalized) &&
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

function normalizeFrameworkLabel(framework) {
  if (typeof framework !== 'string') {
    return null;
  }

  const normalized = framework.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (normalized === 'vue.js') return 'vue';
  if (normalized === 'next.js') return 'next';
  if (normalized === 'nuxt.js') return 'nuxt';
  if (normalized === 'gatsby.js') return 'gatsby';
  if (normalized === 'angular') return 'angular';
  if (normalized === 'svelte') return 'svelte';
  if (normalized === 'react') return 'react';
  if (normalized === 'vue') return 'vue';
  if (normalized === 'vanilla js') return 'vanilla';
  return normalized;
}

async function resolveAccessibilityFramework({
  projectRoot,
  options = {},
  fileOps,
  relativeFiles = [],
}) {
  const explicitFramework = normalizeFrameworkLabel(
    options.framework ??
      options.config?.tech_stack?.framework ??
      options.config?.techStack?.framework ??
      options.projectFramework
  );
  if (explicitFramework) {
    return explicitFramework;
  }

  try {
    const packageJsonRaw = await fileOps.readFile(path.join(projectRoot, 'package.json'));
    const packageJson = JSON.parse(packageJsonRaw);
    const detectedFrameworks = detectFrameworksFromPackageJson(packageJson);
    const preferredFrontendPackages = [
      'next',
      'nuxt',
      'gatsby',
      'vue',
      'react',
      '@angular/core',
      'svelte',
    ];
    const frontendFramework = preferredFrontendPackages.find((pkg) =>
      detectedFrameworks.some((framework) => framework?.package === pkg)
    );

    if (frontendFramework === '@angular/core') {
      return 'angular';
    }

    if (frontendFramework) {
      return normalizeFrameworkLabel(frontendFramework);
    }
  } catch {
    // Fall back to file-based inference when package.json is unavailable or invalid.
  }

  const normalizedFiles = (Array.isArray(relativeFiles) ? relativeFiles : []).map((file) =>
    String(file ?? '')
      .replace(/\\/g, '/')
      .toLowerCase()
  );

  if (normalizedFiles.some((file) => file.endsWith('.vue'))) return 'vue';
  if (normalizedFiles.some((file) => file.endsWith('.svelte'))) return 'svelte';
  if (normalizedFiles.some((file) => file.endsWith('.tsx') || file.endsWith('.jsx')))
    return 'react';

  return 'unknown';
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

export function buildAccessibilityConsolidationPrompt({
  projectName,
  projectDescription,
  framework,
  totalFileCount,
  readableFileCount,
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
      ? buildReviewFileContentsBlock(
          completeSplitEntries.map((entry) => ({
            relativePath: entry.relativePath,
            sourcePath: entry.relativePath,
            content: entry.content,
          }))
        )
      : '_No fully covered split files are available for file-level consolidation._';

  return [
    '**Role**: You are a Senior Accessibility Engineer specializing in WCAG 2.1 AA/AAA reviews.',
    '',
    '**Task**: Consolidate the partition findings below into one folder-scoped accessibility review.',
    '',
    '**Consolidation context:**',
    `- Project: ${projectName}`,
    `- Project Summary: ${projectDescription}`,
    `- Framework: ${framework}`,
    `- HTML/UI Files Considered: ${totalFileCount}`,
    `- Readable HTML/UI Files Analyzed: ${readableFileCount}`,
    '- Fully covered split files (all parts were analyzed):',
    fullyCoveredSplitList,
    '- Split files that remain incomplete in this run:',
    incompleteSplitList,
    '',
    '**Rules:**',
    '- Preserve only findings supported by the partition analyses and the fully covered split-file excerpts below.',
    '- You may promote a conclusion to a file-scoped verdict only for files listed under "Fully covered split files".',
    '- Do not introduce findings for files that are not mentioned below.',
    '- Remove duplicate partition boilerplate, repeated checklists, and overlapping remediation guidance.',
    '- If the evidence is still insufficient, say so plainly.',
    '',
    '**Required output:** Produce one consolidated accessibility review with the same structure used in the partition reviews.',
    '',
    '**Partition findings:**',
    partitionAnalyses.join('\n\n') || '_No partition findings were available._',
    '',
    '**Fully covered split-file contents:**',
    fullSplitFileBlock,
  ].join('\n');
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

      const resolvedFramework = await resolveAccessibilityFramework({
        projectRoot,
        options,
        fileOps: this.fileOps,
        relativeFiles,
      });

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

          const partitionAnalyses = [];
          const partitionResult = await runPartitionedAiResponses({
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
                framework: resolvedFramework,
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
            executePartition: async (_partition, { index: i, total }, prompt) => {
              const response = await this.aiCache.withCache(
                prompt,
                `step_22:accessibility_expert:part:${i + 1}/${total}:signals:${scores.totalIssues}`,
                () => this.aiHelper.executeRequest(prompt, { persona: 'accessibility_expert' })
              );
              const responseContent = response?.content ?? response?.text ?? response ?? '';
              if (responseContent) {
                partitionAnalyses.push(
                  total > 1
                    ? `#### Partition ${i + 1} of ${total}\n\n${responseContent}`
                    : responseContent
                );
              }
              return response;
            },
            extractContent: (response) => response?.content ?? response?.text ?? response ?? '',
          });
          aiContent = partitionResult.content;

          if (partitionResult.content && partitionsToAnalyze.length > 1) {
            const splitCoverage = buildSplitFileCoverage(
              partitionsToAnalyze.flatMap((partition) => partition.entries)
            );
            const completeSplitEntries = fileEntries.filter((entry) =>
              splitCoverage.completeSplitSourcePaths.includes(entry.relativePath)
            );
            const partitionAnalyses = partitionResult.content
              .split(/\n\n(?=#### Partition \d+ of \d+\n\n)/)
              .filter(Boolean);

            try {
              const consolidationPrompt = buildAccessibilityConsolidationPrompt({
                projectName: options.projectName ?? path.basename(projectRoot),
                projectDescription: options.projectDescription ?? 'Web application',
                framework: resolvedFramework,
                totalFileCount: relativeFiles.length,
                readableFileCount: fileEntries.length,
                completeSplitEntries,
                incompleteSplitSourcePaths: splitCoverage.incompleteSplitSourcePaths,
                partitionAnalyses,
              });
              const consolidatedResult = await this.aiCache.withCache(
                consolidationPrompt,
                `step_22:accessibility_expert:consolidated:partitions:${partitionsToAnalyze.length}:fullSplits:${splitCoverage.completeSplitSourcePaths.join(',') || 'none'}:signals:${scores.totalIssues}`,
                () =>
                  this.aiHelper.executeRequest(consolidationPrompt, {
                    persona: 'accessibility_expert',
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
              logger.warn(
                `[step_22] Accessibility review consolidation skipped — ${consolidationError.message}`
              );
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
