/**
 * @fileoverview Checkpoint Manager - Manages workflow state checkpoints
 * @module orchestrator/checkpoint_manager
 * @version 2.0.0
 *
 * Provides checkpoint management for workflow pause/resume and error recovery.
 * Follows referential transparency pattern with pure functions for business
 * logic and CheckpointManager class for I/O operations.
 *
 * Architecture:
 * - Pure functions: Checkpoint creation, validation, merging, age calculation
 * - Impure wrapper: CheckpointManager class for file I/O and persistence
 */

import fs from 'fs/promises';
import path from 'path';
import { logger } from '../core/logger.js';
import { ValidationError, SystemError } from '../utils/errors.js';

/**
 * Creates checkpoint data from workflow state
 *
 * @param {Object} workflow - Workflow definition
 * @param {Object} currentState - Current execution state
 * @returns {Object} Checkpoint data
 * @pure
 *
 * @example
 * const checkpoint = createCheckpointData(workflow, state);
 * // => { version, workflow, state, timestamp, ... }
 */
export function createCheckpointData(workflow, currentState = {}) {
  return {
    version: '1.0.0',
    workflowId: workflow.id || workflow.name,
    workflowVersion: workflow.version || '1.0.0',
    timestamp: currentState.timestamp || Date.now(),
    state: {
      currentStep: currentState.currentStep || null,
      completedSteps: currentState.completedSteps || [],
      failedSteps: currentState.failedSteps || [],
      skippedSteps: currentState.skippedSteps || [],
      results: currentState.results || {},
      context: currentState.context || {},
    },
    metadata: {
      totalSteps: workflow.steps?.length || 0,
      progress: currentState.progress || 0,
      ...currentState.metadata,
    },
  };
}

/**
 * Validates checkpoint data structure
 *
 * @param {Object} data - Checkpoint data to validate
 * @returns {Object} Validation result with valid flag and errors
 * @pure
 */
export function validateCheckpoint(data) {
  const result = {
    valid: true,
    errors: [],
  };

  if (!data || typeof data !== 'object') {
    result.valid = false;
    result.errors.push('Checkpoint data must be an object');
    return result;
  }

  // Required fields
  if (!data.version) {
    result.valid = false;
    result.errors.push('Missing checkpoint version');
  }

  if (!data.workflowId) {
    result.valid = false;
    result.errors.push('Missing workflow ID');
  }

  if (!data.timestamp) {
    result.valid = false;
    result.errors.push('Missing timestamp');
  }

  if (!data.state || typeof data.state !== 'object') {
    result.valid = false;
    result.errors.push('Missing or invalid state object');
  }

  // Validate state structure
  if (data.state) {
    if (!Array.isArray(data.state.completedSteps)) {
      result.valid = false;
      result.errors.push('completedSteps must be an array');
    }

    if (data.state.results && typeof data.state.results !== 'object') {
      result.valid = false;
      result.errors.push('results must be an object');
    }
  }

  return result;
}

/**
 * Merges checkpoint state with current state
 *
 * @param {Object} currentState - Current execution state
 * @param {Object} savedState - Saved checkpoint state
 * @returns {Object} Merged state
 * @pure
 */
export function mergeCheckpointState(currentState = {}, savedState = {}) {
  return {
    ...currentState,
    currentStep: savedState.currentStep || currentState.currentStep,
    completedSteps: [...(savedState.completedSteps || []), ...(currentState.completedSteps || [])],
    failedSteps: [...(savedState.failedSteps || []), ...(currentState.failedSteps || [])],
    skippedSteps: [...(savedState.skippedSteps || []), ...(currentState.skippedSteps || [])],
    results: {
      ...savedState.results,
      ...currentState.results,
    },
    context: {
      ...savedState.context,
      ...currentState.context,
    },
  };
}

/**
 * Calculates checkpoint age in milliseconds
 *
 * @param {Object} checkpoint - Checkpoint data with timestamp
 * @param {number} [now] - Current time in milliseconds (for testing)
 * @returns {number} Age in milliseconds
 * @pure
 */
export function calculateCheckpointAge(checkpoint, now = Date.now()) {
  if (checkpoint.timestamp === undefined || checkpoint.timestamp === null) {
    return Infinity;
  }

  return now - checkpoint.timestamp;
}

/**
 * Determines if checkpoint should be cleaned up
 *
 * @param {Object} checkpoint - Checkpoint data
 * @param {number} maxAge - Maximum age in milliseconds
 * @param {number} [now] - Current time in milliseconds (for testing)
 * @returns {boolean} True if should cleanup
 * @pure
 */
export function shouldCleanupCheckpoint(checkpoint, maxAge, now = Date.now()) {
  const age = calculateCheckpointAge(checkpoint, now);
  return age >= maxAge;
}

