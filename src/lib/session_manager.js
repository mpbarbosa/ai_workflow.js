/**
 * Session Management Module (Referentially Transparent Version)
 * @version 2.0.0
 * @description Pure functional session management following referential transparency principles
 * @module lib/session_manager_pure
 * Part of: AI Workflow Automation v1.0.0
 */

import crypto from 'crypto';
import { logger } from '../core/logger.js';

/**
 * PURE FUNCTIONS - All referentially transparent
 */

/**
 * Generate unique session ID with workflow context (PURE)
 * @param {number} stepNum - Step number
 * @param {string} operation - Operation name
 * @param {number} timestamp - Current timestamp (passed in for determinism)
 * @param {Buffer} randomBytes - Random bytes (passed in for determinism)
 * @returns {string} Unique session ID
 */
export function generateSessionId(stepNum, operation, timestamp, randomBytes) {
  const timestampStr = new Date(timestamp)
    .toISOString()
    .replace(/[^0-9]/g, '')
    .slice(0, 14);
  const randomSuffix = randomBytes.toString('hex');
  return `step${String(stepNum).padStart(2, '0')}_${operation}_${timestampStr}_${randomSuffix}`;
}

/**
 * Create session entry (PURE)
 * @param {string} sessionId - Session ID
 * @param {string} description - Session description
 * @param {number} startTime - Start timestamp
 * @returns {Object} Session entry
 */
export function createSessionEntry(sessionId, description, startTime) {
  return {
    sessionId,
    description,
    startTime,
  };
}

/**
 * Register a session in the sessions map (PURE - returns new map)
 * @param {Map} sessions - Current sessions map
 * @param {string} sessionId - Session ID
 * @param {Object} sessionEntry - Session entry
 * @returns {Map} New sessions map with added session
 */
export function registerSession(sessions, sessionId, sessionEntry) {
  const newSessions = new Map(sessions);
  newSessions.set(sessionId, sessionEntry);
  return newSessions;
}

/**
 * Add session to cleanup queue (PURE - returns new array)
 * @param {Array} queue - Current cleanup queue
 * @param {string} sessionId - Session ID to add
 * @returns {Array} New queue with added session ID
 */
export function addToCleanupQueue(queue, sessionId) {
  return [...queue, sessionId];
}

/**
 * Unregister a session (PURE - returns new map)
 * @param {Map} sessions - Current sessions map
 * @param {string} sessionId - Session ID to remove
 * @returns {Map} New sessions map without the session
 */
export function unregisterSession(sessions, sessionId) {
  const newSessions = new Map(sessions);
  newSessions.delete(sessionId);
  return newSessions;
}

/**
 * Remove from cleanup queue (PURE - returns new array)
 * @param {Array} queue - Current cleanup queue
 * @param {string} sessionId - Session ID to remove
 * @returns {Array} New queue without the session ID
 */
export function removeFromCleanupQueue(queue, sessionId) {
  return queue.filter((id) => id !== sessionId);
}

/**
 * Get active session info (PURE)
 * @param {Map} sessions - Sessions map
 * @param {string} sessionId - Session ID
 * @returns {Object|null} Session info or null
 */
export function getSession(sessions, sessionId) {
  return sessions.get(sessionId) || null;
}

/**
 * Get all active session IDs (PURE)
 * @param {Map} sessions - Sessions map
 * @returns {Array} Array of session IDs
 */
export function getActiveSessions(sessions) {
  return Array.from(sessions.keys());
}

/**
 * Calculate session age (PURE)
 * @param {Object} session - Session entry
 * @param {number} currentTime - Current timestamp
 * @returns {number|null} Age in ms or null if no session
 */
export function getSessionAge(session, currentTime) {
  return session ? currentTime - session.startTime : null;
}

/**
 * Check if session is active (PURE)
 * @param {Map} sessions - Sessions map
 * @param {string} sessionId - Session ID
 * @returns {boolean} True if session is active
 */
