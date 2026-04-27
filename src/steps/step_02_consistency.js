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
import yaml from 'js-yaml';
import {
  buildConsistencyPrompt,
  buildFileContentBlock,
  loadResolvedAiHelpers,
  AI_PROJECT_KINDS_PATH,
  buildYamlStepPrompt,
  buildProjectKindPrompt,
  MAX_CHARS_TOTAL_CONTENTS,
} from '../lib/ai_prompt_builder.js';
import { getPrimaryLanguage } from '../lib/tech_stack.js';
import {
  buildStepDependencies,
  initializeAiServices,
  appendAiRecommendations,
} from './step_analysis_helpers.js';

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

/**
 * Human-readable labels for workflow scope keys.
 * Used to expand terse internal identifiers into descriptive context for AI prompts.
 */
export const SCOPE_DESCRIPTIONS = {
  code_changes: 'code_changes — source code modifications',
  docs_only: 'docs_only — documentation changes only',
  test_changes: 'test_changes — test file modifications',
  full_changes: 'full_changes — all file types modified',
  full_validation:
    'full_validation — complete codebase analysis, all files analyzed regardless of recent changes',
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

/**
 * Check whether a broken link target also matches an existing repo-root-relative path.
 * This helps the AI distinguish true missing files from likely relative-path mistakes.
 *
 * @pure
 * @param {string} filePath - Raw link target from markdown
 * @param {Set<string>} existingFiles - Set of absolute existing paths
 * @param {string} projectRoot - Absolute project root
 * @returns {string|null} Repo-relative path when a repo-root match exists, else null
 */
export function findRepoRootMatch(filePath, existingFiles, projectRoot) {
  if (
    !filePath ||
    typeof filePath !== 'string' ||
    !existingFiles ||
    typeof existingFiles.has !== 'function' ||
    !projectRoot
  ) {
    return null;
  }

  const withoutAnchor = filePath.split('#')[0];
  if (!withoutAnchor) return null;

  const candidate = path.resolve(projectRoot, withoutAnchor);
  if (!existingFiles.has(candidate)) {
    return null;
  }

  return path.relative(projectRoot, candidate).replaceAll(path.sep, '/');
}

/**
 * Remove prompt-only hint suffixes from a broken-link reference so comparisons
 * stay stable even when prompt context adds extra grounding details.
 *
 * @pure
 * @param {string} reference - Broken-link reference text
 * @returns {string} Normalized reference without prompt-only hints
 */
export function normalizeBrokenLinkReference(reference) {
  return String(reference ?? '')
    .trim()
    .replace(/\s+\(existing repo path: [^)]+\)$/u, '');
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
  const brokenLinkCandidates = results.brokenLinkCandidates ?? results.brokenLinks.length;
  const confirmedBrokenLinks = results.confirmedBrokenLinks ?? results.brokenLinks.length;
  const falsePositiveBrokenLinks = results.falsePositiveBrokenLinks ?? 0;
  const unverifiedBrokenLinks = results.unverifiedBrokenLinks ?? 0;
  const degradedAiPartitions = results.degradedAiPartitions ?? 0;

  lines.push('## Step 2: Consistency Analysis\n');

  // Summary
  lines.push('### Summary');
  lines.push(`- **Files checked**: ${results.filesChecked}`);
  lines.push(`- **Total issues**: ${results.totalIssues}`);
  lines.push(`- **Broken link scan candidates**: ${brokenLinkCandidates}`);
  lines.push(`- **Confirmed broken links**: ${confirmedBrokenLinks}`);
  lines.push(`- **False positives**: ${falsePositiveBrokenLinks}`);
  lines.push(`- **Unverified broken-link candidates**: ${unverifiedBrokenLinks}`);
  lines.push(`- **Degraded AI partitions**: ${degradedAiPartitions}`);
  lines.push(`- **Version issues**: ${results.versionIssues.length}\n`);

  // Status
  if (results.totalIssues === 0 && brokenLinkCandidates === 0 && degradedAiPartitions === 0) {
    lines.push('✅ **Status**: All consistency checks passed\n');
  } else if (results.totalIssues === 0 && degradedAiPartitions > 0) {
    lines.push(
      '⚠️ **Status**: Deterministic checks passed, but some AI-backed broken-link assessments were degraded and left unverified\n'
    );
  } else if (results.totalIssues === 0) {
    lines.push('⚠️ **Status**: No confirmed issues, but scan candidates remain unverified\n');
  } else {
    lines.push('⚠️ **Status**: Issues found - review required\n');
  }

  // Broken link candidates
  if (results.brokenLinks.length > 0) {
    lines.push('### Broken Link Scan Candidates');
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
 * Map a relative file path to a human-readable category label for prompt display.
 * @pure
 * @param {string} filePath - Relative path from project root
 * @returns {string} Category label
 */
function getFileCategory(filePath) {
  const p = filePath.replace(/\\/g, '/');
  if (!p.includes('/')) return 'Root';

  if (p.startsWith('.github/')) {
    const rest = p.slice('.github/'.length);
    if (!rest.includes('/')) return '.github/ — Guides & Policies';
    if (rest.startsWith('ISSUE_TEMPLATE/')) return '.github/ISSUE_TEMPLATE/ — Issue Templates';
    if (rest.startsWith('actions/')) return '.github/actions/ — GitHub Actions';
    if (rest.startsWith('skills/')) return '.github/skills/ — Skills';
    if (rest.startsWith('workflows/')) return '.github/workflows/ — Workflows';
    if (rest.startsWith('scripts/')) return '.github/scripts/ — Scripts';
    return `.github/${rest.split('/')[0]}/`;
  }

  const topDir = p.split('/')[0];
  if (topDir === 'docs') return 'docs/ — Documentation';
  if (topDir === 'src') return 'src/ — Source';
  if (topDir === '__tests__') return '__tests__/ — Tests';
  return `${topDir}/`;
}

/** Defined ordering of well-known category labels. */
const CATEGORY_ORDER = [
  'Root',
  '.github/ — Guides & Policies',
  '.github/ISSUE_TEMPLATE/ — Issue Templates',
  '.github/actions/ — GitHub Actions',
  '.github/skills/ — Skills',
  '.github/workflows/ — Workflows',
  '.github/scripts/ — Scripts',
  'docs/ — Documentation',
  'src/ — Source',
  '__tests__/ — Tests',
];

/**
 * Group an array of relative file paths into ordered categories for prompt display.
 * Returns an array of [label, paths[]] pairs in a consistent category order.
 * Unknown categories (e.g. dynamic .github subdirs, other top-level dirs) are
 * appended in alphabetical order after the well-known ones.
 *
 * @pure
 * @param {string[]} partFiles - Relative doc-file paths in the partition
 * @returns {Array<[string, string[]]>} Ordered [label, filePaths[]] pairs
 */
export function categorizeFiles(partFiles) {
  const map = new Map();
  for (const f of partFiles) {
    const label = getFileCategory(f);
    if (!map.has(label)) map.set(label, []);
    map.get(label).push(f);
  }

  const result = [];
  for (const label of CATEGORY_ORDER) {
    if (map.has(label)) {
      result.push([label, map.get(label)]);
      map.delete(label);
    }
  }
  // Remaining categories in alphabetical order
  for (const [label, files] of [...map.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    result.push([label, files]);
  }
  return result;
}

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
 * Build a compact two-level directory tree from a file-index Set.
 *
 * Produces a fenced Markdown block listing unique top-two-level directory
 * paths (e.g. `src/`, `src/patterns/`) derived from the absolute paths in
 * `fileSet`. Root-level files are omitted; only paths that have at least one
 * child appear. Returns an empty string when no directories are found.
 *
 * @param {Set<string>} fileSet - Absolute paths (files + ancestor dirs) from buildFileIndex
 * @param {string} projectRoot - Absolute path to the project root
 * @returns {string} Fenced markdown block headed "**Directory Tree:**", or ''
 */
export function buildCompactDirectoryTree(fileSet, projectRoot) {
  const dirs = new Set();
  for (const absPath of fileSet) {
    const rel = path.relative(projectRoot, absPath);
    if (!rel || rel.startsWith('..')) continue;
    const parts = rel.split(path.sep).filter(Boolean);
    if (parts.length >= 2) {
      dirs.add(parts[0] + '/');
      dirs.add(parts[0] + '/' + parts[1] + '/');
    }
  }
  const sorted = Array.from(dirs).sort();
  if (sorted.length === 0) return '';
  return `**Directory Tree:**\n\`\`\`\n${sorted.join('\n')}\n\`\`\``;
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
 * @param {number} [totalDocCount=0] - Total markdown files in the project (used for the
 *   completeness note shown to the AI; 0 suppresses the "X of Y" preamble)
 * @returns {{ docFilesList: string, brokenRefsList: string, header: string, flaggedRefs: string[] }}
 */
export function buildPartitionContext(
  partFiles,
  brokenLinks,
  partIndex,
  totalParts,
  totalDocCount = 0
) {
  const groups = categorizeFiles(partFiles);
  const groupLines = groups.map(
    ([label, files]) => `**${label}** (${files.length}): ${files.join(', ')}`
  );
  const preamble =
    totalDocCount > partFiles.length
      ? `_(This partition covers ${partFiles.length} of ${totalDocCount} total markdown files in the project — other files may exist but are not listed here.)_`
      : `_(${partFiles.length} file${partFiles.length !== 1 ? 's' : ''} in this partition.)_`;
  const docFilesList = `${preamble}\n${groupLines.join('\n')}`;

  // Filter broken links to those whose SOURCE file is in this partition
  const matchingBroken = brokenLinks.filter((l) => {
    const f = l.file || String(l);
    return partFiles.some((pf) => f.endsWith(pf) || pf.endsWith(f.replace(/^.*[/\\]/, '')));
  });

  const pairRecords = [];
  const seenPairs = new Set();
  for (const issue of matchingBroken) {
    const raw = `${issue.file}:${issue.line} → ${issue.link}`;
    if (seenPairs.has(raw)) continue;
    seenPairs.add(raw);

    const prompt = issue.repoRootMatch
      ? `${raw} (existing repo path: ${issue.repoRootMatch})`
      : raw;
    pairRecords.push({ raw, prompt });
  }

  // Deduplicate and cap
  const cappedPairs = pairRecords.slice(0, MAX_ISSUES_PER_PROMPT);
  const suffix =
    pairRecords.length > MAX_ISSUES_PER_PROMPT
      ? `, ... and ${pairRecords.length - MAX_ISSUES_PER_PROMPT} more`
      : '';
  const flaggedRefs = cappedPairs.map((item) => item.raw);
  const brokenRefsList =
    cappedPairs.length > 0 ? cappedPairs.map((item) => item.prompt).join(', ') + suffix : 'none';

  const header =
    totalParts > 1
      ? `[Partition ${partIndex + 1} of ${totalParts} — analyse ONLY the files listed below]`
      : '';

  return { docFilesList, brokenRefsList, header, flaggedRefs };
}

// ============================================================================
// PURE FUNCTIONS - AI Response Quality
// ============================================================================

/**
 * Minimum ratio of flagged references that should be addressed in the AI response
 * for it to be considered high-quality.
 */
export const MIN_COVERAGE_RATIO = 0.5;

const AI_REFERENCE_STATUS_PATTERNS = {
  confirmed: /confirmed broken/i,
  falsePositive: /false positive/i,
  unverified: /unverified from visible context/i,
};

/**
 * Validate that an AI response meaningfully addresses the flagged broken references.
 * Returns a quality assessment without performing any I/O.
 *
 * @pure
 * @param {string} aiResponse - Raw AI response text
 * @param {string[]} flaggedItems - The "source:line → target" pairs sent to the AI
 * @param {{ requireGroundedNoIssueResponse?: boolean }} [options] - Additional validation options
 * @returns {{ adequate: boolean, reason: string, coverage: number }}
 */
export function validateAiResponseQuality(aiResponse, flaggedItems, options = {}) {
  if (!aiResponse || typeof aiResponse !== 'string' || aiResponse.trim().length === 0) {
    return { adequate: false, reason: 'empty_response', coverage: 0 };
  }

  const normalized = aiResponse.toLowerCase();

  // Generic catch-all responses (< 200 chars) that contain no per-item analysis
  if (aiResponse.trim().length < 200 && flaggedItems.length > 0) {
    return { adequate: false, reason: 'too_short', coverage: 0 };
  }

  const usesExplicitSafeForm = normalized.includes(
    'no additional issues found beyond the programmatic scan'
  );
  const usesUncertaintyLanguage =
    normalized.includes('limited or inconclusive') ||
    normalized.includes('limited') ||
    normalized.includes('inconclusive') ||
    normalized.includes('unavailable');
  const makesBroadSuccessClaim =
    normalized.includes('all present documentation is consistent') ||
    normalized.includes('all docs are consistent') ||
    normalized.includes('all cross-references are intact') ||
    normalized.includes('no critical or high-priority documentation consistency issues') ||
    normalized.includes('follows project-specific conventions');
  const makesUnsupportedScopedPassClaim =
    normalized.includes('no version numbers or badges are present') ||
    normalized.includes('no version drift or badge mismatch is possible to flag') ||
    normalized.includes('all files use atx-style headings') ||
    normalized.includes('consistent capitalization') ||
    normalized.includes('all code blocks use triple backticks') ||
    normalized.includes('specify language tags where appropriate') ||
    normalized.includes('all referenced files in tables and lists') ||
    normalized.includes('no missing documentation') ||
    normalized.includes('no incomplete or stub-level documentation') ||
    normalized.includes('no referenced documentation files are missing') ||
    normalized.includes('no inconsistent terminology detected') ||
    normalized.includes('no visible inconsistencies') ||
    normalized.includes('no evidence of mismatched terminology') ||
    normalized.includes('no missing cross-references detected');

  if (
    options.requireGroundedNoIssueResponse &&
    !usesExplicitSafeForm &&
    !usesUncertaintyLanguage &&
    (makesBroadSuccessClaim || makesUnsupportedScopedPassClaim)
  ) {
    return { adequate: false, reason: 'unsupported_global_claim', coverage: 0 };
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

/**
 * Summarize how an AI response classified broken-link scan candidates.
 *
 * @pure
 * @param {string[]} flaggedItems - Candidate entries in "source:line → target" format
 * @param {string} [aiResponse=''] - AI response text for the same partition
 * @returns {{ totalCandidates: number, confirmed: number, falsePositive: number, unverified: number }}
 */
export function summarizeBrokenLinkAssessments(flaggedItems, aiResponse = '') {
  const normalizedFlaggedItems = [
    ...new Set(
      (Array.isArray(flaggedItems) ? flaggedItems : [])
        .filter(Boolean)
        .map((item) => normalizeBrokenLinkReference(item))
    ),
  ];
  const assessmentMap = new Map();
  const response = String(aiResponse ?? '');
  const referencePattern =
    /(?:^|\n)#{3,4}\s+Reference:\s*(.+?)\n-\s+\*\*Status:\*\*\s*(.+?)(?=\n|$)/g;
  let match;

  while ((match = referencePattern.exec(response)) !== null) {
    const reference = normalizeBrokenLinkReference(match[1]);
    const statusText = match[2].trim();
    if (AI_REFERENCE_STATUS_PATTERNS.confirmed.test(statusText)) {
      assessmentMap.set(reference, 'confirmed');
    } else if (AI_REFERENCE_STATUS_PATTERNS.falsePositive.test(statusText)) {
      assessmentMap.set(reference, 'false_positive');
    } else if (AI_REFERENCE_STATUS_PATTERNS.unverified.test(statusText)) {
      assessmentMap.set(reference, 'unverified');
    }
  }

  const summary = {
    totalCandidates: normalizedFlaggedItems.length,
    confirmed: 0,
    falsePositive: 0,
    unverified: 0,
  };

  for (const item of normalizedFlaggedItems) {
    const status = assessmentMap.get(item) || 'unverified';
    if (status === 'confirmed') {
      summary.confirmed += 1;
    } else if (status === 'false_positive') {
      summary.falsePositive += 1;
    } else {
      summary.unverified += 1;
    }
  }

  return summary;
}

/**
 * Count TypeScript source files for prompt context.
 * Includes `.ts` and `.tsx` files under `src/`, but excludes declaration files.
 *
 * @param {{ glob?: Function }} fileOps - File operations adapter
 * @param {string} projectRoot - Project root directory
 * @returns {Promise<string>} Count as a string, or "unknown" if it cannot be determined
 */
export async function countTypeScriptSourceFiles(fileOps, projectRoot) {
  if (!fileOps?.glob || !projectRoot) {
    return 'unknown';
  }

  try {
    const tsFiles = await fileOps.glob('src/**/*.{ts,tsx}', {
      cwd: projectRoot,
      ignore: ['src/**/*.d.ts'],
      absolute: false,
    });
    return String(tsFiles.length);
  } catch {
    return 'unknown';
  }
}

/**
 * Build the injected file-content section for a partition prompt.
 *
 * @param {{ readFile?: Function }} fileOps - File operations adapter
 * @param {string} projectRoot - Project root directory
 * @param {string[]} partFiles - Relative markdown file paths in this partition
 * @returns {Promise<{ fileContentsSection: string, fileHashEntries: string[] }>}
 */
export async function buildPartitionFileContents(fileOps, projectRoot, partFiles) {
  const fileHashEntries = [];
  const blocks = [];
  let totalChars = 0;

  for (const relPath of partFiles) {
    try {
      const raw = await fileOps.readFile(`${projectRoot}/${relPath}`);
      fileHashEntries.push(`${relPath}:${raw}`);

      if (totalChars >= MAX_CHARS_TOTAL_CONTENTS) {
        continue;
      }

      totalChars += raw.length;
      if (totalChars > MAX_CHARS_TOTAL_CONTENTS) {
        blocks.push(`### \`${relPath}\`\n*(omitted — context budget exhausted)*`);
        continue;
      }

      blocks.push(buildFileContentBlock(relPath, raw));
    } catch {
      // File unreadable — skip gracefully
    }
  }

  return {
    fileContentsSection: blocks.length > 0 ? blocks.join('\n\n') : '',
    fileHashEntries,
  };
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
    Object.assign(this, buildStepDependencies(options));
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

      if (!projectRoot) {
        logger.warn('Step 2: No project root provided — skipping');
        return { success: true, skipped: true, reason: 'no_project_root' };
      }

      // Phase 1: Discover documentation files (archive is excluded from analysis)
      const [docFiles, archiveFiles] = await Promise.all([
        this.discoverDocumentationFiles(projectRoot),
        this.discoverArchiveFiles(projectRoot),
      ]);
      if (docFiles.length === 0) {
        logger.info('No documentation files found - skipping consistency check');
        return { success: true, skipped: true, reason: 'no_docs' };
      }

      logger.info(`Found ${docFiles.length} documentation files`);
      if (archiveFiles.length > 0) {
        logger.info(
          `Found ${archiveFiles.length} archive file(s) — injected as context, not analyzed`
        );
      }

      // Build archive context block injected into every AI prompt partition.
      // The AI must NOT treat broken links or stale references inside archive files
      // as actionable issues — they are expected side-effects of historical snapshots.
      const archiveContext =
        archiveFiles.length > 0
          ? `**Archive (read-only context — do NOT analyze or recommend fixes for these paths):**\n` +
            `The following paths are historical snapshots stored in \`.ai_workflow/archive/\`.\n` +
            `Broken links within archived files are expected (their targets may have been renamed\n` +
            `or reorganized since the snapshot was taken) and must NOT be flagged as actionable issues.\n\n` +
            archiveFiles
              .map((f) => `- ${path.isAbsolute(f) ? path.relative(projectRoot, f) : f}`)
              .join('\n')
          : '';

      // Phase 2: Load expected version
      const expectedVersion = await this.getExpectedVersion(projectRoot);
      logger.info(`Expected version: ${expectedVersion || 'not found'}`);

      // Phase 3: Check version consistency
      const versionIssues = await this.checkVersions(docFiles, expectedVersion);
      logger.info(`Version check: ${versionIssues.length} issue(s) found`);

      // Phase 4: Check file references
      const existingFiles = await this.buildFileIndex(projectRoot);
      const brokenLinks = await this.checkLinks(docFiles, existingFiles, projectRoot);
      logger.info(`Link check: ${brokenLinks.length} candidate broken link(s) found`);

      // Phase 4b: Build compact directory tree for architecture consistency analysis
      const directoryTree = buildCompactDirectoryTree(existingFiles, projectRoot);

      // Phase 5: Generate report
      let brokenLinkAssessment = {
        totalCandidates: brokenLinks.length,
        confirmed: 0,
        falsePositive: 0,
        unverified: brokenLinks.length,
      };
      const totalIssues = versionIssues.length + brokenLinkAssessment.confirmed;
      const results = {
        filesChecked: docFiles.length,
        totalIssues,
        brokenLinks,
        brokenLinkCandidates: brokenLinkAssessment.totalCandidates,
        confirmedBrokenLinks: brokenLinkAssessment.confirmed,
        falsePositiveBrokenLinks: brokenLinkAssessment.falsePositive,
        unverifiedBrokenLinks: brokenLinkAssessment.unverified,
        versionIssues,
        degradedAiPartitions: 0,
        warnings: [],
      };

      const report = formatConsistencyReport(results);
      await this.backlog.saveStepSummary(2, 'Consistency Analysis', report);

      // Phase 6: AI-powered consistency analysis (partitioned to avoid prompt-size timeouts)
      const aiAvailable = await initializeAiServices(this.aiHelper, this.aiCache);
      if (aiAvailable) {
        const language = options.language || (await this.detectLanguage(projectRoot));

        // Load YAML prompt config and optional project-kind role overlay once
        let parsedYaml = null;
        let roleOverride = '';
        try {
          parsedYaml = await loadResolvedAiHelpers(this.fileOps);
        } catch {
          /* YAML unavailable, will use fallback builder */
        }
        try {
          const pkYaml = await this.fileOps.readFile(AI_PROJECT_KINDS_PATH);
          const parsedPk = yaml.load(pkYaml);
          const pk = buildProjectKindPrompt(
            parsedPk,
            options?.projectKind ?? 'default',
            'documentation_specialist'
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

        const tsSourceCount = await countTypeScriptSourceFiles(this.fileOps, projectRoot);

        const aiParts = [];
        brokenLinkAssessment = {
          totalCandidates: 0,
          confirmed: 0,
          falsePositive: 0,
          unverified: 0,
        };
        const degradedWarnings = [];
        for (let i = 0; i < totalParts; i++) {
          const partFiles = partitions[i];
          const { docFilesList, brokenRefsList, header, flaggedRefs } = buildPartitionContext(
            partFiles,
            brokenLinks,
            i,
            totalParts,
            docFiles.length
          );
          const { fileContentsSection, fileHashEntries } = await buildPartitionFileContents(
            this.fileOps,
            projectRoot,
            partFiles
          );

          let prompt;
          if (parsedYaml) {
            try {
              prompt = buildYamlStepPrompt(parsedYaml, 'step2_consistency_prompt', {
                project_name: projectRoot,
                project_description: options.projectDescription || '',
                primary_language: language,
                change_scope: SCOPE_DESCRIPTIONS[options.scope] || options.scope || '',
                doc_count: String(docFiles.length),
                ts_source_count: tsSourceCount,
                modified_count: `${partFiles.length} (files are batched in groups of ≤${PARTITION_SIZE} to stay within AI context limits)`,
                broken_refs_content: brokenRefsList,
                doc_files: docFilesList,
                file_contents:
                  fileContentsSection || '(no readable markdown file contents were available)',
                directory_tree: directoryTree,
              });
              if (prompt && roleOverride) {
                prompt = `[Project-Kind Role: ${roleOverride}]\n\n${prompt}`;
              }
              if (prompt && header) {
                prompt = `${header}\n\n${prompt}`;
              }
              // Append archive context after the main prompt body so the AI
              // knows these paths are historical and must not be flagged.
              if (prompt && archiveContext) {
                prompt = `${prompt}\n\n${archiveContext}`;
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
              projectInfo: {
                project_name: projectRoot,
                description: options.projectDescription || '',
              },
              fileContents: fileContentsSection,
            });
            if (header) prompt = `${header}\n\n${prompt}`;
            if (archiveContext) prompt = `${prompt}\n\n${archiveContext}`;
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
          // Use 'documentation_expert' persona: Step 2 performs documentation consistency
          // analysis (cross-references, version sync, terminology), not code quality review.
          // The YAML prompt template (step2_consistency_prompt) also defines a documentation
          // specialist role — both layers must agree to avoid misleading prompt logs.
          const cacheStepId = `step_02_part${i}of${totalParts}`;
          let aiResult = await this.aiCache.withFileChangeGuard(cacheStepId, fileHashEntries, () =>
            this.aiHelper.executeRequest(prompt, { persona: 'documentation_expert' })
          );
          let aiContent = aiResult?.content ?? '';

          // Validate response quality; warn if the model gave a generic non-structured reply
          const partitionBrokenRefs = flaggedRefs;
          let quality = validateAiResponseQuality(aiContent, partitionBrokenRefs, {
            requireGroundedNoIssueResponse: true,
          });
          if (!quality.adequate && quality.coverage === 0) {
            await this.aiCache.invalidateFileChangeGuard(cacheStepId);
            logger.warn(
              `[step_02] Partition ${i + 1}: invalidated cached AI response` +
                ` (reason=${quality.reason}, coverage=0%). Re-running partition analysis.`
            );
            aiResult = await this.aiHelper.executeRequest(prompt, { persona: 'documentation_expert' });
            aiContent = aiResult?.content ?? '';
            quality = validateAiResponseQuality(aiContent, partitionBrokenRefs, {
              requireGroundedNoIssueResponse: true,
            });
          }
          if (!quality.adequate) {
            results.degradedAiPartitions += 1;
            degradedWarnings.push(
              `Partition ${i + 1}/${totalParts} AI broken-link review was downgraded to unverified (${quality.reason}, coverage ${(quality.coverage * 100).toFixed(0)}%).`
            );
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

          const assessment = quality.adequate
            ? summarizeBrokenLinkAssessments(partitionBrokenRefs, aiContent)
            : {
                totalCandidates: partitionBrokenRefs.length,
                confirmed: 0,
                falsePositive: 0,
                unverified: partitionBrokenRefs.length,
              };
          brokenLinkAssessment.totalCandidates += assessment.totalCandidates;
          brokenLinkAssessment.confirmed += assessment.confirmed;
          brokenLinkAssessment.falsePositive += assessment.falsePositive;
          brokenLinkAssessment.unverified += assessment.unverified;
        }

        results.totalIssues = versionIssues.length + brokenLinkAssessment.confirmed;
        results.brokenLinkCandidates = brokenLinkAssessment.totalCandidates;
        results.confirmedBrokenLinks = brokenLinkAssessment.confirmed;
        results.falsePositiveBrokenLinks = brokenLinkAssessment.falsePositive;
        results.unverifiedBrokenLinks = brokenLinkAssessment.unverified;
        results.warnings = degradedWarnings;

        const updatedReport = formatConsistencyReport(results);
        if (aiParts.length > 0) {
          const merged = aiParts.join('\n\n---\n\n');
          const enrichedReport = appendAiRecommendations(updatedReport, merged);
          await this.backlog.saveStepSummary(2, 'Consistency Analysis', enrichedReport);
        } else if (results.degradedAiPartitions > 0) {
          await this.backlog.saveStepSummary(2, 'Consistency Analysis', updatedReport);
        }
      } else {
        logger.warn('AI helper not available - skipping AI consistency analysis');
      }

      if (results.totalIssues === 0 && results.brokenLinkCandidates === 0) {
        logger.success('Step 2 completed - no issues found');
      } else if (results.degradedAiPartitions > 0 && results.totalIssues === 0) {
        logger.warn(
          `Step 2 completed with degraded AI evidence - ${results.unverifiedBrokenLinks} candidate(s) remain unverified across ${results.degradedAiPartitions} partition(s)`
        );
      } else if (results.totalIssues === 0) {
        logger.warn(
          `Step 2 completed - 0 confirmed issue(s), ${results.unverifiedBrokenLinks} unverified candidate(s), ${results.falsePositiveBrokenLinks} false positive(s)`
        );
      } else {
        logger.warn(
          `Step 2 completed - ${results.totalIssues} confirmed issue(s) found (${results.brokenLinkCandidates} broken-link candidate(s) scanned)`
        );
      }

      return {
        success: true,
        degraded: results.degradedAiPartitions > 0,
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
      '.test-e2e',
      'venv',
      '.venv',
      'env',
      '.workflow_core',
      '.workflow_fspec',
      '.ai_workflow',
    ];
    // Generate both root-level ("dir/**") and nested ("**/dir/**") ignore patterns.
    // "**/${dir}/**" alone does NOT match root-level dot-directories (e.g. ".ai_workflow/...")
    // because minimatch requires a literal "/" before the directory name.
    const ignorePatterns = exclude.flatMap((dir) => [`${dir}/**`, `**/${dir}/**`]);

    const files = [];
    for (const pattern of patterns) {
      try {
        const found = await this.fileOps.glob(pattern, {
          cwd: projectRoot,
          ignore: ignorePatterns,
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
   * Discover archived documentation files under `.ai_workflow/archive/`.
   * These are historical snapshots — they are NOT analyzed but ARE injected into
   * the prompt as read-only context so the AI knows they exist and are intentionally
   * outdated (broken links within them should not be treated as actionable issues).
   *
   * @param {string} projectRoot - Project root directory
   * @returns {Promise<string[]>} Relative paths of archive markdown files (capped)
   */
  async discoverArchiveFiles(projectRoot) {
    const MAX_ARCHIVE_FILES = 100; // cap to avoid bloating the prompt
    try {
      const found = await this.fileOps.glob('.ai_workflow/archive/**/*.md', {
        cwd: projectRoot,
        absolute: false,
      });
      return found.slice(0, MAX_ARCHIVE_FILES);
    } catch {
      return [];
    }
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
   * Parse git submodule paths from .gitmodules.
   * Returns relative submodule directory paths so their files can be added to
   * the link-validation index (preventing false-positive broken-link reports for
   * cross-references that point into a checked-out submodule).
   * @param {string} projectRoot - Project root directory
   * @returns {Promise<string[]>} Array of relative submodule paths (e.g. ['.workflow_core'])
   */
  async getSubmodulePaths(projectRoot) {
    try {
      const content = await this.fileOps.readFile(path.join(projectRoot, '.gitmodules'));
      const matches = content.match(/^\s*path\s*=\s*(.+)$/gm) || [];
      return matches.map((m) => m.replace(/^\s*path\s*=\s*/, '').trim()).filter(Boolean);
    } catch {
      return [];
    }
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
      '.ai_workflow',
    ];
    // Generate both root-level ("dir/**") and nested ("**/dir/**") ignore patterns.
    // "**/${dir}/**" alone does NOT match root-level dot-directories (e.g. ".ai_workflow/...")
    // because minimatch requires a literal "/" before the directory name.
    const ignoreList = exclude.flatMap((dir) => [`${dir}/**`, `**/${dir}/**`]);

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

    // Submodule pass: add files inside git submodules to the index so that
    // cross-references from project docs INTO submodule files are not falsely
    // reported as broken links. Submodule files are never added to docFiles
    // (discoverDocFiles excludes them separately), so they are index-only.
    const submodulePaths = await this.getSubmodulePaths(projectRoot);
    for (const submodulePath of submodulePaths) {
      const submoduleAbs = path.join(projectRoot, submodulePath);
      try {
        const subFiles = await this.fileOps.glob('**/*', {
          cwd: submoduleAbs,
          absolute: true,
        });
        for (const f of subFiles) {
          fileSet.add(f);
          let dir = path.dirname(f);
          while (dir.length > projectRoot.length) {
            fileSet.add(dir);
            dir = path.dirname(dir);
          }
        }
      } catch {
        // Submodule not checked out or empty — skip silently
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
  async checkLinks(docFiles, existingFiles, projectRoot) {
    const allIssues = [];

    for (const file of docFiles) {
      try {
        const content = await this.fileOps.readFile(file);
        const links = extractLinks(content);
        const issues = validateFileReferences(links, existingFiles, file).map((issue) => ({
          ...issue,
          repoRootMatch: findRepoRootMatch(issue.link, existingFiles, projectRoot),
        }));
        allIssues.push(...issues);
      } catch {
        // File read error, skip
      }
    }

    return allIssues;
  }

  async detectLanguage(projectRoot) {
    return getPrimaryLanguage(this.techStack, projectRoot, 'javascript');
  }
}

export default Step2ConsistencyAnalyzer;
