/**
 * Session Management Module
 * @version 1.0.0
 * @description Manage unique sessions, timeouts, and cleanup for workflow steps
 * @module lib/session_manager
 * Part of: AI Workflow Automation v1.0.0
 */

import crypto from 'crypto';

/**
 * Session manager for workflow execution
 */
export class SessionManager {
  constructor() {
    this.activeSessions = new Map();
    this.sessionCleanupQueue = [];
  }

  /**
   * Generate unique session ID with workflow context
   * @param {number} stepNum - Step number
   * @param {string} operation - Operation name
   * @returns {string} Unique session ID
   */
  generateSessionId(stepNum, operation) {
    const timestamp = new Date()
      .toISOString()
      .replace(/[^0-9]/g, '')
      .slice(0, 14);
    const randomSuffix = crypto.randomBytes(3).toString('hex');
    return `step${String(stepNum).padStart(2, '0')}_${operation}_${timestamp}_${randomSuffix}`;
  }

  /**
   * Register a session for tracking and cleanup
   * @param {string} sessionId - Session ID
   * @param {string} description - Session description
   */
  registerSession(sessionId, description = 'No description') {
    this.activeSessions.set(sessionId, {
      description,
      startTime: Date.now(),
    });
    this.sessionCleanupQueue.push(sessionId);
    console.log(`✓ Registered session: ${sessionId} (${description})`);
  }

  /**
   * Unregister a session after completion
   * @param {string} sessionId - Session ID
   */
  unregisterSession(sessionId) {
    if (this.activeSessions.has(sessionId)) {
      this.activeSessions.delete(sessionId);
      this.sessionCleanupQueue = this.sessionCleanupQueue.filter((id) => id !== sessionId);
      console.log(`✓ Unregistered session: ${sessionId}`);
    }
  }

  /**
   * Get active session info
   * @param {string} sessionId - Session ID
   * @returns {Object|null} Session info or null
   */
  getSession(sessionId) {
    return this.activeSessions.get(sessionId) || null;
  }

  /**
   * Get all active sessions
   * @returns {Array} Array of session IDs
   */
  getActiveSessions() {
    return Array.from(this.activeSessions.keys());
  }

  /**
   * Cleanup all active sessions
   */
  cleanupAllSessions() {
    const sessionIds = [...this.sessionCleanupQueue];
    for (const sessionId of sessionIds) {
      this.unregisterSession(sessionId);
    }
    console.log(`✓ Cleaned up ${sessionIds.length} sessions`);
  }

  /**
   * Get session age in milliseconds
   * @param {string} sessionId - Session ID
   * @returns {number|null} Age in ms or null if not found
   */
  getSessionAge(sessionId) {
    const session = this.activeSessions.get(sessionId);
    return session ? Date.now() - session.startTime : null;
  }

  /**
   * Check if session is active
   * @param {string} sessionId - Session ID
   * @returns {boolean} True if session is active
   */
  isSessionActive(sessionId) {
    return this.activeSessions.has(sessionId);
  }

  /**
   * Get session count
   * @returns {number} Number of active sessions
   */
  getSessionCount() {
    return this.activeSessions.size;
  }
}

export default SessionManager;
