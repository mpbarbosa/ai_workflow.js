/**
 * @fileoverview CLI Init Command
 * @module cli/commands/init
 *
 * Implements the 'init' command for initializing workflow in a new project.
 * Equivalent to the shell version's --init-config flag, providing an
 * interactive configuration wizard for creating .workflow-config.yaml.
 *
 * Architecture: v2.0.0 Pattern
 * - Pure functions for template generation
 * - Impure wrapper for user interaction and file I/O
 *
 * @version 2.0.0
 * @since 2026-02-10
 */

import chalk from 'chalk';
import inquirer from 'inquirer';
import yaml from 'js-yaml';
import { logger } from '../../core/logger.js';
import { FileOperations } from '../../lib/file_operations.js';
import { Config } from '../../lib/config.js';
import { TechStackDetector } from '../../lib/tech_stack.js';
import { ProjectKindDetector } from '../../lib/project_kind_detection.js';

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

/**
 * Get language-specific tech stack defaults
 * @pure
 * @param {string} language - Primary language
 * @returns {Object} Default tech stack settings
 */
export function generateTechStackDefaults(language) {
  const defaults = {
    javascript: {
      build_system: 'npm',
      test_framework: 'jest',
      test_command: 'npm test',
      lint_command: 'npm run lint',
    },
    typescript: {
      build_system: 'npm',
      test_framework: 'jest',
      test_command: 'npm test',
      lint_command: 'npm run lint',
    },
    python: {
      build_system: 'pip',
      test_framework: 'pytest',
      test_command: 'pytest',
      lint_command: 'pylint src/',
    },
    go: {
      build_system: 'go mod',
      test_framework: 'go test',
      test_command: 'go test ./...',
      lint_command: 'golangci-lint run',
    },
    java: {
      build_system: 'maven',
      test_framework: 'junit',
      test_command: 'mvn test',
      lint_command: 'mvn checkstyle:check',
    },
    ruby: {
      build_system: 'bundler',
      test_framework: 'rspec',
      test_command: 'bundle exec rspec',
      lint_command: 'rubocop',
    },
    rust: {
      build_system: 'cargo',
      test_framework: 'cargo test',
      test_command: 'cargo test',
      lint_command: 'cargo clippy',
    },
    bash: {
      build_system: 'none',
      test_framework: 'bats',
      test_command: 'bats tests/',
      lint_command: 'shellcheck *.sh',
    },
  };
  return (
    defaults[language] || {
      build_system: 'none',
      test_framework: null,
      test_command: '',
      lint_command: '',
    }
  );
}

/**
 * Get language-specific directory structure defaults
 * @pure
 * @param {string} language - Primary language
 * @returns {Object} Default directory structure
 */
export function generateStructureDefaults(language) {
  const defaults = {
    javascript: { source_dirs: ['src'], test_dirs: ['test', '__tests__'], docs_dirs: ['docs'] },
    typescript: { source_dirs: ['src'], test_dirs: ['test', '__tests__'], docs_dirs: ['docs'] },
    python: { source_dirs: ['src'], test_dirs: ['tests'], docs_dirs: ['docs'] },
    go: { source_dirs: ['cmd', 'internal', 'pkg'], test_dirs: ['.'], docs_dirs: ['docs'] },
    java: { source_dirs: ['src/main/java'], test_dirs: ['src/test/java'], docs_dirs: ['docs'] },
    ruby: { source_dirs: ['lib'], test_dirs: ['spec'], docs_dirs: ['docs'] },
    rust: { source_dirs: ['src'], test_dirs: ['tests'], docs_dirs: ['docs'] },
    bash: { source_dirs: ['bin', 'lib'], test_dirs: ['tests'], docs_dirs: ['docs'] },
  };
  return defaults[language] || { source_dirs: ['src'], test_dirs: ['tests'], docs_dirs: ['docs'] };
}

/**
 * Generate YAML preview of configuration
 * @pure
 * @param {Object} config - Configuration object
 * @returns {string} YAML formatted string
 */
export function formatConfigPreview(config) {
  try {
    return yaml.dump(config, { indent: 2, lineWidth: 80 });
  } catch {
    return JSON.stringify(config, null, 2);
  }
}

/**
 * Generate configuration template (enhanced)
 * Merges base config with tech stack and structure sections
 * @pure
 * @param {Object} answers - User answers from prompts
 * @returns {Object} Configuration object
 */
