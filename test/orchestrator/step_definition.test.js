/**
 * @fileoverview Tests for step_definition.js
 */

import {
  WORKFLOW_PHASES,
  createStepDefinition,
  validateStepMetadata,
  groupStepsByPhase,
} from '../../src/orchestrator/step_definition.js';

import { ValidationError } from '../../src/utils/errors.js';

describe('step_definition', () => {
  describe('WORKFLOW_PHASES', () => {
    it('is frozen and contains expected phases', () => {
      expect(Array.isArray(WORKFLOW_PHASES)).toBe(true);
      expect(Object.isFrozen(WORKFLOW_PHASES)).toBe(true);
      expect(WORKFLOW_PHASES).toEqual([
        'analysis',
        'validation',
        'testing',
        'quality',
        'finalization',
        'execution',
      ]);
    });
  });

  describe('validateStepMetadata', () => {
    it('returns no errors for valid metadata', () => {
      const meta = {
        id: 'step_01',
        name: 'Test Step',
        description: 'desc',
        phase: 'testing',
        dependencies: ['dep1'],
        tags: ['tag1'],
        critical: true,
        enabled: false,
        timeout: 10,
        requirements: {},
        handler: () => {},
      };
      expect(validateStepMetadata(meta)).toEqual([]);
    });

    it('returns error for non-object metadata', () => {
      expect(validateStepMetadata(null)).toContain('metadata must be an object');
      expect(validateStepMetadata('foo')).toContain('metadata must be an object');
    });

    it('returns errors for missing required fields', () => {
      expect(validateStepMetadata({})).toEqual([
        'id is required and must be a string',
        'name is required and must be a string',
        'description is required and must be a string',
      ]);
    });

    it('returns error for invalid id format', () => {
      expect(validateStepMetadata({ id: 'Step-01', name: 'n', description: 'd' })).toContain(
        'id must contain only lowercase letters, numbers, and underscores'
      );
    });

    it('returns error for invalid phase', () => {
      expect(
        validateStepMetadata({ id: 'a', name: 'n', description: 'd', phase: 'foo' })
      ).toContain(
        'phase must be one of: analysis, validation, testing, quality, finalization, execution'
      );
    });

    it('returns error for invalid dependencies/tags', () => {
      expect(
        validateStepMetadata({ id: 'a', name: 'n', description: 'd', dependencies: 'bad' })
      ).toContain('dependencies must be an array');
      expect(
        validateStepMetadata({ id: 'a', name: 'n', description: 'd', dependencies: [1] })
      ).toContain('all dependencies must be strings');
      expect(validateStepMetadata({ id: 'a', name: 'n', description: 'd', tags: 'bad' })).toContain(
        'tags must be an array'
      );
      expect(validateStepMetadata({ id: 'a', name: 'n', description: 'd', tags: [1] })).toContain(
        'all tags must be strings'
      );
    });

    it('returns error for invalid booleans', () => {
      expect(
        validateStepMetadata({ id: 'a', name: 'n', description: 'd', critical: 'yes' })
      ).toContain('critical must be a boolean');
      expect(
        validateStepMetadata({ id: 'a', name: 'n', description: 'd', enabled: 'no' })
      ).toContain('enabled must be a boolean');
    });

    it('returns error for invalid timeout', () => {
      expect(
        validateStepMetadata({ id: 'a', name: 'n', description: 'd', timeout: 'fast' })
      ).toContain('timeout must be a number');
      expect(validateStepMetadata({ id: 'a', name: 'n', description: 'd', timeout: 0 })).toContain(
        'timeout must be greater than 0'
      );
    });

    it('returns error for invalid requirements', () => {
      expect(
        validateStepMetadata({ id: 'a', name: 'n', description: 'd', requirements: 'bad' })
      ).toContain('requirements must be an object');
    });

    it('returns error for invalid handler', () => {
      expect(validateStepMetadata({ id: 'a', name: 'n', description: 'd', handler: 1 })).toContain(
        'handler must be a function'
      );
    });
  });

  describe('createStepDefinition', () => {
    const validMeta = {
      id: 'step_01',
      name: 'Test Step',
      description: 'desc',
      phase: 'testing',
      dependencies: ['dep1'],
      tags: ['tag1'],
      critical: true,
      enabled: false,
      timeout: 10,
      requirements: { foo: 'bar' },
      handler: () => {},
      registered: 123,
      version: '2.0.0',
      metadata: { custom: 'x' },
    };

    it('returns normalized step definition for valid metadata', () => {
      const step = createStepDefinition(validMeta);
      expect(step).toMatchObject({
        id: 'step_01',
        name: 'Test Step',
        description: 'desc',
        phase: 'testing',
        dependencies: ['dep1'],
        tags: ['tag1'],
        critical: true,
        enabled: false,
        timeout: 10,
        requirements: { foo: 'bar' },
        handler: expect.any(Function),
        metadata: expect.objectContaining({
          registered: 123,
          version: '2.0.0',
          custom: 'x',
        }),
      });
    });

    it('throws ValidationError for invalid metadata', () => {
      expect(() => createStepDefinition({})).toThrow(ValidationError);
    });

    it('defaults missing fields', () => {
      const meta = { id: 'x', name: 'n', description: 'd' };
      const step = createStepDefinition(meta);
      expect(step.phase).toBe('execution');
      expect(step.dependencies).toEqual([]);
      expect(step.tags).toEqual([]);
      expect(step.critical).toBe(false);
      expect(step.enabled).toBe(true);
      expect(step.timeout).toBe(300);
      expect(step.requirements).toEqual({});
      expect(step.handler).toBeUndefined();
      expect(step.metadata.version).toBe('1.0.0');
      expect(step.metadata.registered).toBeNull();
    });

    it('handler is set if provided', () => {
      const handler = () => {};
      const meta = { id: 'x', name: 'n', description: 'd', handler };
      const step = createStepDefinition(meta);
      expect(step.handler).toBe(handler);
    });
  });

  describe('groupStepsByPhase', () => {
    it('groups steps by phase, defaulting to execution', () => {
      const steps = [
        { id: 'a', phase: 'analysis' },
        { id: 'b', phase: 'testing' },
        { id: 'c' }, // no phase
        { id: 'd', phase: 'quality' },
        { id: 'e', phase: 'foo' }, // invalid phase, should go to execution
      ];
      const grouped = groupStepsByPhase(steps);
      expect(grouped.analysis).toEqual([{ id: 'a', phase: 'analysis' }]);
      expect(grouped.testing).toEqual([{ id: 'b', phase: 'testing' }]);
      expect(grouped.quality).toEqual([{ id: 'd', phase: 'quality' }]);
      expect(grouped.execution).toEqual([{ id: 'c' }, { id: 'e', phase: 'foo' }]);
      expect(grouped.validation).toEqual([]);
      expect(grouped.finalization).toEqual([]);
    });

    it('returns all phases as keys, even if empty', () => {
      const grouped = groupStepsByPhase([]);
      WORKFLOW_PHASES.forEach((phase) => {
        expect(grouped).toHaveProperty(phase);
        expect(Array.isArray(grouped[phase])).toBe(true);
      });
    });
  });
});
