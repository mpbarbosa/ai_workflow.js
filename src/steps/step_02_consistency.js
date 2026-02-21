/**
 * Step 2: Documentation Consistency Analysis
 * @version 2.0.0
 * @description Check documentation for broken references and consistency issues
 * @module steps/step_02_consistency
 * Part of: AI Workflow Automation (Phase 9)
 */

import { STEP_KIND } from './step_contract.js';
import logger from '../core/logger.js';
import { FileOperations } from '../lib/file_operations.js';
import { Backlog } from '../lib/backlog.js';
import yaml from 'js-yaml';
import { AiHelper } from '../lib/ai_helpers.js';
import { AiCache } from '../lib/ai_cache.js';
import { buildConsistencyPrompt } from '../lib/ai_prompt_builder.js';

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
 * Normalize file path for comparison
 * @pure
 * @param {string} path - File path
 * @param {string} baseDir - Base directory
 * @returns {string} Normalized path
 */
export function normalizeFilePath(path, baseDir = '.') {
  // Remove anchor fragments
  const withoutAnchor = path.split('#')[0];

  // Remove leading ./
  const cleaned = withoutAnchor.replace(/^\.\//, '');

  // Resolve relative to base
  if (baseDir && baseDir !== '.') {
    return `${baseDir}/${cleaned}`.replace(/\/+/g, '/');
  }

  return cleaned;
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
    this.aiHelper = options.aiHelper || new AiHelper();
    this.aiCache = options.aiCache || new AiCache();
  }

  /**
   * Execute Step 2 consistency analysis
   * @param {string} projectRoot - Project root directory
   * @param {Object} _options - Execution options (reserved for future use)
   * @returns {Promise<Object>} Analysis result
   */
  async execute(projectRoot, _options = {}) {
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

      // Phase 6: AI-powered consistency analysis
      const aiAvailable = await this.aiHelper.initialize();
      if (aiAvailable) {
        await this.aiCache.init();
        const prompt = buildConsistencyPrompt({ docDirectory: projectRoot });
        const cacheKey = `step_02|${projectRoot}|${docFiles.length}|${totalIssues}`;
        await this.aiCache.withCache(prompt, cacheKey, () =>
          this.aiHelper.executeRequest(prompt, { persona: 'code_quality_analyst' })
        );
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
    const exclude = ['node_modules', '.git', 'dist', 'build', 'coverage'];

    const files = [];
    for (const pattern of patterns) {
      try {
        const found = await this.fileOps.glob(pattern, {
          cwd: projectRoot,
          ignore: exclude.map((dir) => `**/${dir}/**`),
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
    const patterns = ['**/*'];
    const exclude = ['node_modules', '.git', 'dist', 'build', 'coverage'];

    const files = await this.fileOps.glob(patterns[0], {
      cwd: projectRoot,
      ignore: exclude.map((dir) => `**/${dir}/**`),
    });

    return new Set(files);
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
}

export default Step2ConsistencyAnalyzer;
