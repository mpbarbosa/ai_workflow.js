/**
 * @fileoverview Canonical workflow step catalog and stage mappings
 * @module orchestrator/workflow_step_catalog
 */

export const WORKFLOW_STAGES = Object.freeze({
  QUICK: 'quick',
  MEDIUM: 'medium',
  FULL: 'full',
});

export const TERMINAL_FINALIZATION_STEP_ORDER = Object.freeze(['step_17', 'step_0f', 'step_12']);

const TERMINAL_FINALIZATION_STEP_SET = new Set(TERMINAL_FINALIZATION_STEP_ORDER);

// Hard finalization-order locks: step_0f must follow step_17; step_12 must follow step_0f.
// These cannot be removed via dependency_comment.
export const ORDER_LOCKED_TERMINAL_DEPENDENCIES = Object.freeze({
  step_0f: ['step_17'],
  step_12: ['step_0f'],
});

// Default branch-aggregation prerequisites for step_17.
// These can be omitted via dependency_comment when the prerequisite step is
// explicitly disabled in .workflow-config.yaml (e.g. non-AWS projects removing step_11_6).
export const DEFAULT_TERMINAL_BRANCH_DEPENDENCIES = Object.freeze({
  step_17: ['step_03', 'step_11_6', 'step_20', 'step_23'],
});

export const ORDER_LOCKED_CANONICAL_DEPENDENCIES = Object.freeze({
  step_06: ['step_05'],
  step_07: ['step_06'],
  step_08: ['step_07'],
  step_09: ['step_08'],
  step_10: ['step_09'],
  step_11: ['step_13'],
});

export function enforceTerminalStepOrder(stepIds = []) {
  if (!Array.isArray(stepIds) || stepIds.length === 0) {
    return [];
  }

  const deduped = [...new Set(stepIds.filter((stepId) => typeof stepId === 'string' && stepId))];
  const head = deduped.filter((stepId) => !TERMINAL_FINALIZATION_STEP_SET.has(stepId));
  const tail = TERMINAL_FINALIZATION_STEP_ORDER.filter((stepId) => deduped.includes(stepId));
  return [...head, ...tail];
}

