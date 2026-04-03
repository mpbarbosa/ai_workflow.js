/**
 * Step 19: TypeScript Review
 * @module steps/step_19_typescript_review
 * @version 2.0.0
 *
 * Uses the "Strider" TypeScript Developer AI persona to review TypeScript source
 * files for type safety, strict mode compliance, idiomatic patterns, and common
 * anti-patterns (e.g. `any`, missing return types, `@ts-ignore`).
 *
 * Skips gracefully when no TypeScript files are found in the project.
 *
 * Architecture: v2.0.0 Referential Transparency
 * - Pure functions for TS-file detection, issue scoring, and report formatting
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
  formatProjectContextSection,
  MAX_CHARS_PER_FILE,
  MAX_CHARS_TOTAL_CONTENTS,
} from '../lib/ai_prompt_builder.js';

// ============================================================================
// PURE FUNCTIONS
// ============================================================================

/**
 * Determine whether a list of file paths represents a TypeScript project.
 *
 * Returns true if at least one `.ts` or `.tsx` file is present.
 *
 * @param {string[]} files - Relative or absolute file paths
 * @returns {boolean}
 */
export function isTypeScriptProject(files) {
  return files.some((f) => /\.[cm]?tsx?$/i.test(f));
}

/**
 * Score the density of common TypeScript anti-patterns across an array of
 * source file contents.
 *
 * Scoring heuristics (per-file occurrences, case-insensitive):
 * - `: any`           → unsafe explicit any annotation
 * - `as any`          → unsafe type assertion
 * - `@ts-ignore`      → suppressed type error
 * - `@ts-nocheck`     → whole-file type suppression
 * - Missing return types on functions (export/async function without `): `)
 *
 * @param {string[]} fileContents - Array of source file content strings
 * @returns {{ anyCount: number, tsIgnoreCount: number, missingReturnTypeCount: number, totalIssues: number }}
 */
export function scoreTypeScriptIssues(fileContents) {
  const combined = fileContents.join('\n');

  const anyCount = (combined.match(/:\s*any\b|as\s+any\b/g) || []).length;
  const tsIgnoreCount = (combined.match(/@ts-ignore|@ts-nocheck/g) || []).length;
  // Heuristic: exported or async functions that appear to lack an explicit return type
  const missingReturnTypeCount = (
    combined.match(/(?:export\s+(?:async\s+)?function|async\s+function)\s+\w+\s*\([^)]*\)\s*\{/g) ||
    []
  ).length;

  return {
    anyCount,
    tsIgnoreCount,
    missingReturnTypeCount,
    totalIssues: anyCount + tsIgnoreCount + missingReturnTypeCount,
  };
}

/**
 * Format the TypeScript review report in Markdown.
 *
 * @param {Object} params
 * @param {string[]} params.filesAnalyzed - TypeScript source files analyzed
 * @param {string}   params.aiContent     - AI review content
 * @param {boolean}  [params.skipped]     - True when step was skipped (no TS files)
 * @param {{ anyCount: number, tsIgnoreCount: number, missingReturnTypeCount: number, totalIssues: number }} [params.issueScore]
 * @returns {string} Formatted Markdown report
 */
export function formatTypeScriptReport({
  filesAnalyzed = [],
  aiContent = '',
  skipped = false,
  issueScore = null,
}) {
  if (skipped) {
    return `# Step 19: TypeScript Review

_No TypeScript files (.ts / .tsx) detected — step skipped._
`;
  }

  const fileList =
    filesAnalyzed.length > 0 ? filesAnalyzed.map((f) => `- ${f}`).join('\n') : '- (none)';

  const scoreSection = issueScore
    ? `## Issue Score (Heuristic)

| Metric | Count |
|--------|-------|
| Explicit \`any\` / \`as any\` | ${issueScore.anyCount} |
| \`@ts-ignore\` / \`@ts-nocheck\` | ${issueScore.tsIgnoreCount} |
| Functions missing return type | ${issueScore.missingReturnTypeCount} |
| **Total** | **${issueScore.totalIssues}** |

`
    : '';

  return `# Step 19: TypeScript Review — Strider

## Files Analyzed
${fileList}

${scoreSection}## AI Analysis

${aiContent || '_No AI analysis available._'}
`;
}

