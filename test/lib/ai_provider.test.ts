// test/lib/ai_provider.test.ts
import {
  createProviderWrapper,
  isProviderAvailable,
  AIProvider,
  ProviderWrapperOptions,
} from '../../src/lib/ai_provider.js';

jest.mock('../../src/lib/copilot_sdk_wrapper.js', () => ({
  CopilotSdkWrapper: jest.fn().mockImplementation((opts) => ({
    __type: 'CopilotSdkWrapper',
    opts,
  })),
}));
jest.mock('../../src/lib/claude_sdk_wrapper.js', () => ({
  ClaudeProviderWrapper: jest.fn().mockImplementation((opts) => ({
    __type: 'ClaudeProviderWrapper',
    opts,
  })),
}));

const { CopilotSdkWrapper } = require('../../src/lib/copilot_sdk_wrapper.js');
const { ClaudeProviderWrapper } = require('../../src/lib/claude_sdk_wrapper.js');

describe('ai_provider.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    CopilotSdkWrapper.isAvailable = jest.fn(() => true);
    ClaudeProviderWrapper.isAvailable = jest.fn(() => true);
  });

  describe('createProviderWrapper', () => {
    it('creates CopilotSdkWrapper by default', () => {
      const wrapper = createProviderWrapper('copilot');
      expect(CopilotSdkWrapper).toHaveBeenCalledWith({
        model: undefined,
        timeout: undefined,
        workingDirectory: undefined,
      });
      expect(wrapper.__type).toBe('CopilotSdkWrapper');
    });

    it('creates CopilotSdkWrapper with all options', () => {
      const opts: ProviderWrapperOptions = {
        model: 'gpt-4',
        timeout: 5000,
        workingDirectory: '/tmp',
        streaming: true,
        tools: ['tool1', 'tool2'],
      };
      const wrapper = createProviderWrapper('copilot', opts);
      expect(CopilotSdkWrapper).toHaveBeenCalledWith({
        model: 'gpt-4',
        timeout: 5000,
        workingDirectory: '/tmp',
        streaming: true,
        tools: ['tool1', 'tool2'],
      });
      expect(wrapper.__type).toBe('CopilotSdkWrapper');
    });

    it('does not include streaming/tools if not provided', () => {
      const opts: ProviderWrapperOptions = { model: 'gpt-4' };
      createProviderWrapper('copilot', opts);
      expect(CopilotSdkWrapper).toHaveBeenCalledWith({
        model: 'gpt-4',
        timeout: undefined,
        workingDirectory: undefined,
      });
    });

    it('creates ClaudeProviderWrapper when provider is "claude"', () => {
      const opts: ProviderWrapperOptions = {
        model: 'claude-3',
        timeout: 10000,
        workingDirectory: '/claude',
        streaming: true,
        tools: ['irrelevant'],
      };
      const wrapper = createProviderWrapper('claude', opts);
      expect(ClaudeProviderWrapper).toHaveBeenCalledWith({
        model: 'claude-3',
        timeout: 10000,
        workingDirectory: '/claude',
      });
      expect(wrapper.__type).toBe('ClaudeProviderWrapper');
    });

    it('handles missing options gracefully for ClaudeProviderWrapper', () => {
      const wrapper = createProviderWrapper('claude');
      expect(ClaudeProviderWrapper).toHaveBeenCalledWith({
        model: undefined,
        timeout: undefined,
        workingDirectory: undefined,
      });
      expect(wrapper.__type).toBe('ClaudeProviderWrapper');
    });

    it('falls back to CopilotSdkWrapper for unknown provider', () => {
      // @ts-expect-error
      const wrapper = createProviderWrapper('unknown', { model: 'x' });
      expect(CopilotSdkWrapper).toHaveBeenCalledWith({
        model: 'x',
        timeout: undefined,
        workingDirectory: undefined,
      });
      expect(wrapper.__type).toBe('CopilotSdkWrapper');
    });
  });

  describe('isProviderAvailable', () => {
    it('returns true if CopilotSdkWrapper.isAvailable returns true', () => {
      CopilotSdkWrapper.isAvailable = jest.fn(() => true);
      expect(isProviderAvailable('copilot')).toBe(true);
      expect(CopilotSdkWrapper.isAvailable).toHaveBeenCalled();
    });

    it('returns false if CopilotSdkWrapper.isAvailable returns false', () => {
      CopilotSdkWrapper.isAvailable = jest.fn(() => false);
      expect(isProviderAvailable('copilot')).toBe(false);
    });

    it('returns true if ClaudeProviderWrapper.isAvailable returns true', () => {
      ClaudeProviderWrapper.isAvailable = jest.fn(() => true);
      expect(isProviderAvailable('claude')).toBe(true);
      expect(ClaudeProviderWrapper.isAvailable).toHaveBeenCalled();
    });

    it('returns false if ClaudeProviderWrapper.isAvailable returns false', () => {
      ClaudeProviderWrapper.isAvailable = jest.fn(() => false);
      expect(isProviderAvailable('claude')).toBe(false);
    });

    it('defaults to CopilotSdkWrapper for unknown provider', () => {
      CopilotSdkWrapper.isAvailable = jest.fn(() => true);
      // @ts-expect-error
      expect(isProviderAvailable('unknown')).toBe(true);
      expect(CopilotSdkWrapper.isAvailable).toHaveBeenCalled();
    });
  });

  describe('Type definitions', () => {
    it('AIProvider allows only "copilot" or "claude"', () => {
      const validCopilot: AIProvider = 'copilot';
      const validClaude: AIProvider = 'claude';
      // @ts-expect-error
      const invalid: AIProvider = 'other';
      expect(validCopilot).toBe('copilot');
      expect(validClaude).toBe('claude');
    });

    it('ProviderWrapperOptions accepts all optional fields', () => {
      const opts: ProviderWrapperOptions = {
        model: 'gpt-4',
        timeout: 1000,
        workingDirectory: '/tmp',
        streaming: true,
        tools: [{ name: 'tool1' }],
      };
      expect(opts.model).toBe('gpt-4');
      expect(opts.timeout).toBe(1000);
      expect(opts.workingDirectory).toBe('/tmp');
      expect(opts.streaming).toBe(true);
      expect(Array.isArray(opts.tools)).toBe(true);
    });

    it('ProviderWrapper is assignable to any', () => {
      const wrapper: any = { foo: 123 };
      expect(wrapper.foo).toBe(123);
    });
  });
});
