/**
 * Step 16: AI-Powered Semantic Version Update
 * Updates semantic versions in modified files and project metadata.
 * Runs after analysis steps (10,12,13,14), before Git Finalization.
 * @module steps/step_16_version_update
 * @version 2.0.0
 */

import { FileOperations } from '../lib/file_operations.js';
import { Backlog } from '../lib/backlog.js';
import { STEP_KIND } from './step_contract.js';
import { Logger } from '../core/logger.js';
import { colors } from '../core/colors.js';
import { AiHelper } from '../lib/ai_helpers.js';
import { AiCache } from '../lib/ai_cache.js';
import {
  buildStructuredPrompt,
  injectProjectContext,
  AI_HELPERS_PATH,
} from '../lib/ai_prompt_builder.js';
import yaml from 'js-yaml';
import { execFile } from 'child_process';
import { join } from 'path';
import { readdirSync, statSync } from 'fs';

// Constants
export const SEMVER_PATTERN = /\d+\.\d+\.\d+(?:-[a-zA-Z0-9.]+)?/;
export const VERSION_PATTERN_REGEX =
  /(version|VERSION|Version|@version)["'\s:=]*(\d+\.\d+\.\d+(?:-[a-zA-Z0-9.]+)?)/gi;

export const BUMP_TYPES = Object.freeze({
  major: 'major',
  minor: 'minor',
  patch: 'patch',
});

export const METADATA_FILES = Object.freeze([
  'package.json',
  'pyproject.toml',
  'setup.py',
  'Cargo.toml',
  '.workflow-config.yaml',
]);

export const HEURISTIC_THRESHOLDS = Object.freeze({
  majorDeletions: 500,
  majorModifiedFiles: 20,
  minorInsertions: 100,
});

/** npm script name used for project-level version consistency validation */
export const CHECK_VERSION_SCRIPT = 'check:version';

// ============================================================================
// PURE FUNCTIONS - Version Parsing and Manipulation
// ============================================================================

/**
 * Extract version number from string
 * @param {string} input - String containing version
 * @returns {string|null} - Version string (X.Y.Z) or null
 */
export function extractVersion(input) {
  const match = input.match(SEMVER_PATTERN);
  return match ? match[0] : null;
}

/**
 * Parse semantic version into components
 * @param {string} version - Version string (X.Y.Z or X.Y.Z-prerelease)
 * @returns {Object|null} - { major, minor, patch, prerelease } or null
 */
export function parseVersion(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9.]+))?$/);
  if (!match) return null;

  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4] || null,
  };
}

/**
 * Increment version based on bump type, preserving any prerelease suffix.
 * @param {string} version - Current version (X.Y.Z or X.Y.Z-prerelease)
 * @param {string} bumpType - Bump type (major|minor|patch)
 * @returns {string} - New version string
 */
export function incrementVersion(version, bumpType) {
  const parsed = parseVersion(version);
  if (!parsed) return version;

  const pre = parsed.prerelease ? `-${parsed.prerelease}` : '';
  switch (bumpType) {
    case BUMP_TYPES.major:
      return `${parsed.major + 1}.0.0${pre}`;
    case BUMP_TYPES.minor:
      return `${parsed.major}.${parsed.minor + 1}.0${pre}`;
    case BUMP_TYPES.patch:
      return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}${pre}`;
    default:
      return version;
  }
}

/**
 * Detect version patterns in text
 * @param {string} content - File content
 * @returns {Array<Object>} - Array of { line, version, match } objects
 */
export function detectVersionPatterns(content) {
  const lines = content.split('\n');
  const patterns = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const regex = new RegExp(VERSION_PATTERN_REGEX.source, 'gi');
    let match;

    while ((match = regex.exec(line)) !== null) {
      const version = extractVersion(match[0]);
      if (version) {
        patterns.push({
          line: i + 1,
          version,
          match: match[0],
        });
      }
    }
  }

  return patterns;
}

/**
 * Replace version in content
 * @param {string} content - File content
 * @param {string} oldVersion - Old version to replace
 * @param {string} newVersion - New version
 * @returns {string} - Updated content
 */
export function replaceVersion(content, oldVersion, newVersion) {
  // Use a global regex to replace all occurrences
  const regex = new RegExp(oldVersion.replace(/\./g, '\\.'), 'g');
  return content.replace(regex, newVersion);
}

// ============================================================================
// PURE FUNCTIONS - Service Worker Cache Name Support
// ============================================================================

/**
 * Pattern matching service worker files that define a CACHE_NAME constant.
 * Example: const CACHE_NAME = 'my-app-v1.0.0-20260101';
 * @constant {RegExp}
 */
export const SERVICE_WORKER_CACHE_PATTERN = /const\s+CACHE_NAME\s*=\s*['"][^'"]+['"]/;

/**
 * Detect whether a file is a service worker with a CACHE_NAME constant.
 * @param {string} content - File content
 * @returns {boolean}
 */
export function isServiceWorkerFile(content) {
  return SERVICE_WORKER_CACHE_PATTERN.test(content);
}

/**
 * Update CACHE_NAME in a service worker file with the new version and date.
 * Replaces the embedded version string and refreshes the date suffix to force
 * cache invalidation on next deployment.
 *
 * Input:  const CACHE_NAME = 'app-v0.9.0-alpha-20260101-abc1234';
 * Output: const CACHE_NAME = 'app-v0.11.0-alpha-20260223';
 *
 * @param {string} content - File content
 * @param {string} oldVersion - Old version string (e.g. '0.9.0-alpha')
 * @param {string} newVersion - New version string (e.g. '0.11.0-alpha')
 * @param {string} buildDate - Build date in YYYYMMDD format (e.g. '20260223')
 * @returns {string} - Updated content
 */
export function updateServiceWorkerCacheName(content, oldVersion, newVersion, buildDate) {
  const escaped = oldVersion.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(const\\s+CACHE_NAME\\s*=\\s*['"][^'"]*?-v)${escaped}[^'"]*(['"])`);
  return content.replace(regex, `$1${newVersion}-${buildDate}$2`);
}

