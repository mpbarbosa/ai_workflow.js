/**
 * @fileoverview CLI Help Utilities
 * @module cli/help
 *
 * Extended help documentation and examples for CLI commands.
 *
 * Architecture: v2.0.0 Pattern
 * - Pure functions for help content generation
 * - Impure wrappers for display
 *
 * @version 1.0.0
 * @since 2026-02-11
 */

import chalk from 'chalk';

// ============================================================================
// PURE FUNCTIONS - Help Content
// ============================================================================

/**
 * Get command examples
 * @pure
 * @param {string} command - Command name
 * @returns {Array<Object>} Examples with description and command
 */
export function getCommandExamples(command) {
  const examples = {
    run: [
      {
        description: 'Run full workflow',
        command: 'ai-workflow run',
      },
      {
        description: 'Run quick validation stage',
        command: 'ai-workflow run --stage quick',
      },
      {
        description: 'Run in auto mode (no prompts)',
        command: 'ai-workflow run --auto --verbose',
      },
      {
        description: 'Dry run to preview execution',
        command: 'ai-workflow run --dry-run',
      },
      {
        description: 'Run with custom config',
        command: 'ai-workflow run --config .my-config.yaml',
      },
    ],
    resume: [
      {
        description: 'List available checkpoints',
        command: 'ai-workflow resume --list',
      },
      {
        description: 'Resume from latest checkpoint',
        command: 'ai-workflow resume --latest',
      },
      {
        description: 'Resume from specific checkpoint',
        command: 'ai-workflow resume wf-20260211-123456',
      },
    ],
    status: [
      {
        description: 'Show workflow status',
        command: 'ai-workflow status',
      },
      {
        description: 'Show status with verbose output',
        command: 'ai-workflow status --verbose',
      },
    ],
    init: [
      {
        description: 'Initialize with interactive wizard',
        command: 'ai-workflow init --interactive',
      },
      {
        description: 'Initialize with Node.js template',
        command: 'ai-workflow init --template nodejs_api --name my-api',
      },
      {
        description: 'Initialize React SPA project',
        command: 'ai-workflow init --template react_spa',
      },
      {
        description: 'Force overwrite existing config',
        command: 'ai-workflow init --force',
      },
    ],
    config: [
      {
        description: 'Show current configuration',
        command: 'ai-workflow config show',
      },
      {
        description: 'Validate configuration',
        command: 'ai-workflow config validate',
      },
      {
        description: 'Get config value',
        command: 'ai-workflow config get project.name',
      },
      {
        description: 'Set config value',
        command: 'ai-workflow config set project.name "MyProject"',
      },
    ],
    clean: [
      {
        description: 'Clean all artifacts (dry run)',
        command: 'ai-workflow clean --all --dry-run',
      },
      {
        description: 'Clean artifacts and cache',
        command: 'ai-workflow clean --artifacts --cache',
      },
      {
        description: 'Clean old checkpoints, keep last 5',
        command: 'ai-workflow clean --checkpoints --keep-last 5',
      },
      {
        description: 'Clean files older than 30 days',
        command: 'ai-workflow clean --all --older-than-days 30',
      },
    ],
  };

  return examples[command] || [];
}

/**
 * Get common use cases
 * @pure
 * @returns {Array<Object>} Use cases with title and steps
 */
export function getCommonUseCases() {
  return [
    {
      title: 'Quick Validation',
      description: 'Run a quick validation of your project',
      steps: [
        'ai-workflow run --stage quick',
        'Review the validation results',
        'Fix any issues reported',
      ],
    },
    {
      title: 'Resume After Interruption',
      description: 'Continue a workflow that was interrupted',
      steps: [
        'ai-workflow resume --list',
        'Find the checkpoint ID',
        'ai-workflow resume <checkpoint-id>',
      ],
    },
    {
      title: 'Clean Workspace',
      description: 'Clean up old workflow artifacts',
      steps: [
        'ai-workflow clean --all --dry-run',
        'Review what will be deleted',
        'ai-workflow clean --all',
      ],
    },
    {
      title: 'New Project Setup',
      description: 'Initialize workflow in a new project',
      steps: [
        'cd /path/to/project',
        'ai-workflow init --interactive',
        'Follow the setup wizard',
        'ai-workflow run --stage quick',
      ],
    },
  ];
}

/**
 * Get workflow stages documentation
 * @pure
 * @returns {Object} Stages with descriptions
 */
export function getWorkflowStages() {
  return {
    quick: {
      name: 'Quick',
      description: 'Fast validation for rapid feedback',
      steps: 3,
      duration: '1-2 minutes',
      includes: ['Project detection', 'Documentation validation', 'Code analysis'],
    },
    medium: {
      name: 'Medium',
      description: 'Standard workflow with essential checks',
      steps: 6,
      duration: '5-10 minutes',
      includes: [
        'Project detection',
        'Documentation validation',
        'Code analysis',
        'Test generation',
        'Quality checks',
        'Dependency analysis',
      ],
    },
    full: {
      name: 'Full',
      description: 'Complete workflow with all steps',
      steps: 10,
      duration: '15-30 minutes',
      includes: [
        'All medium steps',
        'Git automation',
        'Linting',
        'Build verification',
        'Artifact commits',
      ],
    },
  };
}

/**
 * Get configuration options documentation
 * @pure
 * @returns {Array<Object>} Config options with descriptions
 */
