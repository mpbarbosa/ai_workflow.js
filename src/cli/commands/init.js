/**
 * @fileoverview CLI Init Command
 * @module cli/commands/init
 *
 * Implements the 'init' command for initializing workflow in a new project.
 *
 * Architecture: v2.0.0 Pattern
 * - Pure functions for template generation
 * - Impure wrapper for user interaction and file I/O
 *
 * @version 1.0.0
 * @since 2026-02-10
 */

import chalk from 'chalk';
import inquirer from 'inquirer';
import { logger } from '../../core/logger.js';
import { FileOperations } from '../../lib/file_operations.js';
import { Config } from '../../lib/config.js';

// ============================================================================
// PURE FUNCTIONS - Template Generation
// ============================================================================

/**
 * Get available project templates
 * @pure
 * @returns {Array<Object>} Template list with name and description
 */
export function getProjectTemplates() {
  return [
    { name: 'nodejs_api', description: 'Node.js API/Backend Service' },
    { name: 'react_spa', description: 'React Single Page Application' },
    { name: 'python_app', description: 'Python Application' },
    { name: 'shell_script_automation', description: 'Shell Script Automation' },
    { name: 'static_website', description: 'Static Website (HTML/CSS/JS)' },
    { name: 'client_spa', description: 'Client-side SPA (vanilla JS)' },
    { name: 'configuration_library', description: 'Configuration Library' },
    { name: 'generic', description: 'Generic Project' },
  ];
}

/**
 * Generate configuration template
 * @pure
 * @param {Object} answers - User answers from prompts
 * @returns {Object} Configuration object
 */
export function generateConfigTemplate(answers) {
  const { projectName, projectKind, primaryLanguage, description } = answers;

  return {
    project: {
      name: projectName,
      kind: projectKind,
      primary_language: primaryLanguage,
      description: description || `${projectName} project`,
    },
    workflow: {
      stages: {
        quick: {
          enabled: true,
          steps: ['step_00', 'step_01', 'step_02'],
        },
        medium: {
          enabled: true,
          steps: ['step_00', 'step_01', 'step_02', 'step_03', 'step_04', 'step_05'],
        },
        full: {
          enabled: true,
          steps: [
            'step_00',
            'step_01',
            'step_02',
            'step_03',
            'step_04',
            'step_05',
            'step_06',
            'step_07',
            'step_08',
            'step_0f',
          ],
        },
      },
    },
    validation: {
      documentation: {
        required: true,
        min_coverage: 80,
      },
      testing: {
        required: true,
        min_coverage: 70,
      },
    },
  };
}

/**
 * Validate init options
 * @pure
 * @param {Object} options - Command options
 * @returns {Object} Validation result
 */
