/**
 * @fileoverview Tests for olinda_step_registry.js
 */

import {
  StepRegistryValidationError,
  StepRegistrySystemError,
  validateStepMetadata,
  createStepDefinition,
  matchStepRequirements,
  groupStepsByStage,
  groupStepsByPhase,
  filterStepsByTags,
  filterStepsByEnabled,
  findStepsByStage,
  findStepsByPhase,
  sortStepsById,
  validateStepDependencies,
  StepRegistry,
} from '../../src/orchestrator/olinda_step_registry.js';

describe('olinda_step_registry', () => {
  describe('StepRegistryValidationError', () => {
    it('sets name and message', () => {
      const err = new StepRegistryValidationError('bad');
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe('StepRegistryValidationError');
      expect(err.message).toBe('bad');
    });
  });

  describe('StepRegistrySystemError', () => {
    it('sets name and message', () => {
      const err = new StepRegistrySystemError('fail');
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe('StepRegistrySystemError');
      expect(err.message).toBe('fail');
    });
  });

  describe('validateStepMetadata', () => {
    it('returns no errors for valid metadata', () => {
      const meta = {
        id: 'step_01',
        name: 'Test Step',
        description: 'desc',
        stage: 'main',
        dependencies: ['step_00'],
        tags: ['foo'],
        critical: true,
        enabled: false,
        timeout: 10,
        requirements: {},
        execute: () => {},
        handler: () => {},
      };
      expect(validateStepMetadata(meta)).toEqual([]);
    });

    it('returns errors for missing required fields', () => {
      expect(validateStepMetadata({})).toContain('id is required and must be a string');
      expect(validateStepMetadata({ id: '', name: '', description: '' })).toEqual([
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

    it('returns error for non-object metadata', () => {
      expect(validateStepMetadata(null)).toContain('metadata must be an object');
      expect(validateStepMetadata('foo')).toContain('metadata must be an object');
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

    it('returns error for invalid execute/handler', () => {
      expect(validateStepMetadata({ id: 'a', name: 'n', description: 'd', execute: 1 })).toContain(
        'execute must be a function'
      );
      expect(validateStepMetadata({ id: 'a', name: 'n', description: 'd', handler: 2 })).toContain(
        'handler must be a function'
      );
    });

    it('returns error for mismatched stage/phase', () => {
      expect(
        validateStepMetadata({
          id: 'a',
          name: 'n',
          description: 'd',
          stage: 'foo',
          phase: 'bar',
        })
      ).toContain('stage and phase must match when both are provided');
    });

    it('returns error for empty stage/phase', () => {
      expect(
        validateStepMetadata({
          id: 'a',
          name: 'n',
          description: 'd',
          stage: '',
        })
      ).toContain('stage must be a non-empty string');
      expect(
        validateStepMetadata({
          id: 'a',
          name: 'n',
          description: 'd',
          phase: '',
        })
      ).toContain('phase must be a non-empty string');
    });
  });

  describe('createStepDefinition', () => {
    const validMeta = {
      id: 'step_01',
      name: 'Test Step',
      description: 'desc',
      stage: 'main',
      dependencies: ['step_00'],
      tags: ['foo'],
      critical: true,
      enabled: false,
      timeout: 10,
      requirements: { files: ['a.js'] },
      execute: () => {},
      registeredAt: 123,
      version: '2.0.0',
      metadata: { custom: 'x' },
    };

    it('returns normalized step definition for valid metadata', () => {
      const step = createStepDefinition(validMeta);
      expect(step).toMatchObject({
        id: 'step_01',
        name: 'Test Step',
        description: 'desc',
        stage: 'main',
        dependencies: ['step_00'],
        tags: ['foo'],
        critical: true,
        enabled: false,
        timeout: 10,
        requirements: { files: ['a.js'] },
        execute: expect.any(Function),
        metadata: expect.objectContaining({
          registeredAt: 123,
          version: '2.0.0',
          custom: 'x',
        }),
      });
    });

    it('throws StepRegistryValidationError for invalid metadata', () => {
      expect(() => createStepDefinition({})).toThrow(StepRegistryValidationError);
    });

    it('defaults missing fields', () => {
      const meta = { id: 'x', name: 'n', description: 'd' };
      const step = createStepDefinition(meta);
      expect(step.dependencies).toEqual([]);
      expect(step.tags).toEqual([]);
      expect(step.critical).toBe(false);
      expect(step.enabled).toBe(true);
      expect(step.timeout).toBe(300);
      expect(step.requirements).toEqual({});
      expect(step.execute).toBeUndefined();
      expect(step.metadata.version).toBe('1.0.0');
    });

    it('uses handler as execute if execute is missing', () => {
      const handler = () => {};
      const meta = { id: 'x', name: 'n', description: 'd', handler };
      const step = createStepDefinition(meta);
      expect(step.execute).toBe(handler);
    });

    it('uses registered as registeredAt when the canonical field is missing', () => {
      const step = createStepDefinition({
        id: 'x',
        name: 'n',
        description: 'd',
        registered: 456,
      });

      expect(step.metadata.registeredAt).toBe(456);
    });
  });

  describe('matchStepRequirements', () => {
    it('returns met=true if no requirements', () => {
      expect(matchStepRequirements({})).toEqual({ met: true, missing: [] });
      expect(matchStepRequirements({ requirements: {} })).toEqual({ met: true, missing: [] });
    });

    it('returns missing files', () => {
      const step = { requirements: { files: ['a.js', 'b.js'] } };
      const context = { files: ['a.js'] };
      expect(matchStepRequirements(step, context)).toEqual({
        met: false,
        missing: ['file:b.js'],
      });
    });

    it('returns missing tools', () => {
      const step = { requirements: { tools: ['git', 'node'] } };
      const context = { tools: ['git'] };
      expect(matchStepRequirements(step, context)).toEqual({
        met: false,
        missing: ['tool:node'],
      });
    });

    it('returns missing config', () => {
      const step = { requirements: { config: { foo: 1, bar: 2 } } };
      const context = { config: { foo: 1 } };
      expect(matchStepRequirements(step, context)).toEqual({
        met: false,
        missing: ['config:bar=2'],
      });
    });

    it('returns missing env', () => {
      const step = { requirements: { env: ['FOO', 'BAR'] } };
      const context = { env: { FOO: 'x' } };
      expect(matchStepRequirements(step, context)).toEqual({
        met: false,
        missing: ['env:BAR'],
      });
    });

    it('returns all missing in one result', () => {
      const step = {
        requirements: {
          files: ['a.js'],
          tools: ['git'],
          config: { foo: 1 },
          env: ['FOO'],
        },
      };
      expect(matchStepRequirements(step, {})).toEqual({
        met: false,
        missing: ['file:a.js', 'tool:git', 'config:foo=1', 'env:FOO'],
      });
    });

    it('returns met=true if all requirements are satisfied', () => {
      const step = {
        requirements: {
          files: ['a.js'],
          tools: ['git'],
          config: { foo: 1 },
          env: ['FOO'],
        },
      };
      const context = {
        files: ['a.js'],
        tools: ['git'],
        config: { foo: 1 },
        env: { FOO: 'x' },
      };
      expect(matchStepRequirements(step, context)).toEqual({ met: true, missing: [] });
    });
  });

  describe('groupStepsByStage / groupStepsByPhase', () => {
    const steps = [
      { id: 'a', stage: 's1' },
      { id: 'b', stage: 's2' },
      { id: 'c', stage: 's1' },
    ];

    it('groups steps by stage', () => {
      expect(groupStepsByStage(steps)).toEqual({
        s1: [
          { id: 'a', stage: 's1' },
          { id: 'c', stage: 's1' },
        ],
        s2: [{ id: 'b', stage: 's2' }],
      });
    });

    it('groupStepsByPhase is alias of groupStepsByStage', () => {
      expect(groupStepsByPhase(steps)).toEqual(groupStepsByStage(steps));
    });
  });

  describe('filterStepsByTags', () => {
    const steps = [
      { id: 'a', tags: ['foo', 'bar'] },
      { id: 'b', tags: ['bar'] },
      { id: 'c', tags: [] },
    ];

    it('returns all steps if tags is undefined or empty', () => {
      expect(filterStepsByTags(steps)).toEqual(steps);
      expect(filterStepsByTags(steps, [])).toEqual(steps);
    });

    it('filters steps by all tags', () => {
      expect(filterStepsByTags(steps, ['bar'])).toEqual([
        { id: 'a', tags: ['foo', 'bar'] },
        { id: 'b', tags: ['bar'] },
      ]);
      expect(filterStepsByTags(steps, ['foo', 'bar'])).toEqual([{ id: 'a', tags: ['foo', 'bar'] }]);
      expect(filterStepsByTags(steps, ['baz'])).toEqual([]);
    });
  });

  describe('filterStepsByEnabled', () => {
    const steps = [
      { id: 'a', enabled: true },
      { id: 'b', enabled: false },
      { id: 'c' }, // enabled undefined
    ];

    it('returns only enabled steps by default', () => {
      expect(filterStepsByEnabled(steps)).toEqual([{ id: 'a', enabled: true }, { id: 'c' }]);
    });

    it('returns all steps if enabledOnly is false', () => {
      expect(filterStepsByEnabled(steps, false)).toEqual(steps);
    });
  });

  describe('findStepsByStage / findStepsByPhase', () => {
    const steps = [
      { id: 'a', stage: 's1' },
      { id: 'b', stage: 's2' },
      { id: 'c', stage: 's1' },
    ];

    it('finds steps by stage', () => {
      expect(findStepsByStage(steps, 's1')).toEqual([
        { id: 'a', stage: 's1' },
        { id: 'c', stage: 's1' },
      ]);
      expect(findStepsByStage(steps, 's2')).toEqual([{ id: 'b', stage: 's2' }]);
      expect(findStepsByStage(steps, 's3')).toEqual([]);
    });

    it('findStepsByPhase is alias of findStepsByStage', () => {
      expect(findStepsByPhase(steps, 's1')).toEqual(findStepsByStage(steps, 's1'));
    });
  });

  describe('sortStepsById', () => {
    it('sorts steps by numeric id', () => {
      const steps = [{ id: 'step_10' }, { id: 'step_2' }, { id: 'step_01' }, { id: 'foo' }];
      expect(sortStepsById(steps)).toEqual([
        { id: 'step_01' },
        { id: 'step_2' },
        { id: 'step_10' },
        { id: 'foo' },
      ]);
    });

    it('handles ids without numbers', () => {
      const steps = [{ id: 'foo' }, { id: 'bar' }];
      expect(sortStepsById(steps)).toEqual([{ id: 'foo' }, { id: 'bar' }]);
    });
  });

  describe('validateStepDependencies', () => {
    it('returns valid=true if all dependencies exist', () => {
      const steps = [
        { id: 'a', dependencies: ['b'] },
        { id: 'b', dependencies: [] },
      ];
      expect(validateStepDependencies(steps)).toEqual({ valid: true, errors: [] });
    });

    it('returns valid=false and errors for missing dependencies', () => {
      const steps = [
        { id: 'a', dependencies: ['b', 'c'] },
        { id: 'b', dependencies: [] },
      ];
      expect(validateStepDependencies(steps)).toEqual({
        valid: false,
        errors: ["Step 'a' depends on non-existent step 'c'"],
      });
    });

    it('handles steps with no dependencies', () => {
      const steps = [{ id: 'a' }, { id: 'b' }];
      expect(validateStepDependencies(steps)).toEqual({ valid: true, errors: [] });
    });
  });

  describe('StepRegistry', () => {
    let registry;
    beforeEach(() => {
      registry = new StepRegistry();
    });

    it('registers and retrieves a step', () => {
      const def = { name: 'n', description: 'd' };
      const step = registry.register('s1', def);
      expect(step.id).toBe('s1');
      expect(registry.get('s1')).toEqual(step);
      expect(registry.has('s1')).toBe(true);
    });

    it('throws on duplicate registration', () => {
      registry.register('s1', { name: 'n', description: 'd' });
      expect(() => registry.register('s1', { name: 'n', description: 'd' })).toThrow(
        StepRegistryValidationError
      );
    });

    it('updates a step', () => {
      registry.register('s1', { name: 'n', description: 'd', tags: ['a'] });
      const updated = registry.update('s1', { name: 'n2', tags: ['b'] });
      expect(updated.name).toBe('n2');
      expect(updated.tags).toEqual(['b']);
      expect(registry.get('s1')).toEqual(updated);
    });

    it('throws on update of non-existent step', () => {
      expect(() => registry.update('nope', { name: 'x' })).toThrow(StepRegistryValidationError);
    });

    it('unregisters a step', () => {
      registry.register('s1', { name: 'n', description: 'd' });
      expect(registry.unregister('s1')).toBe(true);
      expect(registry.get('s1')).toBeNull();
      expect(registry.has('s1')).toBe(false);
    });

    it('returns false when unregistering non-existent step', () => {
      expect(registry.unregister('nope')).toBe(false);
    });

    it('lists steps with filters and sorts', () => {
      registry.register('s1', {
        name: 'n',
        description: 'd',
        stage: 'a',
        tags: ['x'],
        enabled: true,
      });
      registry.register('s2', {
        name: 'n',
        description: 'd',
        stage: 'b',
        tags: ['y'],
        enabled: false,
      });
      registry.register('s3', {
        name: 'n',
        description: 'd',
        stage: 'a',
        tags: ['x'],
        enabled: true,
      });

      // No filter
      expect(registry.list()).toEqual([
        expect.objectContaining({ id: 's1' }),
        expect.objectContaining({ id: 's3' }),
      ]);
      // By stage
      expect(registry.list({ stage: 'a' })).toEqual([
        expect.objectContaining({ id: 's1' }),
        expect.objectContaining({ id: 's3' }),
      ]);
      // By phase alias
      expect(registry.list({ phase: 'a' })).toEqual([
        expect.objectContaining({ id: 's1' }),
        expect.objectContaining({ id: 's3' }),
      ]);
      // By tags
      expect(registry.list({ tags: ['x'] })).toEqual([
        expect.objectContaining({ id: 's1' }),
        expect.objectContaining({ id: 's3' }),
      ]);
      // By enabledOnly=false
      expect(registry.list({ enabledOnly: false })).toEqual([
        expect.objectContaining({ id: 's1' }),
        expect.objectContaining({ id: 's2' }),
        expect.objectContaining({ id: 's3' }),
      ]);
    });

    it('getByStage and getByPhase group steps', () => {
      registry.register('s1', { name: 'n', description: 'd', stage: 'a' });
      registry.register('s2', { name: 'n', description: 'd', stage: 'b' });
      expect(registry.getByStage()).toEqual({
        a: [expect.objectContaining({ id: 's1' })],
        b: [expect.objectContaining({ id: 's2' })],
      });
      expect(registry.getByPhase()).toEqual(registry.getByStage());
    });

    it('getInOrder returns steps in registration order', () => {
      registry.register('s1', { name: 'n', description: 'd' });
      registry.register('s2', { name: 'n', description: 'd' });
      expect(registry.getInOrder().map((s) => s.id)).toEqual(['s1', 's2']);
    });

    it('validateAll checks dependencies', () => {
      registry.register('a', { name: 'n', description: 'd', dependencies: ['b'] });
      registry.register('b', { name: 'n', description: 'd' });
      expect(registry.validateAll()).toEqual({ valid: true, errors: [] });
      registry.unregister('b');
      expect(registry.validateAll()).toEqual({
        valid: false,
        errors: ["Step 'a' depends on non-existent step 'b'"],
      });
    });

    it('checkRequirements throws if step not found', () => {
      expect(() => registry.checkRequirements('nope')).toThrow(StepRegistryValidationError);
    });

    it('checkRequirements delegates to matchStepRequirements', () => {
      registry.register('s1', {
        name: 'n',
        description: 'd',
        requirements: { files: ['a.js'] },
      });
      expect(registry.checkRequirements('s1', { files: [] })).toEqual({
        met: false,
        missing: ['file:a.js'],
      });
    });

    it('clear removes all steps', () => {
      registry.register('s1', { name: 'n', description: 'd' });
      registry.clear();
      expect(registry.get('s1')).toBeNull();
      expect(registry.list({ enabledOnly: false })).toEqual([]);
    });

    it('getStats returns correct stats', () => {
      registry.register('a', {
        name: 'n',
        description: 'd',
        stage: 'x',
        enabled: true,
        critical: true,
      });
      registry.register('b', { name: 'n', description: 'd', stage: 'x', enabled: false });
      registry.register('c', { name: 'n', description: 'd', stage: 'y', enabled: true });
      const stats = registry.getStats();
      expect(stats.total).toBe(3);
      expect(stats.enabled).toBe(2);
      expect(stats.disabled).toBe(1);
      expect(stats.critical).toBe(1);
      expect(stats.byStage).toEqual({ x: 2, y: 1 });
    });

    it('loadStepsFromDirectory throws StepRegistrySystemError', () => {
      expect(() => registry.loadStepsFromDirectory('/tmp')).toThrow(StepRegistrySystemError);
    });
  });
});
