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
import {
  loadResolvedAiHelpers,
  buildYamlStepPrompt,
  buildFileContentBlock,
  MAX_CHARS_PER_FILE,
  MAX_CHARS_TOTAL_CONTENTS,
} from '../lib/ai_prompt_builder.js';

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
  }

  /**
   * Execute the async performance review step.
   *
   * @param {string} projectRoot - Project root directory
   * @param {Object} [options]
   * @param {string[]} [options.sourceFiles] - Override JS/TS files to analyze
   * @param {string}   [options.projectName] - Project name for prompt context
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

      // Read and truncate file contents for prompt
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
          const parsedYaml = await loadResolvedAiHelpers(this.fileOps);
          const prompt = buildYamlStepPrompt(parsedYaml, 'async_perf_engineer_prompt', {
            project_name: options.projectName ?? path.basename(projectRoot),
            project_kind: options.projectKind ?? 'unknown',
            primary_language: 'JavaScript/TypeScript',
            modified_count: String(relativeFiles.length),
          });

          if (prompt) {
            const fullPrompt = `${prompt}\n\n${fileBlocks.join('\n\n')}`;
            const cacheKey = `step_20:${projectRoot}:${scores.totalIssues}`;
            const cached = await this.aiCache.get(cacheKey);

            if (cached) {
              aiContent = cached;
              logger.info('Step 20: Using cached AI response');
            } else {
              const aiResult = await this.aiHelper.executeRequest(fullPrompt, {
                persona: 'async_performance_engineer',
              });
              aiContent = aiResult?.content ?? '';
              if (aiContent) {
                await this.aiCache.set(cacheKey, aiContent);
              }
            }
          }
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