// ============================================================================
// PURE FUNCTIONS - JS Version Config File Support
// ============================================================================

/**
 * Pattern matching JS version config files that export VERSION and BUILD_DATE constants.
 * Example: export const VERSION = '1.0.0'; export const BUILD_DATE = '2026-01-01';
 * @constant {RegExp}
 */
export const VERSION_CONFIG_FILE_PATTERN = /export\s+const\s+VERSION\s*=\s*['"][^'"]+['"]/;

/**
 * Detect whether a file is a JS version config file with VERSION + BUILD_DATE constants.
 * @param {string} content - File content
 * @returns {boolean}
 */
export function isVersionConfigFile(content) {
  return (
    VERSION_CONFIG_FILE_PATTERN.test(content) &&
    /export\s+const\s+BUILD_DATE\s*=\s*['"][^'"]+['"]/.test(content)
  );
}

/**
 * Replace VERSION and BUILD_DATE constants in a JS version config file.
 * @param {string} content - File content
 * @param {string} newVersion - New version string
 * @param {string} buildDate - New build date (YYYY-MM-DD)
 * @returns {string} - Updated content
 */
export function replaceVersionConfig(content, newVersion, buildDate) {
  let updated = content.replace(
    /(export\s+const\s+VERSION\s*=\s*)(['"])[^'"]+\2/,
    `$1$2${newVersion}$2`
  );
  updated = updated.replace(
    /(export\s+const\s+BUILD_DATE\s*=\s*)(['"])[^'"]+\2/,
    `$1$2${buildDate}$2`
  );
  return updated;
}

// ============================================================================
// PURE FUNCTIONS - Bump Type Determination
// ============================================================================

/**
 * Determine bump type using heuristics
 * @param {Object} stats - Change statistics
 * @param {number} stats.modifiedCount - Number of modified files
 * @param {number} stats.addedCount - Number of added files
 * @param {number} stats.deletedCount - Number of deleted files
 * @param {number} stats.insertions - Number of insertions
 * @param {number} stats.deletions - Number of deletions
 * @returns {string} - Bump type (major|minor|patch)
 */
export function determineHeuristicBumpType(stats) {
  const { modifiedCount, deletions, addedCount, insertions } = stats;

  // Major: Large deletions or many files modified (breaking changes)
  if (
    deletions > HEURISTIC_THRESHOLDS.majorDeletions ||
    modifiedCount > HEURISTIC_THRESHOLDS.majorModifiedFiles
  ) {
    return BUMP_TYPES.major;
  }

  // Minor: New files added or significant additions (new features)
  if (addedCount > 0 || insertions > HEURISTIC_THRESHOLDS.minorInsertions) {
    return BUMP_TYPES.minor;
  }

  // Patch: Small changes, documentation, bug fixes
  return BUMP_TYPES.patch;
}

/**
 * Parse AI bump recommendation
 * @param {string} aiResponse - AI analysis response
 * @returns {Object|null} - { bumpType, reasoning, confidence } or null
 */
export function parseAiBumpRecommendation(aiResponse) {
  // Extract bump type
  const bumpMatch = aiResponse.match(/Bump Type:\s*(major|minor|patch)/i);
  const bumpType = bumpMatch ? bumpMatch[1].toLowerCase() : null;

  if (!bumpType) {
    // Try alternative pattern: "recommend(ed) ... patch"
    const altMatch = aiResponse.match(/recommend.*\b(major|minor|patch)\b/i);
    if (altMatch) {
      return {
        bumpType: altMatch[1].toLowerCase(),
        reasoning: 'Extracted from recommendation text',
        confidence: 'medium',
      };
    }
    // Bare one-word response (e.g. model complied with "reply with one word")
    const bare = aiResponse.trim().toLowerCase();
    if (['major', 'minor', 'patch'].includes(bare)) {
      return { bumpType: bare, reasoning: '', confidence: 'medium' };
    }
    return null;
  }

  // Extract reasoning
  const reasoningMatch = aiResponse.match(/Reasoning:\s*(.+?)(?=\n\n|Confidence:|$)/is);
  const reasoning = reasoningMatch ? reasoningMatch[1].trim() : '';

  // Extract confidence
  const confidenceMatch = aiResponse.match(/Confidence:\s*(high|medium|low)/i);
  const confidence = confidenceMatch ? confidenceMatch[1].toLowerCase() : 'medium';

  return { bumpType, reasoning, confidence };
}

/**
 * Build AI prompt for version bump analysis
 * @param {Object} context - Analysis context
 * @param {Array<string>} context.modifiedFiles - List of modified files
 * @param {Object} context.gitStats - Git statistics
 * @param {string} context.preAnalysis - Pre-analysis results (optional)
 * @returns {string} - Formatted AI prompt
 */
export function buildVersionBumpPrompt(context) {
  const { modifiedFiles, gitStats, preAnalysis } = context;

  const fileList = modifiedFiles
    .slice(0, 20)
    .map((f) => `  - ${f}`)
    .join('\n');
  const moreFiles =
    modifiedFiles.length > 20 ? `\n  ... and ${modifiedFiles.length - 20} more files` : '';

  return `You are a Version Manager and Semantic Versioning Expert. Analyze the changes and determine the appropriate version bump type.

# Version Bump Analysis Context

## Git Changes
${gitStats.summary || 'No statistics available'}

## Modified Files
${fileList}${moreFiles}

${preAnalysis ? `## Pre-Analysis Results\n${preAnalysis}\n` : ''}

Based on this context, determine the semantic version bump type:
- **MAJOR (X.0.0)**: Breaking changes, API modifications, removed features
- **MINOR (X.Y.0)**: New features, enhancements, additive changes
- **PATCH (X.Y.Z)**: Bug fixes, documentation, refactoring, tests

Output format:
Bump Type: [major|minor|patch]
Reasoning: [2-3 sentence explanation]
Confidence: [high|medium|low]`;
}

/**
 * Calculate version update statistics
 * @param {Array<Object>} updates - Array of file update results
 * @returns {Object} - Statistics { updated, skipped, failed }
 */
export function calculateUpdateStats(updates) {
  return updates.reduce(
    (acc, update) => {
      if (update.success) acc.updated++;
      else if (update.skipped) acc.skipped++;
      else acc.failed++;
      return acc;
    },
    { updated: 0, skipped: 0, failed: 0 }
  );
}

/**
 * Format version update report
 * @param {Object} data - Report data
 * @param {string} data.oldVersion - Original version
 * @param {string} data.newVersion - New version
 * @param {string} data.bumpType - Bump type used
 * @param {Object} data.stats - Update statistics
 * @param {Array<Object>} data.updates - List of file updates
 * @param {string} data.timestamp - ISO timestamp
 * @returns {string} - Formatted markdown report
 */
export function formatVersionUpdateReport(data) {
  const { oldVersion, newVersion, bumpType, stats, updates, timestamp } = data;

  let updatesSection = '';
  if (updates.length > 0) {
    updatesSection = '\n## Files Updated\n\n';
    updates
      .filter((u) => u.success)
      .forEach((u) => {
        updatesSection += `- ✅ ${u.file}\n`;
      });

    if (stats.failed > 0) {
      updatesSection += '\n## Failed Updates\n\n';
      updates
        .filter((u) => !u.success && !u.skipped)
        .forEach((u) => {
          updatesSection += `- ❌ ${u.file}: ${u.error}\n`;
        });
    }
  }

  return `**Step 16: Semantic Version Update Report**

**Status**: ✅ Completed
**Date**: ${timestamp}

## Version Update

- **Previous Version**: ${oldVersion}
- **New Version**: ${newVersion}
- **Bump Type**: ${bumpType}

## Update Statistics

- **Files Updated**: ${stats.updated}
- **Files Skipped**: ${stats.skipped}
- **Files Failed**: ${stats.failed}
${updatesSection}

---

## Metadata

- **Step Version**: 2.0.0
- **Analysis Method**: Heuristic-based
- **Bump Type**: ${bumpType.toUpperCase()}

## Next Steps

1. Review version changes in modified files
2. Commit version updates with conventional commit message
3. Create git tag for new version (if applicable)
4. Update CHANGELOG.md with version history
`;
}

// ============================================================================
// STEP16VERSIONUPDATE - Impure Wrapper Class
// ============================================================================

/**
 * Recursively collect files in a directory that contain an exact version string.
 *
 * Skips: node_modules, .git, dist, build, coverage, .ai_workflow, and binary-like extensions.
 *
 * @pure - no side effects; takes an explicit readFn for testability
 * @param {string} dir - Absolute directory path to search
 * @param {string} version - Version string to search for
 * @param {Function} readFn - (path: string) => string  (sync read)
 * @param {Function} [readdirFn] - Optional override for readdirSync
 * @param {Function} [statFn] - Optional override for statSync
 * @returns {Array<string>} Absolute file paths that contain the version string
 */
export function scanFilesContainingVersion(
  dir,
  version,
  readFn,
  readdirFn = readdirSync,
  statFn = statSync
) {
  const SKIP_DIRS = new Set([
    'node_modules',
    '.git',
    'dist',
    'build',
    'coverage',
    '.ai_workflow',
    '.workflow_core',
    '.workflow_fspec',
    '__pycache__',
  ]);
  const SKIP_EXTS = new Set([
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.svg',
    '.ico',
    '.woff',
    '.woff2',
    '.ttf',
    '.eot',
    '.zip',
    '.tar',
    '.gz',
    '.lock',
    '.min.js',
    '.min.css',
  ]);

  const results = [];

  function walk(current) {
    let entries;
    try {
      entries = readdirFn(current);
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = join(current, entry);
      let stat;
      try {
        stat = statFn(fullPath);
      } catch {
        continue;
      }

      if (stat.isDirectory()) {
        if (!SKIP_DIRS.has(entry)) walk(fullPath);
        continue;
      }

      // Skip binary/undesired extensions
      const lower = entry.toLowerCase();
      if (SKIP_EXTS.has(lower.slice(lower.lastIndexOf('.')))) continue;
      // Skip combined extensions like .min.js
      if (lower.endsWith('.min.js') || lower.endsWith('.min.css')) continue;

      let content;
      try {
        content = readFn(fullPath);
      } catch {
        continue;
      }
      if (typeof content === 'string' && content.includes(version)) {
        results.push(fullPath);
      }
    }
  }

  walk(dir);
  return results;
}

// ============================================================================
// PURE FUNCTIONS - Consistency Check Auto-Fix
// ============================================================================

/**
 * Parse the text output of a `check:version` script (shell or JS) and extract
 * the version inconsistencies it reports.
 *
 * Recognises common reporting patterns (line by line):
 *   "mismatch in <file>"            → track current file
 *   "Checking <file>"               → track current file
 *   "Found: <version>"              → stale version for current file
 *   "Outdated: <version>"           → stale version for current file
 *   "<file> not found"              → missing file
 *
 * @pure - deterministic, no side effects
 * @param {string} output - stdout/stderr from the check:version script
 * @returns {Array<{file: string, foundVersions: string[], missingFile: boolean}>}
 */
export function parseConsistencyCheckOutput(output) {
  if (!output || typeof output !== 'string') return [];

  const issues = new Map(); // file → {file, foundVersions: Set, missingFile}
  const ensureEntry = (file) => {
    if (!issues.has(file)) {
      issues.set(file, { file, foundVersions: new Set(), missingFile: false });
    }
    return issues.get(file);
  };

  const lines = output.split('\n');
  let currentFile = null;

  for (const line of lines) {
    // "mismatch in <file>" — sets the current file in scope
    const mismatchMatch = line.match(/mismatch\s+in\s+([\w./\\-]+(?:\.\w+)?)/i);
    if (mismatchMatch) {
      currentFile = mismatchMatch[1];
      ensureEntry(currentFile);
      continue;
    }

    // "Checking <file>" — tracks current file (without yet flagging it)
    const checkingMatch = line.match(/Checking\s+([\w./\\-]+(?:\.\w+)?)/i);
    if (checkingMatch) {
      currentFile = checkingMatch[1];
      continue;
    }

    // "<file> not found" — missing file (the file name precedes "not found")
    const notFoundMatch = line.match(/([\w./\\-]+(?:\.\w+)?)\s+not\s+found/i);
    if (notFoundMatch) {
      const entry = ensureEntry(notFoundMatch[1]);
      entry.missingFile = true;
      currentFile = notFoundMatch[1];
      continue;
    }

    // "Found: <version>" — stale version associated with currentFile
    const foundMatch = line.match(/Found:\s*(\d+\.\d+\.\d+(?:-[a-zA-Z0-9.]+)?)/i);
    if (foundMatch && currentFile) {
      ensureEntry(currentFile).foundVersions.add(foundMatch[1]);
      continue;
    }

    // "Outdated: <version>" — stale version associated with currentFile
    const outdatedMatch = line.match(/Outdated:\s*(\d+\.\d+\.\d+(?:-[a-zA-Z0-9.]+)?)/i);
    if (outdatedMatch && currentFile) {
      ensureEntry(currentFile).foundVersions.add(outdatedMatch[1]);
    }
  }

  // Convert Sets to arrays for serialisability
  return Array.from(issues.values()).map((e) => ({
    file: e.file,
    foundVersions: Array.from(e.foundVersions),
    missingFile: e.missingFile,
  }));
}

/**
 * Generate the content for a missing JS file that declares a named version constant.
 *
 * Example output for constantName='GUIA_VERSION', version='0.11.7-alpha':
 *   export const GUIA_VERSION = '0.11.7-alpha';
 *
 * @pure - deterministic, no side effects
 * @param {string} constantName - Name of the exported constant (e.g. 'GUIA_VERSION')
 * @param {string} version - Version string to embed
 * @returns {string} File content (UTF-8)
 */
export function buildDefaultVersionConstant(constantName, version) {
  const safeName = String(constantName).replace(/[^A-Za-z0-9_]/g, '_');
  const safeVersion = String(version);
  return `/**
 * Auto-generated by ai_workflow step_16 version update.
 * Update this constant whenever the project version changes.
 */
export const ${safeName} = '${safeVersion}';
`;
}

/**
 * Derive a plausible JS constant name from a file path.
 * e.g. 'src/config/defaults.js' → 'DEFAULTS_VERSION'
 *      'src/config/version.js'  → 'VERSION'
 *
 * @pure
 * @param {string} filePath - Relative file path
 * @returns {string} Constant name in UPPER_SNAKE_CASE
 */
export function deriveVersionConstantName(filePath) {
  const base = filePath
    .split('/')
    .pop()
    .replace(/\.[^.]+$/, '')
    .toUpperCase();
  // If the basename already looks like a version-related word, use it directly
  if (/^VERSION$/.test(base)) return 'VERSION';
  return `${base}_VERSION`;
}

/**
 * Step 16: AI-Powered Semantic Version Update
 * Updates versions in modified files and project metadata.
 */
export class Step16VersionUpdate {
  static stepKind = STEP_KIND.CONTEXT;

  /**
   * Create a new Step 16 version updater
   * @param {Object} options - Configuration options
   * @param {Object} options.fileOps - File operations instance
   * @param {Object} options.backlog - Backlog instance
   * @param {Object} options.logger - Logger instance
   * @param {boolean} options.dryRun - Whether to run in dry-run mode
   * @param {string} options.projectRoot - Project root directory
   */
  constructor(options = {}) {
    this.fileOps = options.fileOps || new FileOperations();
    this.backlog = options.backlog || new Backlog();
    this.logger = options.logger || new Logger();
    this.dryRun = options.dryRun || false;
    this.projectRoot = options.projectRoot || process.cwd();
    this.aiHelper = options.aiHelper || new AiHelper({ promptsDir: options.promptsDir });
    this.aiCache = options.aiCache || new AiCache();
  }

  /**
   * Execute version update step
   * @param {Object} context - Execution context
   * @param {Array<string>} context.modifiedFiles - List of modified files
   * @param {Object} context.gitStats - Git change statistics
   * @returns {Promise<Object>} - Execution result { success, oldVersion, newVersion, ... }
   */
  async execute(context = {}) {
    const startTime = Date.now();

    // Use projectRoot from context if provided (overrides constructor default)
    if (context.projectRoot) {
      this.projectRoot = context.projectRoot;
    }

    try {
      this.logger.step('Step 16: Version Update');
      if (this.dryRun) {
        this.logger.info('[DRY RUN] Version update preview:');
        this.logger.info('- Would detect current version in project files');
        this.logger.info('- Would determine appropriate bump type');
        this.logger.info('- Would update versions in modified files');
        return {
          success: true,
          dryRun: true,
          message: 'Version update dry run completed',
        };
      }

      const modifiedFiles = context.modifiedFiles || [];
      const gitStats = context.gitStats || {};

      if (modifiedFiles.length === 0) {
        this.logger.warn('Step 16: No modified files to process');

        await this.backlog.saveStepSummary(
          '16',
          'Version_Update',
          'Skipped: No modified files',
          '⏭️'
        );

        return {
          success: true,
          skipped: true,
          reason: 'no modified files',
        };
      }

      // Phase 1: Detect current version
      this.logger.info(`${colors.blue}Phase 1:${colors.reset} Detecting current version...`);
      const currentVersion = await this.detectCurrentVersion(modifiedFiles);

      if (!currentVersion) {
        this.logger.warn('No version found in project files');
        await this.backlog.saveStepSummary(
          '16',
          'Version_Update',
          'Skipped: No version found',
          '⏭️'
        );

        return {
          success: true,
          skipped: true,
          reason: 'no version found',
        };
      }

      this.logger.success(`Current version: ${currentVersion}`);

      // Phase 2: Determine bump type (heuristic + optional AI verification)
      this.logger.info(`${colors.blue}Phase 2:${colors.reset} Determining bump type...`);
      let bumpType = determineHeuristicBumpType(gitStats);
      this.logger.info(`Heuristic bump type: ${bumpType}`);

      // AI verification of bump type
      const aiAvailable = await this.aiHelper.initialize();
      if (aiAvailable) {
        try {
          await this.aiCache.init();
          const cats = gitStats.categories || {};
          const gitCtx = await this._gatherGitContext();

          // version_manager_prompt uses `role_prefix` (not `role`) and has no `task_template`,
          // so buildYamlStepPrompt produces a hollow prompt (empty role + empty task).
          // Build the prompt directly with real git data instead.
          let yamlExpertise = '';
          let yamlApproach = '';
          let yamlOutputFormat = '';
          try {
            const yamlContent = await this.fileOps.readFile(AI_HELPERS_PATH);
            const parsedYaml = yaml.load(yamlContent);
            const cfg = parsedYaml?.version_manager_prompt || {};
            yamlExpertise = cfg.specific_expertise || '';
            yamlApproach = cfg.approach || '';
            yamlOutputFormat = cfg.output_format || '';
          } catch {
            /* use generic strings below */
          }

          const role = `You are a Version Manager and Semantic Versioning Expert.
${yamlExpertise}`.trim();

          const task = `Determine the correct semantic version bump type for this project.

**Current version:** ${currentVersion}
**Heuristic recommendation:** ${bumpType}

**Change statistics:**
- Total modified files: ${modifiedFiles.length}
- Documentation files: ${cats.documentation || 0}
- Test files: ${cats.tests || 0}
- Code files: ${cats.code || 0}
- Config files: ${cats.config || 0}
- Insertions: ${gitCtx.insertions}, Deletions: ${gitCtx.deletions}

**Recent git log:**
${gitCtx.gitLog}

**Diff statistics:**
${gitCtx.diffSummary}

**Diff sample (first 80 lines):**
${gitCtx.diffSample}
${yamlOutputFormat}`.trim();

          const approach =
            yamlApproach ||
            `Review the git diff and change statistics to determine the minimum required semver bump.
Reply with ONLY one word: major, minor, or patch.`;

          const prompt = injectProjectContext(buildStructuredPrompt({ role, task, approach }), {});
          const cacheKey = `step_16|${currentVersion}|${bumpType}|${modifiedFiles.length}|${gitCtx.insertions}|${gitCtx.deletions}`;
          const response = await this.aiCache.withCache(prompt, cacheKey, () =>
            this.aiHelper.executeRequest(prompt, { persona: 'devops_engineer' })
          );
          // Parse AI response using structured extractor (handles both
          // "Bump Type: patch" and "Recommended bump type: patch" formats)
          const aiRec = parseAiBumpRecommendation(response?.content || '');
          if (aiRec?.bumpType) {
            this.logger.info(
              `AI refined bump type: ${aiRec.bumpType} (was: ${bumpType}, confidence: ${aiRec.confidence})`
            );
            bumpType = aiRec.bumpType;
          }
        } catch (err) {
          this.logger.warn(`AI bump type verification failed: ${err.message} — using heuristic`);
        }
      }

      // Phase 3: Calculate new version
      const newVersion = incrementVersion(currentVersion, bumpType);
      this.logger.info(
        `[VERSION BUMP] previous: ${currentVersion} → next: ${newVersion} (${bumpType})`
      );
      this.logger.success(`New version: ${currentVersion} → ${newVersion}`);

      // Phase 4: Update versions in files
      this.logger.info(`${colors.blue}Phase 3:${colors.reset} Updating versions in files...`);
      const extraFiles = context.versionConfig?.files || [];

      // Scan entire project for any file still referencing the old version,
      // so files like README.md or .github/copilot-instructions.md are not missed.
      const scannedFiles = await this._scanForVersionFiles(currentVersion);
      this.logger.info(
        `Version scan found ${scannedFiles.length} file(s) referencing ${currentVersion}`
      );

      const updates = await this.updateVersionsInFiles(modifiedFiles, currentVersion, newVersion, [
        ...extraFiles,
        ...scannedFiles,
      ]);

      // Phase 4b: Update JS version config files (VERSION + BUILD_DATE constants)
      const configFilesFromContext = context.versionConfig?.configFiles || [];
      const configFilesFromYaml = await this.loadVersionConfigFilesFromWorkflowConfig();
      const allConfigFiles = [...new Set([...configFilesFromContext, ...configFilesFromYaml])];
      if (allConfigFiles.length > 0) {
        this.logger.info(`${colors.blue}Phase 3b:${colors.reset} Updating version config files...`);
        const configUpdates = await this.updateVersionConfigFiles(allConfigFiles, newVersion);
        updates.push(...configUpdates);
        const configUpdated = configUpdates.filter((u) => u.success).length;
        if (configUpdated > 0) {
          this.logger.success(
            `Updated ${configUpdated} version config file(s) (VERSION + BUILD_DATE)`
          );
        }
      }

      const stats = calculateUpdateStats(updates);
      this.logger.success(
        `Updated ${stats.updated} files, skipped ${stats.skipped}, failed ${stats.failed}`
      );

      // Phase 4c: Update service worker cache names
      const swFilesFromContext = context.versionConfig?.serviceWorkerFiles || [];
      const swFilesFromYaml = await this.loadServiceWorkerFilesFromWorkflowConfig();
      const allSwFiles = [...new Set([...swFilesFromContext, ...swFilesFromYaml])];
      if (allSwFiles.length > 0) {
        this.logger.info(
          `${colors.blue}Phase 3c:${colors.reset} Updating service worker cache names...`
        );
        const swUpdates = await this.updateServiceWorkerFiles(
          allSwFiles,
          currentVersion,
          newVersion
        );
        updates.push(...swUpdates);
        const swUpdated = swUpdates.filter((u) => u.success).length;
        if (swUpdated > 0) {
          this.logger.success(`Updated ${swUpdated} service worker file(s) (CACHE_NAME)`);
        }
      }

      // Phase 4 (optional): Run project check:version script to verify consistency
      const consistencyCheck = await this.runVersionConsistencyCheck();
      if (consistencyCheck.ran) {
        if (consistencyCheck.exitCode === 0) {
          this.logger.success('Version consistency check passed ✅');
        } else {
          this.logger.warn(
            `Version consistency check reported issues (exit ${consistencyCheck.exitCode}) — attempting auto-fix...`
          );
          // Auto-fix: parse the checker output and correct stale/missing version files
          const fixResults = await this.autoFixConsistencyIssues(
            consistencyCheck.output,
            newVersion
          );
          const fixed = fixResults.filter((r) => r.action === 'updated' || r.action === 'created');
          const skipped = fixResults.filter((r) => r.action === 'skipped');
          if (fixed.length > 0) {
            this.logger.success(`Auto-fixed ${fixed.length} file(s) with stale version references`);
          }
          if (skipped.length > 0) {
            this.logger.warn(
              `${skipped.length} file(s) could not be auto-fixed (manual update may be needed)`
            );
          }
          // Re-run the check to confirm resolution
          const recheck = await this.runVersionConsistencyCheck();
          if (recheck.ran) {
            if (recheck.exitCode === 0) {
              this.logger.success('Version consistency check passed after auto-fix ✅');
            } else {
              this.logger.warn(
                `Version consistency check still reports issues after auto-fix:\n${recheck.output}`
              );
            }
          }
          // Merge fix results into updates for the report
          for (const fix of fixed) {
            updates.push({ file: fix.file, success: true, autoFixed: true });
          }
          consistencyCheck.autoFix = { results: fixResults, recheck };
        }
      }

      // Phase 5: Generate report
      const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
      const report = formatVersionUpdateReport({
        oldVersion: currentVersion,
        newVersion,
        bumpType,
        stats,
        updates,
        timestamp,
      });

      await this.backlog.saveStepSummary('16', 'Version_Update', report, '✅');

      this.logger.success('Step 16: Version update completed');

      return {
        success: true,
        oldVersion: currentVersion,
        newVersion,
        bumpType,
        stats,
        updates,
        consistencyCheck,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      this.logger.error(`Step 16 failed: ${error.message}`);

      await this.backlog.saveStepIssues('16', 'Version_Update', [
        {
          type: 'error',
          message: error.message,
          location: 'step_16_version_update',
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
   * Detect current version from project metadata files (I/O operation)
   * @param {Array<string>} _files - List of modified files (unused; searches metadata files)
   * @returns {Promise<string|null>} - Current version or null
   */
  async detectCurrentVersion(_files) {
    // Check metadata files in priority order
    for (const metaFile of METADATA_FILES) {
      const filePath = `${this.projectRoot}/${metaFile}`;
      try {
        const content = await this.fileOps.readFile(filePath);
        if (!content) continue;

        // package.json: parse JSON "version" field
        if (metaFile === 'package.json') {
          try {
            const pkg = JSON.parse(content);
            const v = extractVersion(pkg.version || '');
            if (v) return v;
          } catch {
            // fall through to pattern matching
          }
        }

        // pyproject.toml / setup.py / Cargo.toml / .workflow-config.yaml: regex scan
        const patterns = detectVersionPatterns(content);
        if (patterns.length > 0) return patterns[0].version;
      } catch {
        // file not found or unreadable — try next
      }
    }
    return null;
  }

  /**
   * Update versions in modified files and project metadata files (I/O operation)
   * @param {Array<string>} files - List of modified files (relative paths)
   * @param {string} oldVersion - Old version string
   * @param {string} newVersion - New version string
   * @param {Array<string>} [extraFiles=[]] - Additional project-declared version files
   * @returns {Promise<Array<Object>>} - Update results [{ file, success, skipped?, error? }]
   */
  async updateVersionsInFiles(files, oldVersion, newVersion, extraFiles = []) {
    const results = [];

    // Collect candidate paths: metadata files + modified files + project-declared extras
    const candidates = new Set();
    for (const metaFile of METADATA_FILES) {
      candidates.add(`${this.projectRoot}/${metaFile}`);
    }
    for (const f of files) {
      const abs = f.startsWith('/') ? f : `${this.projectRoot}/${f}`;
      candidates.add(abs);
    }
    for (const f of extraFiles) {
      const abs = f.startsWith('/') ? f : `${this.projectRoot}/${f}`;
      candidates.add(abs);
    }

    for (const filePath of candidates) {
      const relPath = filePath.replace(`${this.projectRoot}/`, '');
      try {
        const content = await this.fileOps.readFile(filePath);
        if (!content || !content.includes(oldVersion)) {
          results.push({ file: relPath, skipped: true });
          continue;
        }

        let updated;
        // For package.json update only the "version" field value
        if (filePath.endsWith('package.json')) {
          try {
            const pkg = JSON.parse(content);
            if (pkg.version === oldVersion || (pkg.version && pkg.version.includes(oldVersion))) {
              pkg.version = newVersion;
              updated = JSON.stringify(pkg, null, 2) + '\n';
            } else {
              updated = replaceVersion(content, oldVersion, newVersion);
            }
          } catch {
            updated = replaceVersion(content, oldVersion, newVersion);
          }
        } else {
          updated = replaceVersion(content, oldVersion, newVersion);
        }

        if (updated === content) {
          results.push({ file: relPath, skipped: true });
          continue;
        }

        if (!this.dryRun) {
          await this.fileOps.writeFile(filePath, updated);
        }
        results.push({ file: relPath, success: true });
      } catch (err) {
        const isNotFound =
          err.code === 'ENOENT' ||
          (err.message && err.message.toLowerCase().includes('no such file'));
        const isDirectory = err.code === 'EISDIR';
        if (isNotFound || isDirectory) {
          results.push({
            file: relPath,
            skipped: true,
            reason: isDirectory ? 'is a directory' : 'file not found',
          });
        } else {
          results.push({ file: relPath, success: false, error: err.message });
        }
      }
    }

    return results;
  }

  /**
   * Update JS version config files that export VERSION and BUILD_DATE constants.
   * This handles files like `src/config/version.js` that maintain both the
   * application version string and the build date as named exports.
   *
   * @param {Array<string>} configFilePaths - Paths to version config files (relative or absolute)
   * @param {string} newVersion - New version string
   * @param {string} [buildDate] - Build date (YYYY-MM-DD); defaults to today
   * @returns {Promise<Array<Object>>} - Update results [{ file, success, skipped?, error? }]
   */
  async updateVersionConfigFiles(configFilePaths, newVersion, buildDate) {
    const date = buildDate || new Date().toISOString().slice(0, 10);
    const results = [];

    for (const filePath of configFilePaths) {
      const abs = filePath.startsWith('/') ? filePath : `${this.projectRoot}/${filePath}`;
      const relPath = filePath.startsWith('/')
        ? filePath.replace(`${this.projectRoot}/`, '')
        : filePath;

      try {
        const content = await this.fileOps.readFile(abs);
        if (!content || !isVersionConfigFile(content)) {
          results.push({ file: relPath, skipped: true, reason: 'not a version config file' });
          continue;
        }

        const updated = replaceVersionConfig(content, newVersion, date);
        if (updated === content) {
          results.push({ file: relPath, skipped: true });
          continue;
        }

        if (!this.dryRun) {
          await this.fileOps.writeFile(abs, updated);
        }
        results.push({ file: relPath, success: true });
      } catch (err) {
        const isNotFound =
          err.code === 'ENOENT' ||
          (err.message && err.message.toLowerCase().includes('no such file'));
        const isDirectory = err.code === 'EISDIR';
        if (isNotFound || isDirectory) {
          results.push({
            file: relPath,
            skipped: true,
            reason: isDirectory ? 'is a directory' : 'file not found',
          });
        } else {
          results.push({ file: relPath, success: false, error: err.message });
        }
      }
    }

    return results;
  }

  /**
   * Update CACHE_NAME in service worker files with the new version and today's date.
   * Handles files listed under `version.service_worker_files` in .workflow-config.yaml
   * or passed via `context.versionConfig.serviceWorkerFiles`.
   *
   * @param {Array<string>} swFilePaths - Paths to service worker files (relative or absolute)
   * @param {string} oldVersion - Old version string
   * @param {string} newVersion - New version string
   * @param {string} [buildDate] - Date in YYYYMMDD format; defaults to today
   * @returns {Promise<Array<Object>>} - Update results [{ file, success, skipped?, error? }]
   */
  async updateServiceWorkerFiles(swFilePaths, oldVersion, newVersion, buildDate) {
    const date = (buildDate || new Date().toISOString().slice(0, 10)).replace(/-/g, '');
    const results = [];

    for (const filePath of swFilePaths) {
      const abs = filePath.startsWith('/') ? filePath : `${this.projectRoot}/${filePath}`;
      const relPath = filePath.startsWith('/')
        ? filePath.replace(`${this.projectRoot}/`, '')
        : filePath;

      try {
        const content = await this.fileOps.readFile(abs);
        if (!content || !isServiceWorkerFile(content)) {
          results.push({ file: relPath, skipped: true, reason: 'no CACHE_NAME found' });
          continue;
        }

        const updated = updateServiceWorkerCacheName(content, oldVersion, newVersion, date);
        if (updated === content) {
          results.push({ file: relPath, skipped: true });
          continue;
        }

        if (!this.dryRun) {
          await this.fileOps.writeFile(abs, updated);
        }
        results.push({ file: relPath, success: true });
      } catch (err) {
        const isNotFound =
          err.code === 'ENOENT' ||
          (err.message && err.message.toLowerCase().includes('no such file'));
        const isDirectory = err.code === 'EISDIR';
        if (isNotFound || isDirectory) {
          results.push({
            file: relPath,
            skipped: true,
            reason: isDirectory ? 'is a directory' : 'file not found',
          });
        } else {
          results.push({ file: relPath, success: false, error: err.message });
        }
      }
    }

    return results;
  }

  /**
   * Load service worker files declared in .workflow-config.yaml under version.service_worker_files.
   * @returns {Promise<Array<string>>} - List of relative file paths
   */
  async loadServiceWorkerFilesFromWorkflowConfig() {
    const configPath = join(this.projectRoot, '.workflow-config.yaml');
    try {
      const content = await this.fileOps.readFile(configPath);
      if (!content) return [];
      const config = yaml.load(content);
      const files = config?.version?.service_worker_files;
      return Array.isArray(files) ? files : [];
    } catch {
      return [];
    }
  }

  /**
   * Load version config files declared in .workflow-config.yaml under version.config_files.
   * @returns {Promise<Array<string>>} - List of relative file paths
   */
  async loadVersionConfigFilesFromWorkflowConfig() {
    const configPath = join(this.projectRoot, '.workflow-config.yaml');
    try {
      const content = await this.fileOps.readFile(configPath);
      if (!content) return [];
      const config = yaml.load(content);
      const files = config?.version?.config_files;
      return Array.isArray(files) ? files : [];
    } catch {
      return [];
    }
  }

  /**
   * Auto-fix version inconsistencies reported by a check:version script.
   *
   * Parses the script's text output to find which files contain stale versions
   * or are missing entirely, then:
   *  - Updates stale version strings in existing files
   *  - Creates missing JS version-constant files
   *
   * @param {string} consistencyOutput - stdout+stderr from the check:version script
   * @param {string} newVersion - The correct version to write
   * @returns {Promise<Array<{file: string, action: 'updated'|'created'|'skipped', error?: string}>>}
   */
  async autoFixConsistencyIssues(consistencyOutput, newVersion) {
    const issues = parseConsistencyCheckOutput(consistencyOutput);
    const results = [];

    for (const issue of issues) {
      const { file, foundVersions, missingFile } = issue;
      const absPath = file.startsWith('/') ? file : `${this.projectRoot}/${file}`;

      // Case 1: file reported as missing — create it if it looks like a JS version-constant file
      if (missingFile && !foundVersions.length) {
        const isJsFile = file.endsWith('.js') || file.endsWith('.mjs') || file.endsWith('.ts');
        if (isJsFile) {
          try {
            const constantName = deriveVersionConstantName(file);
            const content = buildDefaultVersionConstant(constantName, newVersion);
            if (!this.dryRun) {
              await this.fileOps.writeFile(absPath, content);
            }
            results.push({ file, action: 'created' });
            this.logger.success(`Created missing version constant file: ${file}`);
          } catch (err) {
            results.push({ file, action: 'skipped', error: err.message });
            this.logger.warn(`Could not create ${file}: ${err.message}`);
          }
        } else {
          results.push({
            file,
            action: 'skipped',
            error: 'non-JS missing file — manual fix needed',
          });
        }
        continue;
      }

      // Case 2: file exists but has stale version strings
      if (!foundVersions.length) {
        results.push({ file, action: 'skipped', error: 'no stale versions identified in output' });
        continue;
      }

      try {
        let content = await this.fileOps.readFile(absPath);
        if (!content) {
          results.push({ file, action: 'skipped', error: 'file unreadable or empty' });
          continue;
        }

        let changed = false;
        for (const staleVersion of foundVersions) {
          const updated = replaceVersion(content, staleVersion, newVersion);
          if (updated !== content) {
            content = updated;
            changed = true;
          }
        }

        if (!changed) {
          results.push({
            file,
            action: 'skipped',
            error: 'no replaceable version strings found in content',
          });
          continue;
        }

        if (!this.dryRun) {
          await this.fileOps.writeFile(absPath, content);
        }
        results.push({ file, action: 'updated' });
        this.logger.success(
          `Auto-fixed ${file}: replaced [${foundVersions.join(', ')}] → ${newVersion}`
        );
      } catch (err) {
        const isNotFound =
          err.code === 'ENOENT' ||
          (err.message && err.message.toLowerCase().includes('no such file'));
        const isDirectory = err.code === 'EISDIR';
        if (isNotFound || isDirectory) {
          results.push({
            file,
            action: 'skipped',
            error: isDirectory ? 'is a directory' : 'file not found',
          });
        } else {
          results.push({ file, action: 'skipped', error: err.message });
          this.logger.warn(`Auto-fix failed for ${file}: ${err.message}`);
        }
      }
    }

    return results;
  }

  /**
   * Run the project's check:version npm script (if present) to validate version consistency.
   * This is a best-effort check; failures are reported as warnings, not step failures.
   * @returns {Promise<Object>} - { ran, exitCode, output }
   */
  async runVersionConsistencyCheck() {
    // Detect if the project has a check:version npm script
    const pkgPath = `${this.projectRoot}/package.json`;
    let hasScript = false;
    try {
      const content = await this.fileOps.readFile(pkgPath);
      if (content) {
        const pkg = JSON.parse(content);
        hasScript = Boolean(pkg.scripts && pkg.scripts[CHECK_VERSION_SCRIPT]);
      }
    } catch {
      // package.json missing or unreadable — skip
    }

    if (!hasScript) {
      return { ran: false };
    }

    return new Promise((resolve) => {
      execFile(
        'npm',
        ['run', CHECK_VERSION_SCRIPT],
        { cwd: this.projectRoot, timeout: 30_000 },
        (err, stdout, stderr) => {
          const output = (stdout + stderr).trim();
          const exitCode = err ? (err.code ?? 1) : 0;
          resolve({ ran: true, exitCode, output });
        }
      );
    });
  }

  /**
   * Scan the entire project for files containing the given version string.
   * This ensures files like README.md, docs/, .github/ etc. are not missed.
   * @private
   * @param {string} version - Version string to search for
   * @returns {Promise<Array<string>>} Relative file paths containing the version
   */
  async _scanForVersionFiles(version) {
    const root = this.projectRoot;
    const { readFileSync } = await import('fs');
    const found = scanFilesContainingVersion(root, version, (p) => readFileSync(p, 'utf-8'));
    // Return relative paths
    return found.map((abs) => (abs.startsWith(root + '/') ? abs.slice(root.length + 1) : abs));
  }

  /**
   * Gather git context data for AI version bump analysis
   * @private
   * @returns {Promise<Object>} { gitLog, diffSummary, diffSample, insertions, deletions }
   */
  async _gatherGitContext() {
    const run = (cmd) =>
      new Promise((resolve) => {
        const [bin, ...args] = cmd.split(' ');
        execFile(bin, args, { cwd: this.projectRoot, timeout: 15_000 }, (err, stdout) => {
          resolve(err ? '' : stdout.trim());
        });
      });

    const [gitLog, diffShortstat, rawDiff] = await Promise.all([
      run('git log --oneline -n 10'),
      run('git diff --shortstat HEAD'),
      run('git diff HEAD'),
    ]);

    // Parse insertions/deletions from shortstat
    const insertMatch = diffShortstat.match(/(\d+)\s+insertion/);
    const deleteMatch = diffShortstat.match(/(\d+)\s+deletion/);

    return {
      gitLog: gitLog || '(log unavailable)',
      diffSummary: diffShortstat || '(diff stats unavailable)',
      diffSample: rawDiff ? rawDiff.split('\n').slice(0, 80).join('\n') : '(diff unavailable)',
      insertions: insertMatch ? parseInt(insertMatch[1], 10) : 0,
      deletions: deleteMatch ? parseInt(deleteMatch[1], 10) : 0,
    };
  }
}
