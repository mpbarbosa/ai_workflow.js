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
import { generateCacheKey } from '../lib/ai_cache.js';
import { TechStackDetector } from '../lib/tech_stack.js';
import { filterReviewTargets, loadReadableReviewFiles } from '../lib/review_prompt_scope.js';
import { loadResolvedAiHelpers, buildYamlStepPrompt } from '../lib/ai_prompt_builder.js';
import {
  buildPartitionFilePathsContext,
  buildReviewFileContentsBlock,
  buildReviewPromptPartitions,
  buildSplitFileCoverage,
  MAX_PROMPT_ENTRY_CHARS,
  MAX_PROMPT_PARTITION_CHARS,
  MAX_PROMPT_ENTRIES_PER_PARTITION,
  splitReviewPromptEntry,
} from '../lib/review_step_helpers.js';
import { ReviewStepBase } from '../lib/review_step_base.js';
import { initializeStepAiContext } from './step_execution_helpers.js';

export {
  buildReviewFileContentsBlock as buildPerformanceFileContentsBlock,
  buildReviewPromptPartitions as buildPerformancePromptPartitions,
  MAX_PROMPT_ENTRY_CHARS,
  MAX_PROMPT_PARTITION_CHARS,
  MAX_PROMPT_ENTRIES_PER_PARTITION,
  splitReviewPromptEntry as splitPerformancePromptEntry,
};
const TEST_FILE_PATH_PATTERN = /(^|\/)(test|tests|__tests__)(\/|$)/i;
const TEST_FILE_NAME_PATTERN = /\.(test|spec)\.[cm]?[jt]sx?$/i;
const PARTITION_SUFFIX_RE = /\s+\(part \d+\/\d+\)$/i;
const PERFORMANCE_FILE_REFERENCE_RE = /\b[\w./-]+\.[cm]?[jt]sx?\b/g;
const PERFORMANCE_REVIEW_EXTENSIONS = ['.js', '.mjs', '.cjs', '.ts', '.tsx'];
const PERFORMANCE_REVIEW_EXCLUDES = ['node_modules', 'dist', 'build', 'coverage', '.git'];
const PERFORMANCE_GENERATED_PATH_PATTERNS = [
  /(^|\/)(dist|build|out|coverage|node_modules|vendor|\.next|\.nuxt|\.svelte-kit|\.cache|\.parcel-cache|\.ai_workflow)(\/|$)/,
  /(^|\/)docs\/api(\/|$)/,
  /(^|\/)docs\/api-generated(\/|$)/,
  /(^|\/)public\/v[^/]+\/assets(\/|$)/,
  /(^|\/)assets\/js(\/|$)/,
  /\.min\.js$/i,
];

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
  const isTestFile =
    TEST_FILE_PATH_PATTERN.test(normalized) || TEST_FILE_NAME_PATTERN.test(normalized);
  const isGeneratedArtifact = PERFORMANCE_GENERATED_PATH_PATTERNS.some((pattern) =>
    pattern.test(normalized.toLowerCase())
  );

  return (
    /\.[cm]?[jt]sx?$/i.test(normalized) &&
    !/\.d\.ts$/i.test(normalized) &&
    !isGeneratedArtifact &&
    !isTestFile
  );
}

/**
 * Filter and deduplicate a list of file paths down to step_23 review targets.
 *
 * @param {string[]} files - File paths to normalize
 * @returns {string[]}
 */
export function filterPerformanceReviewTargets(files) {
  return filterReviewTargets(files, isPerformanceReviewTarget);
}

/**
 * Normalize a performance-review scope path so prompt partition labels do not
 * affect file identity comparisons.
 *
 * @param {string} filePath - Relative or absolute file path
 * @returns {string}
 */
export function normalizePerformanceScopePath(filePath) {
  return String(filePath ?? '')
    .replace(/\\/g, '/')
    .replace(PARTITION_SUFFIX_RE, '')
    .trim();
}

/**
 * Extract JavaScript/TypeScript file references mentioned in an AI response.
 *
 * @param {string} aiResponse - Raw AI response text
 * @returns {string[]} Deduplicated file references in normalized form
 */