export function getConfigOptions() {
  return [
    {
      key: 'project.name',
      type: 'string',
      required: true,
      description: 'Project name',
      example: 'my-awesome-project',
    },
    {
      key: 'project.kind',
      type: 'string',
      required: true,
      description: 'Project type',
      example: 'nodejs_api, react_spa, python_app, etc.',
    },
    {
      key: 'project.primary_language',
      type: 'string',
      required: true,
      description: 'Primary programming language',
      example: 'javascript, typescript, python, etc.',
    },
    {
      key: 'workflow.stages.quick.enabled',
      type: 'boolean',
      required: false,
      description: 'Enable quick stage',
      example: 'true',
    },
    {
      key: 'validation.documentation.required',
      type: 'boolean',
      required: false,
      description: 'Require documentation validation',
      example: 'true',
    },
    {
      key: 'validation.testing.min_coverage',
      type: 'number',
      required: false,
      description: 'Minimum test coverage percentage',
      example: '70',
    },
  ];
}

/**
 * Format example
 * @pure
 * @param {Object} example - Example object
 * @returns {string} Formatted example
 */
export function formatExample(example) {
  const { description, command } = example;
  return `${chalk.gray(description)}\n${chalk.cyan(command)}`;
}

/**
 * Format use case
 * @pure
 * @param {Object} useCase - Use case object
 * @returns {string} Formatted use case
 */
export function formatUseCase(useCase) {
  const { title, description, steps } = useCase;
  const lines = [
    chalk.bold(title),
    chalk.gray(description),
    '',
    ...steps.map((step, i) => `  ${i + 1}. ${chalk.cyan(step)}`),
  ];
  return lines.join('\n');
}

// ============================================================================
// IMPURE WRAPPERS - Help Display
// ============================================================================

/**
 * Display command examples
 * @param {string} command - Command name
 * @returns {void}
 */
export function displayCommandExamples(command) {
  const examples = getCommandExamples(command);

  if (examples.length === 0) {
    console.log(chalk.yellow(`No examples available for command: ${command}`));
    return;
  }

  console.log();
  console.log(chalk.bold(`Examples for '${command}' command:`));
  console.log();

  examples.forEach((example, i) => {
    if (i > 0) console.log();
    console.log(formatExample(example));
  });

  console.log();
}

/**
 * Display common use cases
 * @returns {void}
 */
export function displayCommonUseCases() {
  const useCases = getCommonUseCases();

  console.log();
  console.log(chalk.bold('Common Use Cases:'));
  console.log();

  useCases.forEach((useCase, i) => {
    if (i > 0) console.log();
    console.log(formatUseCase(useCase));
  });

  console.log();
}

/**
 * Display workflow stages
 * @returns {void}
 */
export function displayWorkflowStages() {
  const stages = getWorkflowStages();

  console.log();
  console.log(chalk.bold('Workflow Stages:'));
  console.log();

  Object.entries(stages).forEach(([_key, stage]) => {
    console.log(chalk.cyan.bold(stage.name));
    console.log(chalk.gray(stage.description));
    console.log(`  Steps: ${stage.steps}`);
    console.log(`  Duration: ${stage.duration}`);
    console.log(`  Includes:`);
    stage.includes.forEach((item) => {
      console.log(`    • ${item}`);
    });
    console.log();
  });
}

/**
 * Display configuration options
 * @returns {void}
 */
export function displayConfigOptions() {
  const options = getConfigOptions();

  console.log();
  console.log(chalk.bold('Configuration Options:'));
  console.log();

  options.forEach((option) => {
    const required = option.required ? chalk.red('*required') : chalk.gray('optional');
    console.log(chalk.cyan(option.key) + ` (${option.type}, ${required})`);
    console.log(`  ${option.description}`);
    console.log(chalk.gray(`  Example: ${option.example}`));
    console.log();
  });
}

/**
 * Display quick start guide
 * @returns {void}
 */
export function displayQuickStart() {
  console.log();
  console.log(chalk.bold.cyan('AI Workflow - Quick Start Guide'));
  console.log(chalk.gray('━'.repeat(60)));
  console.log();

  console.log(chalk.bold('1. Initialize your project'));
  console.log(chalk.gray('   Run the setup wizard to create configuration'));
  console.log(chalk.cyan('   $ ai-workflow init --interactive'));
  console.log();

  console.log(chalk.bold('2. Run quick validation'));
  console.log(chalk.gray('   Validate your project setup'));
  console.log(chalk.cyan('   $ ai-workflow run --stage quick'));
  console.log();

  console.log(chalk.bold('3. Check status'));
  console.log(chalk.gray('   View workflow progress and checkpoints'));
  console.log(chalk.cyan('   $ ai-workflow status'));
  console.log();

  console.log(chalk.bold('4. Run full workflow'));
  console.log(chalk.gray('   Execute complete workflow with all steps'));
  console.log(chalk.cyan('   $ ai-workflow run'));
  console.log();

  console.log(chalk.gray('For more help: ai-workflow --help'));
  console.log();
}

export default {
  // Pure functions
  getCommandExamples,
  getCommonUseCases,
  getWorkflowStages,
  getConfigOptions,
  formatExample,
  formatUseCase,
  // Impure wrappers
  displayCommandExamples,
  displayCommonUseCases,
  displayWorkflowStages,
  displayConfigOptions,
  displayQuickStart,
};
