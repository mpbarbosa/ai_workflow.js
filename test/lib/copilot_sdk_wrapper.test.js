/**
 * Tests for CopilotSdkWrapper
 *
 * Source: src/lib/copilot_sdk_wrapper.ts (TypeScript)
 * Compiled: src/lib/copilot_sdk_wrapper.js (runtime import target)
 *
 * The wrapper re-exports CopilotSdkWrapper from olinda_copilot_sdk.ts v0.5.1.
 * That package's implementation uses @github/copilot-sdk internally, so we
 * mock @github/copilot-sdk to control the underlying SDK behaviour in tests.
 * SystemError is also imported from olinda_copilot_sdk.ts because that is
 * the error class thrown by the wrapper.
 *
 * @jest-environment node
 */

import { jest } from '@jest/globals';

// ---------------------------------------------------------------------------
// Mock @github/copilot-sdk BEFORE importing the module under test so Jest's
// module registry resolves the mock for olinda_copilot_sdk.ts's static import.
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
  approveAll: jest.fn(),
}));

// Import the wrapper AFTER mocking the SDK
const { CopilotSdkWrapper, approveAll } = await import('../../src/lib/copilot_sdk_wrapper.js');
// Also import the mocked CopilotClient and defineTool so we can inspect calls per-test
const { CopilotClient: MockCopilotClient } = await import('@github/copilot-sdk');
// SystemError comes from olinda_copilot_sdk.ts (it is the package's own error class)
const { SystemError } = await import('olinda_copilot_sdk.ts');

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
    MockCopilotClient.mockImplementationOnce(() => {
      throw new Error('SDK unavailable');
    });
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
    expect(mockClient.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gpt-4' })
    );
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

    expect(mockClient.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gpt-4', workingDirectory: '/tmp/project' })
    );
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
// CopilotSdkWrapper — removed SDK features (regression)
// Guards against re-introduction of features that do not exist in the SDK.
// ==============================================================================

describe('CopilotSdkWrapper — removed SDK features (regression)', () => {
  beforeEach(resetMocks);

  test('[unit] createSession is called WITH onPermissionRequest', async () => {
    const wrapper = makeWrapper();
    await wrapper.initialize();
    expect(mockClient.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ onPermissionRequest: expect.anything() })
    );
  });

  test('[unit] createSession is called WITHOUT streaming', async () => {
    const wrapper = makeWrapper();
    await wrapper.initialize();
    expect(mockClient.createSession).toHaveBeenCalledWith(
      expect.not.objectContaining({ streaming: expect.anything() })
    );
  });

  test('[unit] createSession is called WITHOUT tools', async () => {
    const wrapper = makeWrapper();
    await wrapper.initialize();
    expect(mockClient.createSession).toHaveBeenCalledWith(
      expect.not.objectContaining({ tools: expect.anything() })
    );
  });

  test('[unit] sendStream method exists on the wrapper instance', () => {
    const wrapper = makeWrapper();
    expect(typeof wrapper.sendStream).toBe('function');
  });

  test('[unit] constructor ignores streaming option without throwing', () => {
    expect(() => makeWrapper({ streaming: true })).not.toThrow();
  });

  test('[unit] constructor ignores tools option without throwing', () => {
    const mockTool = { name: 'read_file', handler: jest.fn() };
    expect(() => makeWrapper({ tools: [mockTool] })).not.toThrow();
  });

  test('[unit] recreateSession called WITH onPermissionRequest', async () => {
    const wrapper = makeWrapper();
    await wrapper.initialize();
    mockClient.createSession.mockClear();
    await wrapper.recreateSession();
    expect(mockClient.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ onPermissionRequest: expect.anything() })
    );
  });

  test('[unit] recreateSession called WITHOUT streaming', async () => {
    const wrapper = makeWrapper();
    await wrapper.initialize();
    mockClient.createSession.mockClear();
    await wrapper.recreateSession();
    expect(mockClient.createSession).toHaveBeenCalledWith(
      expect.not.objectContaining({ streaming: expect.anything() })
    );
  });

  test('[unit] recreateSession called WITHOUT tools', async () => {
    const wrapper = makeWrapper();
    await wrapper.initialize();
    mockClient.createSession.mockClear();
    await wrapper.recreateSession();
    expect(mockClient.createSession).toHaveBeenCalledWith(
      expect.not.objectContaining({ tools: expect.anything() })
    );
  });
});

