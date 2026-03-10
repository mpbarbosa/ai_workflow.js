/**
 * Step 2: Documentation Consistency Analysis
 * @version 2.0.0
 * @description Check documentation for broken references and consistency issues
 * @module steps/step_02_consistency
 * Part of: AI Workflow Automation (Phase 9)
 */

import path from 'path';
import { STEP_KIND } from './step_contract.js';
import logger from '../core/logger.js';
import { FileOperations } from '../lib/file_operations.js';
import { Backlog } from '../lib/backlog.js';
import yaml from 'js-yaml';
import { AiHelper } from '../lib/ai_helpers.js';
import { AiCache } from '../lib/ai_cache.js';
import {
  buildConsistencyPrompt,
  AI_HELPERS_PATH,
  AI_PROJECT_KINDS_PATH,
  buildYamlStepPrompt,
  buildProjectKindPrompt,
} from '../lib/ai_prompt_builder.js';
import { TechStackDetector } from '../lib/tech_stack.js';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Semantic version pattern
 */
export const SEMVER_PATTERN =
  /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

/**
 * Markdown link patterns
 */
export const LINK_PATTERNS = {
  // [text](url)
  markdown: /\[([^\]]+)\]\(([^)]+)\)/g,
  // <url>
  autolink: /<([^>]+)>/g,
  // [text][ref]
  reference: /\[([^\]]+)\]\[([^\]]+)\]/g,
};

/**
 * Issue types
 */
export const ISSUE_TYPE = {
  BROKEN_LINK: 'broken_link',
  INVALID_VERSION: 'invalid_version',
  MISSING_FILE: 'missing_file',
  INCONSISTENT_METRICS: 'inconsistent_metrics',
};

/**
 * Maximum documentation files per AI call partition.
 * Keeps individual prompts well under model context limits.
 */
export const PARTITION_SIZE = 50;

/**
 * Maximum unique broken-link source files shown per partition prompt.
 */
export const MAX_ISSUES_PER_PROMPT = 30;

/**
 * Hard character cap applied to every prompt before sending to the AI.
 * ~15 000 tokens at 4 chars/token — safe for all supported models.
 */
export const MAX_PROMPT_CHARS = 60_000;

// ============================================================================
// PURE FUNCTIONS - Version Validation
// ============================================================================

/**
 * Validate semantic version format
 * @pure
 * @param {string} version - Version string to validate
 * @returns {boolean} True if valid semver
 */
export function validateSemver(version) {
  if (!version || typeof version !== 'string') {
    return false;
  }
  return SEMVER_PATTERN.test(version.trim());
}

/**
 * Extract version strings from content
 * @pure
 * @param {string} content - File content
 * @returns {string[]} Array of version strings found
 */
export function extractVersions(content) {
  const versionPattern = /v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[a-zA-Z0-9.-]+)?/g;
  const matches = content.match(versionPattern) || [];
  return [...new Set(matches)]; // Remove duplicates
}

/**
 * Check version consistency across multiple files
 * @pure
 * @param {Object[]} fileVersions - Array of {file, versions} objects
 * @param {string} expectedVersion - Expected version
 * @returns {Object} Consistency check result
 */
export function checkVersionConsistency(fileVersions, expectedVersion) {
  const issues = [];
  const allVersions = new Set();

  for (const { file, versions } of fileVersions) {
    for (const version of versions) {
      allVersions.add(version);

      // Check if version matches expected (with or without 'v' prefix)
      const normalized = version.replace(/^v/, '');
      const expectedNormalized = expectedVersion.replace(/^v/, '');

      if (normalized !== expectedNormalized) {
        issues.push({
          file,
          found: version,
          expected: expectedVersion,
          type: ISSUE_TYPE.INVALID_VERSION,
        });
      }
    }
  }

  return {
    consistent: issues.length === 0,
    issues,
    uniqueVersions: Array.from(allVersions),
    totalChecked: fileVersions.length,
  };
}

// ============================================================================
// PURE FUNCTIONS - Link Validation
// ============================================================================

/**
 * Extract links from markdown content
 * @pure
 * @param {string} content - Markdown content
 * @returns {Object[]} Array of {text, url, type, line} objects
 */
