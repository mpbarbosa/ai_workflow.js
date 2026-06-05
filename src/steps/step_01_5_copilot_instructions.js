/**
 * Step 1.5: GitHub Copilot Instructions Validation
 * @module steps/step_01_5_copilot_instructions
 * @version 2.0.0
 *
 * Audits and refreshes `.github/copilot-instructions.md` against deterministic
 * repository facts so prompt-time authority docs stay aligned with the live repo.
 */

import fs from 'fs/promises';
import path from 'path';
import { STEP_KIND } from './step_contract.js';
import logger from '../core/logger.js';
import { FileOperations } from '../lib/file_operations.js';
import { Backlog } from '../lib/backlog.js';
import { AiHelper } from '../lib/ai_helpers.js';
import { AiCache } from '../lib/ai_cache.js';
import { buildYamlStepPrompt, loadResolvedAiHelpers } from '../lib/ai_prompt_builder.js';

export const COPILOT_INSTRUCTIONS_RELATIVE_PATH = '.github/copilot-instructions.md';
export const COPILOT_REFERENCE_DOCS = [
  'README.md',
  'CLAUDE.md',
  'INDEX.md',
  'ROADMAP.md',
  'docs/ARCHITECTURE.md',
  'docs/CLI_USAGE_GUIDE.md',
  'docs/guides/MIGRATION_GUIDE.md',
  'CHANGELOG.md',
  '.github/CONTRIBUTING.md',
  'CONTRIBUTING.md',
];
export const COPILOT_AUXILIARY_NORMATIVE_FILES = [
  ['.markdownlint.yaml', 'Markdown formatting rules source of truth'],
];
export const COPILOT_SOURCE_LAYERS = [
  ['src/core/', 'Foundational runtime helpers'],
  ['src/utils/', 'Shared low-level utilities'],
  ['src/lib/', 'Reusable workflow domain logic'],
  ['src/orchestrator/', 'Workflow execution and sequencing'],
  ['src/cli/', 'CLI commands, prompts, and TUI code'],
  ['src/steps/', 'Executable workflow-step implementations'],
];
export const COPILOT_SUPPORTING_SURFACES = [
  ['.workflow-config.yaml', 'Project-local workflow configuration'],
  ['.workflow_core/', 'Shared workflow templates and helper assets'],
  ['.workflow_fspec/', 'Functional specification submodule'],
  ['.ai_workflow/', 'Runtime artifacts, cache, and checkpoints'],
];
export const COPILOT_INSTRUCTIONS_FINDING_CLASSIFICATIONS = [
  'supported guidance',
  'unsupported claim',
  'stale detail',
  'duplicate reference',
  'inconclusive',
];
export const COPILOT_INSTRUCTIONS_FINDING_ACTIONS = [
  'keep',
  'rewrite',
  'remove',
  'omit pending evidence',
];
export const COPILOT_INSTRUCTIONS_REPO_FACT_HEADINGS = [
  'Package Metadata',
  'Copilot File Purpose',
  'Validation Commands',
  'Stable Source Layers',
  'Supporting Workflow Surfaces',
  'Authoritative Reference Docs',
  'Reference Doc Signals',
  'Auxiliary Normative Files',
  'Public Package Entry Points',
  'Source Entry Signals',
];
const BROAD_REPO_FACT_HEADINGS = new Set([
  'Authoritative Reference Docs',
  'Reference Doc Signals',
  'Public Package Entry Points',
  'Source Entry Signals',
]);
const SOURCE_FILE_PATTERN = /\.(?:[cm]?[jt]sx?|d\.ts)$/i;
const NON_SOURCE_LAYER_DIRS = new Set(['__tests__', '__mocks__', 'fixtures']);
const FINDING_SECTION_PATTERN = /^###\s+Finding\s+\d+\s+-\s+.+$/gm;
const QUOTED_SNIPPET_PATTERN = /"([^"]+)"|`([^`]+)`/g;

function sortNatural(values) {
  return [...values].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function sortLayerEntries(entries) {
  return [...entries].sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));
}

function describeSourceLayer(relativePath) {
  const knownPurpose = new Map(COPILOT_SOURCE_LAYERS).get(relativePath);
  if (knownPurpose) {
    return knownPurpose;
  }
  if (relativePath === 'src/') {
    return 'Primary source modules and public API';
  }
  return 'Project source submodule';
}

function isSourceFile(fileName) {
  return SOURCE_FILE_PATTERN.test(fileName);
}

function normalizeSignalSnippet(text) {
  return String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240);
}

function isSkippableSignalBlock(block) {
  if (!block) {
    return true;
  }

  const trimmed = block.trim();
  if (!trimmed) {
    return true;
  }

  if (trimmed.startsWith('```')) {
    return true;
  }

  const lines = trimmed.split(/\r?\n/).map((line) => line.trim());
  if (lines.every((line) => line.startsWith('#'))) {
    return true;
  }

  if (lines.every((line) => /^[:|\- ]+$/.test(line))) {
    return true;
  }

  return false;
}

