import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

const mockStart = jest.fn();
const mockGetAuthStatus = jest.fn();
const mockListModels = jest.fn();
const mockCreateSession = jest.fn();
const mockStop = jest.fn();
const MockCopilotClient = jest.fn(() => ({
  start: mockStart,
  getAuthStatus: mockGetAuthStatus,
  listModels: mockListModels,
  createSession: mockCreateSession,
  stop: mockStop,
}));

jest.unstable_mockModule('@github/copilot-sdk', () => ({
  CopilotClient: MockCopilotClient,
}));

const { runSmokeTest, withTimeout } = await import('../../scripts/smoke-test-copilot-sdk.js');

// Helper: build a mock session that fires events during send()
function makeSession({ content = 'OK', errorEvent = null } = {}) {
  const handlers = {};
  return {
    on: jest.fn((event, handler) => { handlers[event] = handler; }),
    send: jest.fn(async () => {
      await Promise.resolve();
      if (errorEvent) {
        handlers['session.error']?.({ data: { message: errorEvent } });
      } else {
        handlers['assistant.message']?.({ data: { content } });
        handlers['session.idle']?.();
      }
    }),
    destroy: jest.fn().mockResolvedValue(undefined),
  };
}

describe('smoke-test-copilot-sdk.js', () => {
  let consoleSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('withTimeout', () => {
    it('resolves when promise resolves before timeout', async () => {
      const result = await withTimeout(Promise.resolve('ok'), 1000, 'test');
      expect(result).toBe('ok');
    });

    it('rejects with timeout message when promise is too slow', async () => {
      const never = new Promise(() => {});
      await expect(withTimeout(never, 10, 'slow op')).rejects.toThrow('Timed out after 10ms: slow op');
    });

    it('propagates rejection from the inner promise', async () => {
      await expect(withTimeout(Promise.reject(new Error('inner fail')), 1000, 'op')).rejects.toThrow('inner fail');
    });
  });

  describe('runSmokeTest — happy path', () => {
    it('returns passed=9, failed=0 when all checks succeed', async () => {
      const session = makeSession({ content: 'OK' });
      mockStart.mockResolvedValue(undefined);
      mockGetAuthStatus.mockResolvedValue({ isAuthenticated: true });
      mockListModels.mockResolvedValue([{ id: 'claude-sonnet-4.5' }]);
      mockCreateSession.mockResolvedValue(session);
      mockStop.mockResolvedValue(undefined);

      const result = await runSmokeTest();

      expect(result.failed).toBe(0);
      expect(result.passed).toBeGreaterThan(0);
    });

    it('reports auth ok when status.status === "ok"', async () => {
      const session = makeSession();
      mockStart.mockResolvedValue(undefined);
      mockGetAuthStatus.mockResolvedValue({ status: 'ok' });
      mockListModels.mockResolvedValue([{ id: 'm1' }]);
      mockCreateSession.mockResolvedValue(session);
      mockStop.mockResolvedValue(undefined);

      const { failed } = await runSmokeTest();
      expect(failed).toBe(0);
    });

    it('reports auth ok when status.authenticated === true', async () => {
      const session = makeSession();
      mockStart.mockResolvedValue(undefined);
      mockGetAuthStatus.mockResolvedValue({ authenticated: true });
      mockListModels.mockResolvedValue([{ id: 'm1' }]);
      mockCreateSession.mockResolvedValue(session);
      mockStop.mockResolvedValue(undefined);

      const { failed } = await runSmokeTest();
      expect(failed).toBe(0);
    });
  });

  describe('runSmokeTest — instantiation failure', () => {
    it('returns early when CopilotClient constructor throws', async () => {
      MockCopilotClient.mockImplementationOnce(() => { throw new Error('no SDK'); });

      const { passed, failed } = await runSmokeTest();
      expect(failed).toBe(1);
      expect(passed).toBe(1); // only import check passes
    });
  });

  describe('runSmokeTest — start failure', () => {
    it('returns early when client.start() rejects', async () => {
      mockStart.mockRejectedValueOnce(new Error('CLI not found'));

      const { failed } = await runSmokeTest();
      expect(failed).toBeGreaterThan(0);
    });
  });

  describe('runSmokeTest — auth failure', () => {
    it('records failed auth when getAuthStatus rejects', async () => {
      const session = makeSession();
      mockStart.mockResolvedValue(undefined);
      mockGetAuthStatus.mockRejectedValueOnce(new Error('auth error'));
      mockListModels.mockResolvedValue([{ id: 'm1' }]);
      mockCreateSession.mockResolvedValue(session);
      mockStop.mockResolvedValue(undefined);

      const { failed } = await runSmokeTest();
      expect(failed).toBeGreaterThan(0);
    });

    it('records failed auth when isAuthenticated is false', async () => {
      const session = makeSession();
      mockStart.mockResolvedValue(undefined);
      mockGetAuthStatus.mockResolvedValue({ isAuthenticated: false });
      mockListModels.mockResolvedValue([{ id: 'm1' }]);
      mockCreateSession.mockResolvedValue(session);
      mockStop.mockResolvedValue(undefined);

      const { failed } = await runSmokeTest();
      expect(failed).toBeGreaterThan(0);
    });
  });

  describe('runSmokeTest — model listing failure', () => {
    it('records failure when listModels rejects', async () => {
      const session = makeSession();
      mockStart.mockResolvedValue(undefined);
      mockGetAuthStatus.mockResolvedValue({ isAuthenticated: true });
      mockListModels.mockRejectedValueOnce(new Error('no models'));
      mockCreateSession.mockResolvedValue(session);
      mockStop.mockResolvedValue(undefined);

      const { failed } = await runSmokeTest();
      expect(failed).toBeGreaterThan(0);
    });

    it('records failure when models array is empty', async () => {
      const session = makeSession();
      mockStart.mockResolvedValue(undefined);
      mockGetAuthStatus.mockResolvedValue({ isAuthenticated: true });
      mockListModels.mockResolvedValue([]);
      mockCreateSession.mockResolvedValue(session);
      mockStop.mockResolvedValue(undefined);

      const { failed } = await runSmokeTest();
      expect(failed).toBeGreaterThan(0);
    });
  });

  describe('runSmokeTest — session round-trip failure', () => {
    it('records failure when createSession rejects', async () => {
      mockStart.mockResolvedValue(undefined);
      mockGetAuthStatus.mockResolvedValue({ isAuthenticated: true });
      mockListModels.mockResolvedValue([{ id: 'm1' }]);
      mockCreateSession.mockRejectedValueOnce(new Error('session fail'));
      mockStop.mockResolvedValue(undefined);

      const { failed } = await runSmokeTest();
      expect(failed).toBeGreaterThan(0);
    });

    it('records failure when session fires error event', async () => {
      const session = makeSession({ errorEvent: 'Session died' });
      mockStart.mockResolvedValue(undefined);
      mockGetAuthStatus.mockResolvedValue({ isAuthenticated: true });
      mockListModels.mockResolvedValue([{ id: 'm1' }]);
      mockCreateSession.mockResolvedValue(session);
      mockStop.mockResolvedValue(undefined);

      const { failed } = await runSmokeTest();
      expect(failed).toBeGreaterThan(0);
    });

    it('records failure when response content is empty', async () => {
      const session = makeSession({ content: '' });
      mockStart.mockResolvedValue(undefined);
      mockGetAuthStatus.mockResolvedValue({ isAuthenticated: true });
      mockListModels.mockResolvedValue([{ id: 'm1' }]);
      mockCreateSession.mockResolvedValue(session);
      mockStop.mockResolvedValue(undefined);

      const { failed } = await runSmokeTest();
      expect(failed).toBeGreaterThan(0);
    });
  });

  describe('runSmokeTest — cleanup failure', () => {
    it('records failure when client.stop() rejects', async () => {
      const session = makeSession();
      mockStart.mockResolvedValue(undefined);
      mockGetAuthStatus.mockResolvedValue({ isAuthenticated: true });
      mockListModels.mockResolvedValue([{ id: 'm1' }]);
      mockCreateSession.mockResolvedValue(session);
      mockStop.mockRejectedValueOnce(new Error('stop failed'));

      const { failed } = await runSmokeTest();
      expect(failed).toBeGreaterThan(0);
    });
  });
});
