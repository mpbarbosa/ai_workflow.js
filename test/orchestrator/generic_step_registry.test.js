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

import * as olinda from '../../src/orchestrator/olinda_step_registry.js';

jest.mock('../../src/orchestrator/olinda_step_registry.js');

describe('generic_step_registry', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('matchStepRequirements', () => {
    it('delegates to matchOlindaStepRequirements with provided context', () => {
      const step = { requirements: ['foo'] };
      const context = { foo: true };
      olinda.matchStepRequirements.mockReturnValue({ met: true, missing: [] });

      const result = matchStepRequirements(step, context);

      expect(olinda.matchStepRequirements).toHaveBeenCalledWith(step, context);
      expect(result).toEqual({ met: true, missing: [] });
    });

    it('uses empty object if context is undefined', () => {
      const step = { requirements: ['bar'] };
      olinda.matchStepRequirements.mockReturnValue({ met: false, missing: ['bar'] });

      const result = matchStepRequirements(step);

      expect(olinda.matchStepRequirements).toHaveBeenCalledWith(step, {});
      expect(result).toEqual({ met: false, missing: ['bar'] });
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

    it('delegates to filterOlindaStepsByEnabled with default enabledOnly=true', () => {
      olinda.filterStepsByEnabled.mockReturnValue([{ id: 'a', enabled: true }]);
      const result = filterStepsByEnabled(steps);
      expect(olinda.filterStepsByEnabled).toHaveBeenCalledWith(steps, true);
      expect(result).toEqual([{ id: 'a', enabled: true }]);
    });

    it('delegates to filterOlindaStepsByEnabled with enabledOnly=false', () => {
      olinda.filterStepsByEnabled.mockReturnValue(steps);
      const result = filterStepsByEnabled(steps, false);
      expect(olinda.filterStepsByEnabled).toHaveBeenCalledWith(steps, false);
      expect(result).toEqual(steps);
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
    it('delegates to sortOlindaStepsById', () => {
      const steps = [{ id: 'step_02' }, { id: 'step_01' }];
      const sorted = [{ id: 'step_01' }, { id: 'step_02' }];
      olinda.sortStepsById.mockReturnValue(sorted);

      const result = sortStepsById(steps);

      expect(olinda.sortStepsById).toHaveBeenCalledWith(steps);
      expect(result).toEqual(sorted);
    });
  });

  describe('validateStepDependencies', () => {
    it('delegates to validateOlindaStepDependencies with normalized dependencies', () => {
      const steps = [
        { id: 'a', dependencies: ['b'] },
        { id: 'b' }, // missing dependencies
      ];
      const normalized = [
        { id: 'a', dependencies: ['b'] },
        { id: 'b', dependencies: [] },
      ];
      const validationResult = { errors: [] };
      olinda.validateStepDependencies.mockReturnValue(validationResult);

      const result = validateStepDependencies(steps);

      expect(olinda.validateStepDependencies).toHaveBeenCalledWith(normalized);
      expect(result).toBe(validationResult);
    });

    it('handles all steps with dependencies array', () => {
      const steps = [
        { id: 'a', dependencies: [] },
        { id: 'b', dependencies: ['a'] },
      ];
      olinda.validateStepDependencies.mockReturnValue({ errors: [] });

      const result = validateStepDependencies(steps);

      expect(olinda.validateStepDependencies).toHaveBeenCalledWith(steps);
      expect(result).toEqual({ errors: [] });
    });

    it('handles empty steps array', () => {
      olinda.validateStepDependencies.mockReturnValue({ errors: [] });
      expect(validateStepDependencies([])).toEqual({ errors: [] });
      expect(olinda.validateStepDependencies).toHaveBeenCalledWith([]);
    });
  });
});
