/**
 * Step 18: Debugging Analysis
 * @module steps/step_18_debugging
 * @version 2.0.0
 *
 * Uses AI-powered debugging personas to analyze code patterns and identify
 * issues related to observer patterns, async flow, and data structures.
 * Selects the most appropriate debugger persona based on the detected code patterns.
 *
 * Architecture: v2.0.0 Referential Transparency
 * - Pure functions for debug-type detection and report formatting
 * - Impure wrapper class for file I/O, AI calls, and logging
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
  AI_PROJECT_KINDS_PATH,
  buildYamlStepPrompt,
  buildProjectKindPrompt,
  formatProjectContextSection,
} from '../lib/ai_prompt_builder.js';
import {
  buildPartitionFilePathsContext,
  buildReviewFileContentsBlock,
  buildReviewPromptPartitions,
  runPartitionedAiResponses,
} from '../lib/review_step_helpers.js';
import { initializeStepAiContext } from './step_execution_helpers.js';
import yaml from 'js-yaml';

// ============================================================================
// PURE FUNCTIONS
// ============================================================================

/**
 * Detect which debugging persona is most relevant for the given source files.
 *
 * Heuristics:
 * - Files containing EventEmitter/addEventListener/subscribe/on( → observer_pattern
 * - Files containing async/await/Promise/callback → async_flow
 * - Files containing Map/Set/tree/linked/heap/graph → data_structure
 * - Default: async_flow (most common category)
 *
 * @param {string[]} fileContents - Array of source file content strings
 * @returns {'observer_pattern_debugger_prompt'|'async_flow_debugger_prompt'|'data_structure_debugger_prompt'}
 */
