/**
 * Step 4: Configuration Validation
 * @version 2.0.0
 * @description Validate configuration files for syntax, security, and best practices
 * @module steps/step_04_config_validation
 * Part of: AI Workflow Automation (Phase 9)
 */

import path from 'path';
import yaml from 'js-yaml';
import { STEP_KIND } from './step_contract.js';
import logger from '../core/logger.js';
import { GitAutomation } from '../lib/git_automation.js';
import {
  buildStepDependencies,
  initializeAiServices,
  appendAiRecommendations,
} from './step_analysis_helpers.js';
import {
  buildYamlStepPrompt,
  buildAlternativesDirective,
  parseAlternatives,
  loadResolvedAiHelpers,
} from '../lib/ai_prompt_builder.js';
import { buildStepPromptWithFallback } from './step_execution_helpers.js';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Directories to exclude from configuration file discovery (applied to both
 * the git-modified-files path and the glob fallback).
 */
export const EXCLUDE_DIRS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.ai_cache',
  '.ai_workflow',
  '.olinda',
  'venv',
  '.venv',
  'env',
];

/**
 * Configuration file patterns
 */
export const CONFIG_PATTERNS = {
  json: /\.(json|jsonc)$/,
  yaml: /\.(ya?ml)$/,
  toml: /\.toml$/,
  ini: /\.ini$/,
  env: /^\.env(\.\w+)?$/,
  docker: /^(Dockerfile|\.dockerignore|docker-compose.*\.ya?ml)$/,
  ci: /\.(github\/workflows\/.*\.ya?ml|\.circleci\/config\.yml|\.gitlab-ci\.yml|Jenkinsfile)$/,
  editor: /^(\.editorconfig|\.nvmrc|\.node-version|\.mdlrc)$/,
  git: /^\.gitignore$/,
  make: /^Makefile$/,
};

/**
 * Generated configuration artifacts that should be validated and reported
 * through their authoritative workflow config sources instead of directly.
 */
export const GENERATED_CONFIG_REPLACEMENTS = {
  '.workflow_core/config/ai_helpers.yaml': [
    '.workflow_core/.workflow-config.yaml',
    '.workflow-config.yaml',
  ],
};

/**
 * Secret patterns to detect
 */
