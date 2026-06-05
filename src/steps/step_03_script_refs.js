/**
 * Step 3: Script Reference Validation
 * @version 2.0.0
 * @description Validate script/code references and documentation accuracy
 * @module steps/step_03_script_refs
 * Part of: AI Workflow Automation (Phase 9)
 */

import { STEP_KIND } from './step_contract.js';
import logger from '../core/logger.js';
import { getPrimaryLanguage } from '../lib/tech_stack.js';
import {
  buildYamlStepPrompt,
  buildAlternativesDirective,
  parseAlternatives,
  loadResolvedAiHelpers,
} from '../lib/ai_prompt_builder.js';
import path from 'node:path';
import {
  appendAiRecommendations,
  buildStepDependencies,
  initializeAiServices,
} from './step_analysis_helpers.js';
import { buildStepPromptWithFallback } from './step_execution_helpers.js';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Script patterns by language
 */
export const SCRIPT_PATTERNS = {
  bash: ['*.sh'],
  python: ['*.py'],
  javascript: ['*.js', '*.mjs'],
  typescript: ['*.ts', '*.mts'],
  go: ['*.go'],
  java: ['*.java'],
  ruby: ['*.rb'],
  rust: ['*.rs'],
  cpp: ['*.cpp', '*.cc', '*.h', '*.hpp'],
};

/**
 * Script directories by language
 */
export const SCRIPT_DIRECTORIES = {
  bash: ['.', '.github/scripts', 'scripts', 'src/scripts', 'src/workflow'],
  python: ['scripts', 'src'],
  javascript: ['scripts', 'src/scripts', 'bin'],
  typescript: ['scripts', 'src/scripts', 'bin'],
  default: ['scripts'],
};

/**
 * Issue types
 */
export const SCRIPT_ISSUE_TYPE = {
  MISSING_REFERENCE: 'missing_reference',
  NON_EXECUTABLE: 'non_executable',
  UNDOCUMENTED: 'undocumented',
  INVALID_SHEBANG: 'invalid_shebang',
};

export const SCRIPT_DOC_MATCH_TYPE = {
  EXACT_PATH: 'exact_path',
  PATH_VARIANT: 'path_variant',
  BASENAME_ONLY: 'basename_only',
};

// ============================================================================
// PURE FUNCTIONS - Script Pattern Detection
// ============================================================================

/**
 * Get script patterns for a language
 * @pure
 * @param {string} language - Programming language
 * @returns {string[]} Array of file patterns
 */
export function getScriptPatterns(language) {
  const normalized = (language || 'bash').toLowerCase();
  return SCRIPT_PATTERNS[normalized] || SCRIPT_PATTERNS.bash;
}

/**
 * Get script directories for a language
 * @pure
 * @param {string} language - Programming language
 * @returns {string[]} Array of directory paths
 */
export function getScriptDirectories(language) {
  const normalized = (language || 'bash').toLowerCase();
  return SCRIPT_DIRECTORIES[normalized] || SCRIPT_DIRECTORIES.default;
}

/**
 * Extract script references from documentation
 * @pure
 * @param {string} content - Documentation content
 * @returns {string[]} Array of script paths referenced
 */
