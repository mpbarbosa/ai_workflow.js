/**
 * @fileoverview Orchestrator parallel step execution integration tests
 * @module test/integration/orchestrator/parallel.integration.test.js
 *
 * Tests the parallel step grouping and dependency resolver pure functions:
 * buildDependencyGraph, topologicalSort, detectCircularDependencies,
 * groupParallelSteps, canRunInParallel, calculateCriticalPath.
 *
 * @version 1.0.0
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import {
  buildDependencyGraph,
  topologicalSort,
  detectCircularDependencies,
  groupParallelSteps,
  validateDependencies,
  canRunInParallel,
} from '../../../src/orchestrator/dependency_resolver.js';
import { createTempProject, cleanupTempProject } from '../../helpers/integration.js';

let tempDir;

beforeEach(async () => {
  tempDir = await createTempProject('nodejs-api');
});
afterEach(async () => {
  await cleanupTempProject(tempDir);
});

// ---------------------------------------------------------------------------
// Sample step definitions
// ---------------------------------------------------------------------------

const stepsLinear = [
  { id: 'step_00', dependencies: [] },
  { id: 'step_01', dependencies: ['step_00'] },
  { id: 'step_02', dependencies: ['step_01'] },
];

const stepsParallel = [
  { id: 'step_00', dependencies: [] },
  { id: 'step_01', dependencies: ['step_00'] },
  { id: 'step_02', dependencies: ['step_00'] }, // parallel with step_01
  { id: 'step_03', dependencies: ['step_01', 'step_02'] },
];

// ---------------------------------------------------------------------------
// buildDependencyGraph
// ---------------------------------------------------------------------------

describe('buildDependencyGraph', () => {
  test('returns an object with nodes, edges, inDegree', () => {
    const graph = buildDependencyGraph(stepsLinear);
    expect(typeof graph).toBe('object');
    expect(graph.nodes).toBeDefined();
    expect(graph.edges).toBeDefined();
    expect(graph.inDegree).toBeDefined();
  });

  test('graph contains all step ids in nodes Map', () => {
    const graph = buildDependencyGraph(stepsLinear);
    for (const step of stepsLinear) {
      expect(graph.nodes.has(step.id)).toBe(true);
    }
  });

  test('empty steps produces graph with empty nodes', () => {
    const graph = buildDependencyGraph([]);
    expect(graph.nodes.size).toBe(0);
  });

  test('step with no dependencies has zero inDegree', () => {
    const graph = buildDependencyGraph(stepsLinear);
    expect(graph.inDegree.get('step_00')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// topologicalSort
// ---------------------------------------------------------------------------

describe('topologicalSort', () => {
  test('returns an array', () => {
    const graph = buildDependencyGraph(stepsLinear);
    const sorted = topologicalSort(graph);
    expect(Array.isArray(sorted)).toBe(true);
  });

  test('sorted array has same length as graph', () => {
    const graph = buildDependencyGraph(stepsLinear);
    const sorted = topologicalSort(graph);
    expect(sorted.length).toBe(stepsLinear.length);
  });

  test('step_00 comes before step_01 in linear graph', () => {
    const graph = buildDependencyGraph(stepsLinear);
    const sorted = topologicalSort(graph);
    const idx00 = sorted.indexOf('step_00');
    const idx01 = sorted.indexOf('step_01');
    expect(idx00).toBeLessThan(idx01);
  });

  test('step_01 comes before step_02 in linear graph', () => {
    const graph = buildDependencyGraph(stepsLinear);
    const sorted = topologicalSort(graph);
    expect(sorted.indexOf('step_01')).toBeLessThan(sorted.indexOf('step_02'));
  });
});

// ---------------------------------------------------------------------------
// detectCircularDependencies
// ---------------------------------------------------------------------------

describe('detectCircularDependencies', () => {
  test('linear graph has no cycles (hasCycle: false)', () => {
    const graph = buildDependencyGraph(stepsLinear);
    const result = detectCircularDependencies(graph);
    expect(result.hasCycle).toBe(false);
  });

  test('parallel graph has no cycles', () => {
    const graph = buildDependencyGraph(stepsParallel);
    const result = detectCircularDependencies(graph);
    expect(result.hasCycle).toBe(false);
  });

  test('graph with circular dep returns hasCycle: true', () => {
    const circular = [
      { id: 'A', dependencies: ['B'] },
      { id: 'B', dependencies: ['A'] },
    ];
    const graph = buildDependencyGraph(circular);
    const result = detectCircularDependencies(graph);
    expect(result.hasCycle).toBe(true);
    expect(result.cycle).not.toBeNull();
    expect(result.cycle.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// groupParallelSteps
// ---------------------------------------------------------------------------

describe('groupParallelSteps', () => {
  test('returns an array of groups', () => {
    const graph = buildDependencyGraph(stepsParallel);
    const sorted = topologicalSort(graph);
    const groups = groupParallelSteps(sorted, graph);
    expect(Array.isArray(groups)).toBe(true);
  });

  test('each group is an array', () => {
    const graph = buildDependencyGraph(stepsParallel);
    const sorted = topologicalSort(graph);
    const groups = groupParallelSteps(sorted, graph);
    for (const group of groups) {
      expect(Array.isArray(group)).toBe(true);
    }
  });

  test('step_01 and step_02 may be in the same parallel group', () => {
    const graph = buildDependencyGraph(stepsParallel);
    const sorted = topologicalSort(graph);
    const groups = groupParallelSteps(sorted, graph);
    const parallelGroup = groups.find((g) => g.includes('step_01') && g.includes('step_02'));
    // They share the same dependency (step_00), so they CAN run in parallel
    expect(parallelGroup).toBeDefined();
  });

  test('linear graph: every group has exactly one step', () => {
    const graph = buildDependencyGraph(stepsLinear);
    const sorted = topologicalSort(graph);
    const groups = groupParallelSteps(sorted, graph);
    // In a purely linear graph, no two steps can run in parallel
    for (const group of groups) {
      expect(group.length).toBe(1);
    }
  });
});

// ---------------------------------------------------------------------------
// canRunInParallel
// ---------------------------------------------------------------------------

describe('canRunInParallel', () => {
  test('step_01 and step_02 can run in parallel (both depend on step_00)', () => {
    const graph = buildDependencyGraph(stepsParallel);
    const step01 = stepsParallel.find((s) => s.id === 'step_01');
    const step02 = stepsParallel.find((s) => s.id === 'step_02');
    expect(canRunInParallel(step01, step02, graph)).toBe(true);
  });

  test('step_00 and step_01 cannot run in parallel (sequential dep)', () => {
    const graph = buildDependencyGraph(stepsParallel);
    const step00 = stepsParallel.find((s) => s.id === 'step_00');
    const step01 = stepsParallel.find((s) => s.id === 'step_01');
    expect(canRunInParallel(step00, step01, graph)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateDependencies
// ---------------------------------------------------------------------------

describe('validateDependencies', () => {
  test('valid linear graph passes', () => {
    const graph = buildDependencyGraph(stepsLinear);
    const result = validateDependencies(graph);
    expect(result.valid).toBe(true);
  });

  test('graph with missing dep reference fails', () => {
    const broken = [{ id: 'step_01', dependencies: ['nonexistent_step'] }];
    const graph = buildDependencyGraph(broken);
    const result = validateDependencies(graph);
    expect(result.valid).toBe(false);
  });
});