export function isSessionActive(sessions, sessionId) {
  return sessions.has(sessionId);
}

/**
 * Get session count (PURE)
 * @param {Map} sessions - Sessions map
 * @returns {number} Number of active sessions
 */
export function getSessionCount(sessions) {
  return sessions.size;
}

/**
 * IMPURE WRAPPER CLASS - Isolates side effects at boundaries
 * Uses pure functions internally, handles I/O and state at boundaries
 */
export class SessionManager {
  constructor() {
    this.activeSessions = new Map();
    this.sessionCleanupQueue = [];
  }

  /**
   * Generate unique session ID (IMPURE wrapper - provides time/random)
   * @param {number} stepNum - Step number
   * @param {string} operation - Operation name
   * @returns {string} Unique session ID
   */
  generateSessionId(stepNum, operation) {
    // Inject non-deterministic dependencies here
    const timestamp = Date.now();
    const randomBytes = crypto.randomBytes(3);
    return generateSessionId(stepNum, operation, timestamp, randomBytes);
  }

  /**
   * Register a session (IMPURE wrapper - handles state + I/O)
   * @param {string} sessionId - Session ID
   * @param {string} description - Session description
   * @returns {void}
   */
  registerSession(sessionId, description = 'No description') {
    // Pure calculation
    const startTime = Date.now();
    const sessionEntry = createSessionEntry(sessionId, description, startTime);

    // State updates using pure functions
    this.activeSessions = registerSession(this.activeSessions, sessionId, sessionEntry);
    this.sessionCleanupQueue = addToCleanupQueue(this.sessionCleanupQueue, sessionId);

    // Side effect isolated
    logger.info(`Registered session: ${sessionId} (${description})`);
  }

  /**
   * Unregister a session (IMPURE wrapper - handles state + I/O)
   * @param {string} sessionId - Session ID
   * @returns {void}
   */
  unregisterSession(sessionId) {
    if (isSessionActive(this.activeSessions, sessionId)) {
      // State updates using pure functions
      this.activeSessions = unregisterSession(this.activeSessions, sessionId);
      this.sessionCleanupQueue = removeFromCleanupQueue(this.sessionCleanupQueue, sessionId);

      // Side effect isolated
      logger.info(`Unregistered session: ${sessionId}`);
    }
  }

  /**
   * Get active session info (delegates to pure function)
   * @param {string} sessionId - Session ID
   * @returns {Object|null} Session info or null
   */
  getSession(sessionId) {
    return getSession(this.activeSessions, sessionId);
  }

  /**
   * Get all active sessions (delegates to pure function)
   * @returns {Array} Array of session IDs
   */
  getActiveSessions() {
    return getActiveSessions(this.activeSessions);
  }

  /**
   * Cleanup all active sessions (IMPURE wrapper)
   * @returns {void}
   */
  cleanupAllSessions() {
    const sessionIds = [...this.sessionCleanupQueue];
    for (const sessionId of sessionIds) {
      this.unregisterSession(sessionId);
    }
    // Side effect isolated
    logger.info(`Cleaned up ${sessionIds.length} sessions`);
  }

  /**
   * Get session age in milliseconds (IMPURE wrapper - provides current time)
   * @param {string} sessionId - Session ID
   * @returns {number|null} Age in ms or null if not found
   */
  getSessionAge(sessionId) {
    const session = getSession(this.activeSessions, sessionId);
    const currentTime = Date.now(); // Inject current time
    return getSessionAge(session, currentTime);
  }

  /**
   * Check if session is active (delegates to pure function)
   * @param {string} sessionId - Session ID
   * @returns {boolean} True if session is active
   */
  isSessionActive(sessionId) {
    return isSessionActive(this.activeSessions, sessionId);
  }

  /**
   * Get session count (delegates to pure function)
   * @returns {number} Number of active sessions
   */
  getSessionCount() {
    return getSessionCount(this.activeSessions);
  }
}

export default SessionManager;
