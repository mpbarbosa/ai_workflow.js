/**
 * @fileoverview WorkflowStep class for ai_workflow.js
 * @module lib/workflow/workflow_step
 */

/**
 * Represents a workflow step.
 */
class WorkflowStep {
  /**
   * @param {string} id - Step ID.
   * @param {string} personaId - Associated persona ID.
   * @param {Function} executeFn - Step execution function.
   */
  constructor(id, personaId, executeFn) {
    /** @type {string} */
    this.id = id;
    /** @type {string} */
    this.personaId = personaId;
    /** @type {Function} */
    this.execute = executeFn;
  }
}

module.exports = WorkflowStep;
