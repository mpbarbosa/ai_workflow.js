/**
 * @fileoverview Tests for olinda_step_registry.d.ts
 */

import type {
  StepStage,
  WorkflowPhase,
  StepRequirements,
  StepMetadataRecord,
  StepDefinitionInput,
  StepDefinition,
  StepRequirementContext,
  RequirementMatchResult,
  DependencyValidationResult,
  StepRegistryStats,
  StepListFilter,
  StepRegistryValidationError,
  StepRegistrySystemError,
} from '../../src/orchestrator/olinda_step_registry.d';

describe('olinda_step_registry.d.ts types', () => {
  it('StepStage and WorkflowPhase are string aliases', () => {
    const stage: StepStage = 'custom_stage';
    const phase: WorkflowPhase = 'custom_phase';
    expect(typeof stage).toBe('string');
    expect(typeof phase).toBe('string');
  });

  it('StepRequirements allows optional fields', () => {
    const req: StepRequirements = {
      files: ['a.js'],
      tools: ['node'],
      config: { foo: 1 },
      env: ['FOO'],
    };
    expect(req.files).toContain('a.js');
    expect(req.tools).toContain('node');
    expect(req.config).toHaveProperty('foo');
    expect(req.env).toContain('FOO');
  });

  it('StepMetadataRecord is a Record<string, unknown>', () => {
    const meta: StepMetadataRecord = { foo: 1, bar: 'baz' };
    expect(meta.foo).toBe(1);
    expect(meta.bar).toBe('baz');
  });

  it('StepDefinitionInput requires id, name, description', () => {
    const input: StepDefinitionInput = {
      id: 'step_01',
      name: 'Test Step',
      description: 'desc',
    };
    expect(input.id).toBe('step_01');
    expect(input.name).toBe('Test Step');
    expect(input.description).toBe('desc');
  });

  it('StepDefinition has required and optional fields', () => {
    const def: StepDefinition = {
      id: 'step_01',
      name: 'Test Step',
      description: 'desc',
      stage: 'main',
      dependencies: [],
      tags: [],
      critical: false,
      enabled: true,
      timeout: 300,
      requirements: {},
      metadata: {
        registeredAt: null,
        version: '1.0.0',
      },
    };
    expect(def.id).toBe('step_01');
    expect(def.metadata.version).toBe('1.0.0');
  });

  it('StepRequirementContext allows partial context', () => {
    const ctx: StepRequirementContext = {
      files: ['a.js'],
      env: { FOO: 'bar' },
    };
    expect(ctx.files).toContain('a.js');
    expect(ctx.env).toHaveProperty('FOO');
  });

  it('RequirementMatchResult structure', () => {
    const result: RequirementMatchResult = { met: true, missing: [] };
    expect(typeof result.met).toBe('boolean');
    expect(Array.isArray(result.missing)).toBe(true);
  });

  it('DependencyValidationResult structure', () => {
    const result: DependencyValidationResult = { valid: false, errors: ['err'] };
    expect(typeof result.valid).toBe('boolean');
    expect(result.errors).toContain('err');
  });

  it('StepRegistryStats structure', () => {
    const stats: StepRegistryStats = {
      total: 2,
      enabled: 1,
      disabled: 1,
      critical: 0,
      byStage: { main: 2 },
    };
    expect(stats.total).toBe(2);
    expect(stats.byStage.main).toBe(2);
  });

  it('StepListFilter allows optional filters', () => {
    const filter: StepListFilter = {
      stage: 'main',
      tags: ['foo'],
      enabledOnly: false,
    };
    expect(filter.stage).toBe('main');
    expect(filter.tags).toContain('foo');
    expect(filter.enabledOnly).toBe(false);
  });

  it('StepRegistryValidationError and StepRegistrySystemError are constructible', () => {
    // These are declared classes, but not implemented in d.ts, so just type check
    const ValidationError: new (msg: string) => Error = StepRegistryValidationError;
    const SystemError: new (msg: string) => Error = StepRegistrySystemError;
    const err1 = new ValidationError('bad');
    const err2 = new SystemError('fail');
    expect(err1).toBeInstanceOf(Error);
    expect(err2).toBeInstanceOf(Error);
  });
});