// ==============================================================================
// CopilotSdkWrapper — initialize() + send() lifecycle (integration)
// Validates the streamlined session lifecycle after removing unused SDK features.
// ==============================================================================

describe('CopilotSdkWrapper — initialize() + send() lifecycle', () => {
  beforeEach(resetMocks);

  test('[integration] full lifecycle: initialize → send → cleanup succeeds', async () => {
    const wrapper = makeWrapper();
    await wrapper.initialize();

    const result = await wrapper.send('hello');

    await wrapper.cleanup();

    expect(result).toEqual({ content: 'hello', success: true });
    expect(wrapper.session).toBeNull();
    expect(wrapper.client).toBeNull();
  });

  test('[integration] createSession receives model and onPermissionRequest when no workingDirectory', async () => {
    const wrapper = makeWrapper();
    await wrapper.initialize();

    const sessionConfig = mockClient.createSession.mock.calls[0][0];
    expect(sessionConfig).toMatchObject({ model: 'gpt-4', onPermissionRequest: expect.anything() });
    expect(sessionConfig.workingDirectory).toBeUndefined();
  });

  test('[integration] createSession receives model + workingDirectory + onPermissionRequest when provided', async () => {
    const wrapper = makeWrapper({ workingDirectory: '/repo' });
    await wrapper.initialize();

    const sessionConfig = mockClient.createSession.mock.calls[0][0];
    expect(sessionConfig).toMatchObject({
      model: 'gpt-4',
      workingDirectory: '/repo',
      onPermissionRequest: expect.anything(),
    });
  });

  test('[integration] recreateSession also sends model + workingDirectory + onPermissionRequest', async () => {
    const wrapper = makeWrapper({ workingDirectory: '/repo' });
    await wrapper.initialize();
    mockClient.createSession.mockClear();
    await wrapper.recreateSession();

    const sessionConfig = mockClient.createSession.mock.calls[0][0];
    expect(sessionConfig).toMatchObject({
      model: 'gpt-4',
      workingDirectory: '/repo',
      onPermissionRequest: expect.anything(),
    });
  });
});

// ==============================================================================
// CopilotSdkWrapper — functional contract
// Validates correctness of send queue, sendStream, and cleanup.
// ==============================================================================

describe('CopilotSdkWrapper — functional contract', () => {
  beforeEach(resetMocks);

  test('[functional] concurrent send() calls serialise in order', async () => {
    const order = [];
    mockSession.sendAndWait
      .mockImplementationOnce(async () => {
        order.push(1);
        return { data: { content: 'first', success: true } };
      })
      .mockImplementationOnce(async () => {
        order.push(2);
        return { data: { content: 'second', success: true } };
      });

    const wrapper = makeWrapper();
    await wrapper.initialize();

    const [r1, r2] = await Promise.all([wrapper.send('a'), wrapper.send('b')]);

    expect(order).toEqual([1, 2]);
    expect(r1.content).toBe('first');
    expect(r2.content).toBe('second');
  });

  test('[functional] cleanup succeeds even after send() throws', async () => {
    mockSession.sendAndWait.mockRejectedValue(new Error('network error'));

    const wrapper = makeWrapper();
    await wrapper.initialize();

    await expect(wrapper.send('boom')).rejects.toThrow('network error');

    await expect(wrapper.cleanup()).resolves.toBeUndefined();
    expect(mockClient.stop).toHaveBeenCalledTimes(1);
    expect(wrapper.session).toBeNull();
    expect(wrapper.client).toBeNull();
  });

  test('[functional] subsequent send() works after a failed send()', async () => {
    mockSession.sendAndWait
      .mockRejectedValueOnce(new Error('transient failure'))
      .mockResolvedValue({ data: { content: 'recovered', success: true } });

    const wrapper = makeWrapper();
    await wrapper.initialize();

    await expect(wrapper.send('fail')).rejects.toThrow('transient failure');

    const result = await wrapper.send('retry');
    expect(result.content).toBe('recovered');
  });
});

// ==============================================================================
// CopilotSdkWrapper — sendStream()
// ==============================================================================

