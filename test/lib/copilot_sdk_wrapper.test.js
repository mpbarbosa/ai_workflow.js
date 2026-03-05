/**
 * Tests for CopilotSdkWrapper
 *
 * Source: src/lib/copilot_sdk_wrapper.ts (TypeScript)
 * Compiled: src/lib/copilot_sdk_wrapper.js (runtime import target)
 *
 * @jest-environment node
 */

import { jest } from '@jest/globals';
import { SystemError } from '../../src/utils/errors.js';

// ---------------------------------------------------------------------------
// Mock @github/copilot-sdk BEFORE importing the module under test so Jest's
// module registry resolves the mock for the wrapper's static import.
// ---------------------------------------------------------------------------

const mockSession = {
  sendAndWait: jest.fn(),
  destroy: jest.fn(),
  abort: jest.fn(),
  on: jest.fn(),
};

const mockClient = {
  start: jest.fn(),
  stop: jest.fn(),
  forceStop: jest.fn(),
  getAuthStatus: jest.fn(),
  listModels: jest.fn(),
  createSession: jest.fn(),
};

jest.unstable_mockModule('@github/copilot-sdk', () => ({
  CopilotClient: jest.fn(() => mockClient),
  defineTool: jest.fn(),
}));

// Import the wrapper AFTER mocking the SDK
const { CopilotSdkWrapper } = await import('../../src/lib/copilot_sdk_wrapper.js');
// Also import the mocked CopilotClient so we can override behaviour per-test
const { CopilotClient: MockCopilotClient } = await import('@github/copilot-sdk');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeWrapper(overrides = {}) {
  return new CopilotSdkWrapper({
    model: 'gpt-4',
    timeout: 30_000,
    workingDirectory: null,
    ...overrides,
  });
}

function resetMocks() {
  jest.clearAllMocks();
  mockClient.start.mockResolvedValue(undefined);
  mockClient.stop.mockResolvedValue(undefined);
  mockClient.forceStop.mockResolvedValue(undefined);
  mockClient.getAuthStatus.mockResolvedValue({ isAuthenticated: true });
  mockClient.listModels.mockResolvedValue([{ id: 'gpt-4' }, { id: 'gpt-4o' }]);
  mockClient.createSession.mockResolvedValue(mockSession);
  mockSession.sendAndWait.mockResolvedValue({ data: { content: 'hello', success: true } });
  mockSession.destroy.mockResolvedValue(undefined);
  mockSession.abort.mockResolvedValue(undefined);
  mockSession.on.mockReturnValue(() => {}); // returns unsubscribe fn
}

// ==============================================================================
// CopilotSdkWrapper.isAvailable — static
// ==============================================================================

describe('CopilotSdkWrapper.isAvailable (static)', () => {
  test('returns true when CopilotClient can be instantiated', () => {
    // The mock always returns mockClient
    expect(CopilotSdkWrapper.isAvailable()).toBe(true);
  });

  test('returns false when CopilotClient constructor throws', () => {
    MockCopilotClient.mockImplementationOnce(() => { throw new Error('SDK unavailable'); });
    expect(CopilotSdkWrapper.isAvailable()).toBe(false);
  });
});

// ==============================================================================
// Getters
// ==============================================================================

describe('CopilotSdkWrapper — getters', () => {
  test('initial state: client, session null; authenticated false', () => {
    const wrapper = makeWrapper();
    expect(wrapper.client).toBeNull();
    expect(wrapper.session).toBeNull();
    expect(wrapper.authenticated).toBe(false);
    expect(wrapper.availableModels).toEqual([]);
  });

  test('default options used when constructed with no arguments', () => {
    const wrapper = new CopilotSdkWrapper();
    expect(wrapper.client).toBeNull();
    expect(wrapper.authenticated).toBe(false);
  });
});

// ==============================================================================
// initialize()
// ==============================================================================

