import { jest } from '@jest/globals';
import { ClaudeProviderWrapper } from '../../src/lib/claude_sdk_wrapper.js';

describe('ClaudeProviderWrapper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('sets options and default timeout', () => {
      const wrapper = new ClaudeProviderWrapper({ model: 'claude-3' });
      expect(wrapper._opts).toEqual({ model: 'claude-3' });
      expect(wrapper._timeout).toBe(120000);
    });

    it('uses provided timeout', () => {
      const wrapper = new ClaudeProviderWrapper({ timeout: 5000 });
      expect(wrapper._timeout).toBe(5000);
    });
  });

  describe('isAvailable', () => {
    it('returns a boolean', () => {
      expect(typeof ClaudeProviderWrapper.isAvailable()).toBe('boolean');
    });

    it('logs the probe failure reason when SDK availability check throws', async () => {
      const debug = jest.fn();

      await jest.isolateModulesAsync(async () => {
        jest.unstable_mockModule('module', () => ({
          createRequire: () => () => {
            throw new Error('missing sdk');
          },
        }));
        jest.unstable_mockModule('../../src/core/logger.js', () => ({
          logger: { debug },
        }));

        const { ClaudeProviderWrapper: IsolatedClaudeProviderWrapper } = await import(
          '../../src/lib/claude_sdk_wrapper.js'
        );

        expect(IsolatedClaudeProviderWrapper.isAvailable()).toBe(false);
      });

      expect(debug).toHaveBeenCalledWith('Claude SDK availability check failed: missing sdk');
      jest.resetModules();
    });
  });

  describe('_getInner', () => {
    it('returns the cached inner SDK when already initialized', async () => {
      const wrapper = new ClaudeProviderWrapper();
      const inner = { run: jest.fn() };
      wrapper._inner = inner;

      await expect(wrapper._getInner()).resolves.toBe(inner);
    });
  });

  describe('initialize', () => {
    it('always resolves with authenticated true and empty availableModels', async () => {
      const wrapper = new ClaudeProviderWrapper();
      await expect(wrapper.initialize()).resolves.toEqual({
        authenticated: true,
        availableModels: [],
      });
    });
  });

  describe('send', () => {
    it('returns assistant response on success', async () => {
      const run = jest.fn().mockResolvedValue({ content: 'hi', success: true });
      const wrapper = new ClaudeProviderWrapper({ model: 'claude-3' });
      wrapper._inner = { run };

      await expect(wrapper.send('hello')).resolves.toEqual({ content: 'hi', success: true });
      expect(run).toHaveBeenCalledWith('hello');
    });

    it('uses timeoutMs override', async () => {
      const run = jest.fn(
        () =>
          new Promise((resolve) => setTimeout(() => resolve({ content: 'ok', success: true }), 10))
      );
      const wrapper = new ClaudeProviderWrapper({ timeout: 100 });
      wrapper._inner = { run };

      await expect(wrapper.send('test', 5)).rejects.toThrow(/timeout/i);
    });

    it('throws if inner.run rejects', async () => {
      const run = jest.fn().mockRejectedValue(new Error('run failed'));
      const wrapper = new ClaudeProviderWrapper();
      wrapper._inner = { run };

      await expect(wrapper.send('fail')).rejects.toThrow('run failed');
    });

    it('clears timeout after completion', async () => {
      jest.useFakeTimers();
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
      const run = jest.fn().mockResolvedValue({ content: 'done', success: true });
      const wrapper = new ClaudeProviderWrapper({ timeout: 50 });
      wrapper._inner = { run };

      const sendPromise = wrapper.send('foo');
      await Promise.resolve();
      jest.runAllTimers();
      await expect(sendPromise).resolves.toEqual({ content: 'done', success: true });
      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });

  describe('recreateSession', () => {
    it('is a no-op', async () => {
      const wrapper = new ClaudeProviderWrapper();
      await expect(wrapper.recreateSession()).resolves.toBeUndefined();
    });
  });

  describe('cleanup', () => {
    it('is a no-op', async () => {
      const wrapper = new ClaudeProviderWrapper();
      await expect(wrapper.cleanup()).resolves.toBeUndefined();
    });
  });
});
