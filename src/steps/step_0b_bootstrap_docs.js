/**
 * Step 0b: Documentation Gap Analysis & Generation
 * Identifies missing documentation and generates it using AI.
 * Runs early in workflow to bootstrap documentation for new projects.
 * @module steps/step_0b_bootstrap_docs
 * @version 2.0.0
 */

import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __packageStepsDir = path.dirname(__filename);
// Resolves to: ai_workflow.js/.workflow_core/config/ai_helpers.yaml
export const AI_HELPERS_PATH = path.resolve(
  __packageStepsDir,
  '../../.workflow_core/config/ai_helpers.yaml'
);
import { FileOperations } from '../lib/file_operations.js';
import { deriveProjectSummary, loadResolvedAiHelpers } from '../lib/ai_prompt_builder.js';
import { AiHelper } from '../lib/ai_helpers.js';
import { Backlog } from '../lib/backlog.js';
import { STEP_KIND } from './step_contract.js';
import { Logger } from '../core/logger.js';
import { colors } from '../core/colors.js';
import { Step0bStateCache } from '../lib/step0b_state_cache.js';

// Constants
export const DOC_TYPES = Object.freeze({
  readme: 'README.md',
  changelog: 'CHANGELOG.md',
  contributing: 'docs/CONTRIBUTING.md',
  license: 'LICENSE',
  api: 'docs/API.md',
  architecture: 'docs/ARCHITECTURE.md',
  gettingStarted: 'docs/GETTING_STARTED.md',
});

export const DOC_THRESHOLDS = Object.freeze({
  minReadmeSize: 500, // bytes
  minDocsCount: 2, // minimum docs files
  sufficientDocsCount: 5, // project with this many docs is considered well-documented
});

export const SOURCE_EXTENSIONS = Object.freeze([
  '.js',
  '.ts',
  '.py',
  '.sh',
  '.go',
  '.java',
  '.rs',
  '.rb',
]);

// ============================================================================
// PURE FUNCTIONS - Documentation Gap Analysis
// ============================================================================

/**
 * Check if project needs documentation bootstrapping
 * @param {Object} stats - Project statistics
 * @param {number} stats.docCount - Number of documentation files
 * @param {number} stats.readmeSize - Size of README.md in bytes
 * @param {boolean} stats.hasChangelog - Whether CHANGELOG exists
 * @param {boolean} stats.hasDocsDir - Whether docs/ directory exists
 * @returns {boolean} - True if bootstrap needed
 */
export function shouldBootstrapDocs(stats) {
  const { docCount, readmeSize, hasChangelog, hasDocsDir } = stats;

  // Need bootstrap if README is missing or too small
  if (readmeSize < DOC_THRESHOLDS.minReadmeSize) {
    return true;
  }

  // Need bootstrap if docs/ directory missing or too few docs
  if (!hasDocsDir || docCount < DOC_THRESHOLDS.minDocsCount) {
    return true;
  }

  // Need bootstrap if CHANGELOG is missing
  if (!hasChangelog) {
    return true;
  }

  return false;
}

/**
 * Identify missing documentation files
 * @param {Array<string>} existingFiles - List of existing file paths
 * @returns {Array<string>} - List of missing doc file paths
 */
export function identifyMissingDocs(existingFiles) {
  const existingSet = new Set(existingFiles.map((f) => f.toLowerCase()));
  const missing = [];

  for (const [, path] of Object.entries(DOC_TYPES)) {
    if (!existingSet.has(path.toLowerCase())) {
      missing.push(path);
    }
  }

  return missing;
}

export function determineBootstrapTargets(existingFiles, stats) {
  const missingDocs = identifyMissingDocs(existingFiles);
  const targets = [...missingDocs];

  if (stats?.readmeSize < DOC_THRESHOLDS.minReadmeSize && !targets.includes(DOC_TYPES.readme)) {
    targets.unshift(DOC_TYPES.readme);
  }

  return [...new Set(targets)];
}

/**
 * Categorize documentation gaps by priority
 * @param {Array<string>} missingDocs - List of missing doc paths
 * @returns {Object} - Categorized docs { critical: [], important: [], optional: [] }
 */
export function categorizeMissingDocs(missingDocs) {
  const critical = [];
  const important = [];
  const optional = [];

  for (const doc of missingDocs) {
    if (doc === DOC_TYPES.readme) {
      critical.push(doc);
    } else if (
      doc === DOC_TYPES.changelog ||
      doc === DOC_TYPES.contributing ||
      doc === DOC_TYPES.license
    ) {
      important.push(doc);
    } else {
      optional.push(doc);
    }
  }

  return { critical, important, optional };
}

