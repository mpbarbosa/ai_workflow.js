/**
 * @fileoverview Step contract types for ai_workflow.js
 * @module steps/step_contract
 * @version 1.0.0
 *
 * Defines the two step kinds used by the workflow orchestrator and the
 * contracts each kind must satisfy.
 *
 * ─── Step Kind Overview ───────────────────────────────────────────────────
 *
 * STEP_KIND.PROJECT  — "Project Step"
 *   execute(projectRoot: string, options?: Object): Promise<StepResult>
 *
 *   • First argument is an absolute filesystem path (the project root).
 *   • Uses the global logger singleton imported from '../core/logger.js'.
 *     All output is automatically captured in the run log file.
 *   • Constructor receives shared orchestrator dependencies:
 *       constructor(deps = {}) { this.gitOps = deps.gitOps; … }
 *   • Intended for steps that inspect, validate, or analyse project files.
 *   • Steps: 00, 01, 02, 02_5, 03, 04, 05, 06, 07, 08, 09, 10, 11
 *
 * STEP_KIND.CONTEXT  — "Context Step"
 *   execute(context: Object): Promise<StepResult>
 *
 *   • First argument is a workflow context object:
 *       { projectRoot: string, workflowDir?: string, … }
 *   • Uses an injected this.logger (from constructor options), which the
 *     orchestrator supplies from the global singleton so output reaches
 *     the run log file.
 *   • Constructor receives self-contained service options:
 *       constructor(options = {}) { this.logger = options.logger || console; … }
 *   • Intended for steps that perform workflow-level actions (git, lint,
 *     version updates, summaries) and need rich context beyond a path.
 *   • Steps: 0b, 12, 13, 14, 15, 16, 17
 *
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Usage in step classes:
 *
 *   import { STEP_KIND } from './step_contract.js';
 *
 *   export class MyStep {
 *     static stepKind = STEP_KIND.PROJECT;   // or STEP_KIND.CONTEXT
 *     …
 *   }
 *
 * The orchestrator reads ExecutorClass.stepKind to dispatch correctly:
 *   PROJECT → executor.execute(projectRoot)
 *   CONTEXT → executor.execute({ projectRoot, ...context })
 */

/**
 * Enumeration of the two supported step execution contracts.
 *
 * @readonly
 * @enum {string}
 */
export const STEP_KIND = Object.freeze({
  /**
   * Project Step — execute(projectRoot: string, options?: Object)
   *
   * Receive the project's root directory path as the first argument.
   * Use the global logger singleton for output.
   */
  PROJECT: 'project',

  /**
   * Context Step — execute(context: Object)
   *
   * Receive a full workflow context object { projectRoot, … } as the
   * first argument. Use this.logger (injected via constructor options).
   */
  CONTEXT: 'context',
});

/**
 * @typedef {Object} StepResult
 * @property {boolean} success  - Whether the step completed successfully.
 * @property {boolean} [skipped] - True when the step was intentionally skipped.
 * @property {string}  [reason]  - Human-readable reason for skip or failure.
 * @property {string}  [error]   - Error message on failure.
 * @property {Object}  [summary] - Step-specific result payload.
 */

/**
 * @typedef {Object} ProjectStepContext
 * @property {string} projectRoot - Absolute path to the project root.
 */

/**
 * @typedef {Object} WorkflowContext
 * @property {string}  projectRoot   - Absolute path to the project root.
 * @property {string}  [workflowDir] - Workflow artifacts directory (default: '.ai_workflow').
 * @property {boolean} [auto]        - Whether the workflow is running in auto (non-interactive) mode.
 */
