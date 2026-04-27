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

import * as fs from 'node:fs';
import * as path from 'node:path';
import chalk from 'chalk';
// @ts-expect-error - js-yaml does not ship types in the current TypeScript setup.
import yaml from 'js-yaml';
import { logger } from '../../core/logger.js';
// @ts-expect-error - legacy JS executor module is untyped in the current TypeScript setup.
import { executeStream } from '../../core/executor.js';

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

interface CommandExecutionErrorDetails {
  message: string;
  stderr?: string;
  exitCode: number | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getStringValue(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function getOptionalStringValue(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return typeof value === 'string' ? value : String(value);
}

function getEnvironmentMap(value: unknown): DeploymentEnv {
  if (!isRecord(value)) {
    return {};
  }

  const env: DeploymentEnv = {};
  for (const [key, envValue] of Object.entries(value)) {
    if (typeof envValue === 'string' || envValue === undefined) {
      env[key] = envValue;
    } else if (envValue !== null) {
      env[key] = String(envValue);
    }
  }

  return env;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function getCommandExecutionErrorDetails(error: unknown): CommandExecutionErrorDetails {
  if (error instanceof Error) {
    const candidate = error as Error & { stderr?: unknown; exitCode?: unknown };
    return {
      message: error.message,
      stderr: typeof candidate.stderr === 'string' ? candidate.stderr : undefined,
      exitCode: typeof candidate.exitCode === 'number' ? candidate.exitCode : null,
    };
  }

  return {
    message: String(error),
    exitCode: null,
  };
}

// ============================================================================
// PURE FUNCTIONS - Command Logic
// ============================================================================

/**
 * Validate deploy command options.
 * @pure
 */
export function validateDeployOptions(options: DeployCommandOptions): DeployValidationResult {
  const errors: string[] = [];

  if (options.projectRoot && typeof options.projectRoot !== 'string') {
    errors.push('Project root must be a string');
  }

  if (options.config && typeof options.config !== 'string') {
    errors.push('Config path must be a string');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Resolve deploy configuration from the workflow config object.
 * @pure
 */
export function resolveDeployConfig(workflowConfig: unknown): {
  config: ResolvedDeployConfig | null;
  error: string | null;
} {
  if (!isRecord(workflowConfig)) {
    return { config: null, error: 'Invalid workflow configuration' };
  }

  const deploySectionValue = workflowConfig.deploy;

  if (!deploySectionValue) {
    return {
      config: null,
      error:
        'No deploy: section found in .workflow-config.yaml. Add a deploy: section to enable deployment.',
    };
  }

  if (!isRecord(deploySectionValue)) {
    return {
      config: null,
      error: 'deploy: section must specify either script: or command:',
    };
  }

  const deploySection = deploySectionValue as RawDeploySection;

  if (deploySection.enabled === false) {
    return {
      config: null,
      error: 'Deployment is disabled (enabled: false) in .workflow-config.yaml',
    };
  }

  const script = getStringValue(deploySection.script);
  const command = getStringValue(deploySection.command);

  if (!script && !command) {
    return {
      config: null,
      error: 'deploy: section must specify either script: or command:',
    };
  }

  return {
    config: {
      script,
      command,
      description: getStringValue(deploySection.description) || 'Deploy project',
      args: getOptionalStringValue(deploySection.args),
      enabled: true,
      cdnFallback: resolveCdnFallbackConfig(deploySection),
    },
    error: null,
  };
}

/**
 * Build the shell command string to execute for deployment.
 * @pure
 */
export function buildDeployCommand(
  deployConfig: DeploymentExecutionConfig,
  projectRoot: string,
  extraArgs: string | null = null
): BuildDeployCommandResult {
  if (!deployConfig || typeof deployConfig !== 'object') {
    throw new Error('deployConfig must be a valid object');
  }

  // CLI-supplied extraArgs take priority over YAML-configured args
  const resolvedArgs = extraArgs !== null ? extraArgs : deployConfig.args || '';
  const argsSuffix = resolvedArgs ? ` ${resolvedArgs}` : '';

  // script: takes priority over command:
  if (deployConfig.script) {
    const scriptPath = path.isAbsolute(deployConfig.script)
      ? deployConfig.script
      : path.join(projectRoot, deployConfig.script);
    return {
      command: `bash "${scriptPath}"${argsSuffix}`,
      cwd: projectRoot,
    };
  }

  return {
    command: `${deployConfig.command}${argsSuffix}`,
    cwd: projectRoot,
  };
}

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
export function resolvePromptMergeStep(
  projectRoot: string,
  existsFn: (candidatePath: string) => boolean = fs.existsSync
): PromptMergeStep | null {
  if (typeof projectRoot !== 'string' || projectRoot.trim() === '') {
    return null;
  }

  const candidateLayouts: PromptMergeStep[] = [
    {
      description: 'Merge prompt configuration',
      command: `python3 "${path.join(projectRoot, '.workflow_core', 'scripts', 'build_ai_helpers.py')}" --validate`,
      cwd: projectRoot,
      outputPath: path.join(projectRoot, '.workflow_core', 'config', 'ai_helpers.yaml'),
    },
    {
      description: 'Merge prompt configuration',
      command: `python3 "${path.join(projectRoot, 'scripts', 'build_ai_helpers.py')}" --validate`,
      cwd: projectRoot,
      outputPath: path.join(projectRoot, 'config', 'ai_helpers.yaml'),
    },
  ];

  const candidateFiles = [
    {
      scriptPath: path.join(projectRoot, '.workflow_core', 'scripts', 'build_ai_helpers.py'),
      indexPath: path.join(projectRoot, '.workflow_core', 'config', 'ai_helpers', 'index.yaml'),
      step: candidateLayouts[0],
    },
    {
      scriptPath: path.join(projectRoot, 'scripts', 'build_ai_helpers.py'),
      indexPath: path.join(projectRoot, 'config', 'ai_helpers', 'index.yaml'),
      step: candidateLayouts[1],
    },
  ];

  for (const candidate of candidateFiles) {
    if (!existsFn(candidate.scriptPath) || !existsFn(candidate.indexPath)) {
      continue;
    }

    return candidate.step;
  }

  return null;
}

/**
 * Parse a .env file's text content into a key/value object.
 * Skips blank lines and lines starting with #.
 * Values may optionally be quoted with single or double quotes.
 * @pure
 */
export function parseEnvFile(content: string): DeploymentEnv {
  if (!content || typeof content !== 'string') {
    return {};
  }

  const result: DeploymentEnv = {};

  for (const raw of content.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const eqIdx = line.indexOf('=');
    if (eqIdx < 1) {
      continue;
    }

    const key = line.slice(0, eqIdx).trim();
    let value = line.slice(eqIdx + 1).trim();

    // Strip surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key) {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Format deploy result for display.
 * @pure
 */
export function formatDeployResult(result: DeployCommandResult | null | undefined): string {
  if (!result) {
    return 'No result available';
  }

  if (result.skipped) {
    return `Deployment skipped: ${result.reason || 'No deployment action was taken'}`;
  }

  if (result.success) {
    const duration = result.duration ? ` in ${(result.duration / 1000).toFixed(1)}s` : '';
    return `Deployment completed successfully${duration}`;
  }

  return `Deployment failed: ${result.error || 'Unknown error'}`;
}

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
export function detectAlreadyDeployedError(
  exitCode: number | null | undefined,
  output = ''
): AlreadyDeployedResult | null {
  const alreadyExistsPatterns = [
    /already exists and is already delivered/i,
    /already published/i,
    /already deployed/i,
    /tag.*already/i,
    /cannot publish over/i,
  ];

  const isExitCode3 = exitCode === 3;
  const matchesOutput =
    typeof output === 'string' && alreadyExistsPatterns.some((re) => re.test(output));

  if (!isExitCode3 && !matchesOutput) {
    return null;
  }

  return {
    message: 'This version is already deployed — nothing to do.',
    hint: 'Bump the version before deploying if you want to release a new build.',
  };
}

/**
 * Parse the optional `cdn_fallback` sub-section from the raw deploy config section.
 * The fallback inherits `script`, `command`, and `args` from the parent deploy section
 * when those keys are not explicitly overridden in the sub-section.
 * Returns null when no `cdn_fallback` key is present.
 * @pure
 */
export function resolveCdnFallbackConfig(
  deploySection: RawDeploySection | null | undefined
): CdnFallbackConfig | null {
  if (!deploySection || !isRecord(deploySection.cdn_fallback)) {
    return null;
  }

  const fallback = deploySection.cdn_fallback as RawCdnFallbackSection;
  const script = Object.prototype.hasOwnProperty.call(fallback, 'script')
    ? getStringValue(fallback.script)
    : getStringValue(deploySection.script);
  const command = Object.prototype.hasOwnProperty.call(fallback, 'command')
    ? getStringValue(fallback.command)
    : getStringValue(deploySection.command);

  return {
    script,
    command,
    description:
      getStringValue(fallback.description) || 'Deploy to CDN only (npm publish skipped)',
    args: Object.prototype.hasOwnProperty.call(fallback, 'args')
      ? getOptionalStringValue(fallback.args)
      : getOptionalStringValue(deploySection.args),
    env: getEnvironmentMap(fallback.env),
    enabled: true,
  };
}

/**
 * Return true when NPM_TOKEN is set and non-empty in the given environment object.
 * @pure
 */
export function hasNpmToken(env: unknown): boolean {
  return (
    isRecord(env) &&
    typeof env.NPM_TOKEN === 'string' &&
    env.NPM_TOKEN.length > 0
  );
}

/**
 * Detect whether a deploy command or script text explicitly depends on NPM_TOKEN.
 * This is used as a conservative preflight guard so ai-workflow can fail fast
 * with a clear message before invoking a project script that would immediately
 * abort for the same reason.
 *
 * @pure
 */
export function referencesNpmToken(text: string | null | undefined): boolean {
  if (!text || typeof text !== 'string') {
    return false;
  }

  return /\bNPM_TOKEN\b/.test(text) || /npm Automation token/i.test(text);
}

/**
 * Resolve a preflight failure when the configured deploy entry explicitly
 * requires NPM_TOKEN but the effective environment does not provide one.
 *
 * Returns null when the token is present or when the deploy configuration does
 * not visibly depend on NPM_TOKEN, allowing non-npm deploy scripts to proceed.
 */
export function resolveMissingNpmTokenPreflight(
  deployConfig: DeploymentExecutionConfig | null | undefined,
  projectRoot: string,
  deployEnv: unknown,
  readFileFn: (candidatePath: string) => string = (candidatePath) =>
    fs.readFileSync(candidatePath, 'utf8'),
  existsFn: (candidatePath: string) => boolean = fs.existsSync
): MissingNpmTokenPreflight | null {
  if (!deployConfig || typeof deployConfig !== 'object') {
    return null;
  }

  if (typeof projectRoot !== 'string' || projectRoot.trim() === '') {
    return null;
  }

  if (hasNpmToken(deployEnv)) {
    return null;
  }

  if (referencesNpmToken(deployConfig.command)) {
    return {
      message: 'Deployment requires NPM_TOKEN, but it is not set.',
      hint: 'Set NPM_TOKEN to an npm Automation token before deploying.',
      source: 'command',
    };
  }

  if (!deployConfig.script || typeof deployConfig.script !== 'string') {
    return null;
  }

  const scriptPath = path.isAbsolute(deployConfig.script)
    ? deployConfig.script
    : path.join(projectRoot, deployConfig.script);

  if (!existsFn(scriptPath)) {
    return null;
  }

  try {
    const scriptContent = readFileFn(scriptPath);
    if (!referencesNpmToken(scriptContent)) {
      return null;
    }
  } catch {
    return null;
  }

  return {
    message: 'Deployment requires NPM_TOKEN, but it is not set.',
    hint: 'Set NPM_TOKEN to an npm Automation token before deploying.',
    source: 'script',
  };
}

/**
 * Determine whether the CDN-only fallback path should be taken instead of the
 * primary deployment. Returns true when a CDN fallback is configured AND the npm
 * token is absent from the effective deployment environment.
 * @pure
 */
export function shouldUseCdnFallback(
  cdnFallbackConfig: CdnFallbackConfig | null,
  deployEnv: unknown
): boolean {
  return cdnFallbackConfig !== null && !hasNpmToken(deployEnv);
}

/**
 * Detect well-known npm publish errors from captured output and return
 * a structured hint object, or null when no known pattern is matched.
 * @pure
 */
export function detectNpmPublishError(output: string | null | undefined): NpmPublishErrorHint | null {
  if (!output || typeof output !== 'string') {
    return null;
  }

  // Missing token detected by the deploy script before calling npm
  if (/NPM_TOKEN is not set/i.test(output) || /\bNPM_TOKEN\b.*\bnot set\b/i.test(output)) {
    return {
      message: 'npm publish failed: NPM_TOKEN environment variable is not set.',
      hint: 'Create an Automation token at npmjs.com and set it with: export NPM_TOKEN=npm_...',
      url: 'https://www.npmjs.com/settings/~/tokens',
    };
  }

  // 403 Forbidden — invalid / expired / missing token
  if (/npm error code E403/i.test(output) || /403 Forbidden/i.test(output)) {
    const isCredentials =
      /credentials/i.test(output) ||
      /token/i.test(output) ||
      /You may not perform that action/i.test(output);

    if (isCredentials) {
      return {
        message: 'npm publish failed: invalid or expired token.',
        hint: 'Verify NPM_TOKEN is a valid Automation token with publish rights.',
        url: 'https://www.npmjs.com/settings/~/tokens',
      };
    }

    return {
      message: 'npm publish failed: access forbidden (E403).',
      hint: 'Check that your npm token has publish rights for this package.',
      url: 'https://docs.npmjs.com/creating-and-viewing-access-tokens',
    };
  }

  // 401 Unauthenticated
  if (/npm error code E401/i.test(output) || /401 Unauthorized/i.test(output)) {
    return {
      message: 'npm publish failed: authentication required (E401).',
      hint: 'Set a valid NPM_TOKEN environment variable or run `npm login`.',
      url: 'https://docs.npmjs.com/creating-and-viewing-access-tokens',
    };
  }

  // 409 Conflict — version already published
  if (
    /npm error code E409/i.test(output) ||
    /409 Conflict/i.test(output) ||
    /cannot publish over/i.test(output)
  ) {
    return {
      message: 'npm publish failed: this version is already published (E409).',
      hint: 'Bump the version in package.json before publishing.',
      url: null,
    };
  }

  // ENEEDAUTH — no credentials at all
  if (/npm error code ENEEDAUTH/i.test(output)) {
    return {
      message: 'npm publish failed: no npm credentials found (ENEEDAUTH).',
      hint: 'Run `npm login` or set the NPM_TOKEN environment variable.',
      url: 'https://docs.npmjs.com/creating-and-viewing-access-tokens',
    };
  }

  // 404 Not Found — org/scope doesn't exist
  if (/npm error code E404/i.test(output)) {
    return {
      message: 'npm publish failed: package or scope not found (E404).',
      hint: 'Ensure the npm organization/scope exists and the package name is correct.',
      url: null,
    };
  }

  return null;
}

// ============================================================================
// IMPURE WRAPPER - Deploy Action
// ============================================================================

/**
 * Execute the deploy command.
 */
export async function deployCommand(options: DeployCommandOptions = {}): Promise<void> {
  const projectRoot = options.projectRoot ? path.resolve(options.projectRoot) : process.cwd();

  const configPath = options.config
    ? path.isAbsolute(options.config)
      ? options.config
      : path.join(projectRoot, options.config)
    : path.join(projectRoot, '.workflow-config.yaml');

  // Validate options
  const validation = validateDeployOptions(options);
  if (!validation.isValid) {
    logger.error(chalk.red('Invalid options:'));
    validation.errors.forEach((validationError) =>
      logger.error(chalk.red(`  • ${validationError}`))
    );
    process.exit(1);
  }

  // Load workflow config
  if (!fs.existsSync(configPath)) {
    logger.error(chalk.red(`Configuration file not found: ${configPath}`));
    logger.error(chalk.gray('  Run `ai-workflow init` to create a configuration file.'));
    process.exit(1);
  }

  let workflowConfig: unknown;

  try {
    const rawYaml = fs.readFileSync(configPath, 'utf8');
    workflowConfig = yaml.load(rawYaml);
  } catch (error) {
    logger.error(chalk.red(`Failed to parse configuration: ${getErrorMessage(error)}`));
    process.exit(1);
  }

  // Resolve deploy configuration
  const { config: deployConfig, error: deployError } = resolveDeployConfig(workflowConfig);
  if (deployError || deployConfig === null) {
    logger.error(chalk.red(`Deploy configuration error: ${deployError}`));
    process.exit(1);
  }

  // Load .env file from project root (if present) and merge into environment.
  // Must happen before the CDN fallback check so NPM_TOKEN presence can be inspected.
  const envFilePath = path.join(projectRoot, '.env');
  let deployEnv: DeploymentEnv = { ...process.env };

  if (fs.existsSync(envFilePath)) {
    try {
      const envContent = fs.readFileSync(envFilePath, 'utf8');
      const fileVars = parseEnvFile(envContent);
      const fileVarCount = Object.keys(fileVars).length;
      deployEnv = { ...deployEnv, ...fileVars };

      if (options.verbose && fileVarCount > 0) {
        console.log(chalk.gray(`   Loaded ${fileVarCount} variable(s) from ${envFilePath}`));
        console.log();
      }
    } catch (error) {
      logger.warn(chalk.yellow(`Warning: failed to read ${envFilePath}: ${getErrorMessage(error)}`));
    }
  }

  // CDN fallback: when NPM_TOKEN is absent and a cdn_fallback is configured, use it
  // instead of the primary deploy config so npm publish is never attempted.
  let activeDeployConfig: DeploymentExecutionConfig | CdnFallbackConfig = deployConfig;
  const cdnFallbackConfig = deployConfig.cdnFallback;
  let usingCdnFallback = false;

  if (cdnFallbackConfig && shouldUseCdnFallback(cdnFallbackConfig, deployEnv)) {
    const fallbackConfig = cdnFallbackConfig;
    usingCdnFallback = true;
    activeDeployConfig = fallbackConfig;

    // Merge any extra env vars declared inside cdn_fallback.env
    if (fallbackConfig.env && Object.keys(fallbackConfig.env).length > 0) {
      deployEnv = { ...deployEnv, ...fallbackConfig.env };
    }
  }

  const promptMergeStep = resolvePromptMergeStep(projectRoot);

  // Build the command
  const extraArgs = options.source ? `--source ${options.source}` : null;
  const { command, cwd } = buildDeployCommand(activeDeployConfig, projectRoot, extraArgs);

  console.log();

  if (promptMergeStep) {
    console.log(chalk.cyan(`🧩 ${promptMergeStep.description}`));
    console.log(chalk.gray(`   Command: ${promptMergeStep.command}`));
    console.log(chalk.gray(`   Output: ${promptMergeStep.outputPath}`));
    console.log();
  }

  console.log(chalk.cyan(`📦 ${activeDeployConfig.description}`));

  if (usingCdnFallback) {
    console.log(
      chalk.yellow('⚠ NPM_TOKEN not set – delivering via CDN only (npm publish skipped)')
    );
    console.log(chalk.gray('  Set NPM_TOKEN to also publish to npm.'));
  }

  console.log(chalk.gray(`   Command: ${command}`));
  console.log(chalk.gray(`   Working directory: ${cwd}`));
  console.log();

  // Dry-run: just print what would run
  if (options.dryRun) {
    console.log(chalk.yellow('⚠ Dry-run mode: command not executed'));
    process.exit(0);
  }

  if (promptMergeStep) {
    const promptMergeOutput: string[] = [];

    try {
      await executeStream(promptMergeStep.command, {
        cwd: promptMergeStep.cwd,
        env: deployEnv,
        onStdout: (line: string) => {
          promptMergeOutput.push(line);
          process.stdout.write(line);
        },
        onStderr: (line: string) => {
          promptMergeOutput.push(line);
          process.stderr.write(chalk.yellow(line));
        },
      });

      console.log(chalk.green('✓ Prompt merge complete'));
      console.log();
    } catch (error) {
      const executionError = getCommandExecutionErrorDetails(error);
      const capturedOutput = promptMergeOutput.join('');

      console.log(chalk.red(`✗ Prompt merge failed: ${executionError.message}`));

      if (executionError.stderr) {
        console.log(chalk.gray(executionError.stderr));
      } else if (!options.verbose && capturedOutput.trim()) {
        const lines = capturedOutput.trim().split('\n');
        console.log(chalk.gray(lines.slice(-5).join('\n')));
      }

      console.log();
      process.exit(1);
    }
  }

  const missingTokenPreflight = usingCdnFallback
    ? null
    : resolveMissingNpmTokenPreflight(activeDeployConfig, projectRoot, deployEnv);

  if (missingTokenPreflight) {
    const skipMessage = formatDeployResult({
      success: true,
      skipped: true,
      reason: missingTokenPreflight.message,
    });

    console.log(chalk.yellow(`⚠ ${skipMessage}`));
    console.log(chalk.yellow(`  ${missingTokenPreflight.hint}`));

    if (cdnFallbackConfig === null) {
      console.log(
        chalk.yellow(
          '  Tip: add a cdn_fallback: section in .workflow-config.yaml to deliver via CDN when NPM_TOKEN is absent.'
        )
      );
    }

    console.log();
    process.exit(0);
  }

  // Execute deployment
  const startTime = Date.now();

  // Buffer all output so we can analyse it for known errors on failure
  const outputBuffer: string[] = [];

  try {
    await executeStream(command, {
      cwd,
      env: deployEnv,
      onStdout: (line: string) => {
        outputBuffer.push(line);
        process.stdout.write(line);
      },
      onStderr: (line: string) => {
        outputBuffer.push(line);
        process.stderr.write(chalk.yellow(line));
      },
    });

    const duration = Date.now() - startTime;
    const resultMessage = formatDeployResult({ success: true, duration });

    console.log(chalk.green(`✓ ${resultMessage}`));
    console.log();

    process.exit(0);
  } catch (error) {
    const executionError = getCommandExecutionErrorDetails(error);
    const duration = Date.now() - startTime;
    const capturedOutput = outputBuffer.join('');

    // Idempotency: if the artifact already exists this run is a no-op, not a failure.
    const alreadyDeployed = detectAlreadyDeployedError(executionError.exitCode, capturedOutput);
    if (alreadyDeployed) {
      console.log(chalk.yellow(`⚠ ${alreadyDeployed.message}`));
      console.log(chalk.gray(`  ${alreadyDeployed.hint}`));
      console.log();
      process.exit(0);
    }

    const npmError = detectNpmPublishError(capturedOutput);

    if (npmError) {
      // If npm token is missing and a CDN fallback is configured but we somehow
      // ended up in the primary path, suggest configuring cdn_fallback.
      if (!usingCdnFallback && cdnFallbackConfig === null && /NPM_TOKEN/i.test(capturedOutput)) {
        console.log(
          chalk.yellow(
            '  Tip: add a cdn_fallback: section in .workflow-config.yaml to deliver via CDN when NPM_TOKEN is absent.'
          )
        );
        console.log();
      }

      console.log(chalk.red(`✗ ${npmError.message}`));
      console.log(chalk.yellow(`  ${npmError.hint}`));

      if (npmError.url) {
        console.log(chalk.gray(`  ${npmError.url}`));
      }
    } else {
      const resultMessage = formatDeployResult({
        success: false,
        error: executionError.message,
        duration,
      });

      console.log(chalk.red(`✗ ${resultMessage}`));

      if (executionError.stderr) {
        console.log(chalk.gray(executionError.stderr));
      } else if (!options.verbose && capturedOutput.trim()) {
        // Surface the last few lines of captured output to help diagnose the failure
        const lines = capturedOutput.trim().split('\n');
        const tail = lines.slice(-5).join('\n');
        console.log(chalk.gray(tail));
      }
    }

    console.log();
    process.exit(1);
  }
}

const deployCommandModule = {
  deployCommand,
  validateDeployOptions,
  resolveDeployConfig,
  buildDeployCommand,
  resolvePromptMergeStep,
  formatDeployResult,
  detectAlreadyDeployedError,
  detectNpmPublishError,
  parseEnvFile,
  resolveCdnFallbackConfig,
  hasNpmToken,
  referencesNpmToken,
  resolveMissingNpmTokenPreflight,
  shouldUseCdnFallback,
};

export { deployCommandModule };

export default deployCommandModule;