export function generateConfigTemplate(answers) {
  const {
    projectName,
    projectKind,
    primaryLanguage,
    description,
    buildSystem,
    testFramework,
    testCommand,
    lintCommand,
    sourceDirs,
    testDirs,
    docsDirs,
  } = answers;

  const config = {
    project: {
      name: projectName,
      kind: projectKind,
      primary_language: primaryLanguage,
      description: description || `${projectName} project`,
    },
    tech_stack: {
      primary_language: primaryLanguage,
      build_system: buildSystem || generateTechStackDefaults(primaryLanguage).build_system,
      test_framework: testFramework || generateTechStackDefaults(primaryLanguage).test_framework,
      test_command: testCommand || generateTechStackDefaults(primaryLanguage).test_command,
      ...(lintCommand ? { lint_command: lintCommand } : {}),
    },
    structure: {
      source_dirs: sourceDirs || generateStructureDefaults(primaryLanguage).source_dirs,
      test_dirs: testDirs || generateStructureDefaults(primaryLanguage).test_dirs,
      docs_dirs: docsDirs || generateStructureDefaults(primaryLanguage).docs_dirs,
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

  return config;
}

// ============================================================================
// IMPURE WRAPPER - Command Execution
// ============================================================================

/**
 * Auto-detect project tech stack and kind
 * @param {string} projectRoot - Project root directory
 * @returns {Promise<Object>} Detected info with techStack and projectKind
 */
async function detectProjectInfo(projectRoot) {
  try {
    const techDetector = new TechStackDetector(projectRoot);
    const kindDetector = new ProjectKindDetector();

    const [techStack, kindResult] = await Promise.all([
      techDetector.detectTechStack(projectRoot),
      kindDetector.detectProjectKind(projectRoot),
    ]);

    return { techStack, kindResult };
  } catch {
    return { techStack: null, kindResult: null };
  }
}

/**
 * Prompt user for configuration
 * @param {Object} options - Command options
 * @param {Object} detected - Auto-detected project info
 * @returns {Promise<Object>} User answers
 */
async function promptForConfiguration(options, detected = {}) {
  const templates = getProjectTemplates();
  const { techStack, kindResult } = detected;

  // Derive defaults from detection
  const detectedKind = kindResult?.kind || 'generic';
  const detectedLang = techStack?.primary_language || 'javascript';

  // If template specified, use it directly
  if (options.template && !options.interactive) {
    const template = templates.find((t) => t.name === options.template);
    const lang = template.name.includes('nodejs')
      ? 'javascript'
      : template.name.includes('python')
        ? 'python'
        : template.name.includes('shell')
          ? 'bash'
          : 'javascript';
    const defaults = generateTechStackDefaults(lang);
    const structure = generateStructureDefaults(lang);
    return {
      projectName: options.name || 'my-project',
      projectKind: options.template,
      primaryLanguage: lang,
      description: options.description || '',
      buildSystem: defaults.build_system,
      testFramework: defaults.test_framework,
      testCommand: defaults.test_command,
      lintCommand: defaults.lint_command,
      sourceDirs: structure.source_dirs,
      testDirs: structure.test_dirs,
      docsDirs: structure.docs_dirs,
    };
  }

  // Interactive mode - Step 1: Project info
  const infoQuestions = [
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
      default: detectedKind,
    },
    {
      type: 'list',
      name: 'primaryLanguage',
      message: 'Primary language:',
      choices: [
        'javascript',
        'typescript',
        'python',
        'bash',
        'go',
        'java',
        'ruby',
        'rust',
        'other',
      ],
      default: detectedLang,
    },
    {
      type: 'input',
      name: 'description',
      message: 'Project description (optional):',
      default: '',
    },
  ];

  const infoAnswers = await inquirer.prompt(infoQuestions);
  const lang = infoAnswers.primaryLanguage;
  const langDefaults = generateTechStackDefaults(lang);
  const langStructure = generateStructureDefaults(lang);

  // Step 2: Commands configuration
  console.log();
  console.log(chalk.blue('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.blue('  Step 2/3: Build & Test Commands'));
  console.log(chalk.blue('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log();

  const commandQuestions = [
    {
      type: 'input',
      name: 'testCommand',
      message: 'Test command:',
      default: techStack?.test_command || langDefaults.test_command,
    },
    {
      type: 'input',
      name: 'lintCommand',
      message: 'Lint command (optional):',
      default: langDefaults.lint_command,
    },
  ];

  const commandAnswers = await inquirer.prompt(commandQuestions);

  // Step 3: Project structure
  console.log();
  console.log(chalk.blue('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.blue('  Step 3/3: Project Structure'));
  console.log(chalk.blue('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log();

  const structureQuestions = [
    {
      type: 'input',
      name: 'sourceDirsInput',
      message: 'Source directories (space-separated):',
      default: langStructure.source_dirs.join(' '),
    },
    {
      type: 'input',
      name: 'testDirsInput',
      message: 'Test directories (space-separated):',
      default: langStructure.test_dirs.join(' '),
    },
    {
      type: 'input',
      name: 'docsDirsInput',
      message: 'Documentation directories (space-separated):',
      default: langStructure.docs_dirs.join(' '),
    },
  ];

  const structureAnswers = await inquirer.prompt(structureQuestions);

  return {
    ...infoAnswers,
    buildSystem: techStack?.build_system || langDefaults.build_system,
    testFramework: techStack?.test_framework || langDefaults.test_framework,
    testCommand: commandAnswers.testCommand,
    lintCommand: commandAnswers.lintCommand,
    sourceDirs: structureAnswers.sourceDirsInput.split(/\s+/).filter(Boolean),
    testDirs: structureAnswers.testDirsInput.split(/\s+/).filter(Boolean),
    docsDirs: structureAnswers.docsDirsInput.split(/\s+/).filter(Boolean),
  };
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
 * Execute the init command (equivalent to shell --init-config wizard)
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
    console.log(chalk.blue('╔══════════════════════════════════════════╗'));
    console.log(chalk.blue('║   AI Workflow - Configuration Wizard     ║'));
    console.log(chalk.blue('╚══════════════════════════════════════════╝'));
    console.log();

    const projectRoot = options.projectRoot || process.cwd();
    const configPath = `${projectRoot}/.workflow-config.yaml`;

    // Check if config already exists
    const fileOps = new FileOperations(projectRoot);
    const configExists = await fileOps.exists(configPath);

    if (configExists && !options.force) {
      console.log(chalk.yellow('⚠️  Configuration file already exists'));
      console.log(chalk.gray(`Path: ${configPath}`));
      console.log();
      const { overwrite } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'overwrite',
          message: 'Overwrite existing configuration?',
          default: false,
        },
      ]);
      if (!overwrite) {
        console.log(chalk.yellow('Wizard cancelled.'));
        process.exit(0);
      }
    }

    // Step 1: Auto-detect tech stack
    console.log(chalk.blue('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.blue('  Step 1/3: Project Information'));
    console.log(chalk.blue('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log();
    console.log(chalk.cyan('Analyzing project structure...'));

    const detected = await detectProjectInfo(projectRoot);
    if (detected.techStack) {
      const lang = detected.techStack.primary_language;
      const kind = detected.kindResult?.kind || 'generic';
      const confidence = detected.kindResult?.confidence || 0;
      console.log(chalk.green('✓ Detection complete'));
      console.log();
      if (lang) console.log(`  Detected language:  ${chalk.bold(lang)}`);
      if (detected.techStack.build_system)
        console.log(`  Build system:       ${detected.techStack.build_system}`);
      if (detected.techStack.test_framework)
        console.log(`  Test framework:     ${detected.techStack.test_framework}`);
      console.log(`  Project kind:       ${chalk.bold(kind)} (${confidence}% confidence)`);
      console.log();
    }

    // Get configuration through interactive prompts
    const answers = await promptForConfiguration(options, detected);

    // Generate config
    const config = generateConfigTemplate(answers);

    // Preview before saving
    console.log();
    console.log(chalk.blue('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.blue('  Configuration Preview'));
    console.log(chalk.blue('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log();
    console.log(chalk.gray(formatConfigPreview(config)));
    console.log(chalk.blue('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log();

    const { save } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'save',
        message: `Save this configuration to ${configPath}?`,
        default: true,
      },
    ]);

    if (!save) {
      console.log(chalk.yellow('Configuration not saved. Run again to retry.'));
      process.exit(0);
    }

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

export default {
  initCommand,
  getProjectTemplates,
  generateConfigTemplate,
  validateInitOptions,
  generateTechStackDefaults,
  generateStructureDefaults,
  formatConfigPreview,
};
