/**
 * @fileoverview Dependency Resolver - Resolves step dependencies and determines execution order
 * @module orchestrator/dependency_resolver
 * @version 2.0.0
 *
 * Provides dependency graph construction, topological sorting, circular dependency detection,
 * and parallel execution group identification. Follows referential transparency pattern with
 * pure functions for business logic and DependencyResolver class for state management.
 *
 * Architecture:
 * - Pure functions: Graph construction, topological sort, cycle detection, parallel grouping
 * - Impure wrapper: DependencyResolver class for analysis and visualization
 */

import { logger } from '../core/logger.js';
import { ValidationError } from '../utils/errors.js';

/**
 * Builds a dependency graph from step definitions
 *
 * @param {Array<Object>} steps - Array of step definitions with id and dependencies
 * @returns {Object} Dependency graph with adjacency lists and in-degrees
 * @pure
 *
 * @example
 * const steps = [
 *   { id: 'step1', dependencies: [] },
 *   { id: 'step2', dependencies: ['step1'] },
 * ];
 * const graph = buildDependencyGraph(steps);
 * // => { nodes: Map, edges: Map, inDegree: Map }
 */
export function buildDependencyGraph(steps) {
  const graph = {
    nodes: new Map(), // stepId -> step definition
    edges: new Map(), // stepId -> [dependent step IDs]
    inDegree: new Map(), // stepId -> number of dependencies
  };

  if (!Array.isArray(steps)) {
    return graph;
  }

  // Initialize nodes and in-degrees
  for (const step of steps) {
    if (!step.id) continue;

    graph.nodes.set(step.id, step);
    graph.edges.set(step.id, []);
    graph.inDegree.set(step.id, 0);
  }

  // Build edges and calculate in-degrees
  for (const step of steps) {
    if (!step.id) continue;

    const dependencies = step.dependencies || [];
    for (const depId of dependencies) {
      if (graph.nodes.has(depId)) {
        // Add edge from dependency to dependent
        const dependents = graph.edges.get(depId) || [];
        dependents.push(step.id);
        graph.edges.set(depId, dependents);

        // Increment in-degree
        graph.inDegree.set(step.id, (graph.inDegree.get(step.id) || 0) + 1);
      }
    }
  }

  return graph;
}

/**
 * Computes the number of nodes transitively reachable (downstream) from each node.
 *
 * Used to prioritise critical-gate steps in topological sort: a step that blocks
 * many downstream steps should run before a sibling that blocks fewer, reducing
 * the wall-clock cost of failures detected late in the run.
 *
 * @param {Object} graph - Dependency graph from buildDependencyGraph
 * @returns {Map<string, number>} stepId -> count of transitively reachable steps
 * @pure
 */
export function computeDownstreamCounts(graph) {
  const counts = new Map();
  for (const nodeId of graph.nodes.keys()) {
    const visited = new Set();
    const queue = [nodeId];
    while (queue.length > 0) {
      const current = queue.shift();
      for (const dep of graph.edges.get(current) || []) {
        if (!visited.has(dep)) {
          visited.add(dep);
          queue.push(dep);
        }
      }
    }
    counts.set(nodeId, visited.size);
  }
  return counts;
}

/**
 * Performs topological sort on a dependency graph using Kahn's algorithm with
 * downstream-count priority.
 *
 * When multiple steps are simultaneously ready (all dependencies satisfied), the
 * step with the highest downstream count is scheduled first. This ensures that
 * critical-gate steps (e.g. Test Execution which blocks 9 downstream steps) are
 * not delayed behind expensive but non-critical siblings (e.g. Documentation
 * Updates), minimising wasted work when a gate step fails.
 *
 * @param {Object} graph - Dependency graph from buildDependencyGraph
 * @returns {Array<string>} Ordered step IDs (dependencies before dependents)
 * @throws {ValidationError} If circular dependency detected
 * @pure
 *
 * @example
 * const graph = buildDependencyGraph(steps);
 * const order = topologicalSort(graph);
 * // => ['step1', 'step2', 'step3']
 */
export function topologicalSort(graph) {
  const result = [];
  const inDegree = new Map(graph.inDegree);
  const downstreamCounts = computeDownstreamCounts(graph);
  const ready = new Set();

  // Seed: all nodes with no dependencies
  for (const [nodeId, degree] of inDegree.entries()) {
    if (degree === 0) {
      ready.add(nodeId);
    }
  }

  while (ready.size > 0) {
    // Pick the ready node with the most downstream dependents first
    const current = [...ready].sort(
      (a, b) => (downstreamCounts.get(b) || 0) - (downstreamCounts.get(a) || 0)
    )[0];
    ready.delete(current);
    result.push(current);

    for (const depId of graph.edges.get(current) || []) {
      const newDegree = inDegree.get(depId) - 1;
      inDegree.set(depId, newDegree);
      if (newDegree === 0) {
        ready.add(depId);
      }
    }
  }

  // Check for cycles
  if (result.length !== graph.nodes.size) {
    throw new ValidationError('Circular dependency detected in step graph');
  }

  return result;
}

