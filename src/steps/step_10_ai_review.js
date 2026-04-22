/**
 * Step 10 AI Review
 * @module steps/step_10_ai_review
 * @version 2.0.0
 *
 * Encapsulates the AI-specific code-quality review flow for Step 10:
 * reviewable-file selection, partition rotation, prompt construction, and the
 * supplementary error-resilience pass.
 */

import { basename } from 'path';
import yaml from 'js-yaml';
import { logger } from '../core/logger.js';
import { Step10PartitionCache } from '../lib/step10_partition_cache.js';
import {
  buildCodeQualityPrompt,
  loadResolvedAiHelpers,
  AI_PROJECT_KINDS_PATH,
  buildYamlStepPrompt,
  buildProjectKindPrompt,
  buildAlternativesDirective,
  parseAlternatives,
} from '../lib/ai_prompt_builder.js';

/**
 * Maximum characters from a single source file included in one AI prompt entry.
 * Larger files are split into sequential `(part X/Y)` prompt entries instead of
 * relying on one truncated excerpt.
 */
export const AI_MAX_CHARS_PER_PROMPT_ENTRY = 4000;

/**
 * Maximum combined character budget for code-content entries in one AI request.
 */
export const AI_MAX_PROMPT_SLICE_CHARS = 9000;

/**
 * Maximum number of prompt entries included in one Step 10 AI request.
 */
export const AI_MAX_PROMPT_ENTRIES_PER_SLICE = 4;

const STEP10_REVIEWABLE_EXTENSIONS = [
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.py',
  '.go',
  '.java',
  '.rb',
  '.rs',
  '.sh',
  '.bash',
];

const STEP10_GENERATED_PATH_PATTERNS = [
  /(^|\/)(dist|build|out|coverage|node_modules|vendor|\.next|\.nuxt|\.svelte-kit|\.cache|\.parcel-cache|\.ai_workflow|\.jest-cache)(\/|$)/,
  /(^|\/)assets\/js(\/|$)/,
  /\.min\.(js|css)$/i,
];

const FRONT_END_PROJECT_KINDS = new Set(['react_spa', 'client_spa', 'static_website']);
const STEP10_AI_PERSONA = 'code_quality_analyst';

/**
 * Sort file paths so source files (src/) appear before test files (test/).
 * Within each group, alphabetical order is preserved.
 * This ensures AI code samples show implementation code first.
 *
 * @pure
 * @param {string[]} files - Relative file paths
 * @returns {string[]} Sorted file paths (source files first)
 */
export function prioritizeSourceFiles(files) {
  if (!Array.isArray(files)) return [];
  const isTestFile = (f) => /[\\/](test|tests|spec|__tests__)[\\/]|\.test\.|\.spec\./.test(f);
  const src = files.filter((f) => !isTestFile(f)).sort();
  const test = files.filter((f) => isTestFile(f)).sort();
  return [...src, ...test];
}

export function isStep10GeneratedArtifactPath(filePath) {
  if (typeof filePath !== 'string' || filePath.length === 0) return false;
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  return STEP10_GENERATED_PATH_PATTERNS.some((pattern) => pattern.test(normalized));
}

/**
 * Check whether a file is suitable for the Step 10 AI code-quality pass.
 *
 * This excludes metadata-only files such as lockfiles by limiting the AI review
 * to source-like code and script extensions.
 *
 * @pure
 * @param {string} filePath - Relative file path
 * @returns {boolean} True if the file should be considered for Step 10 AI review
 */
export function isStep10CodeReviewableFile(filePath) {
  if (typeof filePath !== 'string' || filePath.length === 0) return false;
  const normalized = filePath.toLowerCase();
  if (isStep10GeneratedArtifactPath(normalized)) return false;
  return STEP10_REVIEWABLE_EXTENSIONS.some((ext) => normalized.endsWith(ext));
}

/**
 * Check whether a file is suitable for the supplementary Error Resilience pass.
 *
 * This pass should only run on executable source-like files, not declaration-only
 * files or metadata/config artifacts that are not executed.
 *
 * @pure
 * @param {string} filePath - Relative file path
 * @returns {boolean} True if error resilience analysis should consider the file
 */
