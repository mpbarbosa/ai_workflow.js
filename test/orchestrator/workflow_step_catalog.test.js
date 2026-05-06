import {
  WORKFLOW_STAGES,
  TERMINAL_FINALIZATION_STEP_ORDER,
  enforceTerminalStepOrder,
  getCanonicalWorkflowSteps,
  getStepsForStage,
} from '../../src/orchestrator/workflow_step_catalog.js';

describe('workflow_step_catalog', () => {
  test('returns canonical quick, medium, and full stage plans', () => {
    expect(getStepsForStage(WORKFLOW_STAGES.QUICK)).toHaveLength(10);
    expect(getStepsForStage(WORKFLOW_STAGES.MEDIUM)).toHaveLength(18);
    expect(getStepsForStage(WORKFLOW_STAGES.FULL)).toHaveLength(30);
  });

  test('always keeps terminal finalization steps at the end', () => {
    expect(
      enforceTerminalStepOrder(['step_12', 'step_01', 'step_17', 'step_0f', 'step_03'])
    ).toEqual(['step_01', 'step_03', ...TERMINAL_FINALIZATION_STEP_ORDER]);
  });

  test('exposes the canonical step catalog used by MainOrchestrator', () => {
    const steps = getCanonicalWorkflowSteps();
    const stepIds = steps.map((step) => step.id);

    expect(stepIds).toContain('step_17');
    expect(stepIds).toContain('step_12');
    expect(steps.find((step) => step.id === 'step_17')?.dependencies).toEqual([
      'step_03',
      'step_11_6',
      'step_20',
      'step_23',
    ]);
  });
});
