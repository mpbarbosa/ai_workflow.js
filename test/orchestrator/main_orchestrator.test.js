/**
 * @fileoverview Tests for Main Workflow Orchestrator (v2.0.0)
 * @version 2.0.0
 */

import {
  validateOrchestratorConfig,
  getStepsForStage,
  normalizeWorkflowConfigStepId,
  buildWorkflowConfigStepIndex,
  getConfiguredStepsForStage,
  getDisabledWorkflowConfigStepIds,
  validateWorkflowStageStepDefinitions,
  filterStepIdsByProfile,
  enforceTerminalStepOrder,
  sanitizeWorkflowConfigDependencies,
  validatePlannedStepDependencies,
  detectWorkflowConfigStructure,
  buildGeneratedWorkflowConfig,
  calculateProgress,
  determineWorkflowStatus,
  performHealthChecks,
  detectPreflightPackageManager,
  getPreflightQualityCommands,
  buildMlChangeStats,
  MainOrchestrator,
  WORKFLOW_STAGES,
  HEALTH_CHECK_CATEGORIES,
} from '../../src/orchestrator/main_orchestrator.js';

import { jest } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';

function mockSkippedPreflightSuites(orchestrator) {
  return jest.spyOn(orchestrator, '_runPreflightQualitySuites').mockResolvedValue({
    passed: true,
    skipped: true,
    commands: [],
    message: 'No package.json found in project root',
  });
}