export function extractScriptReferences(content) {
  const references = [];

  // Match inline paths while preserving dot-directories (.github/...) and parent
  // references (../tools/...) so downstream validation can distinguish in-repo
  // scripts from out-of-repo prerequisites.
  const inlinePattern = /`((?:\.\.?\/)?[^\s`]+?\.(?:sh|py|js|mjs|ts|rb|go|java|rs|cpp|cc))`/g;
  let match;
  while ((match = inlinePattern.exec(content)) !== null) {
    references.push(normalizeExtractedScriptReference(match[1]));
  }

  // Match: ```bash\n./script.sh\n```
  const codeBlockPattern = /```(?:bash|sh|python|javascript|typescript)\n([\s\S]*?)```/g;
  while ((match = codeBlockPattern.exec(content)) !== null) {
    const commands = match[1].trim().split('\n');
    for (const cmd of commands) {
      if (cmd.includes('$(')) continue; // skip shell substitutions (e.g. source "$(dirname ...)/script.sh")
      const scriptMatch = cmd.match(/((?:\.\.?\/)?[^\s]+\.(?:sh|py|js|mjs|ts|rb|go))/);
      if (scriptMatch) {
        references.push(normalizeExtractedScriptReference(scriptMatch[1]));
      }
    }
  }

  return [...new Set(references)]; // Remove duplicates
}

/**
 * Validate script references against existing files
 * @pure
 * @param {string[]} references - Script references from docs
 * @param {Set} existingScripts - Set of existing script paths
 * @returns {Object[]} Array of missing reference issues
 */
export function validateScriptReferences(references, existingScripts) {
  const issues = [];
  const normalizedExistingScripts = new Set(
    [...existingScripts].map((scriptPath) => normalizeScriptPath(scriptPath))
  );

  for (const ref of references) {
    const normalized = normalizeScriptPath(ref);

    // Parent-relative or absolute references can legitimately point to sibling
    // repositories or external tooling, so Step 3 should not auto-classify them
    // as missing in-repo scripts.
    if (!normalized || normalized.startsWith('../') || path.isAbsolute(normalized)) {
      continue;
    }

    if (!normalizedExistingScripts.has(normalized)) {
      issues.push({
        reference: ref,
        normalized,
        type: SCRIPT_ISSUE_TYPE.MISSING_REFERENCE,
      });
    }
  }

  return issues;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeScriptPath(scriptPath) {
  return String(scriptPath ?? '')
    .replace(/\\/g, '/')
    .replace(/^\.?\//, '');
}

function normalizeExtractedScriptReference(reference) {
  return String(reference ?? '')
    .replace(/\\/g, '/')
    .replace(/^\.\//, '');
}

/**
 * Detect how a documentation snippet references a script.
 *
 * @pure
 * @param {string} scriptPath - Script file path
 * @param {string} content - Documentation content
 * @returns {{type: string, reference: string}|null} Match details or null
 */
export function getScriptDocumentationMatch(scriptPath, content) {
  const normalized = normalizeScriptPath(scriptPath);
  const baseName = path.basename(normalized);
  const text = String(content ?? '');

  if (!normalized || !text) return null;

  const escapedNormalized = escapeRegExp(normalized);
  const escapedBaseName = escapeRegExp(baseName);
  const exactPathPattern = new RegExp(
    `(^|[^A-Za-z0-9_./-])(\\.?/?${escapedNormalized})(?=$|[^A-Za-z0-9_./-])`,
    'm'
  );
  const pathVariantPattern = new RegExp(
    `(^|[^A-Za-z0-9_./-])((?:\\.?/)?(?:[A-Za-z0-9_.-]+/)+${escapedNormalized})(?=$|[^A-Za-z0-9_./-])`,
    'm'
  );
  const baseNamePattern = new RegExp(
    `(^|[^A-Za-z0-9_./-])(\\.?/?${escapedBaseName})(?=$|[^A-Za-z0-9_./-])`,
    'm'
  );

  const exactPathMatch = text.match(exactPathPattern);
  if (exactPathMatch?.[2]) {
    return {
      type: SCRIPT_DOC_MATCH_TYPE.EXACT_PATH,
      reference: exactPathMatch[2],
    };
  }

  const pathVariantMatch = text.match(pathVariantPattern);
  if (pathVariantMatch?.[2]) {
    return {
      type: SCRIPT_DOC_MATCH_TYPE.PATH_VARIANT,
      reference: pathVariantMatch[2],
    };
  }

  const baseNameMatch = text.match(baseNamePattern);
  if (baseNameMatch?.[2]) {
    return {
      type: SCRIPT_DOC_MATCH_TYPE.BASENAME_ONLY,
      reference: baseNameMatch[2],
    };
  }

  return null;
}

// ============================================================================
// PURE FUNCTIONS - Script Validation
// ============================================================================

/**
 * Check if a script has valid shebang
 * @pure
 * @param {string} content - Script content
 * @param {string} extension - File extension
 * @returns {Object} Validation result
 */
export function validateShebang(content, extension) {
  const lines = content.split('\n');
  const firstLine = lines[0] || '';

  // Expected shebangs by extension
  const expectedShebangs = {
    '.sh': ['#!/bin/bash', '#!/bin/sh', '#!/usr/bin/env bash', '#!/usr/bin/env sh'],
    '.py': [
      '#!/usr/bin/env python',
      '#!/usr/bin/python',
      '#!/usr/bin/env python3',
      '#!/usr/bin/python3',
    ],
    '.rb': ['#!/usr/bin/env ruby', '#!/usr/bin/ruby'],
  };

  const expected = expectedShebangs[extension];
  if (!expected) {
    return { valid: true, reason: 'not_required' }; // Not a script language that requires shebang
  }

  if (!firstLine.startsWith('#!')) {
    return { valid: false, reason: 'missing_shebang', expected };
  }

  const hasValid = expected.some((shebang) => firstLine.startsWith(shebang));
  if (!hasValid) {
    return { valid: false, reason: 'invalid_shebang', found: firstLine, expected };
  }

  return { valid: true };
}

/**
 * Check if a script is documented in any of the provided doc file contents
 * @pure
 * @param {string} scriptPath - Script file path
 * @param {string} readmeContent - README content (primary doc, always checked)
 * @param {Array<{path: string, content: string}>} [extraDocs=[]] - Additional doc files
 * @returns {boolean} True if documented in any provided content
 */
export function isScriptDocumented(scriptPath, readmeContent, extraDocs = []) {
  const mentionedIn = (content) => getScriptDocumentationMatch(scriptPath, content) !== null;

  if (mentionedIn(readmeContent)) return true;
  return extraDocs.some(({ content }) => mentionedIn(content));
}

/**
 * Build a per-script documentation coverage map across all provided doc files.
 * @pure
 * @param {string[]} scripts - Script file paths found on disk
 * @param {Array<{path: string, content: string}>} docFiles - Doc files to check
 * @returns {Array<{script: string, foundIn: string[], missingFrom: string[], matchDetails: Array<{path: string, type: string, reference: string}>}>}
 */
export function buildDocCoverageMap(scripts, docFiles) {
  return scripts.map((script) => {
    const foundIn = [];
    const missingFrom = [];
    const matchDetails = [];

    for (const { path: docPath, content } of docFiles) {
      const match = getScriptDocumentationMatch(script, content);
      if (match) {
        foundIn.push(docPath);
        matchDetails.push({ path: docPath, ...match });
      } else {
        missingFrom.push(docPath);
      }
    }

    return { script, foundIn, missingFrom, matchDetails };
  });
}

/**
 * Format the doc coverage map as a human-readable string for the AI prompt.
 * @pure
 * @param {Array<{script: string, foundIn: string[], missingFrom: string[]}>} coverageMap
 * @returns {string}
 */
export function formatDocCoverageMap(coverageMap) {
  return coverageMap
    .map(({ script, foundIn, missingFrom, matchDetails = [] }) => {
      const formattedMatches =
        matchDetails.length > 0
          ? matchDetails.map(({ path: docPath, type, reference }) => {
              if (type === SCRIPT_DOC_MATCH_TYPE.PATH_VARIANT) {
                return `${docPath} (path variant: ${reference})`;
              }
              if (type === SCRIPT_DOC_MATCH_TYPE.BASENAME_ONLY) {
                return `${docPath} (basename only: ${reference})`;
              }
              return docPath;
            })
          : foundIn;
      const found = foundIn.length
        ? `documented in [${formattedMatches.join(', ')}]`
        : 'NOT found in any doc file';
      // Only show "MISSING from" when the script has NO documentation at all — if it's
      // already covered in at least one doc the gap list is noise that misleads the AI.
      const missing =
        foundIn.length === 0 && missingFrom.length
          ? ` — MISSING from [${missingFrom.join(', ')}]`
          : '';
      return `${script}: ${found}${missing}`;
    })
    .join('\n');
}

// ============================================================================
// PURE FUNCTIONS - Reporting
// ============================================================================

/**
 * Format script validation report
 * @pure
 * @param {Object} results - Validation results
 * @returns {string} Formatted markdown content
 */
export function formatScriptReport(results) {
  const lines = [];

  lines.push('## Step 3: Script Reference Validation\n');

  // Summary
  lines.push('### Summary');
  lines.push(`- **Scripts found**: ${results.scriptsFound}`);
  lines.push(`- **References checked**: ${results.referencesChecked}`);
  lines.push(`- **Total issues**: ${results.totalIssues}`);
  lines.push(`- **Missing references**: ${results.missingReferences.length}`);
  lines.push(`- **Non-executable**: ${results.nonExecutable.length}`);
  lines.push(`- **Undocumented**: ${results.undocumented.length}\n`);

  // Status
  if (results.totalIssues === 0) {
    lines.push('✅ **Status**: All script references valid\n');
  } else {
    lines.push('⚠️ **Status**: Issues found - review required\n');
  }

  // Missing references
  if (results.missingReferences.length > 0) {
    lines.push('### Missing References');
    results.missingReferences.slice(0, 10).forEach((issue) => {
      lines.push(`- \`${issue.reference}\` (normalized: \`${issue.normalized}\`)`);
    });
    if (results.missingReferences.length > 10) {
      lines.push(`\n*... and ${results.missingReferences.length - 10} more*`);
    }
    lines.push('');
  }

  // Non-executable scripts
  if (results.nonExecutable.length > 0) {
    lines.push('### Non-Executable Scripts');
    results.nonExecutable.slice(0, 10).forEach((script) => {
      lines.push(`- \`${script}\``);
    });
    if (results.nonExecutable.length > 10) {
      lines.push(`\n*... and ${results.nonExecutable.length - 10} more*`);
    }
    lines.push('');
  }

  // Undocumented scripts
  if (results.undocumented.length > 0) {
    lines.push('### Undocumented Scripts');
    results.undocumented.slice(0, 10).forEach((script) => {
      lines.push(`- \`${script}\``);
    });
    if (results.undocumented.length > 10) {
      lines.push(`\n*... and ${results.undocumented.length - 10} more*`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Build prompt-safe documentation excerpts that preserve both the document head
 * and any later sections mentioning scripts in scope.
 *
 * @pure
 * @param {Array<{path: string, content: string}>} docFiles - Documentation files
 * @param {string[]} [scripts=[]] - Script paths in scope
 * @param {number} [maxChars=2000] - Max total characters in the returned context
 * @returns {string} Concatenated markdown excerpts
 */
export function buildDocumentationExcerpts(docFiles, scripts = [], maxChars = 2000) {
  if (!Array.isArray(docFiles) || docFiles.length === 0) return '';

  const tokenSet = new Set(
    scripts.flatMap((scriptPath) => {
      const normalized = String(scriptPath ?? '')
        .replace(/^\.?\//, '')
        .replace(/\\/g, '/');
      const baseName = path.basename(normalized);
      return [normalized.toLowerCase(), baseName.toLowerCase()].filter(
        (token) => token.length >= 3
      );
    })
  );
  const tokenList = Array.from(tokenSet);

  const headingPattern =
    /^#{1,6}\s+(automation scripts|cli documentation|available cli commands)\b/i;
  const perDocMax = Math.max(
    600,
    Math.min(1_200, Math.floor(maxChars / Math.max(1, Math.min(docFiles.length, 4))))
  );

  const excerptEntries = docFiles
    .map(({ path: filePath, content }) => {
      const lines = String(content ?? '').split('\n');
      if (lines.length === 0) {
        return {
          filePath,
          excerpt: `### ${filePath}`,
          hasRelevantSignals: false,
          mentionCount: 0,
          isReadme: /^README\.md$/i.test(filePath),
        };
      }

      /** @type {Array<{start: number, end: number}>} */
      const windows = [];
      let mentionCount = 0;
      let headingCount = 0;
      const addWindow = (start, end) => {
        const bounded = {
          start: Math.max(0, start),
          end: Math.min(lines.length - 1, end),
        };
        if (bounded.start > bounded.end) return;
        const previous = windows[windows.length - 1];
        if (previous && bounded.start <= previous.end + 1) {
          previous.end = Math.max(previous.end, bounded.end);
          return;
        }
        windows.push(bounded);
      };

      if (lines.length <= 120) {
        addWindow(0, lines.length - 1);
      } else {
        addWindow(0, Math.min(lines.length - 1, 59));
      }

      lines.forEach((line, index) => {
        const normalizedLine = line.toLowerCase();
        const mentionsScript = tokenList.some((token) => normalizedLine.includes(token));
        const matchesHeading = headingPattern.test(line);
        if (mentionsScript) mentionCount += 1;
        if (matchesHeading) headingCount += 1;
        if (mentionsScript || matchesHeading) {
          addWindow(index - 3, index + 5);
        }
      });

      const excerptLines = [];
      windows.forEach((window, index) => {
        const previous = windows[index - 1];
        if (previous && window.start > previous.end + 1) {
          excerptLines.push('... [excerpt omitted]');
        }
        excerptLines.push(...lines.slice(window.start, window.end + 1));
      });

      let excerpt = `### ${filePath}\n${excerptLines.join('\n')}`.trimEnd();
      if (excerpt.length > perDocMax) {
        const separator = '\n... [excerpt omitted]\n';
        const budget = Math.max(0, perDocMax - separator.length);
        const head = Math.max(200, Math.floor(budget * 0.55));
        const tail = Math.max(200, budget - head);
        excerpt = excerpt.slice(0, head).trimEnd() + separator + excerpt.slice(-tail).trimStart();
      }
      return {
        filePath,
        excerpt,
        hasRelevantSignals: mentionCount > 0 || headingCount > 0,
        mentionCount,
        isReadme: /^README\.md$/i.test(filePath),
      };
    })
    .sort((left, right) => {
      if (left.hasRelevantSignals !== right.hasRelevantSignals) {
        return Number(right.hasRelevantSignals) - Number(left.hasRelevantSignals);
      }
      if (left.isReadme !== right.isReadme) {
        return Number(right.isReadme) - Number(left.isReadme);
      }
      if (left.mentionCount !== right.mentionCount) {
        return right.mentionCount - left.mentionCount;
      }
      return left.filePath.localeCompare(right.filePath);
    });

  const separator = '\n\n---\n\n';
  const parts = [];
  let used = 0;
  let truncated = false;

  for (const entry of excerptEntries) {
    const prefix = parts.length > 0 ? separator : '';
    const available = maxChars - used - prefix.length;
    if (available <= 0) {
      truncated = true;
      break;
    }

    if (entry.excerpt.length <= available) {
      parts.push(prefix + entry.excerpt);
      used += prefix.length + entry.excerpt.length;
      continue;
    }

    if (available < 200) {
      truncated = true;
      break;
    }

    const clipped = entry.excerpt.slice(0, Math.max(0, available - '\n... [truncated]'.length));
    parts.push(prefix + clipped.trimEnd() + '\n... [truncated]');
    truncated = true;
    break;
  }

  const excerpt = parts.join('');
  if (!truncated) return excerpt;
  return excerpt.endsWith('... [truncated]') ? excerpt : `${excerpt}\n... [truncated]`;
}

/**
 * Build documentation context for the Step 3 AI prompt.
 *
 * Prefers full-file evidence for every loaded documentation file. If the
 * combined content exceeds the prompt budget, falls back to targeted excerpts
 * and marks the result as partial evidence.
 *
 * @pure
 * @param {Array<{path: string, content: string}>} docFiles - Documentation files
 * @param {string[]} [scripts=[]] - Script paths in scope
 * @param {number} [maxChars=24000] - Max total characters in the returned context
 * @returns {{content: string, isPartial: boolean}} Documentation context payload
 */
export function buildDocumentationContext(docFiles, scripts = [], maxChars = 24_000) {
  if (!Array.isArray(docFiles) || docFiles.length === 0) {
    return { content: '', isPartial: false };
  }

  const separator = '\n\n---\n\n';
  const fullContent = docFiles
    .map(({ path: filePath, content }) =>
      `### ${filePath}\n${String(content ?? '').trimEnd()}`.trimEnd()
    )
    .join(separator);

  if (fullContent.length <= maxChars) {
    return { content: fullContent, isPartial: false };
  }

  return {
    content: buildDocumentationExcerpts(docFiles, scripts, maxChars),
    isPartial: true,
  };
}

// ============================================================================
// STEP 3 ANALYZER - Impure Wrapper
// ============================================================================

/**
 * Step 3 analyzer for script reference validation
 */
export class Step3ScriptAnalyzer {
  static stepKind = STEP_KIND.PROJECT;

  constructor(options = {}) {
    Object.assign(this, buildStepDependencies(options));
  }

  /**
   * Execute Step 3 script reference validation
   * @param {string} projectRoot - Project root directory
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Analysis result
   */
  async execute(projectRoot, options = {}) {
    try {
      logger.step('Step 3: Script Reference Validation');

      // Phase 1: Detect language and script patterns
      const language = options.language || (await this.detectLanguage(projectRoot));
      const patterns = getScriptPatterns(language);
      const directories = getScriptDirectories(language);

      // Determine the project's primary language for AI prompt context.
      // 'language' above may be 'bash' (used to find shell scripts) even when the
      // project's primary language is TypeScript or JavaScript. Detect separately so
      // the AI receives accurate project context.
      let promptLanguage = language;
      if (language === 'bash') {
        try {
          const det = await this.techStack.detectTechStack(projectRoot);
          promptLanguage =
            det.primaryLanguage || det.languages?.find((l) => l !== 'bash') || 'javascript';
        } catch {
          /* keep bash */
        }
      }

      logger.info(`Language: ${language}, patterns: ${patterns.join(', ')}`);

      // Phase 2: Find all scripts
      const primaryScripts = await this.findScripts(projectRoot, directories, patterns);

      // For non-bash projects, also scan standard shell-script directories so that
      // mixed-language repos (e.g. TypeScript + scripts/*.sh) don't silently skip
      // their bash automation scripts. Dot-directories (e.g. .github/scripts) are
      // listed explicitly because many glob implementations skip them by default.
      let shellScripts = [];
      if (language !== 'bash') {
        shellScripts = await this.findScripts(
          projectRoot,
          ['.github/scripts', 'scripts', '.'],
          ['*.sh']
        );
      }

      const scripts = [...new Set([...primaryScripts, ...shellScripts])];
      if (scripts.length === 0) {
        logger.info('No scripts found - skipping validation');
        return {
          success: true,
          skipped: true,
          reason: 'no_scripts',
          alternatives: [],
          recommendedAlternative: null,
        };
      }

      logger.info(`Found ${scripts.length} script(s)`);

      // Phase 3: Load README and additional doc files for reference checking
      const readmeContent = await this.loadReadme(projectRoot);
      const extraDocs = await this.loadExtraDocs(projectRoot);
      const allDocFiles = [{ path: 'README.md', content: readmeContent }, ...extraDocs].filter(
        ({ content }) => content.length > 0
      );

      // Phase 4: Extract and validate script references
      const allReferences = extractScriptReferences(readmeContent);
      // Validate references matching the detected language's extensions to avoid false
      // positives (e.g. .ts refs when language is bash). When shell scripts were also
      // discovered via the non-bash fallback, include .sh so that README references
      // to missing shell scripts are reported too.
      const patternExts = patterns.map((p) => p.replace('*.', ''));
      if (shellScripts.length > 0) {
        patternExts.push('sh');
      }
      const references = allReferences.filter((ref) => patternExts.includes(ref.split('.').pop()));
      const existingScripts = new Set(scripts);
      const missingReferences = validateScriptReferences(references, existingScripts);

      logger.info(`References: ${references.length}, missing: ${missingReferences.length}`);

      // Phase 5: Check executable permissions (Unix-like only)
      const nonExecutable = await this.checkExecutablePermissions(scripts);
      logger.info(`Non-executable: ${nonExecutable.length}`);

      // Phase 6: Check documentation across all loaded doc files
      const undocumented = scripts.filter(
        (script) => !isScriptDocumented(script, readmeContent, extraDocs)
      );
      logger.info(`Undocumented: ${undocumented.length}`);

      // Phase 7: Generate report
      const totalIssues = missingReferences.length + nonExecutable.length + undocumented.length;
      const results = {
        scriptsFound: scripts.length,
        referencesChecked: references.length,
        totalIssues,
        missingReferences,
        nonExecutable,
        undocumented,
      };

      const report = formatScriptReport(results);
      await this.backlog.saveStepSummary(3, 'Script Reference Validation', report);

      // Phase AI: AI-powered script reference analysis
      let parsedAlternatives = { alternatives: [], recommended: null };
      const aiAvailable = await initializeAiServices(this.aiHelper, this.aiCache);
      if (aiAvailable) {
        let prompt = await buildStepPromptWithFallback({
          buildPrompt: async () => {
            const parsedYaml = await loadResolvedAiHelpers(this.fileOps);
            const coverageMap = buildDocCoverageMap(scripts, allDocFiles);
            const docCoverageMap = formatDocCoverageMap(coverageMap);
            const docContextResult = buildDocumentationContext(allDocFiles, scripts, 24_000);
            return buildYamlStepPrompt(parsedYaml, 'step3_script_refs_prompt', {
              project_name: projectRoot,
              project_description: options.projectDescription || '',
              primary_language: promptLanguage,
              scripts_dir: directories.join(', '),
              script_count: String(results.scriptsFound ?? 0),
              change_scope: options.scope || '',
              modified_count: String(missingReferences.length),
              issues: String(totalIssues),
              script_issues_content: `Broken doc references (referenced in docs but file missing on disk): ${missingReferences.length}\nUndocumented scripts (exist on disk but not found in any doc file): ${undocumented.length}\nNon-executable scripts: ${nonExecutable.length}`,
              all_scripts: scripts.length > 0 ? scripts.join('\n') : 'none',
              doc_coverage_heading:
                '**Script Documentation Coverage (complete across included documentation files):**',
              doc_coverage_map: docCoverageMap || 'No doc files found.',
              doc_coverage_guidance:
                'This coverage map is complete for the documentation files included in this prompt. You may rely on its counts for those files. It does not imply anything about documentation files that were not loaded into this prompt.',
              doc_context_heading: docContextResult.isPartial
                ? '**Documentation Content (partial — included files exceeded the prompt budget and were clipped):**'
                : '**Documentation Content (full for included files):**',
              doc_context: docContextResult.content || 'No documentation files available.',
              doc_context_guidance: docContextResult.isPartial
                ? 'Treat this documentation content as partial evidence. If a file is clipped, omitted, or ends with an explicit truncation marker, keep claims scoped to the visible text and mark broader conclusions as unavailable or inconclusive.'
                : 'These are full contents for the documentation files included in this prompt. You may treat them as complete evidence for those files, but do not infer anything about documentation files that were not included.',
            });
          },
          fallbackRole: `You are an expert in shell scripting and script reference validation.`,
          fallbackTask: `Analyze these script reference validation results for project at "${projectRoot}" and provide recommendations:
- Total scripts: ${results.scriptsFound ?? 0}
- Scripts found: ${scripts.join(', ') || 'none'}
- Missing references: ${missingReferences.length}
- Non-executable scripts: ${nonExecutable.length}
- Undocumented scripts: ${undocumented.length}
- Total issues: ${totalIssues}`,
          fallbackApproach: `List the top 3 actionable recommendations to fix the script reference issues. Be concise.`,
          fallbackProjectContext: {},
        });
        if (options.alternatives) {
          const n = options.alternatives === true ? 2 : options.alternatives;
          prompt += buildAlternativesDirective(n);
        }
        // Build file-content hash entries from doc files (already read) + script paths.
        const fileHashEntries = [
          ...allDocFiles.map(({ path: p, content }) => `${p}:${content}`),
          ...scripts.map((s) => `script:${s}`),
        ];
        const aiResult = await this.aiCache.withFileChangeGuard('step_03_v2', fileHashEntries, () =>
          this.aiHelper.executeRequest(prompt, {
            persona: 'devops_engineer',
            model: 'claude-haiku-4.5',
          })
        );
        const aiContent = aiResult?.content ?? '';
        parsedAlternatives = options.alternatives
          ? parseAlternatives(aiContent)
          : { alternatives: [], recommended: null };
        if (aiContent) {
          const enrichedReport = appendAiRecommendations(report, aiContent);
          await this.backlog.saveStepSummary(3, 'Script Reference Validation', enrichedReport);
        }
      } else {
        logger.warn('AI helper not available - skipping AI analysis');
      }

      if (totalIssues === 0) {
        logger.success('Step 3 completed - no issues found');
      } else {
        logger.warn(`Step 3 completed - ${totalIssues} issue(s) found`);
      }

      return {
        success: true,
        ...results,
        alternatives: parsedAlternatives.alternatives,
        recommendedAlternative: parsedAlternatives.recommended,
      };
    } catch (error) {
      logger.error(`Step 3 failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Detect primary language from project
   * @param {string} projectRoot - Project root directory
   * @returns {Promise<string>} Detected language
   */
  async detectLanguage(projectRoot) {
    return getPrimaryLanguage(this.techStack, projectRoot, 'bash');
  }

  /**
   * Find all scripts in directories
   * @param {string} projectRoot - Project root directory
   * @param {string[]} directories - Directories to search
   * @param {string[]} patterns - File patterns
   * @returns {Promise<string[]>} Array of script paths
   */
  async findScripts(projectRoot, directories, patterns) {
    const scripts = [];
    const exclude = [
      'node_modules',
      '.git',
      'dist',
      'build',
      'coverage',
      '.husky/_',
      'venv',
      '.venv',
    ];

    for (const dir of directories) {
      for (const pattern of patterns) {
        try {
          // path.join normalises '.' away so './*.sh' becomes '*.sh',
          // which minimatch can correctly match against bare relative paths.
          const directPattern = path.join(dir, pattern);
          const recursivePattern = path.join(dir, '**', pattern);

          // Match files directly in the directory
          const direct = await this.fileOps.glob(directPattern, {
            cwd: projectRoot,
            ignore: exclude.map((ex) => `**/${ex}/**`),
          });
          scripts.push(...direct);
          // Match files in subdirectories
          const recursive = await this.fileOps.glob(recursivePattern, {
            cwd: projectRoot,
            ignore: exclude.map((ex) => `**/${ex}/**`),
          });
          scripts.push(...recursive);
        } catch {
          // Directory or pattern not found, continue
        }
      }
    }

    return [...new Set(scripts)]; // Remove duplicates
  }

  /**
   * Load README content
   * @param {string} projectRoot - Project root directory
   * @returns {Promise<string>} README content or empty string
   */
  async loadReadme(projectRoot) {
    const readmeFiles = ['README.md', 'README.MD', 'readme.md', 'Readme.md'];

    for (const file of readmeFiles) {
      try {
        return await this.fileOps.readFile(`${projectRoot}/${file}`);
      } catch {
        // Try next variant
      }
    }

    return ''; // No README found
  }

  /**
   * Load additional doc files (API.md, ARCHITECTURE.md, and up to 3 more docs/*.md).
   * Excludes README (already loaded separately) and CHANGELOG/LICENSE which rarely
   * contain script references.
   * @param {string} projectRoot - Project root directory
   * @returns {Promise<Array<{path: string, content: string}>>} Doc files with content
   */
  async loadExtraDocs(projectRoot) {
    const candidates = [
      'scripts/README.md',
      'docs/INTEGRATION.md',
      'docs/DOCKER_TESTING.md',
      'docs/reference/COMMAND_CHEAT_SHEET.md',
      'docs/API.md',
      'docs/ARCHITECTURE.md',
      'docs/GETTING_STARTED.md',
      'docs/CONTRIBUTING.md',
      'CONTRIBUTING.md',
    ];
    const results = [];
    for (const relPath of candidates) {
      if (results.length >= 6) break; // cap to avoid bloating prompt
      try {
        const content = await this.fileOps.readFile(`${projectRoot}/${relPath}`);
        if (content.length > 0) results.push({ path: relPath, content });
      } catch {
        // File does not exist — skip silently
      }
    }
    return results;
  }

  /**
   * Check executable permissions on scripts
   * @param {string[]} scripts - Script file paths
   * @returns {Promise<string[]>} Non-executable scripts
   */
  async checkExecutablePermissions(scripts) {
    const nonExecutable = [];

    for (const script of scripts) {
      try {
        const stats = await this.fileOps.stat(script);
        // Check if file has execute permission (Unix-like systems)
        // mode & 0o111 checks if any execute bit is set
        if (stats.mode && !(stats.mode & 0o111)) {
          nonExecutable.push(script);
        }
      } catch {
        // File not accessible, skip
      }
    }

    return nonExecutable;
  }
}

export default Step3ScriptAnalyzer;