export function isErrorResilienceReviewableFile(filePath) {
  if (!isStep10CodeReviewableFile(filePath)) return false;
  return !filePath.toLowerCase().endsWith('.d.ts');
}

/**
 * Build a structured map of file content excerpts for AI prompt injection.
 * Prioritises source files and caps each file's content to avoid token overflow.
 *
 * @pure
 * @param {Object} fileContents - Map of { relPath: fileContent }
 * @param {Object} [options={}]
 * @param {number} [options.maxCharsPerFile=600] - Max characters per file excerpt
 * @param {number} [options.maxFiles=8] - Max number of files to include
 * @returns {Array<{path: string, excerpt: string, truncated: boolean}>}
 */
export function buildFileContentMap(fileContents, options = {}) {
  const { maxCharsPerFile = 600, maxFiles = 8 } = options;
  if (!fileContents || typeof fileContents !== 'object') return [];
  const prioritized = prioritizeSourceFiles(Object.keys(fileContents));
  return prioritized.slice(0, maxFiles).map((path) => {
    const content = fileContents[path] ?? '';
    const truncated = content.length > maxCharsPerFile;
    return { path, excerpt: content.slice(0, maxCharsPerFile), truncated };
  });
}

/**
 * Split oversized source files into prompt-safe sequential entries.
 *
 * @pure
 * @param {Object} fileContents - Map of { relPath: fileContent }
 * @param {Object} [options={}]
 * @param {number} [options.maxCharsPerEntry=AI_MAX_CHARS_PER_PROMPT_ENTRY]
 * @returns {Array<{displayPath: string, sourcePath: string, excerpt: string}>}
 */
export function buildPromptFileEntries(fileContents, options = {}) {
  const { maxCharsPerEntry = AI_MAX_CHARS_PER_PROMPT_ENTRY } = options;
  if (!fileContents || typeof fileContents !== 'object') return [];

  const prioritized = prioritizeSourceFiles(Object.keys(fileContents));
  const entries = [];

  for (const sourcePath of prioritized) {
    const content = fileContents[sourcePath];
    if (typeof content !== 'string' || content.length === 0) continue;

    if (content.length <= maxCharsPerEntry) {
      entries.push({ displayPath: sourcePath, sourcePath, excerpt: content });
      continue;
    }

    const totalParts = Math.ceil(content.length / maxCharsPerEntry);
    for (let i = 0; i < totalParts; i++) {
      const start = i * maxCharsPerEntry;
      const end = start + maxCharsPerEntry;
      entries.push({
        displayPath: `${sourcePath} (part ${i + 1}/${totalParts})`,
        sourcePath,
        excerpt: content.slice(start, end),
      });
    }
  }

  return entries;
}

function estimatePromptEntrySize(entry) {
  return (entry?.displayPath?.length ?? 0) + (entry?.excerpt?.length ?? 0) + 32;
}

/**
 * Build prompt-safe AI slices from real source file contents.
 *
 * @pure
 * @param {Object} fileContents - Map of { relPath: fileContent }
 * @param {Object} [options={}]
 * @param {number} [options.maxCharsPerEntry=AI_MAX_CHARS_PER_PROMPT_ENTRY]
 * @param {number} [options.maxPromptChars=AI_MAX_PROMPT_SLICE_CHARS]
 * @param {number} [options.maxEntriesPerSlice=AI_MAX_PROMPT_ENTRIES_PER_SLICE]
 * @returns {Array<{entries: Array<{displayPath: string, sourcePath: string, excerpt: string}>, scopePaths: string[], oversizedPaths: string[]}>}
 */