export function getStepsForStage(stage) {
  const stages = {
    [WORKFLOW_STAGES.QUICK]: [
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
    [WORKFLOW_STAGES.MEDIUM]: [
      'step_00',
      'step_0b',
      'step_01',
      'step_01_5',
      'step_02',
      'step_02_5',
      'step_21',
      'step_03',
      'step_04',
      'step_05',
      'step_06',
      'step_07',
      'step_08',
      'step_10',
      'step_13',
      'step_17',
      'step_0f',
      'step_12',
    ],
    [WORKFLOW_STAGES.FULL]: [
      'step_00',
      'step_0b',
      'step_01',
      'step_01_5',
      'step_02',
      'step_02_5',
      'step_21',
      'step_03',
      'step_04',
      'step_05',
      'step_06',
      'step_07',
      'step_08',
      'step_09',
      'step_10',
      'step_13',
      'step_11',
      'step_11_5',
      'step_11_6',
      'step_14',
      'step_15',
      'step_16',
      'step_18',
      'step_19',
      'step_20',
      'step_22',
      'step_23',
      'step_17',
      'step_0f',
      'step_12',
    ],
  };

  return stages[stage] || stages[WORKFLOW_STAGES.FULL];
}

const STEP_EXECUTOR_LOADERS = Object.freeze({
  step_00: () => import('../steps/step_00_analyze.js').then(({ Step0Analyzer }) => Step0Analyzer),
  step_0b: () =>
    import('../steps/step_0b_bootstrap_docs.js').then(
      ({ Step0bBootstrapDocs }) => Step0bBootstrapDocs
    ),
  step_01: () =>
    import('../steps/step_01_documentation.js').then(
      ({ Step1DocumentationAnalyzer }) => Step1DocumentationAnalyzer
    ),
  step_01_5: () =>
    import('../steps/step_01_5_copilot_instructions.js').then(
      ({ Step1_5CopilotInstructionsValidator }) => Step1_5CopilotInstructionsValidator
    ),
  step_02: () =>
    import('../steps/step_02_consistency.js').then(
      ({ Step2ConsistencyAnalyzer }) => Step2ConsistencyAnalyzer
    ),
  step_02_5: () =>
    import('../steps/step_02_5_doc_optimize.js').then(
      ({ DocumentationOptimizer }) => DocumentationOptimizer
    ),
  step_03: () =>
    import('../steps/step_03_script_refs.js').then(
      ({ Step3ScriptAnalyzer }) => Step3ScriptAnalyzer
    ),
  step_04: () =>
    import('../steps/step_04_config_validation.js').then(
      ({ Step4ConfigAnalyzer }) => Step4ConfigAnalyzer
    ),
  step_05: () =>
    import('../steps/step_05_directory.js').then(
      ({ Step5DirectoryAnalyzer }) => Step5DirectoryAnalyzer
    ),
  step_06: () =>
    import('../steps/step_06_test_review.js').then(({ Step6TestReviewer }) => Step6TestReviewer),
  step_07: () =>
    import('../steps/step_07_test_gen.js').then(({ Step7TestGenerator }) => Step7TestGenerator),
  step_08: () =>
    import('../steps/step_08_test_exec.js').then(({ Step8TestExecutor }) => Step8TestExecutor),
  step_09: () =>
    import('../steps/step_09_dependencies.js').then(
      ({ Step9DependencyValidator }) => Step9DependencyValidator
    ),
  step_10: () =>
    import('../steps/step_10_code_quality.js').then(
      ({ Step10CodeQualityAnalyzer }) => Step10CodeQualityAnalyzer
    ),
  step_11: () =>
    import('../steps/step_11_context.js').then(
      ({ Step11ContextAnalyzer }) => Step11ContextAnalyzer
    ),
  step_11_5: () =>
    import('../steps/step_11_5_aws_lbs_validation.js').then(
      ({ Step11_5AwsLbsValidator }) => Step11_5AwsLbsValidator
    ),
  step_11_6: () =>
    import('../steps/step_11_6_aws_serverless_review.js').then(
      ({ Step11_6AwsServerlessReviewer }) => Step11_6AwsServerlessReviewer
    ),
  step_12: () =>
    import('../steps/step_12_git_finalization.js').then(
      ({ Step12GitFinalization }) => Step12GitFinalization
    ),
  step_13: () =>
    import('../steps/step_13_markdown_lint.js').then(
      ({ Step13MarkdownLint }) => Step13MarkdownLint
    ),
  step_14: () =>
    import('../steps/step_14_prompt_engineer.js').then(
      ({ Step14PromptEngineer }) => Step14PromptEngineer
    ),
  step_15: () =>
    import('../steps/step_15_ux_analysis.js').then(({ Step15UxAnalysis }) => Step15UxAnalysis),
  step_16: () =>
    import('../steps/step_16_version_update.js').then(
      ({ Step16VersionUpdate }) => Step16VersionUpdate
    ),
  step_17: () =>
    import('../steps/step_17_summary.js').then(({ WorkflowSummary }) => WorkflowSummary),
  step_18: () =>
    import('../steps/step_18_debugging.js').then(({ Step18Debugging }) => Step18Debugging),
  step_19: () =>
    import('../steps/step_19_typescript_review.js').then(
      ({ Step19TypescriptReview }) => Step19TypescriptReview
    ),
  step_20: () =>
    import('../steps/step_20_async_perf_review.js').then(
      ({ Step20AsyncPerfReview }) => Step20AsyncPerfReview
    ),
  step_21: () =>
    import('../steps/step_21_doc_consolidation.js').then(
      ({ DocConsolidationStep }) => DocConsolidationStep
    ),
  step_22: () =>
    import('../steps/step_22_accessibility_review.js').then(
      ({ Step22AccessibilityReview }) => Step22AccessibilityReview
    ),
  step_23: () =>
    import('../steps/step_23_perf_review.js').then(({ Step23PerfReview }) => Step23PerfReview),
  step_0f: () =>
    import('../steps/step_0f_commit_artifacts.js').then(
      ({ Step0fCommitArtifacts }) => Step0fCommitArtifacts
    ),
});

export function getCanonicalWorkflowSteps() {
  return [
    {
      id: 'step_00',
      name: 'Pre-Analysis',
      description: 'Analyze git state and project context',
      handler: STEP_EXECUTOR_LOADERS.step_00,
      dependencies: [],
    },
    {
      id: 'step_0b',
      name: 'Bootstrap Documentation',
      description: 'Generate initial documentation',
      handler: STEP_EXECUTOR_LOADERS.step_0b,
      dependencies: ['step_00'],
    },
    {
      id: 'step_01',
      name: 'Documentation Updates',
      description: 'Validate and update documentation',
      handler: STEP_EXECUTOR_LOADERS.step_01,
      dependencies: ['step_0b'],
    },
    {
      id: 'step_01_5',
      name: 'Copilot Instructions Validation',
      description: 'Audit and refresh .github/copilot-instructions.md against live repo facts',
      handler: STEP_EXECUTOR_LOADERS.step_01_5,
      dependencies: ['step_01'],
    },
    {
      id: 'step_02',
      name: 'Consistency Analysis',
      description: 'Check code and documentation consistency',
      handler: STEP_EXECUTOR_LOADERS.step_02,
      dependencies: ['step_01_5'],
    },
    {
      id: 'step_02_5',
      name: 'Documentation Optimization',
      description: 'Optimize documentation size and quality',
      handler: STEP_EXECUTOR_LOADERS.step_02_5,
      dependencies: ['step_02'],
    },
    {
      id: 'step_21',
      name: 'Doc Consolidation',
      description:
        'Find similar markdown docs via Cosine Similarity/TF-IDF and AI-merge them into canonical documents',
      handler: STEP_EXECUTOR_LOADERS.step_21,
      dependencies: ['step_02_5'],
    },
    {
      id: 'step_03',
      name: 'Script References',
      description: 'Validate script references',
      handler: STEP_EXECUTOR_LOADERS.step_03,
      dependencies: ['step_02'],
    },
    {
      id: 'step_04',
      name: 'Configuration Validation',
      description: 'Validate project configuration',
      handler: STEP_EXECUTOR_LOADERS.step_04,
      dependencies: ['step_00'],
    },
    {
      id: 'step_05',
      name: 'Directory Structure',
      description: 'Validate directory structure',
      handler: STEP_EXECUTOR_LOADERS.step_05,
      dependencies: ['step_04'],
    },
    {
      id: 'step_06',
      name: 'Test Review',
      description: 'Review existing tests',
      handler: STEP_EXECUTOR_LOADERS.step_06,
      dependencies: ['step_05'],
    },
    {
      id: 'step_07',
      name: 'Test Generation',
      description: 'Generate new tests',
      handler: STEP_EXECUTOR_LOADERS.step_07,
      dependencies: ['step_06'],
    },
    {
      id: 'step_08',
      name: 'Test Execution',
      description: 'Execute test suite',
      handler: STEP_EXECUTOR_LOADERS.step_08,
      dependencies: ['step_07'],
    },
    {
      id: 'step_09',
      name: 'Dependency Analysis',
      description: 'Analyze and validate dependencies',
      handler: STEP_EXECUTOR_LOADERS.step_09,
      dependencies: ['step_08'],
    },
    {
      id: 'step_10',
      name: 'Code Quality',
      description: 'Analyze code quality',
      handler: STEP_EXECUTOR_LOADERS.step_10,
      dependencies: ['step_09'],
    },
    {
      id: 'step_13',
      name: 'Markdown Linting',
      description: 'Lint markdown files',
      handler: STEP_EXECUTOR_LOADERS.step_13,
      dependencies: ['step_10'],
    },
    {
      id: 'step_11',
      name: 'Context Management',
      description: 'Manage workflow context',
      handler: STEP_EXECUTOR_LOADERS.step_11,
      dependencies: ['step_13'],
    },
    {
      id: 'step_11_5',
      name: 'AWS LBS Validation',
      description:
        'Validate aws_lbs_backend_setup projects: shell scripts, Lambda structure, AWS config',
      handler: STEP_EXECUTOR_LOADERS.step_11_5,
      dependencies: ['step_11'],
    },
    {
      id: 'step_11_6',
      name: 'AWS Serverless AI Review',
      description: 'AI-powered deployment readiness review for aws_lbs_backend_setup projects',
      handler: STEP_EXECUTOR_LOADERS.step_11_6,
      dependencies: ['step_11_5'],
    },
    {
      id: 'step_14',
      name: 'Prompt Engineering',
      description: 'Analyze and optimize AI prompts',
      handler: STEP_EXECUTOR_LOADERS.step_14,
      dependencies: ['step_13'],
    },
    {
      id: 'step_15',
      name: 'UX Analysis',
      description: 'Analyze UX and accessibility',
      handler: STEP_EXECUTOR_LOADERS.step_15,
      dependencies: ['step_14'],
    },
    {
      id: 'step_16',
      name: 'Version Update',
      description: 'Update semantic versions',
      handler: STEP_EXECUTOR_LOADERS.step_16,
      dependencies: ['step_03'],
    },
    {
      id: 'step_18',
      name: 'Debugging Analysis',
      description: 'AI-powered debugging analysis (observer, async, data-structure personas)',
      handler: STEP_EXECUTOR_LOADERS.step_18,
      dependencies: ['step_16'],
    },
    {
      id: 'step_19',
      name: 'TypeScript Review',
      description: 'AI-powered TypeScript review using the "Strider" TypeScript Developer persona',
      handler: STEP_EXECUTOR_LOADERS.step_19,
      dependencies: ['step_18'],
    },
    {
      id: 'step_20',
      name: 'Async Performance Review',
      description:
        'AI-powered async performance review (overfetching, event loop, memory leaks, promise anti-patterns)',
      handler: STEP_EXECUTOR_LOADERS.step_20,
      dependencies: ['step_19'],
    },
    {
      id: 'step_22',
      name: 'Accessibility Review',
      description:
        'AI-powered WCAG 2.1 AA/AAA accessibility review (ARIA, keyboard navigation, colour contrast, reduced-motion)',
      handler: STEP_EXECUTOR_LOADERS.step_22,
      dependencies: ['step_21'],
    },
    {
      id: 'step_23',
      name: 'Performance Review',
      description:
        'AI-powered performance review (algorithmic complexity, sync I/O, memory hotspots, missing memoization)',
      handler: STEP_EXECUTOR_LOADERS.step_23,
      dependencies: ['step_22'],
    },
    {
      id: 'step_17',
      name: 'Workflow Summary',
      description: 'Generate workflow summary report',
      handler: STEP_EXECUTOR_LOADERS.step_17,
      dependencies: DEFAULT_TERMINAL_BRANCH_DEPENDENCIES.step_17,
    },
    {
      id: 'step_0f',
      name: 'Commit Artifacts',
      description: 'Commit workflow artifacts generated during the run',
      handler: STEP_EXECUTOR_LOADERS.step_0f,
      dependencies: ['step_17'],
    },
    {
      id: 'step_12',
      name: 'Git Finalization',
      description: 'Stage, commit and push all modifications',
      handler: STEP_EXECUTOR_LOADERS.step_12,
      dependencies: ['step_0f'],
      critical: false,
    },
  ];
}