/**
 * Filter files by source code extensions
 * @param {Array<string>} files - List of file paths
 * @returns {Array<string>} - Filtered source files
 */
export function filterSourceFiles(files) {
  return files.filter((file) => SOURCE_EXTENSIONS.some((ext) => file.endsWith(ext)));
}

/**
 * Count files by extension
 * @param {Array<string>} files - List of file paths
 * @returns {Object} - Count by extension { '.js': 10, '.py': 5, ... }
 */
export function countFilesByExtension(files) {
  return files.reduce((acc, file) => {
    const ext = file.substring(file.lastIndexOf('.'));
    acc[ext] = (acc[ext] || 0) + 1;
    return acc;
  }, {});
}

/**
 * Determine primary programming language
 * @param {Object} extensionCounts - File counts by extension
 * @returns {string} - Primary language (e.g., 'JavaScript', 'Python')
 */
export function determinePrimaryLanguage(extensionCounts) {
  const languageMap = {
    '.js': 'JavaScript',
    '.ts': 'TypeScript',
    '.py': 'Python',
    '.sh': 'Shell',
    '.go': 'Go',
    '.java': 'Java',
    '.rs': 'Rust',
    '.rb': 'Ruby',
  };

  let maxCount = 0;
  let primaryExt = '.js';

  for (const [ext, count] of Object.entries(extensionCounts)) {
    if (count > maxCount) {
      maxCount = count;
      primaryExt = ext;
    }
  }

  return languageMap[primaryExt] || 'Unknown';
}

/**
 * Parse AI response into filename→content pairs
 * @param {string} responseText - Raw AI response text
 * @returns {Array<{filename: string, content: string}>} - Parsed documents
 */
export function parseAiDocResponse(responseText) {
  const results = [];

  // Build section positions while ignoring ## headers inside fenced code blocks.
  // The naive global regex matched ## section headers *inside* generated content
  // (e.g. "## Features" inside a README block), which truncated section boundaries
  // mid-content and left the closing fence outside the section text, causing every
  // contentBlockRegex match to fail.
  const sections = [];
  let inFence = false;
  let pos = 0;
  for (const line of responseText.split('\n')) {
    if (/^```/.test(line)) inFence = !inFence;
    if (!inFence) {
      const m = /^## (.+?)\s*$/.exec(line);
      if (m) sections.push({ filename: m[1].trim().replace(/[`*]/g, ''), index: pos });
    }
    pos += line.length + 1; // +1 for the \n stripped by split
  }

  const contentBlockRegex = /### Content:[^\n]*\n```(?:\w+)?\n([\s\S]*?)\n```/;
  for (let i = 0; i < sections.length; i++) {
    const start = sections[i].index;
    const end = sections[i + 1]?.index ?? responseText.length;
    const sectionText = responseText.substring(start, end);
    const contentMatch = contentBlockRegex.exec(sectionText);
    if (contentMatch) {
      results.push({ filename: sections[i].filename, content: contentMatch[1] });
    }
  }

  return results;
}

// ============================================================================
// PURE FUNCTIONS - Prompt Building
// ============================================================================

/**
 * Build technical writer prompt from ai_helpers.yaml config.
 * Falls back to a minimal inline template if the yaml cannot be loaded.
 * @param {Object} context - Project context
 * @param {string} context.projectName - Project name
 * @param {string} context.projectDescription - Brief description
 * @param {string} context.primaryLanguage - Primary programming language
 * @param {number} context.docCount - Current documentation count
 * @param {number} context.sourceCount - Source file count
 * @param {Array<string>} context.missingDocs - List of missing docs
 * @param {Object|null} context.resolvedAiHelpers - Fully resolved ai_helpers YAML object (optional)
 * @returns {string} - Formatted AI prompt
 */
