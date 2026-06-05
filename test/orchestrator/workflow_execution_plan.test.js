import {
  buildWorkflowConfigStepIndex,
  filterProfileFocusStepIdsForContext,
  getConfiguredStepsForStage,
  normalizeWorkflowConfigStepId,
  validatePlannedStepDependencies,
} from '../../src/orchestrator/workflow_execution_plan.js';
import { WORKFLOW_STAGES } from '../../src/orchestrator/workflow_step_catalog.js';

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
