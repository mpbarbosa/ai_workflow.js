/**
 * @fileoverview Tests for generic_step_registry.js
 */

import {
  matchStepRequirements,
  filterStepsByTags,
  filterStepsByEnabled,
  findStepsByPhase,
  sortStepsById,
  validateStepDependencies,
} from '../../src/orchestrator/generic_step_registry.js';

describe('generic_step_registry', () => {
  describe('matchStepRequirements', () => {
    it('returns met=true when provided requirements exist in the context', () => {
      const step = { requirements: ['foo'] };
      const context = { foo: true };

      const result = matchStepRequirements(step, context);

      expect(result).toEqual({ met: true, missing: [] });
    });

    it('uses empty object if context is undefined', () => {
      const step = { requirements: { tools: ['bar'] } };

      const result = matchStepRequirements(step);

      expect(result).toEqual({ met: false, missing: ['tool:bar'] });
    });
  });

  describe('filterStepsByTags', () => {
    const steps = [
      { id: 'a', tags: ['foo', 'bar'] },
      { id: 'b', tags: ['bar'] },
      { id: 'c', tags: [] },
      { id: 'd' }, // no tags property
    ];

    it('returns all steps if tags is undefined', () => {
      expect(filterStepsByTags(steps)).toEqual(steps);
    });

    it('returns all steps if tags is empty array', () => {
      expect(filterStepsByTags(steps, [])).toEqual(steps);
    });

    it('filters steps that include all specified tags', () => {
      expect(filterStepsByTags(steps, ['bar'])).toEqual([
        { id: 'a', tags: ['foo', 'bar'] },
        { id: 'b', tags: ['bar'] },
      ]);
      expect(filterStepsByTags(steps, ['foo', 'bar'])).toEqual([{ id: 'a', tags: ['foo', 'bar'] }]);
    });

    it('returns empty array if no steps match all tags', () => {
      expect(filterStepsByTags(steps, ['baz'])).toEqual([]);
      expect(filterStepsByTags(steps, ['foo', 'baz'])).toEqual([]);
    });

    it('handles steps with missing or empty tags', () => {
      expect(filterStepsByTags(steps, ['foo'])).toEqual([{ id: 'a', tags: ['foo', 'bar'] }]);
    });
  });

  describe('filterStepsByEnabled', () => {
    const steps = [
      { id: 'a', enabled: true },
      { id: 'b', enabled: false },
      { id: 'c' }, // no enabled property
    ];

    it('returns enabled steps by default', () => {
      expect(filterStepsByEnabled(steps)).toEqual([{ id: 'a', enabled: true }, { id: 'c' }]);
    });

    it('returns all steps when enabledOnly=false', () => {
      expect(filterStepsByEnabled(steps, false)).toEqual(steps);
    });
  });

  describe('findStepsByPhase', () => {
    const steps = [
      { id: 'a', phase: 'init' },
      { id: 'b', phase: 'run' },
      { id: 'c', phase: 'init' },
      { id: 'd' },
    ];

    it('returns steps matching the specified phase', () => {
      expect(findStepsByPhase(steps, 'init')).toEqual([
        { id: 'a', phase: 'init' },
        { id: 'c', phase: 'init' },
      ]);
      expect(findStepsByPhase(steps, 'run')).toEqual([{ id: 'b', phase: 'run' }]);
    });

    it('returns empty array if no steps match the phase', () => {
      expect(findStepsByPhase(steps, 'final')).toEqual([]);
    });

    it('does not match steps with missing phase', () => {
      expect(findStepsByPhase(steps, undefined)).toEqual([]);
    });
  });

  describe('sortStepsById', () => {
    it('sorts steps by numeric id', () => {
      const steps = [{ id: 'step_02' }, { id: 'step_01' }];
      expect(sortStepsById(steps)).toEqual([{ id: 'step_01' }, { id: 'step_02' }]);
    });
  });

  describe('validateStepDependencies', () => {
    it('normalizes missing dependencies arrays', () => {
      const steps = [
        { id: 'a', dependencies: ['b'] },
        { id: 'b' }, // missing dependencies
      ];
      expect(validateStepDependencies(steps)).toEqual({ valid: true, errors: [] });
    });

    it('handles all steps with dependencies array', () => {
      const steps = [
        { id: 'a', dependencies: [] },
        { id: 'b', dependencies: ['a'] },
      ];
      expect(validateStepDependencies(steps)).toEqual({ valid: true, errors: [] });
    });

    it('handles empty steps array', () => {
      expect(validateStepDependencies([])).toEqual({ valid: true, errors: [] });
    });
  });
});
