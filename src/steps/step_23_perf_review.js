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
import {
  loadResolvedAiHelpers,
  buildYamlStepPrompt,
  buildFileContentBlock,
  MAX_CHARS_TOTAL_CONTENTS,
} from '../lib/ai_prompt_builder.js';

const MAX_FILE_PATHS_IN_CONTEXT = 20;

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
      const allFiles =
        options.sourceFiles ??
        (await this.fileOps.listDirectoryRecursive(projectRoot, {
          extensions: ['.js', '.mjs', '.cjs', '.ts', '.tsx'],
          exclude: ['node_modules', 'dist', 'build', 'coverage', '.git'],
        }));

      const relativeFiles = allFiles.map((f) =>
        path.isAbsolute(f) ? path.relative(projectRoot, f) : f
      );

      if (!isPerformanceSensitiveProject(relativeFiles)) {
        logger.info('Step 23: No JavaScript/TypeScript files found — skipping');
        return { success: true, skipped: true, message: 'No JS/TS files found' };
      }

      logger.info(`Step 23: Analyzing ${relativeFiles.length} JS/TS files`);

      let totalChars = 0;
      const fileContents = [];
      const fileBlocks = [];

      for (const relFile of relativeFiles) {
        if (totalChars >= MAX_CHARS_TOTAL_CONTENTS) break;
        try {
          const absPath = path.isAbsolute(relFile) ? relFile : path.join(projectRoot, relFile);
          const content = await this.fileOps.readFile(absPath);
          fileContents.push(content);
          fileBlocks.push(buildFileContentBlock(relFile, content));
          totalChars += content.length;
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

          const filePathList = relativeFiles
            .slice(0, MAX_FILE_PATHS_IN_CONTEXT)
            .map((f) => `      - ${f}`)
            .join('\n');
          const filePathsContext =
            relativeFiles.length > MAX_FILE_PATHS_IN_CONTEXT
              ? `${filePathList}\n      ... and ${relativeFiles.length - MAX_FILE_PATHS_IN_CONTEXT} more`
              : filePathList;

          const parsedYaml = await loadResolvedAiHelpers(this.fileOps);
          const prompt = buildYamlStepPrompt(parsedYaml, 'performance_review_prompt', {
            project_name: options.projectName ?? path.basename(projectRoot),
            project_description: options.projectDescription ?? 'JavaScript/TypeScript project',
            primary_language: 'JavaScript/TypeScript',
            build_system: buildSystem,
            source_file_count: String(relativeFiles.length),
            file_paths: filePathsContext,
          });

          if (prompt) {
            const fullPrompt = `${prompt}\n\n${fileBlocks.join('\n\n')}`;
            const cacheKey = `step_23:${projectRoot}:${scores.totalIssues}`;
            const cached = await this.aiCache.get(cacheKey);

            if (cached) {
              aiContent = cached;
              logger.info('Step 23: Using cached AI response');
            } else {
              const aiResult = await this.aiHelper.executeRequest(fullPrompt, {
                persona: 'performance_engineer',
              });
              aiContent = aiResult?.content ?? '';
              if (aiContent) {
                await this.aiCache.set(cacheKey, aiContent);
              }
            }
          }
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
