/**
 * Tests for SessionManager (Pure Functions + Wrapper)
 * @version 2.0.0
 * @description Test suite for pure functional session management
 * @module test/lib/session_manager
 */

import SessionManager, {
  generateSessionId,
  createSessionEntry,
  registerSession,
  addToCleanupQueue,
  unregisterSession,
  removeFromCleanupQueue,
  getSession,
  getActiveSessions,
  getSessionAge,
  isSessionActive,
  getSessionCount,
} from '../../src/lib/session_manager.js';

describe('SessionManager - Pure Functions', () => {
  describe('generateSessionId', () => {
    test('should generate deterministic session ID with fixed inputs', () => {
      const timestamp = 1706576169000; // 2026-01-30 00:02:49 UTC
      const randomBytes = Buffer.from([0xaa, 0xbb, 0xcc]);

      const id1 = generateSessionId(1, 'test', timestamp, randomBytes);
      const id2 = generateSessionId(1, 'test', timestamp, randomBytes);

      expect(id1).toBe(id2); // Same inputs = same output (referentially transparent)
      expect(id1).toMatch(/^step01_test_\d{14}_aabbcc$/);
    });

    test('should create unique IDs for different inputs', () => {
      const timestamp = 1706576169000;
      const randomBytes = Buffer.from([0xaa, 0xbb, 0xcc]);

      const id1 = generateSessionId(1, 'test', timestamp, randomBytes);
      const id2 = generateSessionId(2, 'test', timestamp, randomBytes);
      const id3 = generateSessionId(1, 'other', timestamp, randomBytes);

      expect(id1).not.toBe(id2);
      expect(id1).not.toBe(id3);
    });

    test('should pad step numbers correctly', () => {
      const timestamp = 1706576169000;
      const randomBytes = Buffer.from([0xaa, 0xbb, 0xcc]);

      const id1 = generateSessionId(1, 'test', timestamp, randomBytes);
      const id15 = generateSessionId(15, 'test', timestamp, randomBytes);

      expect(id1).toContain('step01_');
      expect(id15).toContain('step15_');
    });

    test('should handle different timestamp formats', () => {
      const timestamp1 = 1706576169000;
      const timestamp2 = 1706576170000;
      const randomBytes = Buffer.from([0xaa, 0xbb, 0xcc]);

      const id1 = generateSessionId(1, 'test', timestamp1, randomBytes);
      const id2 = generateSessionId(1, 'test', timestamp2, randomBytes);

      expect(id1).not.toBe(id2);
    });
  });

  describe('createSessionEntry', () => {
    test('should create session entry with all fields', () => {
      const sessionId = 'test-session-123';
      const description = 'Test description';
      const startTime = 1706576169000;

      const entry = createSessionEntry(sessionId, description, startTime);

      expect(entry).toEqual({
        sessionId: 'test-session-123',
        description: 'Test description',
        startTime: 1706576169000,
      });
    });

    test('should be referentially transparent', () => {
      const entry1 = createSessionEntry('id', 'desc', 1000);
      const entry2 = createSessionEntry('id', 'desc', 1000);

      expect(entry1).toEqual(entry2);
      expect(entry1).not.toBe(entry2); // Different objects
    });
  });

  describe('registerSession', () => {
    test('should return new Map with added session', () => {
      const sessions = new Map();
      const sessionEntry = createSessionEntry('id1', 'desc', 1000);

      const newSessions = registerSession(sessions, 'id1', sessionEntry);

      expect(newSessions).not.toBe(sessions); // Returns new Map
      expect(sessions.size).toBe(0); // Original unchanged
      expect(newSessions.size).toBe(1);
      expect(newSessions.get('id1')).toEqual(sessionEntry);
    });

    test('should preserve existing sessions', () => {
      const sessions = new Map();
      sessions.set('existing', {
        sessionId: 'existing',
        description: 'test',
        startTime: 900,
      });

      const sessionEntry = createSessionEntry('id2', 'new', 1000);
      const newSessions = registerSession(sessions, 'id2', sessionEntry);

      expect(newSessions.size).toBe(2);
      expect(newSessions.has('existing')).toBe(true);
      expect(newSessions.has('id2')).toBe(true);
    });

    test('should not mutate original Map', () => {
      const sessions = new Map();
      const sessionEntry = createSessionEntry('id1', 'desc', 1000);

      registerSession(sessions, 'id1', sessionEntry);

      expect(sessions.size).toBe(0); // Original unchanged
    });
  });

  describe('addToCleanupQueue', () => {
    test('should return new array with added session', () => {
      const queue = ['id1', 'id2'];

      const newQueue = addToCleanupQueue(queue, 'id3');

      expect(newQueue).not.toBe(queue); // Returns new array
      expect(queue).toEqual(['id1', 'id2']); // Original unchanged
      expect(newQueue).toEqual(['id1', 'id2', 'id3']);
    });

    test('should work with empty queue', () => {
      const queue = [];
      const newQueue = addToCleanupQueue(queue, 'id1');

      expect(newQueue).toEqual(['id1']);
      expect(queue).toEqual([]); // Original unchanged
    });
  });

  describe('unregisterSession', () => {
    test('should return new Map without session', () => {
      const sessions = new Map();
      sessions.set('id1', { sessionId: 'id1' });
      sessions.set('id2', { sessionId: 'id2' });

      const newSessions = unregisterSession(sessions, 'id1');

      expect(newSessions).not.toBe(sessions); // Returns new Map
      expect(sessions.size).toBe(2); // Original unchanged
      expect(newSessions.size).toBe(1);
      expect(newSessions.has('id1')).toBe(false);
      expect(newSessions.has('id2')).toBe(true);
    });

    test('should handle non-existent session gracefully', () => {
      const sessions = new Map();
      sessions.set('id1', { sessionId: 'id1' });

      const newSessions = unregisterSession(sessions, 'nonexistent');

      expect(newSessions.size).toBe(1);
      expect(newSessions.has('id1')).toBe(true);
    });
  });

  describe('removeFromCleanupQueue', () => {
    test('should return new array without session', () => {
      const queue = ['id1', 'id2', 'id3'];

      const newQueue = removeFromCleanupQueue(queue, 'id2');

      expect(newQueue).not.toBe(queue); // Returns new array
      expect(queue).toEqual(['id1', 'id2', 'id3']); // Original unchanged
      expect(newQueue).toEqual(['id1', 'id3']);
    });

    test('should handle non-existent session gracefully', () => {
      const queue = ['id1', 'id2'];

      const newQueue = removeFromCleanupQueue(queue, 'nonexistent');

      expect(newQueue).toEqual(['id1', 'id2']);
    });
  });

  describe('getSession', () => {
    test('should return session if exists', () => {
      const sessions = new Map();
      const sessionEntry = {
        sessionId: 'id1',
        description: 'test',
        startTime: 1000,
      };
      sessions.set('id1', sessionEntry);

      const result = getSession(sessions, 'id1');

      expect(result).toEqual(sessionEntry);
    });

    test('should return null if not exists', () => {
      const sessions = new Map();

      const result = getSession(sessions, 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getActiveSessions', () => {
    test('should return array of session IDs', () => {
      const sessions = new Map();
      sessions.set('id1', { sessionId: 'id1' });
      sessions.set('id2', { sessionId: 'id2' });

      const result = getActiveSessions(sessions);

      expect(result).toEqual(['id1', 'id2']);
    });

    test('should return empty array for empty map', () => {
      const sessions = new Map();

      const result = getActiveSessions(sessions);

      expect(result).toEqual([]);
    });
  });

  describe('getSessionAge', () => {
    test('should calculate age correctly', () => {
      const session = {
        sessionId: 'id1',
        description: 'test',
        startTime: 1000,
      };
      const currentTime = 2500;

      const age = getSessionAge(session, currentTime);

      expect(age).toBe(1500);
    });

    test('should return null for null session', () => {
      const age = getSessionAge(null, 2000);

      expect(age).toBeNull();
    });

    test('should be referentially transparent', () => {
      const session = { startTime: 1000 };
      const age1 = getSessionAge(session, 2000);
      const age2 = getSessionAge(session, 2000);

      expect(age1).toBe(age2);
      expect(age1).toBe(1000);
    });

    test('should handle zero age', () => {
      const session = { startTime: 1000 };
      const age = getSessionAge(session, 1000);

      expect(age).toBe(0);
    });
  });

  describe('isSessionActive', () => {
    test('should return true if session exists', () => {
      const sessions = new Map();
      sessions.set('id1', { sessionId: 'id1' });

      expect(isSessionActive(sessions, 'id1')).toBe(true);
    });

    test('should return false if session does not exist', () => {
      const sessions = new Map();

      expect(isSessionActive(sessions, 'id1')).toBe(false);
    });
  });

  describe('getSessionCount', () => {
    test('should return correct count', () => {
      const sessions = new Map();
      sessions.set('id1', { sessionId: 'id1' });
      sessions.set('id2', { sessionId: 'id2' });

      expect(getSessionCount(sessions)).toBe(2);
    });

    test('should return 0 for empty map', () => {
      const sessions = new Map();

      expect(getSessionCount(sessions)).toBe(0);
    });
  });
});

describe('SessionManager - Wrapper Class (Integration)', () => {
  let manager;
  let originalConsoleLog;

  beforeEach(() => {
    manager = new SessionManager();
    // Save original console.log and replace with mock
    originalConsoleLog = console.log;
    console.log = () => {};
  });

  afterEach(() => {
    // Restore original console.log
    console.log = originalConsoleLog;
  });

  describe('generateSessionId', () => {
    test('should generate unique session IDs (non-deterministic wrapper)', () => {
      const id1 = manager.generateSessionId(1, 'test');
      const id2 = manager.generateSessionId(1, 'test');

      expect(id1).not.toBe(id2); // Different because uses Date.now() and crypto
      expect(id1).toMatch(/^step01_test_\d{14}_[a-f0-9]{6}$/);
      expect(id2).toMatch(/^step01_test_\d{14}_[a-f0-9]{6}$/);
    });

    test('should include step number with padding', () => {
      const id = manager.generateSessionId(7, 'validate');
      expect(id).toMatch(/^step07_validate_/);
    });

    test('should include operation name', () => {
      const id = manager.generateSessionId(1, 'my-operation');
      expect(id).toContain('my-operation');
    });
  });

  describe('registerSession', () => {
    test('should register a new session', () => {
      const sessionId = 'test-session-id';

      manager.registerSession(sessionId, 'Test session');

      expect(manager.isSessionActive(sessionId)).toBe(true);
      expect(manager.getSessionCount()).toBe(1);
    });

    test('should use default description if none provided', () => {
      const sessionId = 'test-session-id';

      manager.registerSession(sessionId);

      const session = manager.getSession(sessionId);
      expect(session.description).toBe('No description');
    });

    test('should add session to cleanup queue', () => {
      const sessionId = 'test-session-id';

      manager.registerSession(sessionId, 'Test');

      expect(manager.sessionCleanupQueue).toContain(sessionId);
    });
  });

  describe('unregisterSession', () => {
    test('should unregister an active session', () => {
      const sessionId = 'test-session-id';
      manager.registerSession(sessionId, 'Test');

      manager.unregisterSession(sessionId);

      expect(manager.isSessionActive(sessionId)).toBe(false);
      expect(manager.getSessionCount()).toBe(0);
    });

    test('should handle unregistering non-existent session', () => {
      manager.unregisterSession('nonexistent-id');

      expect(manager.getSessionCount()).toBe(0);
    });

    test('should remove session from cleanup queue', () => {
      const sessionId = 'test-session-id';
      manager.registerSession(sessionId, 'Test');

      manager.unregisterSession(sessionId);

      expect(manager.sessionCleanupQueue).not.toContain(sessionId);
    });
  });

  describe('getSession', () => {
    test('should return session information', () => {
      const sessionId = 'test-session-id';
      manager.registerSession(sessionId, 'Test description');

      const session = manager.getSession(sessionId);

      expect(session).toBeDefined();
      expect(session.sessionId).toBe(sessionId);
      expect(session.description).toBe('Test description');
      expect(session.startTime).toBeDefined();
    });

    test('should return null for non-existent session', () => {
      const session = manager.getSession('nonexistent-id');

      expect(session).toBeNull();
    });
  });

  describe('getActiveSessions', () => {
    test('should return empty array when no sessions', () => {
      const sessions = manager.getActiveSessions();

      expect(sessions).toEqual([]);
    });

    test('should return all active session IDs', () => {
      manager.registerSession('session1', 'First');
      manager.registerSession('session2', 'Second');
      manager.registerSession('session3', 'Third');

      const sessions = manager.getActiveSessions();

      expect(sessions).toHaveLength(3);
      expect(sessions).toContain('session1');
      expect(sessions).toContain('session2');
      expect(sessions).toContain('session3');
    });
  });

  describe('getSessionAge', () => {
    test('should return age of session in milliseconds', async () => {
      const sessionId = 'test-session-id';
      manager.registerSession(sessionId, 'Test');

      // Wait a bit to accumulate some age
      await new Promise((resolve) => setTimeout(resolve, 10));

      const age = manager.getSessionAge(sessionId);

      expect(age).toBeGreaterThanOrEqual(10);
      expect(age).toBeLessThan(100);
    });

    test('should return null for non-existent session', () => {
      const age = manager.getSessionAge('nonexistent-id');

      expect(age).toBeNull();
    });
  });

  describe('isSessionActive', () => {
    test('should return true for active session', () => {
      const sessionId = 'test-session-id';
      manager.registerSession(sessionId, 'Test');

      expect(manager.isSessionActive(sessionId)).toBe(true);
    });

    test('should return false for non-existent session', () => {
      expect(manager.isSessionActive('nonexistent-id')).toBe(false);
    });

    test('should return false after unregistering', () => {
      const sessionId = 'test-session-id';
      manager.registerSession(sessionId, 'Test');
      manager.unregisterSession(sessionId);

      expect(manager.isSessionActive(sessionId)).toBe(false);
    });
  });

  describe('getSessionCount', () => {
    test('should return 0 initially', () => {
      expect(manager.getSessionCount()).toBe(0);
    });

    test('should return correct count after registrations', () => {
      manager.registerSession('session1', 'First');
      manager.registerSession('session2', 'Second');

      expect(manager.getSessionCount()).toBe(2);
    });

    test('should update count after unregistration', () => {
      manager.registerSession('session1', 'First');
      manager.registerSession('session2', 'Second');
      manager.unregisterSession('session1');

      expect(manager.getSessionCount()).toBe(1);
    });
  });

  describe('cleanupAllSessions', () => {
    test('should cleanup all active sessions', () => {
      manager.registerSession('session1', 'First');
      manager.registerSession('session2', 'Second');
      manager.registerSession('session3', 'Third');

      manager.cleanupAllSessions();

      expect(manager.getSessionCount()).toBe(0);
      expect(manager.getActiveSessions()).toEqual([]);
    });

    test('should handle cleanup with no sessions', () => {
      manager.cleanupAllSessions();

      expect(manager.getSessionCount()).toBe(0);
    });
  });
});