export function extractLinks(content) {
  const links = [];
  const lines = content.split('\n');

  // Extract markdown links [text](url)
  lines.forEach((line, index) => {
    const pattern = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;
    while ((match = pattern.exec(line)) !== null) {
      links.push({
        text: match[1],
        url: match[2],
        type: 'markdown',
        line: index + 1,
      });
    }
  });

  // Extract autolinks <url>
  lines.forEach((line, index) => {
    const pattern = /<(https?:\/\/[^>]+)>/g;
    let match;
    while ((match = pattern.exec(line)) !== null) {
      links.push({
        text: match[1],
        url: match[1],
        type: 'autolink',
        line: index + 1,
      });
    }
  });

  return links;
}

/**
 * Check if a link is a file reference
 * @pure
 * @param {string} url - URL to check
 * @returns {boolean} True if file reference
 */
export function isFileReference(url) {
  // Skip external URLs
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return false;
  }

  // Skip anchors
  if (url.startsWith('#')) {
    return false;
  }

  return true;
}

/**
 * Normalize file path for comparison.
 * When `baseDir` is absolute, resolves using `path.resolve` so that `../`
 * segments are correctly traversed (returns absolute path). When `baseDir`
 * is relative, collapses `../` with `path.normalize` (returns relative path).
 * @pure
 * @param {string} filePath - File path (may contain `../` segments)
 * @param {string} baseDir - Base directory (directory of the source file)
 * @returns {string} Normalized path
 */
export function normalizeFilePath(filePath, baseDir = '.') {
  // Remove anchor fragments
  const withoutAnchor = filePath.split('#')[0];
  if (!withoutAnchor) return '';

  if (path.isAbsolute(baseDir)) {
    // Absolute base: path.resolve correctly traverses ../
    return path.resolve(baseDir, withoutAnchor);
  }

  // Relative base: collapse ../ with normalize+join (preserves relative output for tests)
  const base = baseDir === '.' ? '' : baseDir;
  return path.normalize(base ? path.join(base, withoutAnchor) : withoutAnchor);
}

/**
 * Validate file references
 * @pure
 * @param {Object[]} links - Links to validate
 * @param {Set} existingFiles - Set of existing file paths
 * @param {string} sourceFile - Source file path for relative resolution
 * @returns {Object[]} Array of broken link issues
 */
export function validateFileReferences(links, existingFiles, sourceFile) {
  const issues = [];
  const sourceDir = sourceFile.split('/').slice(0, -1).join('/') || '.';

  for (const link of links) {
    if (!isFileReference(link.url)) {
      continue;
    }

    const normalized = normalizeFilePath(link.url, sourceDir);

    if (!existingFiles.has(normalized)) {
      issues.push({
        file: sourceFile,
        link: link.url,
        text: link.text,
        line: link.line,
        type: ISSUE_TYPE.BROKEN_LINK,
      });
    }
  }

  return issues;
}

// ============================================================================
// PURE FUNCTIONS - Reporting
// ============================================================================

/**
 * Format consistency check results
 * @pure
 * @param {Object} results - Consistency check results
 * @returns {string} Formatted markdown content
 */
