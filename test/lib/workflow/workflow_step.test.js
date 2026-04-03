import { describe, it, expect } from 'vitest';
import WorkflowStep from '../../../src/lib/workflow/workflow_step';

describe('WorkflowStep', () => {
  it('constructs with correct properties', () => {
    const fn = () => {};
    const step = new WorkflowStep('id', 'persona', fn);
    expect(step.id).toBe('id');
    expect(step.personaId).toBe('persona');
    expect(step.execute).toBe(fn);
  });
});
