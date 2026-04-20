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
  'INDEX.md',
  'ROADMAP.md',
  'docs/ARCHITECTURE.md',
  'docs/CLI_USAGE_GUIDE.md',
  'docs/guides/MIGRATION_GUIDE.md',
  'CHANGELOG.md',
  'CONTRIBUTING.md',
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
const SOURCE_FILE_PATTERN = /\.(?:[cm]?[jt]sx?|d\.ts)$/i;
const NON_SOURCE_LAYER_DIRS = new Set(['__tests__', '__mocks__', 'fixtures']);

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

function buildReferenceDocSignal(relativePath, content) {
  const lines = String(content ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    return null;
  }

  const snippet = lines.slice(0, 2).join(' ').replace(/\s+/g, ' ').slice(0, 200);

  return `${relativePath}: ${snippet}`;
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

  for (const key of ['types', 'import', 'require', 'default', 'node']) {
    if (typeof target[key] === 'string' && target[key].length > 0) {
      return `${key}: ${target[key]}`;
    }
  }

  return 'conditional export';
}

export function collectPackageEntryPoints(packageJson = {}) {
  const entryPoints = [];

  const pushEntryPoint = (value) => {
    if (typeof value === 'string' && value.length > 0) {
      entryPoints.push(value);
    }
  };

  pushEntryPoint(formatPackageEntryPoint('main', packageJson.main));
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

export function buildCopilotInstructionsRepoFactsContext(facts) {
  const validationCommands = Object.entries(facts.validationCommands ?? {})
    .map(([label, command]) => `- ${label}: \`${command}\``)
    .join('\n');
  const sourceLayers = (facts.sourceLayers ?? [])
    .map(({ path: layerPath, purpose }) => `- \`${layerPath}\` - ${purpose}`)
    .join('\n');
  const referenceDocSignals = (facts.referenceDocSignals ?? [])
    .map((signal) => `- ${signal}`)
    .join('\n');
  const referenceDocs = (facts.referenceDocs ?? []).map((doc) => `- \`${doc}\``).join('\n');
  const supportingSurfaces = (facts.supportingSurfaces ?? [])
    .map(({ path: surfacePath, purpose }) => `- \`${surfacePath}\` - ${purpose}`)
    .join('\n');
  const packageExports = (facts.packageExports ?? []).map((entry) => `- \`${entry}\``).join('\n');
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
    '### Reference Doc Signals',
    referenceDocSignals || '- Unavailable',
    '',
    '### Authoritative Reference Docs',
    referenceDocs || '- Unavailable',
    '',
    '### Public Package Entry Points',
    packageExports || '- Unavailable',
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
    const facts = await this.collectRepoFacts(projectRoot);
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
    const aiResult = await this.aiCache.withFileChangeGuard('step_01_5', cacheInputs, () =>
      this.aiHelper.executeRequest(prompt, {
        persona: 'documentation_expert',
        model: 'claude-sonnet-4.5',
      })
    );

    const aiContent = aiResult?.content ?? '';
    const findings = extractCopilotInstructionsFindings(aiContent);
    const correctedContent = extractCorrectedCopilotInstructions(aiContent);
    const normalizedCurrent = ensureTrailingNewline(currentContent.trim());
    const updated = correctedContent.length > 0 && correctedContent !== normalizedCurrent;

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
      '',
      repoFacts.trim(),
      '',
      '### Findings',
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
    };
  }

  async collectRepoFacts(projectRoot) {
    const packageJsonPath = path.join(projectRoot, 'package.json');
    const packageManifestPresent = await this.fileOps.exists(packageJsonPath);
    const packageJson = packageManifestPresent
      ? JSON.parse(await this.fileOps.readFile(packageJsonPath))
      : {};
    const [referenceDocs, sourceLayers, supportingSurfaces] = await Promise.all([
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
    ]);
    const referenceDocSignals = await Promise.all(
      referenceDocs.map(async (relativePath) => {
        try {
          const content = await this.fileOps.readFile(path.join(projectRoot, relativePath));
          return buildReferenceDocSignal(relativePath, content);
        } catch {
          return null;
        }
      })
    ).then((signals) => signals.filter(Boolean));

    return {
      packageManifestPresent,
      packageName: packageJson.name || '',
      packageVersion: packageJson.version || '',
      packageDescription: packageJson.description || '',
      packageExports: collectPackageEntryPoints(packageJson),
      validationCommands: {
        ...(packageJson.scripts?.lint ? { Lint: 'npm run lint' } : {}),
        ...(packageJson.scripts?.test ? { Test: 'npm test' } : {}),
        ...(packageJson.scripts?.build ? { Build: 'npm run build' } : {}),
      },
      referenceDocSignals,
      referenceDocs,
      sourceLayers,
      supportingSurfaces,
    };
  }
}

export default Step1_5CopilotInstructionsValidator;
