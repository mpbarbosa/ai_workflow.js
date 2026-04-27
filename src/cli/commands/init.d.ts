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
export interface ProjectTemplate {
    name: string;
    description: string;
}
export interface InitCommandOptions {
    color?: boolean;
    config?: string;
    description?: string;
    force?: boolean;
    interactive?: boolean;
    name?: string;
    projectRoot?: string;
    quiet?: boolean;
    template?: string;
    verbose?: boolean;
}
export interface InitValidationResult {
    isValid: boolean;
    errors: string[];
}
export interface TechStackDefaults {
    build_system: string;
    test_framework: string | null;
    test_command: string;
    lint_command: string;
}
export interface StructureDefaults {
    source_dirs: string[];
    test_dirs: string[];
    docs_dirs: string[];
}
export interface ProjectConfigSection {
    name: string;
    kind: string;
    primary_language: string;
    description: string;
}
export interface TechStackConfigSection {
    primary_language: string;
    build_system: string;
    test_framework: string | null;
    test_command: string;
    lint_command?: string;
}
export interface StructureConfigSection {
    source_dirs: string[];
    test_dirs: string[];
    docs_dirs: string[];
}
export interface WorkflowStageDefinition {
    enabled: boolean;
    steps: string[];
}
export interface WorkflowConfig {
    project: ProjectConfigSection;
    tech_stack: TechStackConfigSection;
    structure: StructureConfigSection;
    workflow: {
        stages: {
            quick: WorkflowStageDefinition;
            medium: WorkflowStageDefinition;
            full: WorkflowStageDefinition;
        };
    };
    validation: {
        documentation: {
            required: boolean;
            min_coverage: number;
        };
        testing: {
            required: boolean;
            min_coverage: number;
        };
    };
}
export interface InitAnswers {
    projectName: string;
    projectKind: string;
    primaryLanguage: string;
    description: string;
    buildSystem: string;
    testFramework: string | null;
    testCommand: string;
    lintCommand: string;
    sourceDirs: string[];
    testDirs: string[];
    docsDirs: string[];
}
export interface InfoPromptAnswers {
    projectName: string;
    projectKind: string;
    primaryLanguage: string;
    description: string;
}
export interface CommandPromptAnswers {
    testCommand: string;
    lintCommand: string;
}
export interface StructurePromptAnswers {
    sourceDirsInput: string;
    testDirsInput: string;
    docsDirsInput: string;
}
export interface DetectedTechStack {
    primary_language?: string | null;
    build_system?: string | null;
    test_framework?: string | null;
    test_command?: string | null;
}
export interface DetectedProjectKind {
    kind?: string | null;
    confidence?: number | null;
    indicators?: string[];
}
export interface DetectedProjectInfo {
    techStack: DetectedTechStack | null;
    kindResult: DetectedProjectKind | null;
}
export interface InitModuleExports {
    initCommand: typeof initCommand;
    getProjectTemplates: typeof getProjectTemplates;
    generateConfigTemplate: typeof generateConfigTemplate;
    validateInitOptions: typeof validateInitOptions;
    generateTechStackDefaults: typeof generateTechStackDefaults;
    generateStructureDefaults: typeof generateStructureDefaults;
    formatConfigPreview: typeof formatConfigPreview;
}
/**
 * Get available project templates.
 * @pure
 */
export declare function getProjectTemplates(): ProjectTemplate[];
/**
 * Validate init options.
 * @pure
 */
export declare function validateInitOptions(options: InitCommandOptions): InitValidationResult;
/**
 * Get language-specific tech stack defaults.
 * @pure
 */
export declare function generateTechStackDefaults(language: string): TechStackDefaults;
/**
 * Get language-specific directory structure defaults.
 * @pure
 */
export declare function generateStructureDefaults(language: string): StructureDefaults;
/**
 * Generate YAML preview of configuration.
 * @pure
 */
export declare function formatConfigPreview(config: WorkflowConfig): string;
/**
 * Generate configuration template (enhanced).
 * Merges base config with tech stack and structure sections.
 * @pure
 */
export declare function generateConfigTemplate(answers: InitAnswers): WorkflowConfig;
/**
 * Execute the init command (equivalent to shell --init-config wizard).
 */
export declare function initCommand(options: InitCommandOptions): Promise<void>;
declare const initModule: InitModuleExports;
export default initModule;
//# sourceMappingURL=init.d.ts.map