import { describe, it, expect, vi, afterEach } from 'vitest';
import WorkflowEngine from '../../../src/lib/workflow/workflow_engine';
import WorkflowStep from '../../../src/lib/workflow/workflow_step';
import GitSubmodule from '../../../src/lib/git/git_submodule';
import PromptPersona from '../../../src/lib/persona/prompt_persona';

describe('WorkflowEngine', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('constructs and loads submodules/personas', () => {
    const subMock = vi.spyOn(GitSubmodule, 'loadAll').mockReturnValue([{}]);
    const personaMock = vi.spyOn(PromptPersona, 'loadAll').mockReturnValue([{}]);
    const engine = new WorkflowEngine();
    expect(engine.submodules).toEqual([{}]);
    expect(engine.personas).toEqual([{}]);
    subMock.mockRestore();
    personaMock.mockRestore();
  });

  it('integrateStep adds step', () => {
    const engine = new WorkflowEngine();
    const step = new WorkflowStep('id', 'persona', async () => {});
    engine.integrateStep(step);
    expect(engine.steps).toContain(step);
  });

  it('run executes all steps in order', async () => {
    const engine = new WorkflowEngine();
    const calls = [];
    engine.integrateStep(
      new WorkflowStep('a', 'p', async () => {
        calls.push('a');
      })
    );
    engine.integrateStep(
      new WorkflowStep('b', 'p', async () => {
        calls.push('b');
      })
    );
    await engine.run();
    expect(calls).toEqual(['a', 'b']);
  });

  it('updateSubmodules calls update on all submodules', async () => {
    const sub = { update: vi.fn().mockResolvedValue(undefined) };
    vi.spyOn(GitSubmodule, 'loadAll').mockReturnValue([sub]);
    const engine = new WorkflowEngine();
    await engine.updateSubmodules();
    expect(sub.update).toHaveBeenCalled();
  });

  it('integratePersonas adds steps for changed personas', () => {
    const persona = {
      id: 'pid',
      name: 'pname',
      configPath: '/tmp/x',
      detectChanges: vi.fn().mockReturnValue(true),
    };
    vi.spyOn(PromptPersona, 'loadAll').mockReturnValue([persona]);
    const engine = new WorkflowEngine();
    engine.integratePersonas();
    expect(engine.steps.some((s) => s.personaId === 'pid')).toBe(true);
    expect(engine.personas).toEqual([persona]);
  });

  it('integratePersonas skips unchanged personas', () => {
    const persona = {
      id: 'pid',
      name: 'pname',
      configPath: '/tmp/x',
      detectChanges: vi.fn().mockReturnValue(false),
    };
    vi.spyOn(PromptPersona, 'loadAll').mockReturnValue([persona]);
    const engine = new WorkflowEngine();
    engine.integratePersonas();
    expect(engine.steps.some((s) => s.personaId === 'pid')).toBe(false);
  });
});
