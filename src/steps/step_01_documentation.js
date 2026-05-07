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
  buildStructuredPrompt,
  buildDocAnalysisPrompt,
  injectProjectContext,
  loadResolvedAiHelpers,
  AI_PROJECT_KINDS_PATH,
  buildYamlStepPrompt,
  buildProjectKindPrompt,
} from '../lib/ai_prompt_builder.js';
import yaml from 'js-yaml';
import { AiHelper, calculateRetryDelay } from '../lib/ai_helpers.js';
import { Backlog } from '../lib/backlog.js';
import {
  DOC_CATEGORIES,
  categorizeDocFile,
  Step1IncrementalProcessor,
} from '../lib/step1_incremental.js';
import { Step1ParallelProcessor } from '../lib/step1_parallel.js';
import { FileOperations } from '../lib/file_operations.js';
import { loadReadableReviewFiles } from '../lib/review_prompt_scope.js';
import {
  buildPartitionFilePathsContext,
  buildReviewFileContentsBlock,
  buildReviewPromptPartitions,
  MAX_PROMPT_ENTRY_CHARS,
  MAX_PROMPT_PARTITION_CHARS,
  MAX_PROMPT_ENTRIES_PER_PARTITION,
  runPartitionedAiResponses,
  splitReviewPromptEntry,
} from '../lib/review_step_helpers.js';
export {
  buildReviewFileContentsBlock as buildStep1FileContentsBlock,
  buildReviewPromptPartitions as buildStep1PromptPartitions,
  MAX_PROMPT_ENTRY_CHARS,
  MAX_PROMPT_PARTITION_CHARS,
  MAX_PROMPT_ENTRIES_PER_PARTITION,
  splitReviewPromptEntry as splitStep1PromptEntry,
};

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
  const excludedFiles = new Set(['.github/copilot-instructions.md']);
  let totalConsidered = 0;

  for (const file of changedFiles) {
    // Skip workflow artifact directories — they must never appear in prompts.
    if (
      file.startsWith('.ai_workflow/') ||
      file.startsWith('.workflow_core/') ||
      excludedFiles.has(file)
    ) {
      continue;
    }

    totalConsidered++;

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
      total: totalConsidered,
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

export const STEP1_MAX_SUPPORTING_EVIDENCE_FILES = 12;
export const STEP1_SCOPED_DOC_CONTEXT_MAX_CHARS = 2500;
export const STEP1_PROJECT_CONVENTION_MAX_CHARS = 2000;

function normalizeStep1EvidencePath(filePath) {
  return String(filePath ?? '').replace(/\\/g, '/');
}

function isMarkdownDoc(filePath) {
  return /\.md$/i.test(filePath);
}

function isSourceEvidenceFile(filePath) {
  return /\.[cm]?[jt]sx?$/i.test(filePath) && !/\.d\.ts$/i.test(filePath);
}

function isStaticEvidenceFile(filePath) {
  return /\.(html|css)$/i.test(filePath);
}

function isKeyConfigEvidenceFile(filePath) {
  const normalized = normalizeStep1EvidencePath(filePath);
  const basename = normalized.split('/').pop() ?? '';

  return (
    normalized === 'package.json' ||
    normalized === 'tsconfig.json' ||
    normalized === '.workflow-config.yaml' ||
    normalized.startsWith('.github/workflows/') ||
    basename === 'Dockerfile' ||
    /^docker-compose(\.[^.]+)?\.ya?ml$/i.test(basename) ||
    /(^|\/)(vite|webpack|rollup|esbuild|jest|babel|eslint|prettier|typedoc|turbo|next|nuxt|astro|svelte|playwright|vitest)\.config\.[^/]+$/i.test(
      normalized
    )
  );
}

export function isLowSignalStep1Evidence(filePath) {
  const normalized = normalizeStep1EvidencePath(filePath);

  return (
    normalized.length === 0 ||
    normalized.startsWith('.ai_workflow/') ||
    normalized.startsWith('.workflow_core/') ||
    normalized.startsWith('.workflow_fspec/') ||
    normalized.startsWith('.playwright-mcp/') ||
    normalized.startsWith('node_modules/') ||
    normalized.startsWith('coverage/') ||
    normalized.startsWith('.test-cache/') ||
    normalized === '.mcp.json' ||
    normalized === 'package-lock.json' ||
    /(^|\/)(dist|build|out|public\/build|\.next|\.nuxt|\.svelte-kit)(\/|$)/i.test(normalized) ||
    /(^|\/)assets\/js\//i.test(normalized)
  );
}

export function rankStep1EvidenceFile(filePath, category, docFileSet = new Set()) {
  const normalized = normalizeStep1EvidencePath(filePath);

  if (!normalized || isLowSignalStep1Evidence(normalized)) {
    return -1;
  }

  if (docFileSet.has(normalized)) {
    return 1000;
  }

  if (isMarkdownDoc(normalized)) {
    return 900;
  }

  switch (category) {
    case DOC_CATEGORIES.API:
      if (isSourceEvidenceFile(normalized)) return 850;
      if (isKeyConfigEvidenceFile(normalized)) return 500;
      if (isStaticEvidenceFile(normalized)) return 250;
      return 0;
    case DOC_CATEGORIES.README:
      if (isKeyConfigEvidenceFile(normalized)) return 820;
      if (isStaticEvidenceFile(normalized)) return 760;
      if (isSourceEvidenceFile(normalized)) return 420;
      return 0;
    case DOC_CATEGORIES.CONTRIBUTING:
      if (isKeyConfigEvidenceFile(normalized)) return 780;
      if (isSourceEvidenceFile(normalized)) return 260;
      return 0;
    case DOC_CATEGORIES.CHANGELOG:
      if (normalized === 'package.json') return 780;
      if (isKeyConfigEvidenceFile(normalized)) return 480;
      return 0;
    case DOC_CATEGORIES.GUIDE:
    case DOC_CATEGORIES.REFERENCE:
    case DOC_CATEGORIES.OTHER:
      if (isSourceEvidenceFile(normalized)) return 760;
      if (isStaticEvidenceFile(normalized)) return 700;
      if (isKeyConfigEvidenceFile(normalized)) return 540;
      return 0;
    case DOC_CATEGORIES.LICENSE:
    default:
      if (isKeyConfigEvidenceFile(normalized)) return 320;
      return 0;
  }
}

export function selectStep1EvidenceFiles(docFiles, classification, options = {}) {
  const normalizedDocFiles = [
    ...new Set(
      (Array.isArray(docFiles) ? docFiles : []).map(normalizeStep1EvidencePath).filter(Boolean)
    ),
  ];
  const docFileSet = new Set(normalizedDocFiles);
  const primaryCategory = categorizeDocFile(normalizedDocFiles[0] ?? '');
  const maxSupportingFiles = options.maxSupportingFiles ?? STEP1_MAX_SUPPORTING_EVIDENCE_FILES;
  const candidates = [
    ...normalizedDocFiles,
    ...(classification?.documentation ?? []).map(normalizeStep1EvidencePath),
    ...(classification?.source ?? []).map(normalizeStep1EvidencePath),
    ...(classification?.config ?? []).map(normalizeStep1EvidencePath),
  ];
  const seen = new Set();
  const rankedCandidates = [];

  for (const filePath of candidates) {
    const normalized = normalizeStep1EvidencePath(filePath);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);

    const score = rankStep1EvidenceFile(normalized, primaryCategory, docFileSet);
    if (score > 0) {
      rankedCandidates.push({ filePath: normalized, score });
    }
  }

  rankedCandidates.sort(
    (left, right) => right.score - left.score || left.filePath.localeCompare(right.filePath)
  );

  const selectedDocs = rankedCandidates
    .filter(({ filePath }) => isMarkdownDoc(filePath))
    .map(({ filePath }) => filePath);
  const selectedSupport = rankedCandidates
    .filter(({ filePath }) => !isMarkdownDoc(filePath))
    .slice(0, maxSupportingFiles)
    .map(({ filePath }) => filePath);

  return [...new Set([...selectedDocs, ...selectedSupport])];
}