function buildReferenceDocSignals(relativePath, content) {
  const text = String(content ?? '');
  if (!text.trim()) {
    return [];
  }

  const signals = [];
  const blocks = text
    .split(/\r?\n\s*\r?\n/)
    .map((block) => block.trim())
    .filter((block) => !isSkippableSignalBlock(block));

  const firstNarrativeBlock = blocks.find((block) =>
    block.split(/\r?\n/).some((line) => {
      const trimmed = line.trim();
      return trimmed.length > 0 && !trimmed.startsWith('#') && !trimmed.startsWith('|');
    })
  );
  if (firstNarrativeBlock) {
    signals.push(`${relativePath}: ${normalizeSignalSnippet(firstNarrativeBlock)}`);
  }

  const conventionPatterns = [
    /each guide should/i,
    /cross-reference/i,
    /write documentation/i,
    /keep documents actionable/i,
    /mirror the structure/i,
    /documentation-first/i,
    /no source code/i,
    /no build/i,
    /no test/i,
  ];
  const conventionLines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => /^(-|\d+\.)\s/.test(line))
    .filter((line) => conventionPatterns.some((pattern) => pattern.test(line)))
    .map((line) => `${relativePath}: ${normalizeSignalSnippet(line)}`);

  for (const signal of conventionLines) {
    if (!signals.includes(signal)) {
      signals.push(signal);
    }
    if (signals.length >= 5) {
      break;
    }
  }

  return signals;
}

function formatPackageEntryPoint(label, target) {
  if (typeof target !== 'string' || target.length === 0) {
    return null;
  }
  return `${label} -> ${target}`;
}

function formatExportTarget(target) {
  if (typeof target === 'string' && target.length > 0) {
    return target;
  }
  if (!target || typeof target !== 'object') {
    return null;
  }

  const conditions = [];
  for (const key of ['types', 'import', 'require', 'default', 'node']) {
    if (typeof target[key] === 'string' && target[key].length > 0) {
      conditions.push(`${key}: ${target[key]}`);
    }
  }

  return conditions.length > 0 ? conditions.join(', ') : 'conditional export';
}

function extractPackageEntryTarget(entry) {
  const SEPARATOR = ' -> ';
  const separatorIdx = String(entry ?? '').indexOf(SEPARATOR);
  if (separatorIdx === -1) {
    return '';
  }

  const entryPath = entry.slice(separatorIdx + SEPARATOR.length).trim();
  if (!entryPath || entryPath.includes(': ') || entryPath.includes(',')) {
    return '';
  }

  return entryPath;
}

async function findEditableSourceSibling(projectRoot, entryPath, fileOps) {
  if (typeof entryPath !== 'string' || entryPath.length === 0) {
    return null;
  }

  const extensionCandidates = new Map([
    ['.js', ['.ts', '.tsx']],
    ['.jsx', ['.tsx', '.ts']],
    ['.mjs', ['.mts', '.ts']],
    ['.cjs', ['.cts', '.ts']],
  ]);

  for (const [fromExtension, candidates] of extensionCandidates.entries()) {
    if (!entryPath.endsWith(fromExtension)) {
      continue;
    }

    const basePath = entryPath.slice(0, -fromExtension.length);
    for (const extension of candidates) {
      const siblingPath = `${basePath}${extension}`;
      if (await fileOps.exists(path.join(projectRoot, siblingPath))) {
        return siblingPath;
      }
    }
  }

  return null;
}

function normalizeSourceEntrySignal(relativePath, detail) {
  return `${relativePath}: ${normalizeSignalSnippet(detail)}`;
}

function extractSourceEntrySignal(relativePath, content) {
  const text = String(content ?? '');
  if (!text.trim()) {
    return normalizeSourceEntrySignal(relativePath, 'file present');
  }

  const blockCommentMatch = text.match(/^\s*\/\*\*?([\s\S]*?)\*\//);
  if (blockCommentMatch?.[1]) {
    const commentLines = blockCommentMatch[1]
      .split(/\r?\n/)
      .map((line) => line.replace(/^\s*\*?\s?/, '').trim())
      .filter(Boolean)
      .filter((line) => !/^@(?:param|returns?|example|throws|since|version)\b/i.test(line));
    const descriptiveComment = commentLines.find((line) =>
      /\b(entry point|router|bootstrap|mount|initialize|initialization|legacy|vue app)\b/i.test(
        line
      )
    );
    if (descriptiveComment) {
      return normalizeSourceEntrySignal(relativePath, descriptiveComment);
    }
    if (commentLines.length > 0) {
      return normalizeSourceEntrySignal(relativePath, commentLines.slice(0, 2).join(' '));
    }
  }

  const interestingLine = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) =>
      /\b(createApp|vue-router|window\.GuiaApp|document\.getElementById|handleRoute|init\(|bootstrap|mount)\b/.test(
        line
      )
    );
  if (interestingLine) {
    return normalizeSourceEntrySignal(relativePath, interestingLine);
  }

  return normalizeSourceEntrySignal(relativePath, 'file present');
}