describe('CopilotSdkWrapper — sendStream()', () => {
  beforeEach(resetMocks);

  test('[unit] sendStream throws SystemError when no session', async () => {
    const wrapper = makeWrapper();
    await expect(wrapper.sendStream('prompt', jest.fn(), 5_000)).rejects.toThrow(
      'No active session'
    );
  });

  test('[integration] sendStream subscribes to events and returns final response', async () => {
    // v0.4.1: session.on() takes a single event-multiplexer callback (not eventName + handler).
    // Content comes from 'assistant.message' events, not from sendAndWait's return value.
    let capturedCallback;
    mockSession.on.mockImplementation((cb) => {
      capturedCallback = cb;
      return jest.fn(); // unsubscribe
    });
    mockSession.sendAndWait.mockImplementation(async () => {
      capturedCallback({ type: 'assistant.message_delta', data: { deltaContent: 'hel' } });
      capturedCallback({ type: 'assistant.message_delta', data: { deltaContent: 'lo' } });
      capturedCallback({ type: 'assistant.message', data: { content: 'hello' } });
    });

    const wrapper = makeWrapper();
    await wrapper.initialize();

    const chunks = [];
    const result = await wrapper.sendStream('hello', (delta) => chunks.push(delta), 5_000);

    expect(mockSession.on).toHaveBeenCalledWith(expect.any(Function));
    expect(chunks).toEqual(['hel', 'lo']);
    expect(result).toEqual({ content: 'hello', success: true });
  });

  test('[integration] sendStream unsubscribes from events after completion', async () => {
    const unsubscribe = jest.fn();
    mockSession.on.mockReturnValue(unsubscribe);

    const wrapper = makeWrapper();
    await wrapper.initialize();

    await wrapper.sendStream('hello', jest.fn(), 5_000);

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  test('[integration] sendStream unsubscribes even when sendAndWait throws', async () => {
    const unsubscribe = jest.fn();
    mockSession.on.mockReturnValue(unsubscribe);
    mockSession.sendAndWait.mockRejectedValue(new Error('send failed'));

    const wrapper = makeWrapper();
    await wrapper.initialize();

    await expect(wrapper.sendStream('boom', jest.fn(), 5_000)).rejects.toThrow('send failed');
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  test('[integration] sendStream serialises concurrent calls via the send queue', async () => {
    // v0.4.1: content arrives via 'assistant.message' event, not sendAndWait return value.
    // Calls are serialised, so capturedCallback is set correctly for each sequential call.
    const order = [];
    let capturedCallback;
    mockSession.on.mockImplementation((cb) => {
      capturedCallback = cb;
      return jest.fn(); // unsubscribe
    });
    mockSession.sendAndWait
      .mockImplementationOnce(async () => {
        order.push(1);
        capturedCallback({ type: 'assistant.message', data: { content: 'first' } });
      })
      .mockImplementationOnce(async () => {
        order.push(2);
        capturedCallback({ type: 'assistant.message', data: { content: 'second' } });
      });

    const wrapper = makeWrapper();
    await wrapper.initialize();

    const [r1, r2] = await Promise.all([
      wrapper.sendStream('a', jest.fn()),
      wrapper.sendStream('b', jest.fn()),
    ]);

    expect(order).toEqual([1, 2]);
    expect(r1.content).toBe('first');
    expect(r2.content).toBe('second');
  });
});

// ==============================================================================
// v0.5.1 — re-exports available from olinda_copilot_sdk.ts via CDN tarball
// ==============================================================================

describe('copilot_sdk_wrapper — v0.5.1 re-exports', () => {
  test('approveAll is re-exported as a function', () => {
    expect(typeof approveAll).toBe('function');
  });

  test('ResumeSessionConfig type is re-exported (import resolves without error)', async () => {
    // ResumeSessionConfig is a type-only export — no runtime value to check.
    // Verify the module resolves without throwing (type exports don't exist at runtime).
    const mod = await import('../../src/lib/copilot_sdk_wrapper.js');
    expect(mod).toBeDefined();
    // Value exports still present
    expect(typeof mod.CopilotSdkWrapper).toBe('function');
    expect(typeof mod.approveAll).toBe('function');
  });
});