export function buildTechnicalWriterPrompt(context) {
  const {
    projectName,
    projectDescription,
    primaryLanguage,
    docCount,
    sourceCount,
    missingDocs,
    resolvedAiHelpers,
  } = context;

  const missingList = missingDocs.map((d) => `  - ${d}`).join('\n');

  // Try to build prompt from resolved yaml config
  if (resolvedAiHelpers) {
    try {
      const twPrompt = resolvedAiHelpers?.technical_writer_prompt;
      if (twPrompt?.role_prefix && twPrompt?.task_template) {
        const variables = {
          project_name: projectName,
          project_description: projectDescription || '',
          project_summary: deriveProjectSummary({
            project_name: projectName,
            project_description: projectDescription || '',
            primary_language: primaryLanguage,
          }),
          primary_language: primaryLanguage,
          doc_count: String(docCount),
          source_files: String(sourceCount),
        };

        let taskText = twPrompt.task_template;
        for (const [key, value] of Object.entries(variables)) {
          taskText = taskText.replaceAll(`{${key}}`, value);
        }

        const behavioralGuidelines = twPrompt.behavioral_guidelines
          ? `\n${twPrompt.behavioral_guidelines}\n`
          : '';

        const outputFormat = `\n\n**OUTPUT FORMAT — REQUIRED** (responses not matching this schema are discarded):\nFor each file to generate:\n\n## <relative/path/to/file.md>\n### Content:\n\`\`\`markdown\n(full file content — no truncation)\n\`\`\`\n\nIf no documentation is needed respond with exactly:\nNO ACTION NEEDED — <one-sentence reason>`;
        return `${twPrompt.role_prefix.trimEnd()}${behavioralGuidelines}\n${taskText.trimEnd()}\n\n**Documentation Gaps Identified** (confirmed by automated analysis — necessity evaluation already complete):\n${missingList}\n\nGenerate the files listed above. Begin the response with the first \`## filename\` block — do not write any evaluation narrative, preamble, or section headers before it.${outputFormat}`;
      }
    } catch {
      // fall through to inline template
    }
  }

  // Inline fallback template
  return `You are a Senior Technical Writer with expertise in software documentation, API documentation, and developer experience.

**Project Context**:
- **Project Name**: ${projectName}
- **Description**: ${projectDescription}
- **Primary Language**: ${primaryLanguage}
- **Source Files**: ${sourceCount}
- **Existing Documentation**: ${docCount} files

**Documentation Gaps Identified**:
${missingList}

**Root-Level Placement Rule**:
- Keep only \`README.md\` and \`CHANGELOG.md\` at the repository root.
- Place every other markdown documentation file under \`docs/\` or the matching
  \`docs/\` subdirectory.

**Minimum Documentation Framework** — apply this three-tier priority order:

**Must-have** (project is unusable without these):
- README.md with install + basic usage
- Inline JSDoc/type annotations on every public API (functions, classes, interfaces) — this is the primary signal consumed by IDEs and AI coding assistants at call sites
- machine-readable package metadata (package.json: exports, types, main, engines) for published packages

**Should-have** (contributors cannot work safely without these):
- CHANGELOG.md — consumers need to know what changed between versions
- docs/CONTRIBUTING.md — coding conventions, test commands, PR process
- LICENSE — legal requirement for open source

**Nice-to-have** (appropriate for published packages with external contributors):
- ROADMAP.md, docs/INDEX.md, docs/ARCHITECTURE.md, docs/GETTING_STARTED.md, docs/API.md

**Your Task**:
Generate documentation for the missing files listed above, applying the three-tier priority order above. For each file provide:

## [Filename]
### Tier: [Must-have / Should-have / Nice-to-have]
### Content:
\`\`\`markdown
[Complete markdown content ready to save]
\`\`\`
### Reasoning:
[Brief explanation of the impact this file has on usability, contributor experience, or AI tooling]

---

Generate must-have files first, then should-have, then nice-to-have. Do not generate "just in case" documentation — only produce files that are genuinely missing.`;
}

/**
 * Format gap analysis report
 * @param {Object} data - Analysis data
 * @param {Object} data.stats - Project statistics
 * @param {Object} data.categorized - Categorized missing docs
 * @param {Array<string>} data.missingDocs - All missing docs
 * @param {string} data.timestamp - ISO timestamp
 * @returns {string} - Formatted markdown report
 */
