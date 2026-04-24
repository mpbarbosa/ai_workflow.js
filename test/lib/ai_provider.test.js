import { jest } from '@jest/globals';

const MockCopilotSdkWrapper = jest.fn().mockImplementation((opts) => ({
  __type: 'CopilotSdkWrapper',
  opts,
}));

const MockClaudeProviderWrapper = jest.fn().mockImplementation((opts) => ({
  __type: 'ClaudeProviderWrapper',
  opts,
}));

MockCopilotSdkWrapper.isAvailable = jest.fn(() => true);
MockClaudeProviderWrapper.isAvailable = jest.fn(() => true);

jest.unstable_mockModule('../../src/lib/copilot_sdk_wrapper.js', () => ({
  CopilotSdkWrapper: MockCopilotSdkWrapper,
}));

jest.unstable_mockModule('../../src/lib/claude_sdk_wrapper.js', () => ({
  ClaudeProviderWrapper: MockClaudeProviderWrapper,
}));

const { createProviderWrapper, isProviderAvailable } = await import('../../src/lib/ai_provider.js');

describe('ai_provider', () => {
  beforeEach(() => {
    MockCopilotSdkWrapper.mockClear();
    MockClaudeProviderWrapper.mockClear();
    MockCopilotSdkWrapper.isAvailable.mockReset();
    MockClaudeProviderWrapper.isAvailable.mockReset();
    MockCopilotSdkWrapper.isAvailable.mockReturnValue(true);
    MockClaudeProviderWrapper.isAvailable.mockReturnValue(true);
  });

  describe('createProviderWrapper', () => {
    it('creates a CopilotSdkWrapper by default', () => {
      const wrapper = createProviderWrapper();

      expect(MockCopilotSdkWrapper).toHaveBeenCalledWith({
        model: undefined,
        timeout: undefined,
        workingDirectory: undefined,
      });
      expect(wrapper.__type).toBe('CopilotSdkWrapper');
    });

    it('creates a CopilotSdkWrapper with all options', () => {
      const opts = {
        model: 'gpt-4',
        timeout: 5000,
        workingDirectory: '/tmp',
        streaming: true,
        tools: ['tool1', 'tool2'],
      };

      const wrapper = createProviderWrapper('copilot', opts);

      expect(MockCopilotSdkWrapper).toHaveBeenCalledWith({
        model: 'gpt-4',
        timeout: 5000,
        workingDirectory: '/tmp',
        streaming: true,
        tools: ['tool1', 'tool2'],
      });
      expect(wrapper.__type).toBe('CopilotSdkWrapper');
    });

    it('does not include streaming/tools if not provided', () => {
      createProviderWrapper('copilot', { model: 'gpt-4' });

      expect(MockCopilotSdkWrapper).toHaveBeenCalledWith({
        model: 'gpt-4',
        timeout: undefined,
        workingDirectory: undefined,
      });
    });

    it('creates a ClaudeProviderWrapper when provider is claude', () => {
      const opts = {
        model: 'claude-3',
        timeout: 10000,
        workingDirectory: '/claude',
        streaming: true,
        tools: ['irrelevant'],
      };

      const wrapper = createProviderWrapper('claude', opts);

      expect(MockClaudeProviderWrapper).toHaveBeenCalledWith({
        model: 'claude-3',
        timeout: 10000,
        workingDirectory: '/claude',
      });
      expect(wrapper.__type).toBe('ClaudeProviderWrapper');
    });

    it('handles missing options gracefully', () => {
      const wrapper = createProviderWrapper('claude');

      expect(MockClaudeProviderWrapper).toHaveBeenCalledWith({
        model: undefined,
        timeout: undefined,
        workingDirectory: undefined,
      });
      expect(wrapper.__type).toBe('ClaudeProviderWrapper');
    });

    it('falls back to CopilotSdkWrapper for unknown provider', () => {
      const wrapper = createProviderWrapper('unknown', { model: 'x' });

      expect(MockCopilotSdkWrapper).toHaveBeenCalledWith({
        model: 'x',
        timeout: undefined,
        workingDirectory: undefined,
      });
      expect(wrapper.__type).toBe('CopilotSdkWrapper');
    });
  });

  describe('isProviderAvailable', () => {
    it('returns true if CopilotSdkWrapper.isAvailable returns true', () => {
      MockCopilotSdkWrapper.isAvailable.mockReturnValue(true);

      expect(isProviderAvailable('copilot')).toBe(true);
      expect(MockCopilotSdkWrapper.isAvailable).toHaveBeenCalled();
    });

    it('returns false if CopilotSdkWrapper.isAvailable returns false', () => {
      MockCopilotSdkWrapper.isAvailable.mockReturnValue(false);

      expect(isProviderAvailable('copilot')).toBe(false);
    });

    it('returns true if ClaudeProviderWrapper.isAvailable returns true', () => {
      MockClaudeProviderWrapper.isAvailable.mockReturnValue(true);

      expect(isProviderAvailable('claude')).toBe(true);
      expect(MockClaudeProviderWrapper.isAvailable).toHaveBeenCalled();
    });

    it('returns false if ClaudeProviderWrapper.isAvailable returns false', () => {
      MockClaudeProviderWrapper.isAvailable.mockReturnValue(false);

      expect(isProviderAvailable('claude')).toBe(false);
    });

    it('defaults to CopilotSdkWrapper for unknown provider', () => {
      MockCopilotSdkWrapper.isAvailable.mockReturnValue(true);

      expect(isProviderAvailable('unknown')).toBe(true);
      expect(MockCopilotSdkWrapper.isAvailable).toHaveBeenCalled();
    });
  });
});
