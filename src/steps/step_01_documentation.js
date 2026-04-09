/**
 * Step 1: AI-Powered Documentation Updates (Optimized)
 * @version 2.0.0
 * @description Update documentation based on code changes with AI assistance
 * @module steps/step_01_documentation
 * Part of: AI Workflow Automation (Phase 9)
 */

import { STEP_KIND } from './step_contract.js';
import logger from '../core/logger.js';
import { GitAutomation } from '../lib/git_automation.js';
import { AiCache } from '../lib/ai_cache.js';
import {
  PromptBuilder,
  buildDocAnalysisPrompt,
  loadResolvedAiHelpers,
  AI_PROJECT_KINDS_PATH,
  buildYamlStepPrompt,
  buildProjectKindPrompt,
  buildFileContentBlock,
  MAX_CHARS_TOTAL_CONTENTS,
} from '../lib/ai_prompt_builder.js';
import yaml from 'js-yaml';
import { AiHelper } from '../lib/ai_helpers.js';
import { Backlog } from '../lib/backlog.js';
import { Step1IncrementalProcessor } from '../lib/step1_incremental.js';
import { Step1ParallelProcessor } from '../lib/step1_parallel.js';
import { FileOperations } from '../lib/file_operations.js';

// ============================================================================
// PURE FUNCTIONS - Validation Logic
// ============================================================================

/**
 * Validate documentation file counts
 * @pure
 * @param {Object} counts - File counts by type
 * @param {number} counts.markdown - Count of markdown files
 * @param {number} counts.readme - Count of README files
 * @param {number} counts.docs - Count of docs directory files
 * @returns {Object} Validation result with success flag and issues
 */
export function validateDocumentationCounts(counts) {
  const issues = [];

  if (counts.markdown === 0 && counts.readme === 0) {
    issues.push('No documentation files found');
  }

  if (counts.readme === 0) {
    issues.push('No README file found in project root');
  }

  if (counts.readme > 1) {
    issues.push(`Multiple README files found (${counts.readme})`);
  }

  return {
    success: issues.length === 0,
    issues,
    counts,
  };
}

/**
 * Check for version references in content
 * @pure
 * @param {string} content - File content
 * @param {string} expectedVersion - Expected version string
 * @returns {Object} Check result with mismatches
 */
export function checkVersionReferences(content, expectedVersion) {
  const versionPattern = /v?\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?/g;
  const matches = content.match(versionPattern) || [];
  const uniqueVersions = [...new Set(matches)];

  const mismatches = uniqueVersions.filter(
    (v) => v !== expectedVersion && v !== `v${expectedVersion}`
  );

  return {
    found: uniqueVersions,
    mismatches,
    hasMismatches: mismatches.length > 0,
  };
}

/**
 * Classify changed files for documentation impact
 * @pure
 * @param {string[]} changedFiles - List of changed file paths
 * @returns {Object} Classification with counts and lists
 */
export function classifyChangedFiles(changedFiles) {
  const classification = {
    documentation: [],
    source: [],
    tests: [],
    config: [],
  };

  for (const file of changedFiles) {
    // Skip workflow artifact directories — they must never appear in prompts.
    if (file.startsWith('.ai_workflow/') || file.startsWith('.workflow_core/')) {
      continue;
    }
    if (file.endsWith('.md') || file.includes('docs/')) {
      classification.documentation.push(file);
    } else if (file.endsWith('.test.js') || file.includes('test/')) {
      classification.tests.push(file);
    } else if (
      file.endsWith('.json') ||
      file.endsWith('.yaml') ||
      file.endsWith('.yml') ||
      file.includes('config')
    ) {
      classification.config.push(file);
    } else if (
      file.endsWith('.js') ||
      file.endsWith('.mjs') ||
      file.endsWith('.ts') ||
      file.endsWith('.tsx')
    ) {
      classification.source.push(file);
    }
  }

  return {
    ...classification,
    counts: {
      documentation: classification.documentation.length,
      source: classification.source.length,
      tests: classification.tests.length,
      config: classification.config.length,
      total: changedFiles.length,
    },
  };
}

/**
 * Determine if AI analysis is needed
 * @pure
 * @param {Object} classification - File classification
 * @param {Object} options - Configuration options
 * @returns {boolean} True if AI analysis should run
 */