export function buildCodePromptSlices(fileContents, options = {}) {
  const {
    maxCharsPerEntry = AI_MAX_CHARS_PER_PROMPT_ENTRY,
    maxPromptChars = AI_MAX_PROMPT_SLICE_CHARS,
    maxEntriesPerSlice = AI_MAX_PROMPT_ENTRIES_PER_SLICE,
  } = options;
  const entries = buildPromptFileEntries(fileContents, { maxCharsPerEntry });
  if (entries.length === 0) return [];

  const entryCounts = entries.reduce((acc, entry) => {
    acc[entry.sourcePath] = (acc[entry.sourcePath] || 0) + 1;
    return acc;
  }, {});

  const slices = [];
  let currentEntries = [];
  let currentChars = 0;

  const flush = () => {
    if (currentEntries.length === 0) return;
    const scopePaths = [...new Set(currentEntries.map((entry) => entry.sourcePath))];
    const oversizedPaths = scopePaths.filter((path) => entryCounts[path] > 1);
    slices.push({ entries: currentEntries, scopePaths, oversizedPaths });
    currentEntries = [];
    currentChars = 0;
  };

  for (const entry of entries) {
    const entrySize = estimatePromptEntrySize(entry);
    const wouldOverflow =
      currentEntries.length > 0 &&
      (currentChars + entrySize > maxPromptChars || currentEntries.length >= maxEntriesPerSlice);

    if (wouldOverflow) flush();

    currentEntries.push(entry);
    currentChars += entrySize;
  }

  flush();
  return slices;
}

/**
 * Format a file content map as a human-readable string for the AI prompt.
 *
 * @pure
 * @param {Array<{path: string, excerpt: string, truncated: boolean}>} contentMap
 * @returns {string}
 */
export function formatFileContentMap(contentMap) {
  if (!Array.isArray(contentMap) || contentMap.length === 0) return '(no source files provided)';
  return contentMap
    .map(({ path, excerpt, truncated }) => {
      const note = truncated ? ' [truncated]' : '';
      return `### ${path}${note}\n\`\`\`\n${excerpt}\n\`\`\``;
    })
    .join('\n\n');
}

/**
 * Format split prompt entries as a human-readable string for AI prompt injection.
 *
 * @pure
 * @param {Array<{displayPath: string, excerpt: string}>} entries
 * @returns {string}
 */
export function formatPromptFileEntries(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return '(no source files provided)';
  return entries
    .map(({ displayPath, excerpt }) => `### ${displayPath}\n\`\`\`\n${excerpt}\n\`\`\``)
    .join('\n\n');
}

/**
 * Build an 8-character content hash from file contents for cache-key freshness.
 * Combines the first 80 chars of each file (sorted by path) into a simple checksum.
 *
 * @pure
 * @param {Object} fileContents - Map of { relPath: fileContent }
 * @returns {string} 8-character hex-like hash string
 */
