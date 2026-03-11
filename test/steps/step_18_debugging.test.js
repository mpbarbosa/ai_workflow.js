// test/steps/step_18_debugging.test.js

import { jest } from '@jest/globals';
import {
  detectDebugPersona,
  formatDebuggingReport,
  readProjectContextFile,
  Step18Debugging,
  STEP_DEFINITION,
} from '../../src/steps/step_18_debugging.js';
import { logger } from '../../src/core/logger.js';

describe('detectDebugPersona', () => {
  it('detects observer pattern persona', () => {
    const files = [
      'const e = new EventEmitter(); e.on("data", () => {});',
      'obj.subscribe(() => {});',
      'window.addEventListener("click", fn);',
    ];
    expect(detectDebugPersona(files)).toBe('observer_pattern_debugger_prompt');
  });

  it('detects async flow persona', () => {
    const files = [
      'async function run() { await fetch(); }',
      'new Promise((resolve) => resolve());',
      'callback();',
      'doSomething().then(() => {});',
    ];
    expect(detectDebugPersona(files)).toBe('async_flow_debugger_prompt');
  });

  it('detects data structure persona', () => {
    const files = [
      'const m = new Map();',
      'const s = new Set();',
      'const ll = new LinkedList();',
      'const bt = new BinaryTree();',
      'const h = new Heap();',
      'const g = new Graph();',
    ];
    expect(detectDebugPersona(files)).toBe('data_structure_debugger_prompt');
  });

  it('returns observer persona as tiebreaker when no patterns match', () => {
    expect(detectDebugPersona([''])).toBe('observer_pattern_debugger_prompt');
    expect(detectDebugPersona(['random text'])).toBe('observer_pattern_debugger_prompt');
  });

  it('handles mixed patterns and returns highest score', () => {
    const files = [
      'new EventEmitter(); async function x() {} new Map();',
      'addEventListener("x", fn);',
      'await something();',
      'linkedList();',
    ];
    // observerScore: 2, asyncScore: 2, dataStructScore: 1
    expect(detectDebugPersona(files)).toBe('observer_pattern_debugger_prompt');
  });

  it('handles case insensitivity', () => {
    const files = ['NEW MAP(); LINKEDLIST(); EVENTEMITTER(); ASYNC function() {}'];
    expect([
      'observer_pattern_debugger_prompt',
      'async_flow_debugger_prompt',
      'data_structure_debugger_prompt',
    ]).toContain(detectDebugPersona(files));
  });

  it('handles null/undefined input gracefully', () => {
    expect(detectDebugPersona(null)).toBe('observer_pattern_debugger_prompt');
    expect(detectDebugPersona(undefined)).toBe('observer_pattern_debugger_prompt');
  });
});

describe('formatDebuggingReport', () => {
  it('formats report for observer persona', () => {
    const report = formatDebuggingReport({
      personaKey: 'observer_pattern_debugger_prompt',
      filesAnalyzed: ['file1.js', 'file2.js'],
      aiContent: 'AI found observer issues.',
    });
    expect(report).toContain('Observer Pattern Debugger');
    expect(report).toContain('AI found observer issues.');
  });

  it('formats report for async persona', () => {
    const report = formatDebuggingReport({
      personaKey: 'async_flow_debugger_prompt',
      filesAnalyzed: ['file1.js'],
      aiContent: 'AI found async issues.',
    });
    expect(report).toContain('Async Flow Debugger');
    expect(report).toContain('AI found async issues.');
  });

  it('formats report for data structure persona', () => {
    const report = formatDebuggingReport({
      personaKey: 'data_structure_debugger_prompt',
      filesAnalyzed: ['file1.js'],
      aiContent: 'AI found data structure issues.',
    });
    expect(report).toContain('Data Structure Debugger');
    expect(report).toContain('AI found data structure issues.');
  });

  it('formats report for unknown persona', () => {
    const report = formatDebuggingReport({
      personaKey: 'unknown_persona',
      filesAnalyzed: [],
      aiContent: '',
    });
    expect(report).toContain('Debugging Analysis');
    expect(report).toContain('_No AI analysis available._');
  });

  it('handles empty filesAnalyzed and aiContent', () => {
    const report = formatDebuggingReport({
      personaKey: 'async_flow_debugger_prompt',
      filesAnalyzed: [],
      aiContent: '',
    });
    expect(report).toContain('- (none)');
    expect(report).toContain('_No AI analysis available._');
  });

  it('handles null filesAnalyzed gracefully', () => {
    const report = formatDebuggingReport({
      personaKey: 'async_flow_debugger_prompt',
      filesAnalyzed: null,
      aiContent: 'some content',
    });
    expect(report).toContain('- (none)');
    expect(report).toContain('some content');
  });
});

