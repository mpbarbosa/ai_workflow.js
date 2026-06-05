import {
  buildWorkflowConfigStepIndex,
  filterProfileFocusStepIdsForContext,
  getConfiguredStepsForStage,
  normalizeWorkflowConfigStepId,
  normalizeLegacyWorkflowStageStepDefinitions,
  validatePlannedStepDependencies,
  validateWorkflowStageStepDefinitions,
} from '../../src/orchestrator/workflow_execution_plan.js';
import { WORKFLOW_STAGES, getStepsForStage } from '../../src/orchestrator/workflow_step_catalog.js';

describe('workflow_execution_plan', () => {
  test('normalizes workflow-config step ids', () => {
    expect(normalizeWorkflowConfigStepId('08')).toBe('step_08');
    expect(normalizeWorkflowConfigStepId(' step_14 ')).toBe('step_14');
    expect(normalizeWorkflowConfigStepId('11_5')).toBe('step_11_5');
    expect(normalizeWorkflowConfigStepId('bad-id!')).toBeNull();
  });

  test('builds workflow step overrides from workflow config', () => {
    expect(
      buildWorkflowConfigStepIndex({
        workflow: {
          steps: [{ id: '08', enabled: false, dependencies: ['07'], phase: 'testing' }],
        },
      })
    ).toEqual({
      step_08: {
        enabled: false,
        dependencies: ['step_07'],
        phase: 'testing',
        critical: undefined,
        name: undefined,
        description: undefined,
        dependencyComment: undefined,
        priority: undefined,
        maxStepWallTime: undefined,
      },
    });
  });

  test('derives configured full-stage steps and preserves terminal ordering', () => {
    expect(
      getConfiguredStepsForStage(WORKFLOW_STAGES.FULL, {
        workflow: {
          steps: [
            { id: '00', enabled: true },
            { id: '01', enabled: true },
            { id: '14', enabled: true },
            { id: '08', enabled: false },
          ],
        },
      })
    ).toEqual(['step_00', 'step_01', 'step_14', 'step_17', 'step_0f', 'step_12']);
  });

  test('filters profile focus steps by project context', () => {
    expect(
      filterProfileFocusStepIdsForContext(['step_14', 'step_20'], {
        project: { kind: 'generic' },
      })
    ).toEqual(['step_20']);
  });

  test('reports excluded prerequisites in a planned execution set', () => {
    const result = validatePlannedStepDependencies(
      ['step_11'],
      { step_11: ['step_13'] },
      ['step_11', 'step_13'],
      { disabledStepIds: ['step_13'] }
    );

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain(
      'step_11 depends on step(s) excluded from the execution plan'
    );
  });
});