export function shouldRunAiAnalysis(classification, options = {}) {
  const { counts } = classification;
  const { skipDocsOnly = false, requireSource = false } = options;

  // Skip if no changes
  if (counts.total === 0) {
    return false;
  }

  // Skip if docs-only and configured to skip
  if (skipDocsOnly && counts.source === 0 && counts.documentation > 0) {
    return false;
  }

  // Require source changes if configured
  if (requireSource && counts.source === 0) {
    return false;
  }

  return true;
}

// ============================================================================
// PURE FUNCTIONS - Source Code Documentation Validation
// ============================================================================

/**
 * Validate JSDoc coverage in TypeScript/JavaScript source file content.
 *
 * Checks for:
 * - Missing module-level JSDoc block (`@module` or `@fileoverview`)
 * - Exported declarations (class, function, const, interface, type, enum) without a preceding JSDoc block
 * - Public class methods without a JSDoc block
 *
 * @pure
 * @param {string} filePath - File path (used in issue messages)
 * @param {string} content - File content
 * @returns {Object} { issues: Array<{file, message}>, missingModuleDoc: boolean, undocumentedExports: string[] }
 */
export function validateSourceDocumentation(filePath, content) {
  const issues = [];
  const lines = content.split('\n');

  // Check 1: module-level JSDoc (first non-empty line should be part of a /** */ block)
  const hasModuleDoc = /\/\*\*[\s\S]*?@(?:module|fileoverview)/.test(content);
  if (!hasModuleDoc) {
    issues.push({
      file: filePath,
      message: 'Missing module-level JSDoc (@module or @fileoverview)',
    });
  }

  // Check 2: exported declarations without a preceding JSDoc block
  const exportPattern =
    /^export\s+(?:default\s+)?(?:(?:abstract\s+)?class|function\*?|const|let|var|interface|type|enum)\s+(\w+)/;
  const undocumentedExports = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimStart();
    const match = exportPattern.exec(line);
    if (!match) continue;

    // Look backwards (skipping blank lines) for a closing */ on the immediately preceding block
    let j = i - 1;
    while (j >= 0 && lines[j].trim() === '') j--;

    const prevLine = j >= 0 ? lines[j].trim() : '';
    if (!prevLine.endsWith('*/') && !prevLine.startsWith('*')) {
      undocumentedExports.push(match[1]);
      issues.push({ file: filePath, message: `Missing JSDoc for exported symbol: ${match[1]}` });
    }
  }

  return {
    issues,
    missingModuleDoc: !hasModuleDoc,
    undocumentedExports,
  };
}

/**
 * Aggregate source documentation validation results across multiple files.
 *
 * @pure
 * @param {Array<{filePath: string, content: string}>} sourceFiles - Files to validate
 * @returns {Object} { success: boolean, totalIssues: number, fileResults: Object[] }
 */
export function validateAllSourceDocumentation(sourceFiles) {
  const fileResults = sourceFiles.map(({ filePath, content }) => ({
    filePath,
    ...validateSourceDocumentation(filePath, content),
  }));

  const totalIssues = fileResults.reduce((sum, r) => sum + r.issues.length, 0);

  return {
    success: totalIssues === 0,
    totalIssues,
    fileResults,
  };
}

// ============================================================================
// STEP 1 ANALYZER - Impure Wrapper
// ============================================================================

/**
 * Step 1 analyzer for documentation validation and updates
 */
export class Step1DocumentationAnalyzer {
  static stepKind = STEP_KIND.PROJECT;

  constructor(options = {}) {
    this.gitOps = options.gitOps || new GitAutomation();
    this.fileOps = options.fileOps || new FileOperations();
    this.backlog = options.backlog || new Backlog();
    this.aiCache = options.aiCache || new AiCache();
    this.promptBuilder = options.promptBuilder || new PromptBuilder();
    this.aiHelper =
      options.aiHelper ||
      new AiHelper({ promptsDir: options.promptsDir || options.configManager?.promptsDir });
    this.incrementalProcessor = options.incrementalProcessor || new Step1IncrementalProcessor();
    this.parallelProcessor = options.parallelProcessor || new Step1ParallelProcessor();
    this.enableParallel = options.enableParallel !== false;
    this.configManager = options.configManager || null;
  }

