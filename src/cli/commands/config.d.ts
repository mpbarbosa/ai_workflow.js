/**
 * @fileoverview CLI Config Command
 * @module cli/commands/config
 *
 * Implements the 'config' command for managing workflow configuration.
 *
 * Architecture: v2.0.0 Pattern
 * - Pure functions for config operations
 * - Impure wrapper for file I/O
 *
 * @version 1.0.0
 * @since 2026-02-10
 */
export type ConfigAction = 'show' | 'validate' | 'get' | 'set' | 'fix-deps';
export type FixDepsMode = 'comment' | 'restore' | 'remove-disabled';
export interface ConfigCommandValidationResult {
    isValid: boolean;
    errors: string[];
    action: string;
}
export interface ConfigValidationIssue {
    path?: string;
    message: string;
}
export interface ConfigCommandOptions {
    config?: string;
    verbose?: boolean;
    mode?: FixDepsMode;
    dryRun?: boolean;
}
export type ConfigValue = string | number | boolean | null | ConfigRecord | ConfigValue[];
export interface ConfigRecord {
    [key: string]: ConfigValue | undefined;
}
export interface WorkflowConfigManager {
    configPath: string;
    getAll(): ConfigRecord;
    validate(): {
        isValid: boolean;
        errors: ConfigValidationIssue[];
    };
    set(key: string, value: ConfigValue): void;
}
/**
 * Validate config command action.
 */
export declare function validateConfigAction(action: string, args: string[]): ConfigCommandValidationResult;
interface WorkflowStep {
    id?: string;
    enabled?: boolean;
    dependencies?: string[];
    dependency_comment?: string;
    [key: string]: unknown;
}
interface WorkflowConfig {
    workflow?: {
        steps?: WorkflowStep[];
        [key: string]: unknown;
    };
    [key: string]: unknown;
}
interface FixDepChange {
    stepId: string;
    severity: string;
    description: string;
}
/**
 * Build the canonical dependency map from the step catalog.
 */
export declare function buildCanonicalDepMap(): Map<string, string[]>;
/**
 * Compute the set of changes fix-deps would apply without mutating the config.
 */
export declare function computeFixDepsChanges(config: WorkflowConfig, mode: FixDepsMode): FixDepChange[];
/**
 * Apply fix-deps changes to the parsed config object in place.
 */
export declare function applyFixDepsChanges(config: WorkflowConfig, mode: FixDepsMode, canonicalDepMap: Map<string, string[]>): number;
/**
 * Get nested config value by key path.
 */
export declare function getConfigValue<T = ConfigValue>(config: ConfigRecord | null | undefined, keyPath: string): T | undefined;
/**
 * Format config value for display.
 */
export declare function formatConfigValue(value: ConfigValue | undefined): string;
/**
 * Format validation errors.
 */
export declare function formatValidationErrors(errors: ConfigValidationIssue[] | string[] | null | undefined): string;
/**
 * Execute the config command.
 */
export declare function configCommand(action: string, args: string[], options: ConfigCommandOptions): Promise<void>;
declare const configCommandModule: {
    configCommand: typeof configCommand;
    validateConfigAction: typeof validateConfigAction;
    getConfigValue: typeof getConfigValue;
    formatConfigValue: typeof formatConfigValue;
    formatValidationErrors: typeof formatValidationErrors;
    buildCanonicalDepMap: typeof buildCanonicalDepMap;
    computeFixDepsChanges: typeof computeFixDepsChanges;
    applyFixDepsChanges: typeof applyFixDepsChanges;
};
export { configCommandModule };
export default configCommandModule;
//# sourceMappingURL=config.d.ts.map