export function validateInitOptions(options) {
  const errors = [];

  if (options.template) {
    const validTemplates = getProjectTemplates().map((t) => t.name);
    if (!validTemplates.includes(options.template)) {
      errors.push(
        `Invalid template: ${options.template}. Valid templates: ${validTemplates.join(', ')}`
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// IMPURE WRAPPER - Command Execution
// ============================================================================

/**
 * Prompt user for configuration
 * @param {Object} options - Command options
 * @returns {Promise<Object>} User answers
 */
async function promptForConfiguration(options) {
  const templates = getProjectTemplates();

  // If template specified, use it
  if (options.template) {
    const template = templates.find((t) => t.name === options.template);
    return {
      projectName: options.name || 'my-project',
      projectKind: options.template,
      primaryLanguage: template.name.includes('nodejs')
        ? 'javascript'
        : template.name.includes('python')
          ? 'python'
          : template.name.includes('shell')
            ? 'bash'
            : 'javascript',
      description: options.description || '',
    };
  }

  // Interactive mode
  const questions = [
    {
      type: 'input',
      name: 'projectName',
      message: 'Project name:',
      default: options.name || 'my-project',
      validate: (input) => input.length > 0 || 'Project name is required',
    },
    {
      type: 'list',
      name: 'projectKind',
      message: 'Project type:',
      choices: templates.map((t) => ({
        name: `${t.name} - ${t.description}`,
        value: t.name,
      })),
      default: 'generic',
    },
    {
      type: 'list',
      name: 'primaryLanguage',
      message: 'Primary language:',
      choices: ['javascript', 'typescript', 'python', 'bash', 'go', 'java', 'other'],
      default: 'javascript',
    },
    {
      type: 'input',
      name: 'description',
      message: 'Project description (optional):',
      default: '',
    },
  ];

  return inquirer.prompt(questions);
}

/**
 * Create workflow directories
 * @param {string} projectRoot - Project root directory
 * @returns {Promise<void>}
 */
async function createWorkflowDirectories(projectRoot) {
  const fileOps = new FileOperations(projectRoot);

  const directories = [
    '.ai_workflow',
    '.ai_workflow/backlog',
    '.ai_workflow/summaries',
    '.ai_workflow/logs',
    '.ai_workflow/metrics',
    '.ai_workflow/checkpoints',
    '.ai_workflow/prompts',
    '.ai_workflow/ml_models',
    '.ai_workflow/.incremental_cache',
  ];

  for (const dir of directories) {
    await fileOps.createDirectory(dir, { recursive: true });
  }
}

/**
 * Execute the init command
 * @param {Object} options - Command options
 * @returns {Promise<void>}
 */
export async function initCommand(options) {
  try {
    // Validate options
    const validation = validateInitOptions(options);
    if (!validation.isValid) {
      logger.error(chalk.red('Invalid options:'));
      validation.errors.forEach((err) => logger.error(chalk.red(`  - ${err}`)));
      process.exit(1);
    }

    console.log();
    console.log(chalk.blue('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.blue('  Initialize Workflow'));
    console.log(chalk.blue('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log();

    const projectRoot = options.projectRoot || process.cwd();
    const configPath = `${projectRoot}/.workflow-config.yaml`;

    // Check if config already exists
    const fileOps = new FileOperations(projectRoot);
    const configExists = await fileOps.exists(configPath);

    if (configExists && !options.force) {
      console.log(chalk.yellow('Configuration file already exists'));
      console.log(chalk.gray(`Path: ${configPath}`));
      console.log();
      console.log(chalk.cyan('Use --force to overwrite'));
      console.log();
      process.exit(1);
    }

    // Get configuration
    let answers;
    if (options.interactive || !options.template) {
      answers = await promptForConfiguration(options);
    } else {
      answers = {
        projectName: options.name || 'my-project',
        projectKind: options.template,
        primaryLanguage: 'javascript',
        description: options.description || '',
      };
    }

    console.log();
    console.log(chalk.cyan('Creating configuration...'));

    // Generate config
    const config = generateConfigTemplate(answers);

    // Write config file
    const configManager = new Config(configPath);
    await configManager.save(config);

    console.log(chalk.green(`✓ Created ${configPath}`));

    // Create directories
    console.log(chalk.cyan('Creating workflow directories...'));
    await createWorkflowDirectories(projectRoot);
    console.log(chalk.green('✓ Created workflow directories'));

    // Display summary
    console.log();
    console.log(chalk.green.bold('Initialization complete! 🎉'));
    console.log();
    console.log(chalk.cyan('Next steps:'));
    console.log(chalk.white('  1. Review configuration: ') + chalk.gray('ai-workflow config show'));
    console.log(
      chalk.white('  2. Run quick validation: ') + chalk.gray('ai-workflow run --stage quick')
    );
    console.log(chalk.white('  3. Run full workflow:   ') + chalk.gray('ai-workflow run'));
    console.log();

    process.exit(0);
  } catch (error) {
    logger.error(chalk.red(`Error: ${error.message}`));
    if (options.verbose && error.stack) {
      logger.error(chalk.gray(error.stack));
    }
    process.exit(1);
  }
}

export default { initCommand, getProjectTemplates, generateConfigTemplate, validateInitOptions };