describe('CopilotSdkWrapper — initialize()', () => {
  beforeEach(resetMocks);

  test('happy path: returns authenticated=true and models', async () => {
    const wrapper = makeWrapper();
    const result = await wrapper.initialize();

    expect(mockClient.start).toHaveBeenCalledTimes(1);
    expect(mockClient.getAuthStatus).toHaveBeenCalledTimes(1);
    expect(mockClient.listModels).toHaveBeenCalledTimes(1);
    expect(mockClient.createSession).toHaveBeenCalledWith({ model: 'gpt-4' });
    expect(result.authenticated).toBe(true);
    expect(result.availableModels).toEqual([{ id: 'gpt-4' }, { id: 'gpt-4o' }]);
    expect(wrapper.session).toBe(mockSession);
  });

  test('unauthenticated: no session created, returns authenticated=false', async () => {
    mockClient.getAuthStatus.mockResolvedValue({ isAuthenticated: false });
    const wrapper = makeWrapper();
    const result = await wrapper.initialize();

    expect(result.authenticated).toBe(false);
    expect(mockClient.createSession).not.toHaveBeenCalled();
    expect(wrapper.session).toBeNull();
  });

  test('workingDirectory is forwarded to createSession', async () => {
    const wrapper = makeWrapper({ workingDirectory: '/tmp/project' });
    await wrapper.initialize();

    expect(mockClient.createSession).toHaveBeenCalledWith({
      model: 'gpt-4',
      workingDirectory: '/tmp/project',
    });
  });

  test('cookbook: client.stop() called and client nulled when auth step throws', async () => {
    mockClient.getAuthStatus.mockRejectedValue(new Error('auth failed'));
    const wrapper = makeWrapper();

    await expect(wrapper.initialize()).rejects.toThrow('auth failed');

    // Cookbook: no orphaned client process
    expect(mockClient.stop).toHaveBeenCalledTimes(1);
    expect(wrapper.client).toBeNull();
  });

  test('cookbook: client.stop() called when createSession throws', async () => {
    mockClient.createSession.mockRejectedValue(new Error('session failed'));
    const wrapper = makeWrapper();

    await expect(wrapper.initialize()).rejects.toThrow('session failed');

    expect(mockClient.stop).toHaveBeenCalledTimes(1);
    expect(wrapper.client).toBeNull();
  });

  test('cookbook: error thrown when both auth and stop() fail; stop error is swallowed', async () => {
    mockClient.getAuthStatus.mockRejectedValue(new Error('auth failed'));
    mockClient.stop.mockRejectedValue(new Error('stop also failed'));
    const wrapper = makeWrapper();

    await expect(wrapper.initialize()).rejects.toThrow('auth failed');
    expect(wrapper.client).toBeNull();
  });

  test('listModels failure is non-fatal; session is still created', async () => {
    mockClient.listModels.mockRejectedValue(new Error('models unavailable'));
    const wrapper = makeWrapper();
    const result = await wrapper.initialize();

    expect(result.authenticated).toBe(true);
    expect(wrapper.session).toBe(mockSession);
  });

  test('nullish getAuthStatus response treated as unauthenticated', async () => {
    mockClient.getAuthStatus.mockResolvedValue({});
    const wrapper = makeWrapper();
    const result = await wrapper.initialize();

    expect(result.authenticated).toBe(false);
  });
});

// ==============================================================================
// send()
// ==============================================================================

describe('CopilotSdkWrapper — send()', () => {
  beforeEach(resetMocks);

  test('throws SystemError when no session exists', async () => {
    const wrapper = makeWrapper();
    await expect(wrapper.send('hello')).rejects.toBeInstanceOf(SystemError);
  });

  test('returns response data from sendAndWait', async () => {
    const wrapper = makeWrapper();
    await wrapper.initialize();

    const result = await wrapper.send('test prompt', 5_000);

    expect(mockSession.sendAndWait).toHaveBeenCalledWith({ prompt: 'test prompt' }, 5_000);
    expect(result).toEqual({ content: 'hello', success: true });
  });

  test('uses default timeout when not specified', async () => {
    const wrapper = makeWrapper({ timeout: 12_000 });
    await wrapper.initialize();
    await wrapper.send('hi');

    expect(mockSession.sendAndWait).toHaveBeenCalledWith({ prompt: 'hi' }, 12_000);
  });

  test('falls back to empty response when sendAndWait returns null', async () => {
    mockSession.sendAndWait.mockResolvedValue(null);
    const wrapper = makeWrapper();
    await wrapper.initialize();

    const result = await wrapper.send('hi');
    expect(result).toEqual({ content: '', success: false });
  });

  test('serialises concurrent send() calls', async () => {
    const order = [];
    mockSession.sendAndWait
      .mockImplementationOnce(async () => {
        order.push(1);
        return { data: { content: 'first' } };
      })
      .mockImplementationOnce(async () => {
        order.push(2);
        return { data: { content: 'second' } };
      });

    const wrapper = makeWrapper();
    await wrapper.initialize();

    const [r1, r2] = await Promise.all([wrapper.send('a'), wrapper.send('b')]);

    expect(order).toEqual([1, 2]);
    expect(r1.content).toBe('first');
    expect(r2.content).toBe('second');
  });

  test('queue catch swallowed when sendAndWait throws; subsequent send still works', async () => {
    mockSession.sendAndWait
      .mockRejectedValueOnce(new Error('send failed'))
      .mockResolvedValue({ data: { content: 'ok', success: true } });
    const wrapper = makeWrapper();
    await wrapper.initialize();

    await expect(wrapper.send('fail')).rejects.toThrow('send failed');
    const result = await wrapper.send('recover');
    expect(result.content).toBe('ok');
  });
});