function dedupeRepeatedConventionContent(content) {
  const normalized = String(content ?? '').trim();
  if (!normalized) {
    return '';
  }

  const repeatedSections = normalized
    .split(/\n{2,}---\n{2,}/u)
    .map((section) => section.trim())
    .filter(Boolean);

  if (
    repeatedSections.length > 1 &&
    repeatedSections.every((section) => section === repeatedSections[0])
  ) {
    return repeatedSections[0];
  }

  return normalized;
}

function trimPromptContextContent(content, maxChars) {
  const normalized = String(content ?? '').trim();
  if (!normalized || normalized.length <= maxChars) {
    return normalized;
  }

  const omission = `\n... [middle omitted — ${normalized.length - maxChars} more chars]\n`;
  const remainingBudget = Math.max(maxChars - omission.length, 0);
  const headChars = Math.ceil(remainingBudget / 2);
  const tailChars = Math.max(remainingBudget - headChars, 0);

  return `${normalized.slice(0, headChars)}${omission}${tailChars > 0 ? normalized.slice(-tailChars) : ''}`;
}

function getStep1ScopedDocEntries(fileEntries, docFiles = []) {
  const docFileSet = new Set(
    (Array.isArray(docFiles) ? docFiles : []).map(normalizeStep1EvidencePath).filter(Boolean)
  );

  return (Array.isArray(fileEntries) ? fileEntries : []).filter((entry) =>
    docFileSet.has(normalizeStep1EvidencePath(entry?.sourcePath ?? entry?.relativePath))
  );
}