export function buildCodeContentHash(fileContents) {
  if (!fileContents || typeof fileContents !== 'object') return '00000000';
  const sorted = Object.keys(fileContents).sort();
  let hash = 0;
  for (const key of sorted) {
    const snippet = (fileContents[key] ?? '').slice(0, 80);
    for (let i = 0; i < snippet.length; i++) {
      hash = (hash * 31 + snippet.charCodeAt(i)) >>> 0;
    }
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * Determine whether the error resilience supplementary prompt should be run
 * for the given project kind.
 *
 * The error_resilience_prompt focuses on server-side and general application
 * failure modes (uncaught exceptions, unhandled rejections, silent failures).
 * It is not applicable to purely static or passive projects.
 *
 * @pure
 * @param {string} projectKind - Project kind identifier
 * @returns {boolean} True when error resilience analysis is appropriate
 */
export function shouldRunErrorResiliencePrompt(projectKind) {
  const excluded = new Set(['static_website', 'configuration_library']);
  return !excluded.has(projectKind);
}

function createEmptyAiReviewResult() {
  return {
    alternatives: [],
    recommendedAlternative: null,
    erFindings: '',
  };
}

/**
 * Executes the Step 10 AI-assisted review flow after linter analysis has
 * already produced the aggregate quality report.
 */
export class Step10AiReviewService {
  constructor(options = {}) {
    this.fileOps = options.fileOps;
    this.aiHelper = options.aiHelper;
    this.aiCache = options.aiCache;
    this.backlog = options.backlog;
  }

  async review(context) {
    const aiAvailable = await this.aiHelper.initialize();
    if (!aiAvailable) {
      logger.warn('AI helper not available - skipping AI code quality review');
      return createEmptyAiReviewResult();
    }

    await this.aiCache.init();

    const reviewableSourceFiles = this.getReviewableSourceFiles(context.allSourceFiles);
    if (reviewableSourceFiles.length === 0) {
      logger.warn(
        '[step_10] AI code quality review skipped: no reviewable source-like files remained after filtering metadata and generated artifacts'
      );
      return createEmptyAiReviewResult();
    }

    const partitionSelection = await this.selectReviewPartition(
      context.projectRoot,
      reviewableSourceFiles,
      context.options?.modifiedFiles ?? []
    );

    const { partition, partitionCache, activeCandidates } = partitionSelection;

    logger.info(
      `Reviewing partition ${partition.index + 1}/${partition.total} (${partition.files.length} files): ${partition.label}`
    );

    const fileContents = await this.readPartitionFileContents(context.projectRoot, partition.files);
    const sharedPromptContext = await this.loadSharedPromptContext(
      context.projectRoot,
      context.options
    );

    const promptSlices = buildCodePromptSlices(fileContents, {
      maxCharsPerEntry: AI_MAX_CHARS_PER_PROMPT_ENTRY,
      maxPromptChars: AI_MAX_PROMPT_SLICE_CHARS,
      maxEntriesPerSlice: AI_MAX_PROMPT_ENTRIES_PER_SLICE,
    });
    if (promptSlices.length === 0) {
      logger.warn(
        '[step_10] AI code quality review skipped: no readable source content was available for the selected partition'
      );
    }

    const aiContent = await this.runCodeQualityReview({
      ...context,
      ...sharedPromptContext,
      partition,
      promptSlices,
      fileContents,
      reviewableSourceFiles,
    });

    const errorResilienceFileContents = Object.fromEntries(
      Object.entries(fileContents).filter(([path]) => isErrorResilienceReviewableFile(path))
    );

    let erContent = '';
    const currentKind = context.options?.projectType ?? context.options?.projectKind ?? '';
    if (
      sharedPromptContext.sharedParsedYaml &&
      shouldRunErrorResiliencePrompt(currentKind) &&
      Object.keys(errorResilienceFileContents).length > 0
    ) {
      try {
        erContent = await this.runErrorResilienceReview({
          projectRoot: context.projectRoot,
          primaryLanguage: context.primaryLanguage,
          partition,
          errorResilienceFileContents,
          sharedParsedYaml: sharedPromptContext.sharedParsedYaml,
        });
      } catch (erError) {
        logger.warn(`Error resilience analysis skipped: ${erError.message}`);
      }
    }

    const parsedAlternatives = context.options?.alternatives
      ? parseAlternatives(aiContent)
      : { alternatives: [], recommended: null };

    if (aiContent || erContent) {
      await this.backlog.saveStepSummary(
        10,
        'Code Quality',
        this.buildEnrichedReport(context.report, partition, aiContent, erContent)
      );
      await partitionCache.updateQualityScores(context.perFileIssues, partition.files);
      await partitionCache.advance(activeCandidates);
    }

    return {
      alternatives: parsedAlternatives.alternatives,
      recommendedAlternative: parsedAlternatives.recommended,
      erFindings: erContent,
    };
  }

  getReviewableSourceFiles(allSourceFiles) {
    const uniqueSourceFiles = [...new Set(allSourceFiles)];
    return prioritizeSourceFiles(
      uniqueSourceFiles.filter((filePath) => isStep10CodeReviewableFile(filePath))
    );
  }

  async selectReviewPartition(projectRoot, reviewableSourceFiles, modifiedFiles) {
    const partitionCache = new Step10PartitionCache({
      cacheDir: `${projectRoot}/.ai_workflow/.step_cache`,
    });
    const activeCandidates = await partitionCache.getActiveCandidates(
      reviewableSourceFiles,
      modifiedFiles
    );
    const candidateFiles = activeCandidates.length > 0 ? activeCandidates : reviewableSourceFiles;
    if (activeCandidates.length === 0) {
      logger.warn(
        '[step_10] All reviewable source-like files were quality-exempt; falling back to a regular partition review within reviewable files'
      );
    }
    const partition = await partitionCache.getCurrentPartition(candidateFiles);
    return { partitionCache, activeCandidates, partition };
  }

  async readPartitionFileContents(projectRoot, partitionFiles) {
    const fileContents = {};
    await Promise.all(
      partitionFiles.map(async (relPath) => {
        try {
          const abs = relPath.startsWith('/') ? relPath : `${projectRoot}/${relPath}`;
          fileContents[relPath] = await this.fileOps.readFile(abs);
        } catch {
          // File unreadable — the prompt will still list it by name.
        }
      })
    );
    return fileContents;
  }

  async loadSharedPromptContext(projectRoot, options = {}) {
    let sharedParsedYaml = null;
    let sharedRoleOverride = '';

    try {
      sharedParsedYaml = await loadResolvedAiHelpers(this.fileOps);
      try {
        const pkYaml = await this.fileOps.readFile(AI_PROJECT_KINDS_PATH);
        const parsedPk = yaml.load(pkYaml);
        const pk = buildProjectKindPrompt(
          parsedPk,
          options?.projectKind ?? 'default',
          'code_quality_auditor'
        );
        if (pk?.role) sharedRoleOverride = pk.role;
      } catch {
        // optional
      }
    } catch {
      // fallback to hardcoded builder below
    }

    return { sharedParsedYaml, sharedRoleOverride };
  }

  async runCodeQualityReview(context) {
    const aiSectionResults = await Promise.all(
      context.promptSlices.map((promptSlice, sliceIndex) =>
        this.reviewPromptSlice({
          ...context,
          promptSlice,
          sliceIndex,
        })
      )
    );

    const aiSections = aiSectionResults.filter((content) => content);
    return aiSections.join('\n\n---\n\n');
  }

  async reviewPromptSlice(context) {
    const sliceContents = Object.fromEntries(
      context.promptSlice.scopePaths
        .filter((filePath) => Object.prototype.hasOwnProperty.call(context.fileContents, filePath))
        .map((filePath) => [filePath, context.fileContents[filePath]])
    );

    let prompt = this.buildQualitySlicePrompt(context);
    if (!prompt) {
      prompt = buildCodeQualityPrompt({
        codeFiles: context.promptSlice.scopePaths,
        language: context.primaryLanguage,
        projectInfo: {
          projectRoot: context.projectRoot,
          language: context.primaryLanguage,
          languages: context.detectedLanguages,
        },
        fileContents: sliceContents,
      });
    }

    if (context.options?.alternatives) {
      const count = context.options.alternatives === true ? 2 : context.options.alternatives;
      prompt += buildAlternativesDirective(count);
    }

    const fileHashEntries = context.promptSlice.entries.map(
      (entry) => `${entry.displayPath}:${entry.excerpt}`
    );
    const aiResult = await this.aiCache.withFileChangeGuard(
      `step_10_p${context.partition.index}_s${context.sliceIndex}`,
      fileHashEntries,
      () =>
        this.aiHelper.executeRequest(prompt, {
          persona: STEP10_AI_PERSONA,
          timeout: 240000,
        })
    );
    const aiContent = aiResult?.content ?? '';
    if (!aiContent) return '';
    return context.promptSlices.length > 1
      ? `### Slice ${context.sliceIndex + 1} of ${context.promptSlices.length}\n\n${aiContent}`
      : aiContent;
  }

  buildQualitySlicePrompt(context) {
    try {
      if (!context.sharedParsedYaml) return '';

      const fileContentMap = formatPromptFileEntries(context.promptSlice.entries);
      const projectName = basename(context.projectRoot);
      const modifiedFiles = context.options?.modifiedFiles ?? [];
      const prompt = buildYamlStepPrompt(context.sharedParsedYaml, 'step10_code_quality_prompt', {
        partition_header:
          context.promptSlices.length > 1
            ? `[Slice ${context.sliceIndex + 1} of ${context.promptSlices.length} within partition ${context.partition.index + 1}/${context.partition.total} — analyse ONLY the files or file-parts listed below for this request]`
            : `[Partition ${context.partition.index + 1}/${context.partition.total} — analyse ONLY the files listed below for this request]`,
        partition_scope_note:
          context.promptSlices.length > 1
            ? `This request covers ${context.promptSlice.scopePaths.length} source files from the current partition. Entries labeled "(part X/Y)" are sequential chunks of oversized files that were split across multiple prompt logs to avoid truncated code excerpts.`
            : `This request covers ${context.promptSlice.scopePaths.length} source files from the current partition.`,
        project_name: projectName,
        project_description: context.options?.projectDescription ?? '',
        primary_language: context.primaryLanguage,
        project_kind: context.options?.projectKind ?? '',
        tech_stack_summary: context.detectedLanguages.join(', '),
        change_scope: context.options?.changeScope ?? 'full',
        files_in_scope: context.promptSlice.scopePaths.length,
        modified_count: modifiedFiles.length,
        total_files: context.aggregateTotals.fileCount ?? context.reviewableSourceFiles.length,
        language_breakdown:
          context.detectedLanguages.map((language) => `${language}`).join(', ') ||
          context.primaryLanguage,
        quality_summary: `${context.aggregateTotals.totalIssues} issue(s)`,
        quality_report_content: context.report.slice(0, 3000),
        large_files_list:
          context.promptSlice.oversizedPaths.length > 0
            ? context.promptSlice.oversizedPaths.join(', ')
            : '(none)',
        sample_code: '',
        file_content_map: fileContentMap,
      });

      if (!prompt) return '';

      let resolvedPrompt = context.sharedRoleOverride
        ? `[Project-Kind Role: ${context.sharedRoleOverride}]\n\n${prompt}`
        : prompt;

      resolvedPrompt = this.appendIssueExtractionPrompt(
        resolvedPrompt,
        context.sharedParsedYaml,
        projectName,
        context.primaryLanguage,
        context.options
      );

      return this.appendFrontEndPerspective(
        resolvedPrompt,
        context.sharedParsedYaml,
        context.projectRoot,
        context.options
      );
    } catch {
      return '';
    }
  }

  appendIssueExtractionPrompt(
    prompt,
    sharedParsedYaml,
    projectName,
    primaryLanguage,
    options = {}
  ) {
    const logFile = options?.sessionLogFile ?? '';
    const logContent = options?.sessionLogContent ?? '';
    if (!logFile || !logContent) return prompt;

    const issuePrompt = buildYamlStepPrompt(sharedParsedYaml, 'issue_extraction_prompt', {
      project_name: projectName,
      primary_language: primaryLanguage,
      log_file: logFile,
      log_content: logContent,
    });
    return issuePrompt ? `${prompt}\n\n---\n\n${issuePrompt}` : prompt;
  }

  appendFrontEndPerspective(prompt, sharedParsedYaml, projectRoot, options = {}) {
    const currentKind = options?.projectType ?? options?.projectKind ?? '';
    if (!FRONT_END_PROJECT_KINDS.has(currentKind)) return prompt;

    const frontEndPrompt = buildYamlStepPrompt(sharedParsedYaml, 'front_end_developer_prompt', {
      project_name: basename(projectRoot),
    });
    return frontEndPrompt ? `${prompt}\n\n---\n\n${frontEndPrompt}` : prompt;
  }

  async runErrorResilienceReview(context) {
    const erFileMap = formatFileContentMap(
      buildFileContentMap(context.errorResilienceFileContents, {
        maxFiles: context.partition.files.length,
        maxCharsPerFile: 2000,
      })
    );
    const erPrompt = buildYamlStepPrompt(context.sharedParsedYaml, 'error_resilience_prompt', {
      project_name: basename(context.projectRoot),
      primary_language: context.primaryLanguage,
      file_content_map: erFileMap,
    });
    if (!erPrompt) return '';

    const erHashEntries = Object.entries(context.errorResilienceFileContents).map(
      ([filePath, content]) => `${filePath}:${content}`
    );
    const erResult = await this.aiCache.withFileChangeGuard(
      `step_10_er_p${context.partition.index}`,
      erHashEntries,
      () =>
        this.aiHelper.executeRequest(erPrompt, {
          persona: STEP10_AI_PERSONA,
          timeout: 180000,
        })
    );
    return erResult?.content ?? '';
  }

  buildEnrichedReport(report, partition, aiContent, erContent) {
    const partitionHeader = `## AI Code Review — Partition ${partition.index + 1}/${partition.total}: \`${partition.label}\`\n`;
    let enrichedReport = `${report}\n\n---\n\n${partitionHeader}\n${aiContent}`;
    if (erContent) {
      enrichedReport += `\n\n---\n\n## Error Resilience Analysis\n\n${erContent}`;
    }
    return enrichedReport;
  }
}