// ==============================================================================
// abort()
// ==============================================================================

describe('CopilotSdkWrapper — abort()', () => {
  beforeEach(resetMocks);

  test('calls session.abort() when session exists', async () => {
    const wrapper = makeWrapper();
    await wrapper.initialize();
    await wrapper.abort();
    expect(mockSession.abort).toHaveBeenCalledTimes(1);
  });

  test('does nothing when no session exists', async () => {
    const wrapper = makeWrapper();
    await expect(wrapper.abort()).resolves.toBeUndefined();
    expect(mockSession.abort).not.toHaveBeenCalled();
  });

  test('does nothing when session has no abort method', async () => {
    const wrapper = makeWrapper();
    await wrapper.initialize();
    wrapper._session = { destroy: jest.fn() }; // no abort method
    await expect(wrapper.abort()).resolves.toBeUndefined();
  });

  test('abort error is swallowed when session.abort() throws', async () => {
    mockSession.abort.mockRejectedValue(new Error('abort failed'));
    const wrapper = makeWrapper();
    await wrapper.initialize();
    await expect(wrapper.abort()).resolves.toBeUndefined();
  });
});

// ==============================================================================
// recreateSession()
// ==============================================================================

describe('CopilotSdkWrapper — recreateSession()', () => {
  beforeEach(resetMocks);

  test('destroys session, restarts client, creates new session', async () => {
    const wrapper = makeWrapper();
    await wrapper.initialize();

    const newSession = { sendAndWait: jest.fn(), destroy: jest.fn() };
    mockClient.createSession.mockResolvedValue(newSession);

    await wrapper.recreateSession();

    expect(mockSession.destroy).toHaveBeenCalledTimes(1);
    expect(mockClient.stop).toHaveBeenCalledTimes(1);
    expect(mockClient.start).toHaveBeenCalledTimes(2); // once in initialize, once in recreate
    expect(wrapper.session).toBe(newSession);
  });

  test('session.destroy() error is swallowed; restart continues', async () => {
    mockSession.destroy.mockRejectedValue(new Error('destroy failed'));
    const wrapper = makeWrapper();
    await wrapper.initialize();

    await expect(wrapper.recreateSession()).resolves.toBeUndefined();
    expect(mockClient.stop).toHaveBeenCalledTimes(1);
  });

  test('stop() error is swallowed during recreateSession; restart continues', async () => {
    mockClient.stop.mockRejectedValue(new Error('stop failed'));
    const wrapper = makeWrapper();
    await wrapper.initialize();

    await expect(wrapper.recreateSession()).resolves.toBeUndefined();
    expect(mockClient.start).toHaveBeenCalledTimes(2); // once in initialize, once in recreate
  });

  test('workingDirectory is forwarded to createSession when recreating', async () => {
    const wrapper = makeWrapper({ workingDirectory: '/tmp/wd' });
    await wrapper.initialize();

    const newSession = { sendAndWait: jest.fn(), destroy: jest.fn() };
    mockClient.createSession.mockResolvedValue(newSession);
    await wrapper.recreateSession();

    expect(mockClient.createSession).toHaveBeenLastCalledWith(
      expect.objectContaining({ workingDirectory: '/tmp/wd' })
    );
  });
});

// ==============================================================================
// cleanup()
// ==============================================================================