function getStep1SupportingEvidenceEntries(fileEntries, docFiles = []) {
  const docFileSet = new Set(
    (Array.isArray(docFiles) ? docFiles : []).map(normalizeStep1EvidencePath).filter(Boolean)
  );

  return (Array.isArray(fileEntries) ? fileEntries : []).filter(
    (entry) => !docFileSet.has(normalizeStep1EvidencePath(entry?.sourcePath ?? entry?.relativePath))
  );
}

function buildStep1ScopedDocPathsContext(docFiles = []) {
  const docEntries = (Array.isArray(docFiles) ? docFiles : [])
    .map((filePath) => ({ relativePath: normalizeStep1EvidencePath(filePath) }))
    .filter((entry) => entry.relativePath.length > 0);

  return (
    buildPartitionFilePathsContext(docEntries) ||
    '      - (no scoped documentation targets were available in the current context)'
  );
}

export function buildStep1ScopedDocContextBlock(
  fileEntries,
  maxChars = STEP1_SCOPED_DOC_CONTEXT_MAX_CHARS
) {
  const entries = Array.isArray(fileEntries) ? fileEntries : [];
  if (entries.length === 0) {
    return '(no readable scoped documentation excerpts were available in the current context)';
  }

  return entries
    .map(({ relativePath, content }) => {
      const trimmedContent = trimPromptContextContent(content, maxChars);
      return `### \`${relativePath}\`\n\`\`\`md\n${trimmedContent}\n\`\`\``;
    })
    .join('\n\n');
}

export function buildStep1PartitionEvidenceSummary(partitions = [], docFiles = []) {
  const docFileSet = new Set(
    (Array.isArray(docFiles) ? docFiles : []).map(normalizeStep1EvidencePath).filter(Boolean)
  );
  const partitionSummaries = (Array.isArray(partitions) ? partitions : [])
    .map((partition, index, allPartitions) => {
      const scopePaths = [
        ...new Set(
          (Array.isArray(partition?.scopePaths) && partition.scopePaths.length > 0
            ? partition.scopePaths
            : Array.isArray(partition?.entries)
              ? partition.entries.map((entry) => entry?.sourcePath ?? entry?.relativePath)
              : []
          )
            .map(normalizeStep1EvidencePath)
            .filter(Boolean)
        ),
      ];

      const scopedPaths = scopePaths.filter((filePath) => docFileSet.has(filePath));
      const supportingPaths = scopePaths.filter((filePath) => !docFileSet.has(filePath));
      const partitionType =
        scopedPaths.length > 0 && supportingPaths.length > 0
          ? 'scoped documentation excerpts + supporting evidence'
          : scopedPaths.length > 0
            ? 'scoped documentation excerpts'
            : supportingPaths.length > 0
              ? 'support-only evidence'
              : 'no readable evidence';

      return [
        `#### Partition ${index + 1} of ${allPartitions.length}`,
        `- Partition evidence type: ${partitionType}`,
        `- Scoped documentation targets in partition: ${scopedPaths.join(', ') || '(none)'}`,
        `- Supporting evidence files in partition: ${supportingPaths.join(', ') || '(none)'}`,
      ].join('\n');
    })
    .filter(Boolean);

  return partitionSummaries.join('\n\n') || '(no partition evidence summary was available)';
}

function appendPromptSectionIfMissing(prompt, heading, content) {
  const normalizedPrompt = String(prompt ?? '');
  const normalizedContent = String(content ?? '').trim();
  if (!normalizedContent || normalizedPrompt.includes(heading)) {
    return normalizedPrompt;
  }

  return `${normalizedPrompt}\n\n${heading}\n\n${normalizedContent}`;
}