/**
 * Detects circular dependencies in a dependency graph and returns the cycle path
 *
 * @param {Object} graph - Dependency graph from buildDependencyGraph
 * @returns {Object} Result with hasCycle flag and cycle path if found
 * @pure
 *
 * @example
 * const result = detectCircularDependencies(graph);
 * // => { hasCycle: true, cycle: ['step1', 'step2', 'step3', 'step1'] }
 */
export function detectCircularDependencies(graph) {
  const result = {
    hasCycle: false,
    cycle: null,
  };

  const visited = new Set();
  const recStack = new Set();
  const path = [];

  /**
   * DFS helper to detect cycles
   */
  function dfs(nodeId) {
    if (recStack.has(nodeId)) {
      // Found cycle - build cycle path
      const cycleStart = path.indexOf(nodeId);
      result.hasCycle = true;
      result.cycle = [...path.slice(cycleStart), nodeId];
      return true;
    }

    if (visited.has(nodeId)) {
      return false;
    }

    visited.add(nodeId);
    recStack.add(nodeId);
    path.push(nodeId);

    // Check dependencies
    const node = graph.nodes.get(nodeId);
    const dependencies = node?.dependencies || [];

    for (const depId of dependencies) {
      if (graph.nodes.has(depId)) {
        if (dfs(depId)) {
          return true;
        }
      }
    }

    recStack.delete(nodeId);
    path.pop();
    return false;
  }

  // Check all nodes
  for (const nodeId of graph.nodes.keys()) {
    if (!visited.has(nodeId)) {
      if (dfs(nodeId)) {
        break;
      }
    }
  }

  return result;
}

/**
 * Groups steps that can be executed in parallel
 *
 * @param {Array<string>} orderedStepIds - Topologically sorted step IDs
 * @param {Object} graph - Dependency graph
 * @returns {Array<Array<string>>} Array of parallel execution groups
 * @pure
 *
 * @example
 * const groups = groupParallelSteps(['step1', 'step2', 'step3'], graph);
 * // => [['step1'], ['step2', 'step3']] // step2 and step3 can run in parallel
 */
export function groupParallelSteps(orderedStepIds, graph) {
  if (!Array.isArray(orderedStepIds) || orderedStepIds.length === 0) {
    return [];
  }

  const groups = [];
  const processed = new Set();

  for (const stepId of orderedStepIds) {
    if (processed.has(stepId)) continue;

    // Start a new parallel group
    const group = [stepId];
    processed.add(stepId);

    // Find steps that can run in parallel with current step
    const stepDeps = new Set(graph.nodes.get(stepId)?.dependencies || []);

    for (const candidateId of orderedStepIds) {
      if (processed.has(candidateId)) continue;

      // Check if candidate can run in parallel
      const candidateDeps = new Set(graph.nodes.get(candidateId)?.dependencies || []);

      // Can run in parallel if:
      // 1. Candidate doesn't depend on current step
      // 2. Current step doesn't depend on candidate
      // 3. Both have same dependencies satisfied
      const dependsOnCurrent = candidateDeps.has(stepId);
      const currentDependsOnCandidate = stepDeps.has(candidateId);

      if (!dependsOnCurrent && !currentDependsOnCandidate) {
        // Check if all dependencies of both steps are satisfied
        const allDepsInProcessed = [...candidateDeps, ...stepDeps].every((d) => processed.has(d));

        if (allDepsInProcessed) {
          group.push(candidateId);
          processed.add(candidateId);
        }
      }
    }

    groups.push(group);
  }

  return groups;
}

/**
 * Validates that all dependencies in a graph are valid
 *
 * @param {Object} graph - Dependency graph from buildDependencyGraph
 * @returns {Object} Validation result with errors
 * @pure
 *
 * @example
 * const result = validateDependencies(graph);
 * // => { valid: true, errors: [] }
 */
export function validateDependencies(graph) {
  const result = {
    valid: true,
    errors: [],
  };

  for (const [nodeId, node] of graph.nodes.entries()) {
    const dependencies = node.dependencies || [];

    for (const depId of dependencies) {
      // Check if dependency exists
      if (!graph.nodes.has(depId)) {
        result.valid = false;
        result.errors.push(`Step '${nodeId}' depends on non-existent step '${depId}'`);
      }

      // Check for self-dependency
      if (depId === nodeId) {
        result.valid = false;
        result.errors.push(`Step '${nodeId}' has self-dependency`);
      }
    }
  }

  return result;
}