describe('CopilotSdkWrapper — cleanup()', () => {
  beforeEach(resetMocks);

  test('destroys session and stops client in happy path', async () => {
    const wrapper = makeWrapper();
    await wrapper.initialize();
    await wrapper.cleanup();

    expect(mockSession.destroy).toHaveBeenCalledTimes(1);
    expect(mockClient.stop).toHaveBeenCalledTimes(1);
    expect(wrapper.session).toBeNull();
    expect(wrapper.client).toBeNull();
  });

  test('cookbook try-finally: client.stop() called even when session.destroy() throws', async () => {
    mockSession.destroy.mockRejectedValue(new Error('session exploded'));
    const wrapper = makeWrapper();
    await wrapper.initialize();

    // cleanup() must not throw — session.destroy errors are caught internally
    await expect(wrapper.cleanup()).resolves.toBeUndefined();
    expect(mockClient.stop).toHaveBeenCalledTimes(1);
  });

  test('cookbook forceStop: called when client.stop() times out', async () => {
    jest.useFakeTimers();
    // Make client.stop() never resolve
    mockClient.stop.mockImplementation(() => new Promise(() => {}));

    const wrapper = makeWrapper();
    await wrapper.initialize();

    const cleanupPromise = wrapper.cleanup();
    // Advance past FORCE_STOP_TIMEOUT_MS (5000 ms) and flush pending promises
    await jest.advanceTimersByTimeAsync(6_000);
    await cleanupPromise;

    expect(mockClient.forceStop).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  test('cookbook forceStop: forceStop() error is swallowed', async () => {
    jest.useFakeTimers();
    mockClient.stop.mockImplementation(() => new Promise(() => {}));
    mockClient.forceStop.mockRejectedValue(new Error('forceStop failed'));

    const wrapper = makeWrapper();
    await wrapper.initialize();

    const cleanupPromise = wrapper.cleanup();
    await jest.advanceTimersByTimeAsync(6_000);
    await expect(cleanupPromise).resolves.toBeUndefined();
    jest.useRealTimers();
  });

  test('no-op when wrapper was never initialized', async () => {
    const wrapper = makeWrapper();
    await expect(wrapper.cleanup()).resolves.toBeUndefined();
    expect(mockClient.stop).not.toHaveBeenCalled();
  });
});

// ==============================================================================
// CopilotSdkWrapper — streaming (constructor flag + sendStream)
// ==============================================================================

describe('CopilotSdkWrapper — streaming: createSession flag', () => {
  beforeEach(resetMocks);

  test('createSession called without streaming when streaming=false (default)', async () => {
    const wrapper = makeWrapper();
    await wrapper.initialize();
    expect(mockClient.createSession).toHaveBeenCalledWith(
      expect.not.objectContaining({ streaming: true })
    );
  });

  test('createSession called with streaming:true when streaming=true', async () => {
    const wrapper = makeWrapper({ streaming: true });
    await wrapper.initialize();
    expect(mockClient.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ streaming: true })
    );
  });

  test('recreateSession preserves streaming:true', async () => {
    const wrapper = makeWrapper({ streaming: true });
    await wrapper.initialize();
    mockClient.createSession.mockClear();
    await wrapper.recreateSession();
    expect(mockClient.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ streaming: true })
    );
  });

  test('recreateSession does not set streaming when streaming=false', async () => {
    const wrapper = makeWrapper({ streaming: false });
    await wrapper.initialize();
    mockClient.createSession.mockClear();
    await wrapper.recreateSession();
    expect(mockClient.createSession).toHaveBeenCalledWith(
      expect.not.objectContaining({ streaming: true })
    );
  });
});

