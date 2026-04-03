// test/steps/step_19_typescript_review.test.js

import { jest } from '@jest/globals';
import {
  isTypeScriptProject,
  scoreTypeScriptIssues,
  formatTypeScriptReport,
  Step19TypescriptReview,
  STEP_DEFINITION,
} from '../../src/steps/step_19_typescript_review.js';
import { logger } from '../../src/core/logger.js';

// ============================================================================
// Pure function: isTypeScriptProject
// ============================================================================

describe('isTypeScriptProject', () => {
  it('returns true for .ts files', () => {
    expect(isTypeScriptProject(['src/index.ts', 'src/utils.js'])).toBe(true);
  });

  it('returns true for .tsx files', () => {
    expect(isTypeScriptProject(['src/App.tsx'])).toBe(true);
  });

  it('returns true for .mts and .cts files', () => {
    expect(isTypeScriptProject(['src/module.mts'])).toBe(true);
    expect(isTypeScriptProject(['src/module.cts'])).toBe(true);
  });

  it('returns false for JavaScript-only projects', () => {
    expect(isTypeScriptProject(['src/index.js', 'src/utils.mjs'])).toBe(false);
  });

  it('returns false for empty file list', () => {
    expect(isTypeScriptProject([])).toBe(false);
  });

  it('is case-insensitive for extensions', () => {
    expect(isTypeScriptProject(['src/Component.TSX'])).toBe(true);
    expect(isTypeScriptProject(['src/module.TS'])).toBe(true);
  });
});

// ============================================================================
// Pure function: scoreTypeScriptIssues
// ============================================================================

describe('scoreTypeScriptIssues', () => {
  it('counts explicit any annotations', () => {
    const files = ['const x: any = 1;', 'function foo(bar: any) {}'];
    const score = scoreTypeScriptIssues(files);
    expect(score.anyCount).toBe(2);
  });

  it('counts "as any" assertions', () => {
    const files = ['const x = getValue() as any;', 'return result as any;'];
    const score = scoreTypeScriptIssues(files);
    expect(score.anyCount).toBe(2);
  });

  it('counts @ts-ignore directives', () => {
    const files = ['// @ts-ignore\nconst x = badCall();'];
    const score = scoreTypeScriptIssues(files);
    expect(score.tsIgnoreCount).toBe(1);
  });

  it('counts @ts-nocheck directives', () => {
    const files = ['// @ts-nocheck\nimport something from "lib";'];
    const score = scoreTypeScriptIssues(files);
    expect(score.tsIgnoreCount).toBe(1);
  });

  it('counts functions missing return types', () => {
    const files = [
      'export function doWork(x: number) {\n  return x;\n}',
      'export async function fetchData(url: string) {\n  return fetch(url);\n}',
    ];
    const score = scoreTypeScriptIssues(files);
    expect(score.missingReturnTypeCount).toBe(2);
  });

  it('returns zero counts for clean TypeScript', () => {
    const files = [
      'const x: string = "hello";\nexport function greet(name: string): string { return name; }',
    ];
    const score = scoreTypeScriptIssues(files);
    expect(score.anyCount).toBe(0);
    expect(score.tsIgnoreCount).toBe(0);
    // missingReturnTypeCount may be 0 because the function has ): string
    expect(score.totalIssues).toBe(
      score.anyCount + score.tsIgnoreCount + score.missingReturnTypeCount
    );
  });

  it('calculates totalIssues as sum of all counts', () => {
    const files = [': any', 'as any', '@ts-ignore', 'export function f(x: any) {'];
    const score = scoreTypeScriptIssues(files);
    expect(score.totalIssues).toBe(
      score.anyCount + score.tsIgnoreCount + score.missingReturnTypeCount
    );
  });

  it('handles empty file array', () => {
    const score = scoreTypeScriptIssues([]);
    expect(score.anyCount).toBe(0);
    expect(score.tsIgnoreCount).toBe(0);
    expect(score.missingReturnTypeCount).toBe(0);
    expect(score.totalIssues).toBe(0);
  });
});

