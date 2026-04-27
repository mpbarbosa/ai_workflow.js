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
import * as path from 'node:path';
import chalk from 'chalk';
import inquirer from 'inquirer';
// @ts-expect-error - js-yaml does not ship types in the current TypeScript setup.
import yaml from 'js-yaml';
import { logger } from '../../core/logger.js';
// @ts-expect-error - legacy JS file operations module is untyped in the current TypeScript setup.
import { FileOperations } from '../../lib/file_operations.js';
// @ts-expect-error - legacy JS tech stack detector module is untyped in the current TypeScript setup.
import { TechStackDetector } from '../../lib/tech_stack.js';
// @ts-expect-error - legacy JS project kind detector module is untyped in the current TypeScript setup.
import { ProjectKindDetector } from '../../lib/project_kind_detection.js';
const PROJECT_TEMPLATES = [
    { name: 'nodejs_api', description: 'Node.js API/Backend Service' },
    { name: 'react_spa', description: 'React Single Page Application' },
    { name: 'python_app', description: 'Python Application' },
    { name: 'shell_script_automation', description: 'Shell Script Automation' },
    { name: 'static_website', description: 'Static Website (HTML/CSS/JS)' },
    { name: 'client_spa', description: 'Client-side SPA (vanilla JS)' },
    { name: 'configuration_library', description: 'Configuration Library' },
    { name: 'generic', description: 'Generic Project' },
];
const TECH_STACK_DEFAULTS = {
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
const STRUCTURE_DEFAULTS = {
    javascript: { source_dirs: ['src'], test_dirs: ['test', '__tests__'], docs_dirs: ['docs'] },
    typescript: { source_dirs: ['src'], test_dirs: ['test', '__tests__'], docs_dirs: ['docs'] },
    python: { source_dirs: ['src'], test_dirs: ['tests'], docs_dirs: ['docs'] },
    go: { source_dirs: ['cmd', 'internal', 'pkg'], test_dirs: ['.'], docs_dirs: ['docs'] },
    java: { source_dirs: ['src/main/java'], test_dirs: ['src/test/java'], docs_dirs: ['docs'] },
    ruby: { source_dirs: ['lib'], test_dirs: ['spec'], docs_dirs: ['docs'] },
    rust: { source_dirs: ['src'], test_dirs: ['tests'], docs_dirs: ['docs'] },
    bash: { source_dirs: ['bin', 'lib'], test_dirs: ['tests'], docs_dirs: ['docs'] },
};
function getErrorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
function splitDirectoryInput(value) {
    return value.split(/\s+/).filter(Boolean);
}
// ============================================================================
// PURE FUNCTIONS - Template Generation
// ============================================================================
/**
 * Get available project templates.
 * @pure
 */
export function getProjectTemplates() {
    return PROJECT_TEMPLATES;
}
/**
 * Validate init options.
 * @pure
 */
export function validateInitOptions(options) {
    const errors = [];
    if (options.template) {
        const validTemplates = getProjectTemplates().map((template) => template.name);
        if (!validTemplates.includes(options.template)) {
            errors.push(`Invalid template: ${options.template}. Valid templates: ${validTemplates.join(', ')}`);
        }
    }
    return {
        isValid: errors.length === 0,
        errors,
    };
}
/**
 * Get language-specific tech stack defaults.
 * @pure
 */
export function generateTechStackDefaults(language) {
    return (TECH_STACK_DEFAULTS[language] || {
        build_system: 'none',
        test_framework: null,
        test_command: '',
        lint_command: '',
    });
}
/**
 * Get language-specific directory structure defaults.
 * @pure
 */
export function generateStructureDefaults(language) {
    return (STRUCTURE_DEFAULTS[language] || {
        source_dirs: ['src'],
        test_dirs: ['tests'],
        docs_dirs: ['docs'],
    });
}
/**
 * Generate YAML preview of configuration.
 * @pure
 */
export function formatConfigPreview(config) {
    try {
        return yaml.dump(config, { indent: 2, lineWidth: 80 });
    }
    catch {
        return JSON.stringify(config, null, 2);
    }
}
/**
 * Generate configuration template (enhanced).
 * Merges base config with tech stack and structure sections.
 * @pure
 */
export function generateConfigTemplate(answers) {
    const { projectName, projectKind, primaryLanguage, description, buildSystem, testFramework, testCommand, lintCommand, sourceDirs, testDirs, docsDirs, } = answers;
    return {
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
}
// ============================================================================
// IMPURE WRAPPER - Command Execution
// ============================================================================
/**
 * Auto-detect project tech stack and kind.
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
    }
    catch {
        return { techStack: null, kindResult: null };
    }
}
/**
 * Prompt user for configuration.
 */
async function promptForConfiguration(options, detected = { techStack: null, kindResult: null }) {
    const templates = getProjectTemplates();
    const { techStack, kindResult } = detected;
    // Derive defaults from detection
    const detectedKind = kindResult?.kind || 'generic';
    const detectedLang = techStack?.primary_language || 'javascript';
    // If template specified, use it directly
    if (options.template && !options.interactive) {
        const template = templates.find((templateOption) => templateOption.name === options.template);
        const language = template.name.includes('nodejs')
            ? 'javascript'
            : template.name.includes('python')
                ? 'python'
                : template.name.includes('shell')
                    ? 'bash'
                    : 'javascript';
        const defaults = generateTechStackDefaults(language);
        const structure = generateStructureDefaults(language);
        return {
            projectName: options.name || 'my-project',
            projectKind: options.template,
            primaryLanguage: language,
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
            choices: templates.map((template) => ({
                name: `${template.name} - ${template.description}`,
                value: template.name,
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
    const language = infoAnswers.primaryLanguage;
    const languageDefaults = generateTechStackDefaults(language);
    const languageStructure = generateStructureDefaults(language);
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
            default: techStack?.test_command || languageDefaults.test_command,
        },
        {
            type: 'input',
            name: 'lintCommand',
            message: 'Lint command (optional):',
            default: languageDefaults.lint_command,
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
            default: languageStructure.source_dirs.join(' '),
        },
        {
            type: 'input',
            name: 'testDirsInput',
            message: 'Test directories (space-separated):',
            default: languageStructure.test_dirs.join(' '),
        },
        {
            type: 'input',
            name: 'docsDirsInput',
            message: 'Documentation directories (space-separated):',
            default: languageStructure.docs_dirs.join(' '),
        },
    ];
    const structureAnswers = await inquirer.prompt(structureQuestions);
    return {
        ...infoAnswers,
        buildSystem: techStack?.build_system || languageDefaults.build_system,
        testFramework: techStack?.test_framework || languageDefaults.test_framework,
        testCommand: commandAnswers.testCommand,
        lintCommand: commandAnswers.lintCommand,
        sourceDirs: splitDirectoryInput(structureAnswers.sourceDirsInput),
        testDirs: splitDirectoryInput(structureAnswers.testDirsInput),
        docsDirs: splitDirectoryInput(structureAnswers.docsDirsInput),
    };
}
/**
 * Create workflow directories.
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
    for (const directory of directories) {
        await fileOps.createDirectory(path.join(projectRoot, directory), { recursive: true });
    }
}
/**
 * Execute the init command (equivalent to shell --init-config wizard).
 */
export async function initCommand(options) {
    try {
        // Validate options
        const validation = validateInitOptions(options);
        if (!validation.isValid) {
            logger.error(chalk.red('Invalid options:'));
            validation.errors.forEach((error) => logger.error(chalk.red(`  - ${error}`)));
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
            const language = detected.techStack.primary_language;
            const kind = detected.kindResult?.kind || 'generic';
            const confidence = detected.kindResult?.confidence || 0;
            console.log(chalk.green('✓ Detection complete'));
            console.log();
            if (language)
                console.log(`  Detected language:  ${chalk.bold(language)}`);
            if (detected.techStack.build_system) {
                console.log(`  Build system:       ${detected.techStack.build_system}`);
            }
            if (detected.techStack.test_framework) {
                console.log(`  Test framework:     ${detected.techStack.test_framework}`);
            }
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
        const yamlContent = yaml.dump(config, { lineWidth: -1, noRefs: true });
        await fileOps.writeFile(configPath, yamlContent);
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
        console.log(chalk.white('  2. Run quick validation: ') + chalk.gray('ai-workflow run --stage quick'));
        console.log(chalk.white('  3. Run full workflow:   ') + chalk.gray('ai-workflow run'));
        console.log();
        process.exit(0);
    }
    catch (error) {
        logger.error(chalk.red(`Error: ${getErrorMessage(error)}`));
        if (options.verbose && error instanceof Error && error.stack) {
            logger.error(chalk.gray(error.stack));
        }
        process.exit(1);
    }
}
const initModule = {
    initCommand,
    getProjectTemplates,
    generateConfigTemplate,
    validateInitOptions,
    generateTechStackDefaults,
    generateStructureDefaults,
    formatConfigPreview,
};
export default initModule;
