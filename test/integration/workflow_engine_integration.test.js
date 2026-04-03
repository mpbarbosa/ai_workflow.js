import { describe, it, expect, vi, afterEach } from 'vitest';
import WorkflowEngine from '../../src/lib/workflow/workflow_engine';
import WorkflowStep from '../../src/lib/workflow/workflow_step';
import GitSubmodule from '../../src/lib/git/git_submodule';
import PromptPersona from '../../src/lib/persona/prompt_persona';

describe('WorkflowEngine Integration', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('runs steps and updates submodules', async () => {
    // Mock submodule update
    const sub = { update: vi.fn().mockResolvedValue(undefined) };
    vi.spyOn(GitSubmodule, 'loadAll').mockReturnValue([sub]);
    // Mock personas
    vi.spyOn(PromptPersona, 'loadAll').mockReturnValue([]);
    const engine = new WorkflowEngine();
    let ran = false;
    engine.integrateStep(
      new WorkflowStep('id', 'persona', async () => {
        ran = true;
      })
    );
    await engine.updateSubmodules();
    expect(sub.update).toHaveBeenCalled();
    await engine.run();
    expect(ran).toBe(true);
  });

  it('integrates personas and runs their steps', async () => {
    let executed = false;
    const persona = {
      id: 'pid',
      name: 'pname',
      configPath: '/tmp/x',
      detectChanges: vi.fn().mockReturnValue(true),
    };
    vi.spyOn(PromptPersona, 'loadAll').mockReturnValue([persona]);
    const engine = new WorkflowEngine();
    // Patch integrateStep to capture the step and run it
    const origIntegrateStep = engine.integrateStep.bind(engine);
    engine.integrateStep = (step) => {
      origIntegrateStep(step);
      // run the step immediately for test
      step.execute().then(() => {
        executed = true;
      });
    };
    engine.integratePersonas();
    // Wait for async execute
    await new Promise((res) => setTimeout(res, 10));
    expect(executed).toBe(true);
  });
});