export async function collectSourceEntrySignals(projectRoot, packageJson = {}, fileOps) {
  const candidatePaths = [];
  const seenPaths = new Set();

  const pushCandidate = (candidatePath) => {
    if (
      typeof candidatePath !== 'string' ||
      candidatePath.length === 0 ||
      seenPaths.has(candidatePath)
    ) {
      return;
    }
    seenPaths.add(candidatePath);
    candidatePaths.push(candidatePath);
  };

  const packageEntryPoints = collectPackageEntryPoints(packageJson);
  for (const entry of packageEntryPoints) {
    const entryPath = extractPackageEntryTarget(entry);
    if (!entryPath) {
      continue;
    }

    if (await fileOps.exists(path.join(projectRoot, entryPath))) {
      pushCandidate(entryPath);
      continue;
    }

    const editableSourceSibling = await findEditableSourceSibling(projectRoot, entryPath, fileOps);
    if (editableSourceSibling) {
      pushCandidate(editableSourceSibling);
    }
  }

  for (const conventionalPath of [
    'src/main.ts',
    'src/main.js',
    'src/app.ts',
    'src/app.js',
    'src/index.ts',
    'src/index.js',
  ]) {
    if (await fileOps.exists(path.join(projectRoot, conventionalPath))) {
      pushCandidate(conventionalPath);
    }
  }

  const signals = [];
  for (const relativePath of candidatePaths) {
    try {
      const content = await fileOps.readFile(path.join(projectRoot, relativePath));
      signals.push(extractSourceEntrySignal(relativePath, content));
    } catch {
      signals.push(normalizeSourceEntrySignal(relativePath, 'file present'));
    }
  }

  return signals;
}

export function collectPackageEntryPoints(packageJson = {}) {
  const entryPoints = [];

  const pushEntryPoint = (value) => {
    if (typeof value === 'string' && value.length > 0) {
      entryPoints.push(value);
    }
  };

  pushEntryPoint(formatPackageEntryPoint('main', packageJson.main));
  pushEntryPoint(formatPackageEntryPoint('module', packageJson.module));
  pushEntryPoint(formatPackageEntryPoint('types', packageJson.types));

  if (typeof packageJson.exports === 'string') {
    pushEntryPoint(formatPackageEntryPoint('exports .', packageJson.exports));
  } else if (packageJson.exports && typeof packageJson.exports === 'object') {
    for (const key of sortNatural(Object.keys(packageJson.exports))) {
      const target = formatExportTarget(packageJson.exports[key]);
      pushEntryPoint(formatPackageEntryPoint(`exports ${key}`, target));
    }
  }

  if (typeof packageJson.bin === 'string') {
    pushEntryPoint(formatPackageEntryPoint('bin', packageJson.bin));
  } else if (packageJson.bin && typeof packageJson.bin === 'object') {
    for (const key of sortNatural(Object.keys(packageJson.bin))) {
      pushEntryPoint(formatPackageEntryPoint(`bin ${key}`, packageJson.bin[key]));
    }
  }

  return sortNatural([...new Set(entryPoints)]);
}

export async function annotateEntryPointsExistence(projectRoot, entryPoints, fileOps) {
  const SEPARATOR = ' -> ';
  return Promise.all(
    entryPoints.map(async (entry) => {
      const separatorIdx = entry.indexOf(SEPARATOR);
      if (separatorIdx === -1) return entry;
      const entryPath = entry.slice(separatorIdx + SEPARATOR.length);
      // Conditional export descriptions contain ': ' or ',' — skip existence check for those
      if (entryPath.includes(': ') || entryPath.includes(',')) return entry;
      const exists = await fileOps.exists(path.join(projectRoot, entryPath));
      if (exists) {
        return entry;
      }

      const editableSourceSibling = await findEditableSourceSibling(
        projectRoot,
        entryPath,
        fileOps
      );
      if (editableSourceSibling) {
        return `${entry} (editable source sibling: ${editableSourceSibling})`;
      }

      return `${entry} (compiled output — not present in source tree)`;
    })
  );
}

export async function detectSourceLayers(projectRoot, fileOps) {
  const explicitLayers = await Promise.all(
    COPILOT_SOURCE_LAYERS.map(async ([relativePath, purpose]) => ({
      path: relativePath,
      purpose,
      present: await fileOps.exists(path.join(projectRoot, relativePath)),
    }))
  ).then((entries) =>
    sortLayerEntries(
      entries
        .filter(({ present }) => present)
        .map(({ path: layerPath, purpose }) => ({ path: layerPath, purpose }))
    )
  );

  if (explicitLayers.length > 0) {
    return explicitLayers;
  }

  const srcRoot = path.join(projectRoot, 'src');
  const srcExists = await fileOps.exists(srcRoot);
  if (!srcExists) {
    return [];
  }

  try {
    const entries = await fs.readdir(srcRoot, { withFileTypes: true });
    const dynamicLayers = entries
      .filter(
        (entry) =>
          entry.isDirectory() &&
          !entry.name.startsWith('.') &&
          !NON_SOURCE_LAYER_DIRS.has(entry.name)
      )
      .map((entry) => ({
        path: `src/${entry.name}/`,
        purpose: describeSourceLayer(`src/${entry.name}/`),
      }));
    const hasSourceFiles = entries.some((entry) => entry.isFile() && isSourceFile(entry.name));

    if (hasSourceFiles || dynamicLayers.length === 0) {
      dynamicLayers.unshift({
        path: 'src/',
        purpose: describeSourceLayer('src/'),
      });
    }

    return sortLayerEntries(dynamicLayers);
  } catch {
    return [
      {
        path: 'src/',
        purpose: describeSourceLayer('src/'),
      },
    ];
  }
}

export function ensureTrailingNewline(content) {
  if (typeof content !== 'string' || content.length === 0) {
    return '';
  }
  return content.endsWith('\n') ? content : `${content}\n`;
}