describe('STEP_DEFINITION', () => {
  it('has correct step definition properties', () => {
    expect(STEP_DEFINITION).toHaveProperty('id', 'step_18');
    expect(STEP_DEFINITION).toHaveProperty('name', 'Debugging Analysis');
    expect(STEP_DEFINITION).toHaveProperty('kind');
    expect(STEP_DEFINITION).toHaveProperty('description');
    expect(Array.isArray(STEP_DEFINITION.dependencies)).toBe(true);
  });
});

describe('Step18Debugging', () => {
  let mockFileOps,
    mockBacklog,
    mockAiHelper,
    mockAiCache,
    step,
    loggerStepSpy,
    loggerInfoSpy,
    loggerSuccessSpy,
    loggerWarnSpy;

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
      init: jest.fn(),
      withCache: jest.fn(),
    };
    loggerStepSpy = jest.spyOn(logger, 'step').mockImplementation(() => {});
    loggerInfoSpy = jest.spyOn(logger, 'info').mockImplementation(() => {});
    loggerSuccessSpy = jest.spyOn(logger, 'success').mockImplementation(() => {});
    jest.spyOn(logger, 'error').mockImplementation(() => {});
    loggerWarnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    step = new Step18Debugging({
      fileOps: mockFileOps,
      backlog: mockBacklog,
      aiHelper: mockAiHelper,
      aiCache: mockAiCache,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('executes happy path with AI available and returns report', async () => {
    const personaYaml = [
      'async_flow_debugger_prompt:',
      '  role_prefix: RolePrefix',
      '  specific_expertise: Expertise',
      '  approach: Approach',
      '  output_format: OutputFormat',
    ].join('\n');
    mockFileOps.glob.mockResolvedValue(['file1.js', 'file2.js']);
    mockFileOps.readFile
      .mockRejectedValueOnce(new Error('ENOENT')) // PROJECT_CONTEXT.md absent
      .mockResolvedValueOnce('async function run() { await fetch(); }') // file1.js
      .mockResolvedValueOnce('async function run() { await fetch(); }') // file2.js
      .mockResolvedValueOnce(personaYaml) // AI_HELPERS_PATH
      .mockResolvedValueOnce('{}'); // AI_PROJECT_KINDS_PATH
    mockAiHelper.initialize.mockResolvedValue(true);
    mockAiCache.init.mockResolvedValue(undefined);
    mockAiCache.withCache.mockImplementation(async (_k1, _k2, _fn) => ({
      content: 'AI debug content',
    }));

    const result = await step.execute('/project/root');
    expect(result.success).toBe(true);
    expect(result.personaKey).toBe('async_flow_debugger_prompt');
    expect(result.filesAnalyzed.length).toBeGreaterThan(0);
    expect(result.aiContent).toBe('AI debug content');
    expect(result.report).toContain('AI debug content');
    expect(loggerStepSpy).toHaveBeenCalledWith('Step 18: Debugging Analysis');
    expect(loggerSuccessSpy).toHaveBeenCalledWith(
      'Step 18 completed - debugging analysis report generated'
    );
    expect(mockBacklog.saveStepSummary).toHaveBeenCalled();
  });

  it('injects actual file contents into the AI prompt', async () => {
    const personaYaml = [
      'async_flow_debugger_prompt:',
      '  role_prefix: RolePrefix',
      '  specific_expertise: Expertise',
      '  approach: Approach',
      '  output_format: OutputFormat',
    ].join('\n');
    const fileContent = 'async function run() { await fetch(); }';
    mockFileOps.glob.mockResolvedValue(['src/utils/myfile.js']);
    mockFileOps.readFile
      .mockRejectedValueOnce(new Error('ENOENT')) // PROJECT_CONTEXT.md absent
      .mockResolvedValueOnce(fileContent) // src/utils/myfile.js
      .mockResolvedValueOnce(personaYaml) // AI_HELPERS_PATH
      .mockResolvedValueOnce('{}'); // AI_PROJECT_KINDS_PATH
    mockAiHelper.initialize.mockResolvedValue(true);
    mockAiCache.init.mockResolvedValue(undefined);

    let capturedPrompt = '';
    mockAiCache.withCache.mockImplementation(async (_k1, _k2, fn) => {
      // Invoke the generator so the prompt is forwarded to executeRequest
      await fn();
      return { content: 'ok' };
    });
    mockAiHelper.executeRequest.mockImplementation(async (prompt) => {
      capturedPrompt = prompt;
      return { content: 'ok' };
    });

    await step.execute('/project/root');

    // The prompt must contain a fenced code block with the actual file content,
    // not just the filename in a comma-separated list.
    expect(capturedPrompt).toContain('**File Contents**');
    expect(capturedPrompt).toContain('`src/utils/myfile.js`');
    expect(capturedPrompt).toContain(fileContent);
  });

  it('executes with AI unavailable and returns report with no AI content', async () => {
    mockFileOps.glob.mockResolvedValue(['file1.js']);
    mockFileOps.readFile.mockResolvedValue('async function run() {}');
    mockAiHelper.initialize.mockResolvedValue(false);

    const result = await step.execute('/project/root');
    expect(result.success).toBe(true);
    expect(result.aiContent).toBe('');
    expect(result.report).toContain('_No AI analysis available._');
    expect(loggerWarnSpy).toHaveBeenCalledWith(
      'AI helper not available - skipping debugging analysis'
    );
    expect(loggerInfoSpy).toHaveBeenCalledWith(
      'Step 18 completed - no AI content (AI unavailable or prompt missing)'
    );
    expect(mockBacklog.saveStepSummary).toHaveBeenCalled();
  });

  it('executes with forcedPersona option', async () => {
    mockFileOps.glob.mockResolvedValue(['file1.js']);
    mockFileOps.readFile.mockResolvedValue('eventemitter');
    mockAiHelper.initialize.mockResolvedValue(false);

    const result = await step.execute('/project/root', {
      forcedPersona: 'observer_pattern_debugger_prompt',
    });
    expect(result.personaKey).toBe('observer_pattern_debugger_prompt');
  });

  it('handles fileOps.readFile errors gracefully', async () => {
    mockFileOps.glob.mockResolvedValue(['file1.js', 'file2.js']);
    mockFileOps.readFile.mockImplementation(() => {
      throw new Error('Read error');
    });
    mockAiHelper.initialize.mockResolvedValue(false);

    const result = await step.execute('/project/root');
    expect(result.success).toBe(true);
    expect(result.filesAnalyzed.length).toBe(2);
    expect(result.aiContent).toBe('');
    expect(result.report).toContain('_No AI analysis available._');
  });

  it('handles errors thrown during execution (glob failures caught internally)', async () => {
    mockFileOps.glob.mockRejectedValue(new Error('Glob error'));
    mockAiHelper.initialize.mockResolvedValue(false);
    const result = await step.execute('/project/root');
    expect(result.success).toBe(true);
    expect(result.filesAnalyzed).toEqual([]);
    expect(result.totalSourceFiles).toBe(0);
  });

  it('handles _discoverSourceFiles returning empty array', async () => {
    mockFileOps.glob.mockResolvedValue([]);
    mockAiHelper.initialize.mockResolvedValue(false);

    const result = await step.execute('/project/root');
    expect(result.success).toBe(true);
    expect(result.filesAnalyzed).toEqual([]);
    expect(result.totalSourceFiles).toBe(0);
    expect(result.report).toContain('- (none)');
  });

  it('limits discovered files to 100 unique', async () => {
    const files = Array.from({ length: 120 }, (_, i) => `file${i}.js`);
    mockFileOps.glob.mockResolvedValue(files);
    mockAiHelper.initialize.mockResolvedValue(false);

    const result = await step.execute('/project/root');
    expect(result.totalSourceFiles).toBe(100);
  });

  it('handles missing options.sourceFiles and uses _discoverSourceFiles', async () => {
    mockFileOps.glob.mockResolvedValue(['file1.js', 'file2.js']);
    mockFileOps.readFile.mockResolvedValue('async function run() {}');
    mockAiHelper.initialize.mockResolvedValue(false);

    const result = await step.execute('/project/root');
    expect(result.filesAnalyzed.length).toBe(2);
  });

  it('uses options.sourceFiles if provided', async () => {
    mockAiHelper.initialize.mockResolvedValue(false);
    const result = await step.execute('/project/root', {
      sourceFiles: ['custom1.js', 'custom2.js'],
    });
    expect(result.filesAnalyzed).toEqual(['custom1.js', 'custom2.js']);
  });
});

describe('readProjectContextFile', () => {
  it('returns file content when PROJECT_CONTEXT.md exists', async () => {
    const fakeContent = '## Runtime\n- Node.js only';
    const mockFileOps = { readFile: jest.fn().mockResolvedValue(fakeContent) };
    const result = await readProjectContextFile('/some/project', mockFileOps);
    expect(result).toBe(fakeContent);
    expect(mockFileOps.readFile).toHaveBeenCalledWith(
      expect.stringContaining('PROJECT_CONTEXT.md')
    );
  });

  it('returns null when PROJECT_CONTEXT.md is absent (ENOENT)', async () => {
    const mockFileOps = {
      readFile: jest.fn().mockRejectedValue(new Error('ENOENT: no such file')),
    };
    const result = await readProjectContextFile('/some/project', mockFileOps);
    expect(result).toBeNull();
  });

  it('returns null on any read error', async () => {
    const mockFileOps = { readFile: jest.fn().mockRejectedValue(new Error('Permission denied')) };
    const result = await readProjectContextFile('/some/project', mockFileOps);
    expect(result).toBeNull();
  });
});

describe('Step18Debugging.execute() — PROJECT_CONTEXT.md injection', () => {
  let mockFileOps, mockBacklog, mockAiHelper, mockAiCache, step;

  beforeEach(() => {
    mockFileOps = { readFile: jest.fn(), glob: jest.fn() };
    mockBacklog = { saveStepSummary: jest.fn().mockResolvedValue(undefined) };
    mockAiHelper = { initialize: jest.fn(), executeRequest: jest.fn() };
    mockAiCache = { init: jest.fn(), withCache: jest.fn() };
    jest.spyOn(logger, 'step').mockImplementation(() => {});
    jest.spyOn(logger, 'info').mockImplementation(() => {});
    jest.spyOn(logger, 'success').mockImplementation(() => {});
    jest.spyOn(logger, 'warn').mockImplementation(() => {});
    jest.spyOn(logger, 'error').mockImplementation(() => {});
    step = new Step18Debugging({
      fileOps: mockFileOps,
      backlog: mockBacklog,
      aiHelper: mockAiHelper,
      aiCache: mockAiCache,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('injects PROJECT_CONTEXT.md content into the AI prompt when file is present', async () => {
    const projectContext = '## Runtime\n- Node.js only\n- No CORS, no browser';
    const personaYaml = [
      'async_flow_debugger_prompt:',
      '  role_prefix: AsyncRole',
      '  specific_expertise: Async expertise',
      '  approach: Analyze async flows',
      '  output_format: Report',
    ].join('\n');
    mockFileOps.glob.mockResolvedValue(['src/index.js']);
    mockFileOps.readFile
      .mockResolvedValueOnce(projectContext) // PROJECT_CONTEXT.md
      .mockResolvedValueOnce('async function run() { await fetch(); }') // src/index.js
      .mockResolvedValueOnce(personaYaml) // AI_HELPERS_PATH
      .mockResolvedValueOnce('{}'); // AI_PROJECT_KINDS_PATH
    mockAiHelper.initialize.mockResolvedValue(true);
    mockAiCache.init.mockResolvedValue(undefined);

    let capturedPrompt = '';
    mockAiCache.withCache.mockImplementation(async (_k1, _k2, fn) => {
      await fn();
      return { content: 'ai-result' };
    });
    mockAiHelper.executeRequest.mockImplementation(async (prompt) => {
      capturedPrompt = prompt;
      return { content: 'ai-result' };
    });

    const result = await step.execute('/project/root');
    expect(result.success).toBe(true);
    expect(capturedPrompt).toContain('**Runtime Constraints (from PROJECT_CONTEXT.md)**:');
    expect(capturedPrompt).toContain('Node.js only');
    expect(capturedPrompt).toContain('No CORS, no browser');
    // Constraints section appears before specific_expertise
    const ctxPos = capturedPrompt.indexOf('Runtime Constraints');
    const expertisePos = capturedPrompt.indexOf('Async expertise');
    expect(ctxPos).toBeGreaterThan(-1);
    expect(expertisePos).toBeGreaterThan(-1);
    expect(ctxPos).toBeLessThan(expertisePos);
  });

  it('continues normally when PROJECT_CONTEXT.md is absent', async () => {
    const personaYaml = [
      'async_flow_debugger_prompt:',
      '  role_prefix: AsyncRole',
      '  specific_expertise: Async expertise',
      '  approach: Analyze',
      '  output_format: Report',
    ].join('\n');
    mockFileOps.glob.mockResolvedValue(['src/index.js']);
    mockFileOps.readFile
      .mockRejectedValueOnce(new Error('ENOENT')) // PROJECT_CONTEXT.md absent
      .mockResolvedValueOnce('async function run() { await fetch(); }') // src/index.js
      .mockResolvedValueOnce(personaYaml) // AI_HELPERS_PATH
      .mockResolvedValueOnce('{}'); // AI_PROJECT_KINDS_PATH
    mockAiHelper.initialize.mockResolvedValue(true);
    mockAiCache.init.mockResolvedValue(undefined);

    let capturedPrompt = '';
    mockAiCache.withCache.mockImplementation(async (_k1, _k2, fn) => {
      await fn();
      return { content: 'ai-result' };
    });
    mockAiHelper.executeRequest.mockImplementation(async (prompt) => {
      capturedPrompt = prompt;
      return { content: 'ai-result' };
    });

    const result = await step.execute('/project/root');
    expect(result.success).toBe(true);
    expect(capturedPrompt).not.toContain('Runtime Constraints (from PROJECT_CONTEXT.md)');
    expect(capturedPrompt).toContain('AsyncRole');
  });
});