export const SECRET_PATTERNS = [
  { name: 'AWS Key', pattern: /AKIA[0-9A-Z]{16}/ },
  { name: 'API Key', pattern: /(api[_-]?key|apikey)[\s:=]\s*["']?([a-zA-Z0-9_-]{20,})/i },
  { name: 'Private Key', pattern: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: 'OAuth Token', pattern: /(oauth|token)[\s:=]\s*["']?([a-zA-Z0-9_-]{30,})/i },
  { name: 'Password', pattern: /(password|passwd|pwd)[\s:=]\s*["']?([^\s"']{8,})/i },
  { name: 'Secret Key', pattern: /(secret[_-]?key|secretkey)[\s:=]\s*["']?([a-zA-Z0-9_-]{20,})/i },
];

/**
 * Issue types
 */
export const CONFIG_ISSUE_TYPE = {
  SYNTAX_ERROR: 'syntax_error',
  SECURITY_RISK: 'security_risk',
  INVALID_VALUE: 'invalid_value',
  MISSING_REQUIRED: 'missing_required',
};

/**
 * Maximum content size per file included in the AI prompt (characters).
 * Limits token usage while still providing actionable context.
 */
export const MAX_FILE_CONTENT_CHARS = 2000;

/**
 * Minimum fraction of listed files the AI response must mention to be considered adequate.
 */
export const MIN_FILE_MENTION_RATIO = 0.3;

/**
 * Maximum size of a single prompt entry before it is split into labeled parts.
 * This is intentionally higher than MAX_FILE_CONTENT_CHARS because step 04 now
 * partitions oversized scope into multiple AI requests instead of truncating
 * everything into one inconclusive prompt.
 */
export const MAX_PROMPT_ENTRY_CHARS = 4000;

/**
 * Maximum aggregate prompt-entry payload per AI request.
 */
export const MAX_PROMPT_PARTITION_CHARS = 9000;
export const MAX_AI_CONFIG_PARTITIONS = 6;

/**
 * Maximum number of prompt entries per partition.
 */
export const MAX_PROMPT_ENTRIES_PER_PARTITION = 4;

// ============================================================================
// PURE FUNCTIONS - File Classification
// ============================================================================

/**
 * Check if file is a configuration file
 * @pure
 * @param {string} filePath - File path to check
 * @returns {boolean} True if configuration file
 */
export function isConfigFile(filePath) {
  const fileName = filePath.split('/').pop();

  return Object.values(CONFIG_PATTERNS).some((pattern) => {
    if (pattern instanceof RegExp) {
      return pattern.test(fileName) || pattern.test(filePath);
    }
    return false;
  });
}

/**
 * Get configuration file type
 * @pure
 * @param {string} filePath - File path
 * @returns {string} Configuration type (json, yaml, etc.)
 */
export function getConfigType(filePath) {
  const fileName = filePath.split('/').pop();

  // Check most specific patterns first
  const priorityOrder = [
    'ci',
    'docker',
    'editor',
    'git',
    'make',
    'env',
    'toml',
    'ini',
    'yaml',
    'json',
  ];

  for (const type of priorityOrder) {
    const pattern = CONFIG_PATTERNS[type];
    if (pattern && (pattern.test(fileName) || pattern.test(filePath))) {
      return type;
    }
  }

  return 'unknown';
}

function normalizeConfigPath(filePath) {
  return String(filePath ?? '').replace(/\\/g, '/');
}

function getGeneratedConfigReplacementPaths(filePath) {
  return GENERATED_CONFIG_REPLACEMENTS[normalizeConfigPath(filePath)] ?? [];
}

// ============================================================================
// PURE FUNCTIONS - Syntax Validation
// ============================================================================

/**
 * Strip JSON comments to support JSONC format (tsconfig.json, .vscode/settings.json, etc.)
 * @pure
 * @param {string} content - JSONC content
 * @returns {string} Content with comments removed
 */
export function stripJsonComments(content) {
  // State-machine approach: track string literals so /* or // inside them are not treated as comments
  let result = '';
  let i = 0;
  while (i < content.length) {
    const ch = content[i];
    // Inside a string literal: copy chars, honour escape sequences
    if (ch === '"') {
      result += ch;
      i++;
      while (i < content.length) {
        const sc = content[i];
        if (sc === '\\') {
          // Escape sequence — copy both characters
          result += sc + (content[i + 1] ?? '');
          i += 2;
        } else if (sc === '"') {
          result += sc;
          i++;
          break;
        } else {
          result += sc;
          i++;
        }
      }
      continue;
    }
    // Block comment /* ... */ — preserve newlines to keep line numbers intact
    if (ch === '/' && content[i + 1] === '*') {
      const end = content.indexOf('*/', i + 2);
      if (end === -1) break; // unterminated — stop
      const comment = content.slice(i, end + 2);
      result += comment.replace(/[^\n]/g, ' ');
      i = end + 2;
      continue;
    }
    // Line comment // ... — drop until end of line
    if (ch === '/' && content[i + 1] === '/') {
      const end = content.indexOf('\n', i + 2);
      if (end === -1) break;
      i = end; // keep the newline itself
      continue;
    }
    result += ch;
    i++;
  }
  return result;
}

/**
 * Validate JSON syntax (JSONC-aware: supports // and block comments)
 * @pure
 * @param {string} content - JSON or JSONC content
 * @returns {Object} Validation result
 */
export function validateJsonSyntax(content) {
  try {
    JSON.parse(stripJsonComments(content));
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error.message,
      line: error.lineNumber,
      column: error.columnNumber,
    };
  }
}

/**
 * Validate YAML syntax (basic check)
 * @pure
 * @param {string} content - YAML content
 * @returns {Object} Validation result
 */
export function validateYamlSyntax(content) {
  const lines = content.split('\n');
  const issues = [];
  let insideBlockScalar = false;
  let blockScalarIndent = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect block scalar indicators (| or >) at end of a key's value
    const blockScalarMatch = line.match(/^(\s*)[^#\s][^:]*:\s*[|>][-+]?\s*$/);
    if (blockScalarMatch) {
      insideBlockScalar = true;
      blockScalarIndent = blockScalarMatch[1].length;
      continue;
    }

    // Exit block scalar when we return to base indentation level
    if (insideBlockScalar) {
      const indent = line.match(/^(\s*)/)[0].length;
      const isEmpty = line.trim() === '';
      if (!isEmpty && indent <= blockScalarIndent) {
        insideBlockScalar = false;
        blockScalarIndent = -1;
      } else {
        // Content inside block scalar — skip indentation check
        continue;
      }
    }

    // Check for tabs (YAML doesn't allow tabs)
    if (line.includes('\t')) {
      issues.push({
        line: i + 1,
        message: 'YAML does not allow tabs for indentation',
      });
    }

    // Check for inconsistent indentation (YAML keys only, not block scalar content)
    const indent = line.match(/^(\s*)/)[0].length;
    if (indent > 0 && indent % 2 !== 0) {
      issues.push({
        line: i + 1,
        message: 'YAML indentation should be in multiples of 2',
      });
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Validate configuration syntax based on type
 * @pure
 * @param {string} content - File content
 * @param {string} type - Config type (json, yaml, etc.)
 * @returns {Object} Validation result
 */
export function validateConfigSyntax(content, type) {
  switch (type) {
    case 'json':
      return validateJsonSyntax(content);
    case 'yaml':
      return validateYamlSyntax(content);
    case 'toml':
    case 'ini':
    case 'env':
    case 'docker':
    case 'ci':
      // Basic validation for other types
      return { valid: true, note: 'Basic validation only' };
    default:
      return { valid: true, note: 'No validation available' };
  }
}

// ============================================================================
// PURE FUNCTIONS - Security Scanning
// ============================================================================

/**
 * Scan content for potential secrets
 * @pure
 * @param {string} content - File content
 * @param {string} filePath - File path for context
 * @returns {Object[]} Array of security findings
 */
export function scanForSecrets(content, filePath) {
  const findings = [];
  const lines = content.split('\n');

  // Skip .env.example files (they're meant to have placeholder secrets)
  if (filePath.includes('.env.example') || filePath.includes('.env.template')) {
    return findings;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    for (const { name, pattern } of SECRET_PATTERNS) {
      if (pattern.test(line)) {
        findings.push({
          type: CONFIG_ISSUE_TYPE.SECURITY_RISK,
          secretType: name,
          line: i + 1,
          file: filePath,
          preview: line.substring(0, 50) + (line.length > 50 ? '...' : ''),
        });
      }
    }
  }

  return findings;
}

/**
 * Check for common configuration mistakes
 * @pure
 * @param {string} content - File content
 * @param {string} type - Config type
 * @returns {Object[]} Array of issues
 */
export function checkConfigBestPractices(content, type) {
  const issues = [];

  if (type === 'json') {
    // Detect comments by comparing stripped vs original content.  Using stripJsonComments (which
    // uses a string-literal-aware state machine) avoids false positives from glob patterns such as
    // "src/**/*" or "**/*.test.ts" whose /* and */ sequences would fool a plain regex.
    const stripped = stripJsonComments(content);
    if (stripped !== content) {
      issues.push({
        type: CONFIG_ISSUE_TYPE.SYNTAX_ERROR,
        message: 'JSON does not support comments',
      });
    }

    // Check for trailing commas (safe to run on stripped content so embedded patterns don't match)
    if (stripped.match(/,\s*[}\]]/)) {
      issues.push({
        type: CONFIG_ISSUE_TYPE.SYNTAX_ERROR,
        message: 'JSON does not allow trailing commas',
      });
    }
  }

  if (type === 'yaml') {
    // Check for yes/no boolean values (deprecated)
    if (content.match(/:\s*(yes|no)\s*$/m)) {
      issues.push({
        type: CONFIG_ISSUE_TYPE.INVALID_VALUE,
        message: 'Use true/false instead of yes/no for booleans in YAML',
      });
    }
  }

  return issues;
}

// ============================================================================
// PURE FUNCTIONS - Reporting
// ============================================================================

/**
 * Format configuration validation report
 * @pure
 * @param {Object} results - Validation results
 * @returns {string} Formatted markdown content
 */
export function formatConfigReport(results) {
  const lines = [];

  lines.push('## Step 4: Configuration Validation\n');

  // Summary
  lines.push('### Summary');
  lines.push(`- **Files checked**: ${results.filesChecked}`);
  lines.push(`- **Syntax errors**: ${results.syntaxErrors.length}`);
  lines.push(`- **Security findings**: ${results.securityFindings.length}`);
  lines.push(`- **Best practice issues**: ${results.bestPracticeIssues.length}\n`);

  // Status — include best practice issues so the badge matches the detailed counts above
  const totalIssues =
    results.syntaxErrors.length +
    results.securityFindings.length +
    results.bestPracticeIssues.length;
  if (totalIssues === 0) {
    lines.push('✅ **Status**: All configuration files valid\n');
  } else {
    lines.push('⚠️ **Status**: Issues found - review required\n');
  }

  // Syntax errors
  if (results.syntaxErrors.length > 0) {
    lines.push('### Syntax Errors');
    results.syntaxErrors.slice(0, 10).forEach((error) => {
      lines.push(`- **${error.file}** (line ${error.line || 'unknown'}): ${error.error}`);
    });
    if (results.syntaxErrors.length > 10) {
      lines.push(`\n*... and ${results.syntaxErrors.length - 10} more*`);
    }
    lines.push('');
  }

  // Security findings
  if (results.securityFindings.length > 0) {
    lines.push('### Security Findings');
    results.securityFindings.slice(0, 10).forEach((finding) => {
      lines.push(`- **${finding.file}** (line ${finding.line}): ${finding.secretType} detected`);
      lines.push(`  \`${finding.preview}\``);
    });
    if (results.securityFindings.length > 10) {
      lines.push(`\n*... and ${results.securityFindings.length - 10} more*`);
    }
    lines.push('');
  }

  // Best practices
  if (results.bestPracticeIssues.length > 0) {
    lines.push('### Best Practice Issues');
    results.bestPracticeIssues.slice(0, 5).forEach((issue) => {
      lines.push(`- ${issue.message}`);
    });
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Group a list of relative file paths by their parent directory and return a
 * Markdown-formatted string suitable for prompt injection.
 *
 * Files at the project root (no directory separator) are grouped under "Root".
 * Paths with a parent directory are grouped under that directory name.
 *
 * @pure
 * @param {string[]} relPaths - Relative file paths (e.g. ['package.json', '.github/workflows/test.yml'])
 * @returns {string} Markdown grouped list, e.g. "**Root**: package.json\n**\.github/workflows**: test.yml"
 */
export function groupConfigFilesList(relPaths) {
  if (!relPaths || relPaths.length === 0) return '';
  /** @type {Map<string, string[]>} */
  const groups = new Map();
  for (const p of relPaths) {
    const normalizedPath = String(p ?? '').replace(/\\/g, '/');
    const partitionSuffixMatch = normalizedPath.match(/^(.*?)( \(part \d+\/\d+\))$/);
    const basePath = partitionSuffixMatch?.[1] ?? normalizedPath;
    const suffix = partitionSuffixMatch?.[2] ?? '';
    const slash = basePath.lastIndexOf('/');
    const dir = slash === -1 ? 'Root' : basePath.slice(0, slash);
    const fileName = slash === -1 ? basePath : basePath.slice(slash + 1);
    if (!groups.has(dir)) groups.set(dir, []);
    groups.get(dir).push(`${fileName}${suffix}`);
  }
  return Array.from(groups.entries())
    .map(([dir, files]) => `**${dir}**: ${files.join(', ')}`)
    .join('\n');
}

/**
 * Build a formatted block of file contents for inclusion in an AI prompt.
 * Each file is rendered as a fenced code block with its relative path as header.
 * Content is truncated to MAX_FILE_CONTENT_CHARS to limit token usage.
 *
 * @pure
 * @param {Array<{relativePath: string, content: string}>} fileEntries - File data
 * @param {number} [maxChars=MAX_FILE_CONTENT_CHARS] - Per-file character limit
 * @returns {string} Formatted block suitable for prompt injection
 */
export function buildFileContentsBlock(fileEntries, maxChars = MAX_FILE_CONTENT_CHARS) {
  if (!fileEntries || fileEntries.length === 0) return '';
  return fileEntries
    .map(({ relativePath, content }) => {
      const normalizedContent =
        typeof content === 'string' && content.trim().length > 0 ? content : '[empty file]';
      const trimmed =
        normalizedContent.length > maxChars
          ? normalizedContent.slice(0, maxChars) +
            `\n... [truncated — ${normalizedContent.length - maxChars} more chars]`
          : normalizedContent;
      return `--- ${relativePath} ---\n\`\`\`\n${trimmed}\n\`\`\``;
    })
    .join('\n\n');
}

/**
 * Build prompt context for Step 4's supplementary file-level quality review.
 *
 * The supplementary `quality_prompt` expects both an authoritative file-content
 * block and a scope note. Supplying those values keeps the prompt evidence-based
 * and prevents the model from inventing file-specific observations.
 *
 * @pure
 * @param {Array<{relativePath: string, content: string}>} fileEntries - File data
 * @param {Object} [options={}] - Context options
 * @param {number} [options.maxFiles=10] - Max files to include in the prompt
 * @param {number} [options.maxChars=MAX_FILE_CONTENT_CHARS] - Per-file character limit
 * @param {string[]} [options.candidatePaths=[]] - Candidate config files for fallback notes
 * @returns {{
 *   promptFileEntries: Array<{relativePath: string, content: string}>,
 *   candidatePaths: string[],
 *   filesToReview: string,
 *   fileContentMap: string,
 *   qualityScopeNote: string,
 *   reviewUnavailable: boolean
 * }} Prompt context fields
 */
export function buildStep4QualityPromptContext(fileEntries, options = {}) {
  const { maxFiles = 10, maxChars = MAX_FILE_CONTENT_CHARS, candidatePaths = [] } = options;
  const entries = Array.isArray(fileEntries) ? fileEntries : [];
  const candidatePathList = Array.isArray(candidatePaths)
    ? candidatePaths.map((entry) => String(entry))
    : [];
  const promptFileEntries = entries.slice(0, maxFiles).map((entry) => ({
    relativePath: entry.relativePath,
    content: summarizeConfigContentForPrompt(entry.relativePath, entry.content),
  }));
  const omittedFileCount = Math.max(0, entries.length - promptFileEntries.length);
  const truncatedFileCount = promptFileEntries.filter(
    (entry) => typeof entry.content === 'string' && entry.content.length > maxChars
  ).length;

  const scopeParts = [];
  const reviewUnavailable = promptFileEntries.length === 0;
  if (reviewUnavailable) {
    scopeParts.push(
      candidatePathList.length > 0
        ? `Supplementary file-level quality review skipped because none of the ${candidatePathList.length} candidate configuration file(s) had inline excerpts available for prompt injection.`
        : 'No configuration file contents were available for this supplementary quality review.'
    );
  } else {
    scopeParts.push(
      omittedFileCount > 0
        ? `Supplementary file-level quality review scoped to the first ${promptFileEntries.length} of ${entries.length} configuration file(s) in this run.`
        : `Supplementary file-level quality review scoped to ${promptFileEntries.length} configuration file(s) in this run.`
    );
    if (truncatedFileCount > 0) {
      scopeParts.push(
        'Some injected file contents are truncated excerpts; keep any file-wide conclusion limited to the visible text.'
      );
    }
  }

  return {
    promptFileEntries,
    candidatePaths: candidatePathList,
    filesToReview: (reviewUnavailable
      ? candidatePathList
      : promptFileEntries.map((entry) => entry.relativePath)
    ).join(', '),
    fileContentMap: reviewUnavailable
      ? '(unavailable — no inline config excerpts could be prepared for this supplementary review; do not make file-level claims)'
      : buildFileContentsBlock(promptFileEntries, maxChars),
    qualityScopeNote: scopeParts.join(' '),
    reviewUnavailable,
  };
}

/**
 * Build a deterministic fallback note for Step 4's supplementary quality review
 * when no inline excerpts are available to ground an AI response.
 *
 * @pure
 * @param {{
 *   candidatePaths?: string[],
 *   qualityScopeNote?: string,
 *   reviewUnavailable?: boolean
 * }} context - Step 4 quality prompt context
 * @returns {string} Markdown note
 */
export function buildStep4QualityFallbackNote(context = {}) {
  if (!context.reviewUnavailable) {
    return '';
  }

  const affectedScope =
    Array.isArray(context.candidatePaths) && context.candidatePaths.length > 0
      ? groupConfigFilesList(context.candidatePaths)
      : '';

  return [
    '**Evidence gap:** Supplementary file-level quality review was skipped because no inline configuration excerpts were available for this pass.',
    context.qualityScopeNote || '',
    affectedScope ? `**Affected scope:**\n${affectedScope}` : '',
    'To enable concrete file-level findings, inject inline excerpts for the selected configuration files into the supplementary quality prompt.',
  ]
    .filter(Boolean)
    .join('\n\n');
}

/**
 * Build a compact prompt-safe summary for npm lockfiles so the AI can reason
 * about consistency without receiving hundreds of kilobytes of generated data.
 *
 * @pure
 * @param {string} content - Raw package-lock.json content
 * @returns {string} Compact summary text
 */
export function buildPackageLockPromptSummary(content) {
  try {
    const parsed = JSON.parse(stripJsonComments(content));
    const packages =
      parsed && typeof parsed.packages === 'object' && parsed.packages !== null
        ? parsed.packages
        : {};
    const rootPackage =
      packages[''] && typeof packages[''] === 'object' && packages[''] !== null ? packages[''] : {};
    const legacyDependencies =
      parsed && typeof parsed.dependencies === 'object' && parsed.dependencies !== null
        ? parsed.dependencies
        : {};

    const collectDependencySummary = (deps) => {
      const names = Object.keys(deps ?? {}).sort();
      return Object.fromEntries(
        names.map((name) => [
          name,
          {
            declaredSpec: deps?.[name] ?? null,
            resolvedVersion:
              packages[`node_modules/${name}`]?.version ??
              legacyDependencies[name]?.version ??
              null,
          },
        ])
      );
    };

    return [
      '[generated npm lockfile summary]',
      'Raw lockfile content omitted to keep the prompt analyzable; use the summarized fields below for consistency checks against package.json and CI settings.',
      'For dependency comparisons, treat `declaredSpec` as the package.json-aligned source of truth and `resolvedVersion` as the installed lockfile result.',
      JSON.stringify(
        {
          lockfileVersion: parsed.lockfileVersion ?? null,
          packageName: parsed.name ?? rootPackage.name ?? null,
          packageVersion: parsed.version ?? rootPackage.version ?? null,
          packageCount: Object.keys(packages).length,
          rootDependencies: collectDependencySummary(rootPackage.dependencies),
          rootDevDependencies: collectDependencySummary(rootPackage.devDependencies),
        },
        null,
        2
      ),
    ].join('\n');
  } catch {
    return content;
  }
}

/**
 * Normalize oversized config content before prompt assembly.
 *
 * @pure
 * @param {string} relativePath - Relative config path
 * @param {string} content - Raw file content
 * @returns {string} Prompt-safe content
 */
export function summarizeConfigContentForPrompt(relativePath, content) {
  const normalizedPath = String(relativePath ?? '').replace(/\\/g, '/');
  if (/(^|\/)(package-lock\.json|npm-shrinkwrap\.json)$/.test(normalizedPath)) {
    return buildPackageLockPromptSummary(content);
  }
  return content;
}

function splitPromptEntry(entry, maxEntryChars = MAX_PROMPT_ENTRY_CHARS) {
  const preparedContent = summarizeConfigContentForPrompt(entry.relativePath, entry.content);
  if (preparedContent.length <= maxEntryChars) {
    return [
      {
        relativePath: entry.relativePath,
        sourcePath: entry.relativePath,
        content: preparedContent,
      },
    ];
  }

  const totalParts = Math.ceil(preparedContent.length / maxEntryChars);
  const parts = [];
  for (let i = 0; i < totalParts; i++) {
    const start = i * maxEntryChars;
    const end = start + maxEntryChars;
    parts.push({
      relativePath: `${entry.relativePath} (part ${i + 1}/${totalParts})`,
      sourcePath: entry.relativePath,
      content: preparedContent.slice(start, end),
    });
  }
  return parts;
}

function estimatePromptEntryChars(entry) {
  return (entry?.relativePath?.length ?? 0) + (entry?.content?.length ?? 0) + 32;
}

/**
 * Partition config-file prompt payload into multiple AI-safe batches.
 *
 * @pure
 * @param {Array<{relativePath: string, content: string}>} fileEntries - Raw file entries
 * @param {number} [maxPartitionChars=MAX_PROMPT_PARTITION_CHARS] - Max total chars per partition
 * @param {number} [maxEntryChars=MAX_PROMPT_ENTRY_CHARS] - Max chars per prompt entry
 * @returns {Array<{entries: Array<{relativePath: string, sourcePath: string, content: string}>, scopePaths: string[]}>}
 */
export function buildConfigPromptPartitions(
  fileEntries,
  maxPartitionChars = MAX_PROMPT_PARTITION_CHARS,
  maxEntryChars = MAX_PROMPT_ENTRY_CHARS
) {
  if (!Array.isArray(fileEntries) || fileEntries.length === 0) return [];

  const promptEntries = fileEntries.flatMap((entry) => splitPromptEntry(entry, maxEntryChars));
  const partitions = [];
  let currentEntries = [];
  let currentChars = 0;

  const flush = () => {
    if (currentEntries.length === 0) return;
    partitions.push({
      entries: currentEntries,
      scopePaths: [...new Set(currentEntries.map((entry) => entry.sourcePath))],
    });
    currentEntries = [];
    currentChars = 0;
  };

  for (const entry of promptEntries) {
    const entryChars = estimatePromptEntryChars(entry);
    const wouldOverflow =
      currentEntries.length > 0 &&
      (currentChars + entryChars > maxPartitionChars ||
        currentEntries.length >= MAX_PROMPT_ENTRIES_PER_PARTITION);

    if (wouldOverflow) flush();

    currentEntries.push(entry);
    currentChars += entryChars;
  }

  flush();
  return partitions;
}

export function selectConfigPromptPartitions(
  fileEntries,
  { modifiedFiles = [], totalIssues = 0, maxPartitions = MAX_AI_CONFIG_PARTITIONS } = {}
) {
  const entries = Array.isArray(fileEntries) ? fileEntries : [];
  const normalizedModifiedFiles = new Set(
    (Array.isArray(modifiedFiles) ? modifiedFiles : [])
      .map((filePath) => String(filePath || '').replace(/\\/g, '/'))
      .filter(Boolean)
  );

  let scopedEntries = entries;
  let scopeNote = '';
  if (totalIssues === 0 && normalizedModifiedFiles.size > 0) {
    const modifiedEntries = entries.filter((entry) =>
      normalizedModifiedFiles.has(String(entry.relativePath || '').replace(/\\/g, '/'))
    );
    if (modifiedEntries.length > 0 && modifiedEntries.length < entries.length) {
      scopedEntries = modifiedEntries;
      scopeNote = `AI review scoped to ${modifiedEntries.length} modified configuration file(s) because deterministic validation found no confirmed issues.`;
    }
  }

  const promptPartitions = buildConfigPromptPartitions(scopedEntries);
  if (promptPartitions.length <= maxPartitions) {
    return { promptPartitions, scopeNote };
  }

  const cappedPartitions = promptPartitions.slice(0, maxPartitions);
  const cappedNote = `AI review capped to ${maxPartitions} partition(s) out of ${promptPartitions.length} to avoid oversized prompt runs; deterministic validation still covered the full configuration set.`;
  return {
    promptPartitions: cappedPartitions,
    scopeNote: [scopeNote, cappedNote].filter(Boolean).join(' '),
  };
}

/**
 * Assess whether the AI prompt had complete evidence for every listed config file.
 *
 * Evidence is partial when at least one listed file was unreadable (and therefore
 * absent from the injected File Contents block) or when any injected file content
 * had to be truncated to fit the prompt budget.
 *
 * @pure
 * @param {string[]} relativeFilePaths - Relative paths that were listed in scope
 * @param {Array<{relativePath: string, content: string}>} fileEntries - File data actually injected
 * @param {number} [maxChars=MAX_FILE_CONTENT_CHARS] - Per-file character limit
 * @returns {{hasPartialEvidence: boolean, truncatedFiles: string[], unavailableFiles: string[]}}
 */
export function assessPromptEvidence(
  relativeFilePaths,
  fileEntries,
  maxChars = MAX_FILE_CONTENT_CHARS,
  options = {}
) {
  const entries = Array.isArray(fileEntries) ? fileEntries : [];
  const availableFiles = new Set(entries.map((entry) => entry.relativePath));
  const truncatedFiles = entries
    .filter((entry) => typeof entry.content === 'string' && entry.content.length > maxChars)
    .map((entry) => entry.relativePath);
  const summarizedFiles = entries
    .filter(
      (entry) =>
        typeof entry.content === 'string' && /^\[generated [^\n]+ summary\]/im.test(entry.content)
    )
    .map((entry) => entry.relativePath);
  const unavailableFiles = (relativeFilePaths ?? []).filter(
    (filePath) => !availableFiles.has(filePath)
  );
  const totalScopeCount =
    Number.isInteger(options.totalScopeCount) && options.totalScopeCount > 0
      ? options.totalScopeCount
      : (relativeFilePaths ?? []).length;
  const hasPartialScope = totalScopeCount > (relativeFilePaths ?? []).length;

  return {
    hasPartialEvidence:
      truncatedFiles.length > 0 ||
      summarizedFiles.length > 0 ||
      unavailableFiles.length > 0 ||
      hasPartialScope,
    hasPartialScope,
    totalScopeCount,
    truncatedFiles,
    summarizedFiles,
    unavailableFiles,
  };
}

function normalizePromptScopePath(filePath) {
  return String(filePath ?? '')
    .replace(/\\/g, '/')
    .replace(/\s+\(part \d+\/\d+\)$/i, '');
}

function escapeRegex(text) {
  return String(text ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function pathMentionedInResponse(response, filePath) {
  const normalizedPath = normalizePromptScopePath(filePath);
  if (!normalizedPath) return false;

  const basename = normalizedPath.split('/').pop();
  const patterns = [normalizedPath, basename].filter(Boolean).map((candidate) => {
    const escaped = escapeRegex(candidate);
    return new RegExp(`(^|[^A-Za-z0-9_./-])${escaped}($|[^A-Za-z0-9_./-])`, 'i');
  });

  return patterns.some((pattern) => pattern.test(response));
}

function buildOutOfScopeMentions(response, allowedPaths, allRunPaths) {
  const allowed = new Set((allowedPaths ?? []).map(normalizePromptScopePath));
  return [...new Set((allRunPaths ?? []).map(normalizePromptScopePath))]
    .filter((filePath) => filePath && !allowed.has(filePath))
    .filter((filePath) => pathMentionedInResponse(response, filePath));
}

function mergePromptEntrySlices(entries) {
  const grouped = new Map();

  for (const entry of entries ?? []) {
    const sourcePath = normalizePromptScopePath(entry.sourcePath ?? entry.relativePath);
    if (!sourcePath) continue;
    const match = String(entry.relativePath ?? '').match(/\(part (\d+)\/(\d+)\)$/i);
    const partIndex = match ? Number.parseInt(match[1], 10) : 1;
    const existing = grouped.get(sourcePath) ?? [];
    existing.push({ partIndex, content: String(entry.content ?? '') });
    grouped.set(sourcePath, existing);
  }

  return [...grouped.entries()].map(([relativePath, slices]) => ({
    relativePath,
    content: slices
      .sort((a, b) => a.partIndex - b.partIndex)
      .map((slice) => slice.content)
      .join('\n'),
  }));
}

function collectVisibleWorkflowDependencyOverrideIds(fileEntries) {
  const mergedEntries = mergePromptEntrySlices(fileEntries);
  const workflowEntries = mergedEntries.filter((entry) =>
    /(^|\/)\.workflow-config\.ya?ml$/i.test(entry.relativePath)
  );

  const overrideIds = new Set();
  for (const entry of workflowEntries) {
    try {
      const parsed = yaml.load(entry.content);
      const steps = parsed?.workflow?.steps;
      if (!Array.isArray(steps)) continue;
      for (const step of steps) {
        if (
          step &&
          typeof step === 'object' &&
          typeof step.id === 'string' &&
          typeof step.dependency_comment === 'string' &&
          step.dependency_comment.trim()
        ) {
          overrideIds.add(step.id.trim());
        }
      }
    } catch {
      continue;
    }
  }

  return [...overrideIds].sort();
}

function buildMissingDependencyOverrides(response, fileEntries) {
  const visibleOverrideIds = collectVisibleWorkflowDependencyOverrideIds(fileEntries);
  if (visibleOverrideIds.length <= 1) {
    return { visibleOverrideIds, missingDependencyOverrides: [] };
  }

  const mentionedOverrideIds = visibleOverrideIds.filter((stepId) =>
    new RegExp(`\\b${escapeRegex(stepId)}\\b`, 'i').test(response)
  );
  const claimsExhaustiveCoverage =
    /\b(no other|no additional|only|single|one documented override|one override|only override|only non-canonical)\b/i.test(
      response
    ) && /\b(override|rewire|dependency_comment|canonical)\b/i.test(response);

  return {
    visibleOverrideIds,
    missingDependencyOverrides:
      claimsExhaustiveCoverage && mentionedOverrideIds.length > 0
        ? visibleOverrideIds.filter((stepId) => !mentionedOverrideIds.includes(stepId))
        : [],
  };
}

/**
 * Validate whether an AI response handled truncated or unavailable file evidence safely.
 *
 * @pure
 * @param {string} aiResponse - AI response text
 * @param {string[]} relativeFilePaths - Relative paths that were listed in scope
 * @param {Array<{relativePath: string, content: string}>} fileEntries - File data actually injected
 * @param {number} [maxChars=MAX_FILE_CONTENT_CHARS] - Per-file character limit
 * @returns {{
 *   adequate: boolean,
 *   reason: string,
 *   hasPartialEvidence: boolean,
 *   truncatedFiles: string[],
 *   unavailableFiles: string[]
 * }}
 */
export function validateAiResponseEvidenceHandling(
  aiResponse,
  relativeFilePaths,
  fileEntries,
  maxChars = MAX_FILE_CONTENT_CHARS,
  options = {}
) {
  const evidence = assessPromptEvidence(relativeFilePaths, fileEntries, maxChars, options);
  const scopeFileCount = (relativeFilePaths ?? []).length;
  if (!evidence.hasPartialEvidence) {
    const response = String(aiResponse ?? '');
    const outOfScopeMentions = buildOutOfScopeMentions(
      response,
      relativeFilePaths,
      options.allRunPaths ?? relativeFilePaths
    );
    const { visibleOverrideIds, missingDependencyOverrides } = buildMissingDependencyOverrides(
      response,
      fileEntries
    );
    const filesCheckedMatch = response.match(/\bFiles checked\b[^0-9]{0,12}(\d+)\b/i);
    const reportedFileCount = filesCheckedMatch ? Number.parseInt(filesCheckedMatch[1], 10) : null;

    if (
      outOfScopeMentions.length === 0 &&
      missingDependencyOverrides.length === 0 &&
      (reportedFileCount === null || reportedFileCount === scopeFileCount)
    ) {
      return {
        adequate: true,
        reason: 'all listed files were available in full',
        outOfScopeMentions,
        visibleOverrideIds,
        missingDependencyOverrides,
        reportedFileCount,
        scopeFileCount,
        ...evidence,
      };
    }

    const issues = [];
    if (outOfScopeMentions.length > 0) {
      issues.push(`out-of-scope references: ${outOfScopeMentions.join(', ')}`);
    }
    if (missingDependencyOverrides.length > 0) {
      issues.push(`missing visible dependency overrides: ${missingDependencyOverrides.join(', ')}`);
    }
    if (reportedFileCount !== null && reportedFileCount !== scopeFileCount) {
      issues.push(`reported ${reportedFileCount} files checked for a ${scopeFileCount}-file scope`);
    }

    return {
      adequate: false,
      reason: `AI response overreaches the current scope (${issues.join('; ')})`,
      outOfScopeMentions,
      visibleOverrideIds,
      missingDependencyOverrides,
      reportedFileCount,
      scopeFileCount,
      ...evidence,
    };
  }

  const response = String(aiResponse ?? '');
  const acknowledgesPartialEvidence =
    /\b(inconclusive|unavailable|truncated|partial evidence|visible excerpt|visible excerpts|provided excerpt|content unavailable|summarized fields|summary only)\b/i.test(
      response
    );
  const acknowledgesPartialScope =
    /\b(this partition|current partition|this request|current request|current scope|files in this partition|files in this request|visible file|visible files)\b/i.test(
      response
    );
  const hasUnqualifiedSuccessClaim =
    /\bAll configuration files validated successfully\b/i.test(response) ||
    /\b(?:all|every|both|each)\s+(?:configuration\s+)?files?\b[\s\S]{0,60}\b(?:validated|pass(?:ed)?|clean|issue[- ]free|no issues)\b/i.test(
      response
    ) ||
    (/\bNo issues detected\b/i.test(response) &&
      !(acknowledgesPartialEvidence || (evidence.hasPartialScope && acknowledgesPartialScope)));
  const filesCheckedMatch = response.match(/\bFiles checked\b[^0-9]{0,12}(\d+)\b/i);
  const reportedFileCount = filesCheckedMatch ? Number.parseInt(filesCheckedMatch[1], 10) : null;
  const outOfScopeMentions = buildOutOfScopeMentions(
    response,
    relativeFilePaths,
    options.allRunPaths ?? relativeFilePaths
  );
  const { visibleOverrideIds, missingDependencyOverrides } = buildMissingDependencyOverrides(
    response,
    fileEntries
  );
  const hasScopeOverreach =
    outOfScopeMentions.length > 0 ||
    missingDependencyOverrides.length > 0 ||
    (reportedFileCount !== null && reportedFileCount !== scopeFileCount);

  if (!hasUnqualifiedSuccessClaim && !hasScopeOverreach) {
    return {
      adequate: true,
      reason: 'partial evidence handled without an unqualified full-success claim',
      outOfScopeMentions,
      visibleOverrideIds,
      missingDependencyOverrides,
      reportedFileCount,
      scopeFileCount,
      ...evidence,
    };
  }

  const details = [];
  if (evidence.truncatedFiles.length > 0) {
    details.push(`truncated: ${evidence.truncatedFiles.join(', ')}`);
  }
  if (evidence.summarizedFiles.length > 0) {
    details.push(`summarized: ${evidence.summarizedFiles.join(', ')}`);
  }
  if (evidence.unavailableFiles.length > 0) {
    details.push(`unavailable: ${evidence.unavailableFiles.join(', ')}`);
  }
  if (evidence.hasPartialScope) {
    details.push(
      `partial scope: ${scopeFileCount} of ${evidence.totalScopeCount} file(s) in this run`
    );
  }
  if (outOfScopeMentions.length > 0) {
    details.push(`out-of-scope references: ${outOfScopeMentions.join(', ')}`);
  }
  if (missingDependencyOverrides.length > 0) {
    details.push(`missing visible dependency overrides: ${missingDependencyOverrides.join(', ')}`);
  }
  if (reportedFileCount !== null && reportedFileCount !== scopeFileCount) {
    details.push(`reported ${reportedFileCount} files checked for a ${scopeFileCount}-file scope`);
  }

  return {
    adequate: false,
    reason: `AI response claims full validation despite partial evidence (${details.join('; ')})`,
    outOfScopeMentions,
    visibleOverrideIds,
    missingDependencyOverrides,
    reportedFileCount,
    scopeFileCount,
    ...evidence,
  };
}

/**
 * Rewrite unsafe full-success claims when prompt evidence was partial.
 *
 * @pure
 * @param {string} aiResponse - AI response text
 * @param {{hasPartialEvidence: boolean}} evidence - Evidence assessment
 * @returns {string} Response with misleading global-success claims narrowed
 */
export function normalizeAiResponseForPartialEvidence(aiResponse, evidence) {
  let response = String(aiResponse ?? '');
  if (response.length === 0) {
    return response;
  }

  if (Array.isArray(evidence?.outOfScopeMentions) && evidence.outOfScopeMentions.length > 0) {
    const lines = response.split('\n');
    const filteredLines = lines.filter(
      (line) =>
        !evidence.outOfScopeMentions.some((filePath) => pathMentionedInResponse(line, filePath))
    );
    if (filteredLines.length > 0) {
      response = filteredLines.join('\n');
    }
  }

  if (Number.isInteger(evidence?.reportedFileCount) && Number.isInteger(evidence?.scopeFileCount)) {
    response = response.replace(
      /(\bFiles checked\b[^0-9]{0,12})(\d+)\b/i,
      `$1${evidence.scopeFileCount}`
    );
  }

  response = response
    .replace(
      /\bAll configuration files validated successfully\b/gi,
      evidence?.hasPartialScope
        ? 'Configuration validation is limited to the current partition or scoped request'
        : 'Configuration validation remains inconclusive for summarized, truncated, or unavailable file content'
    )
    .replace(
      /\bNo issues detected\b/gi,
      evidence?.hasPartialScope
        ? 'No issues detected in the visible files for this partition or scoped request'
        : 'No issues detected in the visible excerpts'
    );

  const notes = [];
  if (Array.isArray(evidence?.outOfScopeMentions) && evidence.outOfScopeMentions.length > 0) {
    notes.push(
      `> **Scope note:** References to files outside the current request were removed (${evidence.outOfScopeMentions.join(', ')}).`
    );
  }
  if (
    Array.isArray(evidence?.missingDependencyOverrides) &&
    evidence.missingDependencyOverrides.length > 0
  ) {
    notes.push(
      `> **Override note:** Visible \`.workflow-config.yaml\` dependency overrides requiring explicit coverage: ${evidence.missingDependencyOverrides.join(', ')}.`
    );
  }

  return [notes.join('\n'), response].filter(Boolean).join('\n\n');
}

/**
 * Validate that an AI response adequately covers the listed files.
 * Checks that at least MIN_FILE_MENTION_RATIO of the short filenames appear in the response.
 *
 * @pure
 * @param {string} aiResponse - AI response text
 * @param {string[]} relativeFilePaths - Relative paths that should be addressed
 * @param {number} [minRatio=MIN_FILE_MENTION_RATIO] - Minimum coverage fraction
 * @returns {{adequate: boolean, reason: string, coverage: number}}
 */
export function validateAiResponseQuality(
  aiResponse,
  relativeFilePaths,
  minRatio = MIN_FILE_MENTION_RATIO
) {
  if (!relativeFilePaths || relativeFilePaths.length === 0) {
    return { adequate: true, reason: 'no files to check', coverage: 1 };
  }
  if (!aiResponse || aiResponse.trim().length === 0) {
    return { adequate: false, reason: 'empty response', coverage: 0 };
  }
  const mentioned = relativeFilePaths.filter((fp) => {
    // Match by basename or any suffix of the path
    const parts = fp.replace(/\\/g, '/').split('/');
    return parts.some((part) => part && aiResponse.includes(part));
  });
  const coverage = mentioned.length / relativeFilePaths.length;
  if (coverage < minRatio) {
    return {
      adequate: false,
      reason: `AI response mentions only ${mentioned.length}/${relativeFilePaths.length} files (${Math.round(coverage * 100)}% < ${Math.round(minRatio * 100)}% threshold)`,
      coverage,
    };
  }
  return { adequate: true, reason: 'sufficient file coverage', coverage };
}

// ============================================================================
// STEP 4 ANALYZER - Impure Wrapper
// ============================================================================

/**
 * Step 4 analyzer for configuration validation
 */
export class Step4ConfigAnalyzer {
  static stepKind = STEP_KIND.PROJECT;

  constructor(options = {}) {
    Object.assign(this, buildStepDependencies(options));
    this.gitOps = options.gitOps || new GitAutomation();
  }

  /**
   * Execute Step 4 configuration validation
   * @param {string} projectRoot - Project root directory
   * @param {Object} options - Execution options
   * @param {string} [options.projectKind] - Detected project kind
   * @returns {Promise<Object>} Analysis result
   */
  async execute(projectRoot, options = {}) {
    try {
      logger.step('Step 4: Configuration Validation');

      // Phase 1: Discover configuration files
      const declaredFiles =
        Array.isArray(options.configFiles) && options.configFiles.length > 0
          ? options.configFiles
          : null;
      let configFiles = await this.discoverConfigFiles(projectRoot, declaredFiles);
      configFiles = await this.resolveConfigFilesForValidation(projectRoot, configFiles);
      if (configFiles.length === 0) {
        logger.info('No configuration files found - skipping validation');
        return {
          success: true,
          skipped: true,
          reason: 'no_config_files',
          alternatives: [],
          recommendedAlternative: null,
        };
      }

      logger.info(`Found ${configFiles.length} configuration file(s)`);

      // Phase 2: Validate syntax
      const syntaxErrors = [];
      for (const file of configFiles) {
        const errors = await this.validateFileSyntax(file);
        syntaxErrors.push(...errors);
      }

      logger.info(`Syntax validation: ${syntaxErrors.length} error(s)`);
      for (const err of syntaxErrors) {
        logger.warn(`  ${err.file} (line ${err.line ?? 'unknown'}): ${err.error ?? err.message}`);
      }

      // Phase 3: Scan for secrets
      const securityFindings = [];
      for (const file of configFiles) {
        const findings = await this.scanFileForSecrets(file);
        securityFindings.push(...findings);
      }

      logger.info(`Security scan: ${securityFindings.length} finding(s)`);

      // Phase 4: Check best practices
      const bestPracticeIssues = [];
      for (const file of configFiles) {
        const issues = await this.checkFileBestPractices(file);
        bestPracticeIssues.push(...issues);
      }

      logger.info(`Best practices: ${bestPracticeIssues.length} issue(s)`);

      // Phase 5: Generate report
      const results = {
        filesChecked: configFiles.length,
        syntaxErrors,
        securityFindings,
        bestPracticeIssues,
      };

      const report = formatConfigReport(results);
      await this.backlog.saveStepSummary(4, 'Configuration Validation', report);

      // Phase AI: AI-powered configuration analysis
      let parsedAlternatives = { alternatives: [], recommended: null };
      let evidenceInadequate = false;
      const totalIssues = syntaxErrors.length + securityFindings.length + bestPracticeIssues.length;
      const aiAvailable = await initializeAiServices(this.aiHelper, this.aiCache);
      if (aiAvailable) {
        // Detect tech stack for prompt context
        let projectKind = options.projectKind ?? '';
        let techStackSummary = '';
        try {
          const detection = await this.techStack.detectTechStack(projectRoot);
          if (!projectKind) projectKind = detection.primaryLanguage || '';
          techStackSummary = [
            detection.primaryLanguage,
            ...(detection.frameworks ?? []).map((f) => (typeof f === 'string' ? f : f.name)),
          ]
            .filter(Boolean)
            .join(', ');
        } catch {
          /* tech stack detection is optional */
        }

        // Read file contents so the AI can actually analyze them
        const relPaths = configFiles.map((f) => path.relative(projectRoot, f));
        const fileEntries = [];
        for (let i = 0; i < configFiles.length; i++) {
          try {
            const content = await this.fileOps.readFile(configFiles[i]);
            fileEntries.push({ relativePath: relPaths[i], content });
          } catch {
            /* skip unreadable files */
          }
        }
        const parsedYaml = await loadResolvedAiHelpers(this.fileOps).catch(() => null);
        const { promptPartitions, scopeNote: promptScopeNote } = selectConfigPromptPartitions(
          fileEntries,
          {
            modifiedFiles: options.modifiedFiles ?? [],
            totalIssues,
          }
        );
        const aiSections = [];
        const alternativeBodies = [];

        if (promptScopeNote) {
          logger.info(`[step_04] ${promptScopeNote}`);
        }
        if (promptPartitions.length > 1) {
          logger.info(
            `[step_04] Running AI analysis in ${promptPartitions.length} partition(s) to avoid prompt truncation`
          );
        }

        for (let i = 0; i < promptPartitions.length; i++) {
          const partition = promptPartitions[i];
          const partitionDisplayPaths = partition.entries.map((entry) => entry.relativePath);
          const partitionFileEntries = partition.entries.map((entry) => ({
            relativePath: entry.relativePath,
            sourcePath: entry.sourcePath ?? entry.relativePath,
            content: entry.content,
          }));
          const filesContentBlock = buildFileContentsBlock(
            partitionFileEntries,
            Number.MAX_SAFE_INTEGER
          );

          const partitionHeader =
            promptPartitions.length > 1
              ? `[Partition ${i + 1} of ${promptPartitions.length} — analyze ONLY the files/slices listed below for this request]`
              : '';
          const partitionScopeNote =
            promptPartitions.length > 1
              ? `This partition covers ${partition.scopePaths.length} of ${configFiles.length} configuration files in the current run. Entries labeled "(part X/Y)" are deliberate sequential slices created to avoid prompt truncation; analyze only the visible slice(s) in this request.`
              : 'This request contains the full configuration-file scope for this run.';
          const fullPartitionScopeNote = [partitionScopeNote, promptScopeNote]
            .filter(Boolean)
            .join(' ');

          let prompt = await buildStepPromptWithFallback({
            buildPrompt: async () =>
              buildYamlStepPrompt(parsedYaml, 'configuration_specialist_prompt', {
                project_name: path.basename(projectRoot),
                partition_header: partitionHeader,
                partition_scope_note: fullPartitionScopeNote,
                partition_config_count: String(partition.scopePaths.length),
                config_files_list: groupConfigFilesList(partitionDisplayPaths),
                config_files_content: filesContentBlock,
                config_count: String(configFiles.length),
                project_kind: projectKind,
                tech_stack: techStackSummary,
              }),
            fallbackRole: `You are a configuration validation specialist and security expert.`,
            fallbackTask: `Analyze these configuration files for project at "${projectRoot}":
- Partition: ${i + 1}/${promptPartitions.length}
- Files in this request: ${partitionDisplayPaths.join(', ')}
- Total config files in run: ${configFiles.length}
- Syntax errors found: ${syntaxErrors.length}
- Security findings: ${securityFindings.length}
- Best practice issues: ${bestPracticeIssues.length}
- Total issues: ${totalIssues}

${fullPartitionScopeNote}

${filesContentBlock}`,
            fallbackApproach: `Provide concise, actionable remediation steps for the most critical issues found.`,
            fallbackProjectContext: {},
          });
          if (options.alternatives) {
            const n = options.alternatives === true ? 2 : options.alternatives;
            prompt += buildAlternativesDirective(n);
          }

          const fileHashEntries = partition.entries.map(
            (entry) => `${entry.relativePath}:${entry.content}`
          );
          const aiResult = await this.aiCache.withFileChangeGuard(
            `step_04_p${i}`,
            fileHashEntries,
            () =>
              this.aiHelper.executeRequest(prompt, {
                persona: 'devops_engineer',
                model: 'claude-haiku-4.5',
                timeout: 120000,
              })
          );
          let aiContent = aiResult?.content ?? '';
          let aiValidationNote = '';

          const evidenceQuality = validateAiResponseEvidenceHandling(
            aiContent,
            partitionDisplayPaths,
            partitionFileEntries,
            Number.MAX_SAFE_INTEGER,
            {
              totalScopeCount: configFiles.length,
              allRunPaths: fileEntries.map((entry) => entry.relativePath),
            }
          );
          if (!evidenceQuality.adequate) {
            logger.warn(`Step 4 AI evidence handling low: ${evidenceQuality.reason}`);
            aiContent = normalizeAiResponseForPartialEvidence(aiContent, evidenceQuality);
            aiValidationNote = `> **Validation note:** ${evidenceQuality.reason}`;
            evidenceInadequate = true;
          }

          const quality = validateAiResponseQuality(aiContent, partition.scopePaths);
          if (!quality.adequate) {
            logger.warn(`Step 4 AI response quality low: ${quality.reason}`);
          }

          const partitionBody = [aiValidationNote, aiContent].filter(Boolean).join('\n\n');
          if (partitionBody) {
            aiSections.push(
              promptPartitions.length > 1
                ? `### Partition ${i + 1} of ${promptPartitions.length}\n\n${partitionBody}`
                : partitionBody
            );
            alternativeBodies.push(partitionBody);
          }
        }

        parsedAlternatives = options.alternatives
          ? parseAlternatives(alternativeBodies.join('\n\n'))
          : { alternatives: [], recommended: null };

        // Supplementary: quality_prompt for file-level quality review
        let qualityContent = '';
        try {
          const qualityPromptContext = buildStep4QualityPromptContext(fileEntries, {
            candidatePaths: configFiles,
          });
          if (qualityPromptContext.reviewUnavailable) {
            qualityContent = buildStep4QualityFallbackNote(qualityPromptContext);
          } else {
            const qualityFileHashEntries = qualityPromptContext.promptFileEntries.map(
              (entry) => `${entry.relativePath}:${entry.content}`
            );
            const qPrompt = buildYamlStepPrompt(parsedYaml, 'quality_prompt', {
              files_to_review: qualityPromptContext.filesToReview,
              project_name: projectRoot,
              file_content_map: qualityPromptContext.fileContentMap,
              quality_scope_note: qualityPromptContext.qualityScopeNote,
            });
            if (qPrompt && qualityFileHashEntries.length > 0) {
              // Use 'code_quality_analyst' persona: quality_prompt defines a "senior code review
              // specialist" role (anti-patterns, best practices, maintainability) — not security.
              const qResult = await this.aiCache.withFileChangeGuard(
                'step_04_quality',
                qualityFileHashEntries,
                () =>
                  this.aiHelper.executeRequest(qPrompt, {
                    persona: 'code_quality_analyst',
                    model: 'claude-haiku-4.5',
                  })
              );
              qualityContent = qResult?.content ?? '';
              const qualityEvidence = validateAiResponseEvidenceHandling(
                qualityContent,
                qualityPromptContext.promptFileEntries.map((entry) => entry.relativePath),
                qualityPromptContext.promptFileEntries,
                MAX_FILE_CONTENT_CHARS,
                {
                  totalScopeCount: fileEntries.length,
                  allRunPaths: fileEntries.map((entry) => entry.relativePath),
                }
              );
              if (!qualityEvidence.adequate) {
                logger.warn(
                  `Step 4 supplementary quality review evidence handling low: ${qualityEvidence.reason}`
                );
                qualityContent = normalizeAiResponseForPartialEvidence(
                  qualityContent,
                  qualityEvidence
                );
              }
            }
          }
        } catch {
          /* optional */
        }

        if (aiSections.length > 0 || qualityContent) {
          const aiSection = aiSections.join('\n\n');
          const scopedReport = promptScopeNote
            ? `${report}\n\n> AI scope note: ${promptScopeNote}`
            : report;
          const sections = aiSection
            ? [appendAiRecommendations(scopedReport, aiSection)]
            : [scopedReport];
          if (qualityContent) sections.push(`\n\n## Quality Review\n\n${qualityContent}`);
          await this.backlog.saveStepSummary(4, 'Configuration Validation', sections.join(''));
        }
      } else {
        logger.warn('AI helper not available - skipping AI analysis');
      }

      if (totalIssues === 0) {
        if (evidenceInadequate) {
          logger.warn(
            'Step 4 completed - no issues found, but AI evidence was partial; review may be incomplete'
          );
        } else {
          logger.success('Step 4 completed - no issues found');
        }
      } else {
        logger.warn(`Step 4 completed - ${totalIssues} issue(s) found`);
      }

      return {
        success: true,
        ...results,
        alternatives: parsedAlternatives.alternatives,
        recommendedAlternative: parsedAlternatives.recommended,
      };
    } catch (error) {
      logger.error(`Step 4 failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Discover configuration files in project
   * @param {string} projectRoot - Project root directory
   * @returns {Promise<string[]>} Array of config file paths
   */
  async discoverConfigFiles(projectRoot, declaredFiles = null) {
    if (Array.isArray(declaredFiles) && declaredFiles.length > 0) {
      return declaredFiles.map((f) => (path.isAbsolute(f) ? f : path.resolve(projectRoot, f)));
    }

    try {
      const changedFiles = await this.gitOps.getModifiedFiles();
      const configChanged = changedFiles
        .filter(
          (file) => isConfigFile(file) && !EXCLUDE_DIRS.some((dir) => file.split('/').includes(dir))
        )
        .map((file) => (path.isAbsolute(file) ? file : path.resolve(projectRoot, file)));
      if (configChanged.length > 0) {
        return configChanged;
      }
    } catch {
      // Git unavailable; fall through to glob scan
    }

    // Fallback: scan common config files (clean working tree or git error)
    const patterns = ['**/*.json', '**/*.yaml', '**/*.yml', '**/.env*', '**/Dockerfile'];

    const files = [];
    for (const pattern of patterns) {
      try {
        const found = await this.fileOps.glob(pattern, {
          cwd: projectRoot,
          ignore: EXCLUDE_DIRS.map((dir) => `**/${dir}/**`),
        });
        files.push(
          ...found
            .filter((f) => isConfigFile(f))
            .map((f) => (path.isAbsolute(f) ? f : path.resolve(projectRoot, f)))
        );
      } catch {
        // Pattern not found, continue
      }
    }

    return [...new Set(files)];
  }

  async resolveConfigFilesForValidation(projectRoot, configFiles) {
    const resolvedFiles = [];
    const seen = new Set();

    const addResolvedFile = (filePath) => {
      const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(projectRoot, filePath);
      if (seen.has(absolutePath)) return;
      seen.add(absolutePath);
      resolvedFiles.push(absolutePath);
    };

    for (const filePath of configFiles) {
      const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(projectRoot, filePath);
      const relativePath = normalizeConfigPath(path.relative(projectRoot, absolutePath));
      const replacementPaths = getGeneratedConfigReplacementPaths(relativePath);

      if (replacementPaths.length === 0) {
        addResolvedFile(absolutePath);
        continue;
      }

      const readableReplacements = [];
      for (const replacementPath of replacementPaths) {
        const replacementAbsolutePath = path.resolve(projectRoot, replacementPath);
        try {
          await this.fileOps.readFile(replacementAbsolutePath);
          readableReplacements.push(replacementAbsolutePath);
        } catch {
          /* keep checking the remaining replacements */
        }
      }

      if (readableReplacements.length > 0) {
        logger.info(
          `[step_04] Treating ${relativePath} as generated; using ${replacementPaths.join(', ')} for validation/reporting`
        );
        readableReplacements.forEach(addResolvedFile);
        continue;
      }

      addResolvedFile(absolutePath);
    }

    return resolvedFiles;
  }

  /**
   * Validate file syntax
   * @param {string} filePath - File path
   * @returns {Promise<Object[]>} Syntax errors
   */
  async validateFileSyntax(filePath) {
    try {
      const content = await this.fileOps.readFile(filePath);
      const type = getConfigType(filePath);
      const result = validateConfigSyntax(content, type);

      if (!result.valid) {
        if (result.error) {
          return [{ file: filePath, type, ...result }];
        }
        if (result.issues) {
          return result.issues.map((issue) => ({ file: filePath, type, ...issue }));
        }
      }

      return [];
    } catch (error) {
      logger.warn(`  Cannot read ${filePath}: ${error.message}`);
      return []; // Read failure is not a syntax error
    }
  }

  /**
   * Scan file for secrets
   * @param {string} filePath - File path
   * @returns {Promise<Object[]>} Security findings
   */
  async scanFileForSecrets(filePath) {
    try {
      const content = await this.fileOps.readFile(filePath);
      return scanForSecrets(content, filePath);
    } catch {
      return [];
    }
  }

  /**
   * Check file best practices
   * @param {string} filePath - File path
   * @returns {Promise<Object[]>} Best practice issues
   */
  async checkFileBestPractices(filePath) {
    try {
      const content = await this.fileOps.readFile(filePath);
      const type = getConfigType(filePath);
      return checkConfigBestPractices(content, type);
    } catch {
      return [];
    }
  }
}

export default Step4ConfigAnalyzer;
