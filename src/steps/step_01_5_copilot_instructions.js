/**
 * Step 1.5: GitHub Copilot Instructions Validation
 * @module steps/step_01_5_copilot_instructions
 * @version 2.0.0
 *
 * Audits and refreshes `.github/copilot-instructions.md` against deterministic
 * repository facts so prompt-time authority docs stay aligned with the live repo.
 */

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

function sortNatural(values) {
  return [...values].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
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

export function buildCopilotInstructionsRepoFactsContext(facts) {
  const validationCommands = Object.entries(facts.validationCommands ?? {})
    .map(([label, command]) => `- ${label}: \`${command}\``)
    .join('\n');
  const sourceLayers = (facts.sourceLayers ?? [])
    .map(({ path: layerPath, purpose }) => `- \`${layerPath}\` - ${purpose}`)
    .join('\n');
  const referenceDocs = (facts.referenceDocs ?? []).map((doc) => `- \`${doc}\``).join('\n');
  const supportingSurfaces = (facts.supportingSurfaces ?? [])
    .map(({ path: surfacePath, purpose }) => `- \`${surfacePath}\` - ${purpose}`)
    .join('\n');
  const packageExports = (facts.packageExports ?? []).map((entry) => `- \`${entry}\``).join('\n');

  const lines = [
    '## Authoritative Repo Facts',
    '',
    '### Package Metadata',
    `- Package name: \`${facts.packageName || 'unknown'}\``,
    `- Package version: \`${facts.packageVersion || 'unknown'}\``,
    `- Package description: ${facts.packageDescription || 'Unavailable'}`,
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
      '### AI Response',
      aiContent ? aiContent : 'No AI response returned.',
    ].join('\n');

    await this.backlog.saveStepSummary('01_5', 'Copilot_Instructions_Validation', summary, '🤖');

    return {
      success: true,
      updated,
      file: COPILOT_INSTRUCTIONS_RELATIVE_PATH,
      facts,
    };
  }

  async collectRepoFacts(projectRoot) {
    const packageJsonRaw = await this.fileOps.readFile(path.join(projectRoot, 'package.json'));
    const packageJson = JSON.parse(packageJsonRaw);
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
      Promise.all(
        COPILOT_SOURCE_LAYERS.map(async ([relativePath, purpose]) => ({
          path: relativePath,
          purpose,
          present: await this.fileOps.exists(path.join(projectRoot, relativePath)),
        }))
      ).then((entries) =>
        entries
          .filter(({ present }) => present)
          .map(({ path: layerPath, purpose }) => ({ path: layerPath, purpose }))
      ),
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

    return {
      packageName: packageJson.name || '',
      packageVersion: packageJson.version || '',
      packageDescription: packageJson.description || '',
      packageExports: sortNatural(Object.keys(packageJson.exports || {})),
      validationCommands: {
        ...(packageJson.scripts?.lint ? { Lint: 'npm run lint' } : {}),
        ...(packageJson.scripts?.test ? { Test: 'npm test' } : {}),
        ...(packageJson.scripts?.build ? { Build: 'npm run build' } : {}),
      },
      referenceDocs,
      sourceLayers,
      supportingSurfaces,
    };
  }
}

export default Step1_5CopilotInstructionsValidator;
