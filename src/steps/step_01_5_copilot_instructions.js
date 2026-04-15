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

function sortNatural(values) {
  return [...values].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function stripExtension(filePath) {
  return filePath.replace(/\.[^.]+$/, '');
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
  const packageScripts = Object.entries(facts.packageScripts ?? {})
    .map(([name, command]) => `  - \`${name}\`: \`${command}\``)
    .join('\n');

  const lines = [
    '## Authoritative Repo Facts',
    '',
    '### Package Metadata',
    `- Package name: \`${facts.packageName || 'unknown'}\``,
    `- Package version: \`${facts.packageVersion || 'unknown'}\``,
    `- Package description: ${facts.packageDescription || 'Unavailable'}`,
    '',
    '### Workflow Step Inventory',
    `- Step file count: ${facts.stepIds.length}`,
    `- Step ids: ${facts.stepIds.length > 0 ? facts.stepIds.map((stepId) => `\`${stepId}\``).join(', ') : 'Unavailable'}`,
    '',
    '### CLI Commands',
    `- Command count: ${facts.cliCommands.length}`,
    `- Commands: ${facts.cliCommands.length > 0 ? facts.cliCommands.map((command) => `\`${command}\``).join(', ') : 'Unavailable'}`,
    '',
    '### GitHub Actions Workflows',
    `- Workflow file count: ${facts.workflowFiles.length}`,
    `- Workflow files: ${facts.workflowFiles.length > 0 ? facts.workflowFiles.map((workflow) => `\`${workflow}\``).join(', ') : 'Unavailable'}`,
    '',
    '### Source Module Counts',
    `- \`src/core\`: ${facts.moduleCounts.core}`,
    `- \`src/utils\`: ${facts.moduleCounts.utils}`,
    `- \`src/lib\`: ${facts.moduleCounts.lib}`,
    `- \`src/orchestrator\`: ${facts.moduleCounts.orchestrator}`,
    `- \`src/cli\`: ${facts.moduleCounts.cli}`,
    '',
    '### Documentation Inventory',
    `- Root docs present: ${facts.rootDocs.length > 0 ? facts.rootDocs.map((doc) => `\`${doc}\``).join(', ') : 'Unavailable'}`,
    `- \`docs/\` markdown file count: ${facts.docsMarkdownCount}`,
    '',
    '### npm Scripts',
    packageScripts || '  - Unavailable',
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
      options.parsedAiHelpers || this.parsedAiHelpers || (await loadResolvedAiHelpers(this.fileOps));
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
      `- **Step files counted**: ${facts.stepIds.length}`,
      `- **Workflow files counted**: ${facts.workflowFiles.length}`,
      `- **CLI commands counted**: ${facts.cliCommands.length}`,
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
    const [
      packageJsonRaw,
      workflowFilesYml,
      workflowFilesYaml,
      stepFiles,
      cliCommandFiles,
      docsFiles,
      coreFiles,
      utilsFiles,
      libFiles,
      orchestratorFiles,
      cliFiles,
    ] = await Promise.all([
      this.fileOps.readFile(path.join(projectRoot, 'package.json')),
      this.fileOps.glob('.github/workflows/*.yml', { cwd: projectRoot }),
      this.fileOps.glob('.github/workflows/*.yaml', { cwd: projectRoot }),
      this.fileOps.glob('src/steps/step_*.js', { cwd: projectRoot }),
      this.fileOps.glob('src/cli/commands/*.js', { cwd: projectRoot }),
      this.fileOps.glob('docs/**/*.md', { cwd: projectRoot }).catch(() => []),
      this.fileOps.glob('src/core/*.js', { cwd: projectRoot }),
      this.fileOps.glob('src/utils/*.js', { cwd: projectRoot }),
      this.fileOps.glob('src/lib/*.js', { cwd: projectRoot }),
      this.fileOps.glob('src/orchestrator/*.js', { cwd: projectRoot }),
      this.fileOps.glob('src/cli/**/*.js', { cwd: projectRoot }),
    ]);

    const packageJson = JSON.parse(packageJsonRaw);
    const rootDocs = [];
    for (const docName of ['README.md', 'CHANGELOG.md', 'ROADMAP.md', 'CONTRIBUTING.md', 'CODE_OF_CONDUCT.md']) {
      if (await this.fileOps.exists(path.join(projectRoot, docName))) {
        rootDocs.push(docName);
      }
    }

    return {
      packageName: packageJson.name || '',
      packageVersion: packageJson.version || '',
      packageDescription: packageJson.description || '',
      packageScripts: packageJson.scripts || {},
      workflowFiles: sortNatural([...workflowFilesYml, ...workflowFilesYaml]),
      stepIds: sortNatural(stepFiles.map((filePath) => stripExtension(path.basename(filePath)))),
      cliCommands: sortNatural(cliCommandFiles.map((filePath) => stripExtension(path.basename(filePath)))),
      moduleCounts: {
        core: coreFiles.length,
        utils: utilsFiles.length,
        lib: libFiles.length,
        orchestrator: orchestratorFiles.length,
        cli: cliFiles.length,
      },
      docsMarkdownCount: docsFiles.length,
      rootDocs: sortNatural(rootDocs),
    };
  }
}

export default Step1_5CopilotInstructionsValidator;
