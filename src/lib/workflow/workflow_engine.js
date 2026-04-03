/**
 * @fileoverview WorkflowEngine class for orchestrating workflow steps in ai_workflow.js
 * @module lib/workflow/workflow_engine
 */

const GitSubmodule = require('../git/git_submodule');
const PromptPersona = require('../persona/prompt_persona');
const WorkflowStep = require('./workflow_step');

/**
 * Orchestrates workflow steps and manages submodules/personas.
 */
class WorkflowEngine {
  constructor() {
    /** @type {WorkflowStep[]} */
    this.steps = [];
    /** @type {GitSubmodule[]} */
    this.submodules = GitSubmodule.loadAll();
    /** @type {PromptPersona[]} */
    this.personas = PromptPersona.loadAll();
  }

  /**
   * Runs all workflow steps in order.
   * @returns {Promise<void>}
   */
  async run() {
    for (const step of this.steps) {
      await step.execute();
    }
  }

  /**
   * Integrates a new workflow step.
   * @param {WorkflowStep} step
   */
  integrateStep(step) {
    this.steps.push(step);
  }

  /**
   * Updates all git submodules.
   * @returns {Promise<void>}
   */
  async updateSubmodules() {
    for (const sub of this.submodules) {
      await sub.update();
    }
  }

  /**
   * Scans for new/modified personas and integrates corresponding steps.
   * @returns {void}
   */
  integratePersonas() {
    const newPersonas = PromptPersona.loadAll();
    for (const persona of newPersonas) {
      if (persona.detectChanges()) {
        // Example: create a dummy step for the persona
        const step = new WorkflowStep(`step_for_${persona.id}`, persona.id, async () => {
          // Placeholder: actual step logic would go here
          console.log(`Executing step for persona: ${persona.name}`);
        });
        this.integrateStep(step);
      }
    }
    this.personas = newPersonas;
  }
}

module.exports = WorkflowEngine;
