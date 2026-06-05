import fs from 'fs/promises';
import { jest } from '@jest/globals';
import os from 'os';
import path from 'path';
import {
  Step1_5CopilotInstructionsValidator,
  annotateEntryPointsExistence,
  buildCopilotInstructionsRepoFactsContext,
  collectSourceEntrySignals,
  collectPackageEntryPoints,
  detectSourceLayers,
  extractCopilotInstructionsFindings,
  ensureTrailingNewline,
  extractCorrectedCopilotInstructions,
  validateCopilotInstructionsFindings,
  validateCopilotInstructionsRewriteConsistency,
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

  describe('validateCopilotInstructionsFindings', () => {
    test('accepts findings that match the supported schema and surfaced repo facts', () => {
      const repoFacts = buildCopilotInstructionsRepoFactsContext({
        packageName: 'ai-workflow',
        packageVersion: '2.6.0',
        packageDescription: 'Workflow automation',
        validationCommands: {
          Lint: 'npm run lint',
          Test: 'npm test',
          Build: 'npm run build',
        },
        sourceLayers: [{ path: 'src/lib/', purpose: 'Reusable workflow domain logic' }],
        supportingSurfaces: [],
        referenceDocs: ['README.md'],
        packageExports: ['main -> src/index.js'],
        sourceEntrySignals: ['src/index.js: Main CLI bootstrap entry point'],
      });

      const findings = [
        '## Findings',
        '',
        '### Finding 1 - Validation Commands',
        '- **Classification**: supported guidance',
        '- **Current file evidence**: Lines 45-52 keep the standard validation commands.',
        '- **Repo-fact evidence**: "Validation Commands"',
        '- **Action**: keep',
        '- **Why this matters**: The file should preserve the standard validation entry points.',
      ].join('\n');

      expect(validateCopilotInstructionsFindings(findings, repoFacts)).toEqual({
        valid: true,
        issues: [],
        findings: `${findings}\n`,
      });
    });

    test('accepts wrapped finding bullets without swallowing the following field', () => {
      const repoFacts = buildCopilotInstructionsRepoFactsContext({
        packageName: 'guia_js',
        packageVersion: '0.28.3-alpha',
        packageDescription: 'Tourist guide web application built on top of guia.js library',
        validationCommands: {},
        sourceLayers: [
          { path: 'src/core/', purpose: 'Foundational runtime helpers' },
          { path: 'src/utils/', purpose: 'Shared low-level utilities' },
        ],
        supportingSurfaces: [
          { path: '.workflow-config.yaml', purpose: 'Project-local workflow configuration' },
          { path: '.ai_workflow/', purpose: 'Runtime artifacts, cache, and checkpoints' },
        ],
        referenceDocs: ['README.md', 'docs/ARCHITECTURE.md'],
        packageExports: ['main -> src/app.js (editable source sibling: src/app.ts)'],
        sourceEntrySignals: [
          'src/main.ts: Vue 3 application entry point',
          'src/app.ts: Main package entry source',
        ],
      });

      const findings = [
        '## Findings',
        '',
        '### Finding 1 - Supporting Workflow Surfaces',
        '- **Classification**: supported guidance',
        '- **Current file evidence**:',
        '  - "`src/core/` – Foundational runtime helpers"',
        '  - "`src/utils/` – Shared low-level utilities"',
        '- **Repo-fact evidence**:',
        '  - "src/core/"',
        '  - "src/utils/"',
        '- **Action**: keep',
        '- **Why this matters**: Stable source boundaries should stay explicit.',
      ].join('\n');

      expect(validateCopilotInstructionsFindings(findings, repoFacts)).toEqual({
        valid: true,
        issues: [],
        findings: `${findings}\n`,
      });
    });

    test('rejects malformed historical findings that cite unsupported repo facts or schema values', () => {
      const repoFacts = buildCopilotInstructionsRepoFactsContext({
        packageName: 'ai-workflow',
        packageVersion: '2.2.15',
        packageDescription: 'Workflow automation',
        validationCommands: {
          Lint: 'npm run lint',
          Test: 'npm test',
          Build: 'npm run build',
        },
        sourceLayers: [{ path: 'src/lib/', purpose: 'Reusable workflow domain logic' }],
        supportingSurfaces: [
          { path: '.ai_workflow/', purpose: 'Runtime artifacts, cache, and checkpoints' },
        ],
        referenceDocs: ['README.md', 'docs/ARCHITECTURE.md'],
        packageExports: ['main -> src/index.js'],
      });

      const findings = [
        '## Findings',
        '',
        '### Finding 3 - Design Principles',
        '- **Classification**: supported guidance',
        '- **Current file evidence**: Lines 29-34: "Prefer pure functions... Reuse helpers and respect module boundaries..."',
        '- **Repo-fact evidence**: "Design Principles" (implied by repo facts and current file)',
        '- **Action**: keep',
        '- **Why this matters**: Guides Copilot to produce maintainable, idiomatic code.',
        '',
        '### Finding 7 - Redundant or Duplicative Content',
        '- **Classification**: duplicate reference',
        '- **Current file evidence**: Lines 63-65: "> Do not duplicate implementation status..."',
        '- **Repo-fact evidence**: "Do NOT duplicate implementation status, inventories, installation, or migration details-link to the above docs instead."',
        '- **Action**: keep (as a final reminder)',
        '- **Why this matters**: Reinforces the file purpose.',
        '',
        '### Finding 8 - Absence of Unsupported or Stale Claims',
        '- **Classification**: no issue',
        '- **Current file evidence**: No unsupported numeric claims present.',
        '- **Repo-fact evidence**: All claims in the file are either supported or omitted.',
        '- **Action**: no action',
        '- **Why this matters**: Confirms the file is already free of unsupported content.',
      ].join('\n');

      const result = validateCopilotInstructionsFindings(findings, repoFacts);

      expect(result.valid).toBe(false);
      expect(result.issues).toEqual(
        expect.arrayContaining([
          '### Finding 3 - Design Principles: Repo-fact evidence cites unsupported snippet "Design Principles".',
          '### Finding 7 - Redundant or Duplicative Content uses unsupported action "keep (as a final reminder)".',
          '### Finding 7 - Redundant or Duplicative Content: Repo-fact evidence cites unsupported snippet "Do NOT duplicate implementation status, inventories, installation, or migration details-link to the above docs instead.".',
          '### Finding 8 - Absence of Unsupported or Stale Claims is a meta or absent-topic finding; reserve that pattern for the single no-issue finding or a concretely required omission.',
          '### Finding 8 - Absence of Unsupported or Stale Claims uses unsupported classification "no issue".',
          '### Finding 8 - Absence of Unsupported or Stale Claims uses unsupported action "no action".',
        ])
      );
      expect(result.findings).toContain('Structured findings could not be trusted.');
    });

    test('rejects `supported guidance` when repo-fact evidence starts with `not available` followed by a parenthetical', () => {
      const repoFacts = buildCopilotInstructionsRepoFactsContext({
        packageName: 'ai-workflow',
        packageVersion: '2.6.0',
        packageDescription: 'Workflow automation',
        validationCommands: {},
        sourceLayers: [],
        supportingSurfaces: [],
        referenceDocs: [],
        packageExports: [],
        sourceEntrySignals: [],
      });

      const findings = [
        '## Findings',
        '',
        '### Finding 1 - Design Principles',
        '- **Classification**: supported guidance',
        '- **Current file evidence**: "Follow established design principles and module boundaries."',
        '- **Repo-fact evidence**: not available (but aligns with durable best practices and is not contradicted)',
        '- **Action**: keep',
        '- **Why this matters**: Generic guidance.',
      ].join('\n');

      const result = validateCopilotInstructionsFindings(findings, repoFacts);
      expect(result.valid).toBe(false);
      expect(result.issues).toContain(
        '### Finding 1 - Design Principles: `supported guidance` findings must cite explicit surfaced repo-fact support, not `not available`.'
      );
    });

    test('rejects supported guidance that relies only on a broad repo-fact heading', () => {
      const repoFacts = buildCopilotInstructionsRepoFactsContext({
        packageName: 'guia_js',
        packageVersion: '0.24.8-alpha',
        packageDescription: 'Tourist guide web application built on top of guia.js library',
        validationCommands: {},
        sourceLayers: [],
        supportingSurfaces: [],
        referenceDocs: ['README.md'],
        packageExports: ['main -> src/app.js (editable source sibling: src/app.ts)'],
        sourceEntrySignals: [
          'src/app.ts: Main Application Entry Point',
          'src/main.ts: Vue 3 application entry point',
        ],
      });

      const findings = [
        '## Findings',
        '',
        '### Finding 1 - Architecture and Source Boundaries',
        '- **Classification**: supported guidance',
        '- **Current file evidence**: "- `src/app.ts` – Editable SPA entry and router orchestration source"',
        '- **Repo-fact evidence**: "Source Entry Signals"',
        '- **Action**: keep',
        '- **Why this matters**: Entrypoint guidance should remain precise.',
      ].join('\n');

      const result = validateCopilotInstructionsFindings(findings, repoFacts);
      expect(result.valid).toBe(false);
      expect(result.issues).toContain(
        '### Finding 1 - Architecture and Source Boundaries: `supported guidance` findings must cite an exact surfaced snippet when relying on Source Entry Signals.'
      );
    });

    test('rejects supported guidance that retains repo-specific details absent from surfaced repo facts', () => {
      const repoFacts = buildCopilotInstructionsRepoFactsContext({
        packageName: 'guia_js',
        packageVersion: '0.28.3-alpha',
        packageDescription: 'Tourist guide web application built on top of guia.js library',
        validationCommands: {},
        sourceLayers: [],
        supportingSurfaces: [],
        auxiliaryNormativeFiles: [
          { path: '.markdownlint.yaml', purpose: 'Markdown formatting rules source of truth' },
        ],
        referenceDocs: ['README.md', 'docs/ARCHITECTURE.md', 'CHANGELOG.md'],
        packageExports: [],
        sourceEntrySignals: [],
      });

      const findings = [
        '## Findings',
        '',
        '### Finding 1 - Documentation and Change Coordination',
        '- **Classification**: supported guidance',
        '- **Current file evidence**:',
        '  - "- Sync user-facing changes with `README.md` and other reference docs."',
        '  - "- Update `docs/ARCHITECTURE.md` and the linked `docs/architecture/` reference docs for architecture or layout changes."',
        '  - "- For markdown formatting rules, use `.markdownlint.yaml` as the source of truth."',
        '- **Repo-fact evidence**:',
        '  - "Authoritative Reference Docs"',
        '  - "`README.md`"',
        '  - "`docs/ARCHITECTURE.md`"',
        '  - "`CHANGELOG.md`"',
        '- **Action**: keep',
        '- **Why this matters**: Documentation guidance should stay aligned with the repo facts.',
      ].join('\n');

      const result = validateCopilotInstructionsFindings(findings, repoFacts);
      expect(result.valid).toBe(false);
      expect(result.issues).toContain(
        '### Finding 1 - Documentation and Change Coordination: `supported guidance` findings cannot retain unsupported repo-specific details from current-file evidence (`docs/architecture/`); split or downgrade the unsupported claim.'
      );
    });

    test('accepts normalized repo-fact snippets when markdown formatting differs', () => {
      const repoFacts = buildCopilotInstructionsRepoFactsContext({
        packageName: 'guia_js',
        packageVersion: '0.28.8-alpha',
        packageDescription: 'Tourist guide web application built on top of guia.js library',
        validationCommands: {},
        sourceLayers: [{ path: 'src/core/', purpose: 'Foundational runtime helpers' }],
        supportingSurfaces: [],
        referenceDocs: [],
        packageExports: [],
        sourceEntrySignals: [],
      });

      const findings = [
        '## Findings',
        '',
        '### Finding 1 - Stable Source Layers',
        '- **Classification**: supported guidance',
        '- **Current file evidence**: "- `src/core/` – Foundational runtime helpers"',
        '- **Repo-fact evidence**: "src/core/ - Foundational runtime helpers"',
        '- **Action**: keep',
        '- **Why this matters**: Stable source-layer guidance should not be dropped because of markdown-only formatting differences.',
      ].join('\n');

      const result = validateCopilotInstructionsFindings(findings, repoFacts);
      expect(result.valid).toBe(true);
      expect(result.issues).toEqual([]);
    });

    test('rejects keep findings that only describe the absence of a problem', () => {
      const repoFacts = buildCopilotInstructionsRepoFactsContext({
        packageName: 'guia_js',
        packageVersion: '0.24.8-alpha',
        packageDescription: 'Tourist guide web application built on top of guia.js library',
        validationCommands: {},
        sourceLayers: [],
        supportingSurfaces: [],
        referenceDocs: [],
        packageExports: [],
        sourceEntrySignals: [],
      });

      const findings = [
        '## Findings',
        '',
        '### Finding 1 - Unsupported implementation detail',
        '- **Classification**: unsupported claim',
        '- **Current file evidence**: "- `src/app.js` – Main package entry point"',
        '- **Repo-fact evidence**: not available',
        '- **Action**: rewrite',
        '- **Why this matters**: Unsupported file claims should not remain in the corrected file.',
        '',
        '### Finding 2 - Overly Broad or Duplicated Content',
        '- **Classification**: duplicate reference',
        '- **Current file evidence**: The file does not include implementation status, inventories, or command lists beyond what is supported.',
        '- **Repo-fact evidence**: "Copilot File Purpose"',
        '- **Action**: keep',
        '- **Why this matters**: The file already avoids duplicated content.',
      ].join('\n');

      const result = validateCopilotInstructionsFindings(findings, repoFacts);
      expect(result.valid).toBe(false);
      expect(result.issues).toContain(
        '### Finding 2 - Overly Broad or Duplicated Content is a meta or absent-topic finding; findings should map to visible current-file claims, not to the absence of a problem.'
      );
    });
  });

  describe('validateCopilotInstructionsRewriteConsistency', () => {
    test('detects wrapped rewrite actions when the corrected file is unchanged', () => {
      const findings = [
        '## Findings',
        '',
        '### Finding 1 - Unsupported implementation detail',
        '- **Classification**: unsupported claim',
        '- **Current file evidence**:',
        '  - "`src/app.js` – Main package entry point"',
        '- **Repo-fact evidence**: not available',
        '- **Action**:',
        '  rewrite',
        '- **Why this matters**: Unsupported file claims should not remain in the corrected file.',
      ].join('\n');

      const result = validateCopilotInstructionsRewriteConsistency(
        findings,
        '# GitHub Copilot Instructions: guia_js\n\n- `src/app.js` – Main package entry point\n',
        '# GitHub Copilot Instructions: guia_js\n\n- `src/app.js` – Main package entry point\n'
      );

      expect(result.valid).toBe(false);
      expect(result.issues).toContain(
        '### Finding 1 - Unsupported implementation detail: The corrected file is unchanged, so action "rewrite" is inconsistent; either change the corrected file or keep the text with a finding that explains why it remains acceptable as-is.'
      );
    });
  });

  describe('buildCopilotInstructionsRepoFactsContext', () => {
    test('formats deterministic repo facts for prompt injection', () => {
      const facts = {
        packageName: 'ai-workflow',
        packageVersion: '2.6.0',
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
          'README.md: Workflow automation toolkit for GitHub Copilot-assisted development.',
          'CLAUDE.md: This repository uses a docs-first workflow model.',
        ],
        auxiliaryNormativeFiles: [
          { path: '.markdownlint.yaml', purpose: 'Markdown formatting rules source of truth' },
        ],
        referenceDocs: ['README.md', 'CLAUDE.md', 'docs/ARCHITECTURE.md'],
        packageExports: ['main -> dist/index.js', 'exports ./core -> ./src/core/index.js'],
        sourceEntrySignals: [
          'src/index.js: Main workflow entry point',
          'src/cli.js: Bootstraps the CLI',
        ],
      };

      const context = buildCopilotInstructionsRepoFactsContext(facts);
      expect(context).toContain('package.json present: yes');
      expect(context).toContain('Package version: `2.6.0`');
      expect(context).toContain('Prefer links to authoritative docs over duplicated inventories');
      expect(context).toContain('- Lint: `npm run lint`');
      expect(context).toContain('`src/lib/`');
      expect(context).toContain('`.workflow_core/`');
      expect(context).toContain('`README.md`');
      expect(context).toContain('`CLAUDE.md`');
      expect(context).toContain('### Reference Doc Signals');
      expect(context).toContain(
        'README.md: Workflow automation toolkit for GitHub Copilot-assisted development.'
      );
      expect(context).toContain('### Auxiliary Normative Files');
      expect(context).toContain('`.markdownlint.yaml`');
      expect(context).toContain('`main -> dist/index.js`');
      expect(context).toContain('### Source Entry Signals');
      expect(context).toContain('src/index.js: Main workflow entry point');
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

    test('includes the module field when present', () => {
      const entryPoints = collectPackageEntryPoints({
        main: 'dist/index.js',
        module: 'dist/esm/index.js',
        types: 'dist/index.d.ts',
      });

      expect(entryPoints).toEqual(
        expect.arrayContaining([
          'main -> dist/index.js',
          'module -> dist/esm/index.js',
          'types -> dist/index.d.ts',
        ])
      );
    });

    test('surfaces all export conditions from a conditional export object', () => {
      const entryPoints = collectPackageEntryPoints({
        main: 'dist/index.js',
        module: 'dist/esm/index.js',
        types: 'dist/index.d.ts',
        exports: {
          '.': {
            types: './dist/index.d.ts',
            require: './dist/index.js',
            import: './dist/esm/index.js',
            default: './dist/index.js',
          },
          './package.json': './package.json',
        },
      });

      expect(entryPoints).toEqual(
        expect.arrayContaining([
          'main -> dist/index.js',
          'module -> dist/esm/index.js',
          'types -> dist/index.d.ts',
          'exports . -> types: ./dist/index.d.ts, import: ./dist/esm/index.js, require: ./dist/index.js, default: ./dist/index.js',
          'exports ./package.json -> ./package.json',
        ])
      );
    });
  });

  describe('annotateEntryPointsExistence', () => {
    test('leaves entries unchanged when the target path exists in the source tree', async () => {
      const fileOps = { exists: jest.fn(async () => true) };
      const result = await annotateEntryPointsExistence(
        '/repo',
        ['main -> src/app.ts', 'types -> dist/index.d.ts'],
        fileOps
      );
      expect(result).toEqual(['main -> src/app.ts', 'types -> dist/index.d.ts']);
    });

    describe('collectSourceEntrySignals', () => {
      test('surfaces source-file evidence for editable siblings and conventional entry files', async () => {
        const files = new Map([
          [
            '/repo/src/app.ts',
            [
              '/**',
              ' * Main Application Entry Point',
              ' * SPA Router and Application Initialization',
              ' */',
            ].join('\n'),
          ],
          [
            '/repo/src/main.ts',
            [
              '/**',
              ' * main.ts — Vue 3 application entry point',
              ' * Creates the Vue app with vue-router and mounts it on #app.',
              ' */',
            ].join('\n'),
          ],
        ]);
        const fileOps = {
          exists: jest.fn(async (targetPath) => files.has(targetPath)),
          readFile: jest.fn(async (targetPath) => files.get(targetPath) || ''),
        };

        const result = await collectSourceEntrySignals(
          '/repo',
          {
            main: 'src/app.js',
          },
          fileOps
        );

        expect(result).toEqual([
          'src/app.ts: Main Application Entry Point',
          'src/main.ts: main.ts — Vue 3 application entry point',
        ]);
      });
    });

    test('annotates entries whose target path is absent from the source tree', async () => {
      const fileOps = {
        exists: jest.fn(async (p) => p.endsWith('src/app.ts')),
      };
      const result = await annotateEntryPointsExistence(
        '/repo',
        ['main -> src/app.js', 'types -> src/app.ts'],
        fileOps
      );
      expect(result).toEqual([
        'main -> src/app.js (editable source sibling: src/app.ts)',
        'types -> src/app.ts',
      ]);
    });

    test('skips existence check for conditional export descriptions', async () => {
      const fileOps = { exists: jest.fn(async () => false) };
      const result = await annotateEntryPointsExistence(
        '/repo',
        ['exports . -> import: ./dist/esm/index.js, require: ./dist/index.js'],
        fileOps
      );
      expect(result).toEqual([
        'exports . -> import: ./dist/esm/index.js, require: ./dist/index.js',
      ]);
      expect(fileOps.exists).not.toHaveBeenCalled();
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
            version: '2.6.0',
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
            '- **Repo-fact evidence**: "Copilot File Purpose"',
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
      expect(result.findingsValid).toBe(true);
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

    test('refuses writes for malformed findings while preserving the raw AI response in the summary', async () => {
      const readFile = jest.fn(async (filePath) => {
        if (filePath.endsWith('package.json')) {
          return JSON.stringify({
            name: 'ai-workflow',
            version: '2.2.15',
            description: 'Workflow automation',
            main: 'src/index.js',
            scripts: { lint: 'eslint .', test: 'npm test', build: 'tsc' },
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
            '### Finding 3 - Design Principles',
            '- **Classification**: supported guidance',
            '- **Current file evidence**: Lines 29-34: "Prefer pure functions... Reuse helpers and respect module boundaries..."',
            '- **Repo-fact evidence**: "Design Principles" (implied by repo facts and current file)',
            '- **Action**: keep',
            '- **Why this matters**: Guides Copilot to produce maintainable, idiomatic code.',
            '',
            '### Finding 8 - Absence of Unsupported or Stale Claims',
            '- **Classification**: no issue',
            '- **Current file evidence**: No unsupported numeric claims present.',
            '- **Repo-fact evidence**: All claims in the file are either supported or omitted.',
            '- **Action**: no action',
            '- **Why this matters**: Confirms the file is already free of unsupported content.',
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
      expect(result.updated).toBe(false);
      expect(result.findingsValid).toBe(false);
      expect(result.findingsValidationIssues).toEqual(
        expect.arrayContaining([
          '### Finding 3 - Design Principles: Repo-fact evidence cites unsupported snippet "Design Principles".',
          '### Finding 8 - Absence of Unsupported or Stale Claims uses unsupported classification "no issue".',
        ])
      );
      expect(result.findings).toContain('Structured findings could not be trusted.');
      expect(fileOps.writeFile).not.toHaveBeenCalled();
      expect(backlog.saveStepSummary).toHaveBeenCalledWith(
        '01_5',
        'Copilot_Instructions_Validation',
        expect.stringContaining('### Trusted Findings Status'),
        '🤖'
      );
      expect(backlog.saveStepSummary).toHaveBeenCalledWith(
        '01_5',
        'Copilot_Instructions_Validation',
        expect.stringContaining('### AI Response'),
        '🤖'
      );
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
            '- **Classification**: unsupported claim',
            '- **Current file evidence**: Package-oriented wording appears in the current file.',
            '- **Repo-fact evidence**: not available',
            '- **Action**: rewrite',
            '- **Why this matters**: Package-specific wording should not be retained without surfaced support.',
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
      expect(result.findingsValid).toBe(true);
      expect(result.facts.packageManifestPresent).toBe(false);
      expect(result.facts.validationCommands).toEqual({});
      expect(result.facts.packageExports).toEqual([]);
      expect(result.facts.referenceDocs).toEqual(['INDEX.md', 'README.md', 'ROADMAP.md']);
      expect(result.facts.referenceDocSignals).toEqual([
        'README.md: # ai_workflow_fspec AI Workflow Programming Language Independent Functional Specification',
      ]);
      expect(readFile).not.toHaveBeenCalledWith('/repo/package.json');
      expect(aiHelper.executeRequest).toHaveBeenCalledWith(
        expect.stringContaining('package.json present: no'),
        expect.any(Object)
      );
      expect(aiHelper.executeRequest).toHaveBeenCalledWith(
        expect.stringContaining('### Reference Doc Signals'),
        expect.any(Object)
      );
      expect(fileOps.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.github/copilot-instructions.md'),
        '# GitHub Copilot Instructions: ai_workflow_fspec\n\nDocumentation-focused guidance.\n'
      );
    });

    test('retries once without cache when the initial findings validation fails, and uses corrected output from the retry', async () => {
      const invalidResponse = [
        '## Findings',
        '',
        '### Finding 1 - Design Principles',
        '- **Classification**: supported guidance',
        '- **Current file evidence**: "Follow design principles."',
        '- **Repo-fact evidence**: not available (but makes sense)',
        '- **Action**: keep',
        '- **Why this matters**: Generic.',
        '',
        '## Corrected File',
        '```markdown',
        '# GitHub Copilot Instructions: ai_workflow.js',
        '',
        'Old content.',
        '```',
      ].join('\n');

      const validResponse = [
        '## Findings',
        '',
        '### Finding 1 - Design Principles',
        '- **Classification**: unsupported claim',
        '- **Current file evidence**: "Follow design principles."',
        '- **Repo-fact evidence**: not available',
        '- **Action**: remove',
        '- **Why this matters**: No surfaced repo fact supports this section.',
        '',
        '## Corrected File',
        '```markdown',
        '# GitHub Copilot Instructions: ai_workflow.js',
        '',
        'Corrected content.',
        '```',
      ].join('\n');

      const readFile = jest.fn(async (filePath) => {
        if (filePath.endsWith('package.json')) {
          return JSON.stringify({
            name: 'ai-workflow',
            version: '2.6.0',
            description: 'Workflow automation',
            main: 'dist/index.js',
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
      const executeRequest = jest
        .fn()
        .mockResolvedValueOnce({ content: invalidResponse })
        .mockResolvedValueOnce({ content: validResponse });
      const aiHelper = {
        initialize: jest.fn(async () => true),
        executeRequest,
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
            approach: 'Return findings and corrected file.',
          },
        },
      });

      const result = await step.execute('/repo');

      expect(executeRequest).toHaveBeenCalledTimes(2);
      expect(result.findingsValid).toBe(true);
      expect(result.findings).toContain('### Finding 1 - Design Principles');
      expect(result.findings).toContain('unsupported claim');
      expect(executeRequest.mock.calls[1][0]).toContain('## Response repair instructions');
      expect(executeRequest.mock.calls[1][0]).toContain(
        '`supported guidance` findings must cite explicit surfaced repo-fact support, not `not available`.'
      );
      expect(fileOps.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.github/copilot-instructions.md'),
        '# GitHub Copilot Instructions: ai_workflow.js\n\nCorrected content.\n'
      );
    });

    test('reports unchanged-file consistency violations when a finding promises a rewrite that never appears in the corrected file', async () => {
      const invalidResponse = [
        '## Findings',
        '',
        '### Finding 1 - Design Principles',
        '- **Classification**: supported guidance',
        '- **Current file evidence**: "Follow design principles."',
        '- **Repo-fact evidence**: "Design Principles"',
        '- **Action**: keep',
        '- **Why this matters**: Generic.',
        '',
        '### Finding 2 - Validation Commands',
        '- **Classification**: stale detail',
        '- **Current file evidence**: "Always run npm run ci before every change."',
        '- **Repo-fact evidence**: not available',
        '- **Action**: rewrite',
        '- **Why this matters**: Unsupported commands should be removed from the file.',
        '',
        '## Corrected File',
        '```markdown',
        '# GitHub Copilot Instructions: ai_workflow.js',
        '',
        'Old content.',
        '```',
      ].join('\n');

      const readFile = jest.fn(async (filePath) => {
        if (filePath.endsWith('package.json')) {
          return JSON.stringify({
            name: 'ai-workflow',
            version: '2.6.0',
            description: 'Workflow automation',
            main: 'dist/index.js',
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
      const executeRequest = jest
        .fn()
        .mockResolvedValueOnce({ content: invalidResponse })
        .mockResolvedValueOnce({ content: invalidResponse });
      const aiHelper = {
        initialize: jest.fn(async () => true),
        executeRequest,
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
            approach: 'Return findings and corrected file.',
          },
        },
      });

      const result = await step.execute('/repo');

      expect(result.findingsValid).toBe(false);
      expect(result.updated).toBe(false);
      expect(result.findingsValidationIssues).toEqual(
        expect.arrayContaining([
          '### Finding 1 - Design Principles: Repo-fact evidence cites unsupported snippet "Design Principles".',
          '### Finding 2 - Validation Commands: The corrected file is unchanged, so action "rewrite" is inconsistent; either change the corrected file or keep the text with a finding that explains why it remains acceptable as-is.',
        ])
      );
      expect(fileOps.writeFile).not.toHaveBeenCalled();
    });

    test('retries once when the corrected file is unchanged but the findings promise edits that never appear', async () => {
      const invalidResponse = [
        '## Findings',
        '',
        '### Finding 1 - Validation Commands',
        '- **Classification**: stale detail',
        '- **Current file evidence**: Lines 10-18 claim an unsupported command.',
        '- **Repo-fact evidence**: not available',
        '- **Action**: rewrite',
        '- **Why this matters**: Unsupported commands should be removed.',
        '',
        '### Finding 2 - Contributing guide',
        '- **Classification**: unsupported claim',
        '- **Current file evidence**: Lines 20-22 point to the wrong guide.',
        '- **Repo-fact evidence**: not available',
        '- **Action**: remove',
        '- **Why this matters**: Unsupported document pointers should be removed.',
        '',
        '## Corrected File',
        '```markdown',
        '# GitHub Copilot Instructions: ai_workflow.js',
        '',
        'Old content.',
        '```',
      ].join('\n');

      const validResponse = [
        '## Findings',
        '',
        '### Finding 1 - Validation Commands',
        '- **Classification**: supported guidance',
        '- **Current file evidence**: Lines 10-18 keep the documented validation commands.',
        '- **Repo-fact evidence**: "Validation Commands"',
        '- **Action**: keep',
        '- **Why this matters**: Retains the documented validation commands.',
        '',
        '### Finding 2 - Runtime entry guidance',
        '- **Classification**: supported guidance',
        '- **Current file evidence**: Lines 20-22 keep the concise repo-guidance framing.',
        '- **Repo-fact evidence**: "Copilot File Purpose"',
        '- **Action**: keep',
        '- **Why this matters**: The concise guidance framing already matches the surfaced Copilot-file purpose.',
        '',
        '## Corrected File',
        '```markdown',
        '# GitHub Copilot Instructions: ai_workflow.js',
        '',
        'Old content.',
        '```',
      ].join('\n');

      const readFile = jest.fn(async (filePath) => {
        if (filePath.endsWith('package.json')) {
          return JSON.stringify({
            name: 'ai-workflow',
            version: '2.6.0',
            description: 'Workflow automation',
            main: 'dist/index.js',
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
      const executeRequest = jest
        .fn()
        .mockResolvedValueOnce({ content: invalidResponse })
        .mockResolvedValueOnce({ content: validResponse });
      const aiHelper = {
        initialize: jest.fn(async () => true),
        executeRequest,
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
            approach: 'Return findings and corrected file.',
          },
        },
      });

      const result = await step.execute('/repo');

      expect(executeRequest).toHaveBeenCalledTimes(2);
      expect(result.findingsValid).toBe(true);
      expect(result.findings).toContain('### Finding 1 - Validation Commands');
      expect(result.findings).toContain('### Finding 2 - Runtime entry guidance');
      expect(result.updated).toBe(false);
      expect(result.findingsValidationIssues).toEqual([]);
      expect(fileOps.writeFile).not.toHaveBeenCalled();
    });

    test('collects nested contributing guidance alongside the root stub when both exist', async () => {
      const fileOps = {
        exists: jest.fn(async (targetPath) => {
          const normalized = targetPath.replace(/\\/g, '/');
          return (
            normalized.endsWith('/package.json') ||
            normalized.endsWith('/README.md') ||
            normalized.endsWith('/CONTRIBUTING.md') ||
            normalized.endsWith('/.github/CONTRIBUTING.md')
          );
        }),
        readFile: jest.fn(async (targetPath) => {
          const normalized = targetPath.replace(/\\/g, '/');
          if (normalized.endsWith('/package.json')) {
            return JSON.stringify({
              name: 'guia_js',
              version: '0.28.1-alpha',
              description: 'Tourist guide web application built on top of guia.js library',
              main: 'src/app.js',
            });
          }

          if (normalized.endsWith('/.github/CONTRIBUTING.md')) {
            return '# Contributing\nDetailed workflow guide.\n';
          }

          if (normalized.endsWith('/CONTRIBUTING.md')) {
            return '# Contributing\nSee `.github/CONTRIBUTING.md`.\n';
          }

          return '# Guia\n';
        }),
      };

      const step = new Step1_5CopilotInstructionsValidator({ fileOps });
      const facts = await step.collectRepoFacts('/repo');

      expect(facts.referenceDocs).toEqual(
        expect.arrayContaining(['.github/CONTRIBUTING.md', 'CONTRIBUTING.md', 'README.md'])
      );
      expect(facts.referenceDocSignals).toEqual(
        expect.arrayContaining([
          '.github/CONTRIBUTING.md: # Contributing Detailed workflow guide.',
          'CONTRIBUTING.md: # Contributing See `.github/CONTRIBUTING.md`.',
        ])
      );
    });

    test('surfaces directly cited auxiliary normative files only when they are present', async () => {
      const fileOps = {
        exists: jest.fn(async (targetPath) => {
          const normalized = targetPath.replace(/\\/g, '/');
          return normalized.endsWith('/package.json') || normalized.endsWith('/.markdownlint.yaml');
        }),
        readFile: jest.fn(async (targetPath) => {
          if (targetPath.replace(/\\/g, '/').endsWith('/package.json')) {
            return JSON.stringify({
              name: 'guia_js',
              version: '0.28.8-alpha',
              description: 'Tourist guide web application built on top of guia.js library',
            });
          }

          return '';
        }),
      };

      const step = new Step1_5CopilotInstructionsValidator({ fileOps });
      const facts = await step.collectRepoFacts(
        '/repo',
        [
          '# Copilot Instructions',
          '',
          '- For markdown formatting rules, use `.markdownlint.yaml` as the source of truth.',
        ].join('\n')
      );

      expect(facts.auxiliaryNormativeFiles).toEqual([
        { path: '.markdownlint.yaml', purpose: 'Markdown formatting rules source of truth' },
      ]);
    });
  });
});
