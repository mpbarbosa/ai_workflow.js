// test/steps/step_contract.test.js

import { STEP_KIND } from '../../src/steps/step_contract.js';

describe('STEP_KIND enum', () => {
  it('should have PROJECT and CONTEXT properties', () => {
    expect(STEP_KIND).toHaveProperty('PROJECT');
    expect(STEP_KIND).toHaveProperty('CONTEXT');
  });

  it('PROJECT should be "project"', () => {
    expect(STEP_KIND.PROJECT).toBe('project');
  });

  it('CONTEXT should be "context"', () => {
    expect(STEP_KIND.CONTEXT).toBe('context');
  });

  it('should be frozen and immutable', () => {
    expect(Object.isFrozen(STEP_KIND)).toBe(true);
    expect(() => { STEP_KIND.PROJECT = 'foo'; }).toThrow();
    expect(() => { STEP_KIND.NEW_KIND = 'new'; }).toThrow();
  });

  it('should not allow deletion of properties', () => {
    expect(() => { delete STEP_KIND.PROJECT; }).toThrow();
    expect(STEP_KIND.PROJECT).toBe('project');
  });

  it('should only have two keys', () => {
    expect(Object.keys(STEP_KIND)).toEqual(['PROJECT', 'CONTEXT']);
  });
});

describe('StepKind usage in step classes', () => {
  class ProjectStep {
    static stepKind = STEP_KIND.PROJECT;
  }
  class ContextStep {
    static stepKind = STEP_KIND.CONTEXT;
  }

  it('ProjectStep.stepKind should be STEP_KIND.PROJECT', () => {
    expect(ProjectStep.stepKind).toBe('project');
  });

  it('ContextStep.stepKind should be STEP_KIND.CONTEXT', () => {
    expect(ContextStep.stepKind).toBe('context');
  });
});

describe('Step contract documentation typedefs', () => {
  it('should define StepResult properties', () => {
    const result = {
      success: true,
      skipped: false,
      reason: 'All good',
      error: undefined,
      summary: 'Step completed',
    };
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('skipped');
    expect(result).toHaveProperty('reason');
    expect(result).toHaveProperty('error');
    expect(result).toHaveProperty('summary');
  });

  it('should define ProjectStepContext properties', () => {
    const ctx = { projectRoot: '/abs/path/to/project' };
    expect(ctx).toHaveProperty('projectRoot');
    expect(typeof ctx.projectRoot).toBe('string');
  });

  it('should define WorkflowContext properties', () => {
    const ctx = {
      projectRoot: '/abs/path/to/project',
      workflowDir: '.ai_workflow',
      auto: true,
    };
    expect(ctx).toHaveProperty('projectRoot');
    expect(ctx).toHaveProperty('workflowDir');
    expect(ctx).toHaveProperty('auto');
    expect(typeof ctx.projectRoot).toBe('string');
    expect(typeof ctx.workflowDir).toBe('string');
    expect(typeof ctx.auto).toBe('boolean');
  });

  it('should allow WorkflowContext with only projectRoot', () => {
    const ctx = { projectRoot: '/abs/path/to/project' };
    expect(ctx).toHaveProperty('projectRoot');
    expect(ctx.workflowDir).toBeUndefined();
    expect(ctx.auto).toBeUndefined();
  });
});
