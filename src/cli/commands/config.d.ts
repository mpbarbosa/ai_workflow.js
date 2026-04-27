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
export type ConfigAction = 'show' | 'validate' | 'get' | 'set';
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
};
export { configCommandModule };
export default configCommandModule;
//# sourceMappingURL=config.d.ts.map