  /**
   * Execute Step 1 documentation analysis.
   *
   * Accepts two calling conventions:
   *   • Orchestrator (CONTEXT step): execute({ projectRoot, modifiedFiles, … })
   *   • Tests / legacy:              execute('/path', options)
   *
   * @param {string|Object} contextOrRoot - Context object or legacy projectRoot string
   * @param {Object} legacyOptions - Options when called with legacy string signature
   * @returns {Promise<Object>} Analysis result
   */
  async execute(contextOrRoot = {}, legacyOptions = {}) {
    const isLegacy = typeof contextOrRoot === 'string';
    const projectRoot = isLegacy ? contextOrRoot : contextOrRoot.projectRoot || process.cwd();
    const options = isLegacy ? legacyOptions : contextOrRoot;

    try {
      logger.step('Step 1: AI-Powered Documentation Updates');

      // Phase 1: Detect changes — prefer step_00's authoritative list over a fresh git query.
      const changedFiles = Array.isArray(options.modifiedFiles)
        ? options.modifiedFiles
        : await this.gitOps.getModifiedFiles();
      if (changedFiles.length === 0) {
        logger.info('No changes detected - skipping documentation update');
        return { success: true, skipped: true, reason: 'no_changes' };
      }

      logger.info(`Changed files detected: ${changedFiles.length} files`);

      // Phase 2: Classify changes
      const classification = classifyChangedFiles(changedFiles);
      logger.info(
        `Classification: ${classification.counts.documentation} docs, ${classification.counts.source} source, ${classification.counts.tests} tests`
      );

      // Phase 3: Check if AI analysis needed
      if (!shouldRunAiAnalysis(classification, options)) {
        logger.info('AI analysis not needed for these changes');
        return { success: true, skipped: true, reason: 'not_needed', classification };
      }

      // Phase 4: Incremental detection (check which docs actually changed)
      let docsToProcess = classification.documentation;
      if (options.enableIncremental !== false && classification.counts.documentation > 0) {
        logger.info('Checking documentation changes (incremental mode)...');
        const changedDocs = await this.incrementalProcessor.detectChangedDocs(
          classification.documentation
        );

        if (changedDocs.length === 0) {
          logger.success('All documentation files unchanged - skipping AI analysis');
          return { success: true, skipped: true, reason: 'docs_unchanged' };
        }

        const skipped = classification.counts.documentation - changedDocs.length;
        if (skipped > 0) {
          logger.success(`Incremental: ${skipped} docs unchanged (skipped)`);
        }

        docsToProcess = changedDocs;
      }

      // Phase 5: Run validation (parallel execution)
      logger.info('Running documentation consistency validation...');
      const validationResult = await this.runValidation(
        projectRoot,
        docsToProcess,
        classification.source
      );

      // Initialize AI helper and response cache before making requests
      // Set workingDirectory so the SDK session reads the target project's
      // .github/copilot-instructions.md instead of ai_workflow.js's own file.
      if (this.aiHelper.config && !this.aiHelper.config.workingDirectory) {
        this.aiHelper.config.workingDirectory = projectRoot;
      }
      const aiAvailable = await this.aiHelper.initialize();
      await this.aiCache.init();
      if (!aiAvailable) {
        logger.warn('AI helper not available - skipping AI analysis');
      }

      // Phase 6: Run parallel documentation analysis (if enabled)
      let analysisResult = null;
      if (this.enableParallel && docsToProcess.length >= 1) {
        logger.info('Running parallel documentation analysis...');
        const rawResult = await this.parallelProcessor.validate(
          docsToProcess,
          async (_category, files) => {
            if (!aiAvailable) {
              return { success: true, skipped: true, reason: 'ai_unavailable' };
            }
            const projectInfo = {
              language: this.configManager?.config?.tech_stack?.primary_language,
              projectKind: this.configManager?.config?.project?.kind,
            };
            let prompt;
            // Build the relevant changed-files list from classified categories only.
            // Using the raw changedFiles array would include unclassified/binary files
            // (e.g. .jest-cache/*, node_modules/**) that waste tokens and add noise.
            const relevantChangedFiles = [
              ...classification.documentation,
              ...classification.source,
              ...classification.tests,
              ...classification.config,
            ];
            // Try YAML-based doc_analysis_prompt first; fall back to hardcoded builder
            // Read actual file contents for both doc files and changed files so the
            // model can reason about real content rather than hallucinating.
            let fileContentsSection = '';
            const fileHashEntries = [];
            try {
              let totalChars = 0;
              const blocks = [];
              const allFiles = [...new Set([...files, ...relevantChangedFiles])];
              for (const fp of allFiles) {
                if (totalChars >= MAX_CHARS_TOTAL_CONTENTS) break;
                try {
                  const raw = await this.fileOps.readFile(`${projectRoot}/${fp}`);
                  totalChars += raw.length;
                  blocks.push(buildFileContentBlock(fp, raw));
                  fileHashEntries.push(`${fp}:${raw}`);
                } catch {
                  // File unreadable — skip gracefully
                }
              }
              if (blocks.length > 0) {
                fileContentsSection = blocks.join('\n\n');
              }
            } catch {
              // Content injection is best-effort; proceed without it if anything fails
            }
            let projectConventions = '';
            try {
              projectConventions = await this.fileOps.readFile(
                `${projectRoot}/.github/CONTRIBUTING.md`
              );
            } catch {
              // CONTRIBUTING.md is optional; leave empty so placeholder is omitted cleanly
            }
            try {
              const parsedYaml = await loadResolvedAiHelpers(this.fileOps);
              prompt = buildYamlStepPrompt(parsedYaml, 'doc_analysis_prompt', {
                project_name: projectInfo.projectKind ?? projectRoot,
                primary_language: projectInfo.language ?? 'unknown',
                changed_files: relevantChangedFiles.join(', '),
                doc_files: files.join(', '),
                file_contents: fileContentsSection || '(no file contents available)',
                project_conventions: projectConventions,
              });
            } catch {
              /* fallback */
            }
            if (!prompt) {
              prompt = buildDocAnalysisPrompt({
                changedFiles: relevantChangedFiles,
                docFiles: files,
                projectInfo,
              });
              if (fileContentsSection) {
                prompt += `\n\n# File Contents\n\n${fileContentsSection}`;
              }
            }
            // Overlay project-kind documentation specialist role if available
            try {
              const pkYaml = await this.fileOps.readFile(AI_PROJECT_KINDS_PATH);
              const parsedPk = yaml.load(pkYaml);
              const pk = buildProjectKindPrompt(
                parsedPk,
                projectInfo.projectKind ?? 'default',
                'documentation_specialist'
              );
              if (pk?.role) {
                prompt = `[Project-Kind Role: ${pk.role}]\n\n${prompt}`;
              }
            } catch {
              /* optional */
            }
            const cacheCategory = files.join(',');
            const response = await this.aiCache.withFileChangeGuard(
              `step_01|${cacheCategory}`,
              fileHashEntries,
              () =>
                this.aiHelper.executeRequest(prompt, {
                  persona: 'documentation_expert',
                })
            );
            return { success: response.success, response };
          },
          {
            strategy: options.parallelStrategy || 'BALANCED',
            maxConcurrency: options.maxConcurrency || 4,
          }
        );
        const procStats = this.parallelProcessor.getStatistics();
        analysisResult = {
          ...rawResult,
          stats: {
            processed: rawResult.validatedFiles,
            totalTime: procStats.totalDuration,
            speedup: procStats.speedup?.speedup ?? null,
          },
        };

        logger.success(
          `Parallel analysis completed: ${analysisResult.stats.processed} docs in ${analysisResult.stats.totalTime}ms`
        );
      }

      // Phase 7: Save to backlog
      const backlogContent = this.formatBacklogContent(
        classification,
        validationResult,
        analysisResult
      );
      await this.backlog.saveStepSummary(1, 'Documentation Analysis', backlogContent);

      logger.success('Step 1 completed successfully');

      return {
        success: true,
        classification,
        validation: validationResult,
        analysis: analysisResult,
        filesProcessed: docsToProcess.length,
      };
    } catch (error) {
      logger.error(`Step 1 failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Run documentation validation checks
   * @param {string} projectRoot - Project root
   * @param {string[]} docFiles - Documentation files to validate
   * @param {string[]} [sourceFiles=[]] - Changed source files to check for JSDoc coverage
   * @returns {Promise<Object>} Validation result
   */
  async runValidation(projectRoot, docFiles, sourceFiles = []) {
    const results = {
      fileCount: { success: true, issues: [] },
      versionRefs: { success: true, issues: [] },
      sourceDoc: { success: true, issues: [], totalIssues: 0 },
      totalIssues: 0,
    };

    try {
      // Test 1: File count validation
      const readmeFiles = docFiles.filter((f) => /readme\.md$/i.test(f));
      const markdownFiles = docFiles.filter((f) => f.endsWith('.md'));

      const countValidation = validateDocumentationCounts({
        markdown: markdownFiles.length,
        readme: readmeFiles.length,
        docs: docFiles.filter((f) => f.includes('docs/')).length,
      });

      results.fileCount = countValidation;
      results.totalIssues += countValidation.issues.length;

      // Test 2: Version reference checks (if package.json exists)
      try {
        const packageJson = await this.fileOps.readFile(`${projectRoot}/package.json`);
        const pkg = JSON.parse(packageJson);
        const expectedVersion = pkg.version;

        for (const docFile of docFiles) {
          const content = await this.fileOps.readFile(docFile);
          const versionCheck = checkVersionReferences(content, expectedVersion);

          if (versionCheck.hasMismatches) {
            results.versionRefs.issues.push({
              file: docFile,
              mismatches: versionCheck.mismatches,
            });
            results.versionRefs.success = false;
            results.totalIssues += versionCheck.mismatches.length;
          }
        }
      } catch {
        // package.json not found or invalid - skip version checks
      }

      // Test 3: Source code JSDoc coverage (TypeScript/JavaScript files)
      if (sourceFiles.length > 0) {
        const srcToCheck = sourceFiles.filter(
          (f) => f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.js') || f.endsWith('.mjs')
        );

        if (srcToCheck.length > 0) {
          logger.info(`Checking JSDoc coverage in ${srcToCheck.length} source file(s)...`);
          const fileData = await Promise.all(
            srcToCheck.map(async (filePath) => {
              try {
                const content = await this.fileOps.readFile(filePath);
                return { filePath, content };
              } catch {
                return null;
              }
            })
          );
          const validData = fileData.filter(Boolean);
          const srcDocResult = validateAllSourceDocumentation(validData);

          results.sourceDoc = {
            success: srcDocResult.success,
            issues: srcDocResult.fileResults.flatMap((r) => r.issues),
            totalIssues: srcDocResult.totalIssues,
            fileResults: srcDocResult.fileResults,
          };
          results.totalIssues += srcDocResult.totalIssues;

          if (!srcDocResult.success) {
            logger.warn(
              `Source JSDoc: ${srcDocResult.totalIssues} issue(s) found across ${srcToCheck.length} file(s)`
            );
          } else {
            logger.success(`Source JSDoc: all ${srcToCheck.length} file(s) properly documented`);
          }
        }
      }

      results.success = results.totalIssues === 0;
    } catch (error) {
      logger.error(`Validation failed: ${error.message}`);
      results.success = false;
      results.error = error.message;
    }

    return results;
  }

  /**
   * Format backlog content for Step 1
   * @param {Object} classification - File classification
   * @param {Object} validation - Validation results
   * @param {Object} analysis - Analysis results
   * @returns {string} Formatted markdown content
   */
  formatBacklogContent(classification, validation, analysis) {
    const lines = [];

    lines.push('## Step 1: Documentation Analysis\n');

    // Classification summary
    lines.push('### Changed Files');
    lines.push(`- **Total**: ${classification.counts.total}`);
    lines.push(`- **Documentation**: ${classification.counts.documentation}`);
    lines.push(`- **Source code**: ${classification.counts.source}`);
    lines.push(`- **Tests**: ${classification.counts.tests}`);
    lines.push(`- **Configuration**: ${classification.counts.config}\n`);

    // Validation results
    lines.push('### Validation Results');
    if (validation.success) {
      lines.push('✅ All validation checks passed\n');
    } else {
      lines.push(`⚠️ Found ${validation.totalIssues} issue(s):`);
      if (validation.fileCount.issues.length > 0) {
        lines.push('\n**File Count Issues:**');
        validation.fileCount.issues.forEach((issue) => lines.push(`- ${issue}`));
      }
      if (validation.versionRefs.issues.length > 0) {
        lines.push('\n**Version Reference Issues:**');
        validation.versionRefs.issues.forEach((issue) => {
          lines.push(`- ${issue.file}: ${issue.mismatches.join(', ')}`);
        });
      }
      if (validation.sourceDoc && validation.sourceDoc.totalIssues > 0) {
        lines.push('\n**Source Code JSDoc Issues:**');
        validation.sourceDoc.issues.forEach((issue) => {
          lines.push(`- ${issue.file}: ${issue.message}`);
        });
      }
      lines.push('');
    }

    // Analysis results
    if (analysis) {
      lines.push('### Parallel Analysis');
      lines.push(`- **Files processed**: ${analysis.stats.processed}`);
      lines.push(`- **Total time**: ${analysis.stats.totalTime}ms`);
      lines.push(
        `- **Average time per file**: ${Math.round(analysis.stats.totalTime / analysis.stats.processed)}ms`
      );
      if (analysis.stats.speedup) {
        lines.push(`- **Speedup**: ${analysis.stats.speedup.toFixed(2)}x`);
      }
    }

    return lines.join('\n');
  }
}

export default Step1DocumentationAnalyzer;