export function formatConsistencyReport(results) {
  const lines = [];

  lines.push('## Step 2: Consistency Analysis\n');

  // Summary
  lines.push('### Summary');
  lines.push(`- **Files checked**: ${results.filesChecked}`);
  lines.push(`- **Total issues**: ${results.totalIssues}`);
  lines.push(`- **Broken links**: ${results.brokenLinks.length}`);
  lines.push(`- **Version issues**: ${results.versionIssues.length}\n`);

  // Status
  if (results.totalIssues === 0) {
    lines.push('✅ **Status**: All consistency checks passed\n');
  } else {
    lines.push('⚠️ **Status**: Issues found - review required\n');
  }

  // Broken links
  if (results.brokenLinks.length > 0) {
    lines.push('### Broken Links');
    results.brokenLinks.slice(0, 10).forEach((issue) => {
      lines.push(`- **${issue.file}:${issue.line}** - [${issue.text}](${issue.link})`);
    });
    if (results.brokenLinks.length > 10) {
      lines.push(`\n*... and ${results.brokenLinks.length - 10} more*`);
    }
    lines.push('');
  }

  // Version issues
  if (results.versionIssues.length > 0) {
    lines.push('### Version Issues');
    results.versionIssues.slice(0, 10).forEach((issue) => {
      lines.push(`- **${issue.file}** - Found \`${issue.found}\`, expected \`${issue.expected}\``);
    });
    if (results.versionIssues.length > 10) {
      lines.push(`\n*... and ${results.versionIssues.length - 10} more*`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ============================================================================
// PURE FUNCTIONS - Prompt Partitioning
// ============================================================================

/**
 * Partition an array into chunks of at most `chunkSize` elements.
 * @pure
 * @param {Array} files - Array to split
 * @param {number} chunkSize - Maximum elements per chunk
 * @returns {Array[]} Array of chunks
 */
export function partitionFiles(files, chunkSize) {
  if (!Array.isArray(files) || files.length === 0) return [];
  const chunks = [];
  for (let i = 0; i < files.length; i += chunkSize) {
    chunks.push(files.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Build the prompt context strings for a single partition.
 * Returns the doc-file list string and broken-refs string, both already
 * size-bounded so the resulting prompt stays within MAX_PROMPT_CHARS.
 *
 * @pure
 * @param {string[]} partFiles - Relative doc-file paths in this partition
 * @param {Object[]} brokenLinks - All broken-link issues (full set); each has {file, line, link}
 * @param {number} partIndex - 0-based partition index
 * @param {number} totalParts - Total number of partitions
 * @returns {{ docFilesList: string, brokenRefsList: string, header: string }}
 */
export function buildPartitionContext(partFiles, brokenLinks, partIndex, totalParts) {
  const docFilesList = partFiles.join(', ');

  // Filter broken links to those whose SOURCE file is in this partition
  const matchingBroken = brokenLinks.filter((l) => {
    const f = l.file || String(l);
    return partFiles.some((pf) => f.endsWith(pf) || pf.endsWith(f.replace(/^.*[/\\]/, '')));
  });

  // Format as "source:line → target" so the AI knows WHAT is broken and WHERE,
  // not which files happen to contain broken links (which all exist).
  const formattedPairs = matchingBroken.map((l) => `${l.file}:${l.line} → ${l.link}`);

  // Deduplicate and cap
  const uniquePairs = [...new Set(formattedPairs)];
  const cappedPairs = uniquePairs.slice(0, MAX_ISSUES_PER_PROMPT);
  const suffix =
    uniquePairs.length > MAX_ISSUES_PER_PROMPT
      ? `, ... and ${uniquePairs.length - MAX_ISSUES_PER_PROMPT} more`
      : '';
  const brokenRefsList = cappedPairs.length > 0 ? cappedPairs.join(', ') + suffix : 'none';

  const header =
    totalParts > 1
      ? `[Partition ${partIndex + 1} of ${totalParts} — analyse ONLY the files listed below]`
      : '';

  return { docFilesList, brokenRefsList, header };
}

// ============================================================================
// PURE FUNCTIONS - AI Response Quality
// ============================================================================

/**
 * Minimum ratio of flagged references that should be addressed in the AI response
 * for it to be considered high-quality.
 */
export const MIN_COVERAGE_RATIO = 0.5;

/**
 * Validate that an AI response meaningfully addresses the flagged broken references.
 * Returns a quality assessment without performing any I/O.
 *
 * @pure
 * @param {string} aiResponse - Raw AI response text
 * @param {string[]} flaggedItems - The "source:line → target" pairs sent to the AI
 * @returns {{ adequate: boolean, reason: string, coverage: number }}
 */
export function validateAiResponseQuality(aiResponse, flaggedItems) {
  if (!aiResponse || typeof aiResponse !== 'string' || aiResponse.trim().length === 0) {
    return { adequate: false, reason: 'empty_response', coverage: 0 };
  }

  // Generic catch-all responses (< 200 chars) that contain no per-item analysis
  if (aiResponse.trim().length < 200 && flaggedItems.length > 0) {
    return { adequate: false, reason: 'too_short', coverage: 0 };
  }

  if (flaggedItems.length === 0) {
    return { adequate: true, reason: 'no_items_to_cover', coverage: 1 };
  }

  // Check how many flagged items have a corresponding entry in the response.
  // An item is "addressed" if its broken target (the part after →) appears in the response.
  const addressed = flaggedItems.filter((item) => {
    const target = item.includes(' → ') ? item.split(' → ')[1].trim() : item;
    return aiResponse.includes(target);
  });

  const coverage = addressed.length / flaggedItems.length;
  if (coverage < MIN_COVERAGE_RATIO) {
    return {
      adequate: false,
      reason: 'low_coverage',
      coverage,
    };
  }

  return { adequate: true, reason: 'ok', coverage };
}

// ============================================================================
// STEP 2 ANALYZER - Impure Wrapper
// ============================================================================

/**
 * Step 2 analyzer for documentation consistency
 */
export class Step2ConsistencyAnalyzer {
  static stepKind = STEP_KIND.PROJECT;

  constructor(options = {}) {
    this.fileOps = options.fileOps || new FileOperations();
    this.backlog = options.backlog || new Backlog();
    this.aiHelper = options.aiHelper || new AiHelper({ promptsDir: options.promptsDir || null });
    this.aiCache = options.aiCache || new AiCache();
    this.techStack = options.techStack || new TechStackDetector();
  }

  /**
   * Execute Step 2 consistency analysis
   * @param {string} projectRoot - Project root directory
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Analysis result
   */
  async execute(projectRoot, options = {}) {
    try {
      logger.step('Step 2: Documentation Consistency Analysis');

      // Phase 1: Discover documentation files
      const docFiles = await this.discoverDocumentationFiles(projectRoot);
      if (docFiles.length === 0) {
        logger.info('No documentation files found - skipping consistency check');
        return { success: true, skipped: true, reason: 'no_docs' };
      }

      logger.info(`Found ${docFiles.length} documentation files`);

      // Phase 2: Load expected version
      const expectedVersion = await this.getExpectedVersion(projectRoot);
      logger.info(`Expected version: ${expectedVersion || 'not found'}`);

      // Phase 3: Check version consistency
      const versionIssues = await this.checkVersions(docFiles, expectedVersion);
      logger.info(`Version check: ${versionIssues.length} issue(s) found`);

      // Phase 4: Check file references
      const existingFiles = await this.buildFileIndex(projectRoot);
      const brokenLinks = await this.checkLinks(docFiles, existingFiles, projectRoot);
      logger.info(`Link check: ${brokenLinks.length} broken link(s) found`);

      // Phase 5: Generate report
      const totalIssues = versionIssues.length + brokenLinks.length;
      const results = {
        filesChecked: docFiles.length,
        totalIssues,
        brokenLinks,
        versionIssues,
      };

      const report = formatConsistencyReport(results);
      await this.backlog.saveStepSummary(2, 'Consistency Analysis', report);

      // Phase 6: AI-powered consistency analysis (partitioned to avoid prompt-size timeouts)
      const aiAvailable = await this.aiHelper.initialize();
      if (aiAvailable) {
        await this.aiCache.init();
        const language = options.language || (await this.detectLanguage(projectRoot));

        // Load YAML prompt config and optional project-kind role overlay once
        let parsedYaml = null;
        let roleOverride = '';
        try {
          const yamlContent = await this.fileOps.readFile(AI_HELPERS_PATH);
          parsedYaml = yaml.load(yamlContent);
        } catch {
          /* YAML unavailable, will use fallback builder */
        }
        try {
          const pkYaml = await this.fileOps.readFile(AI_PROJECT_KINDS_PATH);
          const parsedPk = yaml.load(pkYaml);
          const pk = buildProjectKindPrompt(
            parsedPk,
            options?.projectKind ?? 'default',
            'code_reviewer'
          );
          if (pk?.role) roleOverride = pk.role;
        } catch {
          /* optional */
        }

        // Partition documentation files to keep each prompt under MAX_PROMPT_CHARS
        const relDocFiles = docFiles.map((f) => path.relative(projectRoot, f));
        const partitions = partitionFiles(relDocFiles, PARTITION_SIZE);
        const totalParts = partitions.length;
        logger.info(
          `[step_02] Running AI analysis in ${totalParts} partition(s) of ≤${PARTITION_SIZE} files`
        );

        const aiParts = [];
        for (let i = 0; i < totalParts; i++) {
          const partFiles = partitions[i];
          const { docFilesList, brokenRefsList, header } = buildPartitionContext(
            partFiles,
            brokenLinks,
            i,
            totalParts
          );

          let prompt;
          if (parsedYaml) {
            try {
              prompt = buildYamlStepPrompt(parsedYaml, 'step2_consistency_prompt', {
                project_name: projectRoot,
                project_description: options.projectDescription || '',
                primary_language: language,
                change_scope: options.scope || '',
                doc_count: String(docFiles.length),
                modified_count: String(partFiles.length),
                broken_refs_content: brokenRefsList,
                doc_files: docFilesList,
              });
              if (prompt && roleOverride) {
                prompt = `[Project-Kind Role: ${roleOverride}]\n\n${prompt}`;
              }
              if (prompt && header) {
                prompt = `${header}\n\n${prompt}`;
              }
            } catch {
              prompt = null;
            }
          }

          if (!prompt) {
            prompt = buildConsistencyPrompt({
              docDirectory: projectRoot,
              docFiles: partFiles,
              scanResults: results,
              projectInfo: { project_name: projectRoot },
            });
            if (header) prompt = `${header}\n\n${prompt}`;
          }

          // Safety cap: hard-truncate if still over limit
          if (prompt.length > MAX_PROMPT_CHARS) {
            logger.warn(
              `[step_02] Partition ${i + 1}: prompt truncated ${prompt.length} → ${MAX_PROMPT_CHARS} chars`
            );
            prompt = prompt.substring(0, MAX_PROMPT_CHARS) + '\n\n...(truncated for length)';
          }

          // Build file-content hash entries from the actual doc files in this partition.
          // Scanning results (broken refs, version issues) are fully derived from file
          // content, so hashing file content captures all meaningful prompt inputs.
          const fileHashEntries = await Promise.all(
            partFiles.map(async (relPath) => {
              try {
                const raw = await this.fileOps.readFile(`${projectRoot}/${relPath}`);
                return `${relPath}:${raw}`;
              } catch {
                return `${relPath}:`; // unreadable — include path with empty content
              }
            })
          );
          // Use 'documentation_expert' persona: Step 2 performs documentation consistency
          // analysis (cross-references, version sync, terminology), not code quality review.
          // The YAML prompt template (step2_consistency_prompt) also defines a documentation
          // specialist role — both layers must agree to avoid misleading prompt logs.
          const aiResult = await this.aiCache.withFileChangeGuard(
            `step_02_part${i}of${totalParts}`,
            fileHashEntries,
            () => this.aiHelper.executeRequest(prompt, { persona: 'documentation_expert' })
          );
          const aiContent = aiResult?.content ?? '';

          // Validate response quality; warn if the model gave a generic non-structured reply
          const partitionBrokenRefs =
            brokenRefsList !== 'none'
              ? brokenRefsList.split(', ').filter((s) => s.includes(' → '))
              : [];
          const quality = validateAiResponseQuality(aiContent, partitionBrokenRefs);
          if (!quality.adequate) {
            logger.warn(
              `[step_02] Partition ${i + 1}: AI response quality low` +
                ` (reason=${quality.reason}, coverage=${(quality.coverage * 100).toFixed(0)}%).` +
                ' Consider re-running this partition.'
            );
          }

          if (aiContent) {
            aiParts.push(
              totalParts > 1 ? `### Partition ${i + 1} of ${totalParts}\n\n${aiContent}` : aiContent
            );
          }
        }

        if (aiParts.length > 0) {
          const merged = aiParts.join('\n\n---\n\n');
          const enrichedReport = `${report}\n\n---\n\n## AI Recommendations\n\n${merged}`;
          await this.backlog.saveStepSummary(2, 'Consistency Analysis', enrichedReport);
        }
      } else {
        logger.warn('AI helper not available - skipping AI consistency analysis');
      }

      if (totalIssues === 0) {
        logger.success('Step 2 completed - no issues found');
      } else {
        logger.warn(`Step 2 completed - ${totalIssues} issue(s) found`);
      }

      return {
        success: true,
        ...results,
      };
    } catch (error) {
      logger.error(`Step 2 failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Discover documentation files in project
   * @param {string} projectRoot - Project root directory
   * @returns {Promise<string[]>} Array of documentation file paths
   */
  async discoverDocumentationFiles(projectRoot) {
    const patterns = ['**/*.md', '**/README*', '**/CHANGELOG*', '**/CONTRIBUTING*'];
    const exclude = [
      'node_modules',
      '.git',
      'dist',
      'build',
      'coverage',
      'venv',
      '.venv',
      'env',
      '.workflow_core',
      '.workflow_fspec',
      '.ai_workflow/logs',
    ];

    const files = [];
    for (const pattern of patterns) {
      try {
        const found = await this.fileOps.glob(pattern, {
          cwd: projectRoot,
          ignore: exclude.map((dir) => `**/${dir}/**`),
          absolute: true,
        });
        files.push(...found);
      } catch {
        // Pattern not found, continue
      }
    }

    return [...new Set(files)]; // Remove duplicates
  }

  /**
   * Get expected version from the project.
   *
   * Resolution order:
   *   1. `package.json` → `version` field (Node.js projects)
   *   2. `.workflow-config.yaml` → `project.version` field (all project types)
   *
   * @param {string} projectRoot - Project root directory
   * @returns {Promise<string|null>} Detected version string, or null if not found
   */
  async getExpectedVersion(projectRoot) {
    // Try package.json first
    try {
      const content = await this.fileOps.readFile(`${projectRoot}/package.json`);
      const pkg = JSON.parse(content);
      if (pkg.version) return pkg.version;
    } catch {
      // Fall through to workflow config
    }

    // Fall back to .workflow-config.yaml
    try {
      const content = await this.fileOps.readFile(`${projectRoot}/.workflow-config.yaml`);
      const config = yaml.load(content);
      return config?.project?.version || null;
    } catch {
      return null;
    }
  }

  /**
   * Check version consistency in documentation
   * @param {string[]} docFiles - Documentation file paths
   * @param {string} expectedVersion - Expected version
   * @returns {Promise<Object[]>} Version issues
   */
  async checkVersions(docFiles, expectedVersion) {
    if (!expectedVersion) {
      return [];
    }

    const fileVersions = [];

    for (const file of docFiles) {
      try {
        const content = await this.fileOps.readFile(file);
        const versions = extractVersions(content);

        if (versions.length > 0) {
          fileVersions.push({ file, versions });
        }
      } catch {
        // File read error, skip
      }
    }

    const result = checkVersionConsistency(fileVersions, expectedVersion);
    return result.issues;
  }

  /**
   * Build file index for link validation
   * @param {string} projectRoot - Project root directory
   * @returns {Promise<Set>} Set of existing file paths
   */
  async buildFileIndex(projectRoot) {
    const exclude = [
      'node_modules',
      '.git',
      'dist',
      'build',
      'coverage',
      'venv',
      '.venv',
      'env',
      '.workflow_core',
      '.workflow_fspec',
    ];
    const ignoreList = exclude.map((dir) => `**/${dir}/**`);

    // Two passes: regular entries + dotfile directories (e.g. .github/, .husky/)
    // fs.glob excludes dotfile entries by default, so a separate pass is required.
    const [files, dotFiles] = await Promise.all([
      this.fileOps.glob('**/*', { cwd: projectRoot, ignore: ignoreList, absolute: true }),
      this.fileOps.glob('.*/**/*', { cwd: projectRoot, ignore: ignoreList, absolute: true }),
    ]);

    const allFiles = [...new Set([...files, ...dotFiles])];

    // Build Set of both file paths and all their ancestor directories (down to projectRoot),
    // so that directory link targets (e.g. ".github/scripts/") resolve as existing.
    const fileSet = new Set(allFiles);
    if (projectRoot) {
      for (const filePath of allFiles) {
        let dir = path.dirname(filePath);
        while (dir.length > projectRoot.length) {
          fileSet.add(dir);
          dir = path.dirname(dir);
        }
      }
    }

    return fileSet;
  }

  /**
   * Check links in documentation files
   * @param {string[]} docFiles - Documentation file paths
   * @param {Set} existingFiles - Set of existing files
   * @param {string} _projectRoot - Project root directory (reserved for future use)
   * @returns {Promise<Object[]>} Broken link issues
   */
  async checkLinks(docFiles, existingFiles, _projectRoot) {
    const allIssues = [];

    for (const file of docFiles) {
      try {
        const content = await this.fileOps.readFile(file);
        const links = extractLinks(content);
        const issues = validateFileReferences(links, existingFiles, file);
        allIssues.push(...issues);
      } catch {
        // File read error, skip
      }
    }

    return allIssues;
  }

  async detectLanguage(projectRoot) {
    try {
      const detection = await this.techStack.detectTechStack(projectRoot);
      return detection.primaryLanguage || 'javascript';
    } catch {
      return 'javascript';
    }
  }
}

export default Step2ConsistencyAnalyzer;
