import * as root from '../src/index.js';
import * as core from '../src/core/index.js';
import * as utils from '../src/utils/index.js';
import * as lib from '../src/lib/index.js';
import * as orchestrator from '../src/orchestrator/index.js';
import * as steps from '../src/steps/index.js';

describe('grouped package entry points', () => {
  it('exports core symbols without going through the root barrel', () => {
    expect(core.Logger).toBe(root.Logger);
    expect(core.execute).toBe(root.execute);
    expect(core.detectOS).toBe(root.detectOS);
  });

  it('exports utility symbols without going through the root barrel', () => {
    expect(utils.WorkflowError).toBe(root.WorkflowError);
    expect(utils.withRetry).toBe(root.withRetry);
  });

  it('exports library symbols without going through the root barrel', () => {
    expect(lib.Config).toBe(root.Config);
    expect(lib.FileOperations).toBe(root.FileOperations);
    expect(lib.AiHelper).toBe(root.AiHelper);
  });

  it('exports orchestrator symbols without going through the root barrel', () => {
    expect(orchestrator.WorkflowEngine).toBe(root.WorkflowEngine);
    expect(orchestrator.StepRegistry).toBe(root.StepRegistry);
  });

  it('exports workflow step symbols without going through the root barrel', () => {
    expect(steps.Step0Analyzer).toBe(root.Step0Analyzer);
    expect(steps.Step16VersionUpdate).toBe(root.Step16VersionUpdate);
  });
});
