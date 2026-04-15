import { jest } from '@jest/globals';
import {
  Step1_5CopilotInstructionsValidator,
  buildCopilotInstructionsRepoFactsContext,
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
        'Here is the corrected file:',
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

  describe('buildCopilotInstructionsRepoFactsContext', () => {
    test('formats deterministic repo facts for prompt injection', () => {
      const facts = {
        packageName: 'ai-workflow',
        packageVersion: '2.2.7',
        packageDescription: 'Workflow automation',
        packageScripts: { test: 'npm test', lint: 'npm run lint' },
        workflowFiles: ['.github/workflows/ci.yml'],
        stepIds: ['step_00_analyze', 'step_01_documentation'],
        cliCommands: ['run', 'status'],
        moduleCounts: { core: 5, utils: 2, lib: 10, orchestrator: 6, cli: 7 },
        docsMarkdownCount: 42,
        rootDocs: ['README.md', 'CHANGELOG.md'],
      };

      const context = buildCopilotInstructionsRepoFactsContext(facts);
      expect(context).toContain('Package version: `2.2.7`');
      expect(context).toContain('Step file count: 2');
      expect(context).toContain('`run`');
      expect(context).toContain('`src/lib`');
      expect(context).toContain('`README.md`');
    });
  });

  describe('execute', () => {
    test('writes corrected instructions when AI returns a replacement document', async () => {
      const readFile = jest.fn(async (filePath) => {
        if (filePath.endsWith('package.json')) {
          return JSON.stringify({
            name: 'ai-workflow',
            version: '2.2.7',
            description: 'Workflow automation',
            scripts: { test: 'npm test' },
          });
        }
        return '# GitHub Copilot Instructions: ai_workflow.js\n\nOld content.\n';
      });

      const fileOps = {
        exists: jest.fn(async () => true),
        readFile,
        writeFile: jest.fn(async () => {}),
        glob: jest.fn(async (pattern) => {
          if (pattern === 'src/steps/step_*.js') return ['src/steps/step_00_analyze.js'];
          if (pattern === 'src/cli/commands/*.js') return ['src/cli/commands/run.js'];
          if (pattern === '.github/workflows/*.yml') return ['.github/workflows/ci.yml'];
          return [];
        }),
      };
      const aiHelper = {
        initialize: jest.fn(async () => true),
        executeRequest: jest.fn(async () => ({
          content:
            '```markdown\n# GitHub Copilot Instructions: ai_workflow.js\n\nNew content.\n```',
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
      expect(fileOps.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.github/copilot-instructions.md'),
        '# GitHub Copilot Instructions: ai_workflow.js\n\nNew content.\n'
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
  });
});