/**
 * Checks if two steps can run in parallel
 *
 * @param {Object} stepA - First step definition
 * @param {Object} stepB - Second step definition
 * @param {Object} graph - Dependency graph
 * @returns {boolean} True if steps can run in parallel
 * @pure
 */
export function canRunInParallel(stepA, stepB, graph) {
  if (!stepA || !stepB || !graph) {
    return false;
  }

  const depsA = new Set(stepA.dependencies || []);
  const depsB = new Set(stepB.dependencies || []);

  // Cannot run in parallel if one depends on the other
  if (depsA.has(stepB.id) || depsB.has(stepA.id)) {
    return false;
  }

  // Check for indirect dependencies using graph
  const hasPath = (from, to, visited = new Set()) => {
    if (from === to) return true;
    if (visited.has(from)) return false;

    visited.add(from);
    const deps = graph.nodes.get(from)?.dependencies || [];

    for (const dep of deps) {
      if (hasPath(dep, to, visited)) {
        return true;
      }
    }

    return false;
  };

  // Check for transitive dependencies
  return !hasPath(stepA.id, stepB.id) && !hasPath(stepB.id, stepA.id);
}

/**
 * Calculates the critical path (longest path) through the dependency graph
 *
 * @param {Object} graph - Dependency graph
 * @param {Object} stepDurations - Map of stepId -> duration in seconds
 * @returns {Object} Critical path with steps and total duration
 * @pure
 */
export function calculateCriticalPath(graph, stepDurations = {}) {
  const result = {
    path: [],
    duration: 0,
  };

  if (graph.nodes.size === 0) {
    return result;
  }

  // Get topological order
  let orderedIds;
  try {
    orderedIds = topologicalSort(graph);
  } catch {
    return result;
  }

  // Calculate earliest start times
  const earliestStart = new Map();
  const predecessors = new Map();

  for (const stepId of orderedIds) {
    let maxStart = 0;
    let predecessor = null;

    const dependencies = graph.nodes.get(stepId)?.dependencies || [];
    for (const depId of dependencies) {
      const depDuration = stepDurations[depId] || 0;
      const depStart = earliestStart.get(depId) || 0;
      const finish = depStart + depDuration;

      if (finish > maxStart) {
        maxStart = finish;
        predecessor = depId;
      }
    }

    earliestStart.set(stepId, maxStart);
    predecessors.set(stepId, predecessor);
  }

  // Find step with maximum finish time
  let maxFinish = 0;
  let lastStep = null;

  for (const stepId of orderedIds) {
    const start = earliestStart.get(stepId) || 0;
    const duration = stepDurations[stepId] || 0;
    const finish = start + duration;

    if (finish > maxFinish) {
      maxFinish = finish;
      lastStep = stepId;
    }
  }

  // Reconstruct critical path
  const path = [];
  let current = lastStep;

  while (current) {
    path.unshift(current);
    current = predecessors.get(current);
  }

  result.path = path;
  result.duration = maxFinish;

  return result;
}

/**
 * Dependency Resolver - Manages dependency analysis and resolution
 *
 * Impure wrapper class that provides:
 * - Dependency graph analysis
 * - Execution order resolution
 * - Parallel execution planning
 * - Dependency visualization (future)
 *
 * Side effects:
 * - Maintains in-memory dependency graph (mutable)
 * - Console logging via logger
 *
 * @class
 */
export class DependencyResolver {
  constructor() {
    this.graph = null;
    this.orderedSteps = null;
    this.parallelGroups = null;
  }

  /**
   * Analyzes step dependencies and builds dependency graph
   *
   * @param {Array<Object>} steps - Array of step definitions
   * @returns {Object} Analysis result with graph, order, and groups
   * @throws {ValidationError} If circular dependencies or invalid dependencies found
   */
  analyze(steps) {
    logger.debug(`Analyzing dependencies for ${steps.length} steps`);

    // Build dependency graph
    this.graph = buildDependencyGraph(steps);

    // Validate dependencies
    const validation = validateDependencies(this.graph);
    if (!validation.valid) {
      logger.error(`Dependency validation failed: ${validation.errors.join('; ')}`);
      throw new ValidationError(`Invalid dependencies: ${validation.errors.join('; ')}`);
    }

    // Check for circular dependencies
    const cycleCheck = detectCircularDependencies(this.graph);
    if (cycleCheck.hasCycle) {
      const cyclePath = cycleCheck.cycle.join(' -> ');
      logger.error(`Circular dependency detected: ${cyclePath}`);
      throw new ValidationError(`Circular dependency: ${cyclePath}`);
    }

    // Perform topological sort
    this.orderedSteps = topologicalSort(this.graph);

    // Identify parallel execution groups
    this.parallelGroups = groupParallelSteps(this.orderedSteps, this.graph);

    logger.debug(
      `Dependency analysis complete: ${this.orderedSteps.length} steps, ${this.parallelGroups.length} execution groups`
    );

    return {
      graph: this.graph,
      order: this.orderedSteps,
      groups: this.parallelGroups,
    };
  }