export function formatGapAnalysisReport(data) {
  const { stats, categorized, missingDocs, timestamp } = data;

  const criticalList = categorized.critical.map((d) => `- ${d}`).join('\n') || '- None';
  const importantList = categorized.important.map((d) => `- ${d}`).join('\n') || '- None';
  const optionalList = categorized.optional.map((d) => `- ${d}`).join('\n') || '- None';

  return `# Step 0b: Documentation Gap Analysis Report

**Status**: ✅ Completed
**Date**: ${timestamp}

## Project Statistics

- **Documentation Files**: ${stats.docCount}
- **Source Files**: ${stats.sourceCount}
- **README Size**: ${stats.readmeSize} bytes
- **Has CHANGELOG**: ${stats.hasChangelog ? 'Yes' : 'No'}
- **Has docs/ Directory**: ${stats.hasDocsDir ? 'Yes' : 'No'}

## Gap Analysis Results

**Total Missing Documentation**: ${missingDocs.length} files

### Critical (Must Have)
${criticalList}

### Important (Should Have)
${importantList}

### Optional (Nice to Have)
${optionalList}

## Recommendations

${missingDocs.length > 0 ? '1. Generate missing documentation using AI assistance\n2. Review and customize generated content\n3. Establish documentation update process\n4. Add documentation guidelines to CONTRIBUTING.md' : '✅ Project has sufficient documentation coverage'}

---

## Analysis Metadata

- **Step Version**: 2.0.0
- **Analysis Method**: File-based gap detection
- **Bootstrap Recommended**: ${missingDocs.length > 0 ? 'Yes' : 'No'}

## Next Steps

${missingDocs.length > 0 ? '1. Run Step 0b with AI to generate missing documentation\n2. Review and edit generated content\n3. Commit new documentation files\n4. Re-run workflow to validate completeness' : '1. Continue with Step 1 (documentation validation)\n2. Maintain documentation as project evolves\n3. Update CHANGELOG.md with releases'}
`;
}

/**
 * Extract simple directory names from .gitignore content for use as exclusions.
 * Only lines that are bare names or name-with-trailing-slash are extracted;
 * wildcards, negations, and path patterns are skipped.
 * @param {string} gitignoreContent - Raw .gitignore file content
 * @returns {string[]} Array of directory/file names to exclude
 * @pure
 */
export function extractGitignoreDirNames(gitignoreContent) {
  if (!gitignoreContent || typeof gitignoreContent !== 'string') {
    return [];
  }
  const nameSet = new Set();
  for (const line of gitignoreContent.split('\n')) {
    const trimmed = line.trim();
    // Skip empty lines, comments, and negations
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('!')) continue;
    // Skip patterns with wildcards or glob chars
    if (trimmed.includes('*') || trimmed.includes('?') || trimmed.includes('[')) continue;
    // Strip trailing slash
    const name = trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
    // Skip nested path patterns (e.g. docs/api-generated/) — extracting only the
    // top-level segment would wrongly exclude the entire parent directory.
    if (name.includes('/')) continue;
    if (name) nameSet.add(name);
  }
  return [...nameSet];
}

/**
 * Extract submodule path names from a .gitmodules file.
 * Returns the bare directory name of each submodule (e.g. `.workflow_core`).
 * @param {string} gitmodulesContent - Raw .gitmodules file content
 * @returns {string[]} Array of submodule directory names to exclude
 * @pure
 */
export function extractGitmodulePaths(gitmodulesContent) {
  if (!gitmodulesContent || typeof gitmodulesContent !== 'string') {
    return [];
  }
  const paths = [];
  for (const line of gitmodulesContent.split('\n')) {
    const match = line.match(/^\s*path\s*=\s*(.+)$/);
    if (match) {
      const p = match[1].trim();
      // Only include bare names (top-level submodule dirs, no nested paths)
      if (p && !p.includes('/')) {
        paths.push(p);
      }
    }
  }
  return paths;
}

// ============================================================================
// STEP0BBOOTSTRAPDOCS - Impure Wrapper Class
// ============================================================================

/**
 * Step 0b: Documentation Gap Analysis & Generation
 * Identifies missing documentation and bootstraps new projects.
 */
export class Step0bBootstrapDocs {
  static stepKind = STEP_KIND.CONTEXT;

  /**
   * Create a new Step 0b analyzer
   * @param {Object} options - Configuration options
   * @param {Object} options.fileOps - File operations instance
   * @param {Object} options.backlog - Backlog instance
   * @param {Object} options.logger - Logger instance
   * @param {Object} options.aiHelper - AI helper instance (optional, skips generation if absent)
   * @param {boolean} options.dryRun - Whether to run in dry-run mode
   * @param {string} options.projectRoot - Project root directory
   */
  constructor(options = {}) {
    this.fileOps = options.fileOps || new FileOperations();
    this.backlog = options.backlog || new Backlog();
    this.logger = options.logger || new Logger();
    this.aiHelper = options.aiHelper || new AiHelper({ promptsDir: options.promptsDir });
    this.dryRun = options.dryRun || false;
    this.projectRoot = options.projectRoot || process.cwd();
    this.stateCache =
      options.stateCache ||
      new Step0bStateCache({
        cacheDir: options.cacheDir,
        ttlSeconds: options.cacheTtlSeconds,
      });
  }

