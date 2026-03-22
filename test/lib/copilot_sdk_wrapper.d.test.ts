// test/copilot_sdk_wrapper.test.ts

import { CopilotSdkWrapper, CopilotSdkWrapperOptions, InitializeResult, SendResult, ResumeSessionConfig } from '../lib/copilot_sdk_wrapper.d.ts';

describe('CopilotSdkWrapper', () => {
  let wrapper: CopilotSdkWrapper;

  beforeEach(() => {
    wrapper = new CopilotSdkWrapper({
      model: 'claude-sonnet-4.5',
      timeout: 5000,
      workingDirectory: '/tmp',
    });
  });

  describe('constructor', () => {
    it('should instantiate with default options', () => {
      const w = new CopilotSdkWrapper();
      expect(w).toBeInstanceOf(CopilotSdkWrapper);
    });

    it('should instantiate with provided options', () => {
      expect(wrapper).toBeInstanceOf(CopilotSdkWrapper);
      expect(wrapper.authenticated).toBe(false);
      expect(wrapper.availableModels).toEqual([]);
    });
  });

  describe('static isAvailable', () => {
    it('should return true if SDK is available', () => {
      expect(CopilotSdkWrapper.isAvailable()).toBe(true);
    });
  });

  describe('client and session getters', () => {
    it('should return null before initialization', () => {
      expect(wrapper.client).toBeNull();
      expect(wrapper.session).toBeNull();
    });
  });

  describe('initialize', () => {
    it('should initialize and authenticate the client', async () => {
      const result: InitializeResult = await wrapper.initialize();
      expect(result.authenticated).toBe(true);
      expect(Array.isArray(result.availableModels)).toBe(true);
      expect(wrapper.authenticated).toBe(true);
      expect(wrapper.availableModels).toEqual(result.availableModels);
      expect(wrapper.client).not.toBeNull();
      expect(wrapper.session).not.toBeNull();
    });

    it('should handle authentication failure and cleanup', async () => {
      // Simulate failure by passing invalid model
      const badWrapper = new CopilotSdkWrapper({ model: 'invalid-model' });
      await expect(badWrapper.initialize()).rejects.toThrow();
      expect(badWrapper.client).toBeNull();
      expect(badWrapper.session).toBeNull();
    });
  });

  describe('send', () => {
    beforeEach(async () => {
      await wrapper.initialize();
    });

    it('should send a prompt and return a successful response', async () => {
      const result: SendResult = await wrapper.send('Hello, Copilot!');
      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('success', true);
    });

    it('should handle timeout override', async () => {
      const result: SendResult = await wrapper.send('Test timeout', 100);
      expect(result.success).toBe(true);
    });

    it('should serialize concurrent sends', async () => {
      const p1 = wrapper.send('Prompt 1');
      const p2 = wrapper.send('Prompt 2');
      const [r1, r2] = await Promise.all([p1, p2]);
      expect(r1.success).toBe(true);
      expect(r2.success).toBe(true);
    });

    it('should throw SystemError if no active session', async () => {
      await wrapper.cleanup();
      await expect(wrapper.send('No session')).rejects.toThrow();
    });
  });

  describe('abort', () => {
    beforeEach(async () => {
      await wrapper.initialize();
    });

    it('should abort in-flight request gracefully', async () => {
      await expect(wrapper.abort()).resolves.toBeUndefined();
    });

    it('should handle abort when no session exists', async () => {
      await wrapper.cleanup();
      await expect(wrapper.abort()).resolves.toBeUndefined();
    });
  });

  describe('recreateSession', () => {
    beforeEach(async () => {
      await wrapper.initialize();
    });

    it('should destroy and recreate session', async () => {
      const oldSession = wrapper.session;
      await wrapper.recreateSession();
      expect(wrapper.session).not.toBeNull();
      expect(wrapper.session).not.toBe(oldSession);
    });

    it('should handle error during session recreation', async () => {
      // Simulate error by cleaning up before recreation
      await wrapper.cleanup();
      await expect(wrapper.recreateSession()).rejects.toThrow();
    });
  });

  describe('cleanup', () => {
    beforeEach(async () => {
      await wrapper.initialize();
    });

    it('should cleanup session and client gracefully', async () => {
      await expect(wrapper.cleanup()).resolves.toBeUndefined();
      expect(wrapper.client).toBeNull();
      expect(wrapper.session).toBeNull();
    });

    it('should handle cleanup when already cleaned up', async () => {
      await wrapper.cleanup();
      await expect(wrapper.cleanup()).resolves.toBeUndefined();
    });

    it('should handle error during session destroy and still stop client', async () => {
      // Simulate error by forcing session to throw
      wrapper['_session'] = { destroy: () => { throw new Error('Destroy failed'); } } as any;
      await expect(wrapper.cleanup()).resolves.toBeUndefined();
      expect(wrapper.client).toBeNull();
    });
  });
});

// ==============================================================================
// v0.5.1 — ResumeSessionConfig type is re-exported from the wrapper
// ==============================================================================

describe('copilot_sdk_wrapper — v0.5.1 ResumeSessionConfig re-export', () => {
  it('should accept a ResumeSessionConfig-shaped object', () => {
    // ResumeSessionConfig is a type alias for @github/copilot-sdk's type.
    // We verify the import compiles and the shape is structurally assignable.
    const config: ResumeSessionConfig = {};
    expect(config).toBeDefined();
  });
});