export function extractCorrectedCopilotInstructions(responseText) {
  const text = String(responseText ?? '').trim();
  if (!text) {
    return '';
  }

  const correctedSectionMatch = text.match(
    /##\s+Corrected File\b[^\n]*\n```(?:markdown|md)?\n([\s\S]*?)```/i
  );
  if (correctedSectionMatch?.[1]) {
    return ensureTrailingNewline(correctedSectionMatch[1].trim());
  }

  const fencedMatch = text.match(/```(?:markdown|md)?\n([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return ensureTrailingNewline(fencedMatch[1].trim());
  }

  const headingIndex = text.indexOf('# GitHub Copilot Instructions');
  if (headingIndex >= 0) {
    return ensureTrailingNewline(text.slice(headingIndex).trim());
  }

  return '';
}

export function extractCopilotInstructionsFindings(responseText) {
  const text = String(responseText ?? '').trim();
  if (!text) {
    return '';
  }

  const correctedSectionMatch = text.match(
    /([\s\S]*?)\n##\s+Corrected File\b[^\n]*\n```(?:markdown|md)?\n[\s\S]*?```/i
  );
  if (correctedSectionMatch?.[1]) {
    return ensureTrailingNewline(correctedSectionMatch[1].trim());
  }

  const fencedMatch = text.match(/```(?:markdown|md)?\n([\s\S]*?)```/i);
  if (typeof fencedMatch?.index === 'number') {
    return ensureTrailingNewline(text.slice(0, fencedMatch.index).trim());
  }

  const headingIndex = text.indexOf('# GitHub Copilot Instructions');
  if (headingIndex >= 0) {
    return ensureTrailingNewline(text.slice(0, headingIndex).trim());
  }

  return ensureTrailingNewline(text);
}

function extractFindingBulletValue(sectionText, label) {
  const lines = String(sectionText ?? '').split('\n');
  const bulletPattern = new RegExp(`^- \\*\\*${escapeRegExp(label)}\\*\\*:(.*)$`);
  const nextFieldPattern = /^- \*\*[^*]+\*\*:/;
  const collected = [];
  let collecting = false;

  for (const line of lines) {
    if (!collecting) {
      const match = line.match(bulletPattern);
      if (!match) {
        continue;
      }
      collecting = true;
      if (match[1]?.trim()) {
        collected.push(match[1].trim());
      }
      continue;
    }

    if (
      nextFieldPattern.test(line) ||
      /^###\s+Finding\s+\d+\s+-\s+.+$/.test(line) ||
      /^##\s+\S/.test(line)
    ) {
      break;
    }

    collected.push(line.replace(/^\s+/, ''));
  }

  return collected.join('\n').trim();
}

function splitFindingSections(findingsText) {
  const text = String(findingsText ?? '').trim();
  if (!text) {
    return [];
  }

  const matches = [...text.matchAll(FINDING_SECTION_PATTERN)];
  if (matches.length === 0) {
    return [];
  }

  return matches.map((match, index) => {
    const start = match.index ?? 0;
    const end = matches[index + 1]?.index ?? text.length;
    return text.slice(start, end).trim();
  });
}

function collectQuotedSnippets(text) {
  return [...String(text ?? '').matchAll(QUOTED_SNIPPET_PATTERN)]
    .map((match) => match[1] || match[2] || '')
    .filter(Boolean);
}

function escapeRegExp(text) {
  return String(text ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function collectCurrentEvidenceBackticks(text) {
  return [...String(text ?? '').matchAll(/`([^`]+)`/g)]
    .map((match) => match[1]?.trim() || '')
    .filter(Boolean);
}

function normalizeRepoFactComparableText(text) {
  return String(text ?? '')
    .normalize('NFKC')
    .replace(/[‐‑–—]/g, '-')
    .replace(/[`*_]+/g, '')
    .replace(/\[(.+?)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function repoFactsContextIncludesSnippet(repoFactsContext, snippet) {
  const normalizedSnippet = normalizeRepoFactComparableText(snippet);
  if (!normalizedSnippet) {
    return false;
  }

  return normalizeRepoFactComparableText(repoFactsContext).includes(normalizedSnippet);
}

function validateRepoFactEvidence(repoFactEvidence, repoFactsContext, requiresExplicitSupport) {
  const trimmedEvidence = String(repoFactEvidence ?? '').trim();
  if (!trimmedEvidence) {
    return {
      valid: false,
      issues: ['Missing `Repo-fact evidence` bullet value.'],
    };
  }

  if (/^not available\b/i.test(trimmedEvidence)) {
    return requiresExplicitSupport
      ? {
          valid: false,
          issues: [
            '`supported guidance` findings must cite explicit surfaced repo-fact support, not `not available`.',
          ],
        }
      : { valid: true, issues: [] };
  }

  const quotedSnippets = collectQuotedSnippets(trimmedEvidence);
  const invalidSnippets = quotedSnippets.filter(
    (snippet) => !repoFactsContextIncludesSnippet(repoFactsContext, snippet)
  );
  if (invalidSnippets.length > 0) {
    return {
      valid: false,
      issues: invalidSnippets.map(
        (snippet) => `Repo-fact evidence cites unsupported snippet "${snippet}".`
      ),
    };
  }

  const matchedHeadings = COPILOT_INSTRUCTIONS_REPO_FACT_HEADINGS.filter((heading) =>
    trimmedEvidence.includes(heading)
  );
  const citedBroadHeadings = new Set(
    [
      ...matchedHeadings,
      ...quotedSnippets.filter((snippet) => BROAD_REPO_FACT_HEADINGS.has(snippet)),
    ].filter((heading) => BROAD_REPO_FACT_HEADINGS.has(heading))
  );
  const hasExactNonHeadingSnippet = quotedSnippets.some(
    (snippet) => !COPILOT_INSTRUCTIONS_REPO_FACT_HEADINGS.includes(snippet)
  );
  if (requiresExplicitSupport && quotedSnippets.length === 0 && matchedHeadings.length === 0) {
    return {
      valid: false,
      issues: [
        '`supported guidance` findings must cite at least one surfaced repo-fact heading or quoted snippet.',
      ],
    };
  }

  if (
    requiresExplicitSupport &&
    !hasExactNonHeadingSnippet &&
    citedBroadHeadings.size > 0 &&
    matchedHeadings.every((heading) => BROAD_REPO_FACT_HEADINGS.has(heading))
  ) {
    return {
      valid: false,
      issues: [
        `\`supported guidance\` findings must cite an exact surfaced snippet when relying on ${[...citedBroadHeadings].join(', ')}.`,
      ],
    };
  }

  return { valid: true, issues: [] };
}

