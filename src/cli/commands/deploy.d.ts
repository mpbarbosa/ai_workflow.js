/**
 * @fileoverview CLI Deploy Command
 * @module cli/commands/deploy
 *
 * Implements the 'deploy' command for executing project-defined deployment scripts.
 * Reads deployment configuration from .workflow-config.yaml and executes the
 * project-specific deploy script or command.
 *
 * Architecture: v2.0.0 Pattern
 * - Pure functions for validation and configuration
 * - Impure wrapper for execution
 *
 * @version 1.0.0
 * @since 2026-02-27
 */
export interface DeployCommandOptions {
    config?: string;
    dryRun?: boolean;
    projectRoot?: string;
    source?: string;
    verbose?: boolean;
}
export interface DeployValidationResult {
    isValid: boolean;
    errors: string[];
}
export interface DeployCommandResult {
    success?: boolean;
    skipped?: boolean;
    reason?: string;
    error?: string;
    duration?: number;
}
export interface BuildDeployCommandResult {
    command: string;
    cwd: string;
}
export interface PromptMergeStep {
    description: string;
    command: string;
    cwd: string;
    outputPath: string;
}
export interface AlreadyDeployedResult {
    message: string;
    hint: string;
}
export interface NpmPublishErrorHint {
    message: string;
    hint: string;
    url: string | null;
}
export interface MissingNpmTokenPreflight {
    message: string;
    hint: string;
    source: 'command' | 'script';
}
export type DeploymentEnv = Record<string, string | undefined>;
export interface RawCdnFallbackSection {
    script?: unknown;
    command?: unknown;
    description?: unknown;
    args?: unknown;
    env?: unknown;
}
export interface RawDeploySection {
    enabled?: unknown;
    script?: unknown;
    command?: unknown;
    description?: unknown;
    args?: unknown;
    cdn_fallback?: unknown;
}
export interface WorkflowConfigRecord {
    deploy?: unknown;
    [key: string]: unknown;
}
export interface DeploymentExecutionConfig {
    script: string | null;
    command: string | null;
    description: string;
    args: string | null;
    enabled: true;
}
export interface CdnFallbackConfig extends DeploymentExecutionConfig {
    env: DeploymentEnv;
}
export interface ResolvedDeployConfig extends DeploymentExecutionConfig {
    cdnFallback: CdnFallbackConfig | null;
}
/**
 * Validate deploy command options.
 * @pure
 */
export declare function validateDeployOptions(options: DeployCommandOptions): DeployValidationResult;
/**
 * Resolve deploy configuration from the workflow config object.
 * @pure
 */
export declare function resolveDeployConfig(workflowConfig: unknown): {
    config: ResolvedDeployConfig | null;
    error: string | null;
};
/**
 * Build the shell command string to execute for deployment.
 * @pure
 */
export declare function buildDeployCommand(deployConfig: DeploymentExecutionConfig, projectRoot: string, extraArgs?: string | null): BuildDeployCommandResult;
/**
 * Resolve the ai_workflow.js prompt-merge preflight step when the project embeds
 * split prompt sources under `.workflow_core/config/ai_helpers/`.
 *
 * The deploy flow should regenerate the merged `ai_helpers.yaml` artifact before
 * executing the actual deployment so released prompt assets stay in sync with the
 * authoritative sub-files.
 *
 * @pure
 */
export declare function resolvePromptMergeStep(projectRoot: string, existsFn?: (candidatePath: string) => boolean): PromptMergeStep | null;
/**
 * Parse a .env file's text content into a key/value object.
 * Skips blank lines and lines starting with #.
 * Values may optionally be quoted with single or double quotes.
 * @pure
 */
export declare function parseEnvFile(content: string): DeploymentEnv;
/**
 * Format deploy result for display.
 * @pure
 */
export declare function formatDeployResult(result: DeployCommandResult | null | undefined): string;
/**
 * Detect whether the deployment script reported that the artifact (e.g. git tag,
 * npm version, CDN asset) already exists, making the deploy a no-op.
 *
 * Convention: deploy scripts signal this condition with exit code 3.
 * Output patterns are checked as a secondary heuristic for scripts that do not
 * follow the exit-code convention but still print recognisable messages.
 *
 * @pure
 */
export declare function detectAlreadyDeployedError(exitCode: number | null | undefined, output?: string): AlreadyDeployedResult | null;
/**
 * Parse the optional `cdn_fallback` sub-section from the raw deploy config section.
 * The fallback inherits `script`, `command`, and `args` from the parent deploy section
 * when those keys are not explicitly overridden in the sub-section.
 * Returns null when no `cdn_fallback` key is present.
 * @pure
 */
export declare function resolveCdnFallbackConfig(deploySection: RawDeploySection | null | undefined): CdnFallbackConfig | null;
/**
 * Return true when NPM_TOKEN is set and non-empty in the given environment object.
 * @pure
 */
export declare function hasNpmToken(env: unknown): boolean;
/**
 * Detect whether a deploy command or script text explicitly depends on NPM_TOKEN.
 * This is used as a conservative preflight guard so ai-workflow can fail fast
 * with a clear message before invoking a project script that would immediately
 * abort for the same reason.
 *
 * @pure
 */
export declare function referencesNpmToken(text: string | null | undefined): boolean;
/**
 * Resolve a preflight failure when the configured deploy entry explicitly
 * requires NPM_TOKEN but the effective environment does not provide one.
 *
 * Returns null when the token is present or when the deploy configuration does
 * not visibly depend on NPM_TOKEN, allowing non-npm deploy scripts to proceed.
 */
export declare function resolveMissingNpmTokenPreflight(deployConfig: DeploymentExecutionConfig | null | undefined, projectRoot: string, deployEnv: unknown, readFileFn?: (candidatePath: string) => string, existsFn?: (candidatePath: string) => boolean): MissingNpmTokenPreflight | null;
/**
 * Determine whether the CDN-only fallback path should be taken instead of the
 * primary deployment. Returns true when a CDN fallback is configured AND the npm
 * token is absent from the effective deployment environment.
 * @pure
 */
export declare function shouldUseCdnFallback(cdnFallbackConfig: CdnFallbackConfig | null, deployEnv: unknown): boolean;
/**
 * Detect well-known npm publish errors from captured output and return
 * a structured hint object, or null when no known pattern is matched.
 * @pure
 */
export declare function detectNpmPublishError(output: string | null | undefined): NpmPublishErrorHint | null;
/**
 * Execute the deploy command.
 */
export declare function deployCommand(options?: DeployCommandOptions): Promise<void>;
declare const deployCommandModule: {
    deployCommand: typeof deployCommand;
    validateDeployOptions: typeof validateDeployOptions;
    resolveDeployConfig: typeof resolveDeployConfig;
    buildDeployCommand: typeof buildDeployCommand;
    resolvePromptMergeStep: typeof resolvePromptMergeStep;
    formatDeployResult: typeof formatDeployResult;
    detectAlreadyDeployedError: typeof detectAlreadyDeployedError;
    detectNpmPublishError: typeof detectNpmPublishError;
    parseEnvFile: typeof parseEnvFile;
    resolveCdnFallbackConfig: typeof resolveCdnFallbackConfig;
    hasNpmToken: typeof hasNpmToken;
    referencesNpmToken: typeof referencesNpmToken;
    resolveMissingNpmTokenPreflight: typeof resolveMissingNpmTokenPreflight;
    shouldUseCdnFallback: typeof shouldUseCdnFallback;
};
export { deployCommandModule };
export default deployCommandModule;
//# sourceMappingURL=deploy.d.ts.map