// ============================================================================
// Pure function: formatTypeScriptReport
// ============================================================================

describe('formatTypeScriptReport', () => {
  it('returns skipped message when skipped=true', () => {
    const report = formatTypeScriptReport({ skipped: true });
    expect(report).toContain('Step 19: TypeScript Review');
    expect(report).toContain('step skipped');
    expect(report).not.toContain('Strider');
  });

  it('includes Strider heading in normal report', () => {
    const report = formatTypeScriptReport({
      filesAnalyzed: ['src/index.ts'],
      aiContent: 'Looks good.',
    });
    expect(report).toContain('Strider');
    expect(report).toContain('Looks good.');
  });

  it('lists analyzed files', () => {
    const report = formatTypeScriptReport({
      filesAnalyzed: ['src/a.ts', 'src/b.tsx'],
      aiContent: '',
    });
    expect(report).toContain('- src/a.ts');
    expect(report).toContain('- src/b.tsx');
  });

  it('shows (none) when no files analyzed', () => {
    const report = formatTypeScriptReport({ filesAnalyzed: [], aiContent: '' });
    expect(report).toContain('- (none)');
  });

  it('shows placeholder when no AI content', () => {
    const report = formatTypeScriptReport({ filesAnalyzed: ['src/x.ts'], aiContent: '' });
    expect(report).toContain('_No AI analysis available._');
  });

  it('includes issue score table when provided', () => {
    const issueScore = { anyCount: 3, tsIgnoreCount: 1, missingReturnTypeCount: 5, totalIssues: 9 };
    const report = formatTypeScriptReport({
      filesAnalyzed: ['src/x.ts'],
      aiContent: 'Analysis done.',
      issueScore,
    });
    expect(report).toContain('Issue Score');
    expect(report).toContain('| 3 |');
    expect(report).toContain('| 1 |');
    expect(report).toContain('| 5 |');
    expect(report).toContain('**9**');
  });

  it('omits issue score table when issueScore is null', () => {
    const report = formatTypeScriptReport({
      filesAnalyzed: ['src/x.ts'],
      aiContent: 'AI output',
      issueScore: null,
    });
    expect(report).not.toContain('Issue Score');
  });
});

// ============================================================================
// STEP_DEFINITION
// ============================================================================

describe('STEP_DEFINITION', () => {
  it('has correct id', () => {
    expect(STEP_DEFINITION.id).toBe('step_19');
  });

  it('has correct name', () => {
    expect(STEP_DEFINITION.name).toBe('TypeScript Review');
  });

  it('has a kind property', () => {
    expect(STEP_DEFINITION).toHaveProperty('kind');
  });

  it('has a description', () => {
    expect(typeof STEP_DEFINITION.description).toBe('string');
    expect(STEP_DEFINITION.description.length).toBeGreaterThan(0);
  });

  it('depends on step_18', () => {
    expect(STEP_DEFINITION.dependencies).toContain('step_18');
  });
});

// ============================================================================
// Step19TypescriptReview (integration / wrapper)
// ============================================================================

