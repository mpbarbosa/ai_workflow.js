import { describe, it, expect, vi, afterEach } from 'vitest';
import * as api from '../../src/index';

describe('ai_workflow E2E', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('full workflow: integrates personas, updates submodules, runs steps', async () => {
    // Mock submodules and personas
    const sub = { update: vi.fn().mockResolvedValue(undefined) };
    vi.spyOn(api.GitSubmodule, 'loadAll').mockReturnValue([sub]);
    const persona = {
      id: 'pid',
      name: 'pname',
      configPath: '/tmp/x',
      detectChanges: vi.fn().mockReturnValue(true),
    };
    vi.spyOn(api.PromptPersona, 'loadAll').mockReturnValue([persona]);
    const engine = new api.WorkflowEngine();
    engine.integratePersonas();
    await engine.updateSubmodules();
    // All steps should be for personas
    expect(engine.steps.length).toBe(1);
    // Run all steps
    let ran = false;
    engine.steps[0].execute = async () => {
      ran = true;
    };
    await engine.run();
    expect(ran).toBe(true);
    expect(sub.update).toHaveBeenCalled();
  });

  it('exports all public API', () => {
    expect(typeof api.WorkflowEngine).toBe('function');
    expect(typeof api.WorkflowStep).toBe('function');
    expect(typeof api.PromptPersona).toBe('function');
    expect(typeof api.GitSubmodule).toBe('function');
  });
});