export function detectDebugPersona(fileContents) {
  const combined = (Array.isArray(fileContents) ? fileContents : []).join('\n').toLowerCase();

  const observerScore = (
    combined.match(/eventemitter|addeventlistener|\.subscribe\(|\.on\(/g) || []
  ).length;
  const asyncScore = (combined.match(/\basync\b|\bawait\b|new promise|\.then\(|callback/g) || [])
    .length;
  const dataStructScore = (
    combined.match(/\bnew map\b|\bnew set\b|linkedlist|binarytree|\bheap\b|\bgraph\b/g) || []
  ).length;

  if (observerScore >= asyncScore && observerScore >= dataStructScore) {
    return 'observer_pattern_debugger_prompt';
  }
  if (dataStructScore > asyncScore) {
    return 'data_structure_debugger_prompt';
  }
  return 'async_flow_debugger_prompt';
}

/**
 * Format the debugging analysis report in Markdown.
 *
 * @param {Object} params
 * @param {string} params.personaKey - Which debugger persona was used
 * @param {string[]} params.filesAnalyzed - Source files analyzed
 * @param {string} params.aiContent - AI analysis content
 * @returns {string} Formatted Markdown report
 */
export function formatDebuggingReport({ personaKey, filesAnalyzed, aiContent }) {
  const personaLabels = {
    observer_pattern_debugger_prompt: 'Observer Pattern Debugger',
    async_flow_debugger_prompt: 'Async Flow Debugger',
    data_structure_debugger_prompt: 'Data Structure Debugger',
  };
  const label = personaLabels[personaKey] || 'Debugging Analysis';
  const files = Array.isArray(filesAnalyzed) ? filesAnalyzed : [];
  const fileList = files.length > 0 ? files.map((f) => `- ${f}`).join('\n') : '- (none)';

  return `# Step 18: Debugging Analysis — ${label}

## Files Analyzed
${fileList}

## AI Analysis

${aiContent || '_No AI analysis available._'}
`;
}

/**
 * Read the `PROJECT_CONTEXT.md` file from the project root, if present.
 *
 * Returns the file content so it can be injected into AI prompts to constrain
 * analysis to the project's actual runtime (e.g. preventing CORS suggestions
 * for a Node.js-only library).
 *
 * @param {string} projectRoot - Absolute path to the target project root.
 * @param {Object} fileOps - FileOperations instance used for reading files.
 * @returns {Promise<string|null>} File content, or `null` when the file is absent.
 *
 * @since 1.6.3
 *
 * @example
 * const ctx = await readProjectContextFile('/path/to/project', fileOps);
 * if (ctx) parts.push(formatProjectContextSection(ctx));
 */
export async function readProjectContextFile(projectRoot, fileOps) {
  try {
    return await fileOps.readFile(path.join(projectRoot, 'PROJECT_CONTEXT.md'));
  } catch {
    return null;
  }
}

// ============================================================================
// STEP CONTRACT
// ============================================================================

export const STEP_DEFINITION = {
  id: 'step_18',
  name: 'Debugging Analysis',
  kind: STEP_KIND.ANALYSIS,
  description: 'AI-powered debugging analysis using observer, async, and data-structure personas',
  dependencies: [],
};

// ============================================================================
// IMPURE WRAPPER
// ============================================================================

/**
 * Step 18: Debugging Analysis
 *
 * Scans source files, selects the best debugging AI persona, and produces a
 * targeted debugging analysis report. All three debugger prompts from
 * ai_helpers.yaml are available:
 * - observer_pattern_debugger_prompt
 * - async_flow_debugger_prompt
 * - data_structure_debugger_prompt
 */
export class Step18Debugging {
  constructor(options = {}) {
    this.fileOps = options.fileOps || new FileOperations();
    this.backlog = options.backlog || new Backlog();
    this.aiHelper = options.aiHelper || new AiHelper({ promptsDir: options.promptsDir ?? null });
    this.aiCache = options.aiCache || new AiCache();
  }

  /**
   * Execute the debugging analysis step.
   *
   * @param {string} projectRoot - Project root directory
   * @param {Object} [options] - Execution options
   * @param {string[]} [options.sourceFiles] - Override source files to analyze
   * @param {string} [options.forcedPersona] - Force a specific debugger persona key
   * @returns {Promise<Object>} Step result
   */
  async execute(projectRoot, options = {}) {
    logger.step('Step 18: Debugging Analysis');

    try {
      // Discover source files
      const sourceFiles = options.sourceFiles ?? (await this._discoverSourceFiles(projectRoot));
      logger.info(`Analyzing ${sourceFiles.length} source file(s) for debugging patterns`);

      // Load PROJECT_CONTEXT.md from target project (if present) to constrain AI analysis
      const projectContextContent = await readProjectContextFile(projectRoot, this.fileOps);

      // Read file contents for persona detection (sample up to 20 files)
      const sampleFiles = sourceFiles.slice(0, 20);
      const sampleContents = await Promise.all(
        sampleFiles.map(async (f) => {
          try {
            return await this.fileOps.readFile(path.join(projectRoot, f));
          } catch {
            return '';
          }
        })
      );

      // Select debug persona
      const personaKey = options.forcedPersona ?? detectDebugPersona(sampleContents);
      logger.info(`Selected debugger persona: ${personaKey}`);

      let aiContent = '';
      const aiAvailable = await initializeStepAiContext({
        aiHelper: this.aiHelper,
        aiCache: this.aiCache,
      });

      if (aiAvailable) {
        try {
          const parsedYaml = await loadResolvedAiHelpers(this.fileOps);
          // Apply project-kind debugging_specialist overlay if available
          let roleOverride = '';
          try {
            const pkYaml = await this.fileOps.readFile(AI_PROJECT_KINDS_PATH);
            const parsedPk = yaml.load(pkYaml);
            const pk = buildProjectKindPrompt(
              parsedPk,
              options?.projectKind ?? 'default',
              'debugging_specialist'
            );
            if (pk?.role) roleOverride = pk.role;
          } catch {
            /* optional */
          }

          // Debugger templates use role_prefix/specific_expertise/approach/output_format
          // rather than the role/task_template/approach structure expected by
          // buildYamlStepPrompt. Assemble all sections manually so the AI receives
          // the full role context, expertise spec, scoped file list, and output format.
          const cfg = parsedYaml[personaKey];
          const readableFileEntries = sampleFiles.flatMap((relativePath, index) => {
            const content = sampleContents[index] ?? '';
            return content ? [{ relativePath, content }] : [];
          });
          const promptPartitions =
            readableFileEntries.length > 0 ? buildReviewPromptPartitions(readableFileEntries) : [];
          const partitionsToAnalyze =
            promptPartitions.length > 0 ? promptPartitions : [{ entries: [], scopePaths: [] }];

          if (partitionsToAnalyze.length > 1) {
            logger.info(
              `[step_18] Running AI analysis in ${partitionsToAnalyze.length} partition(s) to avoid prompt truncation`
            );
          }

          const aiResult = await runPartitionedAiResponses({
            partitions: partitionsToAnalyze,
            buildPrompt: (partition, { index, total, isMultiPartition }) => {
              const partitionDisplayPaths = partition.entries.map((entry) => entry.relativePath);
              const filePathsContext = buildPartitionFilePathsContext(partition.entries);
              const fileContentsSection = buildReviewFileContentsBlock(partition.entries);
              const partitionHeader = isMultiPartition
                ? `[Partition ${index + 1} of ${total} — analyze ONLY the files or file-parts listed below for this request]`
                : '';
              const partitionScopeNote = isMultiPartition
                ? `This request covers ${partition.scopePaths.length} of ${sampleFiles.length} sampled source file(s) in the current debugging run. Entries labeled "(part X/Y)" are sequential chunks of oversized files that were split across multiple prompt logs to avoid truncated code excerpts.`
                : `This request contains the full readable debugging scope for this run (${readableFileEntries.length} readable sampled file(s)).`;

              if (cfg && typeof cfg === 'object') {
                const parts = [];
                const role = (cfg.role_prefix || cfg.role || '').trim();
                if (roleOverride) parts.push(`[Project-Kind Role: ${roleOverride}]`);
                if (role) parts.push(`**Role**: ${role}`);
                const ctxSection = formatProjectContextSection(projectContextContent);
                if (ctxSection) parts.push(ctxSection);
                if (cfg.specific_expertise) parts.push(cfg.specific_expertise.trim());
                if (partitionHeader) parts.push(partitionHeader);
                parts.push(partitionScopeNote);
                parts.push(
                  `**Source Files to Analyze** (${sampleFiles.length} total, ${partition.scopePaths.length} covered in this request): ${partitionDisplayPaths.join(', ')}`
                );
                parts.push(
                  `**Files in This Request**:\n${
                    filePathsContext || '      - (no readable source files were available)'
                  }`
                );
                parts.push(
                  fileContentsSection
                    ? `**File Contents**:\n\n${fileContentsSection}`
                    : '_No readable file excerpts were available in the current context window._'
                );
                if (cfg.approach) parts.push(cfg.approach.trim());
                if (cfg.output_format)
                  parts.push(`**Output Format**:\n${cfg.output_format.trim()}`);
                return parts.join('\n\n');
              }

              // Fallback to generic builder for templates that use the standard structure
              const builtPrompt = buildYamlStepPrompt(parsedYaml, personaKey, {
                project_name: projectRoot,
                source_files: partitionDisplayPaths.join(', '),
                file_count: `${sampleFiles.length} total, ${partition.scopePaths.length} covered in this request`,
              });
              if (!builtPrompt) return '';

              const ctxSection = formatProjectContextSection(projectContextContent);
              const base = roleOverride
                ? `[Project-Kind Role: ${roleOverride}]\n\n${builtPrompt}`
                : builtPrompt;
              const sections = [base];
              if (ctxSection) sections.push(ctxSection);
              if (partitionHeader) sections.push(partitionHeader);
              sections.push(partitionScopeNote);
              sections.push(
                `**Files in This Request**:\n${
                  filePathsContext || '      - (no readable source files were available)'
                }`
              );
              sections.push(
                fileContentsSection
                  ? `**File Contents**:\n\n${fileContentsSection}`
                  : '_No readable file excerpts were available in the current context window._'
              );
              return sections.join('\n\n');
            },
            executePartition: async (_partition, { index, total }, prompt) => {
              const cacheKey = `step_18:${personaKey}:part:${index + 1}/${total}:files:${sampleFiles.length}`;
              return this.aiCache.withCache(prompt, cacheKey, () =>
                this.aiHelper.executeRequest(prompt, {
                  persona: personaKey,
                  model: 'claude-haiku-4.5',
                })
              );
            },
            extractContent: (response) => response?.content ?? response?.text ?? response ?? '',
          });
          aiContent = aiResult.content;
        } catch (err) {
          logger.warn(`Debugging AI analysis skipped: ${err.message}`);
        }
      } else {
        logger.warn('AI helper not available - skipping debugging analysis');
      }

      const report = formatDebuggingReport({
        personaKey,
        filesAnalyzed: sampleFiles,
        aiContent,
      });

      await this.backlog.saveStepSummary(18, 'Debugging_Analysis', report);

      if (aiContent) {
        logger.success('Step 18 completed - debugging analysis report generated');
      } else {
        logger.info('Step 18 completed - no AI content (AI unavailable or prompt missing)');
      }

      return {
        success: true,
        personaKey,
        filesAnalyzed: sampleFiles,
        totalSourceFiles: sourceFiles.length,
        aiContent,
        report,
      };
    } catch (error) {
      logger.error(`Step 18 failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Discover source files in the project root.
   * @param {string} projectRoot
   * @returns {Promise<string[]>} Relative paths to source files
   */
  async _discoverSourceFiles(projectRoot) {
    const patterns = ['**/*.js', '**/*.ts', '**/*.py', '**/*.java', '**/*.go'];
    const exclude = [
      'node_modules',
      '.git',
      'dist',
      'build',
      'coverage',
      'test',
      '__tests__',
      'docs',
    ];
    const found = [];
    for (const pattern of patterns) {
      try {
        const files = await this.fileOps.glob(pattern, {
          cwd: projectRoot,
          ignore: exclude.map((d) => `**/${d}/**`),
        });
        found.push(...files);
      } catch {
        // Pattern not supported — skip
      }
    }
    return [...new Set(found)].slice(0, 100);
  }
}
