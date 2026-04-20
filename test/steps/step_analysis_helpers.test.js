// test/step_analysis_helpers.test.js

import {
  buildStepDependencies,
  initializeAiServices,
  appendAiRecommendations,
} from '../src/steps/step_analysis_helpers.js';

jest.mock('../src/lib/file_operations.js', () => ({
  FileOperations: jest.fn().mockImplementation(() => ({ type: 'FileOperations' })),
}));
jest.mock('../src/lib/backlog.js', () => ({
  Backlog: jest.fn().mockImplementation(() => ({ type: 'Backlog' })),
}));
jest.mock('../src/lib/ai_helpers.js', () => ({
  AiHelper: jest.fn().mockImplementation((opts) => ({ type: 'AiHelper', opts })),
}));
jest.mock('../src/lib/ai_cache.js', () => ({
  AiCache: jest.fn().mockImplementation(() => ({ type: 'AiCache' })),
}));
jest.mock('../src/lib/tech_stack.js', () => ({
  TechStackDetector: jest.fn().mockImplementation(() => ({ type: 'TechStackDetector' })),
}));

const { FileOperations } = require('../src/lib/file_operations.js');
const { Backlog } = require('../src/lib/backlog.js');
const { AiHelper } = require('../src/lib/ai_helpers.js');
const { AiCache } = require('../src/lib/ai_cache.js');
const { TechStackDetector } = require('../src/lib/tech_stack.js');

describe('step_analysis_helpers', () => {
  describe('buildStepDependencies', () => {
    beforeEach(() => {
      FileOperations.mockClear();
      Backlog.mockClear();
      AiHelper.mockClear();
      AiCache.mockClear();
      TechStackDetector.mockClear();
    });

    it('should instantiate all dependencies with defaults', () => {
      const deps = buildStepDependencies();
      expect(FileOperations).toHaveBeenCalledTimes(1);
      expect(Backlog).toHaveBeenCalledTimes(1);
      expect(AiHelper).toHaveBeenCalledWith({ promptsDir: null });
      expect(AiCache).toHaveBeenCalledTimes(1);
      expect(TechStackDetector).toHaveBeenCalledTimes(1);
      expect(deps.fileOps.type).toBe('FileOperations');
      expect(deps.backlog.type).toBe('Backlog');
      expect(deps.aiHelper.type).toBe('AiHelper');
      expect(deps.aiCache.type).toBe('AiCache');
      expect(deps.techStack.type).toBe('TechStackDetector');
    });

    it('should use provided dependency overrides', () => {
      const custom = {
        fileOps: { custom: 1 },
        backlog: { custom: 2 },
        aiHelper: { custom: 3 },
        aiCache: { custom: 4 },
        techStack: { custom: 5 },
      };
      const deps = buildStepDependencies(custom);
      expect(deps.fileOps).toBe(custom.fileOps);
      expect(deps.backlog).toBe(custom.backlog);
      expect(deps.aiHelper).toBe(custom.aiHelper);
      expect(deps.aiCache).toBe(custom.aiCache);
      expect(deps.techStack).toBe(custom.techStack);
    });

    it('should pass promptsDir to AiHelper if provided', () => {
      buildStepDependencies({ promptsDir: 'foo/bar' });
      expect(AiHelper).toHaveBeenCalledWith({ promptsDir: 'foo/bar' });
    });
  });

  describe('initializeAiServices', () => {
    it('should initialize both aiHelper and aiCache when available', async () => {
      const aiHelper = { initialize: jest.fn().mockResolvedValue(true) };
      const aiCache = { init: jest.fn().mockResolvedValue() };
      const result = await initializeAiServices(aiHelper, aiCache);
      expect(aiHelper.initialize).toHaveBeenCalled();
      expect(aiCache.init).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should not initialize aiCache if aiHelper is unavailable', async () => {
      const aiHelper = { initialize: jest.fn().mockResolvedValue(false) };
      const aiCache = { init: jest.fn() };
      const result = await initializeAiServices(aiHelper, aiCache);
      expect(aiHelper.initialize).toHaveBeenCalled();
      expect(aiCache.init).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it('should propagate errors from aiHelper.initialize', async () => {
      const aiHelper = { initialize: jest.fn().mockRejectedValue(new Error('fail')) };
      const aiCache = { init: jest.fn() };
      await expect(initializeAiServices(aiHelper, aiCache)).rejects.toThrow('fail');
    });

    it('should propagate errors from aiCache.init', async () => {
      const aiHelper = { initialize: jest.fn().mockResolvedValue(true) };
      const aiCache = { init: jest.fn().mockRejectedValue(new Error('fail2')) };
      await expect(initializeAiServices(aiHelper, aiCache)).rejects.toThrow('fail2');
    });
  });

  describe('appendAiRecommendations', () => {
    it('should append AI recommendations section to base report', () => {
      const base = '# Report\nSome content';
      const ai = 'AI says: foo';
      const result = appendAiRecommendations(base, ai);
      expect(result).toBe('# Report\nSome content\n\n---\n\n## AI Recommendations\n\nAI says: foo');
    });

    it('should handle empty base report', () => {
      const result = appendAiRecommendations('', 'AI');
      expect(result).toBe('\n\n---\n\n## AI Recommendations\n\nAI');
    });

    it('should handle empty aiContent', () => {
      const result = appendAiRecommendations('Base', '');
      expect(result).toBe('Base\n\n---\n\n## AI Recommendations\n\n');
    });

    it('should handle both baseReport and aiContent empty', () => {
      const result = appendAiRecommendations('', '');
      expect(result).toBe('\n\n---\n\n## AI Recommendations\n\n');
    });
  });
});
