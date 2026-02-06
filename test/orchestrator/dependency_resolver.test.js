/**
 * @fileoverview Tests for Dependency Resolver Module
 * @module test/orchestrator/dependency_resolver
 */

import {
  buildDependencyGraph,
  topologicalSort,
  detectCircularDependencies,
  groupParallelSteps,
  validateDependencies,
  canRunInParallel,
  calculateCriticalPath,
  DependencyResolver,
} from '../../src/orchestrator/dependency_resolver.js';
import { ValidationError } from '../../src/utils/errors.js';

describe('Dependency Resolver Module', () => {
  // ============================================================================
  // Pure Function Tests
  // ============================================================================

  describe('Pure Functions - buildDependencyGraph', () => {
    test('builds graph for simple steps', () => {
      const steps = [
        { id: 'step1', dependencies: [] },
        { id: 'step2', dependencies: ['step1'] },
      ];

      const graph = buildDependencyGraph(steps);

      expect(graph.nodes.size).toBe(2);
      expect(graph.edges.get('step1')).toEqual(['step2']);
      expect(graph.inDegree.get('step1')).toBe(0);
      expect(graph.inDegree.get('step2')).toBe(1);
    });

    test('builds graph for complex dependencies', () => {
      const steps = [
        { id: 'step1', dependencies: [] },
        { id: 'step2', dependencies: ['step1'] },
        { id: 'step3', dependencies: ['step1', 'step2'] },
      ];

      const graph = buildDependencyGraph(steps);

      expect(graph.nodes.size).toBe(3);
      expect(graph.edges.get('step1')).toContain('step2');
      expect(graph.edges.get('step1')).toContain('step3');
      expect(graph.inDegree.get('step3')).toBe(2);
    });

    test('handles empty array', () => {
      const graph = buildDependencyGraph([]);

      expect(graph.nodes.size).toBe(0);
      expect(graph.edges.size).toBe(0);
    });

    test('handles steps without dependencies', () => {
      const steps = [{ id: 'step1' }, { id: 'step2' }];

      const graph = buildDependencyGraph(steps);

      expect(graph.nodes.size).toBe(2);
      expect(graph.inDegree.get('step1')).toBe(0);
      expect(graph.inDegree.get('step2')).toBe(0);
    });

    test('ignores non-existent dependencies', () => {
      const steps = [
        { id: 'step1', dependencies: [] },
        { id: 'step2', dependencies: ['step1', 'step99'] },
      ];

      const graph = buildDependencyGraph(steps);

      expect(graph.inDegree.get('step2')).toBe(1); // Only step1 counts
    });
  });

  describe('Pure Functions - topologicalSort', () => {
    test('sorts simple linear dependencies', () => {
      const steps = [
        { id: 'step1', dependencies: [] },
        { id: 'step2', dependencies: ['step1'] },
        { id: 'step3', dependencies: ['step2'] },
      ];

      const graph = buildDependencyGraph(steps);
      const order = topologicalSort(graph);

      expect(order).toEqual(['step1', 'step2', 'step3']);
    });

    test('sorts steps with multiple dependencies', () => {
      const steps = [
        { id: 'step1', dependencies: [] },
        { id: 'step2', dependencies: [] },
        { id: 'step3', dependencies: ['step1', 'step2'] },
      ];

      const graph = buildDependencyGraph(steps);
      const order = topologicalSort(graph);

      expect(order[2]).toBe('step3'); // step3 must be last
      expect(order.slice(0, 2)).toContain('step1');
      expect(order.slice(0, 2)).toContain('step2');
    });

    test('throws error for circular dependencies', () => {
      const steps = [
        { id: 'step1', dependencies: ['step2'] },
        { id: 'step2', dependencies: ['step1'] },
      ];

      const graph = buildDependencyGraph(steps);

      expect(() => topologicalSort(graph)).toThrow(ValidationError);
    });

    test('handles empty graph', () => {
      const graph = {
        nodes: new Map(),
        edges: new Map(),
        inDegree: new Map(),
      };

      const order = topologicalSort(graph);

      expect(order).toEqual([]);
    });

    test('handles single node', () => {
      const steps = [{ id: 'step1', dependencies: [] }];
      const graph = buildDependencyGraph(steps);

      const order = topologicalSort(graph);

      expect(order).toEqual(['step1']);
    });
  });

  describe('Pure Functions - detectCircularDependencies', () => {
    test('detects simple circular dependency', () => {
      const steps = [
        { id: 'step1', dependencies: ['step2'] },
        { id: 'step2', dependencies: ['step1'] },
      ];

      const graph = buildDependencyGraph(steps);
      const result = detectCircularDependencies(graph);

      expect(result.hasCycle).toBe(true);
      expect(result.cycle).toBeTruthy();
      expect(result.cycle.length).toBeGreaterThan(2);
    });

    test('detects complex circular dependency', () => {
      const steps = [
        { id: 'step1', dependencies: ['step2'] },
        { id: 'step2', dependencies: ['step3'] },
        { id: 'step3', dependencies: ['step1'] },
      ];

      const graph = buildDependencyGraph(steps);
      const result = detectCircularDependencies(graph);

      expect(result.hasCycle).toBe(true);
      expect(result.cycle).toBeTruthy();
    });

    test('returns no cycle for valid graph', () => {
      const steps = [
        { id: 'step1', dependencies: [] },
        { id: 'step2', dependencies: ['step1'] },
        { id: 'step3', dependencies: ['step2'] },
      ];

      const graph = buildDependencyGraph(steps);
      const result = detectCircularDependencies(graph);

      expect(result.hasCycle).toBe(false);
      expect(result.cycle).toBeNull();
    });

    test('handles empty graph', () => {
      const graph = {
        nodes: new Map(),
        edges: new Map(),
        inDegree: new Map(),
      };

      const result = detectCircularDependencies(graph);

      expect(result.hasCycle).toBe(false);
    });
  });

  describe('Pure Functions - groupParallelSteps', () => {
    test('groups independent steps together', () => {
      const steps = [
        { id: 'step1', dependencies: [] },
        { id: 'step2', dependencies: [] },
        { id: 'step3', dependencies: [] },
      ];

      const graph = buildDependencyGraph(steps);
      const order = topologicalSort(graph);
      const groups = groupParallelSteps(order, graph);

      expect(groups.length).toBe(1);
      expect(groups[0]).toHaveLength(3);
    });

    test('separates dependent steps', () => {
      const steps = [
        { id: 'step1', dependencies: [] },
        { id: 'step2', dependencies: ['step1'] },
        { id: 'step3', dependencies: ['step2'] },
      ];

      const graph = buildDependencyGraph(steps);
      const order = topologicalSort(graph);
      const groups = groupParallelSteps(order, graph);

      expect(groups.length).toBe(3);
      expect(groups[0]).toEqual(['step1']);
      expect(groups[1]).toEqual(['step2']);
      expect(groups[2]).toEqual(['step3']);
    });

    test('groups steps with same dependencies', () => {
      const steps = [
        { id: 'step1', dependencies: [] },
        { id: 'step2', dependencies: ['step1'] },
        { id: 'step3', dependencies: ['step1'] },
      ];

      const graph = buildDependencyGraph(steps);
      const order = topologicalSort(graph);
      const groups = groupParallelSteps(order, graph);

      expect(groups.length).toBe(2);
      expect(groups[0]).toEqual(['step1']);
      expect(groups[1]).toHaveLength(2);
      expect(groups[1]).toContain('step2');
      expect(groups[1]).toContain('step3');
    });

    test('handles empty array', () => {
      const graph = buildDependencyGraph([]);
      const groups = groupParallelSteps([], graph);

      expect(groups).toEqual([]);
    });
  });

  describe('Pure Functions - validateDependencies', () => {
    test('validates correct dependencies', () => {
      const steps = [
        { id: 'step1', dependencies: [] },
        { id: 'step2', dependencies: ['step1'] },
      ];

      const graph = buildDependencyGraph(steps);
      const result = validateDependencies(graph);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('detects non-existent dependencies', () => {
      const steps = [
        { id: 'step1', dependencies: [] },
        { id: 'step2', dependencies: ['step1', 'step99'] },
      ];

      const graph = buildDependencyGraph(steps);
      const result = validateDependencies(graph);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('step99');
    });

    test('detects self-dependencies', () => {
      const steps = [{ id: 'step1', dependencies: ['step1'] }];

      const graph = buildDependencyGraph(steps);
      const result = validateDependencies(graph);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('self-dependency'))).toBe(true);
    });

    test('handles empty graph', () => {
      const graph = {
        nodes: new Map(),
        edges: new Map(),
        inDegree: new Map(),
      };

      const result = validateDependencies(graph);

      expect(result.valid).toBe(true);
    });
  });

  describe('Pure Functions - canRunInParallel', () => {
    test('allows parallel for independent steps', () => {
      const steps = [
        { id: 'step1', dependencies: [] },
        { id: 'step2', dependencies: [] },
      ];

      const graph = buildDependencyGraph(steps);
      const result = canRunInParallel(steps[0], steps[1], graph);

      expect(result).toBe(true);
    });

    test('prevents parallel for direct dependencies', () => {
      const steps = [
        { id: 'step1', dependencies: [] },
        { id: 'step2', dependencies: ['step1'] },
      ];

      const graph = buildDependencyGraph(steps);
      const result = canRunInParallel(steps[0], steps[1], graph);

      expect(result).toBe(false);
    });

    test('prevents parallel for transitive dependencies', () => {
      const steps = [
        { id: 'step1', dependencies: [] },
        { id: 'step2', dependencies: ['step1'] },
        { id: 'step3', dependencies: ['step2'] },
      ];

      const graph = buildDependencyGraph(steps);
      const result = canRunInParallel(steps[0], steps[2], graph);

      expect(result).toBe(false);
    });

    test('handles null inputs', () => {
      const graph = buildDependencyGraph([]);

      expect(canRunInParallel(null, null, graph)).toBe(false);
    });
  });

  describe('Pure Functions - calculateCriticalPath', () => {
    test('calculates critical path for linear graph', () => {
      const steps = [
        { id: 'step1', dependencies: [] },
        { id: 'step2', dependencies: ['step1'] },
        { id: 'step3', dependencies: ['step2'] },
      ];

      const graph = buildDependencyGraph(steps);
      const durations = { step1: 10, step2: 20, step3: 15 };

      const result = calculateCriticalPath(graph, durations);

      expect(result.path).toEqual(['step1', 'step2', 'step3']);
      expect(result.duration).toBe(45);
    });

    test('finds longest path in branching graph', () => {
      const steps = [
        { id: 'step1', dependencies: [] },
        { id: 'step2', dependencies: ['step1'] },
        { id: 'step3', dependencies: ['step1'] },
        { id: 'step4', dependencies: ['step2', 'step3'] },
      ];

      const graph = buildDependencyGraph(steps);
      const durations = { step1: 10, step2: 30, step3: 5, step4: 10 };

      const result = calculateCriticalPath(graph, durations);

      expect(result.path).toContain('step1');
      expect(result.path).toContain('step2');
      expect(result.path).toContain('step4');
      expect(result.duration).toBe(50); // 10 + 30 + 10
    });

    test('handles empty graph', () => {
      const graph = {
        nodes: new Map(),
        edges: new Map(),
        inDegree: new Map(),
      };

      const result = calculateCriticalPath(graph);

      expect(result.path).toEqual([]);
      expect(result.duration).toBe(0);
    });

    test('handles missing durations', () => {
      const steps = [
        { id: 'step1', dependencies: [] },
        { id: 'step2', dependencies: ['step1'] },
      ];

      const graph = buildDependencyGraph(steps);
      const result = calculateCriticalPath(graph, {});

      // With 0 durations, critical path calculation may return empty or full path
      expect(result.duration).toBe(0);
      expect(Array.isArray(result.path)).toBe(true);
    });
  });

  // ============================================================================
  // DependencyResolver Class Tests
  // ============================================================================

  describe('DependencyResolver Class - Constructor', () => {
    test('initializes with null state', () => {
      const resolver = new DependencyResolver();

      expect(resolver.graph).toBeNull();
      expect(resolver.orderedSteps).toBeNull();
      expect(resolver.parallelGroups).toBeNull();
    });
  });

  describe('DependencyResolver Class - analyze', () => {
    test('analyzes valid dependencies', () => {
      const resolver = new DependencyResolver();
      const steps = [
        { id: 'step1', dependencies: [] },
        { id: 'step2', dependencies: ['step1'] },
      ];

      const result = resolver.analyze(steps);

      expect(result.graph).toBeTruthy();
      expect(result.order).toEqual(['step1', 'step2']);
      expect(result.groups).toBeTruthy();
    });

    test('throws error for invalid dependencies', () => {
      const resolver = new DependencyResolver();
      const steps = [
        { id: 'step1', dependencies: [] },
        { id: 'step2', dependencies: ['step99'] },
      ];

      expect(() => resolver.analyze(steps)).toThrow(ValidationError);
    });

    test('throws error for circular dependencies', () => {
      const resolver = new DependencyResolver();
      const steps = [
        { id: 'step1', dependencies: ['step2'] },
        { id: 'step2', dependencies: ['step1'] },
      ];

      expect(() => resolver.analyze(steps)).toThrow(ValidationError);
    });

    test('stores analysis results', () => {
      const resolver = new DependencyResolver();
      const steps = [
        { id: 'step1', dependencies: [] },
        { id: 'step2', dependencies: ['step1'] },
      ];

      resolver.analyze(steps);

      expect(resolver.graph).toBeTruthy();
      expect(resolver.orderedSteps).toBeTruthy();
      expect(resolver.parallelGroups).toBeTruthy();
    });
  });

  describe('DependencyResolver Class - resolve', () => {
    test('returns full order without start step', () => {
      const resolver = new DependencyResolver();
      const steps = [
        { id: 'step1', dependencies: [] },
        { id: 'step2', dependencies: ['step1'] },
        { id: 'step3', dependencies: ['step2'] },
      ];

      const order = resolver.resolve(steps);

      expect(order).toEqual(['step1', 'step2', 'step3']);
    });

    test('returns partial order from start step', () => {
      const resolver = new DependencyResolver();
      const steps = [
        { id: 'step1', dependencies: [] },
        { id: 'step2', dependencies: ['step1'] },
        { id: 'step3', dependencies: ['step2'] },
      ];

      const order = resolver.resolve(steps, 'step2');

      expect(order).toEqual(['step2', 'step3']);
    });

    test('throws error for non-existent start step', () => {
      const resolver = new DependencyResolver();
      const steps = [{ id: 'step1', dependencies: [] }];

      expect(() => resolver.resolve(steps, 'step99')).toThrow(ValidationError);
    });

    test('reuses analysis if already performed', () => {
      const resolver = new DependencyResolver();
      const steps = [
        { id: 'step1', dependencies: [] },
        { id: 'step2', dependencies: ['step1'] },
      ];

      resolver.analyze(steps);
      const order = resolver.resolve(steps);

      expect(order).toEqual(['step1', 'step2']);
    });
  });

  describe('DependencyResolver Class - canRunInParallel', () => {
    test('checks if steps can run in parallel', () => {
      const resolver = new DependencyResolver();
      const steps = [
        { id: 'step1', dependencies: [] },
        { id: 'step2', dependencies: [] },
      ];

      resolver.analyze(steps);
      const result = resolver.canRunInParallel('step1', 'step2');

      expect(result).toBe(true);
    });

    test('throws error if analysis not performed', () => {
      const resolver = new DependencyResolver();

      expect(() => resolver.canRunInParallel('step1', 'step2')).toThrow(ValidationError);
    });

    test('throws error if steps not found', () => {
      const resolver = new DependencyResolver();
      const steps = [{ id: 'step1', dependencies: [] }];

      resolver.analyze(steps);

      expect(() => resolver.canRunInParallel('step1', 'step99')).toThrow(ValidationError);
    });
  });

  describe('DependencyResolver Class - getParallelGroups', () => {
    test('returns parallel execution groups', () => {
      const resolver = new DependencyResolver();
      const steps = [
        { id: 'step1', dependencies: [] },
        { id: 'step2', dependencies: [] },
        { id: 'step3', dependencies: ['step1', 'step2'] },
      ];

      resolver.analyze(steps);
      const groups = resolver.getParallelGroups();

      expect(groups.length).toBeGreaterThan(0);
    });

    test('throws error if analysis not performed', () => {
      const resolver = new DependencyResolver();

      expect(() => resolver.getParallelGroups()).toThrow(ValidationError);
    });
  });

  describe('DependencyResolver Class - getCriticalPath', () => {
    test('calculates critical path', () => {
      const resolver = new DependencyResolver();
      const steps = [
        { id: 'step1', dependencies: [] },
        { id: 'step2', dependencies: ['step1'] },
      ];

      resolver.analyze(steps);
      const result = resolver.getCriticalPath({ step1: 10, step2: 20 });

      expect(result.path).toEqual(['step1', 'step2']);
      expect(result.duration).toBe(30);
    });

    test('throws error if analysis not performed', () => {
      const resolver = new DependencyResolver();

      expect(() => resolver.getCriticalPath({})).toThrow(ValidationError);
    });
  });

  describe('DependencyResolver Class - getStepInfo', () => {
    test('returns step dependency information', () => {
      const resolver = new DependencyResolver();
      const steps = [
        { id: 'step1', dependencies: [] },
        { id: 'step2', dependencies: ['step1'] },
        { id: 'step3', dependencies: ['step2'] },
      ];

      resolver.analyze(steps);
      const info = resolver.getStepInfo('step2');

      expect(info.id).toBe('step2');
      expect(info.dependencies).toEqual(['step1']);
      expect(info.dependents).toEqual(['step3']);
      expect(info.inDegree).toBe(1);
    });

    test('throws error if analysis not performed', () => {
      const resolver = new DependencyResolver();

      expect(() => resolver.getStepInfo('step1')).toThrow(ValidationError);
    });

    test('throws error if step not found', () => {
      const resolver = new DependencyResolver();
      const steps = [{ id: 'step1', dependencies: [] }];

      resolver.analyze(steps);

      expect(() => resolver.getStepInfo('step99')).toThrow(ValidationError);
    });
  });

  describe('DependencyResolver Class - visualize', () => {
    test('returns text representation of graph', () => {
      const resolver = new DependencyResolver();
      const steps = [
        { id: 'step1', dependencies: [] },
        { id: 'step2', dependencies: ['step1'] },
      ];

      resolver.analyze(steps);
      const viz = resolver.visualize();

      expect(viz).toContain('Dependency Graph');
      expect(viz).toContain('step1');
      expect(viz).toContain('step2');
    });

    test('returns message if no graph available', () => {
      const resolver = new DependencyResolver();
      const viz = resolver.visualize();

      expect(viz).toContain('No dependency graph available');
    });
  });

  describe('DependencyResolver Class - clear', () => {
    test('clears cached analysis results', () => {
      const resolver = new DependencyResolver();
      const steps = [
        { id: 'step1', dependencies: [] },
        { id: 'step2', dependencies: ['step1'] },
      ];

      resolver.analyze(steps);
      resolver.clear();

      expect(resolver.graph).toBeNull();
      expect(resolver.orderedSteps).toBeNull();
      expect(resolver.parallelGroups).toBeNull();
    });
  });
});
