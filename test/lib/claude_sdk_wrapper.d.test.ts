import { ClaudeProviderWrapper, ProviderInitResult, ProviderSendResult, ClaudeProviderOptions } from '../../src/lib/claude_sdk_wrapper';

describe('ClaudeProviderWrapper', () => {
  let wrapper: ClaudeProviderWrapper;

  beforeEach(() => {
    wrapper = new ClaudeProviderWrapper();
  });

  describe('constructor', () => {
    it('should instantiate with default options', () => {
      expect(wrapper).toBeInstanceOf(ClaudeProviderWrapper);
    });

    it('should instantiate with custom options', () => {
      const opts: ClaudeProviderOptions = { model: 'claude-sonnet-4-6', timeout: 5000, workingDirectory: '/tmp' };
      const customWrapper = new ClaudeProviderWrapper(opts);
      expect(customWrapper).toBeInstanceOf(ClaudeProviderWrapper);
    });
  });

  describe('isAvailable', () => {
    it('should return a boolean indicating SDK availability', () => {
      const available = ClaudeProviderWrapper.isAvailable();
      expect(typeof available).toBe('boolean');
    });
  });

  describe('initialize', () => {
    it('should resolve with authenticated true and availableModels array', async () => {
      const result: ProviderInitResult = await wrapper.initialize();
      expect(result).toHaveProperty('authenticated', true);
      expect(Array.isArray(result.availableModels)).toBe(true);
    });
  });

  describe('send', () => {
    it('should reject if prompt is missing', async () => {
      // @ts-expect-error
      await expect(wrapper.send()).rejects.toBeDefined();
    });

    it('should resolve with a ProviderSendResult on valid prompt', async () => {
      // Mock _getInner and inner.send for isolation
      // @ts-ignore
      wrapper._getInner = jest.fn().mockResolvedValue({
        send: jest.fn().mockResolvedValue({ content: 'response', success: true })
      });
      const result: ProviderSendResult = await wrapper.send('Hello Claude');
      expect(result).toEqual({ content: 'response', success: true });
    });

    it('should handle timeout override', async () => {
      // @ts-ignore
      wrapper._getInner = jest.fn().mockResolvedValue({
        send: jest.fn().mockImplementation((prompt, timeout) => {
          return Promise.resolve({ content: `timeout:${timeout}`, success: true });
        })
      });
      const result: ProviderSendResult = await wrapper.send('Test', 1234);
      expect(result.content).toContain('timeout:1234');
      expect(result.success).toBe(true);
    });

    it('should propagate errors from inner SDK', async () => {
      // @ts-ignore
      wrapper._getInner = jest.fn().mockRejectedValue(new Error('SDK error'));
      await expect(wrapper.send('fail')).rejects.toThrow('SDK error');
    });
  });

  describe('recreateSession', () => {
    it('should resolve as a no-op', async () => {
      await expect(wrapper.recreateSession()).resolves.toBeUndefined();
    });
  });

  describe('cleanup', () => {
    it('should resolve as a no-op', async () => {
      await expect(wrapper.cleanup()).resolves.toBeUndefined();
    });
  });
});