function hasStep1OmittedScopedDocContext(scopedDocEntries = []) {
  return (Array.isArray(scopedDocEntries) ? scopedDocEntries : []).some(({ content }) =>
    trimPromptContextContent(content, STEP1_SCOPED_DOC_CONTEXT_MAX_CHARS).includes(
      '[middle omitted'
    )
  );
}

export function buildStep1SynthesisPrompt({
  changedFiles = [],
  docFiles = [],
  projectInfo = {},
  scopedDocEntries = [],
  partitionEvidenceSummary = '',
  partitionFindings = '',
  totalPartitions = 0,
}) {
  const docTargetsContext = buildStep1ScopedDocPathsContext(docFiles);
  const docContentsContext = buildStep1ScopedDocContextBlock(scopedDocEntries);
  const evidenceSummaryContext =
    String(partitionEvidenceSummary ?? '').trim() ||
    '(no partition evidence summary was available)';
  const findingsContext =
    String(partitionFindings ?? '').trim() || '(no partition findings were available)';

  const role = `You are a senior technical documentation specialist conducting a whole-scope synthesis review after a partitioned primary analysis.`;
  const task = `Perform a whole-scope synthesis review for the partitioned Step 1 documentation analysis.

**Changed files**: ${changedFiles.join(', ') || '(none)'}
**Documentation to review**: ${docFiles.join(', ') || '(none)'}
**Whole-scope note**: Primary evidence was split across ${totalPartitions} partition(s) for size. Partition for size, synthesize for whole-scope reasoning, and never drop overflow files from secondary reviews.

**Scoped documentation targets**:
${docTargetsContext}

**Direct documentation target excerpts**:
${docContentsContext}

**Partition evidence summary**:
${evidenceSummaryContext}

**Primary partition findings**:
${findingsContext}`;
  const approach = `Use the partition findings to reconcile cross-partition contradictions, but ground every final conclusion in the visible documentation excerpts above. Provide one final whole-scope answer only. Choose exactly one verdict per scoped documentation file or clearly labeled file section: specific edit, "No updates required", "Not applicable", "Unavailable", or "Inconclusive". Never combine "Not applicable" with "No updates required" for the same file. If the partition findings conflict or the visible documentation evidence is incomplete, mark the affected file Inconclusive instead of guessing.

- Use the partition evidence summary to tell apart genuinely unrelated support-only partitions from support evidence that still affects commands, APIs, architecture, or inventories described in the scoped documentation targets.
- Treat current-state docs (status summaries, implementation tables, released step lists, "current version" blocks) as describing shipped behavior unless the visible scoped document already labels that section as planned/future work.
- Do not promote roadmap-only or planned items into released/current-state docs unless the visible implementation evidence in this prompt shows the feature already exists.
- When adjacent metadata lines form a summary block (for example version, tests, coverage, and last-updated lines), reconcile them as a linked set. Update only the values explicitly supported by visible evidence, and keep any unsupported line Unavailable or Inconclusive rather than guessing.
- If a visible scoped document includes a directory tree, project structure, module inventory, runtime boot path, or responsibility list, cross-check changed files against that visible inventory. A changed file that should appear there but is missing or no longer described is documentation drift and should not be cleared as "No updates required".
- Never invent or infer release dates or "Last updated" dates from prompt timestamps, roadmap phases, or general recency.`;

  return injectProjectContext(buildStructuredPrompt({ role, task, approach }), projectInfo);
}