beforeEach(() => {
  jest.spyOn(MainOrchestrator.prototype, '_runPreflightQualitySuites').mockResolvedValue({
    passed: true,
    skipped: true,
    commands: [],
    message: 'No package.json found in project root',
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ============================================================================
// PURE FUNCTION TESTS
// ============================================================================

describe('Main Orchestrator - Pure Functions', () => {
  describe('validateOrchestratorConfig', () => {
    test('should validate valid configuration', () => {
      const config = {
        workflowDir: '.ai_workflow',
        stage: 'full',
        auto: true,
      };

      const result = validateOrchestratorConfig(config);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('should reject non-object config', () => {
      const result = validateOrchestratorConfig(null);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Config must be an object');
    });

    test('should reject invalid stage', () => {
      const config = {
        stage: 'invalid',
      };

      const result = validateOrchestratorConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Invalid stage');
    });

    test('should reject non-string workflowDir', () => {
      const config = {
        workflowDir: 123,
      };

      const result = validateOrchestratorConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('workflowDir must be a string');
    });

    test('should reject non-boolean auto', () => {
      const config = {
        auto: 'yes',
      };

      const result = validateOrchestratorConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('auto must be a boolean');
    });

    test('should reject non-string resumeFromCheckpoint', () => {
      const config = {
        resumeFromCheckpoint: 123,
      };

      const result = validateOrchestratorConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('resumeFromCheckpoint must be a string (checkpoint ID)');
    });
  });

  describe('getStepsForStage', () => {
    test('should return quick validation steps', () => {
      const steps = getStepsForStage(WORKFLOW_STAGES.QUICK);

      expect(steps).toHaveLength(10);
      expect(steps).toContain('step_00');
      expect(steps).toContain('step_0b');
      expect(steps).toContain('step_01');
      expect(steps).toContain('step_01_5');
      expect(steps).toContain('step_02');
      expect(steps).toContain('step_04');
      expect(steps).toContain('step_05');
      expect(steps.slice(-3)).toEqual(['step_17', 'step_0f', 'step_12']);
    });

    test('should return medium validation steps', () => {
      const steps = getStepsForStage(WORKFLOW_STAGES.MEDIUM);

      expect(steps).toHaveLength(18);
      expect(steps).toContain('step_0b');
      expect(steps).toContain('step_01_5'); // Copilot instructions validation
      expect(steps).toContain('step_08'); // Test execution
      expect(steps).toContain('step_10'); // Code quality
      expect(steps).toContain('step_21'); // Doc consolidation
      expect(steps.slice(-3)).toEqual(['step_17', 'step_0f', 'step_12']);
    });

    test('should return full workflow steps', () => {
      const steps = getStepsForStage(WORKFLOW_STAGES.FULL);

      expect(steps).toHaveLength(30); // All 30 steps
      expect(steps).toContain('step_00');
      expect(steps).toContain('step_0b');
      expect(steps).toContain('step_0f');
      expect(steps).toContain('step_01_5'); // Copilot instructions validation
      expect(steps).toContain('step_17'); // Summary
      expect(steps).toContain('step_21'); // Doc consolidation
    });

    test('should default to full workflow for invalid stage', () => {
      const steps = getStepsForStage('invalid');

      expect(steps).toHaveLength(30);
    });
  });

  describe('workflow config step helpers', () => {
    test('normalizes workflow-config step ids to runtime step ids', () => {
      expect(normalizeWorkflowConfigStepId('08')).toBe('step_08');
      expect(normalizeWorkflowConfigStepId('step_14')).toBe('step_14');
      expect(normalizeWorkflowConfigStepId(' 11_5 ')).toBe('step_11_5');
      expect(normalizeWorkflowConfigStepId('bad-id!')).toBeNull();
    });

    test('builds registry overrides from workflow config', () => {
      const workflowConfig = {
        workflow: {
          steps: [
            {
              id: '08',
              enabled: false,
              dependencies: ['07'],
              phase: 'testing',
              optional: true,
            },
          ],
        },
      };

      expect(buildWorkflowConfigStepIndex(workflowConfig)).toEqual({
        step_08: {
          enabled: false,
          dependencies: ['step_07'],
          phase: 'testing',
          critical: false,
          name: undefined,
          description: undefined,
        },
      });
    });

    test('uses enabled workflow-config steps for full stage', () => {
      const workflowConfig = {
        workflow: {
          steps: [
            { id: '00', enabled: true },
            { id: '01', enabled: true },
            { id: '08', enabled: false },
            { id: '14', enabled: true },
          ],
        },
      };

      expect(getConfiguredStepsForStage(WORKFLOW_STAGES.FULL, workflowConfig)).toEqual([
        'step_00',
        'step_01',
        'step_14',
        'step_17',
        'step_0f',
        'step_12',
      ]);
    });

    test('filters quick stage through workflow-config enablement', () => {
      const workflowConfig = {
        workflow: {
          steps: [
            { id: '00', enabled: true },
            { id: '01', enabled: true },
            { id: '01_5', enabled: true },
            { id: '02', enabled: true },
            { id: '04', enabled: false },
            { id: '05', enabled: true },
          ],
        },
      };

      expect(getConfiguredStepsForStage(WORKFLOW_STAGES.QUICK, workflowConfig)).toEqual([
        'step_00',
        'step_01',
        'step_01_5',
        'step_02',
        'step_05',
        'step_17',
        'step_0f',
        'step_12',
      ]);
    });

    test('enforces terminal finalization steps at the end of full-stage configured plans', () => {
      const workflowConfig = {
        workflow: {
          steps: [
            { id: '00', enabled: true },
            { id: '12', enabled: true },
            { id: '16', enabled: true },
            { id: '17', enabled: true },
            { id: '0f', enabled: true },
          ],
        },
      };

      expect(getConfiguredStepsForStage(WORKFLOW_STAGES.FULL, workflowConfig)).toEqual([
        'step_00',
        'step_16',
        'step_17',
        'step_0f',
        'step_12',
      ]);
    });

    test('rejects non-canonical workflow.stages step lists', () => {
      const validation = validateWorkflowStageStepDefinitions({
        workflow: {
          stages: {
            full: {
              enabled: true,
              steps: ['step_00', 'step_0b', 'step_01', 'step_12'],
            },
          },
        },
      });

      expect(validation.valid).toBe(false);
      expect(validation.errors).toHaveLength(1);
      expect(validation.errors[0]).toContain('workflow.stages.full.steps');
      expect(validation.errors[0]).toContain('does not control execution order');
      expect(validation.errors[0]).toContain('workflow.steps');
    });

    test('rejects non-canonical workflow.stages step lists', () => {
      const validation = validateWorkflowStageStepDefinitions({
        workflow: {
          stages: {
            full: {
              enabled: true,
              steps: ['step_00', 'step_0b', 'step_01', 'step_12'],
            },
          },
        },
      });

      expect(validation.valid).toBe(false);
      expect(validation.errors).toHaveLength(1);
      expect(validation.errors[0]).toContain('workflow.stages.full.steps');
      expect(validation.errors[0]).toContain('does not control execution order');
      expect(validation.errors[0]).toContain('workflow.steps');
    });
  });

  describe('filterStepIdsByProfile', () => {
    test('removes skipped steps and downstream dependencies from the plan', () => {
      const plannedSteps = ['step_00', 'step_05', 'step_06', 'step_07', 'step_08', 'step_09'];
      const dependencyIndex = {
        step_06: ['step_05'],
        step_07: ['step_06'],
        step_08: ['step_07'],
        step_09: ['step_08'],
      };

      expect(filterStepIdsByProfile(plannedSteps, [7, 8], dependencyIndex)).toEqual([
        'step_00',
        'step_05',
        'step_06',
      ]);
    });

    test('supports fractional step identifiers like 11.5', () => {
      const plannedSteps = ['step_11', 'step_11_5', 'step_11_6'];
      const dependencyIndex = {
        step_11_5: ['step_11'],
        step_11_6: ['step_11_5'],
      };

      expect(filterStepIdsByProfile(plannedSteps, [11.5], dependencyIndex)).toEqual(['step_11']);
    });

    test('preserves focus-step dependency closure even when skips conflict', () => {
      const plannedSteps = [
        'step_00',
        'step_01',
        'step_02',
        'step_04',
        'step_05',
        'step_06',
        'step_07',
        'step_08',
        'step_09',
        'step_10',
        'step_11',
        'step_13',
        'step_14',
      ];
      const dependencyIndex = {
        step_01: ['step_00'],
        step_02: ['step_01'],
        step_04: ['step_00'],
        step_05: ['step_04'],
        step_06: ['step_05'],
        step_07: ['step_06'],
        step_08: ['step_07'],
        step_09: ['step_08'],
        step_10: ['step_09'],
        step_13: ['step_10'],
        step_14: ['step_13'],
      };

      expect(filterStepIdsByProfile(plannedSteps, [2, 4], dependencyIndex, [8, 9, 14])).toEqual([
        'step_00',
        'step_04',
        'step_05',
        'step_06',
        'step_07',
        'step_08',
        'step_09',
        'step_10',
        'step_13',
        'step_14',
      ]);
    });

    test('preserves mandatory full-stage git finalization chain', () => {
      const plannedSteps = [
        'step_00',
        'step_04',
        'step_05',
        'step_06',
        'step_07',
        'step_08',
        'step_09',
        'step_10',
        'step_13',
        'step_14',
        'step_15',
        'step_16',
        'step_18',
        'step_19',
        'step_20',
        'step_17',
        'step_0f',
        'step_12',
      ];
      const dependencyIndex = {
        step_04: ['step_00'],
        step_05: ['step_04'],
        step_06: ['step_05'],
        step_07: ['step_06'],
        step_08: ['step_07'],
        step_09: ['step_08'],
        step_10: ['step_09'],
        step_13: ['step_10'],
        step_14: ['step_13'],
        step_15: ['step_14'],
        step_16: ['step_15'],
        step_18: ['step_16'],
        step_19: ['step_18'],
        step_20: ['step_19'],
        step_17: ['step_20'],
        step_0f: ['step_17'],
        step_12: ['step_0f'],
      };

      expect(
        filterStepIdsByProfile(plannedSteps, [2, 4], dependencyIndex, ['step_08'], ['step_12'])
      ).toEqual(plannedSteps);
    });

    test('does not collapse focus=all plans to the preserved terminal dependency chain', () => {
      const plannedSteps = [
        'step_00',
        'step_04',
        'step_08',
        'step_16',
        'step_17',
        'step_0f',
        'step_12',
      ];
      const dependencyIndex = {
        step_04: ['step_00'],
        step_08: ['step_04'],
        step_16: ['step_08'],
        step_17: ['step_16'],
        step_0f: ['step_17'],
        step_12: ['step_0f'],
      };

      expect(filterStepIdsByProfile(plannedSteps, [], dependencyIndex, 'all', ['step_12'])).toEqual(
        plannedSteps
      );
    });

    test('preserved steps survive cascade removal when focus=all and an upstream dep is skipped', () => {
      // step_17/step_0f/step_12 are preserved (mandatory terminal chain).
      // step_16 is skipped; step_17 depends on it.
      // Without protection, the cascade loop would delete step_17 → step_0f → step_12.
      const plannedSteps = [
        'step_00',
        'step_04',
        'step_08',
        'step_16',
        'step_17',
        'step_0f',
        'step_12',
      ];
      const dependencyIndex = {
        step_04: ['step_00'],
        step_08: ['step_04'],
        step_16: ['step_08'],
        step_17: ['step_16'],
        step_0f: ['step_17'],
        step_12: ['step_0f'],
      };

      const result = filterStepIdsByProfile(plannedSteps, ['step_16'], dependencyIndex, 'all', [
        'step_17',
        'step_0f',
        'step_12',
      ]);

      expect(result).toEqual(['step_00', 'step_04', 'step_08', 'step_17', 'step_0f', 'step_12']);
    });

    test('returns empty array when stepIds is empty', () => {
      expect(filterStepIdsByProfile([], [1], {})).toEqual([]);
    });

    test('returns empty array when stepIds is not an array', () => {
      expect(filterStepIdsByProfile(null, [1], {})).toEqual([]);
    });

    test('ignores non-finite number skip step (NaN maps to null)', () => {
      const plannedSteps = ['step_00', 'step_01'];
      // NaN satisfies !Number.isFinite → normalizeProfileSkipStepId returns null → ignored
      expect(filterStepIdsByProfile(plannedSteps, [NaN], {})).toEqual(plannedSteps);
    });

    test('ignores skip step whose stringified major part fails digit validation (-1.5)', () => {
      const plannedSteps = ['step_00', 'step_01'];
      // -1.5 → '-1_5' → major '-1' fails /^\d+$/ → normalizeProfileSkipStepId returns null → ignored
      expect(filterStepIdsByProfile(plannedSteps, [-1.5], {})).toEqual(plannedSteps);
    });
  });

  describe('validatePlannedStepDependencies', () => {
    test('flags selected steps that depend on excluded prerequisites that are not disabled', () => {
      expect(
        validatePlannedStepDependencies(
          ['step_15', 'step_16'],
          {
            step_15: ['step_14'],
            step_16: ['step_15'],
          },
          ['step_14', 'step_15', 'step_16']
        )
      ).toEqual({
        valid: false,
        errors: [
          expect.stringContaining(
            'Selected step step_15 depends on step(s) excluded from the execution plan: step_14.'
          ),
        ],
      });
    });

    test('flags selected steps whose missing prerequisite is explicitly disabled', () => {
      expect(
        validatePlannedStepDependencies(
          ['step_15', 'step_16'],
          {
            step_15: ['step_14'],
            step_16: ['step_15'],
          },
          ['step_14', 'step_15', 'step_16'],
          { disabledStepIds: ['step_14'] }
        )
      ).toEqual({
        valid: false,
        errors: [
          expect.stringContaining(
            'Selected step step_15 depends on step(s) excluded from the execution plan: step_14.'
          ),
        ],
      });
    });

    test('allows dependencies satisfied by available completed or planned steps', () => {
      expect(
        validatePlannedStepDependencies(
          ['step_14', 'step_15', 'step_16'],
          {
            step_15: ['step_14'],
            step_16: ['step_15'],
          },
          ['step_14', 'step_15', 'step_16']
        )
      ).toEqual({
        valid: true,
        errors: [],
      });
    });

    test('ignores dependencies that are outside the current stage baseline', () => {
      expect(
        validatePlannedStepDependencies(
          ['step_17', 'step_0f', 'step_12'],
          {
            step_17: ['step_03', 'step_11_6', 'step_20', 'step_23'],
            step_0f: ['step_17'],
            step_12: ['step_0f'],
          },
          getStepsForStage(WORKFLOW_STAGES.QUICK)
        )
      ).toEqual({
        valid: true,
        errors: [],
      });
    });

    test('flags terminal summary steps when dep index still contains disabled branch deps', () => {
      // Tests validatePlannedStepDependencies in isolation with a manually-constructed index
      // that still has step_11_6/step_23 (i.e. before sanitize removes them).
      // The error message should suggest dependency_comment since these are not ORDER_LOCKED.
      const result = validatePlannedStepDependencies(
        ['step_03', 'step_20', 'step_17', 'step_0f', 'step_12'],
        {
          step_17: ['step_03', 'step_11_6', 'step_20', 'step_23'],
          step_0f: ['step_17'],
          step_12: ['step_0f'],
        },
        getStepsForStage(WORKFLOW_STAGES.FULL),
        { disabledStepIds: ['step_11_6', 'step_23'] }
      );
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain(
        'Selected step step_17 depends on step(s) excluded from the execution plan: step_11_6, step_23.'
      );
      expect(result.errors[0]).toContain('dependency_comment');
      expect(result.errors[0]).not.toContain('cannot be removed via dependency_comment');
    });

    test('flags ORDER_LOCKED_TERMINAL dep violations with locked-dep hint', () => {
      // step_0f always requires step_17 (ORDER_LOCKED); the error must NOT suggest
      // dependency_comment as a fix because it won't work.
      const result = validatePlannedStepDependencies(
        ['step_03', 'step_0f', 'step_12'],
        {
          step_0f: ['step_17'],
          step_12: ['step_0f'],
        },
        getStepsForStage(WORKFLOW_STAGES.FULL),
        { disabledStepIds: ['step_17'] }
      );
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('step_0f');
      expect(result.errors[0]).toContain('step_17');
      expect(result.errors[0]).toContain('cannot be removed via dependency_comment');
    });

    test('flags terminal summary steps when dep index still contains disabled branch deps', () => {
      // Tests validatePlannedStepDependencies in isolation with a manually-constructed index
      // that still has step_11_6/step_23 (i.e. before sanitize removes them).
      // The error message should suggest dependency_comment since these are not ORDER_LOCKED.
      const result = validatePlannedStepDependencies(
        ['step_03', 'step_20', 'step_17', 'step_0f', 'step_12'],
        {
          step_17: ['step_03', 'step_11_6', 'step_20', 'step_23'],
          step_0f: ['step_17'],
          step_12: ['step_0f'],
        },
        getStepsForStage(WORKFLOW_STAGES.FULL),
        { disabledStepIds: ['step_11_6', 'step_23'] }
      );
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain(
        'Selected step step_17 depends on step(s) excluded from the execution plan: step_11_6, step_23.'
      );
      expect(result.errors[0]).toContain('dependency_comment');
      expect(result.errors[0]).not.toContain('cannot be removed via dependency_comment');
    });

    test('flags ORDER_LOCKED_TERMINAL dep violations with locked-dep hint', () => {
      // step_0f always requires step_17 (ORDER_LOCKED); the error must NOT suggest
      // dependency_comment as a fix because it won't work.
      const result = validatePlannedStepDependencies(
        ['step_03', 'step_0f', 'step_12'],
        {
          step_0f: ['step_17'],
          step_12: ['step_0f'],
        },
        getStepsForStage(WORKFLOW_STAGES.FULL),
        { disabledStepIds: ['step_17'] }
      );
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('step_0f');
      expect(result.errors[0]).toContain('step_17');
      expect(result.errors[0]).toContain('cannot be removed via dependency_comment');
    });
  });

  describe('terminal finalization helpers', () => {
    test('enforceTerminalStepOrder moves terminal steps to the tail without dropping other steps', () => {
      expect(
        enforceTerminalStepOrder(['step_12', 'step_00', 'step_17', 'step_16', 'step_0f'])
      ).toEqual(['step_00', 'step_16', 'step_17', 'step_0f', 'step_12']);
    });

    test('enforceTerminalStepOrder returns empty array when called with no arguments', () => {
      expect(enforceTerminalStepOrder()).toEqual([]);
    });

    test('sanitizeWorkflowConfigDependencies removes terminal dependencies from non-terminal steps', () => {
      expect(
        sanitizeWorkflowConfigDependencies('step_16', ['step_08', 'step_12', 'step_17'])
      ).toEqual(['step_08']);
    });

    test('sanitizeWorkflowConfigDependencies preserves required terminal chain defaults', () => {
      expect(
        sanitizeWorkflowConfigDependencies('step_17', ['step_10'], ['step_03', 'step_11_6'])
      ).toEqual(['step_10', 'step_03', 'step_11_6', 'step_20', 'step_23']);
      expect(sanitizeWorkflowConfigDependencies('step_12', ['step_10'], ['step_0f'])).toEqual([
        'step_10',
        'step_0f',
      ]);
      expect(sanitizeWorkflowConfigDependencies('step_0f', ['step_10'], ['step_17'])).toEqual([
        'step_10',
        'step_17',
      ]);
    });

    test('sanitizeWorkflowConfigDependencies removes disabled DEFAULT_TERMINAL_BRANCH deps', () => {
      // Mirrors the pajussara_tui_comp scenario: step_11_6 and step_23 are disabled;
      // step_17 should only depend on the active branch endpoints.
      expect(
        sanitizeWorkflowConfigDependencies(
          'step_17',
          ['step_03', 'step_20', 'step_11', 'step_16'],
          ['step_03', 'step_11_6', 'step_20', 'step_23'],
          { disabledStepIds: ['step_11_6', 'step_23'] }
        )
      ).toEqual(['step_03', 'step_20', 'step_11', 'step_16']);
    });

    test('sanitizeWorkflowConfigDependencies retains ORDER_LOCKED_TERMINAL deps even when disabled', () => {
      // step_0f always requires step_17 regardless of disabled list
      expect(
        sanitizeWorkflowConfigDependencies('step_0f', ['step_10'], ['step_17'], {
          disabledStepIds: ['step_17'],
        })
      ).toContain('step_17');
    });

    test('sanitizeWorkflowConfigDependencies removes disabled DEFAULT_TERMINAL_BRANCH deps', () => {
      // Mirrors the pajussara_tui_comp scenario: step_11_6 and step_23 are disabled;
      // step_17 should only depend on the active branch endpoints.
      expect(
        sanitizeWorkflowConfigDependencies(
          'step_17',
          ['step_03', 'step_20', 'step_11', 'step_16'],
          ['step_03', 'step_11_6', 'step_20', 'step_23'],
          { disabledStepIds: ['step_11_6', 'step_23'] }
        )
      ).toEqual(['step_03', 'step_20', 'step_11', 'step_16']);
    });

    test('sanitizeWorkflowConfigDependencies retains ORDER_LOCKED_TERMINAL deps even when disabled', () => {
      // step_0f always requires step_17 regardless of disabled list
      expect(
        sanitizeWorkflowConfigDependencies('step_0f', ['step_10'], ['step_17'], {
          disabledStepIds: ['step_17'],
        })
      ).toContain('step_17');
    });

    test('sanitizeWorkflowConfigDependencies preserves locked verification ordering defaults', () => {
      expect(sanitizeWorkflowConfigDependencies('step_10', ['step_06'], ['step_09'])).toEqual([
        'step_06',
        'step_09',
      ]);
      expect(sanitizeWorkflowConfigDependencies('step_11', ['step_10'], ['step_13'])).toEqual([
        'step_10',
        'step_13',
      ]);
    });
  });

  describe('workflow config bootstrapping helpers', () => {
    test('detects project structure from existing directories', () => {
      const structure = detectWorkflowConfigStructure(
        [
          { name: 'src', isDirectory: true },
          { name: 'test', isDirectory: true },
          { name: 'docs', isDirectory: true },
        ],
        'javascript'
      );

      expect(structure).toEqual({
        source_dirs: ['src'],
        test_dirs: ['test'],
        docs_dirs: ['docs'],
      });
    });

    test('defaults markdown projects to docs-only structure when src/test are absent', () => {
      const structure = detectWorkflowConfigStructure(
        [{ name: 'docs', isDirectory: true }],
        'markdown'
      );

      expect(structure).toEqual({
        source_dirs: [],
        test_dirs: [],
        docs_dirs: ['docs'],
      });
    });

    test('builds a minimal generated workflow config from detected facts', () => {
      const config = buildGeneratedWorkflowConfig({
        projectRoot: '/tmp/example-project',
        projectKind: 'generic',
        techStack: {
          primary_language: 'markdown',
          build_system: 'none',
          test_framework: null,
          test_command: '',
        },
        structure: {
          source_dirs: ['src'],
          test_dirs: ['tests'],
          docs_dirs: ['docs'],
        },
      });

      expect(config.project.name).toBe('example-project');
      expect(config.project.kind).toBe('generic');
      expect(config.tech_stack.primary_language).toBe('markdown');
      expect(config.structure.docs_dirs).toEqual(['docs']);
    });
  });

  describe('calculateProgress', () => {
    test('should handle zero total', () => {
      expect(calculateProgress(0, 0)).toBe(0);
      expect(calculateProgress(5, 0)).toBe(0);
    });

    test('should round to nearest integer', () => {
      expect(calculateProgress(1, 3)).toBe(33);
      expect(calculateProgress(2, 3)).toBe(67);
    });
  });

  describe('determineWorkflowStatus', () => {
    test('should return success for all passed steps', () => {
      const results = {
        steps: {
          step1: { status: 'success' },
          step2: { status: 'success' },
        },
      };

      expect(determineWorkflowStatus(results)).toBe('success');
    });

    test('should return failed if any step failed', () => {
      const results = {
        steps: {
          step1: { status: 'success' },
          step2: { status: 'failed' },
        },
      };

      expect(determineWorkflowStatus(results)).toBe('failed');
    });

    test('should return partial if some steps skipped', () => {
      const results = {
        steps: {
          step1: { status: 'success' },
          step2: { status: 'skipped' },
        },
      };

      expect(determineWorkflowStatus(results)).toBe('partial');
    });

    test('should return skipped if all steps skipped', () => {
      const results = {
        steps: {
          step1: { status: 'skipped' },
          step2: { status: 'skipped' },
        },
      };

      expect(determineWorkflowStatus(results)).toBe('skipped');
    });

    test('should return unknown for invalid results', () => {
      expect(determineWorkflowStatus(null)).toBe('unknown');
      expect(determineWorkflowStatus({})).toBe('unknown');
    });
  });

  describe('performHealthChecks', () => {
    test('should pass all checks with valid environment', () => {
      const environment = {
        nodeVersion: 'v18.0.0',
        platform: 'linux',
        config: {},
        workflowDir: '.ai_workflow',
        workflowDirWritable: true,
      };

      const results = performHealthChecks(environment);

      expect(results.passed).toBe(true);
      expect(results.checks[HEALTH_CHECK_CATEGORIES.ENVIRONMENT].passed).toBe(true);
      expect(results.checks[HEALTH_CHECK_CATEGORIES.CONFIGURATION].passed).toBe(true);
      expect(results.checks[HEALTH_CHECK_CATEGORIES.FILESYSTEM].passed).toBe(true);
    });

    test('should fail environment check without node version', () => {
      const environment = {
        platform: 'linux',
        config: {},
        workflowDir: '.ai_workflow',
        workflowDirWritable: true,
      };

      const results = performHealthChecks(environment);

      expect(results.passed).toBe(false);
      expect(results.checks[HEALTH_CHECK_CATEGORIES.ENVIRONMENT].passed).toBe(false);
    });

    test('should fail configuration check without config', () => {
      const environment = {
        nodeVersion: 'v18.0.0',
        platform: 'linux',
        workflowDirWritable: true,
      };

      const results = performHealthChecks(environment);

      expect(results.passed).toBe(false);
      expect(results.checks[HEALTH_CHECK_CATEGORIES.CONFIGURATION].passed).toBe(false);
    });

    test('should fail filesystem check if not writable', () => {
      const environment = {
        nodeVersion: 'v18.0.0',
        platform: 'linux',
        config: {},
        workflowDir: '.ai_workflow',
        workflowDirWritable: false,
      };

      const results = performHealthChecks(environment);

      expect(results.passed).toBe(false);
      expect(results.checks[HEALTH_CHECK_CATEGORIES.FILESYSTEM].passed).toBe(false);
    });
  });

  describe('pre-flight quality helpers', () => {
    test('detects package manager from packageManager field first', () => {
      expect(
        detectPreflightPackageManager({ packageManager: 'pnpm@10.0.0' }, ['package-lock.json'])
      ).toBe('pnpm');
    });

    test('falls back to lockfiles when packageManager field is absent', () => {
      expect(detectPreflightPackageManager({}, ['yarn.lock'])).toBe('yarn');
      expect(detectPreflightPackageManager({}, ['pnpm-lock.yaml'])).toBe('pnpm');
      expect(detectPreflightPackageManager({}, [])).toBe('npm');
    });

    test('builds ordered pre-flight quality commands from package scripts', () => {
      expect(
        getPreflightQualityCommands(
          {
            scripts: {
              build: 'tsc',
              lint: 'eslint .',
              test: 'jest',
            },
          },
          'npm'
        )
      ).toEqual([
        { name: 'lint', command: 'npm run lint' },
        { name: 'test', command: 'npm test' },
        { name: 'build', command: 'npm run build' },
      ]);
    });
  });

  describe('Constants', () => {
    test('WORKFLOW_STAGES should be frozen', () => {
      expect(Object.isFrozen(WORKFLOW_STAGES)).toBe(true);
    });

    test('HEALTH_CHECK_CATEGORIES should be frozen', () => {
      expect(Object.isFrozen(HEALTH_CHECK_CATEGORIES)).toBe(true);
    });

    test('WORKFLOW_STAGES should have correct values', () => {
      expect(WORKFLOW_STAGES.QUICK).toBe('quick');
      expect(WORKFLOW_STAGES.MEDIUM).toBe('medium');
      expect(WORKFLOW_STAGES.FULL).toBe('full');
    });
  });

  describe('pre-flight package manager — additional branches', () => {
    test('detects bun from bun.lockb', () => {
      expect(detectPreflightPackageManager({}, ['bun.lockb'])).toBe('bun');
    });

    test('detects bun from bun.lock', () => {
      expect(detectPreflightPackageManager({}, ['bun.lock'])).toBe('bun');
    });

    test('handles packageManager field without version separator', () => {
      expect(detectPreflightPackageManager({ packageManager: 'yarn' }, [])).toBe('yarn');
    });

    test('falls back to npm when packageManager field is whitespace-only', () => {
      expect(detectPreflightPackageManager({ packageManager: '   ' }, [])).toBe('npm');
    });

    test('falls back to npm when packageJson is null', () => {
      expect(detectPreflightPackageManager(null, [])).toBe('npm');
    });

    test('falls back to npm when called with no arguments (default args)', () => {
      expect(detectPreflightPackageManager()).toBe('npm');
    });

    test('builds preflight commands with yarn package manager', () => {
      const pkg = { scripts: { lint: 'eslint .', test: 'jest', build: 'tsc' } };
      expect(getPreflightQualityCommands(pkg, 'yarn')).toEqual([
        { name: 'lint', command: 'yarn lint' },
        { name: 'test', command: 'yarn test' },
        { name: 'build', command: 'yarn build' },
      ]);
    });

    test('builds preflight commands with pnpm package manager', () => {
      const pkg = { scripts: { lint: 'eslint .', test: 'jest', build: 'tsc' } };
      expect(getPreflightQualityCommands(pkg, 'pnpm')).toEqual([
        { name: 'lint', command: 'pnpm run lint' },
        { name: 'test', command: 'pnpm test' },
        { name: 'build', command: 'pnpm run build' },
      ]);
    });

    test('builds preflight commands with bun package manager', () => {
      const pkg = { scripts: { lint: 'eslint .', test: 'jest', build: 'tsc' } };
      expect(getPreflightQualityCommands(pkg, 'bun')).toEqual([
        { name: 'lint', command: 'bun run lint' },
        { name: 'test', command: 'bun run test' },
        { name: 'build', command: 'bun run build' },
      ]);
    });

    test('returns empty array when packageJson is null', () => {
      expect(getPreflightQualityCommands(null, 'npm')).toEqual([]);
    });

    test('returns empty array when called with no arguments (default args)', () => {
      expect(getPreflightQualityCommands()).toEqual([]);
    });
  });

  describe('normalizeWorkflowConfigStepId — additional branches', () => {
    test('returns null for empty string', () => {
      expect(normalizeWorkflowConfigStepId('')).toBeNull();
    });

    test('returns null for whitespace-only string', () => {
      expect(normalizeWorkflowConfigStepId('   ')).toBeNull();
    });

    test('returns null for non-string', () => {
      expect(normalizeWorkflowConfigStepId(42)).toBeNull();
      expect(normalizeWorkflowConfigStepId(null)).toBeNull();
    });
  });

  describe('buildWorkflowConfigStepIndex — additional branches', () => {
    test('skips step with invalid id', () => {
      const config = {
        workflow: { steps: [{ id: '!invalid', enabled: true }] },
      };
      expect(buildWorkflowConfigStepIndex(config)).toEqual({});
    });

    test('sets critical=true for required steps', () => {
      const config = {
        workflow: { steps: [{ id: 'step_01', required: true }] },
      };
      expect(buildWorkflowConfigStepIndex(config).step_01.critical).toBe(true);
    });

    test('sets critical=false for optional steps', () => {
      const config = {
        workflow: { steps: [{ id: 'step_01', optional: true }] },
      };
      expect(buildWorkflowConfigStepIndex(config).step_01.critical).toBe(false);
    });

    test('sets critical=undefined when neither required nor optional', () => {
      const config = {
        workflow: { steps: [{ id: 'step_01' }] },
      };
      expect(buildWorkflowConfigStepIndex(config).step_01.critical).toBeUndefined();
    });

    test('includes priority and maxStepWallTime when valid', () => {
      const config = {
        workflow: { steps: [{ id: 'step_01', priority: 5, max_step_wall_time: 120 }] },
      };
      const index = buildWorkflowConfigStepIndex(config);
      expect(index.step_01.priority).toBe(5);
      expect(index.step_01.maxStepWallTime).toBe(120);
    });

    test('excludes maxStepWallTime when not positive', () => {
      const config = {
        workflow: { steps: [{ id: 'step_01', max_step_wall_time: 0 }] },
      };
      expect(buildWorkflowConfigStepIndex(config).step_01.maxStepWallTime).toBeUndefined();
    });

    test('sets phase only when valid', () => {
      const config = {
        workflow: {
          steps: [
            { id: 'step_01', phase: 'analysis' },
            { id: 'step_02', phase: 'unknown_phase' },
          ],
        },
      };
      const index = buildWorkflowConfigStepIndex(config);
      expect(index.step_01.phase).toBe('analysis');
      expect(index.step_02.phase).toBeUndefined();
    });

    test('returns empty object when workflowConfig has no steps array', () => {
      expect(buildWorkflowConfigStepIndex(null)).toEqual({});
      expect(buildWorkflowConfigStepIndex({})).toEqual({});
    });
  });

  describe('getDisabledWorkflowConfigStepIds', () => {
    test('returns empty array when workflowConfig has no steps', () => {
      expect(getDisabledWorkflowConfigStepIds(null)).toEqual([]);
      expect(getDisabledWorkflowConfigStepIds({})).toEqual([]);
    });

    test('returns only disabled step ids', () => {
      const config = {
        workflow: {
          steps: [
            { id: 'step_01', enabled: true },
            { id: 'step_02', enabled: false },
            { id: 'step_03', enabled: false },
          ],
        },
      };
      expect(getDisabledWorkflowConfigStepIds(config)).toEqual(['step_02', 'step_03']);
    });
  });

  describe('getConfiguredStepsForStage — additional branches', () => {
    test('falls back to default steps when configuredSteps is empty', () => {
      const config = { workflow: { steps: [] } };
      const defaults = getStepsForStage(WORKFLOW_STAGES.QUICK);
      expect(getConfiguredStepsForStage(WORKFLOW_STAGES.QUICK, config)).toEqual(defaults);
    });

    test('uses enabledConfiguredStepIds when no default stage steps intersect config', () => {
      // Use 'quick' stage but only configure steps not in quick stage defaults
      const config = {
        workflow: {
          steps: [
            { id: 'step_10', enabled: true },
            { id: 'step_11', enabled: true },
          ],
        },
      };
      const result = getConfiguredStepsForStage(WORKFLOW_STAGES.QUICK, config);
      expect(result).toContain('step_10');
    });
  });

  describe('enforceTerminalStepOrder — additional branches', () => {
    test('returns empty array for empty input', () => {
      expect(enforceTerminalStepOrder([])).toEqual([]);
    });

    test('returns empty array for non-array input', () => {
      expect(enforceTerminalStepOrder(null)).toEqual([]);
    });
  });

  describe('sanitizeWorkflowConfigDependencies — additional branches', () => {
    test('returns undefined for non-array dependencies', () => {
      expect(sanitizeWorkflowConfigDependencies('step_01', 'not-array')).toBeUndefined();
    });
  });

  describe('validatePlannedStepDependencies — additional branches', () => {
    test('handles non-array stepIds gracefully', () => {
      const result = validatePlannedStepDependencies(null, {});
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('handles non-array disabledStepIds in options', () => {
      // When disabledStepIds is not an array, it is treated as empty (no disabled steps).
      // step_01 depends on step_00 which is in available but not in planned → missing dependency.
      const result = validatePlannedStepDependencies(
        ['step_01'],
        { step_01: ['step_00'] },
        ['step_00', 'step_01'],
        { disabledStepIds: 'not-array' }
      );
      // step_00 is available but not planned and not disabled → flagged as missing
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('step_01');
    });
  });

  describe('buildGeneratedWorkflowConfig — additional branches', () => {
    test('uses techStack.primaryLanguage when primary_language is absent', () => {
      const result = buildGeneratedWorkflowConfig({
        projectRoot: '/tmp/myproject',
        projectKind: 'generic',
        techStack: { primaryLanguage: 'python', build_system: 'make' },
        structure: { source_dirs: ['src'], test_dirs: ['test'], docs_dirs: ['docs'] },
      });
      expect(result.project.primary_language).toBe('python');
    });

    test('omits lint_command when not set in techStack', () => {
      const result = buildGeneratedWorkflowConfig({
        projectRoot: '/tmp/myproject',
        projectKind: 'generic',
        techStack: {},
        structure: { source_dirs: ['src'], test_dirs: ['test'], docs_dirs: ['docs'] },
      });
      expect(result.tech_stack.lint_command).toBeUndefined();
    });

    test('includes lint_command when set in techStack', () => {
      const result = buildGeneratedWorkflowConfig({
        projectRoot: '/tmp/myproject',
        projectKind: 'generic',
        techStack: { lint_command: 'eslint .' },
        structure: { source_dirs: ['src'], test_dirs: ['test'], docs_dirs: ['docs'] },
      });
      expect(result.tech_stack.lint_command).toBe('eslint .');
    });

    test('auto-detects structure when structure is not provided', () => {
      const result = buildGeneratedWorkflowConfig({
        projectRoot: '/tmp/myproject',
        projectKind: 'generic',
        techStack: {},
      });
      expect(result.structure).toBeDefined();
      expect(result.structure.source_dirs).toBeDefined();
    });
  });

  describe('buildMlChangeStats', () => {
    test('returns zero stats for empty input', () => {
      const stats = buildMlChangeStats([]);
      expect(stats.changed).toBe(0);
    });

    test('returns zero stats for non-array input', () => {
      const stats = buildMlChangeStats(null);
      expect(stats.changed).toBe(0);
    });

    test('counts changed files correctly', () => {
      const stats = buildMlChangeStats(['src/foo.js', 'test/bar.test.js', 'README.md']);
      expect(stats.changed).toBe(3);
    });
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('Main Orchestrator - Integration Tests', () => {
  let orchestrator;
  const testDir = path.join(process.cwd(), '.test_orchestrator');

  beforeEach(async () => {
    // Create test directory
    await fs.mkdir(path.join(testDir, 'metrics'), { recursive: true });
    await fs.mkdir(path.join(testDir, 'summaries'), { recursive: true });
    await fs.mkdir(path.join(testDir, 'checkpoints'), { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('MainOrchestrator Construction', () => {
    test('should create orchestrator with default options', () => {
      orchestrator = new MainOrchestrator();

      expect(orchestrator.workflowDir).toBe(path.join(process.cwd(), '.ai_workflow'));
      expect(orchestrator.stage).toBe(WORKFLOW_STAGES.FULL);
      expect(orchestrator.auto).toBe(false);
    });

    test('should create orchestrator with custom options', () => {
      orchestrator = new MainOrchestrator({
        workflowDir: testDir,
        stage: WORKFLOW_STAGES.QUICK,
        auto: true,
      });

      expect(orchestrator.workflowDir).toBe(testDir);
      expect(orchestrator.stage).toBe(WORKFLOW_STAGES.QUICK);
      expect(orchestrator.auto).toBe(true);
    });

    test('should throw error for invalid config', () => {
      expect(() => {
        new MainOrchestrator({ stage: 'invalid' });
      }).toThrow('Invalid configuration');
    });

    test('should initialize all components', () => {
      orchestrator = new MainOrchestrator({ workflowDir: testDir });

      expect(orchestrator.configManager).toBeDefined();
      expect(orchestrator.metricsCollector).toBeDefined();
      expect(orchestrator.checkpointManager).toBeDefined();
      expect(orchestrator.stepRegistry).toBeDefined();
      expect(orchestrator.workflowEngine).toBeDefined();
      expect(orchestrator.summaryGenerator).toBeDefined();
    });
  });

  describe('Step Registration', () => {
    beforeEach(() => {
      orchestrator = new MainOrchestrator({ workflowDir: testDir });
    });

    test('should register all 30 workflow steps', () => {
      orchestrator.registerAllSteps();

      const stepCount = orchestrator.stepRegistry.list().length;
      expect(stepCount).toBe(30);
    });

    test('should register steps with correct metadata', () => {
      orchestrator.registerAllSteps();

      const step0 = orchestrator.stepRegistry.get('step_00');
      expect(step0.name).toBe('Pre-Analysis');
      expect(step0.dependencies).toEqual([]);

      const step1 = orchestrator.stepRegistry.get('step_01');
      expect(step1.name).toBe('Documentation Updates');
      expect(step1.dependencies).toContain('step_0b');

      const step1_5 = orchestrator.stepRegistry.get('step_01_5');
      expect(step1_5.name).toBe('Copilot Instructions Validation');
      expect(step1_5.dependencies).toContain('step_01');
    });

    test('should lazy load built-in step executors', async () => {
      orchestrator.registerAllSteps();

      const step0 = orchestrator.stepRegistry.get('step_00');
      const ExecutorClass = await orchestrator._resolveStepExecutor('step_00', step0.handler);

      expect(ExecutorClass.name).toBe('Step0Analyzer');
    });
  });

  describe('Health Checks', () => {
    beforeEach(() => {
      orchestrator = new MainOrchestrator({ workflowDir: testDir });
      mockSkippedPreflightSuites(orchestrator);
    });

    test('should perform health checks successfully', async () => {
      const results = await orchestrator.healthCheck();

      expect(results.passed).toBe(true);
      expect(results.checks).toBeDefined();
    });

    test('should generate a missing workflow config from detected facts', async () => {
      orchestrator.projectRoot = testDir;
      orchestrator.projectDetection.detectProjectKind = async () => ({
        kind: 'generic',
        confidence: 40,
      });
      orchestrator.techStackDetection.detectTechStack = async () => ({
        primary_language: 'markdown',
        build_system: 'none',
        test_framework: null,
        test_command: '',
      });

      const config = await orchestrator._ensureProjectWorkflowConfig();
      const configPath = path.join(testDir, '.workflow-config.yaml');
      const writtenConfig = await fs.readFile(configPath, 'utf8');

      expect(config.project.kind).toBe('generic');
      expect(writtenConfig).toContain('kind: generic');
      expect(writtenConfig).toContain('primary_language: markdown');
    });
  });

  describe('Status Tracking', () => {
    beforeEach(() => {
      orchestrator = new MainOrchestrator({
        workflowDir: testDir,
        stage: WORKFLOW_STAGES.QUICK,
      });
    });

    test('should track workflow status', () => {
      const status = orchestrator.getStatus();

      expect(status).toHaveProperty('currentStep');
      expect(status).toHaveProperty('completed');
      expect(status).toHaveProperty('total');
      expect(status).toHaveProperty('progress');
      expect(status).toHaveProperty('status');
      expect(status).toHaveProperty('duration');
    });

    test('should calculate progress correctly', () => {
      orchestrator.results.steps = {
        step_00: { status: 'success' },
        step_01: { status: 'success' },
      };

      const status = orchestrator.getStatus();

      expect(status.completed).toBe(2);
      expect(status.total).toBe(10); // Quick stage includes bootstrap + terminal steps
      expect(status.progress).toBe(20);
    });
  });

  describe('Workflow Execution', () => {
    beforeEach(() => {
      orchestrator = new MainOrchestrator({
        workflowDir: testDir,
        stage: WORKFLOW_STAGES.QUICK, // Use quick stage for faster tests
      });

      // Mock the summary generator
      orchestrator.summaryGenerator.generateSummary = async () => ({
        success: true,
        summary: 'Test summary',
      });

      // Mock checkpoint save
      orchestrator.checkpointManager.save = async () => true;

      // Mock the WorkflowEngine methods with manual mocks
      const mockLoadWorkflow = async () => ({
        id: 'test-workflow',
        name: 'Test Workflow',
        version: '2.0.0',
      });

      const mockExecuteWorkflow = async () => ({
        success: true,
        summary: {
          total: 5,
          succeeded: 5,
          failed: 0,
          skipped: 0,
        },
        results: [
          { stepId: 'step_00', stepName: 'Project Analysis', success: true, duration: 100 },
          { stepId: 'step_01', stepName: 'Documentation Updates', success: true, duration: 200 },
          { stepId: 'step_02', stepName: 'Consistency Check', success: true, duration: 150 },
          { stepId: 'step_04', stepName: 'Config Validation', success: true, duration: 50 },
          { stepId: 'step_0b', stepName: 'Bootstrap Docs', success: true, duration: 75 },
        ],
        duration: 575,
      });

      orchestrator.workflowEngine.loadWorkflow = mockLoadWorkflow;
      orchestrator.workflowEngine.executeWorkflow = mockExecuteWorkflow;
    });

    test('should execute workflow successfully', async () => {
      const result = await orchestrator.execute();

      expect(result.success).toBe(true);
      expect(result).toHaveProperty('workflow');
      expect(result).toHaveProperty('results');
      expect(result).toHaveProperty('duration');
      expect(result.results.status).toBe('success');
    });

    test('should handle workflow failure', async () => {
      orchestrator.workflowEngine.executeWorkflow = async () => ({
        success: false,
        summary: {
          total: 5,
          succeeded: 3,
          failed: 2,
          skipped: 0,
        },
        results: [
          { stepId: 'step_00', stepName: 'Project Analysis', success: true, duration: 100 },
          {
            stepId: 'step_01',
            stepName: 'Documentation Updates',
            success: false,
            duration: 200,
            error: { message: 'Test error' },
          },
          { stepId: 'step_02', stepName: 'Consistency Check', success: true, duration: 150 },
        ],
        duration: 450,
      });

      const result = await orchestrator.execute();

      expect(result.success).toBe(false);
      expect(result.results.status).toBe('failed');
      expect(result.results.summary.failed).toBe(2);
    });
  });

  describe('Workflow Resume', () => {
    beforeEach(() => {
      orchestrator = new MainOrchestrator({
        workflowDir: testDir,
        stage: WORKFLOW_STAGES.QUICK,
      });

      // Mock checkpoint manager with proper checkpoint structure
      orchestrator.checkpointManager.load = async (checkpointId) => {
        if (checkpointId === 'missing-checkpoint') {
          return null;
        }
        // Default: partial completion (2 of 5 steps done)
        return {
          version: '1.0.0',
          workflowId: 'test-workflow',
          workflowVersion: '2.0.0',
          timestamp: Date.now(),
          state: {
            currentStep: null,
            completedSteps: ['step_00', 'step_01'],
            failedSteps: [],
            skippedSteps: [],
            results: {
              step_00: { status: 'success', duration: 100 },
              step_01: { status: 'success', duration: 200 },
            },
            context: {},
          },
          metadata: {
            totalSteps: 5,
            progress: 40,
          },
        };
      };

      orchestrator.checkpointManager.save = async () => true;

      // Default workflow engine mocks
      orchestrator.workflowEngine.loadWorkflow = async () => ({
        id: 'test-workflow',
        name: 'Test Workflow (Resumed)',
        version: '2.0.0',
      });

      orchestrator.workflowEngine.executeWorkflow = async () => ({
        success: true,
        summary: {
          total: 3,
          succeeded: 3,
          failed: 0,
          skipped: 0,
        },
        results: [
          { stepId: 'step_02', stepName: 'Consistency Check', success: true, duration: 150 },
          { stepId: 'step_04', stepName: 'Config Validation', success: true, duration: 50 },
          { stepId: 'step_0b', stepName: 'Bootstrap Docs', success: true, duration: 75 },
        ],
        duration: 275,
      });
    });

    test('should resume workflow from checkpoint', async () => {
      const result = await orchestrator.resume('test-checkpoint');

      expect(result.success).toBe(true);
      expect(result.resumed).toBe(true);
      expect(result).toHaveProperty('workflow');
      expect(result).toHaveProperty('results');
    });

    test('should handle missing checkpoint', async () => {
      const result = await orchestrator.resume('missing-checkpoint');

      expect(result.success).toBe(false);
      expect(result.resumed).toBe(false);
      expect(result.error).toContain('Checkpoint not found');
    });

    test('should skip execution if all steps completed', async () => {
      const completeOrchestrator = new MainOrchestrator({
        workflowDir: testDir,
        stage: WORKFLOW_STAGES.QUICK,
      });

      // Pre-set the results to simulate all steps complete
      completeOrchestrator.results = {
        steps: {
          step_00: { status: 'success', duration: 100 },
          step_01: { status: 'success', duration: 200 },
          step_01_5: { status: 'success', duration: 125 },
          step_02: { status: 'success', duration: 150 },
          step_04: { status: 'success', duration: 50 },
          step_05: { status: 'success', duration: 75 },
          step_0b: { status: 'success', duration: 30 },
          step_17: { status: 'success', duration: 40 },
          step_0f: { status: 'success', duration: 20 },
          step_12: { status: 'success', duration: 60 },
        },
      };

      // Mock checkpoint load to return a valid structure
      completeOrchestrator.checkpointManager.load = async () => ({
        version: '1.0.0',
        workflowId: 'test-workflow',
        workflowVersion: '2.0.0',
        timestamp: Date.now(),
        state: {
          currentStep: null,
          completedSteps: [
            'step_00',
            'step_0b',
            'step_01',
            'step_01_5',
            'step_02',
            'step_04',
            'step_05',
            'step_17',
            'step_0f',
            'step_12',
          ],
          failedSteps: [],
          skippedSteps: [],
          results: completeOrchestrator.results.steps,
          context: {},
        },
        metadata: {
          totalSteps: 10,
          progress: 100,
        },
      });

      // Track if step registration happens
      let registrationHappened = false;
      const originalRegister = completeOrchestrator.registerAllSteps.bind(completeOrchestrator);
      completeOrchestrator.registerAllSteps = function () {
        registrationHappened = true;
        return originalRegister();
      };

      const result = await completeOrchestrator.resume('complete-checkpoint');

      // Should return success
      expect(result.success).toBe(true);
      expect(result.resumed).toBe(true);

      // Step registration should not happen since all steps complete
      expect(registrationHappened).toBe(false);
    });
  });

  describe('Error Handling and Event Listeners', () => {
    let orchestrator;
    const testDir = '.ai_workflow/test-orchestrator-errors';

    beforeEach(async () => {
      // Clean up test directory
      await fs.rm(testDir, { recursive: true, force: true });
      await fs.mkdir(testDir, { recursive: true });

      orchestrator = new MainOrchestrator({
        workflowDir: testDir,
        stage: 'quick',
        auto: true,
      });
    });

    afterEach(async () => {
      await fs.rm(testDir, { recursive: true, force: true });
    });

    test('should handle health check failures', async () => {
      // The healthCheck method collects its own environment,
      // so we can't easily make it fail. Instead, test the pure function directly.
      const invalidEnv = {}; // Missing all required fields

      const result = performHealthChecks(invalidEnv);

      // Health check should fail due to missing environment info
      expect(result.passed).toBe(false);
      expect(result.checks).toHaveProperty('environment');
      expect(result.checks.environment.passed).toBe(false);
    });

    test('should emit step:start event', (done) => {
      let eventEmitted = false;

      orchestrator.workflowEngine.on('step:start', ({ step }) => {
        eventEmitted = true;
        expect(step).toHaveProperty('id');
        expect(step).toHaveProperty('name');
        done();
      });

      // Manually trigger event to test listener
      orchestrator.workflowEngine.emit('step:start', {
        step: { id: 'test-step', name: 'Test Step' },
      });

      // Safety timeout
      setTimeout(() => {
        if (!eventEmitted) {
          done(new Error('Event not emitted'));
        }
      }, 100);
    });

    test('should emit step:complete event with duration', (done) => {
      let eventEmitted = false;

      orchestrator.workflowEngine.on('step:complete', ({ step, result }) => {
        eventEmitted = true;
        expect(step).toHaveProperty('name');
        expect(result).toHaveProperty('duration');
        done();
      });

      orchestrator.workflowEngine.emit('step:complete', {
        step: { id: 'test-step', name: 'Test Step' },
        result: { success: true, duration: 1500 },
      });

      setTimeout(() => {
        if (!eventEmitted) {
          done(new Error('Event not emitted'));
        }
      }, 100);
    });

    test('should emit step:error event', (done) => {
      let eventEmitted = false;

      orchestrator.workflowEngine.on('step:error', ({ step, error }) => {
        eventEmitted = true;
        expect(step).toHaveProperty('name');
        expect(error).toHaveProperty('message');
        done();
      });

      orchestrator.workflowEngine.emit('step:error', {
        step: { id: 'test-step', name: 'Test Step' },
        error: new Error('Test error'),
      });

      setTimeout(() => {
        if (!eventEmitted) {
          done(new Error('Event not emitted'));
        }
      }, 100);
    });

    test('should emit step:skipped event', (done) => {
      let eventEmitted = false;

      orchestrator.workflowEngine.on('step:skipped', ({ step, result }) => {
        eventEmitted = true;
        expect(step).toHaveProperty('name');
        expect(result).toHaveProperty('reason');
        done();
      });

      orchestrator.workflowEngine.emit('step:skipped', {
        step: { id: 'test-step', name: 'Test Step' },
        result: { skipped: true, reason: 'No changes detected' },
      });

      setTimeout(() => {
        if (!eventEmitted) {
          done(new Error('Event not emitted'));
        }
      }, 100);
    });

    test('should handle error in _createStepHandler when executor missing', async () => {
      const stepHandler = orchestrator._createStepHandler('test-step', {});

      await expect(stepHandler({})).rejects.toThrow('No executor class found');
    });

    test('should handle error when executor lacks execute method', async () => {
      class InvalidExecutor {}

      const stepHandler = orchestrator._createStepHandler('test-step', {
        handler: InvalidExecutor,
      });

      await expect(stepHandler({})).rejects.toThrow('does not have an execute method');
    });
  });

  describe('Health Check Edge Cases', () => {
    test('should show warnings for failed health checks', async () => {
      // Create environment with missing config
      const env = {
        nodeVersion: process.version,
        cwd: process.cwd(),
        // Missing config field
      };

      const result = performHealthChecks(env);

      // Should show warnings for failed checks
      expect(result.passed).toBe(false);
      expect(result.checks.configuration.passed).toBe(false);
    });
  });

  // ============================================================================
  // REGRESSION TESTS - Bug Fixes from 2026-02-17
  // ============================================================================

  describe('Regression Tests - Step Registration and Execution', () => {
    let orchestrator;
    const testDir = '.ai_workflow/test-regression';

    beforeEach(async () => {
      await fs.rm(testDir, { recursive: true, force: true });
      await fs.mkdir(testDir, { recursive: true });

      orchestrator = new MainOrchestrator({
        workflowDir: testDir,
        stage: WORKFLOW_STAGES.QUICK,
        auto: true,
      });
    });

    afterEach(async () => {
      await fs.rm(testDir, { recursive: true, force: true });
    });

    describe('Bug Fix: Executor field name mismatch', () => {
      test('should register steps with "handler" field, not "executor"', () => {
        // Register all steps
        orchestrator.registerAllSteps();

        // Check that step_00 is registered
        const step = orchestrator.stepRegistry.get('step_00');

        expect(step).toBeDefined();
        expect(step).toHaveProperty('handler');
        expect(step.handler).toBeDefined();

        // The old bug: stepDef.executor was undefined
        // This should NOT exist in the step definition
        expect(step.executor).toBeUndefined();
      });

      test('should create step handler that accesses handler field correctly', async () => {
        // Mock executor class
        class MockStepExecutor {
          async execute(_context) {
            return { success: true, data: 'test' };
          }
        }

        // Register step with handler (correct field name)
        orchestrator.stepRegistry.register('test_mock_step', {
          name: 'Mock Test Step',
          description: 'Test step for regression',
          handler: MockStepExecutor,
          dependencies: [],
        });

        const stepDef = orchestrator.stepRegistry.get('test_mock_step');

        // Create handler using the private method
        const handler = orchestrator._createStepHandler('test_mock_step', stepDef);

        // Execute the handler
        const result = await handler({ workflowDir: testDir });

        expect(result).toEqual({ success: true, data: 'test' });
      });

      test('should throw error when handler field is missing (old bug scenario)', async () => {
        // Simulate the old bug: step registered with wrong field name
        orchestrator.stepRegistry.register('test_broken_step', {
          name: 'Broken Step',
          description: 'Step with wrong field name',
          // Missing 'handler' field - this was the bug
          dependencies: [],
        });

        const stepDef = orchestrator.stepRegistry.get('test_broken_step');
        const handler = orchestrator._createStepHandler('test_broken_step', stepDef);

        // Should throw error about missing executor
        await expect(handler({})).rejects.toThrow(
          'No executor class found for step: test_broken_step'
        );
      });

      test('should register all 24 workflow steps with handler field', () => {
        orchestrator.registerAllSteps();

        const expectedSteps = [
          'step_00',
          'step_0b',
          'step_01',
          'step_02',
          'step_02_5',
          'step_03',
          'step_04',
          'step_05',
          'step_06',
          'step_07',
          'step_08',
          'step_09',
          'step_10',
          'step_11',
          'step_12',
          'step_0f',
          'step_13',
          'step_14',
          'step_15',
          'step_16',
          'step_17',
          'step_20',
          'step_22',
          'step_23',
        ];

        for (const stepId of expectedSteps) {
          const step = orchestrator.stepRegistry.get(stepId);

          expect(step).toBeDefined();
          expect(step).toHaveProperty('handler');
          expect(typeof step.handler).toBe('function');

          // Verify the old bug is fixed: no 'executor' field
          expect(step.executor).toBeUndefined();
        }
      });

      test('should enforce bootstrap and terminal summary dependencies', () => {
        orchestrator.registerAllSteps();

        expect(orchestrator.stepRegistry.get('step_01').dependencies).toEqual(['step_0b']);
        expect(orchestrator.stepRegistry.get('step_17').dependencies).toEqual([
          'step_03',
          'step_11_6',
          'step_20',
          'step_23',
        ]);
      });

      test('preserves canonical step semantics when project config applies aliases', () => {
        // Overriding canonical dependencies requires a dependency_comment — omitting it throws
        expect(() =>
          orchestrator.registerAllSteps({
            workflow: {
              steps: [
                {
                  id: 'step_21',
                  name: 'Architecture Review',
                  description: 'Project-specific alias for architecture checks',
                  dependencies: ['step_05'],
                },
              ],
            },
          })
        ).toThrow(
          new RegExp(
            [
              '\\.workflow-config\\.yaml',
              'dependency_comment',
              'Canonical dependencies: \\[step_02_5\\]',
              'Raw configured dependencies: \\[step_05\\]',
              'Restore the canonical dependencies',
              'Or, if the override is intentional',
            ].join('[\\s\\S]*')
          )
        );
      });

      test('validates all dependency overrides before applying any project workflow updates', () => {
        expect(() =>
          orchestrator.registerAllSteps({
            workflow: {
              steps: [
                {
                  id: 'step_00',
                  name: 'Repository Preflight',
                },
                {
                  id: 'step_01',
                  dependencies: ['step_00'],
                },
                {
                  id: 'step_17',
                  dependencies: ['step_20', 'step_23'],
                },
              ],
            },
          })
        ).toThrow(
          new RegExp(
            [
              'step_01',
              'Canonical dependencies: \\[step_0b\\]',
              'Raw configured dependencies: \\[step_00\\]',
              'step_17',
              'Canonical dependencies: \\[step_03, step_11_6, step_20, step_23\\]',
              'Raw configured dependencies: \\[step_20, step_23\\]',
              'Effective dependencies after canonical enforcement: \\[step_20, step_23, step_03, step_11_6\\]',
            ].join('[\\s\\S]*')
          )
        );

        expect(orchestrator.stepRegistry.get('step_00').name).toBe('Pre-Analysis');
        expect(orchestrator.stepRegistry.get('step_01').dependencies).toEqual(['step_0b']);
        expect(orchestrator.stepRegistry.get('step_17').dependencies).toEqual([
          'step_03',
          'step_11_6',
          'step_20',
          'step_23',
        ]);
      });

      test('normalizes order-only dependency permutations without requiring dependency_comment', () => {
        expect(() =>
          orchestrator.registerAllSteps({
            workflow: {
              steps: [
                {
                  id: 'step_17',
                  dependencies: ['step_20', 'step_23', 'step_03', 'step_11_6'],
                },
              ],
            },
          })
        ).not.toThrow();

        expect(orchestrator.stepRegistry.get('step_17').dependencies).toEqual([
          'step_03',
          'step_11_6',
          'step_20',
          'step_23',
        ]);
      });

      test('dependency_comment with disabled DEFAULT_TERMINAL_BRANCH deps removes them from step_17', () => {
        // P4 round-trip: pajussara_tui_comp scenario.
        // step_11_6 and step_23 are disabled for a non-AWS TUI project; step_17 overrides
        // dependencies via dependency_comment. After registerAllSteps, step_17 must NOT
        // include step_11_6 or step_23 in its effective dependency list.
        orchestrator.registerAllSteps({
          workflow: {
            steps: [
              { id: 'step_11_6', enabled: false },
              { id: 'step_23', enabled: false },
              {
                id: 'step_17',
                dependencies: ['step_03', 'step_20', 'step_11', 'step_16'],
                dependency_comment:
                  'step_11_6 and step_23 disabled for non-AWS project; summary waits on active chain endpoints',
              },
            ],
          },
        });

        const step17Deps = orchestrator.stepRegistry.get('step_17').dependencies;
        expect(step17Deps).not.toContain('step_11_6');
        expect(step17Deps).not.toContain('step_23');
        expect(step17Deps).toContain('step_03');
        expect(step17Deps).toContain('step_20');
        expect(step17Deps).toContain('step_11');
        expect(step17Deps).toContain('step_16');
      });

      test('dependency_comment with disabled DEFAULT_TERMINAL_BRANCH deps removes them from step_17', () => {
        // P4 round-trip: pajussara_tui_comp scenario.
        // step_11_6 and step_23 are disabled for a non-AWS TUI project; step_17 overrides
        // dependencies via dependency_comment. After registerAllSteps, step_17 must NOT
        // include step_11_6 or step_23 in its effective dependency list.
        orchestrator.registerAllSteps({
          workflow: {
            steps: [
              { id: 'step_11_6', enabled: false },
              { id: 'step_23', enabled: false },
              {
                id: 'step_17',
                dependencies: ['step_03', 'step_20', 'step_11', 'step_16'],
                dependency_comment:
                  'step_11_6 and step_23 disabled for non-AWS project; summary waits on active chain endpoints',
              },
            ],
          },
        });

        const step17Deps = orchestrator.stepRegistry.get('step_17').dependencies;
        expect(step17Deps).not.toContain('step_11_6');
        expect(step17Deps).not.toContain('step_23');
        expect(step17Deps).toContain('step_03');
        expect(step17Deps).toContain('step_20');
        expect(step17Deps).toContain('step_11');
        expect(step17Deps).toContain('step_16');
      });

      test('preserves canonical step semantics when project config applies aliases with dependency_comment', () => {
        orchestrator.registerAllSteps({
          workflow: {
            steps: [
              {
                id: 'step_21',
                name: 'Architecture Review',
                description: 'Project-specific alias for architecture checks',
                dependencies: ['step_05'],
                dependency_comment: 'Custom dependency for architecture checks',
              },
            ],
          },
        });

        const step = orchestrator.stepRegistry.get('step_21');

        expect(step.name).toBe('Architecture Review');
        expect(step.dependencies).toEqual(['step_05']);
        expect(step.metadata.canonicalName).toBe('Doc Consolidation');
        expect(step.metadata.canonicalDescription).toContain('Find similar markdown docs');
        expect(step.metadata.canonicalDependencies).toEqual(['step_02_5']);
      });

      test('applies phase, critical, priority, and maxStepWallTime from workflow config step overrides', () => {
        // Spy on stepRegistry.update to capture the updates argument before createStepDefinition
        // strips fields not in its schema (priority, max_step_wall_time are not in createStepDefinition).
        const updateSpy = jest.spyOn(orchestrator.stepRegistry, 'update');

        orchestrator.registerAllSteps({
          workflow: {
            steps: [
              {
                id: 'step_00',
                phase: 'analysis',
                required: true,
                priority: 3,
                max_step_wall_time: 60,
              },
            ],
          },
        });

        const step = orchestrator.stepRegistry.get('step_00');
        // phase and critical are preserved by createStepDefinition
        expect(step.phase).toBe('analysis');
        expect(step.critical).toBe(true);

        // Verify update was called with priority and max_step_wall_time (covering those branches
        // in _applyProjectWorkflowOverrides even though createStepDefinition does not forward them)
        const updatesArg = updateSpy.mock.calls.find(([id]) => id === 'step_00')?.[1];
        expect(updatesArg).toBeDefined();
        expect(updatesArg.priority).toBe(3);
        expect(updatesArg.max_step_wall_time).toBe(60);
      });

      test('warns and skips unknown configured steps', () => {
        // step_99 does not exist in the registry — _applyProjectWorkflowOverrides should warn and skip it
        expect(() =>
          orchestrator.registerAllSteps({
            workflow: {
              steps: [{ id: 'step_99', enabled: false }],
            },
          })
        ).not.toThrow();
        // The registry should not contain step_99
        expect(orchestrator.stepRegistry.has('step_99')).toBe(false);
      });
    });

    describe('Bug Fix: Checkpoint save with wrong parameters', () => {
      test('should call checkpoint.save with workflow object, not workflow.id string', async () => {
        // Mock the checkpoint manager save method
        let savedWorkflowParam = null;
        let savedStateParam = null;

        orchestrator.checkpointManager.save = async (workflow, state) => {
          savedWorkflowParam = workflow;
          savedStateParam = state;
          return 'checkpoint-id-123';
        };

        // Mock workflow engine
        orchestrator.workflowEngine.loadWorkflow = async (workflow) => workflow;
        orchestrator.workflowEngine.executeWorkflow = async () => ({
          success: true,
          summary: { total: 1, succeeded: 1, failed: 0, skipped: 0 },
          results: [{ stepId: 'step_00', stepName: 'Pre-Analysis', success: true, duration: 100 }],
        });

        // Mock summary generator
        orchestrator.summaryGenerator.generateSummary = async () => 'Test summary';

        // Execute workflow
        await orchestrator.execute();

        // Verify checkpoint save was called with correct parameters
        expect(savedWorkflowParam).toBeDefined();
        expect(savedWorkflowParam).toBeInstanceOf(Object);

        // The old bug: workflow.id was passed as string
        // Now it should be the full workflow object with id, name, version, steps
        expect(savedWorkflowParam).toHaveProperty('id');
        expect(savedWorkflowParam).toHaveProperty('name');
        expect(savedWorkflowParam).toHaveProperty('version');
        expect(savedWorkflowParam).toHaveProperty('steps');
        expect(Array.isArray(savedWorkflowParam.steps)).toBe(true);

        // Verify state parameter structure
        expect(savedStateParam).toBeDefined();
        expect(savedStateParam).toHaveProperty('timestamp');
        expect(savedStateParam).toHaveProperty('completedSteps');
        expect(savedStateParam).toHaveProperty('failedSteps');
        expect(savedStateParam).toHaveProperty('skippedSteps');
        expect(Array.isArray(savedStateParam.completedSteps)).toBe(true);
      });

      test('should pass correct state structure to checkpoint save', async () => {
        let capturedState = null;

        orchestrator.checkpointManager.save = async (workflow, state) => {
          capturedState = state;
          return 'checkpoint-id';
        };

        orchestrator.workflowEngine.loadWorkflow = async (workflow) => workflow;
        orchestrator.workflowEngine.executeWorkflow = async () => ({
          success: true,
          summary: { total: 2, succeeded: 1, failed: 1, skipped: 0 },
          results: [
            { stepId: 'step_00', stepName: 'Pre-Analysis', status: 'success', duration: 100 },
            { stepId: 'step_01', stepName: 'Documentation', status: 'failed', duration: 50 },
          ],
        });

        orchestrator.summaryGenerator.generateSummary = async () => 'Summary';

        await orchestrator.execute();

        // Verify state structure matches createCheckpointData expectations
        expect(capturedState).toHaveProperty('timestamp');
        expect(typeof capturedState.timestamp).toBe('number');

        expect(capturedState).toHaveProperty('completedSteps');
        expect(Array.isArray(capturedState.completedSteps)).toBe(true);

        expect(capturedState).toHaveProperty('failedSteps');
        expect(Array.isArray(capturedState.failedSteps)).toBe(true);

        expect(capturedState).toHaveProperty('skippedSteps');
        expect(Array.isArray(capturedState.skippedSteps)).toBe(true);

        // The old bug: state had wrong structure with results object instead of step arrays
        // Now completedSteps should contain actual step IDs
        expect(capturedState.completedSteps).toContain('step_00');
        expect(capturedState.failedSteps).toContain('step_01');
      });

      test('should create valid checkpoint data that passes validation', async () => {
        let checkpointData = null;

        // Capture the checkpoint data before validation
        orchestrator.checkpointManager.save = async (workflow, state) => {
          // Manually create checkpoint data like the save method does
          const checkpoint = {
            version: '1.0.0',
            workflowId: workflow.id || workflow.name,
            workflowVersion: workflow.version || '1.0.0',
            timestamp: state.timestamp || Date.now(),
            state: {
              currentStep: state.currentStep || null,
              completedSteps: state.completedSteps || [],
              failedSteps: state.failedSteps || [],
              skippedSteps: state.skippedSteps || [],
              results: state.results || {},
              context: state.context || {},
            },
            metadata: {
              totalSteps: workflow.steps?.length || 0,
              progress: state.progress || 0,
            },
          };

          checkpointData = checkpoint;
          return 'checkpoint-id';
        };

        orchestrator.workflowEngine.loadWorkflow = async (w) => w;
        orchestrator.workflowEngine.executeWorkflow = async () => ({
          success: true,
          summary: { total: 1, succeeded: 1, failed: 0, skipped: 0 },
          results: [{ stepId: 'step_00', status: 'success' }],
        });
        orchestrator.summaryGenerator.generateSummary = async () => 'Summary';

        await orchestrator.execute();

        // Verify checkpoint data has all required fields
        expect(checkpointData).toBeDefined();
        expect(checkpointData).toHaveProperty('version');
        expect(checkpointData).toHaveProperty('workflowId');
        expect(checkpointData).toHaveProperty('timestamp');
        expect(checkpointData).toHaveProperty('state');

        // The old bug: workflowId was missing from checkpoint
        expect(checkpointData.workflowId).toBeDefined();
        expect(typeof checkpointData.workflowId).toBe('string');
        expect(checkpointData.workflowId.length).toBeGreaterThan(0);
      });
    });

    describe('Integration: Full workflow execution with regression fixes', () => {
      test('should pass logger in commonDeps so injected-logger steps write to the log file', async () => {
        // Steps like step_0b, step_12, step_13, step_14, step_15, step_16 use
        // `this.logger = options.logger || console/new Logger()`.  Without logger
        // in commonDeps those steps silently drop their output (console-only).
        const receivedDeps = {};

        class LoggerCapturingStep {
          constructor(deps) {
            Object.assign(receivedDeps, deps);
          }
          execute() {
            return Promise.resolve({ success: true });
          }
        }

        const stepDef = { handler: LoggerCapturingStep };
        const handler = orchestrator._createStepHandler('log_test_step', stepDef);
        await handler({ projectRoot: process.cwd() });

        // logger must be forwarded so injected-logger steps can write to the run log file
        expect(receivedDeps).toHaveProperty('logger');
        expect(typeof receivedDeps.logger.info).toBe('function');
        expect(typeof receivedDeps.logger.error).toBe('function');
        expect(typeof receivedDeps.logger.warn).toBe('function');
      });

      test('should execute workflow end-to-end with correct step registration and checkpointing', async () => {
        let stepHandlerCalled = false;
        let checkpointSaved = false;

        // Mock step executor
        class IntegrationTestExecutor {
          async execute(_context) {
            stepHandlerCalled = true;
            return { success: true };
          }
        }

        // Register a test step
        orchestrator.stepRegistry.register('integration_test_step', {
          name: 'Integration Test',
          description: 'Test step for integration',
          handler: IntegrationTestExecutor, // Correct field name
          dependencies: [],
        });

        // Mock checkpoint save
        orchestrator.checkpointManager.save = async (workflow, _state) => {
          checkpointSaved = true;

          // Verify workflow is object, not string
          expect(typeof workflow).toBe('object');
          expect(workflow).toHaveProperty('id');
          expect(workflow).toHaveProperty('steps');

          return 'integration-checkpoint';
        };

        // Setup workflow with our test step
        orchestrator.workflowEngine.loadWorkflow = async (workflow) => workflow;
        orchestrator.workflowEngine.executeWorkflow = async (context) => {
          // Execute the step handler
          const stepDef = orchestrator.stepRegistry.get('integration_test_step');
          const handler = orchestrator._createStepHandler('integration_test_step', stepDef);
          await handler(context);

          return {
            success: true,
            summary: { total: 1, succeeded: 1, failed: 0, skipped: 0 },
            results: [{ stepId: 'integration_test_step', status: 'success' }],
          };
        };

        orchestrator.summaryGenerator.generateSummary = async () => 'Summary';

        // Execute workflow
        const result = await orchestrator.execute();

        // Verify both fixes are working
        expect(stepHandlerCalled).toBe(true); // Step handler was called (fix #1)
        expect(checkpointSaved).toBe(true); // Checkpoint was saved (fix #2)
        expect(result.success).toBe(true);
      });
    });
  });

  // ============================================================================
  // REGRESSION TESTS — Bug Fixes 2026-02-26
  // CommitHistory: save HEAD at workflow START; skip artifact-only diffs
  // ============================================================================

  describe('Regression Tests - CommitHistory: start HEAD + artifact-only fallback', () => {
    const testDir = '.ai_workflow/test-commit-history-fix';

    /** Minimal git-ops mock with sensible defaults. Override per test as needed. */
    const makeGitMock = (overrides = {}) => ({
      getCurrentHead: () => 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      getChangedFilesSince: () => [],
      getLastNCommitsFiles: () => [],
      status: async () => ({ staged: [], unstaged: [], untracked: [] }),
      ...overrides,
    });

    /** Wire the workflow engine + downstream dependencies to no-ops. */
    const mockWorkflow = (orc, captureCtx = null) => {
      orc.workflowEngine.loadWorkflow = async (w) => w;
      orc.workflowEngine.executeWorkflow = async (ctx) => {
        if (captureCtx) captureCtx.value = ctx;
        return {
          success: true,
          summary: { total: 1, succeeded: 1, failed: 0, skipped: 0 },
          results: [{ stepId: 'step_00', stepName: 'Pre-Analysis', success: true, duration: 100 }],
        };
      };
      orc.summaryGenerator.generateSummary = async () => 'Summary';
      orc.checkpointManager.save = async () => 'cp-id';
    };

    let orchestrator;

    beforeEach(async () => {
      await fs.rm(testDir, { recursive: true, force: true });
      await fs.mkdir(testDir, { recursive: true });

      orchestrator = new MainOrchestrator({
        workflowDir: testDir,
        stage: WORKFLOW_STAGES.QUICK,
        auto: true,
      });
    });

    afterEach(async () => {
      await fs.rm(testDir, { recursive: true, force: true });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Bug 1 — HEAD saved is start-of-run, not post-commit HEAD
    // ──────────────────────────────────────────────────────────────────────────

    describe('Bug 1: HEAD captured at workflow start is persisted', () => {
      test('saves start-of-run HEAD, not post-commit HEAD, to commit_history.json', async () => {
        let callCount = 0;
        orchestrator.gitOps = makeGitMock({
          getCurrentHead: () => {
            callCount += 1;
            // First call = before steps run; second call = fallback at end (after commits)
            return callCount === 1
              ? 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
              : 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
          },
          getLastNCommitsFiles: () => [{ file: 'src/app.js', status: 'modified' }],
        });
        mockWorkflow(orchestrator);

        await orchestrator.execute();

        const history = JSON.parse(await fs.readFile(`${testDir}/commit_history.json`, 'utf8'));
        // Must record the FIRST call value (before any workflow commits)
        expect(history.lastRunCommit).toBe('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
      });

      test('uses start HEAD even if getCurrentHead would fail after commits', async () => {
        let callCount = 0;
        orchestrator.gitOps = makeGitMock({
          getCurrentHead: () => {
            callCount += 1;
            if (callCount === 1) return 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
            throw new Error('git unavailable after commits');
          },
          getLastNCommitsFiles: () => [{ file: 'src/app.js', status: 'modified' }],
        });
        mockWorkflow(orchestrator);

        await orchestrator.execute();

        const history = JSON.parse(await fs.readFile(`${testDir}/commit_history.json`, 'utf8'));
        expect(history.lastRunCommit).toBe('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
      });

      test('does not create commit_history.json when getCurrentHead always fails', async () => {
        orchestrator.gitOps = makeGitMock({
          getCurrentHead: () => {
            throw new Error('no git repo');
          },
          getLastNCommitsFiles: () => [],
        });
        mockWorkflow(orchestrator);

        await orchestrator.execute();

        const exists = await fs
          .access(`${testDir}/commit_history.json`)
          .then(() => true)
          .catch(() => false);
        expect(exists).toBe(false);
      });

      test('does not persist commit_history.json for failed workflow runs', async () => {
        orchestrator.gitOps = makeGitMock();
        orchestrator.workflowEngine.loadWorkflow = async (w) => w;
        orchestrator.workflowEngine.executeWorkflow = async () => ({
          success: false,
          summary: { total: 1, succeeded: 0, failed: 1, skipped: 0 },
          results: [{ stepId: 'step_00', stepName: 'Pre-Analysis', success: false, duration: 10 }],
        });
        orchestrator.summaryGenerator.generateSummary = async () => 'Summary';
        orchestrator.checkpointManager.save = async () => 'cp-id';

        await orchestrator.execute();

        const exists = await fs
          .access(`${testDir}/commit_history.json`)
          .then(() => true)
          .catch(() => false);
        expect(exists).toBe(false);
      });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Bug 2 — Artifact-only diffs fall back to last 30 commits
    // ──────────────────────────────────────────────────────────────────────────

    describe('Bug 2: Artifact-only diff falls back to last 30 commits', () => {
      const PRIOR_COMMIT = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
      const ARTIFACT_ONLY = [
        { file: '.ai_workflow/backlog/workflow_001/step_00.md', status: 'deleted' },
        { file: '.ai_workflow/.ai_cache/index.json', status: 'modified' },
        { file: '.ai_workflow/commit_history.json', status: 'modified' },
      ];
      const SOURCE_FILES = [
        { file: 'src/core/colors.js', status: 'modified' },
        { file: 'src/lib/config.js', status: 'modified' },
      ];

      beforeEach(async () => {
        // Seed a commit_history.json so the diff path is taken (not first-run)
        await fs.writeFile(
          `${testDir}/commit_history.json`,
          JSON.stringify({ version: '1.0.0', lastRunCommit: PRIOR_COMMIT, runs: [] })
        );
      });

      test('falls back to last 30 commits when diff contains only artifact files', async () => {
        const ctx = {};
        orchestrator.gitOps = makeGitMock({
          getChangedFilesSince: () => ARTIFACT_ONLY,
          getLastNCommitsFiles: () => SOURCE_FILES,
        });
        mockWorkflow(orchestrator, ctx);

        await orchestrator.execute();

        expect(ctx.value.modifiedFiles).toContain('src/core/colors.js');
        expect(ctx.value.modifiedFiles).toContain('src/lib/config.js');
        expect(ctx.value.modifiedFiles).not.toContain('.ai_workflow/commit_history.json');
      });

      test('keeps source files and strips artifact files when diff is mixed', async () => {
        const ctx = {};
        orchestrator.gitOps = makeGitMock({
          getChangedFilesSince: () => [
            ...ARTIFACT_ONLY,
            { file: 'src/app.js', status: 'modified' },
          ],
          getLastNCommitsFiles: () => SOURCE_FILES,
        });
        mockWorkflow(orchestrator, ctx);

        await orchestrator.execute();

        expect(ctx.value.modifiedFiles).toContain('src/app.js');
        expect(ctx.value.modifiedFiles).not.toContain('.ai_workflow/commit_history.json');
      });

      test('falls back to last 30 commits when getChangedFilesSince throws', async () => {
        const ctx = {};
        orchestrator.gitOps = makeGitMock({
          getChangedFilesSince: () => {
            throw new Error('unknown revision');
          },
          getLastNCommitsFiles: () => SOURCE_FILES,
        });
        mockWorkflow(orchestrator, ctx);

        await orchestrator.execute();

        expect(ctx.value.modifiedFiles).toContain('src/core/colors.js');
      });

      test('uses last 30 commits and never calls getChangedFilesSince when no prior hash', async () => {
        // Override commit_history.json to have null lastRunCommit
        await fs.writeFile(
          `${testDir}/commit_history.json`,
          JSON.stringify({ version: '1.0.0', lastRunCommit: null, runs: [] })
        );
        const ctx = {};
        let diffCallCount = 0;
        orchestrator.gitOps = makeGitMock({
          getChangedFilesSince: () => {
            diffCallCount++;
            return [];
          },
          getLastNCommitsFiles: () => SOURCE_FILES,
        });
        mockWorkflow(orchestrator, ctx);

        await orchestrator.execute();

        expect(diffCallCount).toBe(0);
        expect(ctx.value.modifiedFiles).toContain('src/core/colors.js');
      });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Integration: Both fixes together across two consecutive runs
    // ──────────────────────────────────────────────────────────────────────────

    describe('Integration: consecutive runs — start HEAD + artifact-only fallback', () => {
      test('run 2 uses start-of-run hash from run 1 and falls back past artifact commit', async () => {
        const START_HASH = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
        const POST_ARTIFACT_HASH = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

        // ── Run 1 ──────────────────────────────────────────────────────────
        let run1Calls = 0;
        orchestrator.gitOps = makeGitMock({
          getCurrentHead: () => {
            run1Calls++;
            return run1Calls === 1 ? START_HASH : POST_ARTIFACT_HASH;
          },
          getLastNCommitsFiles: () => [{ file: 'src/app.js', status: 'modified' }],
        });
        mockWorkflow(orchestrator);
        await orchestrator.execute();

        // Verify Run 1 recorded START_HASH (not post-commit hash)
        const hist1 = JSON.parse(await fs.readFile(`${testDir}/commit_history.json`, 'utf8'));
        expect(hist1.lastRunCommit).toBe(START_HASH);

        // ── Run 2 ──────────────────────────────────────────────────────────
        const orchestrator2 = new MainOrchestrator({
          workflowDir: testDir,
          stage: WORKFLOW_STAGES.QUICK,
          auto: true,
        });
        const ctx2 = {};
        mockWorkflow(orchestrator2, ctx2);

        // Run 2: diff(START_HASH → HEAD) returns only artifact files
        // (the artifact commit happened between runs)
        let capturedDiffHash = null;
        const diffResult = [{ file: '.ai_workflow/commit_history.json', status: 'modified' }];
        orchestrator2.gitOps = makeGitMock({
          getCurrentHead: () => POST_ARTIFACT_HASH,
          getChangedFilesSince: (hash) => {
            capturedDiffHash = hash;
            return diffResult;
          },
          getLastNCommitsFiles: () => [{ file: 'src/app.js', status: 'modified' }],
        });

        await orchestrator2.execute();

        expect(capturedDiffHash).toBe(START_HASH); // must diff from run-1's start, not its post-commit
        // Artifact file filtered out; fallback gives real source file
        expect(ctx2.value.modifiedFiles).toContain('src/app.js');
        expect(ctx2.value.modifiedFiles).not.toContain('.ai_workflow/commit_history.json');
      });
    });
  });

  describe('healthCheck, abort, and getStatus', () => {
    const localTestDir = path.join(process.cwd(), '.test_health_abort');

    beforeEach(async () => {
      await fs.mkdir(path.join(localTestDir, 'metrics'), { recursive: true });
      await fs.mkdir(path.join(localTestDir, 'summaries'), { recursive: true });
      await fs.mkdir(path.join(localTestDir, 'checkpoints'), { recursive: true });
    });

    afterEach(async () => {
      await fs.rm(localTestDir, { recursive: true, force: true });
    });

    test('healthCheck returns results with passed flag', async () => {
      const orch = new MainOrchestrator({ workflowDir: localTestDir });
      mockSkippedPreflightSuites(orch);
      const result = await orch.healthCheck();
      expect(result).toHaveProperty('passed');
      expect(result).toHaveProperty('checks');
    });

    test('healthCheck reports workflowDirWritable=true for a writable dir', async () => {
      const orch = new MainOrchestrator({ workflowDir: localTestDir });
      mockSkippedPreflightSuites(orch);
      const result = await orch.healthCheck();
      expect(result.checks.filesystem.workflowDirWritable).toBe(true);
    });

    test('healthCheck reports workflowDirWritable=false for a non-existent dir', async () => {
      const orch = new MainOrchestrator({ workflowDir: '/nonexistent/path/abc123' });
      mockSkippedPreflightSuites(orch);
      const result = await orch.healthCheck();
      expect(result.checks.filesystem.workflowDirWritable).toBe(false);
    });

    test('abort delegates to workflowEngine.abort()', () => {
      const orch = new MainOrchestrator({ workflowDir: localTestDir });
      let abortCalled = false;
      orch.workflowEngine.abort = () => {
        abortCalled = true;
      };
      orch.abort();
      expect(abortCalled).toBe(true);
    });

    test('getStatus returns status object with expected shape', () => {
      const orch = new MainOrchestrator({ workflowDir: localTestDir });
      const status = orch.getStatus();
      expect(status).toHaveProperty('currentStep');
      expect(status).toHaveProperty('completed');
      expect(status).toHaveProperty('total');
      expect(status).toHaveProperty('progress');
      expect(status).toHaveProperty('status');
      expect(status).toHaveProperty('duration');
    });

    test('getStatus reflects result updates', () => {
      const orch = new MainOrchestrator({ workflowDir: localTestDir });
      orch.results.steps['step_00'] = { success: true };
      orch.currentStep = 'step_01';
      const status = orch.getStatus();
      expect(status.currentStep).toBe('step_01');
      expect(status.completed).toBe(1);
    });
  });

  describe('healthCheck failure warnings and execute error path', () => {
    const localTestDir = path.join(process.cwd(), '.test_execute_fail');

    beforeEach(async () => {
      await fs.mkdir(path.join(localTestDir, 'metrics'), { recursive: true });
      await fs.mkdir(path.join(localTestDir, 'summaries'), { recursive: true });
      await fs.mkdir(path.join(localTestDir, 'checkpoints'), { recursive: true });
    });

    afterEach(async () => {
      await fs.rm(localTestDir, { recursive: true, force: true });
    });

    test('healthCheck warns when config check fails', async () => {
      const orch = new MainOrchestrator({ workflowDir: localTestDir });
      mockSkippedPreflightSuites(orch);
      // Null out configManager so the config health check fails
      orch.configManager = null;
      const result = await orch.healthCheck();
      expect(result.passed).toBe(false);
      expect(result.checks.configuration.passed).toBe(false);
    });

    test('healthCheck fails when a pre-flight quality suite fails', async () => {
      const orch = new MainOrchestrator({ workflowDir: localTestDir });
      jest.spyOn(orch, '_runPreflightQualitySuites').mockResolvedValue({
        passed: false,
        skipped: false,
        commands: [
          { name: 'lint', command: 'npm run lint', passed: true },
          { name: 'test', command: 'npm test', passed: false, exitCode: 1 },
        ],
        failedCommand: 'npm test',
        failureOutput: 'Test failure',
        message: 'Command failed: npm test',
      });

      const result = await orch.healthCheck();

      expect(result.passed).toBe(false);
      expect(result.checks.preflight.failedCommand).toBe('npm test');
    });

    test('execute returns failure when health checks fail', async () => {
      const orch = new MainOrchestrator({ workflowDir: localTestDir });
      // Override healthCheck to return failure
      orch.healthCheck = async () => ({ passed: false, checks: {} });
      const result = await orch.execute({});
      const logContent = await fs.readFile(
        path.join(localTestDir, 'logs', orch.configManager.workflowRunId, 'workflow.log'),
        'utf8'
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('Health checks failed');
      expect(logContent).toContain('✗ Workflow terminated before completion');
    });

    test('execute fails before pre-flight suites when workflow overrides are invalid', async () => {
      const orch = new MainOrchestrator({
        workflowDir: localTestDir,
        projectRoot: process.cwd(),
        stage: 'full',
      });
      const preflightSpy = mockSkippedPreflightSuites(orch);
      const detectProfileSpy = jest.fn().mockResolvedValue('full_validation');

      orch.profileManager.detectProfile = detectProfileSpy;
      orch._ensureProjectWorkflowConfig = async () => ({
        workflow: {
          steps: [
            {
              id: 'step_02',
              dependencies: ['step_01'],
            },
          ],
        },
      });

      const result = await orch.execute({});
      const logContent = await fs.readFile(
        path.join(localTestDir, 'logs', orch.configManager.workflowRunId, 'workflow.log'),
        'utf8'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('dependency_comment');
      expect(result.error).toContain('.workflow-config.yaml');
      expect(result.error).toContain('Canonical dependencies: [step_01_5]');
      expect(result.error).toContain('Raw configured dependencies: [step_01]');
      expect(result.error).toContain('Restore the canonical dependencies');
      expect(logContent).toContain(
        '✗ Preflight validation failed before workflow execution (0 steps executed)'
      );
      expect(preflightSpy).not.toHaveBeenCalled();
      expect(detectProfileSpy).not.toHaveBeenCalled();
      expect(logContent).toContain(
        'Validating .workflow-config.yaml step overrides against canonical workflow order...'
      );
      expect(logContent).not.toContain('Pre-flight quality suites passed');
      expect(logContent).not.toContain('All health checks passed');
      expect(logContent).not.toContain('Profile: full_validation');
    });

    test('execute fails before pre-flight suites when an enabled step depends on an explicitly disabled prerequisite', async () => {
      const orch = new MainOrchestrator({ workflowDir: localTestDir, projectRoot: process.cwd() });
      const preflightSpy = mockSkippedPreflightSuites(orch);
      const detectProfileSpy = jest.fn().mockResolvedValue('full_validation');

      orch.profileManager.detectProfile = detectProfileSpy;
      orch._ensureProjectWorkflowConfig = async () => ({
        workflow: {
          steps: [
            { id: 'step_14', enabled: false },
            { id: 'step_15', enabled: true },
          ],
        },
      });

      const result = await orch.execute({});

      expect(result.success).toBe(false);
      expect(result.error ?? '').toContain(
        'Selected step step_15 depends on step(s) excluded from the execution plan: step_14'
      );
      expect(result.error ?? '').toContain('Disabled in .workflow-config.yaml: step_14');
      expect(preflightSpy).not.toHaveBeenCalled();
      expect(detectProfileSpy).not.toHaveBeenCalled();
    });

    test('execute fails before pre-flight suites when a non-disabled step is missing from the execution plan', async () => {
      const orch = new MainOrchestrator({ workflowDir: localTestDir, projectRoot: process.cwd() });
      const preflightSpy = mockSkippedPreflightSuites(orch);
      const detectProfileSpy = jest.fn().mockResolvedValue('full_validation');

      orch.profileManager.detectProfile = detectProfileSpy;
      // step_15 is selected but step_14 is simply omitted (not disabled) from the config
      orch._ensureProjectWorkflowConfig = async () => ({
        workflow: {
          steps: [{ id: 'step_15', enabled: true }],
        },
      });

      const result = await orch.execute({});

      expect(result.success).toBe(false);
      expect(result.error).toContain(
        'Selected step step_15 depends on step(s) excluded from the execution plan: step_14.'
      );
      expect(preflightSpy).not.toHaveBeenCalled();
      expect(detectProfileSpy).not.toHaveBeenCalled();
    });

    test('execute fails before pre-flight suites when workflow.stages step lists redefine a stage', async () => {
      const orch = new MainOrchestrator({
        workflowDir: localTestDir,
        projectRoot: process.cwd(),
        stage: 'full',
      });
      const preflightSpy = mockSkippedPreflightSuites(orch);
      const detectProfileSpy = jest.fn().mockResolvedValue('full_validation');

      orch.profileManager.detectProfile = detectProfileSpy;
      orch._ensureProjectWorkflowConfig = async () => ({
        workflow: {
          stages: {
            full: {
              enabled: true,
              steps: ['step_00', 'step_0b', 'step_01', 'step_12'],
            },
          },
        },
      });

      const result = await orch.execute({});
      const logContent = await fs.readFile(
        path.join(localTestDir, 'logs', orch.configManager.workflowRunId, 'workflow.log'),
        'utf8'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('workflow.stages.full.steps');
      expect(result.error).toContain('does not control execution order');
      expect(result.error).toContain('workflow.steps');
      expect(logContent).toContain(
        '✗ Preflight validation failed before workflow execution (0 steps executed)'
      );
      expect(preflightSpy).not.toHaveBeenCalled();
      expect(detectProfileSpy).not.toHaveBeenCalled();
    });

    test('resume emits step events during workflow execution', async () => {
      const orch = new MainOrchestrator({ workflowDir: localTestDir, stage: 'quick' });

      orch.checkpointManager.load = async () => ({
        workflowId: 'event-test-workflow',
        state: {
          completedSteps: ['step_00', 'step_01'],
          failedSteps: [],
          skippedSteps: [],
          results: {},
          context: {},
        },
      });
      orch.checkpointManager.save = async () => true;
      orch.workflowEngine.loadWorkflow = async () => ({});

      // Override executeWorkflow to emit step events so handlers are covered
      orch.workflowEngine.executeWorkflow = async () => {
        orch.workflowEngine.emit('step:start', { step: { id: 'step_02', name: 'Step 2' } });
        orch.workflowEngine.emit('step:complete', {
          step: { id: 'step_02', name: 'Step 2' },
          result: { success: true, duration: 100 },
        });
        orch.workflowEngine.emit('step:error', {
          step: { id: 'step_04', name: 'Step 4' },
          error: new Error('test error'),
        });
        return {
          success: true,
          summary: { total: 2, succeeded: 1, failed: 1, skipped: 0 },
          results: [],
          duration: 100,
        };
      };

      const result = await orch.resume('event-test-checkpoint');
      expect(result.success).toBe(true);
      expect(result.resumed).toBe(true);
    });

    test('execute emits step events during workflow execution', async () => {
      const orch = new MainOrchestrator({ workflowDir: localTestDir, stage: 'quick', auto: true });

      // Override health check to pass without real system checks
      orch.healthCheck = async () => ({
        passed: true,
        checks: { configuration: { passed: true }, environment: { passed: true } },
      });

      orch.checkpointManager.save = async () => 'checkpoint-id';
      orch.workflowEngine.loadWorkflow = async (w) => w;

      // executeWorkflow emits all four step event types so execute() handlers are covered
      orch.workflowEngine.executeWorkflow = async () => {
        orch.workflowEngine.emit('step:start', { step: { id: 'step_00', name: 'Step 0' } });
        orch.workflowEngine.emit('step:complete', {
          step: { id: 'step_00', name: 'Step 0' },
          result: { success: true, duration: 200 },
        });
        orch.workflowEngine.emit('step:error', {
          step: { id: 'step_01', name: 'Step 1' },
          error: new Error('simulated error'),
        });
        orch.workflowEngine.emit('step:skipped', {
          step: { id: 'step_02', name: 'Step 2' },
          result: { reason: 'not needed' },
        });
        return {
          success: true,
          summary: { total: 3, succeeded: 1, failed: 1, skipped: 1 },
          results: [],
          duration: 500,
        };
      };

      orch.summaryGenerator.generateSummary = async () => 'Summary';

      const result = await orch.execute({});
      expect(result.success).toBe(true);
    });
  });
});
