/**
 * Tests for SessionManager module
 */

import { SessionManager } from '../../src/lib/session_manager.js';

describe('SessionManager', () => {
  let sessionManager;

  beforeEach(() => {
    sessionManager = new SessionManager();
  });

  describe('generateSessionId', () => {
    it('should generate unique session IDs', () => {
      const id1 = sessionManager.generateSessionId(0, 'test');
      const id2 = sessionManager.generateSessionId(0, 'test');

      expect(id1).not.toBe(id2);
    });

    it('should include step number with padding', () => {
      const id = sessionManager.generateSessionId(7, 'validate');
      expect(id).toMatch(/^step07_/);
    });

    it('should include operation name', () => {
      const id = sessionManager.generateSessionId(3, 'doc_check');
      expect(id).toContain('doc_check');
    });

    it('should include timestamp', () => {
      const id = sessionManager.generateSessionId(1, 'test');
      // Should contain numeric timestamp pattern
      expect(id).toMatch(/_\d{14}_/);
    });

    it('should include random suffix', () => {
      const id = sessionManager.generateSessionId(0, 'test');
      // Should end with 6-character hex string
      expect(id).toMatch(/_[a-f0-9]{6}$/);
    });
  });

  describe('registerSession', () => {
    it('should register a session', () => {
      const sessionId = 'test_session_001';
      sessionManager.registerSession(sessionId, 'Test session');

      expect(sessionManager.isSessionActive(sessionId)).toBe(true);
    });

    it('should use default description', () => {
      const sessionId = 'test_session_002';
      sessionManager.registerSession(sessionId);

      const session = sessionManager.getSession(sessionId);
      expect(session).toBeDefined();
    });

    it('should track start time', () => {
      const sessionId = 'test_session_003';
      const beforeRegister = Date.now();

      sessionManager.registerSession(sessionId);

      const session = sessionManager.getSession(sessionId);
      expect(session.startTime).toBeGreaterThanOrEqual(beforeRegister);
      expect(session.startTime).toBeLessThanOrEqual(Date.now());
    });

    it('should add to cleanup queue', () => {
      const sessionId = 'test_session_004';
      sessionManager.registerSession(sessionId);

      expect(sessionManager.sessionCleanupQueue).toContain(sessionId);
    });
  });

  describe('unregisterSession', () => {
    it('should unregister a session', () => {
      const sessionId = 'test_session_005';
      sessionManager.registerSession(sessionId);
      sessionManager.unregisterSession(sessionId);

      expect(sessionManager.isSessionActive(sessionId)).toBe(false);
    });

    it('should remove from cleanup queue', () => {
      const sessionId = 'test_session_006';
      sessionManager.registerSession(sessionId);
      sessionManager.unregisterSession(sessionId);

      expect(sessionManager.sessionCleanupQueue).not.toContain(sessionId);
    });

    it('should handle non-existent session gracefully', () => {
      expect(() => {
        sessionManager.unregisterSession('non_existent');
      }).not.toThrow();
    });
  });

  describe('getSession', () => {
    it('should return session info', () => {
      const sessionId = 'test_session_007';
      sessionManager.registerSession(sessionId, 'Test description');

      const session = sessionManager.getSession(sessionId);

      expect(session).toBeDefined();
      expect(session.description).toBe('Test description');
      expect(session.startTime).toBeGreaterThan(0);
    });

    it('should return null for non-existent session', () => {
      expect(sessionManager.getSession('non_existent')).toBeNull();
    });
  });

  describe('getActiveSessions', () => {
    it('should return array of active session IDs', () => {
      sessionManager.registerSession('session_1');
      sessionManager.registerSession('session_2');
      sessionManager.registerSession('session_3');

      const activeSessions = sessionManager.getActiveSessions();

      expect(activeSessions).toHaveLength(3);
      expect(activeSessions).toContain('session_1');
      expect(activeSessions).toContain('session_2');
      expect(activeSessions).toContain('session_3');
    });

    it('should return empty array when no sessions', () => {
      expect(sessionManager.getActiveSessions()).toEqual([]);
    });
  });

  describe('cleanupAllSessions', () => {
    it('should cleanup all sessions', () => {
      sessionManager.registerSession('session_1');
      sessionManager.registerSession('session_2');
      sessionManager.registerSession('session_3');

      sessionManager.cleanupAllSessions();

      expect(sessionManager.getSessionCount()).toBe(0);
      expect(sessionManager.sessionCleanupQueue).toHaveLength(0);
    });

    it('should handle no sessions gracefully', () => {
      expect(() => {
        sessionManager.cleanupAllSessions();
      }).not.toThrow();
    });
  });

  describe('getSessionAge', () => {
    it('should return session age in milliseconds', (done) => {
      const sessionId = 'test_session_age';
      sessionManager.registerSession(sessionId);

      setTimeout(() => {
        const age = sessionManager.getSessionAge(sessionId);
        expect(age).toBeGreaterThanOrEqual(45); // Slightly less for tolerance
        expect(age).toBeLessThan(200);
        done();
      }, 50);
    });

    it('should return null for non-existent session', () => {
      expect(sessionManager.getSessionAge('non_existent')).toBeNull();
    });
  });

  describe('isSessionActive', () => {
    it('should return true for active session', () => {
      const sessionId = 'test_active';
      sessionManager.registerSession(sessionId);

      expect(sessionManager.isSessionActive(sessionId)).toBe(true);
    });

    it('should return false for inactive session', () => {
      const sessionId = 'test_inactive';
      sessionManager.registerSession(sessionId);
      sessionManager.unregisterSession(sessionId);

      expect(sessionManager.isSessionActive(sessionId)).toBe(false);
    });

    it('should return false for non-existent session', () => {
      expect(sessionManager.isSessionActive('non_existent')).toBe(false);
    });
  });

  describe('getSessionCount', () => {
    it('should return correct count', () => {
      expect(sessionManager.getSessionCount()).toBe(0);

      sessionManager.registerSession('session_1');
      expect(sessionManager.getSessionCount()).toBe(1);

      sessionManager.registerSession('session_2');
      expect(sessionManager.getSessionCount()).toBe(2);

      sessionManager.unregisterSession('session_1');
      expect(sessionManager.getSessionCount()).toBe(1);
    });
  });
});