/**
 * Generates checkpoint ID from workflow and timestamp
 *
 * @param {string} workflowId - Workflow identifier
 * @param {number} timestamp - Timestamp in milliseconds
 * @returns {string} Checkpoint ID
 * @pure
 */
export function generateCheckpointId(workflowId, timestamp) {
  return `${workflowId}-${timestamp}`;
}

/**
 * Parses checkpoint ID into components
 *
 * @param {string} checkpointId - Checkpoint ID
 * @returns {Object} Parsed components (workflowId, timestamp)
 * @pure
 */
export function parseCheckpointId(checkpointId) {
  const parts = checkpointId.split('-');
  if (parts.length < 2) {
    return { workflowId: checkpointId, timestamp: null };
  }

  const lastPart = parts[parts.length - 1];
  const timestamp = parseInt(lastPart, 10);

  // Check if last part is a valid number (timestamp)
  if (isNaN(timestamp) || timestamp.toString() !== lastPart) {
    return { workflowId: checkpointId, timestamp: null };
  }

  const workflowId = parts.slice(0, -1).join('-');

  return {
    workflowId,
    timestamp,
  };
}

/**
 * Filters checkpoints by workflow ID
 *
 * @param {Array<Object>} checkpoints - Array of checkpoints
 * @param {string} workflowId - Workflow ID to filter by
 * @returns {Array<Object>} Filtered checkpoints
 * @pure
 */
export function filterCheckpointsByWorkflow(checkpoints, workflowId) {
  return checkpoints.filter((cp) => cp.workflowId === workflowId);
}

/**
 * Sorts checkpoints by timestamp (newest first)
 *
 * @param {Array<Object>} checkpoints - Array of checkpoints
 * @returns {Array<Object>} Sorted checkpoints
 * @pure
 */
