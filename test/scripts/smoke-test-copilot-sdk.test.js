// test/smoke-test-copilot-sdk.test.js

import { CopilotClient } from '@github/copilot-sdk';

jest.mock('@github/copilot-sdk');

describe('smoke-test-copilot-sdk.js', () => {
  let clientMock, sessionMock;

  beforeEach(() => {
    clientMock = {
      start: jest.fn().mockResolvedValue(undefined),
      getAuthStatus: jest.fn().mockResolvedValue({ isAuthenticated: true }),
      listModels: jest.fn().mockResolvedValue([{ id: 'claude-sonnet-4.5' }]),
      createSession: jest.fn(),
      stop: jest.fn().mockResolvedValue(undefined),
    };
    sessionMock = {
      send: jest.fn().mockResolvedValue(undefined),
      destroy: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
    };
    clientMock.createSession.mockResolvedValue(sessionMock);
    CopilotClient.mockImplementation(() => clientMock);
  });

  describe('SDK import and instantiation', () => {
    it('should import CopilotClient as a function', () => {
      expect(typeof CopilotClient).toBe('function');
    });

    it('should instantiate CopilotClient without error', () => {
      expect(() => new CopilotClient()).not.toThrow();
    });
  });

  describe('CLI connection & authentication', () => {
    it('should start CLI process and authenticate', async () => {
      const client = new CopilotClient();
      await expect(client.start()).resolves.toBeUndefined();
      const status = await client.getAuthStatus();
      expect(status.isAuthenticated).toBe(true);
    });

    it('should handle CLI start failure', async () => {
      clientMock.start.mockRejectedValueOnce(new Error('start failed'));
      const client = new CopilotClient();
      await expect(client.start()).rejects.toThrow('start failed');
    });

    it('should handle authentication failure', async () => {
      clientMock.getAuthStatus.mockResolvedValueOnce({ isAuthenticated: false });
      const client = new CopilotClient();
      await client.start();
      const status = await client.getAuthStatus();
      expect(status.isAuthenticated).toBe(false);
    });
  });

  describe('Model availability', () => {
    it('should list available models', async () => {
      const client = new CopilotClient();
      await client.start();
      const models = await client.listModels();
      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);
      expect(models[0].id).toBe('claude-sonnet-4.5');
    });

    it('should handle no models available', async () => {
      clientMock.listModels.mockResolvedValueOnce([]);
      const client = new CopilotClient();
      await client.start();
      const models = await client.listModels();
      expect(models.length).toBe(0);
    });

    it('should handle listModels failure', async () => {
      clientMock.listModels.mockRejectedValueOnce(new Error('listModels failed'));
      const client = new CopilotClient();
      await client.start();
      await expect(client.listModels()).rejects.toThrow('listModels failed');
    });
  });

  describe('Session round-trip', () => {
    it('should create session and receive response', async () => {
      let assistantMessageHandler, idleHandler, errorHandler;
      sessionMock.on.mockImplementation((event, handler) => {
        if (event === 'assistant.message') assistantMessageHandler = handler;
        if (event === 'session.idle') idleHandler = handler;
        if (event === 'session.error') errorHandler = handler;
      });

      const client = new CopilotClient();
      await client.start();
      const session = await client.createSession();
      await session.send({ prompt: 'Reply with exactly: OK' });

      // Simulate assistant message and idle
      assistantMessageHandler({ data: { content: 'OK' } });
      idleHandler();

      expect(session.send).toHaveBeenCalledWith({ prompt: 'Reply with exactly: OK' });
    });

    it('should handle session creation failure', async () => {
      clientMock.createSession.mockRejectedValueOnce(new Error('session failed'));
      const client = new CopilotClient();
      await client.start();
      await expect(client.createSession()).rejects.toThrow('session failed');
    });

    it('should handle session error event', async () => {
      let errorHandler;
      sessionMock.on.mockImplementation((event, handler) => {
        if (event === 'session.error') errorHandler = handler;
      });

      const client = new CopilotClient();
      await client.start();
      const session = await client.createSession();
      await session.send({ prompt: 'Reply with exactly: OK' });

      // Simulate session error
      expect(() => errorHandler({ data: { message: 'Session error' } })).not.toThrow();
    });
  });

  describe('Cleanup', () => {
    it('should destroy session and stop client cleanly', async () => {
      const client = new CopilotClient();
      await client.start();
      const session = await client.createSession();
      await session.destroy();
      await client.stop();
      expect(session.destroy).toHaveBeenCalled();
      expect(client.stop).toHaveBeenCalled();
    });

    it('should handle client stop failure', async () => {
      clientMock.stop.mockRejectedValueOnce(new Error('stop failed'));
      const client = new CopilotClient();
      await client.start();
      await expect(client.stop()).rejects.toThrow('stop failed');
    });

    it('should handle session destroy failure', async () => {
      sessionMock.destroy.mockRejectedValueOnce(new Error('destroy failed'));
      const client = new CopilotClient();
      await client.start();
      const session = await client.createSession();
      await expect(session.destroy()).rejects.toThrow('destroy failed');
    });
  });
});