describe('normalizeLegacyWorkflowStageStepDefinitions', () => {
  test('returns config unchanged when no stages block is present', () => {
    const config = { workflow: { steps: [] } };
    const { workflowConfig, warnings } = normalizeLegacyWorkflowStageStepDefinitions(config);
    expect(workflowConfig).toBe(config);
    expect(warnings).toEqual([]);
  });

  test('strips steps key and emits warning when stage steps exactly match canonical', () => {
    const canonicalQuickSteps = getStepsForStage(WORKFLOW_STAGES.QUICK);
    const config = {
      workflow: {
        stages: {
          quick: { enabled: true, steps: [...canonicalQuickSteps] },
        },
      },
    };
    const { workflowConfig, warnings } = normalizeLegacyWorkflowStageStepDefinitions(config);
    expect(workflowConfig.workflow.stages.quick).not.toHaveProperty('steps');
    expect(workflowConfig.workflow.stages.quick.enabled).toBe(true);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('exactly matches the canonical quick stage');
  });

  test('strips steps key and emits advisory when stage steps are a subset of canonical (drift scenario)', () => {
    // Simulate a config written when the canonical quick stage was smaller:
    // only step_00 and step_01 were listed, but canonical now includes more.
    const config = {
      workflow: {
        stages: {
          quick: { enabled: true, steps: ['step_00', 'step_01'] },
        },
      },
    };
    const { workflowConfig, warnings } = normalizeLegacyWorkflowStageStepDefinitions(config);
    expect(workflowConfig.workflow.stages.quick).not.toHaveProperty('steps');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('is a subset of the canonical quick stage');
    expect(warnings[0]).toContain("Remove the 'steps:' key");
  });

  test('leaves config unchanged when stage steps contain IDs not in canonical (genuinely invalid)', () => {
    const config = {
      workflow: {
        stages: {
          quick: { enabled: true, steps: ['step_00', 'step_NONEXISTENT'] },
        },
      },
    };
    const { workflowConfig, warnings } = normalizeLegacyWorkflowStageStepDefinitions(config);
    // Should not have stripped — invalid case is left for validateWorkflowStageStepDefinitions
    expect(workflowConfig.workflow.stages.quick).toHaveProperty('steps');
    expect(warnings).toEqual([]);
  });

  test('handles multiple stages: subset stages are stripped, invalid stages are left untouched', () => {
    const canonicalMediumSteps = getStepsForStage(WORKFLOW_STAGES.MEDIUM);
    const config = {
      workflow: {
        stages: {
          quick: { enabled: true, steps: ['step_00', 'step_01'] }, // subset → strip
          medium: { enabled: true, steps: [...canonicalMediumSteps] }, // exact → strip
          full: { enabled: true, steps: ['step_00', 'step_INVALID'] }, // invalid → leave
        },
      },
    };
    const { workflowConfig, warnings } = normalizeLegacyWorkflowStageStepDefinitions(config);
    expect(workflowConfig.workflow.stages.quick).not.toHaveProperty('steps');
    expect(workflowConfig.workflow.stages.medium).not.toHaveProperty('steps');
    expect(workflowConfig.workflow.stages.full).toHaveProperty('steps'); // invalid — not stripped
    expect(warnings).toHaveLength(2);
    expect(warnings.some((w) => w.includes('subset of the canonical quick'))).toBe(true);
    expect(warnings.some((w) => w.includes('exactly matches the canonical medium'))).toBe(true);
  });
});

describe('validateWorkflowStageStepDefinitions', () => {
  test('returns valid when no stages block is present', () => {
    expect(validateWorkflowStageStepDefinitions({ workflow: {} })).toEqual({
      valid: true,
      errors: [],
    });
  });

  test('returns valid when stage has no steps key', () => {
    expect(
      validateWorkflowStageStepDefinitions({
        workflow: { stages: { quick: { enabled: true } } },
      })
    ).toEqual({ valid: true, errors: [] });
  });

  test('returns valid when stage steps exactly match canonical', () => {
    const canonicalQuickSteps = getStepsForStage(WORKFLOW_STAGES.QUICK);
    expect(
      validateWorkflowStageStepDefinitions({
        workflow: {
          stages: { quick: { enabled: true, steps: [...canonicalQuickSteps] } },
        },
      })
    ).toEqual({ valid: true, errors: [] });
  });

  test('emits per-stage error with migration snippet for a single mismatch', () => {
    const result = validateWorkflowStageStepDefinitions({
      workflow: {
        stages: {
          quick: { enabled: true, steps: ['step_00', 'step_INVALID'] },
        },
      },
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain(
      'workflow.stages.quick.steps does not control execution order'
    );
    expect(result.errors[0]).toContain('Equivalent migration');
    expect(result.errors[0]).toContain('enabled: false');
  });

  test('emits one consolidated error when multiple stages have the same mismatch class', () => {
    const result = validateWorkflowStageStepDefinitions({
      workflow: {
        stages: {
          quick: { enabled: true, steps: ['step_00', 'step_INVALID_A'] },
          medium: { enabled: true, steps: ['step_00', 'step_INVALID_B'] },
        },
      },
    });
    expect(result.valid).toBe(false);
    // Must be exactly ONE consolidated error, not two separate ones
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('{quick, medium}');
    expect(result.errors[0]).toContain('all define');
    expect(result.errors[0]).toContain('Stage details:');
  });

  test('reports non-array steps as a separate per-stage error', () => {
    const result = validateWorkflowStageStepDefinitions({
      workflow: {
        stages: { quick: { enabled: true, steps: 'not-an-array' } },
      },
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('must be an array of step IDs or be omitted');
  });
});
