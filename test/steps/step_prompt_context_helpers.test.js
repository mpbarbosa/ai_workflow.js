import { jest } from '@jest/globals';

const yamlLoad = jest.fn();
const buildProjectKindPrompt = jest.fn();
const loadResolvedAiHelpers = jest.fn();
const AI_PROJECT_KINDS_PATH = '/tmp/project-kinds.yaml';

jest.unstable_mockModule('js-yaml', () => ({
  default: {
    load: yamlLoad,
  },
}));

jest.unstable_mockModule('../../src/lib/ai_prompt_builder.js', () => ({
  AI_PROJECT_KINDS_PATH,
  buildProjectKindPrompt,
  loadResolvedAiHelpers,
}));

const { loadProjectKindPromptContext, prependProjectKindRole } =
  await import('../../src/steps/step_prompt_context_helpers.js');

describe('step_prompt_context_helpers', () => {
  beforeEach(() => {
    yamlLoad.mockReset();
    buildProjectKindPrompt.mockReset();
    loadResolvedAiHelpers.mockReset();
  });

  describe('loadProjectKindPromptContext', () => {
    it('loads both resolved YAML and the optional project-kind role override', async () => {
      const fileOps = {
        readFile: jest.fn().mockResolvedValue('project-kinds: true'),
      };
      const parsedYaml = { prompts: true };
      const parsedProjectKinds = { kinds: true };

      loadResolvedAiHelpers.mockResolvedValue(parsedYaml);
      yamlLoad.mockReturnValue(parsedProjectKinds);
      buildProjectKindPrompt.mockReturnValue({ role: 'Frontend reviewer' });

      const result = await loadProjectKindPromptContext(fileOps, {
        projectKind: 'react_spa',
        personaKey: 'code_quality_auditor',
      });

      expect(loadResolvedAiHelpers).toHaveBeenCalledWith(fileOps);
      expect(fileOps.readFile).toHaveBeenCalledWith(AI_PROJECT_KINDS_PATH);
      expect(yamlLoad).toHaveBeenCalledWith('project-kinds: true');
      expect(buildProjectKindPrompt).toHaveBeenCalledWith(
        parsedProjectKinds,
        'react_spa',
        'code_quality_auditor'
      );
      expect(result).toEqual({
        parsedYaml,
        roleOverride: 'Frontend reviewer',
      });
    });

    it('keeps the role override optional when project-kind metadata is unavailable', async () => {
      const fileOps = {
        readFile: jest.fn().mockRejectedValue(new Error('missing project kinds')),
      };
      const parsedYaml = { prompts: true };

      loadResolvedAiHelpers.mockResolvedValue(parsedYaml);

      const result = await loadProjectKindPromptContext(fileOps, {
        projectKind: 'default',
        personaKey: 'documentation_specialist',
      });

      expect(result).toEqual({
        parsedYaml,
        roleOverride: '',
      });
      expect(buildProjectKindPrompt).not.toHaveBeenCalled();
    });

    it('still attempts the project-kind overlay when resolved YAML is unavailable', async () => {
      const fileOps = {
        readFile: jest.fn().mockResolvedValue('project-kinds: true'),
      };

      loadResolvedAiHelpers.mockRejectedValue(new Error('missing ai helpers'));
      yamlLoad.mockReturnValue({ kinds: true });
      buildProjectKindPrompt.mockReturnValue({ role: 'Docs reviewer' });

      const result = await loadProjectKindPromptContext(fileOps, {
        personaKey: 'documentation_specialist',
      });

      expect(result).toEqual({
        parsedYaml: null,
        roleOverride: 'Docs reviewer',
      });
      expect(buildProjectKindPrompt).toHaveBeenCalledWith(
        { kinds: true },
        'default',
        'documentation_specialist'
      );
    });
  });

  describe('prependProjectKindRole', () => {
    it('prepends the project-kind role banner when both values are present', () => {
      expect(prependProjectKindRole('Prompt body', 'Role text')).toBe(
        '[Project-Kind Role: Role text]\n\nPrompt body'
      );
    });

    it('returns the original prompt when the banner cannot be applied', () => {
      expect(prependProjectKindRole('Prompt body', '')).toBe('Prompt body');
      expect(prependProjectKindRole('', 'Role text')).toBe('');
    });
  });
});