function splitPartitionedDocAnalysisSections(content) {
  const normalized = String(content ?? '').trim();
  if (!normalized) {
    return [];
  }

  if (!/^#### Partition \d+ of \d+/m.test(normalized)) {
    return [normalized];
  }

  return normalized
    .split(/^#### Partition \d+ of \d+\n\n/m)
    .map((section) => section.trim())
    .filter(Boolean);
}

function isNoUpdateDocAnalysisSection(section) {
  return (
    /\bNo updates (?:required|needed)\b/i.test(section) &&
    !/\b(?:Unavailable|Inconclusive|Not applicable)\b/i.test(section)
  );
}

function isInconclusiveDocAnalysisSection(section) {
  return /\b(?:Unavailable|Inconclusive|Not applicable)\b/i.test(section);
}

export function consolidateStep1DocAnalysis(content, docFiles = []) {
  const sections = splitPartitionedDocAnalysisSections(content);
  if (sections.length <= 1) {
    return String(content ?? '').trim();
  }

  const docLabel =
    (Array.isArray(docFiles) ? docFiles : []).join(', ') || 'the scoped documentation files';

  if (sections.every(isNoUpdateDocAnalysisSection)) {
    return `No updates required — consolidated across ${sections.length} prompt partition(s) for ${docLabel}. The visible evidence did not identify documentation-impacting changes for the scoped documentation files.`;
  }

  if (sections.every(isInconclusiveDocAnalysisSection)) {
    return `Inconclusive — consolidated across ${sections.length} prompt partition(s) for ${docLabel}. The visible evidence was incomplete, tangential, or out of scope for a confident documentation verdict.`;
  }

  if (
    sections.every(
      (section) =>
        isNoUpdateDocAnalysisSection(section) || isInconclusiveDocAnalysisSection(section)
    ) &&
    sections.some(isInconclusiveDocAnalysisSection)
  ) {
    return `Inconclusive — consolidated across ${sections.length} prompt partition(s) for ${docLabel}. At least one partition had incomplete, tangential, or support-only evidence, so Step 1 cannot safely collapse the full result to "No updates required".`;
  }

  return String(content ?? '').trim();
}

export function selectStep1FinalAnalysisContent(
  combinedContent,
  synthesisContent,
  scopedDocEntries = []
) {
  const normalizedCombined = String(combinedContent ?? '').trim();
  const normalizedSynthesis = String(synthesisContent ?? '').trim();

  if (!normalizedSynthesis) {
    return normalizedCombined;
  }

  const partitionSections = splitPartitionedDocAnalysisSections(normalizedCombined);
  const consolidatedCombined =
    partitionSections.length > 1
      ? consolidateStep1DocAnalysis(normalizedCombined)
      : normalizedCombined;
  const allNoUpdate =
    partitionSections.length > 1 && partitionSections.every(isNoUpdateDocAnalysisSection);
  const allInconclusive =
    partitionSections.length > 1 && partitionSections.every(isInconclusiveDocAnalysisSection);
  const combinedInconclusive = isInconclusiveDocAnalysisSection(consolidatedCombined);
  const synthesisNoUpdate = isNoUpdateDocAnalysisSection(normalizedSynthesis);
  const synthesisInconclusive = isInconclusiveDocAnalysisSection(normalizedSynthesis);
  const scopedDocsIncomplete = hasStep1OmittedScopedDocContext(scopedDocEntries);

  if (synthesisInconclusive && allNoUpdate) {
    return normalizedCombined;
  }

  if (synthesisNoUpdate && (allInconclusive || scopedDocsIncomplete)) {
    return normalizedCombined;
  }

  if (synthesisNoUpdate && combinedInconclusive) {
    return normalizedCombined;
  }

  return normalizedSynthesis;
}

export const STEP1_DOCUMENTATION_PREFERRED_MODELS = [
  'gpt-4.1',
  'claude-sonnet-4.6',
  'gpt-5.3-codex',
];

const STEP1_DEFAULT_AI_TIMEOUT_MS = 120000;
const STEP1_DEFAULT_AI_MAX_RETRIES = 3;
const STEP1_DEFAULT_AI_BASE_DELAY_MS = 1000;
const STEP1_DEFAULT_AI_MAX_DELAY_MS = 30000;
const STEP1_MAX_AI_TIMEOUT_MS = 300000;
const STEP1_FALLBACK_AI_TIMEOUT_MS = 120000;
const STEP1_PARALLEL_TIMEOUT_PADDING_MS = 15000;

/**
 * Pick the preferred model for Step 1 documentation analysis.
 *
 * Prefers the recommended documentation-focused models when they are available
 * in the active Copilot session. Falls back to the caller-provided model (or
 * the primary recommendation) when availability data is missing.
 *
 * @pure
 * @param {Array<string|{id?: string}>} [availableModels=[]] - Available Copilot models
 * @param {string} [fallbackModel=STEP1_DOCUMENTATION_PREFERRED_MODELS[0]] - Fallback model ID
 * @returns {string} Selected model ID
 */
export function selectStep1DocumentationModel(
  availableModels = [],
  fallbackModel = STEP1_DOCUMENTATION_PREFERRED_MODELS[0]
) {
  const availableIds = Array.isArray(availableModels)
    ? availableModels
        .map((entry) => (typeof entry === 'string' ? entry : entry?.id))
        .filter((id) => typeof id === 'string' && id.length > 0)
    : [];

  for (const model of STEP1_DOCUMENTATION_PREFERRED_MODELS) {
    if (availableIds.includes(model)) {
      return model;
    }
  }

  return fallbackModel || STEP1_DOCUMENTATION_PREFERRED_MODELS[0];
}

/**
 * Estimate the timeout budget Step 1 needs so its category-level watchdog
 * does not expire before AiHelper exhausts its own timeout retries.
 *
 * @pure
 * @param {Object} [aiConfig={}] - AiHelper config
 * @returns {number} Timeout budget in milliseconds
 */
export function calculateStep1ParallelTimeoutBudget(aiConfig = {}) {
  const initialTimeout =
    Number.isFinite(aiConfig?.timeout) && aiConfig.timeout > 0
      ? Math.min(Math.max(aiConfig.timeout, 1000), STEP1_MAX_AI_TIMEOUT_MS)
      : STEP1_DEFAULT_AI_TIMEOUT_MS;
  const maxRetries =
    Number.isInteger(aiConfig?.maxRetries) && aiConfig.maxRetries > 0
      ? aiConfig.maxRetries
      : STEP1_DEFAULT_AI_MAX_RETRIES;
  const baseDelay =
    Number.isFinite(aiConfig?.baseDelay) && aiConfig.baseDelay >= 0
      ? aiConfig.baseDelay
      : STEP1_DEFAULT_AI_BASE_DELAY_MS;
  const maxDelay =
    Number.isFinite(aiConfig?.maxDelay) && aiConfig.maxDelay >= baseDelay
      ? aiConfig.maxDelay
      : STEP1_DEFAULT_AI_MAX_DELAY_MS;
  const primaryModel = typeof aiConfig?.model === 'string' ? aiConfig.model : null;
  const fallbackModel = aiConfig?.fallbackModel;

  let totalTimeout = 0;
  let attemptTimeout = initialTimeout;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    totalTimeout += attemptTimeout;
    if (attempt < maxRetries - 1) {
      totalTimeout += calculateRetryDelay(attempt, baseDelay, maxDelay);
      attemptTimeout = Math.min(attemptTimeout * 2, STEP1_MAX_AI_TIMEOUT_MS);
    }
  }

  if (fallbackModel && fallbackModel !== primaryModel) {
    totalTimeout += STEP1_FALLBACK_AI_TIMEOUT_MS;
  }

  return totalTimeout + STEP1_PARALLEL_TIMEOUT_PADDING_MS;
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

export const STEP1_PROJECT_CONVENTION_PATHS = [
  '.github/copilot-instructions.md',
  '.github/CONTRIBUTING.md',
  'CONTRIBUTING.md',
];

/**
 * Read project-specific documentation conventions from the highest-priority
 * authority files available in the target repository.
 *
 * @param {Object} fileOps - File operations adapter with readFile(path)
 * @param {string} projectRoot - Absolute path to target project root
 * @returns {Promise<string>} Combined labeled convention blocks, or empty string
 */
export async function readProjectConventions(fileOps, projectRoot) {
  const sections = [];
  const seenBodies = new Set();

  for (const relativePath of STEP1_PROJECT_CONVENTION_PATHS) {
    try {
      const content = await fileOps.readFile(`${projectRoot}/${relativePath}`);
      const normalizedContent = trimPromptContextContent(
        dedupeRepeatedConventionContent(content),
        STEP1_PROJECT_CONVENTION_MAX_CHARS
      );
      if (normalizedContent.length > 0 && !seenBodies.has(normalizedContent)) {
        seenBodies.add(normalizedContent);
        sections.push(`### ${relativePath}\n${normalizedContent}`);
      }
    } catch {
      // Convention files are optional; skip unreadable paths gracefully.
    }
  }

  return sections.join('\n\n');
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
      if ((options.enableParallel ?? this.enableParallel) && docsToProcess.length >= 1) {
        logger.info('Running parallel documentation analysis...');
        if (this.parallelProcessor?.config) {
          const step1TimeoutBudget = calculateStep1ParallelTimeoutBudget(this.aiHelper?.config);
          const currentTimeout = this.parallelProcessor.config.timeout;
          if (!Number.isFinite(currentTimeout) || currentTimeout < step1TimeoutBudget) {
            this.parallelProcessor.config.timeout = step1TimeoutBudget;
          }
        }
        const rawResult = await this.parallelProcessor.validate(
          docsToProcess,
          async (_category, files, { signal } = {}) => {
            const ensureActive = () => {
              if (signal?.aborted) {
                const error = new Error('Cancelled');
                error.name = 'AbortError';
                throw error;
              }
            };

            ensureActive();
            if (!aiAvailable) {
              return { success: true, skipped: true, reason: 'ai_unavailable' };
            }
            const projectInfo = {};
            const primaryLanguage = this.configManager?.config?.tech_stack?.primary_language;
            const projectKind = this.configManager?.config?.project?.kind;

            if (primaryLanguage) {
              projectInfo.language = primaryLanguage;
            }

            if (projectKind) {
              projectInfo.projectKind = projectKind;
            }
            const evidenceFiles = selectStep1EvidenceFiles(files, classification);
            ensureActive();
            const { fileEntries } = await loadReadableReviewFiles(
              this.fileOps,
              projectRoot,
              evidenceFiles
            );
            ensureActive();
            const scopedDocEntries = getStep1ScopedDocEntries(fileEntries, files);
            const scopedDocPathsContext = buildStep1ScopedDocPathsContext(files);
            const totalScopedDocCount = new Set(
              (Array.isArray(files) ? files : [])
                .map((filePath) => normalizeStep1EvidencePath(filePath))
                .filter(Boolean)
            ).size;
            const fileHashEntries = fileEntries.map(
              ({ relativePath, content }) => `${relativePath}:${content}`
            );
            const projectConventions = await readProjectConventions(this.fileOps, projectRoot);
            let parsedYaml = null;
            try {
              parsedYaml = await loadResolvedAiHelpers(this.fileOps);
            } catch {
              /* fallback */
            }
            let projectKindRole = '';
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
                projectKindRole = pk.role;
              }
            } catch {
              /* optional */
            }
            const cacheCategory = files.join(',');
            const selectedModel = selectStep1DocumentationModel(
              typeof this.aiHelper.getAvailableModels === 'function'
                ? this.aiHelper.getAvailableModels()
                : [],
              this.aiHelper?.config?.model
            );
            const promptPartitions =
              fileEntries.length > 0 ? buildReviewPromptPartitions(fileEntries) : [];
            const partitionsToAnalyze =
              promptPartitions.length > 0 ? promptPartitions : [{ entries: [], scopePaths: [] }];

            if (partitionsToAnalyze.length > 1) {
              logger.info(
                `[step_01] Running AI analysis in ${partitionsToAnalyze.length} partition(s) to avoid prompt truncation`
              );
            }

            const { success, content: combinedContent } = await runPartitionedAiResponses({
              partitions: partitionsToAnalyze,
              shouldContinue: () => !signal?.aborted,
              buildPrompt: (partition, { index: i, total }) => {
                ensureActive();
                const filePathsContext = buildPartitionFilePathsContext(partition.entries);
                const partitionScopedDocEntries = getStep1ScopedDocEntries(
                  partition.entries,
                  files
                );
                const supportingEntries = getStep1SupportingEvidenceEntries(
                  partition.entries,
                  files
                );
                const partitionScopedDocContents =
                  buildStep1ScopedDocContextBlock(partitionScopedDocEntries);
                const fileContentsSection = buildReviewFileContentsBlock(supportingEntries);
                const coveredScopedDocCount = new Set(
                  partitionScopedDocEntries
                    .map((entry) =>
                      normalizeStep1EvidencePath(entry?.sourcePath ?? entry?.relativePath)
                    )
                    .filter(Boolean)
                ).size;
                const partitionScopeNote =
                  total > 1
                    ? coveredScopedDocCount > 0
                      ? `This request covers ${coveredScopedDocCount} of ${totalScopedDocCount} scoped documentation target(s) for the current documentation-analysis category. Entries labeled "(part X/Y)" are sequential chunks of oversized files that were split across multiple prompt requests to avoid truncated evidence.`
                      : `This request contains supporting evidence only for the current documentation-analysis category. No scoped documentation target text is included in this partition; use these files only to identify concrete documentation impact on the scoped targets, and do not treat this partition alone as a final verdict.`
                    : `This request contains the full readable scoped file set for this category (${fileEntries.length} readable file(s)).`;
                let prompt = null;

                if (parsedYaml) {
                  prompt = buildYamlStepPrompt(parsedYaml, 'doc_analysis_prompt', {
                    partition_header:
                      total > 1
                        ? `[Partition ${i + 1} of ${total} — analyze ONLY the files or file-parts listed below for this request]`
                        : '',
                    partition_scope_note: partitionScopeNote,
                    project_name: projectInfo.projectKind ?? projectRoot,
                    primary_language: projectInfo.language ?? 'unknown',
                    changed_files: evidenceFiles.join(', '),
                    doc_files: files.join(', '),
                    scoped_doc_paths: scopedDocPathsContext,
                    scoped_doc_contents:
                      partitionScopedDocEntries.length > 0 ? partitionScopedDocContents : '',
                    file_paths_in_request:
                      filePathsContext ||
                      '      - (no readable file paths were available in the current context)',
                    file_contents:
                      fileContentsSection ||
                      '(no readable file contents were available in the current context)',
                    project_conventions: projectConventions,
                  });
                }

                if (!prompt) {
                  prompt = buildDocAnalysisPrompt({
                    changedFiles: evidenceFiles,
                    docFiles: files,
                    projectInfo,
                  });

                  const partitionPreamble = [
                    total > 1
                      ? `[Partition ${i + 1} of ${total} — analyze ONLY the files or file-parts listed below for this request]`
                      : '',
                    partitionScopeNote,
                  ]
                    .filter(Boolean)
                    .join('\n\n');

                  if (partitionPreamble) {
                    prompt = `${partitionPreamble}\n\n${prompt}`;
                  }

                  if (filePathsContext) {
                    prompt += `\n\n# File Paths in This Request\n\n${filePathsContext}`;
                  }

                  if (fileContentsSection) {
                    prompt += `\n\n# File Contents\n\n${fileContentsSection}`;
                  }
                }

                if (projectKindRole) {
                  prompt = `[Project-Kind Role: ${projectKindRole}]\n\n${prompt}`;
                }

                prompt = appendPromptSectionIfMissing(
                  prompt,
                  '## Scoped Documentation Targets',
                  scopedDocPathsContext
                );
                prompt = appendPromptSectionIfMissing(
                  prompt,
                  '## Direct Documentation Target Excerpts',
                  partitionScopedDocEntries.length > 0 ? partitionScopedDocContents : ''
                );

                return prompt;
              },
              executePartition: (_partition, { index: i, total }, prompt) => {
                ensureActive();
                return this.aiCache.withFileChangeGuard(
                  `step_01|${cacheCategory}|part:${i + 1}/${total}`,
                  fileHashEntries,
                  () => {
                    ensureActive();
                    return this.aiHelper.executeRequest(prompt, {
                      persona: 'documentation_expert',
                      model: selectedModel,
                    });
                  }
                );
              },
              trackSuccess: (response, currentSuccess) =>
                currentSuccess && response?.success !== false,
            });
            let finalContent = combinedContent;
            let finalSuccess = success;

            if (partitionsToAnalyze.length > 1) {
              ensureActive();
              let synthesisPrompt = buildStep1SynthesisPrompt({
                changedFiles: evidenceFiles,
                docFiles: files,
                projectInfo,
                scopedDocEntries,
                partitionEvidenceSummary: buildStep1PartitionEvidenceSummary(
                  partitionsToAnalyze,
                  files
                ),
                partitionFindings: combinedContent,
                totalPartitions: partitionsToAnalyze.length,
              });

              if (projectKindRole) {
                synthesisPrompt = `[Project-Kind Role: ${projectKindRole}]\n\n${synthesisPrompt}`;
              }

              const synthesisResult = await this.aiCache.withFileChangeGuard(
                `step_01|${cacheCategory}|synthesis`,
                [...fileHashEntries, `partition-findings:${combinedContent}`],
                () => {
                  ensureActive();
                  return this.aiHelper.executeRequest(synthesisPrompt, {
                    persona: 'documentation_expert',
                    model: selectedModel,
                  });
                }
              );

              finalSuccess = finalSuccess && synthesisResult?.success !== false;
              if (typeof synthesisResult?.content === 'string' && synthesisResult.content.trim()) {
                finalContent = selectStep1FinalAnalysisContent(
                  combinedContent,
                  synthesisResult.content,
                  scopedDocEntries
                );
              }
            }

            return {
              success: finalSuccess,
              response: {
                success: finalSuccess,
                content: consolidateStep1DocAnalysis(finalContent, files),
                text: consolidateStep1DocAnalysis(finalContent, files),
              },
            };
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

        if (rawResult.success !== true || rawResult.validatedFiles < rawResult.totalFiles) {
          const failureReason =
            rawResult.errors
              ?.map((entry) => entry?.error)
              .filter(Boolean)
              .join('; ') || 'Documentation analysis did not complete for every targeted file';
          throw new Error(failureReason);
        }

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