// ============================================================================
// STEP CONTRACT
// ============================================================================

export const STEP_DEFINITION = {
  id: 'step_19',
  name: 'TypeScript Review',
  kind: STEP_KIND.ANALYSIS,
  description: 'AI-powered TypeScript review using the "Strider" TypeScript Developer persona',
  dependencies: ['step_18'],
};

// ============================================================================
// IMPURE WRAPPER
// ============================================================================

/**
 * Step 19: TypeScript Review
 *
 * Discovers TypeScript source files, builds a structured prompt using the
 * `typescript_developer_prompt` ("Strider") persona from ai_helpers.yaml, and
 * generates a detailed type-safety review report.
 *
 * Skips gracefully when the project contains no TypeScript files.
 */
export class Step19TypescriptReview {
  constructor(options = {}) {
    this.fileOps = options.fileOps || new FileOperations();
    this.backlog = options.backlog || new Backlog();
    this.aiHelper = options.aiHelper || new AiHelper({ promptsDir: options.promptsDir ?? null });
    this.aiCache = options.aiCache || new AiCache();
  }

  /**
   * Execute the TypeScript review step.
   *
   * @param {string} projectRoot - Project root directory
   * @param {Object} [options]
   * @param {string[]} [options.sourceFiles] - Override TypeScript files to analyze
   * @param {string}   [options.projectName] - Project name for prompt context
   * @param {string}   [options.projectKind] - Project kind for prompt context
   * @returns {Promise<Object>} Step result
   */
  async execute(projectRoot, options = {}) {
    logger.step('Step 19: TypeScript Review');

    try {
      // Discover TypeScript files
      const tsFiles = options.sourceFiles ?? (await this._discoverTypeScriptFiles(projectRoot));

      if (!isTypeScriptProject(tsFiles)) {
        logger.info('No TypeScript files found — skipping TypeScript review');
        const report = formatTypeScriptReport({ skipped: true });
        await this.backlog.saveStepSummary(19, 'TypeScript_Review', report);
        return {
          success: true,
          skipped: true,
          filesAnalyzed: [],
          totalTsFiles: 0,
          aiContent: '',
          report,
        };
      }

      logger.info(`Reviewing ${tsFiles.length} TypeScript file(s) with Strider persona`);

      // Sample up to 20 files for AI analysis
      const sampleFiles = tsFiles.slice(0, 20);
      const sampleContents = await Promise.all(
        sampleFiles.map(async (f) => {
          try {
            return await this.fileOps.readFile(path.join(projectRoot, f));
          } catch {
            return '';
          }
        })
      );

      const issueScore = scoreTypeScriptIssues(sampleContents);
      logger.info(
        `Issue score: ${issueScore.totalIssues} (any=${issueScore.anyCount}, ts-ignore=${issueScore.tsIgnoreCount}, missing-return-type=${issueScore.missingReturnTypeCount})`
      );

      let aiContent = '';
      const aiAvailable = await this.aiHelper.initialize();

      if (aiAvailable) {
        await this.aiCache.init();
        try {
          const parsedYaml = await loadResolvedAiHelpers(this.fileOps);
          const tsconfigs = await this._discoverTsConfigFiles(projectRoot);
          const contextProfile = await this._loadContextProfile(projectRoot);
          const projectContextContent = await this._readProjectContextFile(projectRoot);

          const cfg = parsedYaml['typescript_developer_prompt'];
          let tsPrompt = null;

          // Build file-contents section: tsconfig files first, then source files
          const fileContentBlocks = [];
          let totalChars = 0;

          // Prepend tsconfig files so the AI can verify strict-mode settings
          for (const { filename, content } of tsconfigs) {
            const contribution = Math.min(content.length, MAX_CHARS_PER_FILE);
            if (totalChars + contribution <= MAX_CHARS_TOTAL_CONTENTS) {
              fileContentBlocks.push(buildFileContentBlock(filename, content));
              totalChars += contribution;
            }
          }

          for (let i = 0; i < sampleFiles.length; i++) {
            const content = sampleContents[i] ?? '';
            if (!content) continue;
            const contribution = Math.min(content.length, MAX_CHARS_PER_FILE);
            if (totalChars + contribution > MAX_CHARS_TOTAL_CONTENTS) break;
            fileContentBlocks.push(buildFileContentBlock(sampleFiles[i], content));
            totalChars += contribution;
          }
          const fileContentsSection =
            fileContentBlocks.length > 0
              ? `**File Contents**:\n\n${fileContentBlocks.join('\n\n')}`
              : '';

          if (cfg && typeof cfg === 'object') {
            const parts = [];
            const role = (cfg.role_prefix || cfg.role || '').trim();
            if (role) parts.push(`**Role**: ${role}`);
            const projectCtxSection = formatProjectContextSection(projectContextContent);
            if (projectCtxSection) parts.push(projectCtxSection);
            if (cfg.behavioral_guidelines) parts.push(String(cfg.behavioral_guidelines).trim());
            if (contextProfile) {
              parts.push(
                `**Codebase Profile — Verified Ground Truth**:\n\nThe following facts about this codebase have been verified against the live code. Treat them as authoritative. Do NOT flag items documented here as issues.\n\n${contextProfile}`
              );
            }
            // Interpolate task_template placeholders
            if (cfg.task_template) {
              const task = cfg.task_template
                .replace('{project_name}', options.projectName ?? path.basename(projectRoot))
                .replace('{project_description}', 'TypeScript project')
                .replace('{project_kind}', options.projectKind ?? 'nodejs_api')
                .replace('{primary_language}', 'TypeScript')
                .replace('{build_system}', 'tsc / Vite / Webpack')
                .replace('{test_framework}', 'Jest / ts-jest / Vitest')
                .replace('{test_command}', 'npm test')
                .replace('{lint_command}', 'npm run lint')
                .replace('{modified_count}', String(tsFiles.length));
              parts.push(task.trim());
            }
            if (tsconfigs.length > 0) {
              parts.push(
                `**Configuration Files included**: ${tsconfigs.map((t) => t.filename).join(', ')}`
              );
            }
            parts.push(
              `**TypeScript Files to Review** (${tsFiles.length} total, sampling ${sampleFiles.length}): ${sampleFiles.join(', ')}`
            );
            if (fileContentsSection) parts.push(fileContentsSection);
            if (cfg.approach) parts.push(cfg.approach.trim());
            tsPrompt = parts.join('\n\n');
          } else {
            // Fallback to generic builder
            const builtPrompt = buildYamlStepPrompt(parsedYaml, 'typescript_developer_prompt', {
              project_name: options.projectName ?? path.basename(projectRoot),
              source_files: sampleFiles.join(', '),
              file_count: `${tsFiles.length} total, sampling ${sampleFiles.length}`,
            });
            if (builtPrompt) {
              let combined = fileContentsSection
                ? `${builtPrompt}\n\n${fileContentsSection}`
                : builtPrompt;
              if (contextProfile) {
                combined += `\n\n**Codebase Profile — Verified Ground Truth**:\n\nThe following facts about this codebase have been verified against the live code. Treat them as authoritative. Do NOT flag items documented here as issues.\n\n${contextProfile}`;
              }
              const projectCtxSectionFallback = formatProjectContextSection(projectContextContent);
              if (projectCtxSectionFallback) {
                combined = `${builtPrompt}\n\n${projectCtxSectionFallback}${combined.slice(builtPrompt.length)}`;
              }
              tsPrompt = combined;
            }
          }

          if (tsPrompt) {
            const fileHashEntries = sampleFiles.map((f, i) => `${f}:${sampleContents[i] ?? ''}`);
            const aiResult = await this.aiCache.withFileChangeGuard(
              'step_19',
              fileHashEntries,
              () =>
                this.aiHelper.executeRequest(tsPrompt, {
                  persona: 'typescript_reviewer',
                  model: 'claude-haiku-4.5',
                })
            );
            aiContent = aiResult?.content ?? '';
          }
        } catch (err) {
          logger.warn(`TypeScript AI review skipped: ${err.message}`);
        }
      } else {
        logger.warn('AI helper not available - skipping TypeScript AI review');
      }

      const report = formatTypeScriptReport({
        filesAnalyzed: sampleFiles,
        aiContent,
        issueScore,
      });

      await this.backlog.saveStepSummary(19, 'TypeScript_Review', report);

      if (aiContent) {
        logger.success('Step 19 completed - TypeScript review report generated');
      } else {
        logger.info('Step 19 completed - no AI content (AI unavailable or prompt missing)');
      }

      return {
        success: true,
        filesAnalyzed: sampleFiles,
        totalTsFiles: tsFiles.length,
        issueScore,
        aiContent,
        report,
      };
    } catch (error) {
      logger.error(`Step 19 failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Discover tsconfig*.json files at the project root and read their contents.
   *
   * Checks a fixed set of well-known tsconfig filenames. Files that are absent or
   * unreadable are silently skipped. The returned entries are prepended to the AI
   * prompt so the reviewer can verify strict-mode and compiler settings directly,
   * rather than falling back to a generic "cannot verify" recommendation.
   *
   * @param {string} projectRoot
   * @returns {Promise<Array<{filename: string, content: string}>>}
   */
  async _discoverTsConfigFiles(projectRoot) {
    const candidates = ['tsconfig.json', 'tsconfig.esm.json', 'tsconfig.base.json'];
    const results = [];
    for (const candidate of candidates) {
      try {
        const content = await this.fileOps.readFile(path.join(projectRoot, candidate));
        if (content) results.push({ filename: candidate, content });
      } catch {
        // Not present — skip
      }
    }
    return results;
  }

  /**
   * Read PROJECT_CONTEXT.md from the project root.
   *
   * Returns the file content if present, or null if absent or unreadable.
   * Used to inject runtime constraints (e.g. Node.js-only, no browser APIs) into
   * the AI prompt so the reviewer's scope matches the actual deployment target.
   *
   * @param {string} projectRoot
   * @returns {Promise<string|null>}
   */
  async _readProjectContextFile(projectRoot) {
    try {
      const content = await this.fileOps.readFile(path.join(projectRoot, 'PROJECT_CONTEXT.md'));
      return content || null;
    } catch {
      return null;
    }
  }

  /**
   * Load the project-specific codebase profile from `.ai_workflow/context/typescript_profile.md`.
   *
   * Returns the profile content if found, or null if the file does not exist.
   * The profile is injected into the AI prompt as verified ground truth to prevent
   * the reviewer from flagging known intentional patterns as false-positive issues.
   *
   * @param {string} projectRoot
   * @returns {Promise<string|null>}
   */
  async _loadContextProfile(projectRoot) {
    const profilePath = path.join(projectRoot, '.ai_workflow', 'context', 'typescript_profile.md');
    try {
      const content = await this.fileOps.readFile(profilePath);
      if (content) {
        logger.info('Loaded codebase profile from .ai_workflow/context/typescript_profile.md');
        return content;
      }
    } catch {
      // Profile not present — proceed without it
    }
    return null;
  }

  /**
   * Discover TypeScript source files in the project root.
   * @param {string} projectRoot
   * @returns {Promise<string[]>} Relative paths to .ts/.tsx files
   */
  async _discoverTypeScriptFiles(projectRoot) {
    const patterns = ['**/*.ts', '**/*.tsx'];
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