describe('Step19TypescriptReview', () => {
  let mockFileOps, mockBacklog, mockAiHelper, mockAiCache, step;
  let loggerInfoSpy, loggerSuccessSpy, loggerErrorSpy, loggerWarnSpy;

  beforeEach(() => {
    mockFileOps = {
      readFile: jest.fn(),
      glob: jest.fn(),
    };
    mockBacklog = {
      saveStepSummary: jest.fn().mockResolvedValue(undefined),
    };
    mockAiHelper = {
      initialize: jest.fn(),
      executeRequest: jest.fn(),
    };
    mockAiCache = {
      init: jest.fn().mockResolvedValue(undefined),
      withCache: jest.fn(),
      withFileChangeGuard: jest.fn((_stepId, _fileContents, fn) => fn()),
    };
    loggerInfoSpy = jest.spyOn(logger, 'info').mockImplementation(() => {});
    loggerSuccessSpy = jest.spyOn(logger, 'success').mockImplementation(() => {});
    loggerErrorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    loggerWarnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});

    step = new Step19TypescriptReview({
      fileOps: mockFileOps,
      backlog: mockBacklog,
      aiHelper: mockAiHelper,
      aiCache: mockAiCache,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('skips when no TypeScript files are found', async () => {
    mockFileOps.glob.mockResolvedValue([]);

    const result = await step.execute('/project/root');

    expect(result.success).toBe(true);
    expect(result.skipped).toBe(true);
    expect(result.filesAnalyzed).toEqual([]);
    expect(result.totalTsFiles).toBe(0);
    expect(result.report).toContain('step skipped');
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('skipping'));
    expect(mockBacklog.saveStepSummary).toHaveBeenCalled();
  });

  it('executes happy path with AI available and returns report', async () => {
    mockFileOps.glob.mockResolvedValue(['src/index.ts', 'src/utils.tsx']);
    mockFileOps.readFile
      .mockResolvedValueOnce('const x: any = 1; // @ts-ignore\nexport async function go() {}') // index.ts
      .mockResolvedValueOnce('export function greet(): string { return "hi"; }') // utils.tsx
      .mockResolvedValueOnce(
        // ai_helpers.yaml
        'typescript_developer_prompt:\n  role_prefix: "You are Strider"\n  task_template: "Task for {project_name}"\n  approach: "Type-first"'
      );

    mockAiHelper.initialize.mockResolvedValue(true);
    mockAiCache.withFileChangeGuard.mockImplementation(async (_stepId, _fileContents, _fn) => ({
      content: 'Great TypeScript!',
    }));

    const result = await step.execute('/project/root', {
      projectName: 'MyApp',
      projectKind: 'nodejs_api',
    });

    expect(result.success).toBe(true);
    expect(result.skipped).toBeUndefined();
    expect(result.filesAnalyzed).toEqual(['src/index.ts', 'src/utils.tsx']);
    expect(result.totalTsFiles).toBe(2);
    expect(result.aiContent).toBe('Great TypeScript!');
    expect(result.report).toContain('Great TypeScript!');
    expect(result.issueScore).toBeDefined();
    expect(loggerSuccessSpy).toHaveBeenCalledWith(
      'Step 19 completed - TypeScript review report generated'
    );
    expect(mockBacklog.saveStepSummary).toHaveBeenCalledWith(
      19,
      'TypeScript_Review',
      expect.any(String)
    );
  });

  it('injects actual file contents into the AI prompt', async () => {
    const fileContent = 'export function greet(): string { return "hi"; }';
    mockFileOps.glob.mockResolvedValue(['src/utils.tsx']);
    mockFileOps.readFile
      .mockResolvedValueOnce(fileContent) // utils.tsx
      .mockResolvedValueOnce(
        'typescript_developer_prompt:\n  role_prefix: "You are Strider"\n  task_template: "Task"\n  approach: "Type-first"'
      );

    mockAiHelper.initialize.mockResolvedValue(true);
    mockAiCache.init.mockResolvedValue(undefined);

    let capturedPrompt = '';
    mockAiCache.withFileChangeGuard.mockImplementation(async (_stepId, _fileContents, fn) => {
      await fn();
      return { content: 'ok' };
    });
    mockAiHelper.executeRequest.mockImplementation(async (prompt) => {
      capturedPrompt = prompt;
      return { content: 'ok' };
    });

    await step.execute('/project/root');

    expect(capturedPrompt).toContain('**File Contents**');
    expect(capturedPrompt).toContain('`src/utils.tsx`');
    expect(capturedPrompt).toContain(fileContent);
  });

  it('executes with AI unavailable and returns report without AI content', async () => {
    mockFileOps.glob.mockResolvedValue(['src/app.ts']);
    mockFileOps.readFile.mockResolvedValue('const x: string = "hi";');
    mockAiHelper.initialize.mockResolvedValue(false);

    const result = await step.execute('/project/root');

    expect(result.success).toBe(true);
    expect(result.aiContent).toBe('');
    expect(result.report).toContain('_No AI analysis available._');
    expect(loggerWarnSpy).toHaveBeenCalledWith(expect.stringContaining('AI helper not available'));
    expect(loggerInfoSpy).toHaveBeenCalledWith(
      'Step 19 completed - no AI content (AI unavailable or prompt missing)'
    );
  });

  it('uses options.sourceFiles if provided', async () => {
    mockAiHelper.initialize.mockResolvedValue(false);
    mockFileOps.readFile.mockResolvedValue('');

    const result = await step.execute('/project/root', {
      sourceFiles: ['lib/foo.ts', 'lib/bar.tsx'],
    });

    expect(result.success).toBe(true);
    expect(result.filesAnalyzed).toEqual(['lib/foo.ts', 'lib/bar.tsx']);
    expect(mockFileOps.glob).not.toHaveBeenCalled();
  });

  it('handles file read errors gracefully during content sampling', async () => {
    mockFileOps.glob.mockResolvedValue(['src/a.ts', 'src/b.ts']);
    mockFileOps.readFile.mockRejectedValue(new Error('Read error'));
    mockAiHelper.initialize.mockResolvedValue(false);

    const result = await step.execute('/project/root');

    expect(result.success).toBe(true);
    expect(result.filesAnalyzed).toEqual(['src/a.ts', 'src/b.ts']);
    expect(result.aiContent).toBe('');
  });

  it('handles AI prompt build errors gracefully', async () => {
    mockFileOps.glob.mockResolvedValue(['src/index.ts']);
    mockFileOps.readFile
      .mockResolvedValueOnce('const x: any = 1;')
      .mockRejectedValue(new Error('YAML read error'));
    mockAiHelper.initialize.mockResolvedValue(true);

    const result = await step.execute('/project/root');

    expect(result.success).toBe(true);
    expect(result.aiContent).toBe('');
    expect(loggerWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('TypeScript AI review skipped')
    );
  });

  it('handles errors thrown during execution', async () => {
    mockFileOps.glob.mockResolvedValue(['src/index.ts']);
    mockFileOps.readFile.mockResolvedValue('');
    mockAiHelper.initialize.mockResolvedValue(false);
    mockBacklog.saveStepSummary.mockRejectedValue(new Error('Backlog failure'));

    const result = await step.execute('/project/root');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Backlog failure');
    expect(loggerErrorSpy).toHaveBeenCalledWith('Step 19 failed: Backlog failure');
  });

  it('limits discovered files to 100 unique', async () => {
    const files = Array.from({ length: 120 }, (_, i) => `src/file${i}.ts`);
    mockFileOps.glob.mockResolvedValue(files);
    mockAiHelper.initialize.mockResolvedValue(false);
    mockFileOps.readFile.mockResolvedValue('');

    const result = await step.execute('/project/root');

    expect(result.totalTsFiles).toBe(100);
  });

  it('samples only up to 20 files for AI analysis', async () => {
    const files = Array.from({ length: 50 }, (_, i) => `src/file${i}.ts`);
    mockFileOps.glob.mockResolvedValue(files);
    mockAiHelper.initialize.mockResolvedValue(false);
    mockFileOps.readFile.mockResolvedValue('');

    const result = await step.execute('/project/root');

    expect(result.filesAnalyzed.length).toBe(20);
    expect(result.totalTsFiles).toBe(50);
  });

  it('produces no AI content when persona config is null in YAML', async () => {
    mockFileOps.glob.mockResolvedValue(['src/index.ts']);
    mockFileOps.readFile
      .mockResolvedValueOnce('') // file content
      .mockResolvedValueOnce('typescript_developer_prompt: null'); // ai_helpers.yaml

    mockAiHelper.initialize.mockResolvedValue(true);

    const result = await step.execute('/project/root');

    expect(result.success).toBe(true);
    // buildYamlStepPrompt returns null for null config, so no AI call is made
    expect(result.aiContent).toBe('');
  });

  it('injects codebase profile into prompt when typescript_profile.md exists', async () => {
    const profileContent = '## Codebase Profile\n- no Zod usage\n- as any: intentional in tests';
    mockFileOps.glob.mockResolvedValue(['src/index.ts']);
    mockFileOps.readFile
      .mockResolvedValueOnce('export const x: string = "hi";') // index.ts
      .mockResolvedValueOnce(
        'typescript_developer_prompt:\n  role_prefix: "You are Strider"\n  task_template: "Task for {project_name}"\n  approach: "Type-first"'
      ) // ai_helpers.yaml
      .mockRejectedValueOnce(new Error('ENOENT')) // prompt_roles.yaml (not present)
      .mockRejectedValueOnce(new Error('ENOENT')) // tsconfig.json
      .mockRejectedValueOnce(new Error('ENOENT')) // tsconfig.esm.json
      .mockRejectedValueOnce(new Error('ENOENT')) // tsconfig.base.json
      .mockResolvedValueOnce(profileContent); // typescript_profile.md

    mockAiHelper.initialize.mockResolvedValue(true);

    let capturedPrompt = '';
    mockAiCache.withFileChangeGuard.mockImplementation(async (_stepId, _fileContents, fn) => {
      await fn();
      return { content: 'ok' };
    });
    mockAiHelper.executeRequest.mockImplementation(async (prompt) => {
      capturedPrompt = prompt;
      return { content: 'ok' };
    });

    await step.execute('/project/root');

    expect(capturedPrompt).toContain('Codebase Profile — Verified Ground Truth');
    expect(capturedPrompt).toContain(profileContent);
    expect(capturedPrompt).toContain('Do NOT flag items documented here as issues');
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('typescript_profile.md'));
  });

  it('succeeds without codebase profile when typescript_profile.md is absent', async () => {
    mockFileOps.glob.mockResolvedValue(['src/index.ts']);
    mockFileOps.readFile
      .mockResolvedValueOnce('export const x: string = "hi";') // index.ts
      .mockResolvedValueOnce(
        'typescript_developer_prompt:\n  role_prefix: "You are Strider"\n  task_template: "Task for {project_name}"\n  approach: "Type-first"'
      ) // ai_helpers.yaml
      .mockRejectedValueOnce(new Error('ENOENT')) // tsconfig.json
      .mockRejectedValueOnce(new Error('ENOENT')) // tsconfig.esm.json
      .mockRejectedValueOnce(new Error('ENOENT')) // tsconfig.base.json
      .mockRejectedValueOnce(new Error('ENOENT: no such file')); // typescript_profile.md absent

    mockAiHelper.initialize.mockResolvedValue(true);

    let capturedPrompt = '';
    mockAiCache.withFileChangeGuard.mockImplementation(async (_stepId, _fileContents, fn) => {
      await fn();
      return { content: 'ok' };
    });
    mockAiHelper.executeRequest.mockImplementation(async (prompt) => {
      capturedPrompt = prompt;
      return { content: 'ok' };
    });

    const result = await step.execute('/project/root');

    expect(result.success).toBe(true);
    expect(result.aiContent).toBe('ok');
    expect(capturedPrompt).not.toContain('Codebase Profile');
  });

  // ============================================================================
  // _discoverTsConfigFiles
  // ============================================================================

  describe('_discoverTsConfigFiles', () => {
    it('returns found tsconfig files with content', async () => {
      mockFileOps.readFile
        .mockResolvedValueOnce('{"compilerOptions":{"strict":true}}') // tsconfig.json
        .mockRejectedValueOnce(new Error('ENOENT')) // tsconfig.esm.json
        .mockRejectedValueOnce(new Error('ENOENT')); // tsconfig.base.json

      const result = await step._discoverTsConfigFiles('/project/root');

      expect(result).toHaveLength(1);
      expect(result[0].filename).toBe('tsconfig.json');
      expect(result[0].content).toBe('{"compilerOptions":{"strict":true}}');
    });

    it('returns multiple tsconfig files when present', async () => {
      mockFileOps.readFile
        .mockResolvedValueOnce('{"compilerOptions":{"strict":true}}') // tsconfig.json
        .mockResolvedValueOnce('{"extends":"./tsconfig.json","module":"ESNext"}') // tsconfig.esm.json
        .mockRejectedValueOnce(new Error('ENOENT')); // tsconfig.base.json

      const result = await step._discoverTsConfigFiles('/project/root');

      expect(result).toHaveLength(2);
      expect(result.map((r) => r.filename)).toEqual(['tsconfig.json', 'tsconfig.esm.json']);
    });

    it('returns empty array when no tsconfig files found', async () => {
      mockFileOps.readFile
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockRejectedValueOnce(new Error('ENOENT'));

      const result = await step._discoverTsConfigFiles('/project/root');

      expect(result).toEqual([]);
    });
  });

  it('includes tsconfig content in AI prompt when tsconfig.json exists', async () => {
    const tsConfigContent = '{"compilerOptions":{"strict":true,"target":"ES2020"}}';
    mockFileOps.glob.mockResolvedValue(['src/index.ts']);
    mockFileOps.readFile
      .mockResolvedValueOnce('export const x: string = "hi";') // index.ts
      .mockResolvedValueOnce(
        'typescript_developer_prompt:\n  role_prefix: "You are Strider"\n  task_template: "Task for {project_name}"\n  approach: "Type-first"'
      ) // ai_helpers.yaml
      .mockRejectedValueOnce(new Error('ENOENT')) // prompt_roles.yaml (not present)
      .mockResolvedValueOnce(tsConfigContent) // tsconfig.json
      .mockRejectedValueOnce(new Error('ENOENT')) // tsconfig.esm.json
      .mockRejectedValueOnce(new Error('ENOENT')); // tsconfig.base.json

    mockAiHelper.initialize.mockResolvedValue(true);

    let capturedPrompt = '';
    mockAiCache.withFileChangeGuard.mockImplementation(async (_stepId, _fileContents, fn) => {
      await fn();
      return { content: 'ok' };
    });
    mockAiHelper.executeRequest.mockImplementation(async (prompt) => {
      capturedPrompt = prompt;
      return { content: 'ok' };
    });

    await step.execute('/project/root');

    expect(capturedPrompt).toContain('tsconfig.json');
    expect(capturedPrompt).toContain(tsConfigContent);
    expect(capturedPrompt).toContain('**Configuration Files included**: tsconfig.json');
  });

  it('injects PROJECT_CONTEXT.md runtime constraints into prompt when present', async () => {
    const projectCtxContent = '## Runtime\n- Node.js only\n- No CORS';
    mockFileOps.glob.mockResolvedValue(['src/index.ts']);
    mockFileOps.readFile
      .mockResolvedValueOnce('export const x: string = "hi";') // index.ts
      .mockResolvedValueOnce(
        'typescript_developer_prompt:\n  role_prefix: "You are Strider"\n  task_template: "Task for {project_name}"\n  approach: "Type-first"'
      ) // ai_helpers.yaml
      .mockRejectedValueOnce(new Error('ENOENT')) // prompt_roles.yaml (not present)
      .mockRejectedValueOnce(new Error('ENOENT')) // tsconfig.json
      .mockRejectedValueOnce(new Error('ENOENT')) // tsconfig.esm.json
      .mockRejectedValueOnce(new Error('ENOENT')) // tsconfig.base.json
      .mockRejectedValueOnce(new Error('ENOENT')) // typescript_profile.md
      .mockResolvedValueOnce(projectCtxContent); // PROJECT_CONTEXT.md

    mockAiHelper.initialize.mockResolvedValue(true);

    let capturedPrompt = '';
    mockAiCache.withFileChangeGuard.mockImplementation(async (_stepId, _fileContents, fn) => {
      await fn();
      return { content: 'ok' };
    });
    mockAiHelper.executeRequest.mockImplementation(async (prompt) => {
      capturedPrompt = prompt;
      return { content: 'ok' };
    });

    await step.execute('/project/root');

    expect(capturedPrompt).toContain('Runtime Constraints (from PROJECT_CONTEXT.md)');
    expect(capturedPrompt).toContain(projectCtxContent);
  });
});