  /**
   * Resolves execution order for steps, optionally starting from a specific step
   *
   * @param {Array<Object>} steps - Array of step definitions
   * @param {string} [startStep] - Optional step ID to start from
   * @returns {Array<string>} Ordered step IDs for execution
   * @throws {ValidationError} If startStep not found or dependencies invalid
   */
  resolve(steps, startStep = null) {
    // Run analysis if not already done
    if (!this.orderedSteps) {
      this.analyze(steps);
    }

    // If no start step specified, return full order
    if (!startStep) {
      return this.orderedSteps;
    }

    // Validate start step exists
    if (!this.graph.nodes.has(startStep)) {
      throw new ValidationError(`Start step '${startStep}' not found`);
    }

    // Find index of start step
    const startIndex = this.orderedSteps.indexOf(startStep);
    if (startIndex === -1) {
      throw new ValidationError(`Start step '${startStep}' not in execution order`);
    }

    // Return steps from start point onward
    return this.orderedSteps.slice(startIndex);
  }

  /**
   * Checks if two steps can run in parallel
   *
   * @param {string} stepIdA - First step ID
   * @param {string} stepIdB - Second step ID
   * @returns {boolean} True if steps can run in parallel
   * @throws {ValidationError} If steps not found or analysis not performed
   */
  canRunInParallel(stepIdA, stepIdB) {
    if (!this.graph) {
      throw new ValidationError('Must call analyze() before checking parallelism');
    }

    const stepA = this.graph.nodes.get(stepIdA);
    const stepB = this.graph.nodes.get(stepIdB);

    if (!stepA || !stepB) {
      throw new ValidationError('Both steps must exist in dependency graph');
    }

    return canRunInParallel(stepA, stepB, this.graph);
  }

  /**
   * Gets parallel execution groups
   *
   * @returns {Array<Array<string>>} Array of parallel execution groups
   * @throws {ValidationError} If analysis not performed
   */
  getParallelGroups() {
    if (!this.parallelGroups) {
      throw new ValidationError('Must call analyze() before getting parallel groups');
    }

    return this.parallelGroups;
  }

  /**
   * Calculates the critical path through the workflow
   *
   * @param {Object} stepDurations - Map of stepId -> duration in seconds
   * @returns {Object} Critical path with steps and total duration
   * @throws {ValidationError} If analysis not performed
   */
  getCriticalPath(stepDurations = {}) {
    if (!this.graph) {
      throw new ValidationError('Must call analyze() before calculating critical path');
    }

    return calculateCriticalPath(this.graph, stepDurations);
  }

  /**
   * Gets dependency information for a specific step
   *
   * @param {string} stepId - Step ID
   * @returns {Object} Dependency information
   * @throws {ValidationError} If step not found or analysis not performed
   */
  getStepInfo(stepId) {
    if (!this.graph) {
      throw new ValidationError('Must call analyze() before getting step info');
    }

    const step = this.graph.nodes.get(stepId);
    if (!step) {
      throw new ValidationError(`Step '${stepId}' not found`);
    }

    const dependencies = step.dependencies || [];
    const dependents = this.graph.edges.get(stepId) || [];

    return {
      id: stepId,
      dependencies,
      dependents,
      inDegree: this.graph.inDegree.get(stepId) || 0,
    };
  }

  /**
   * Visualizes the dependency graph (placeholder for future implementation)
   *
   * @returns {string} Text representation of dependency graph
   */
  visualize() {
    if (!this.graph) {
      return 'No dependency graph available. Call analyze() first.';
    }

    const lines = ['Dependency Graph:', ''];

    for (const [stepId, step] of this.graph.nodes.entries()) {
      const deps = step.dependencies || [];
      const dependents = this.graph.edges.get(stepId) || [];

      lines.push(`${stepId}:`);
      if (deps.length > 0) {
        lines.push(`  Depends on: ${deps.join(', ')}`);
      }
      if (dependents.length > 0) {
        lines.push(`  Required by: ${dependents.join(', ')}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Clears cached analysis results
   */
  clear() {
    this.graph = null;
    this.orderedSteps = null;
    this.parallelGroups = null;
    logger.debug('Cleared dependency resolver cache');
  }
}