export function sortCheckpointsByTime(checkpoints) {
  return [...checkpoints].sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Checkpoint Manager - Manages workflow state persistence
 *
 * Impure wrapper class that provides:
 * - Checkpoint save/load operations
 * - Checkpoint listing and cleanup
 * - File system persistence
 * - Checkpoint validation
 *
 * Side effects:
 * - File system I/O (read/write checkpoints)
 * - Console logging via logger
 * - Maintains checkpoint directory
 *
 * @class
 */
export class CheckpointManager {
  constructor(options = {}) {
    this.options = {
      checkpointDir: options.checkpointDir || '.ai_workflow/checkpoints',
      maxAge: options.maxAge || 7 * 24 * 60 * 60 * 1000, // 7 days
      autoCleanup: options.autoCleanup !== false,
      ...options,
    };
  }

  /**
   * Saves a checkpoint
   *
   * @param {Object} workflow - Workflow definition
   * @param {Object} currentState - Current execution state
   * @returns {Promise<string>} Checkpoint ID
   * @throws {SystemError} If save fails
   */
  async save(workflow, currentState = {}) {
    try {
      // Create checkpoint data
      const checkpoint = createCheckpointData(workflow, currentState);

      // Validate checkpoint
      const validation = validateCheckpoint(checkpoint);
      if (!validation.valid) {
        throw new ValidationError(`Invalid checkpoint: ${validation.errors.join(', ')}`);
      }

      // Generate checkpoint ID
      const checkpointId = generateCheckpointId(checkpoint.workflowId, checkpoint.timestamp);

      // Ensure checkpoint directory exists
      await fs.mkdir(this.options.checkpointDir, { recursive: true });

      // Save checkpoint to file
      const filePath = this._getCheckpointPath(checkpointId);
      await fs.writeFile(filePath, JSON.stringify(checkpoint, null, 2), 'utf8');

      logger.info(`Checkpoint saved: ${checkpointId}`);

      // Auto cleanup if enabled
      if (this.options.autoCleanup) {
        await this.cleanup().catch((err) => {
          logger.warn(`Auto cleanup failed: ${err.message}`);
        });
      }

      return checkpointId;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new SystemError(`Failed to save checkpoint: ${error.message}`);
    }
  }

  /**
   * Loads a checkpoint
   *
   * @param {string} checkpointId - Checkpoint ID
   * @returns {Promise<Object>} Checkpoint data
   * @throws {ValidationError} If checkpoint not found or invalid
   */
  async load(checkpointId) {
    try {
      const filePath = this._getCheckpointPath(checkpointId);

      // Read checkpoint file
      const content = await fs.readFile(filePath, 'utf8');
      const checkpoint = JSON.parse(content);

      // Validate checkpoint
      const validation = validateCheckpoint(checkpoint);
      if (!validation.valid) {
        throw new ValidationError(`Invalid checkpoint: ${validation.errors.join(', ')}`);
      }

      logger.info(`Checkpoint loaded: ${checkpointId}`);
      return checkpoint;
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new ValidationError(`Checkpoint not found: ${checkpointId}`);
      }
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new SystemError(`Failed to load checkpoint: ${error.message}`);
    }
  }

  /**
   * Lists all checkpoints
   *
   * @param {Object} [filter] - Optional filter options
   * @param {string} [filter.workflowId] - Filter by workflow ID
   * @returns {Promise<Array<Object>>} Array of checkpoint metadata
   */
  async list(filter = {}) {
    try {
      // Ensure directory exists
      await fs.mkdir(this.options.checkpointDir, { recursive: true });

      // Read all checkpoint files
      const files = await fs.readdir(this.options.checkpointDir);
      const checkpoints = [];

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        try {
          const filePath = path.join(this.options.checkpointDir, file);
          const content = await fs.readFile(filePath, 'utf8');
          const checkpoint = JSON.parse(content);

          checkpoints.push({
            id: file.replace('.json', ''),
            workflowId: checkpoint.workflowId,
            timestamp: checkpoint.timestamp,
            age: calculateCheckpointAge(checkpoint),
            state: {
              currentStep: checkpoint.state?.currentStep,
              completedSteps: checkpoint.state?.completedSteps?.length || 0,
              progress: checkpoint.metadata?.progress || 0,
            },
          });
        } catch (err) {
          logger.warn(`Failed to read checkpoint ${file}: ${err.message}`);
        }
      }

      // Apply filters
      let filtered = checkpoints;
      if (filter.workflowId) {
        filtered = filterCheckpointsByWorkflow(filtered, filter.workflowId);
      }

      // Sort by time (newest first)
      return sortCheckpointsByTime(filtered);
    } catch (error) {
      throw new SystemError(`Failed to list checkpoints: ${error.message}`);
    }
  }

  /**
   * Deletes a checkpoint
   *
   * @param {string} checkpointId - Checkpoint ID
   * @returns {Promise<boolean>} True if deleted
   */
  async delete(checkpointId) {
    try {
      const filePath = this._getCheckpointPath(checkpointId);
      await fs.unlink(filePath);
      logger.info(`Checkpoint deleted: ${checkpointId}`);
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return false;
      }
      throw new SystemError(`Failed to delete checkpoint: ${error.message}`);
    }
  }

  /**
   * Cleans up old checkpoints
   *
   * @param {number} [maxAge] - Override max age in milliseconds
   * @returns {Promise<number>} Number of checkpoints cleaned up
   */
  async cleanup(maxAge = null) {
    const ageLimit = maxAge !== null ? maxAge : this.options.maxAge;

    try {
      const checkpoints = await this.list();
      let cleanedCount = 0;

      for (const checkpoint of checkpoints) {
        if (shouldCleanupCheckpoint(checkpoint, ageLimit)) {
          const deleted = await this.delete(checkpoint.id);
          if (deleted) {
            cleanedCount++;
          }
        }
      }

      if (cleanedCount > 0) {
        logger.info(`Cleaned up ${cleanedCount} old checkpoints`);
      }

      return cleanedCount;
    } catch (error) {
      throw new SystemError(`Failed to cleanup checkpoints: ${error.message}`);
    }
  }

  /**
   * Validates a checkpoint
   *
   * @param {string} checkpointId - Checkpoint ID
   * @returns {Promise<Object>} Validation result
   */
  async validate(checkpointId) {
    try {
      const checkpoint = await this.load(checkpointId);
      return validateCheckpoint(checkpoint);
    } catch (error) {
      return {
        valid: false,
        errors: [error.message],
      };
    }
  }

  /**
   * Gets the latest checkpoint for a workflow
   *
   * @param {string} workflowId - Workflow ID
   * @returns {Promise<Object|null>} Latest checkpoint or null
   */
  async getLatest(workflowId) {
    const checkpoints = await this.list({ workflowId });

    if (checkpoints.length === 0) {
      return null;
    }

    // Already sorted by time (newest first)
    return this.load(checkpoints[0].id);
  }

  /**
   * Resumes workflow from checkpoint
   *
   * @param {string} checkpointId - Checkpoint ID
   * @param {Object} currentState - Current state to merge with
   * @returns {Promise<Object>} Merged state for resuming
   */
  async resume(checkpointId, currentState = {}) {
    const checkpoint = await this.load(checkpointId);
    const mergedState = mergeCheckpointState(currentState, checkpoint.state);

    logger.info(`Resuming workflow from checkpoint: ${checkpointId}`);
    logger.debug(`Resume from step: ${mergedState.currentStep || 'start'}`);

    return {
      checkpoint,
      state: mergedState,
    };
  }

  /**
   * Gets checkpoint file path
   *
   * @private
   * @param {string} checkpointId - Checkpoint ID
   * @returns {string} File path
   */
  _getCheckpointPath(checkpointId) {
    return path.join(this.options.checkpointDir, `${checkpointId}.json`);
  }
}