export function extractPerformanceResponseFileMentions(aiResponse) {
  const response = String(aiResponse ?? '');
  const matches = response.match(PERFORMANCE_FILE_REFERENCE_RE) || [];

  return [...new Set(matches.map(normalizePerformanceScopePath).filter(Boolean))];
}

/**
 * Validate that an AI response stays within the current partition's visible file scope.
 *
 * @param {string} aiResponse - Raw AI response text
 * @param {string[]} relativeFilePaths - Relative file paths included in the current partition
 * @returns {{adequate: boolean, reason: string, offScopeMentions: string[]}}
 */
export function validatePerformanceAiResponseScope(aiResponse, relativeFilePaths) {
  const response = String(aiResponse ?? '');
  const scopePaths = [
    ...new Set((relativeFilePaths ?? []).map(normalizePerformanceScopePath)),
  ].filter(Boolean);

  if (scopePaths.length === 0) {
    return { adequate: true, reason: 'no files to check', offScopeMentions: [] };
  }

  if (response.trim().length === 0) {
    return { adequate: false, reason: 'empty response', offScopeMentions: [] };
  }

  const offScopeMentions = extractPerformanceResponseFileMentions(response).filter((reference) => {
    const referenceBase = path.posix.basename(reference);
    return !scopePaths.some((scopePath) => {
      const scopeBase = path.posix.basename(scopePath);
      return (
        scopePath === reference ||
        scopePath.endsWith(`/${reference}`) ||
        reference.endsWith(`/${scopePath}`) ||
        scopeBase === reference ||
        scopeBase === referenceBase
      );
    });
  });

  if (offScopeMentions.length > 0) {
    return {
      adequate: false,
      reason: `response referenced file(s) outside the visible scope: ${offScopeMentions.join(', ')}`,
      offScopeMentions,
    };
  }

  return { adequate: true, reason: 'response stayed within visible scope', offScopeMentions: [] };
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

export function buildPerformanceConsolidationPrompt({
  projectName,
  projectDescription,
  buildSystem,
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
    '**Role**: You are a Senior JavaScript/TypeScript Performance Engineer.',
    '',
    '**Task**: Consolidate the partition findings below into one folder-scoped performance review.',
    '',
    '**Consolidation context:**',
    `- Project: ${projectName}`,
    `- Project Summary: ${projectDescription}`,
    '- Primary Language: JavaScript/TypeScript',
    `- Build System: ${buildSystem}`,
    `- Source Files Considered: ${totalFileCount}`,
    `- Readable Source Files Analyzed: ${readableFileCount}`,
    '- Fully covered split files (all parts were analyzed):',
    fullyCoveredSplitList,
    '- Split files that remain incomplete in this run:',
    incompleteSplitList,
    '',
    '**Rules:**',
    '- Preserve only findings supported by the partition analyses and the fully covered split-file excerpts below.',
    '- You may promote a conclusion to a file-scoped verdict only for files listed under "Fully covered split files".',
    '- Do not introduce findings for files that are not mentioned below.',
    '- Remove duplicate partition boilerplate, repeated tables, and overlapping recommendations.',
    '- If the evidence is still insufficient, say so plainly.',
    '',
    '**Required output:** Produce one consolidated performance review with the same structure used in the partition reviews.',
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
export class Step23PerfReview extends ReviewStepBase {
  constructor(options = {}) {
    super(options);
    this.techStack = options.techStack || new TechStackDetector();
  }

  async resolvePerformanceAnalysisScope(projectRoot, options = {}) {
    if (Array.isArray(options.sourceFiles)) {
      return {
        analysisMode: 'override',
        relativeFiles: this._normalizeScopedFiles(
          projectRoot,
          options.sourceFiles,
          filterPerformanceReviewTargets
        ),
      };
    }

    if (Array.isArray(options.modifiedFiles) && options.modifiedFiles.length > 0) {
      return {
        analysisMode: 'modified-files',
        relativeFiles: this._normalizeScopedFiles(
          projectRoot,
          options.modifiedFiles,
          filterPerformanceReviewTargets
        ),
      };
    }

    const allFiles = await this.fileOps.listDirectoryRecursive(projectRoot, {
      extensions: PERFORMANCE_REVIEW_EXTENSIONS,
      exclude: PERFORMANCE_REVIEW_EXCLUDES,
    });

    return {
      analysisMode: 'full-scan',
      relativeFiles: this._normalizeScopedFiles(
        projectRoot,
        allFiles,
        filterPerformanceReviewTargets
      ),
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
      const { analysisMode, relativeFiles } = await this.resolvePerformanceAnalysisScope(
        projectRoot,
        options
      );

      const skipResult = this._buildSkipResult(relativeFiles, isPerformanceSensitiveProject, {
        emptyMessage: 'No JS/TS files found',
        sinceLastRunMessage: 'No JS/TS files changed since last successful run',
        analysisMode,
      });
      if (skipResult) {
        logger.info(`Step 23: ${skipResult.message} — skipping`);
        return skipResult;
      }

      if (analysisMode === 'modified-files') {
        logger.info(`Step 23: Analyzing ${relativeFiles.length} modified JS/TS file(s)`);
      } else {
        logger.info(`Step 23: Analyzing ${relativeFiles.length} JS/TS files`);
      }

      const { fileContents, fileEntries } = await loadReadableReviewFiles(
        this.fileOps,
        projectRoot,
        relativeFiles
      );

      const scores = scorePerfIssues(fileContents);
      logger.info(
        `Step 23: Heuristic signals — ${scores.totalIssues} total ` +
          `(${scores.nestedLoopCount} nested loops, ` +
          `${scores.syncIoCount} sync I/O, ` +
          `${scores.jsonParseCount} JSON ops, ` +
          `${scores.objectInLoopCount} objects in loops)`
      );

      let aiContent = '';
      const aiAvailable = await initializeStepAiContext({
        aiHelper: this.aiHelper,
        aiCache: this.aiCache,
      });

      if (aiAvailable) {
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
            fileEntries.length > 0 ? buildReviewPromptPartitions(fileEntries) : [];
          const partitionsToAnalyze =
            promptPartitions.length > 0 ? promptPartitions : [{ entries: [], scopePaths: [] }];

          if (partitionsToAnalyze.length > 1) {
            logger.info(
              `[step_23] Running AI analysis in ${partitionsToAnalyze.length} partition(s) to avoid prompt truncation`
            );
          }

          const aiSections = [];
          const validPartitionAnalyses = [];

          for (let i = 0; i < partitionsToAnalyze.length; i++) {
            const partition = partitionsToAnalyze[i];
            const total = partitionsToAnalyze.length;
            const filePathsContext = buildPartitionFilePathsContext(partition.entries);
            const fileContentBlock = buildReviewFileContentsBlock(partition.entries);
            const prompt = buildYamlStepPrompt(parsedYaml, 'performance_review_prompt', {
              partition_header:
                total > 1
                  ? `[Partition ${i + 1} of ${total} — analyze ONLY the files or file-parts listed below for this request]`
                  : '',
              partition_scope_note:
                total > 1
                  ? `This request covers ${partition.scopePaths.length} of ${relativeFiles.length} JavaScript/TypeScript files in the current performance-review run. Entries labeled "(part X/Y)" are sequential chunks of oversized files that were split across multiple prompt logs to avoid truncated code excerpts.`
                  : `This request contains the full readable JavaScript/TypeScript scope for this run (${fileEntries.length} readable file(s)).`,
              project_name: options.projectName ?? path.basename(projectRoot),
              project_description: options.projectDescription ?? 'JavaScript/TypeScript project',
              primary_language: 'JavaScript/TypeScript',
              build_system: buildSystem,
              source_file_count:
                total > 1
                  ? `${relativeFiles.length} total (${partition.scopePaths.length} covered in this request)`
                  : String(relativeFiles.length),
              file_paths:
                filePathsContext ||
                '      - (no readable JavaScript/TypeScript files were available)',
              file_content_block:
                fileContentBlock ||
                '_No readable file excerpts were available in the current context window._',
            });
            const cacheContext = `step_23:performance_engineer:part:${i + 1}/${total}:signals:${scores.totalIssues}`;
            const cacheKey = generateCacheKey(prompt, cacheContext);

            let aiResult = await this.aiCache.withCache(prompt, cacheContext, () =>
              this.aiHelper.executeRequest(prompt, { persona: 'performance_engineer' })
            );
            let partitionContent = aiResult?.content ?? aiResult ?? '';
            let scopeValidation = validatePerformanceAiResponseScope(
              partitionContent,
              partition.scopePaths
            );

            if (!scopeValidation.adequate) {
              logger.warn(
                `[step_23] Partition ${i + 1}: invalid AI response scope (${scopeValidation.reason}). Re-running with a fresh AI session.`
              );
              if (typeof this.aiCache.delete === 'function') {
                await this.aiCache.delete(cacheKey);
              }
              if (typeof this.aiHelper.cleanup === 'function') {
                await this.aiHelper.cleanup();
              }

              const reinitialized = await this.aiHelper.initialize();
              if (reinitialized) {
                aiResult = await this.aiHelper.executeRequest(prompt, {
                  persona: 'performance_engineer',
                });
                partitionContent = aiResult?.content ?? '';
                scopeValidation = validatePerformanceAiResponseScope(
                  partitionContent,
                  partition.scopePaths
                );
              }
            }

            if (!scopeValidation.adequate) {
              logger.warn(
                `[step_23] Partition ${i + 1}: omitting off-scope AI response (${scopeValidation.reason})`
              );
              const validationNote =
                `> **Validation note:** Partition ${i + 1}/${total} AI response referenced files outside the visible scope ` +
                `(${scopeValidation.offScopeMentions.join(', ') || 'unknown off-scope file'}). ` +
                'That response was omitted from the final report.';
              aiSections.push(
                total > 1
                  ? `#### Partition ${i + 1} of ${total}\n\n${validationNote}`
                  : validationNote
              );
              continue;
            }

            if (partitionContent) {
              validPartitionAnalyses.push(
                total > 1
                  ? `#### Partition ${i + 1} of ${total}\n\n${partitionContent}`
                  : partitionContent
              );
              aiSections.push(
                total > 1
                  ? `#### Partition ${i + 1} of ${total}\n\n${partitionContent}`
                  : partitionContent
              );
            }
          }

          aiContent = aiSections.join('\n\n');

          if (validPartitionAnalyses.length > 0 && partitionsToAnalyze.length > 1) {
            const splitCoverage = buildSplitFileCoverage(
              partitionsToAnalyze.flatMap((partition) => partition.entries)
            );
            const completeSplitEntries = fileEntries.filter((entry) =>
              splitCoverage.completeSplitSourcePaths.includes(entry.relativePath)
            );

            try {
              const consolidationPrompt = buildPerformanceConsolidationPrompt({
                projectName: options.projectName ?? path.basename(projectRoot),
                projectDescription: options.projectDescription ?? 'JavaScript/TypeScript project',
                buildSystem,
                totalFileCount: relativeFiles.length,
                readableFileCount: fileEntries.length,
                completeSplitEntries,
                incompleteSplitSourcePaths: splitCoverage.incompleteSplitSourcePaths,
                partitionAnalyses: validPartitionAnalyses,
              });
              const consolidationCacheContext =
                `step_23:performance_engineer:consolidated:partitions:${partitionsToAnalyze.length}` +
                `:fullSplits:${splitCoverage.completeSplitSourcePaths.join(',') || 'none'}` +
                `:signals:${scores.totalIssues}`;
              const consolidatedResult = await this.aiCache.withCache(
                consolidationPrompt,
                consolidationCacheContext,
                () =>
                  this.aiHelper.executeRequest(consolidationPrompt, {
                    persona: 'performance_engineer',
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
                `[step_23] Performance review consolidation skipped — ${consolidationError.message}`
              );
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
