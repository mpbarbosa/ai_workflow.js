/**
 * @fileoverview Tests for Step Registry Module
 * @module test/orchestrator/step_registry
 */

import {
  createStepDefinition,
  validateStepMetadata,
  matchStepRequirements,
  groupStepsByPhase,
  filterStepsByTags,
  filterStepsByEnabled,
  findStepsByPhase,
  sortStepsById,
  validateStepDependencies,
  StepRegistry,
} from '../../src/orchestrator/step_registry.js';
import { ValidationError, SystemError } from '../../src/utils/errors.js';

describe('Step Registry Module', () => {
  // ============================================================================
  // Pure Function Tests
  // ============================================================================

  describe('Pure Functions - validateStepMetadata', () => {
    test('validates correct metadata', () => {
      const metadata = {
        id: 'step_00_analyze',
        name: 'Pre-Analysis',
        description: 'Analyze recent changes',
      };

      const errors = validateStepMetadata(metadata);
      expect(errors).toEqual([]);
    });

    test('requires metadata object', () => {
      expect(validateStepMetadata(null)).toContain('metadata must be an object');
      expect(validateStepMetadata('string')).toContain('metadata must be an object');
    });

    test('requires id field', () => {
      const metadata = { name: 'Test', description: 'Test' };
      const errors = validateStepMetadata(metadata);
      expect(errors).toContain('id is required and must be a string');
    });

    test('validates id format', () => {
      const metadata = {
        id: 'INVALID-ID',
        name: 'Test',
        description: 'Test',
      };
      const errors = validateStepMetadata(metadata);
      expect(errors.some((e) => e.includes('lowercase'))).toBe(true);
    });

    test('requires name field', () => {
      const metadata = { id: 'test', description: 'Test' };
      const errors = validateStepMetadata(metadata);
      expect(errors).toContain('name is required and must be a string');
    });

    test('requires description field', () => {
      const metadata = { id: 'test', name: 'Test' };
      const errors = validateStepMetadata(metadata);
      expect(errors).toContain('description is required and must be a string');
    });

    test('validates phase values', () => {
      const metadata = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        phase: 'invalid',
      };
      const errors = validateStepMetadata(metadata);
      expect(errors.some((e) => e.includes('phase must be one of'))).toBe(true);
    });

    test('validates dependencies type', () => {
      const metadata = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        dependencies: 'not-array',
      };
      const errors = validateStepMetadata(metadata);
      expect(errors).toContain('dependencies must be an array');
    });

    test('validates tags type', () => {
      const metadata = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        tags: ['valid', 123],
      };
      const errors = validateStepMetadata(metadata);
      expect(errors).toContain('all tags must be strings');
    });

    test('validates critical type', () => {
      const metadata = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        critical: 'yes',
      };
      const errors = validateStepMetadata(metadata);
      expect(errors).toContain('critical must be a boolean');
    });

    test('validates timeout type and value', () => {
      let metadata = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        timeout: 'invalid',
      };
      let errors = validateStepMetadata(metadata);
      expect(errors).toContain('timeout must be a number');

      metadata.timeout = -10;
      errors = validateStepMetadata(metadata);
      expect(errors).toContain('timeout must be greater than 0');
    });

    test('validates handler type', () => {
      const metadata = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        handler: 'not-a-function',
      };
      const errors = validateStepMetadata(metadata);
      expect(errors).toContain('handler must be a function');
    });
  });

  describe('Pure Functions - createStepDefinition', () => {
    test('creates step with required fields only', () => {
      const metadata = {
        id: 'step_00',
        name: 'Test Step',
        description: 'Test description',
      };

      const step = createStepDefinition(metadata);

      expect(step.id).toBe('step_00');
      expect(step.name).toBe('Test Step');
      expect(step.description).toBe('Test description');
      expect(step.phase).toBe('execution');
      expect(step.dependencies).toEqual([]);
      expect(step.tags).toEqual([]);
      expect(step.critical).toBe(false);
      expect(step.enabled).toBe(true);
      expect(step.timeout).toBe(300);
    });

    test('creates step with all fields', () => {
      const handler = async () => {};
      const metadata = {
        id: 'step_01',
        name: 'Analysis',
        description: 'Analyze code',
        phase: 'analysis',
        dependencies: ['step_00'],
        tags: ['quick', 'analysis'],
        critical: true,
        enabled: true,
        timeout: 600,
        requirements: { files: ['package.json'] },
        handler,
      };

      const step = createStepDefinition(metadata);

      expect(step.id).toBe('step_01');
      expect(step.phase).toBe('analysis');
      expect(step.dependencies).toEqual(['step_00']);
      expect(step.tags).toEqual(['quick', 'analysis']);
      expect(step.critical).toBe(true);
      expect(step.timeout).toBe(600);
      expect(step.requirements).toEqual({ files: ['package.json'] });
      expect(step.handler).toBe(handler);
    });

    test('throws ValidationError for invalid metadata', () => {
      const metadata = { id: 'test' }; // Missing required fields

      expect(() => createStepDefinition(metadata)).toThrow(ValidationError);
    });

    test('sets enabled to true by default', () => {
      const metadata = {
        id: 'test',
        name: 'Test',
        description: 'Test',
      };

      const step = createStepDefinition(metadata);
      expect(step.enabled).toBe(true);
    });

    test('respects enabled: false', () => {
      const metadata = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        enabled: false,
      };

      const step = createStepDefinition(metadata);
      expect(step.enabled).toBe(false);
    });

    test('preserves explicit metadata fields over default metadata fields', () => {
      const step = createStepDefinition({
        id: 'step_01',
        name: 'Analysis',
        description: 'Analyze code',
        registered: 123,
        version: '2.0.0',
        metadata: {
          registered: 456,
          version: '3.0.0',
          custom: 'value',
        },
      });

      expect(step.metadata).toEqual({
        registered: 456,
        version: '3.0.0',
        custom: 'value',
      });
    });
  });

  describe('Pure Functions - matchStepRequirements', () => {
    test('returns met=true when no requirements', () => {
      const step = { requirements: {} };
      const context = {};

      const result = matchStepRequirements(step, context);

      expect(result.met).toBe(true);
      expect(result.missing).toEqual([]);
    });

    test('checks file requirements', () => {
      const step = {
        requirements: {
          files: ['package.json', 'README.md'],
        },
      };
      const context = {
        files: ['package.json'],
      };

      const result = matchStepRequirements(step, context);

      expect(result.met).toBe(false);
      expect(result.missing).toContain('file:README.md');
    });

    test('checks tool requirements', () => {
      const step = {
        requirements: {
          tools: ['git', 'npm'],
        },
      };
      const context = {
        tools: ['git'],
      };

      const result = matchStepRequirements(step, context);

      expect(result.met).toBe(false);
      expect(result.missing).toContain('tool:npm');
    });

    test('checks config requirements', () => {
      const step = {
        requirements: {
          config: { testFramework: 'jest' },
        },
      };
      const context = {
        config: { testFramework: 'mocha' },
      };

      const result = matchStepRequirements(step, context);

      expect(result.met).toBe(false);
      expect(result.missing).toContain('config:testFramework=jest');
    });

    test('checks env requirements', () => {
      const step = {
        requirements: {
          env: ['CI', 'NODE_ENV'],
        },
      };
      const context = {
        env: { CI: 'true' },
      };

      const result = matchStepRequirements(step, context);

      expect(result.met).toBe(false);
      expect(result.missing).toContain('env:NODE_ENV');
    });

    test('returns met=true when all requirements satisfied', () => {
      const step = {
        requirements: {
          files: ['package.json'],
          tools: ['git'],
          config: { test: 'value' },
          env: ['NODE_ENV'],
        },
      };
      const context = {
        files: ['package.json'],
        tools: ['git'],
        config: { test: 'value' },
        env: { NODE_ENV: 'test' },
      };

      const result = matchStepRequirements(step, context);

      expect(result.met).toBe(true);
      expect(result.missing).toEqual([]);
    });
  });

  describe('Pure Functions - groupStepsByPhase', () => {
    test('groups steps by phase', () => {
      const steps = [
        { id: 'step1', phase: 'analysis' },
        { id: 'step2', phase: 'testing' },
        { id: 'step3', phase: 'analysis' },
        { id: 'step4', phase: 'quality' },
      ];

      const groups = groupStepsByPhase(steps);

      expect(groups.analysis).toHaveLength(2);
      expect(groups.testing).toHaveLength(1);
      expect(groups.quality).toHaveLength(1);
      expect(groups.validation).toHaveLength(0);
    });

    test('defaults to execution phase for unknown phases', () => {
      const steps = [{ id: 'step1', phase: 'unknown' }];

      const groups = groupStepsByPhase(steps);

      expect(groups.execution).toHaveLength(1);
    });

    test('handles empty array', () => {
      const groups = groupStepsByPhase([]);

      expect(groups.analysis).toEqual([]);
      expect(groups.testing).toEqual([]);
    });
  });

  describe('Pure Functions - filterStepsByTags', () => {
    test('filters steps by tags (all must match)', () => {
      const steps = [
        { id: 'step1', tags: ['quick', 'analysis'] },
        { id: 'step2', tags: ['quick'] },
        { id: 'step3', tags: ['analysis', 'slow'] },
      ];

      const filtered = filterStepsByTags(steps, ['quick', 'analysis']);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('step1');
    });

    test('returns all steps when tags empty', () => {
      const steps = [{ id: 'step1' }, { id: 'step2' }];

      const filtered = filterStepsByTags(steps, []);

      expect(filtered).toHaveLength(2);
    });

    test('returns empty array when no matches', () => {
      const steps = [{ id: 'step1', tags: ['a'] }];

      const filtered = filterStepsByTags(steps, ['b']);

      expect(filtered).toEqual([]);
    });
  });

  describe('Pure Functions - filterStepsByEnabled', () => {
    test('filters enabled steps only by default', () => {
      const steps = [
        { id: 'step1', enabled: true },
        { id: 'step2', enabled: false },
        { id: 'step3', enabled: true },
      ];

      const filtered = filterStepsByEnabled(steps);

      expect(filtered).toHaveLength(2);
      expect(filtered[0].id).toBe('step1');
    });

    test('returns all steps when enabledOnly=false', () => {
      const steps = [
        { id: 'step1', enabled: true },
        { id: 'step2', enabled: false },
      ];

      const filtered = filterStepsByEnabled(steps, false);

      expect(filtered).toHaveLength(2);
    });
  });

  describe('Pure Functions - findStepsByPhase', () => {
    test('finds steps by phase', () => {
      const steps = [
        { id: 'step1', phase: 'analysis' },
        { id: 'step2', phase: 'testing' },
        { id: 'step3', phase: 'analysis' },
      ];

      const found = findStepsByPhase(steps, 'analysis');

      expect(found).toHaveLength(2);
      expect(found[0].id).toBe('step1');
      expect(found[1].id).toBe('step3');
    });

    test('returns empty array when no matches', () => {
      const steps = [{ id: 'step1', phase: 'analysis' }];

      const found = findStepsByPhase(steps, 'testing');

      expect(found).toEqual([]);
    });
  });

  describe('Pure Functions - sortStepsById', () => {
    test('sorts steps by numeric ID', () => {
      const steps = [
        { id: 'step_10_final' },
        { id: 'step_00_analyze' },
        { id: 'step_05_test' },
        { id: 'step_01_doc' },
      ];

      const sorted = sortStepsById(steps);

      expect(sorted[0].id).toBe('step_00_analyze');
      expect(sorted[1].id).toBe('step_01_doc');
      expect(sorted[2].id).toBe('step_05_test');
      expect(sorted[3].id).toBe('step_10_final');
    });

    test('handles steps without numeric IDs', () => {
      const steps = [{ id: 'analyze' }, { id: 'step_00_test' }];

      const sorted = sortStepsById(steps);

      expect(sorted[0].id).toBe('step_00_test');
      expect(sorted[1].id).toBe('analyze');
    });

    test('does not mutate original array', () => {
      const steps = [{ id: 'step_01' }, { id: 'step_00' }];
      const original = [...steps];

      sortStepsById(steps);

      expect(steps).toEqual(original);
    });
  });

  describe('Pure Functions - validateStepDependencies', () => {
    test('validates all dependencies exist', () => {
      const steps = [
        { id: 'step_00', dependencies: [] },
        { id: 'step_01', dependencies: ['step_00'] },
        { id: 'step_02', dependencies: ['step_01'] },
      ];

      const result = validateStepDependencies(steps);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('detects missing dependencies', () => {
      const steps = [
        { id: 'step_00', dependencies: [] },
        { id: 'step_01', dependencies: ['step_00', 'step_99'] },
      ];

      const result = validateStepDependencies(steps);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Step 'step_01' depends on non-existent step 'step_99'");
    });

    test('handles empty dependencies array', () => {
      const steps = [{ id: 'step_00', dependencies: [] }];

      const result = validateStepDependencies(steps);

      expect(result.valid).toBe(true);
    });

    test('treats missing dependencies as empty', () => {
      const steps = [{ id: 'step_00' }, { id: 'step_01', dependencies: ['step_00'] }];

      const result = validateStepDependencies(steps);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  // ============================================================================
  // StepRegistry Class Tests
  // ============================================================================

  describe('StepRegistry Class - Constructor', () => {
    test('initializes with empty registry', () => {
      const registry = new StepRegistry();

      expect(registry.steps).toBeInstanceOf(Map);
      expect(registry.steps.size).toBe(0);
      expect(registry.registrationOrder).toEqual([]);
    });
  });

  describe('StepRegistry Class - register', () => {
    test('registers a valid step', () => {
      const registry = new StepRegistry();

      const step = registry.register('step_00', {
        name: 'Analysis',
        description: 'Analyze code',
      });

      expect(step.id).toBe('step_00');
      expect(registry.has('step_00')).toBe(true);
    });

    test('throws error for duplicate registration', () => {
      const registry = new StepRegistry();

      registry.register('step_00', {
        name: 'Test',
        description: 'Test',
      });

      expect(() =>
        registry.register('step_00', {
          name: 'Duplicate',
          description: 'Duplicate',
        })
      ).toThrow(ValidationError);
    });

    test('validates step definition during registration', () => {
      const registry = new StepRegistry();

      expect(() =>
        registry.register('step_00', {
          name: 'Test',
          // Missing description
        })
      ).toThrow(ValidationError);
    });

    test('tracks registration order', () => {
      const registry = new StepRegistry();

      registry.register('step_02', { name: 'Test2', description: 'Test2' });
      registry.register('step_00', { name: 'Test0', description: 'Test0' });
      registry.register('step_01', { name: 'Test1', description: 'Test1' });

      expect(registry.registrationOrder).toEqual(['step_02', 'step_00', 'step_01']);
    });
  });

  describe('StepRegistry Class - update', () => {
    test('updates existing step', () => {
      const registry = new StepRegistry();

      registry.register('step_00', {
        name: 'Original',
        description: 'Original description',
      });

      const updated = registry.update('step_00', {
        name: 'Updated',
        description: 'Updated description',
        tags: ['new-tag'],
      });

      expect(updated.name).toBe('Updated');
      expect(updated.tags).toContain('new-tag');
    });

    test('preserves registration metadata and version across updates', () => {
      const registry = new StepRegistry();

      registry.register('step_00', {
        name: 'Original',
        description: 'Original description',
        version: '2.0.0',
      });

      const original = registry.get('step_00');
      const updated = registry.update('step_00', {
        tags: ['new-tag'],
      });

      expect(updated.metadata.registered).toBe(original.metadata.registered);
      expect(updated.metadata.version).toBe('2.0.0');
    });

    test('throws error for non-existent step', () => {
      const registry = new StepRegistry();

      expect(() =>
        registry.update('step_99', {
          name: 'Test',
          description: 'Test',
        })
      ).toThrow(ValidationError);
    });

    test('validates updated definition', () => {
      const registry = new StepRegistry();

      registry.register('step_00', {
        name: 'Test',
        description: 'Test',
      });

      expect(() =>
        registry.update('step_00', {
          phase: 'invalid-phase',
        })
      ).toThrow(ValidationError);
    });
  });

  describe('StepRegistry Class - unregister', () => {
    test('unregisters existing step', () => {
      const registry = new StepRegistry();

      registry.register('step_00', {
        name: 'Test',
        description: 'Test',
      });

      const result = registry.unregister('step_00');

      expect(result).toBe(true);
      expect(registry.has('step_00')).toBe(false);
    });

    test('returns false for non-existent step', () => {
      const registry = new StepRegistry();

      const result = registry.unregister('step_99');

      expect(result).toBe(false);
    });

    test('removes from registration order', () => {
      const registry = new StepRegistry();

      registry.register('step_00', { name: 'Test0', description: 'Test0' });
      registry.register('step_01', { name: 'Test1', description: 'Test1' });

      registry.unregister('step_00');

      expect(registry.registrationOrder).toEqual(['step_01']);
    });
  });

  describe('StepRegistry Class - get and has', () => {
    test('gets registered step', () => {
      const registry = new StepRegistry();

      registry.register('step_00', {
        name: 'Test',
        description: 'Test',
      });

      const step = registry.get('step_00');

      expect(step).not.toBeNull();
      expect(step.id).toBe('step_00');
    });

    test('returns null for non-existent step', () => {
      const registry = new StepRegistry();

      const step = registry.get('step_99');

      expect(step).toBeNull();
    });

    test('has() checks step existence', () => {
      const registry = new StepRegistry();

      registry.register('step_00', {
        name: 'Test',
        description: 'Test',
      });

      expect(registry.has('step_00')).toBe(true);
      expect(registry.has('step_99')).toBe(false);
    });
  });

  describe('StepRegistry Class - list', () => {
    test('lists all steps', () => {
      const registry = new StepRegistry();

      registry.register('step_01', { name: 'Test1', description: 'Test1' });
      registry.register('step_00', { name: 'Test0', description: 'Test0' });

      const steps = registry.list();

      expect(steps).toHaveLength(2);
      expect(steps[0].id).toBe('step_00'); // Sorted by ID
      expect(steps[1].id).toBe('step_01');
    });

    test('filters by phase', () => {
      const registry = new StepRegistry();

      registry.register('step_00', {
        name: 'Analysis',
        description: 'Analysis',
        phase: 'analysis',
      });
      registry.register('step_01', {
        name: 'Test',
        description: 'Test',
        phase: 'testing',
      });

      const steps = registry.list({ phase: 'analysis' });

      expect(steps).toHaveLength(1);
      expect(steps[0].id).toBe('step_00');
    });

    test('filters by tags', () => {
      const registry = new StepRegistry();

      registry.register('step_00', {
        name: 'Quick',
        description: 'Quick',
        tags: ['quick', 'analysis'],
      });
      registry.register('step_01', {
        name: 'Slow',
        description: 'Slow',
        tags: ['slow'],
      });

      const steps = registry.list({ tags: ['quick'] });

      expect(steps).toHaveLength(1);
      expect(steps[0].id).toBe('step_00');
    });

    test('filters by enabled status', () => {
      const registry = new StepRegistry();

      registry.register('step_00', {
        name: 'Enabled',
        description: 'Enabled',
        enabled: true,
      });
      registry.register('step_01', {
        name: 'Disabled',
        description: 'Disabled',
        enabled: false,
      });

      const steps = registry.list();

      expect(steps).toHaveLength(1);
      expect(steps[0].id).toBe('step_00');
    });

    test('includes disabled when enabledOnly=false', () => {
      const registry = new StepRegistry();

      registry.register('step_00', {
        name: 'Enabled',
        description: 'Enabled',
        enabled: true,
      });
      registry.register('step_01', {
        name: 'Disabled',
        description: 'Disabled',
        enabled: false,
      });

      const steps = registry.list({ enabledOnly: false });

      expect(steps).toHaveLength(2);
    });
  });

  describe('StepRegistry Class - getByPhase', () => {
    test('returns steps grouped by phase', () => {
      const registry = new StepRegistry();

      registry.register('step_00', {
        name: 'Analysis',
        description: 'Analysis',
        phase: 'analysis',
      });
      registry.register('step_01', {
        name: 'Test',
        description: 'Test',
        phase: 'testing',
      });

      const groups = registry.getByPhase();

      expect(groups.analysis).toHaveLength(1);
      expect(groups.testing).toHaveLength(1);
      expect(groups.quality).toHaveLength(0);
    });
  });

  describe('StepRegistry Class - getInOrder', () => {
    test('returns steps in registration order', () => {
      const registry = new StepRegistry();

      registry.register('step_10', { name: 'Last', description: 'Last' });
      registry.register('step_00', { name: 'First', description: 'First' });
      registry.register('step_05', { name: 'Middle', description: 'Middle' });

      const steps = registry.getInOrder();

      expect(steps[0].id).toBe('step_10');
      expect(steps[1].id).toBe('step_00');
      expect(steps[2].id).toBe('step_05');
    });
  });

  describe('StepRegistry Class - validateAll', () => {
    test('validates all step dependencies', () => {
      const registry = new StepRegistry();

      registry.register('step_00', {
        name: 'First',
        description: 'First',
      });
      registry.register('step_01', {
        name: 'Second',
        description: 'Second',
        dependencies: ['step_00'],
      });

      const result = registry.validateAll();

      expect(result.valid).toBe(true);
    });

    test('detects invalid dependencies', () => {
      const registry = new StepRegistry();

      registry.register('step_00', {
        name: 'Test',
        description: 'Test',
        dependencies: ['step_99'],
      });

      const result = registry.validateAll();

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('StepRegistry Class - checkRequirements', () => {
    test('checks step requirements', () => {
      const registry = new StepRegistry();

      registry.register('step_00', {
        name: 'Test',
        description: 'Test',
        requirements: {
          files: ['package.json'],
        },
      });

      const result = registry.checkRequirements('step_00', {
        files: ['package.json'],
      });

      expect(result.met).toBe(true);
    });

    test('throws error for non-existent step', () => {
      const registry = new StepRegistry();

      expect(() => registry.checkRequirements('step_99', {})).toThrow(ValidationError);
    });
  });

  describe('StepRegistry Class - clear', () => {
    test('clears all steps', () => {
      const registry = new StepRegistry();

      registry.register('step_00', { name: 'Test', description: 'Test' });
      registry.register('step_01', { name: 'Test2', description: 'Test2' });

      registry.clear();

      expect(registry.steps.size).toBe(0);
      expect(registry.registrationOrder).toEqual([]);
    });
  });

  describe('StepRegistry Class - getStats', () => {
    test('returns registry statistics', () => {
      const registry = new StepRegistry();

      registry.register('step_00', {
        name: 'Analysis',
        description: 'Analysis',
        phase: 'analysis',
        enabled: true,
        critical: true,
      });
      registry.register('step_01', {
        name: 'Test',
        description: 'Test',
        phase: 'testing',
        enabled: false,
      });

      const stats = registry.getStats();

      expect(stats.total).toBe(2);
      expect(stats.enabled).toBe(1);
      expect(stats.disabled).toBe(1);
      expect(stats.critical).toBe(1);
      expect(stats.byPhase.analysis).toBe(1);
      expect(stats.byPhase.testing).toBe(1);
    });

    test('reports every workflow phase even when empty', () => {
      const registry = new StepRegistry();

      registry.register('step_00', {
        name: 'Analysis',
        description: 'Analysis',
        phase: 'analysis',
      });

      const stats = registry.getStats();

      expect(Object.keys(stats.byPhase)).toEqual([
        'analysis',
        'validation',
        'testing',
        'quality',
        'finalization',
        'execution',
      ]);
    });
  });

  describe('StepRegistry Class - loadStepsFromDirectory', () => {
    test('throws not implemented error', () => {
      const registry = new StepRegistry();

      expect(() => registry.loadStepsFromDirectory('/path')).toThrow(SystemError);
    });
  });
});