function formatInvalidFindings(issues) {
  const lines = [
    'Structured findings could not be trusted.',
    '',
    'Validation issues:',
    ...issues.map((issue) => `- ${issue}`),
    '',
    'See the raw AI response below for the untrusted original output.',
  ];
  return `${lines.join('\n')}\n`;
}

function buildCopilotInstructionsRetryPrompt(prompt, validationIssues) {
  const issues = [
    ...new Set((validationIssues ?? []).map((issue) => String(issue ?? '').trim()).filter(Boolean)),
  ];
  if (issues.length === 0) {
    return prompt;
  }

  const lines = [
    String(prompt ?? '').trimEnd(),
    '',
    '## Response repair instructions',
    'Your previous response was rejected by deterministic validation.',
    'Fix every issue below and return a complete replacement response.',
    'Only text inside the BEGIN/END `Authoritative Repo Facts` block is citable as `Repo-fact evidence`.',
    'Do not cite task instructions, hard rules, or output-format text as repo-fact evidence.',
    'Keep each labeled finding bullet as one field; if a value spans multiple lines, continue it under the same bullet and do not start the next `- **...**:` field until the value is complete.',
    'If a `supported guidance` finding mixes supported and unsupported repo-specific details, rewrite it to the supported subset first; split, downgrade, or omit only the unsupported remainder.',
    'Do not treat an unchanged corrected file as proof that no issue exists; keep every concrete finding that explains why text was retained or why support remained inconclusive.',
    'Use a single explicit no-issue finding only when the entire file needs no corrections and every retained claim is supported by surfaced repo facts.',
    '',
    '### Validation issues to fix',
    ...issues.map((issue) => `- ${issue}`),
  ];

  return `${lines.join('\n')}\n`;
}

export function validateCopilotInstructionsRewriteConsistency(
  findingsText,
  currentContent,
  correctedContent
) {
  const normalizedCurrent = ensureTrailingNewline(String(currentContent ?? '').trim());
  const normalizedCorrected = ensureTrailingNewline(String(correctedContent ?? '').trim());

  if (!normalizedCurrent || !normalizedCorrected || normalizedCurrent !== normalizedCorrected) {
    return { valid: true, issues: [] };
  }

  const sections = splitFindingSections(findingsText);
  if (sections.length === 0) {
    return { valid: true, issues: [] };
  }

  const issues = [];
  for (const section of sections) {
    const heading = section.split('\n', 1)[0] || 'Unknown finding';
    const action = extractFindingBulletValue(section, 'Action');
    const currentFileEvidence = extractFindingBulletValue(section, 'Current file evidence');
    const currentFileEvidenceSignalsAbsence = /^(?:none\b|no\b)/i.test(currentFileEvidence);

    if (/^(?:rewrite|remove)\b/i.test(action)) {
      issues.push(
        `${heading}: The corrected file is unchanged, so action "${action}" is inconsistent; either change the corrected file or keep the text with a finding that explains why it remains acceptable as-is.`
      );
    }

    if (/^omit pending evidence\b/i.test(action) && !currentFileEvidenceSignalsAbsence) {
      issues.push(
        `${heading}: The corrected file is unchanged, so action "${action}" is inconsistent for visible current-file text; either remove that text from the corrected file or explain why it remains with action "keep".`
      );
    }
  }

  return { valid: issues.length === 0, issues };
}

