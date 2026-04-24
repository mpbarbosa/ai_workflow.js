import fs from 'fs/promises';
import { jest } from '@jest/globals';
import os from 'os';
import path from 'path';
import {
  Step1_5CopilotInstructionsValidator,
  buildCopilotInstructionsRepoFactsContext,
  collectPackageEntryPoints,
  detectSourceLayers,
  extractCopilotInstructionsFindings,
  ensureTrailingNewline,
  extractCorrectedCopilotInstructions,
} from '../../src/steps/step_01_5_copilot_instructions.js';

describe('Step 1.5: GitHub Copilot Instructions Validation', () => {
  describe('ensureTrailingNewline', () => {
    test('adds a trailing newline when missing', () => {
      expect(ensureTrailingNewline('abc')).toBe('abc\n');
    });

    test('preserves an existing trailing newline', () => {
      expect(ensureTrailingNewline('abc\n')).toBe('abc\n');
    });
  });

  describe('extractCorrectedCopilotInstructions', () => {
    test('extracts markdown from fenced response blocks', () => {
      const response = [
        '## Findings',
        '',
        '### Finding 1 - Broad handbook content',
        '- **Classification**: duplicate reference',
        '- **Action**: condense',
        '',
        '## Corrected File',
        '```markdown',
        '# GitHub Copilot Instructions: ai_workflow.js',
        '',
        'Updated content.',
        '```',
      ].join('\n');

      expect(extractCorrectedCopilotInstructions(response)).toBe(
        '# GitHub Copilot Instructions: ai_workflow.js\n\nUpdated content.\n'
      );
    });

    test('returns empty string when no corrected document is present', () => {
      expect(extractCorrectedCopilotInstructions('No changes needed.')).toBe('');
    });
  });

  describe('extractCopilotInstructionsFindings', () => {
    test('extracts structured findings ahead of the corrected file block', () => {
      const response = [
        '## Findings',
        '',
        '### Finding 1 - Unsupported implementation detail',
        '- **Classification**: unsupported claim',
        '- **Action**: remove',
        '',
        '## Corrected File',
        '```markdown',
        '# GitHub Copilot Instructions: ai_workflow.js',
        '```',
      ].join('\n');

      expect(extractCopilotInstructionsFindings(response)).toBe(
        '## Findings\n\n### Finding 1 - Unsupported implementation detail\n- **Classification**: unsupported claim\n- **Action**: remove\n'
      );
    });
  });

  describe('buildCopilotInstructionsRepoFactsContext', () => {
    test('formats deterministic repo facts for prompt injection', () => {
      const facts = {
        packageName: 'ai-workflow',
        packageVersion: '2.2.14',
        packageDescription: 'Workflow automation',
        validationCommands: {
          Lint: 'npm run lint',
          Test: 'npm test',
          Build: 'npm run build',
        },
        sourceLayers: [
          { path: 'src/lib/', purpose: 'Reusable workflow domain logic' },
          { path: 'src/steps/', purpose: 'Executable workflow-step implementations' },
        ],
        supportingSurfaces: [
          { path: '.workflow_core/', purpose: 'Shared workflow templates and helper assets' },
        ],
        referenceDocSignals: [
          'README.md: # ai-workflow Workflow automation toolkit',
          'docs/ARCHITECTURE.md: # Architecture Layered runtime overview',
        ],
        referenceDocs: ['README.md', 'docs/ARCHITECTURE.md'],
        packageExports: ['main -> dist/index.js', 'exports ./core -> ./src/core/index.js'],
      };

      const context = buildCopilotInstructionsRepoFactsContext(facts);
      expect(context).toContain('package.json present: yes');
      expect(context).toContain('Package version: `2.2.14`');
      expect(context).toContain('Prefer links to authoritative docs over duplicated inventories');
      expect(context).toContain('- Lint: `npm run lint`');
      expect(context).toContain('`src/lib/`');
      expect(context).toContain('`.workflow_core/`');
      expect(context).toContain('`README.md`');
      expect(context).toContain('`main -> dist/index.js`');
      expect(context).not.toContain('### Reference Doc Signals');
      expect(context).not.toContain('README.md: # ai-workflow Workflow automation toolkit');
      expect(context).not.toContain('Step file count');
    });
  });

  describe('collectPackageEntryPoints', () => {
    test('includes main/types/exports/bin entry points when present', () => {
      const entryPoints = collectPackageEntryPoints({
        main: 'dist/index.js',
        types: 'dist/index.d.ts',
        exports: {
          '.': './dist/index.js',
          './core': {
            import: './dist/core/index.js',
          },
        },
        bin: {
          'ai-workflow': 'bin/ai-workflow.js',
        },
      });

      expect(entryPoints).toEqual(
        expect.arrayContaining([
          'main -> dist/index.js',
          'types -> dist/index.d.ts',
          'exports . -> ./dist/index.js',
          'exports ./core -> import: ./dist/core/index.js',
          'bin ai-workflow -> bin/ai-workflow.js',
        ])
      );
    });
  });

  describe('detectSourceLayers', () => {
    test('falls back to src/ when repository has source files but no known layer folders', async () => {
      const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'copilot-source-layers-'));

      try {
        await fs.mkdir(path.join(tempRoot, 'src'), { recursive: true });
        await fs.writeFile(path.join(tempRoot, 'src', 'index.ts'), 'export {};\n');

        const fileOps = {
          exists: jest.fn(async (targetPath) => {
            try {
              await fs.access(targetPath);
              return true;
            } catch {
              return false;
            }
          }),
        };

        await expect(detectSourceLayers(tempRoot, fileOps)).resolves.toEqual([
          {
            path: 'src/',
            purpose: 'Primary source modules and public API',
          },
        ]);
      } finally {
        await fs.rm(tempRoot, { recursive: true, force: true });
      }
    });
  });

  describe('execute', () => {
    test('writes corrected instructions when AI returns a replacement document', async () => {
      const readFile = jest.fn(async (filePath) => {
        if (filePath.endsWith('package.json')) {
          return JSON.stringify({
            name: 'ai-workflow',
            version: '2.2.14',
            description: 'Workflow automation',
            main: 'dist/index.js',
            types: 'dist/index.d.ts',
            scripts: { test: 'npm test' },
          });
        }
        return '# GitHub Copilot Instructions: ai_workflow.js\n\nOld content.\n';
      });

      const fileOps = {
        exists: jest.fn(async () => true),
        readFile,
        writeFile: jest.fn(async () => {}),
      };
      const aiHelper = {
        initialize: jest.fn(async () => true),
        executeRequest: jest.fn(async () => ({
          content: [
            '## Findings',
            '',
            '### Finding 1 - Overly broad guidance',
            '- **Classification**: stale detail',
            '- **Current file evidence**: Legacy implementation section',
            '- **Repo-fact evidence**: Repo facts only support high-signal guidance',
            '- **Action**: rewrite',
            '- **Why this matters**: The file should explain the concrete issue instead of implying it through the rewrite alone.',
            '',
            '## Corrected File',
            '```markdown',
            '# GitHub Copilot Instructions: ai_workflow.js',
            '',
            'New content.',
            '```',
          ].join('\n'),
        })),
      };
      const aiCache = {
        withFileChangeGuard: jest.fn(async (_key, _inputs, fn) => fn()),
      };
      const backlog = {
        saveStepSummary: jest.fn(async () => {}),
      };

      const step = new Step1_5CopilotInstructionsValidator({
        fileOps,
        aiHelper,
        aiCache,
        backlog,
        parsedAiHelpers: {
          step1_5_copilot_instructions_prompt: {
            role_prefix: 'You are a technical documentation specialist.',
            task_template:
              'Audit {copilot_instructions_path}\n\nFacts:\n{repo_facts}\n\nCurrent:\n{copilot_instructions_content}',
            approach: 'Return ONLY one fenced ```markdown block.',
          },
        },
      });

      const result = await step.execute('/repo');
      expect(result.success).toBe(true);
      expect(result.updated).toBe(true);
      expect(result.findings).toContain('### Finding 1 - Overly broad guidance');
      expect(result.facts.packageExports).toEqual(
        expect.arrayContaining(['main -> dist/index.js', 'types -> dist/index.d.ts'])
      );
      expect(result.facts.sourceLayers).toEqual(
        expect.arrayContaining([
          {
            path: 'src/lib/',
            purpose: 'Reusable workflow domain logic',
          },
        ])
      );
      expect(fileOps.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.github/copilot-instructions.md'),
        '# GitHub Copilot Instructions: ai_workflow.js\n\nNew content.\n'
      );
      expect(backlog.saveStepSummary).toHaveBeenCalledWith(
        '01_5',
        'Copilot_Instructions_Validation',
        expect.stringContaining('### Findings'),
        '🤖'
      );
      expect(backlog.saveStepSummary).toHaveBeenCalledWith(
        '01_5',
        'Copilot_Instructions_Validation',
        expect.stringContaining('### Finding 1 - Overly broad guidance'),
        '🤖'
      );
      expect(aiHelper.initialize).toHaveBeenCalled();
    });

    test('skips cleanly when AI helper is unavailable', async () => {
      const fileOps = {
        exists: jest.fn(async () => true),
        readFile: jest.fn(async () => '# GitHub Copilot Instructions: ai_workflow.js\n'),
        writeFile: jest.fn(async () => {}),
        glob: jest.fn(async () => []),
      };
      const aiHelper = {
        initialize: jest.fn(async () => false),
        executeRequest: jest.fn(async () => ({
          content: '',
        })),
      };
      const backlog = {
        saveStepSummary: jest.fn(async () => {}),
      };

      const step = new Step1_5CopilotInstructionsValidator({
        fileOps,
        aiHelper,
        backlog,
      });

      const result = await step.execute('/repo');

      expect(result).toEqual({
        success: true,
        skipped: true,
        reason: 'ai_unavailable',
        file: '.github/copilot-instructions.md',
      });
      expect(aiHelper.initialize).toHaveBeenCalled();
      expect(aiHelper.executeRequest).not.toHaveBeenCalled();
      expect(fileOps.readFile).not.toHaveBeenCalled();
      expect(backlog.saveStepSummary).toHaveBeenCalledWith(
        '01_5',
        'Copilot_Instructions_Validation',
        expect.stringContaining('AI helper unavailable'),
        '⚠️'
      );
    });

    test('handles documentation-only repositories without package.json', async () => {
      const readFile = jest.fn(async (filePath) => {
        if (filePath.endsWith('.github/copilot-instructions.md')) {
          return '# GitHub Copilot Instructions: ai_workflow_fspec\n\nOld content.\n';
        }
        if (filePath.endsWith('/README.md')) {
          return '# ai_workflow_fspec\nAI Workflow Programming Language Independent Functional Specification\n';
        }
        if (filePath.endsWith('/INDEX.md')) {
          return '## INDEX\n\n# ai_workflow_fspec — Document Index\n';
        }
        if (filePath.endsWith('/ROADMAP.md')) {
          return '# Roadmap: Progress Quality-Evaluation Prompts\n\n## Problem Statement\n';
        }
        throw new Error(`Unexpected read for ${filePath}`);
      });
      const fileOps = {
        exists: jest.fn(async (targetPath) => {
          const normalizedPath = targetPath.replace(/\\/g, '/');
          return (
            normalizedPath.endsWith('/.github/copilot-instructions.md') ||
            normalizedPath.endsWith('/README.md') ||
            normalizedPath.endsWith('/INDEX.md') ||
            normalizedPath.endsWith('/ROADMAP.md') ||
            normalizedPath.endsWith('/docs')
          );
        }),
        readFile,
        writeFile: jest.fn(async () => {}),
      };
      const aiHelper = {
        initialize: jest.fn(async () => true),
        executeRequest: jest.fn(async () => ({
          content: [
            '## Findings',
            '',
            '### Finding 1 - Narrow package guidance',
            '- **Classification**: unsupported assumption',
            '- **Action**: remove package-specific wording',
            '',
            '## Corrected File',
            '```markdown',
            '# GitHub Copilot Instructions: ai_workflow_fspec',
            '',
            'Documentation-focused guidance.',
            '```',
          ].join('\n'),
        })),
      };
      const aiCache = {
        withFileChangeGuard: jest.fn(async (_key, _inputs, fn) => fn()),
      };
      const backlog = {
        saveStepSummary: jest.fn(async () => {}),
      };

      const step = new Step1_5CopilotInstructionsValidator({
        fileOps,
        aiHelper,
        aiCache,
        backlog,
        parsedAiHelpers: {
          step1_5_copilot_instructions_prompt: {
            role_prefix: 'You are a technical documentation specialist.',
            task_template:
              'Audit {copilot_instructions_path}\n\nFacts:\n{repo_facts}\n\nCurrent:\n{copilot_instructions_content}',
            approach: 'Return ONLY one fenced ```markdown block.',
          },
        },
      });

      const result = await step.execute('/repo');

      expect(result.success).toBe(true);
      expect(result.updated).toBe(true);
      expect(result.facts.packageManifestPresent).toBe(false);
      expect(result.facts.validationCommands).toEqual({});
      expect(result.facts.packageExports).toEqual([]);
      expect(result.facts.referenceDocs).toEqual(['INDEX.md', 'README.md', 'ROADMAP.md']);
      expect(result.facts.referenceDocSignals).toEqual([
        'INDEX.md: ## INDEX # ai_workflow_fspec — Document Index',
        'README.md: # ai_workflow_fspec AI Workflow Programming Language Independent Functional Specification',
        'ROADMAP.md: # Roadmap: Progress Quality-Evaluation Prompts ## Problem Statement',
      ]);
      expect(readFile).not.toHaveBeenCalledWith('/repo/package.json');
      expect(aiHelper.executeRequest).toHaveBeenCalledWith(
        expect.stringContaining('package.json present: no'),
        expect.any(Object)
      );
      expect(aiHelper.executeRequest).not.toHaveBeenCalledWith(
        expect.stringContaining('### Reference Doc Signals'),
        expect.any(Object)
      );
      expect(fileOps.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.github/copilot-instructions.md'),
        '# GitHub Copilot Instructions: ai_workflow_fspec\n\nDocumentation-focused guidance.\n'
      );
    });
  });
});