  /**
   * Execute documentation gap analysis
   * @param {Object} context - Execution context
   * @param {string} context.projectName - Project name
   * @param {string} context.projectDescription - Project description
   * @returns {Promise<Object>} - Execution result { success, missingDocs, ... }
   */
  async execute(_context = {}) {
    this.logger.debug('Step0bBootstrapDocs.execute()');
    const startTime = Date.now();

    // Use projectRoot from context if provided (overrides constructor default)
    if (_context.projectRoot) {
      this.projectRoot = _context.projectRoot;
    }

    try {
      if (this.dryRun) {
        this.logger.info('[DRY RUN] Documentation gap analysis preview:');
        this.logger.info('- Would scan for existing documentation files');
        this.logger.info('- Would identify missing critical documentation');
        this.logger.info('- Would generate gap analysis report');
        return {
          success: true,
          dryRun: true,
          message: 'Documentation gap analysis dry run completed',
        };
      }

      this.logger.step('Step 0b: Documentation Gap Analysis and Generation');
      // Phase 1: Gather project statistics
      this.logger.info(`${colors.blue}Phase 1:${colors.reset} Gathering project statistics...`);
      const stats = await this.gatherProjectStats();

      this.logger.info(
        `Project has ${stats.docCount} documentation files and ${stats.sourceCount} source files`
      );
      this.logger.info(
        `README.md size: ${stats.readmeSize} bytes, Has CHANGELOG: ${stats.hasChangelog}, Has docs/ directory: ${stats.hasDocsDir}`
      );
      // Phase 2: Check if bootstrap needed
      this.logger.info(
        `${colors.blue}Phase 2:${colors.reset} Evaluating documentation coverage...`
      );
      const needsBootstrap = shouldBootstrapDocs(stats);

      if (!needsBootstrap) {
        this.logger.info('Step 0b: Documentation coverage adequate - checking for catalog gaps...');
      }

      this.logger.debug('Phase 3');
      // Phase 3: Identify missing documentation
      this.logger.info(
        `${colors.blue}Phase 3:${colors.reset} Identifying missing documentation...`
      );
      const existingFiles = await this.listExistingDocs();
      const missingDocs = determineBootstrapTargets(existingFiles, stats);
      const categorized = categorizeMissingDocs(missingDocs);

      if (missingDocs.length === 0 && !needsBootstrap) {
        this.logger.info('Step 0b: All catalog docs present — nothing to generate');

        await this.backlog.saveStepSummary(
          '0b',
          'Bootstrap_Docs',
          'Skipped: All catalog documentation files are present',
          '⏭️'
        );

        return {
          success: true,
          skipped: true,
          reason: 'all catalog documentation files present',
        };
      }

      if (!needsBootstrap && stats.docCount >= DOC_THRESHOLDS.sufficientDocsCount) {
        this.logger.info(
          `Step 0b: Project has ${stats.docCount} documentation files — sufficient coverage, skipping generation`
        );

        await this.backlog.saveStepSummary(
          '0b',
          'Bootstrap_Docs',
          `Skipped: Project has sufficient documentation coverage (${stats.docCount} files)`,
          '⏭️'
        );

        return {
          success: true,
          skipped: true,
          reason: 'sufficient_docs',
        };
      }

      this.logger.warn(
        `Found ${missingDocs.length} missing documentation files (${categorized.critical.length} critical)`
      );

      // Phase 4: Generate report
      this.logger.info(`${colors.blue}Phase 3:${colors.reset} Generating gap analysis report...`);
      const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

      const report = formatGapAnalysisReport({
        stats,
        categorized,
        missingDocs,
        timestamp,
      });

      await this.backlog.saveStepSummary('0b', 'Bootstrap_Docs', report, '✅');

      this.logger.success('Step 0b: Documentation gap analysis completed');
      this.logger.info(
        `Critical: ${categorized.critical.length}, Important: ${categorized.important.length}, Optional: ${categorized.optional.length}`
      );

      // Phase 4: Generate missing documentation with AI
      const generated = [];
      if (missingDocs.length > 0) {
        this.logger.info(
          `${colors.blue}Phase 4:${colors.reset} Generating documentation with AI...`
        );

        // Doc-state cache check — skip AI if nothing changed since last 0-file run
        const existingDocFiles = await this.listExistingDocs();
        const docEntries = await this._readDocEntries(existingDocFiles);
        const cacheResult = await this.stateCache.check(docEntries);
        if (cacheResult.skip) {
          this.logger.info('Step 0b: cached result valid — no files generated (token savings)');
          return {
            success: true,
            missingDocs,
            categorized,
            stats,
            generated: [],
            cachedSkip: true,
            duration: Date.now() - startTime,
          };
        }

        this.logger.debug('Initializing AI Helper...');
        const aiAvailable = await this.aiHelper.initialize();
        if (!aiAvailable) {
          this.logger.warn('Step 0b: AI unavailable — skipping document generation');
        } else {
          this.logger.debug('AI Helper is initialized.');

          // Load and resolve ai_helpers.yaml (resolves role_ref pointers added in v1.2.0)
          let resolvedAiHelpers = null;
          try {
            resolvedAiHelpers = await loadResolvedAiHelpers(this.fileOps);
          } catch {
            this.logger.debug('ai_helpers.yaml not found — using inline prompt template');
          }

          // Read project description and primary language from .workflow-config.yaml if not in context
          let projectDescription = _context.projectDescription || '';
          let primaryLanguage = stats.primaryLanguage || 'Unknown';
          try {
            const workflowConfigPath = path.join(this.projectRoot, '.workflow-config.yaml');
            const workflowConfigContent = await this.fileOps.readFile(workflowConfigPath);
            const workflowConfig = yaml.load(workflowConfigContent);
            if (!projectDescription && workflowConfig?.project?.description) {
              projectDescription = workflowConfig.project.description;
            }
            if (workflowConfig?.tech_stack?.primary_language) {
              primaryLanguage = workflowConfig.tech_stack.primary_language;
            }
          } catch {
            this.logger.debug('.workflow-config.yaml not found — using detected values');
          }

          const context = {
            projectName: _context.projectName || path.basename(this.projectRoot),
            projectDescription,
            primaryLanguage,
            docCount: stats.docCount,
            sourceCount: stats.sourceCount,
            missingDocs,
            resolvedAiHelpers,
          };
          const prompt = buildTechnicalWriterPrompt(context);
          this.logger.debug(prompt);
          const response = await this.aiHelper.executeRequest(prompt, {
            persona: 'technical_writer',
            model: 'claude-haiku-4.5',
          });
          if (response.success && response.content) {
            const parsedDocs = parseAiDocResponse(response.content);
            if (parsedDocs.length === 0) {
              this.logger.debug(
                `AI response not parsed (0 docs). Raw response:\n${response.content}`
              );
            }
            for (const { filename, content } of parsedDocs) {
              const filePath = path.join(this.projectRoot, filename);
              if (this.dryRun) {
                this.logger.info(`[DRY RUN] Would generate: ${filename}`);
              } else {
                await this.fileOps.writeFile(filePath, content + '\n');
                this.logger.success(`Generated: ${filename}`);
                generated.push(filename);
              }
            }
            this.logger.success(`Step 0b: Generated ${generated.length} documentation files`);
            if (generated.length === 0) {
              // Only cache the "nothing to do" state when the AI confirmed no action
              // was needed. If the response indicated ACTION NEEDED but produced no
              // parseable files (output format mismatch), skip caching so the next
              // run re-evaluates instead of silently skipping the identified gap.
              if (!response.content.includes('ACTION NEEDED')) {
                await this.stateCache.persist(docEntries, cacheResult.fingerprint);
              }
              // If critical files were identified as missing but none were written,
              // surface this as a failure rather than silently succeeding.
              if (categorized.critical.length > 0) {
                this.logger.warn(
                  `Step 0b: ${categorized.critical.length} critical gap(s) identified but 0 files written — response parser may have failed`
                );
                return {
                  success: false,
                  degraded: true,
                  reason: 'critical_gaps_unresolved',
                  missingDocs,
                  categorized,
                  stats,
                  generated,
                  duration: Date.now() - startTime,
                };
              }
            } else {
              // Files were generated — next run must re-evaluate
              await this.stateCache.invalidate();
            }
          }
        }
      }

      return {
        success: true,
        missingDocs,
        categorized,
        stats,
        generated,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      this.logger.error(`Step 0b failed: ${error.message}`);

      await this.backlog.saveStepIssues('0b', 'Bootstrap_Docs', [
        {
          type: 'error',
          message: error.message,
          location: 'step_0b_bootstrap_docs',
        },
      ]);

      return {
        success: false,
        error: error.message,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Load directory exclusions from .gitignore (I/O operation)
   * @returns {Promise<string[]>} Directory/file names to exclude
   */
  async loadGitignoreExclusions() {
    // Always exclude the workflow's own runtime directory regardless of .gitignore
    const hardcoded = ['.ai_workflow'];
    try {
      const gitignorePath = path.join(this.projectRoot, '.gitignore');
      const content = await this.fileOps.readFile(gitignorePath);
      const fromGitignore = extractGitignoreDirNames(content);

      let fromSubmodules = [];
      try {
        const gitmodulesPath = path.join(this.projectRoot, '.gitmodules');
        const gmContent = await this.fileOps.readFile(gitmodulesPath);
        fromSubmodules = extractGitmodulePaths(gmContent);
      } catch {
        // No .gitmodules or unreadable — proceed without submodule exclusions
      }

      return [...new Set([...hardcoded, ...fromGitignore, ...fromSubmodules])];
    } catch {
      return hardcoded;
    }
  }

  /**
   * Gather project statistics (I/O operation)
   * @returns {Promise<Object>} - Project stats
   */
  async gatherProjectStats() {
    this.logger.debug('Gathering project statistics by scanning files...');
    let allRelativeFiles;
    try {
      this.logger.debug('Listing all files in the project directory...');
      this.logger.debug(`Project root: ${this.projectRoot}`);
      const exclude = await this.loadGitignoreExclusions();
      const allFiles = await this.fileOps.listDirectoryRecursive(this.projectRoot, { exclude });
      this.logger.debug(`Total files found: ${allFiles.length}`);
      this.logger.debug('Converting to relative paths...');
      allRelativeFiles = allFiles.map((f) => path.relative(this.projectRoot, f));
    } catch {
      allRelativeFiles = [];
    }

    const docFiles = allRelativeFiles.filter(
      (f) => f.endsWith('.md') || path.basename(f).toLowerCase() === 'license'
    );
    const sourceFiles = filterSourceFiles(allRelativeFiles);
    const primaryLanguage = determinePrimaryLanguage(countFilesByExtension(sourceFiles));

    const sep = path.sep;
    const hasDocsDir = allRelativeFiles.some((f) => f.startsWith('docs' + sep) || f === 'docs');
    const hasChangelog = allRelativeFiles.some(
      (f) => path.basename(f).toLowerCase() === 'changelog.md'
    );

    let readmeSize;
    try {
      const meta = await this.fileOps.stat(path.join(this.projectRoot, 'README.md'));
      readmeSize = meta.size;
    } catch {
      readmeSize = 0;
    }

    return {
      docCount: docFiles.length,
      sourceCount: sourceFiles.length,
      readmeSize,
      hasChangelog,
      hasDocsDir,
      primaryLanguage,
    };
  }

  /**
   * List existing documentation files (I/O operation)
   * @returns {Promise<Array<string>>} - List of existing doc paths
   */
  async listExistingDocs() {
    let allFiles;
    try {
      const exclude = await this.loadGitignoreExclusions();
      allFiles = await this.fileOps.listDirectoryRecursive(this.projectRoot, { exclude });
    } catch {
      return [];
    }
    return allFiles
      .map((f) => path.relative(this.projectRoot, f))
      .filter((f) => f.endsWith('.md') || path.basename(f).toLowerCase() === 'license');
  }

  /**
   * Read content for a list of relative doc file paths, returning entries
   * suitable for fingerprinting via Step0bStateCache.
   * @param {string[]} relativePaths - Relative paths from listExistingDocs()
   * @returns {Promise<Array<{path: string, content: string}>>}
   */
  async _readDocEntries(relativePaths) {
    const entries = [];
    for (const relPath of relativePaths) {
      try {
        const content = await this.fileOps.readFile(path.join(this.projectRoot, relPath));
        entries.push({ path: relPath, content });
      } catch {
        // Unreadable file — skip, it will register as a change if it appears later
      }
    }
    return entries;
  }
}