describe('CopilotSdkWrapper — sendStream', () => {
  beforeEach(resetMocks);

  test('throws SystemError when session is not initialised', async () => {
    const wrapper = makeWrapper({ streaming: true });
    await expect(wrapper.sendStream('hello', () => {})).rejects.toThrow('No active session');
  });

  test('delivers delta chunks to onChunk callback', async () => {
    const wrapper = makeWrapper({ streaming: true });
    await wrapper.initialize();

    // Simulate session.on registering a handler that we invoke manually
    let deltaHandler = null;
    mockSession.on.mockImplementation((eventType, handler) => {
      if (eventType === 'assistant.message_delta') deltaHandler = handler;
      return () => {};
    });
    mockSession.sendAndWait.mockImplementation(async () => {
      // Fire two delta events before resolving
      deltaHandler?.({ data: { deltaContent: 'Hello' } });
      deltaHandler?.({ data: { deltaContent: ' world' } });
      return { data: { content: 'Hello world', success: true } };
    });

    const chunks = [];
    const result = await wrapper.sendStream('prompt', (chunk) => chunks.push(chunk));

    expect(chunks).toEqual(['Hello', ' world']);
    expect(result).toEqual({ content: 'Hello world', success: true });
  });

  test('unsubscribes delta listener after successful call', async () => {
    const wrapper = makeWrapper({ streaming: true });
    await wrapper.initialize();

    const unsubscribe = jest.fn();
    mockSession.on.mockReturnValue(unsubscribe);
    mockSession.sendAndWait.mockResolvedValue({ data: { content: 'ok', success: true } });

    await wrapper.sendStream('prompt', () => {});
    expect(unsubscribe).toHaveBeenCalled();
  });

  test('unsubscribes delta listener even when sendAndWait throws', async () => {
    const wrapper = makeWrapper({ streaming: true });
    await wrapper.initialize();

    const unsubscribe = jest.fn();
    mockSession.on.mockReturnValue(unsubscribe);
    mockSession.sendAndWait.mockRejectedValue(new Error('timeout'));

    await expect(wrapper.sendStream('prompt', () => {})).rejects.toThrow('timeout');
    expect(unsubscribe).toHaveBeenCalled();
  });

  test('returns assembled content fallback when event.data is null', async () => {
    const wrapper = makeWrapper({ streaming: true });
    await wrapper.initialize();

    let deltaHandler = null;
    mockSession.on.mockImplementation((eventType, handler) => {
      if (eventType === 'assistant.message_delta') deltaHandler = handler;
      return () => {};
    });
    mockSession.sendAndWait.mockImplementation(async () => {
      deltaHandler?.({ data: { deltaContent: 'chunk1' } });
      deltaHandler?.({ data: { deltaContent: 'chunk2' } });
      return null; // SDK returns null
    });

    const result = await wrapper.sendStream('prompt', () => {});
    expect(result).toEqual({ content: 'chunk1chunk2', success: true });
  });

  test('serialises concurrent sendStream calls', async () => {
    const wrapper = makeWrapper({ streaming: true });
    await wrapper.initialize();

    mockSession.on.mockReturnValue(() => {});
    const order = [];
    mockSession.sendAndWait
      .mockImplementationOnce(async () => { order.push(1); return { data: { content: 'a', success: true } }; })
      .mockImplementationOnce(async () => { order.push(2); return { data: { content: 'b', success: true } }; });

    await Promise.all([
      wrapper.sendStream('p1', () => {}),
      wrapper.sendStream('p2', () => {}),
    ]);

    expect(order).toEqual([1, 2]);
  });
});

// ==============================================================================
// CopilotSdkWrapper — tools option
// ==============================================================================

describe('CopilotSdkWrapper — tools: createSession flag', () => {
  beforeEach(resetMocks);

  test('createSession called without tools when tools is empty (default)', async () => {
    const wrapper = makeWrapper();
    await wrapper.initialize();
    expect(mockClient.createSession).toHaveBeenCalledWith(
      expect.not.objectContaining({ tools: expect.anything() })
    );
  });

  test('createSession called with tools when tools array is provided', async () => {
    const mockTool = { name: 'read_file', handler: jest.fn() };
    const wrapper = makeWrapper({ tools: [mockTool] });
    await wrapper.initialize();
    expect(mockClient.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ tools: [mockTool] })
    );
  });

  test('recreateSession preserves tools', async () => {
    const mockTool = { name: 'list_files', handler: jest.fn() };
    const wrapper = makeWrapper({ tools: [mockTool] });
    await wrapper.initialize();
    mockClient.createSession.mockClear();
    await wrapper.recreateSession();
    expect(mockClient.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ tools: [mockTool] })
    );
  });

  test('recreateSession does not set tools when tools is empty', async () => {
    const wrapper = makeWrapper({ tools: [] });
    await wrapper.initialize();
    mockClient.createSession.mockClear();
    await wrapper.recreateSession();
    expect(mockClient.createSession).toHaveBeenCalledWith(
      expect.not.objectContaining({ tools: expect.anything() })
    );
  });
});