export function validateCopilotInstructionsFindings(findingsText, repoFactsContext = '') {
  const normalizedFindings = ensureTrailingNewline(String(findingsText ?? '').trim());
  if (!normalizedFindings) {
    return {
      valid: false,
      issues: ['No `## Findings` content was returned.'],
      findings: formatInvalidFindings(['No `## Findings` content was returned.']),
    };
  }

  const sections = splitFindingSections(normalizedFindings);
  if (sections.length === 0) {
    return {
      valid: false,
      issues: ['No `### Finding N - ...` sections were returned inside `## Findings`.'],
      findings: formatInvalidFindings([
        'No `### Finding N - ...` sections were returned inside `## Findings`.',
      ]),
    };
  }

  const issues = [];
  const sectionCount = sections.length;
  for (const section of sections) {
    const heading = section.split('\n', 1)[0] || 'Unknown finding';
    const findingTitle = heading.replace(/^###\s+Finding\s+\d+\s+-\s+/i, '').trim();
    const classification = extractFindingBulletValue(section, 'Classification');
    const action = extractFindingBulletValue(section, 'Action');
    const currentFileEvidence = extractFindingBulletValue(section, 'Current file evidence');
    const repoFactEvidence = extractFindingBulletValue(section, 'Repo-fact evidence');

    if (!COPILOT_INSTRUCTIONS_FINDING_CLASSIFICATIONS.includes(classification)) {
      issues.push(`${heading} uses unsupported classification "${classification || '(missing)'}".`);
    }

    if (!COPILOT_INSTRUCTIONS_FINDING_ACTIONS.includes(action)) {
      issues.push(`${heading} uses unsupported action "${action || '(missing)'}".`);
    }

    if (
      sectionCount > 1 &&
      /^(absence of|no )/i.test(findingTitle) &&
      /^(none\b|no\b)/i.test(currentFileEvidence)
    ) {
      issues.push(
        `${heading} is a meta or absent-topic finding; reserve that pattern for the single no-issue finding or a concretely required omission.`
      );
    }

    if (
      sectionCount > 1 &&
      /^keep\b/i.test(action) &&
      /\b(?:does not include|already avoids|no unsupported|no stale|not present)\b/i.test(
        currentFileEvidence
      )
    ) {
      issues.push(
        `${heading} is a meta or absent-topic finding; findings should map to visible current-file claims, not to the absence of a problem.`
      );
    }

    const repoFactValidation = validateRepoFactEvidence(
      repoFactEvidence,
      repoFactsContext,
      classification === 'supported guidance'
    );
    if (!repoFactValidation.valid) {
      for (const issue of repoFactValidation.issues) {
        issues.push(`${heading}: ${issue}`);
      }
    }

    if (classification === 'supported guidance') {
      const unsupportedCurrentEvidenceSnippets = collectCurrentEvidenceBackticks(
        currentFileEvidence
      ).filter((snippet) => !repoFactsContextIncludesSnippet(repoFactsContext, snippet));
      if (unsupportedCurrentEvidenceSnippets.length > 0) {
        issues.push(
          `${heading}: \`supported guidance\` findings cannot retain unsupported repo-specific details from current-file evidence (${unsupportedCurrentEvidenceSnippets
            .map((snippet) => `\`${snippet}\``)
            .join(', ')}); split or downgrade the unsupported claim.`
        );
      }
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    findings: issues.length === 0 ? normalizedFindings : formatInvalidFindings(issues),
  };
}

export function buildCopilotInstructionsRepoFactsContext(facts) {
  const validationCommands = Object.entries(facts.validationCommands ?? {})
    .map(([label, command]) => `- ${label}: \`${command}\``)
    .join('\n');
  const sourceLayers = (facts.sourceLayers ?? [])
    .map(({ path: layerPath, purpose }) => `- \`${layerPath}\` - ${purpose}`)
    .join('\n');
  const referenceDocs = (facts.referenceDocs ?? []).map((doc) => `- \`${doc}\``).join('\n');
  const referenceDocSignals = (facts.referenceDocSignals ?? [])
    .map((signal) => `- ${signal}`)
    .join('\n');
  const auxiliaryNormativeFiles = (facts.auxiliaryNormativeFiles ?? [])
    .map(({ path: filePath, purpose }) => `- \`${filePath}\` - ${purpose}`)
    .join('\n');
  const supportingSurfaces = (facts.supportingSurfaces ?? [])
    .map(({ path: surfacePath, purpose }) => `- \`${surfacePath}\` - ${purpose}`)
    .join('\n');
  const packageExports = (facts.packageExports ?? []).map((entry) => `- \`${entry}\``).join('\n');
  const sourceEntrySignals = (facts.sourceEntrySignals ?? [])
    .map((signal) => `- ${signal}`)
    .join('\n');
  const packageManifestPresent = facts.packageManifestPresent !== false;
  const packageName = packageManifestPresent
    ? facts.packageName || 'unknown'
    : 'N/A (no package.json)';
  const packageVersion = packageManifestPresent
    ? facts.packageVersion || 'unknown'
    : 'N/A (no package.json)';
  const packageDescription = packageManifestPresent
    ? facts.packageDescription || 'Unavailable'
    : 'No package manifest detected.';

  const lines = [
    '## Authoritative Repo Facts',
    '',
    '### Package Metadata',
    `- package.json present: ${packageManifestPresent ? 'yes' : 'no'}`,
    `- Package name: \`${packageName}\``,
    `- Package version: \`${packageVersion}\``,
    `- Package description: ${packageDescription}`,
    '',
    '### Copilot File Purpose',
    '- Keep `.github/copilot-instructions.md` focused on durable, high-signal guidance for Copilot-assisted edits.',
    '- Prefer links to authoritative docs over duplicated inventories, counts, status snapshots, or long command lists.',
    '',
    '### Validation Commands',
    validationCommands || '- No standard validation commands detected.',
    '',
    '### Stable Source Layers',
    sourceLayers || '- Unavailable',
    '',
    '### Supporting Workflow Surfaces',
    supportingSurfaces || '- Unavailable',
    '',
    '### Authoritative Reference Docs',
    referenceDocs || '- Unavailable',
    '',
    '### Reference Doc Signals',
    referenceDocSignals || '- Unavailable',
    '',
    '### Auxiliary Normative Files',
    auxiliaryNormativeFiles || '- Unavailable',
    '',
    '### Public Package Entry Points',
    packageExports || '- Unavailable',
    '',
    '### Source Entry Signals',
    sourceEntrySignals || '- Unavailable',
  ];

  return `${lines.join('\n')}\n`;
}

export class Step1_5CopilotInstructionsValidator {
  constructor(options = {}) {
    this.kind = STEP_KIND.ANALYSIS;
    this.fileOps = options.fileOps || new FileOperations();
    this.backlog = options.backlog || new Backlog(options.configManager || process.cwd());
    this.aiHelper = options.aiHelper || new AiHelper({ promptsDir: options.promptsDir || null });
    this.aiCache = options.aiCache || new AiCache({ namespace: 'step_01_5_copilot_instructions' });
    this.parsedAiHelpers = options.parsedAiHelpers || null;
  }

  async execute(projectRoot, options = {}) {
    const targetPath = path.join(projectRoot, COPILOT_INSTRUCTIONS_RELATIVE_PATH);
    const exists = await this.fileOps.exists(targetPath);

    if (!exists) {
      logger.info('Step 1.5 skipped - .github/copilot-instructions.md not found');
      return {
        success: true,
        skipped: true,
        file: COPILOT_INSTRUCTIONS_RELATIVE_PATH,
      };
    }

    const aiAvailable =
      typeof this.aiHelper?.initialize === 'function' ? await this.aiHelper.initialize() : true;
    if (!aiAvailable) {
      logger.warn('AI helper not available - skipping copilot instructions validation');
      const summary = [
        '## Step 1.5: GitHub Copilot Instructions Validation',
        '',
        `- **Target file**: \`${COPILOT_INSTRUCTIONS_RELATIVE_PATH}\``,
        '- **Skipped**: yes',
        '- **Reason**: AI helper unavailable',
      ].join('\n');
      await this.backlog.saveStepSummary('01_5', 'Copilot_Instructions_Validation', summary, '⚠️');
      return {
        success: true,
        skipped: true,
        reason: 'ai_unavailable',
        file: COPILOT_INSTRUCTIONS_RELATIVE_PATH,
      };
    }

    const currentContent = await this.fileOps.readFile(targetPath);
    const facts = await this.collectRepoFacts(projectRoot, currentContent);
    const repoFacts = buildCopilotInstructionsRepoFactsContext(facts);
    const parsedYaml =
      options.parsedAiHelpers ||
      this.parsedAiHelpers ||
      (await loadResolvedAiHelpers(this.fileOps));
    const prompt =
      buildYamlStepPrompt(parsedYaml, 'step1_5_copilot_instructions_prompt', {
        project_name: facts.packageName || path.basename(projectRoot),
        project_summary: facts.packageDescription || '',
        primary_language: 'javascript',
        copilot_instructions_path: COPILOT_INSTRUCTIONS_RELATIVE_PATH,
        copilot_instructions_content: currentContent,
        repo_facts: repoFacts,
      }) || '';

    if (!prompt) {
      throw new Error('Failed to build copilot instructions validation prompt');
    }

    const cacheInputs = [
      currentContent,
      JSON.stringify(facts),
      JSON.stringify({ alternatives: !!options.alternatives }),
    ];
    let aiContent =
      (
        await this.aiCache.withFileChangeGuard('step_01_5', cacheInputs, () =>
          this.aiHelper.executeRequest(prompt, {
            persona: 'documentation_expert',
            model: 'claude-sonnet-4.5',
          })
        )
      )?.content ?? '';

    let extractedFindings = extractCopilotInstructionsFindings(aiContent);
    let findingsValidation = validateCopilotInstructionsFindings(extractedFindings, repoFacts);
    let correctedContent = extractCorrectedCopilotInstructions(aiContent);
    let rewriteConsistencyValidation = validateCopilotInstructionsRewriteConsistency(
      extractedFindings,
      currentContent,
      correctedContent
    );

    if (!findingsValidation.valid || !rewriteConsistencyValidation.valid) {
      logger.warn('Step 1.5 response validation failed; retrying once without cache');
      const retryPrompt = buildCopilotInstructionsRetryPrompt(prompt, [
        ...findingsValidation.issues,
        ...rewriteConsistencyValidation.issues,
      ]);
      const retryContent =
        (
          await this.aiHelper.executeRequest(retryPrompt, {
            persona: 'documentation_expert',
            model: 'claude-sonnet-4.5',
          })
        )?.content ?? '';
      if (retryContent) {
        aiContent = retryContent;
        extractedFindings = extractCopilotInstructionsFindings(retryContent);
        findingsValidation = validateCopilotInstructionsFindings(extractedFindings, repoFacts);
        correctedContent = extractCorrectedCopilotInstructions(retryContent);
        rewriteConsistencyValidation = validateCopilotInstructionsRewriteConsistency(
          extractedFindings,
          currentContent,
          correctedContent
        );
      }
    }

    const blockingValidationIssues = [...findingsValidation.issues];
    const validationIssues = [...blockingValidationIssues, ...rewriteConsistencyValidation.issues];
    const findings = findingsValidation.findings;
    const normalizedCurrent = ensureTrailingNewline(currentContent.trim());
    const updated =
      blockingValidationIssues.length === 0 &&
      correctedContent.length > 0 &&
      correctedContent !== normalizedCurrent;
    const trustedFindingsHeading =
      validationIssues.length === 0 ? '### Findings' : '### Trusted Findings Status';

    if (updated) {
      await this.fileOps.writeFile(targetPath, correctedContent);
      logger.success('Step 1.5 updated .github/copilot-instructions.md');
    } else {
      logger.info('Step 1.5 found no applicable copilot-instructions changes');
    }

    const summary = [
      '## Step 1.5: GitHub Copilot Instructions Validation',
      '',
      `- **Target file**: \`${COPILOT_INSTRUCTIONS_RELATIVE_PATH}\``,
      `- **Updated**: ${updated ? 'yes' : 'no'}`,
      `- **Validation commands surfaced**: ${Object.values(facts.validationCommands).join(', ') || 'none'}`,
      `- **Reference docs surfaced**: ${facts.referenceDocs.map((doc) => `\`${doc}\``).join(', ') || 'none'}`,
      `- **Structured findings valid**: ${validationIssues.length === 0 ? 'yes' : 'no'}`,
      `- **Corrected file trusted for write**: ${blockingValidationIssues.length === 0 ? 'yes' : 'no'}`,
      '',
      repoFacts.trim(),
      '',
      trustedFindingsHeading,
      findings ? findings.trim() : 'No structured findings returned.',
      '',
      '### AI Response',
      aiContent ? aiContent : 'No AI response returned.',
    ].join('\n');

    await this.backlog.saveStepSummary('01_5', 'Copilot_Instructions_Validation', summary, '🤖');

    return {
      success: true,
      updated,
      file: COPILOT_INSTRUCTIONS_RELATIVE_PATH,
      facts,
      findings,
      findingsValid: validationIssues.length === 0,
      findingsValidationIssues: validationIssues,
    };
  }

  async collectRepoFacts(projectRoot, currentContent = '') {
    const packageJsonPath = path.join(projectRoot, 'package.json');
    const packageManifestPresent = await this.fileOps.exists(packageJsonPath);
    const packageJson = packageManifestPresent
      ? JSON.parse(await this.fileOps.readFile(packageJsonPath))
      : {};
    const [referenceDocs, sourceLayers, supportingSurfaces, auxiliaryNormativeFiles] =
      await Promise.all([
        Promise.all(
          COPILOT_REFERENCE_DOCS.map(async (relativePath) => ({
            relativePath,
            present: await this.fileOps.exists(path.join(projectRoot, relativePath)),
          }))
        ).then((entries) =>
          sortNatural(
            entries.filter(({ present }) => present).map(({ relativePath }) => relativePath)
          )
        ),
        detectSourceLayers(projectRoot, this.fileOps),
        Promise.all(
          COPILOT_SUPPORTING_SURFACES.map(async ([relativePath, purpose]) => ({
            path: relativePath,
            purpose,
            present: await this.fileOps.exists(path.join(projectRoot, relativePath)),
          }))
        ).then((entries) =>
          entries
            .filter(({ present }) => present)
            .map(({ path: surfacePath, purpose }) => ({ path: surfacePath, purpose }))
        ),
        Promise.all(
          COPILOT_AUXILIARY_NORMATIVE_FILES.map(async ([relativePath, purpose]) => ({
            path: relativePath,
            purpose,
            present: await this.fileOps.exists(path.join(projectRoot, relativePath)),
            cited:
              currentContent.includes(`\`${relativePath}\``) ||
              currentContent.includes(relativePath),
          }))
        ).then((entries) =>
          entries
            .filter(({ present, cited }) => present && cited)
            .map(({ path: filePath, purpose }) => ({ path: filePath, purpose }))
        ),
      ]);
    const referenceDocSignals = await Promise.all(
      referenceDocs.map(async (relativePath) => {
        try {
          const content = await this.fileOps.readFile(path.join(projectRoot, relativePath));
          return buildReferenceDocSignals(relativePath, content);
        } catch {
          return [];
        }
      })
    ).then((signals) => signals.flat().filter(Boolean));

    const packageExports = await annotateEntryPointsExistence(
      projectRoot,
      collectPackageEntryPoints(packageJson),
      this.fileOps
    );
    const sourceEntrySignals = await collectSourceEntrySignals(
      projectRoot,
      packageJson,
      this.fileOps
    );

    return {
      packageManifestPresent,
      packageName: packageJson.name || '',
      packageVersion: packageJson.version || '',
      packageDescription: packageJson.description || '',
      packageExports,
      sourceEntrySignals,
      validationCommands: {
        ...(packageJson.scripts?.lint ? { Lint: 'npm run lint' } : {}),
        ...(packageJson.scripts?.test ? { Test: 'npm test' } : {}),
        ...(packageJson.scripts?.build ? { Build: 'npm run build' } : {}),
      },
      auxiliaryNormativeFiles,
      referenceDocSignals,
      referenceDocs,
      sourceLayers,
      supportingSurfaces,
    };
  }
}

export default Step1_5CopilotInstructionsValidator;
