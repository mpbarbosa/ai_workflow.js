/**
 * @fileoverview CLI Fix Log Issues Command
 * @module cli/commands/fix_log_issues
 *
 * Implements the 'fix-log-issues' command: reads workflow log files,
 * batches them to fit within the model's token limit, sends each batch
 * to the AI in sequence (streaming output to the terminal), then merges
 * all partial plans into a single consolidated fix plan.
 *
 * Architecture: v2.0.0 Pattern
 * - Pure functions for option validation, path resolution, batching, and prompt building
 * - Impure wrapper for filesystem I/O, AI calls, streaming output
 *
 * @version 2.1.0
 * @since 2026-03-12
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import chalk from 'chalk';
import ora from 'ora';
import { logger } from '../../core/logger.js';
// @ts-expect-error - legacy JS module is untyped in the current TypeScript setup.
import { AiHelper } from '../../lib/ai_helpers.js';
// @ts-expect-error - legacy JS module is untyped in the current TypeScript setup.
import { discoverLogFilesAsync } from '../../lib/log_parser.js';
const DEFAULT_MODEL = 'gpt-4.1';
const DEFAULT_TOKEN_LIMIT = 64_000;
const CONTEXT_SAFETY_MARGIN = 0.85;
const CHARS_PER_TOKEN = 2.5;
const PROMPT_OVERHEAD_TOKENS = 600;
const STREAM_CHUNK_SIZE = 6;
const STREAM_DELAY_MS = 0;
/**
 * Approximate prompt-token context limits per known model.
 * We use 85% of the published limit to leave room for the system prompt
 * preamble, per-batch instructions, and completion tokens.
 */
export const MODEL_CONTEXT_LIMITS = {
    'gpt-4.1': 64_000,
    'gpt-5.1': 64_000,
    'gpt-5.1-codex': 64_000,
    'gpt-5.1-codex-mini': 64_000,
    'gpt-5.1-codex-max': 64_000,
    'gpt-5.2': 64_000,
    'gpt-5.2-codex': 64_000,
    'gpt-5.3-codex': 64_000,
    'gpt-5.4': 64_000,
    'gpt-5-mini': 64_000,
    'claude-sonnet-4.6': 200_000,
    'claude-sonnet-4.5': 200_000,
    'claude-haiku-4.5': 200_000,
    'claude-opus-4.6': 200_000,
    'claude-opus-4.6-fast': 200_000,
    'claude-opus-4.5': 200_000,
    'claude-sonnet-4': 200_000,
    'gemini-3-pro-preview': 128_000,
};
function getErrorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
function isLogEntry(entry) {
    return entry !== null;
}
/**
 * Estimate token count of a string using a conservative chars-per-token ratio.
 */
export function estimateTokenCount(text) {
    return Math.ceil(text.length / CHARS_PER_TOKEN);
}
/**
 * Compute the maximum body characters that fit in a single batch prompt
 * for the given model, after reserving overhead for instructions and completion.
 */
export function maxBodyCharsForModel(model) {
    const tokenLimit = MODEL_CONTEXT_LIMITS[model] ?? DEFAULT_TOKEN_LIMIT;
    const usableTokens = Math.floor(tokenLimit * CONTEXT_SAFETY_MARGIN) - PROMPT_OVERHEAD_TOKENS;
    return Math.floor(usableTokens * CHARS_PER_TOKEN);
}
/**
 * Validate fix-log-issues command options.
 */
export function validateFixLogOptions(options = {}) {
    const errors = [];
    const validSeverities = ['critical', 'warning', 'all'];
    if (typeof options.severity === 'string' &&
        !validSeverities.includes(options.severity)) {
        errors.push(`Invalid --severity value '${options.severity}'. Must be one of: ${validSeverities.join(', ')}`);
    }
    if (options.logDir && typeof options.logDir !== 'string') {
        errors.push('--log-dir must be a string path');
    }
    if (options.output && typeof options.output !== 'string') {
        errors.push('--output must be a string path');
    }
    return { isValid: errors.length === 0, errors };
}
/**
 * Resolve the log directory from options, with fallback to workflow directory default.
 */
export function resolveLogDirectory(options, cwd) {
    const base = options.projectRoot || cwd;
    if (options.logDir) {
        return path.isAbsolute(options.logDir) ? options.logDir : path.resolve(base, options.logDir);
    }
    const workflowDir = options.workflowDir || '.ai_workflow';
    return path.resolve(base, workflowDir, 'logs');
}
/**
 * Resolve the project root from options or cwd.
 */
export function resolveProjectRoot(options, cwd) {
    if (!options.projectRoot) {
        return cwd;
    }
    return path.isAbsolute(options.projectRoot)
        ? options.projectRoot
        : path.resolve(cwd, options.projectRoot);
}
/**
 * Format a terminal summary line for an issue count.
 */
export function formatIssueSummary(critical, warning, total) {
    if (total === 0) {
        return [chalk.green('✅  No issues found in the selected log files.')];
    }
    const lines = [chalk.white.bold(`Found ${total} issue(s):`)];
    if (critical > 0) {
        lines.push(chalk.red(`  🔴 Critical: ${critical}`));
    }
    if (warning > 0) {
        lines.push(chalk.yellow(`  ⚠️  Warning:  ${warning}`));
    }
    const info = total - critical - warning;
    if (info > 0) {
        lines.push(chalk.gray(`  ℹ️  Info:     ${info}`));
    }
    return lines;
}
/**
 * Split log entries into batches that each fit within `maxBodyChars`.
 *
 * Files are ordered: step `.log` files first (higher priority), then prompt
 * `.md` files. Within each group the original discovery order is preserved.
 * A single file that exceeds `maxBodyChars` on its own is placed alone in
 * its own batch (the AI will receive what it can handle).
 */
export function batchLogEntries(entries, maxBodyChars) {
    const ordered = [
        ...entries.filter((entry) => entry.filePath.endsWith('.log')),
        ...entries.filter((entry) => !entry.filePath.endsWith('.log')),
    ];
    const batches = [];
    let current = [];
    let currentChars = 0;
    for (const entry of ordered) {
        const entryChars = entry.content.length;
        if (current.length > 0 && currentChars + entryChars > maxBodyChars) {
            batches.push(current);
            current = [];
            currentChars = 0;
        }
        current.push(entry);
        currentChars += entryChars;
    }
    if (current.length > 0) {
        batches.push(current);
    }
    return batches;
}
/**
 * Build the prompt for a single analysis batch.
 */
export function buildBatchPrompt(entries, projectRoot, batchNum, totalBatches) {
    const fileBlocks = entries
        .map(({ filePath, content }) => `### ${filePath}\n\`\`\`\n${content}\n\`\`\``)
        .join('\n\n');
    const isSingleBatch = totalBatches === 1;
    const batchHeader = isSingleBatch
        ? `**Log Files (${entries.length} files)**:`
        : `**Log Files — Batch ${batchNum} of ${totalBatches} (${entries.length} files)**:`;
    const outputInstructions = isSingleBatch
        ? `Produce a complete, prioritised fix plan in Markdown with:
- A **Summary** table (severity counts)
- A **Critical Issues** section
- A **Warning Issues** section
- A **Info** section
- A **No-Action Required** section for false positives or already-fixed items`
        : `This is batch ${batchNum} of ${totalBatches}. List every issue you find in this batch using the format below. A later pass will consolidate all batches.

For each issue output:
\`\`\`
ISSUE:
  source: <file path and step>
  severity: critical | warning | info
  description: <precise description>
  fix: <concrete actionable fix>
\`\`\`

If no issues found in this batch, output: NO_ISSUES_IN_BATCH`;
    return `**Role**: You are a Senior Software Engineer performing a post-workflow log review.

**Task**: Analyse the workflow log files below (project root: \`${projectRoot}\`) and identify every issue, flag, recommendation, or failure reported. For each issue:
1. State the source file and step
2. Describe the issue precisely
3. Assign severity: 🔴 Critical | ⚠️ Warning | ℹ️ Info
4. Provide a concrete, actionable fix

${outputInstructions}

${batchHeader}

${fileBlocks}

**Project root**: \`${projectRoot}\`

Analyse ALL issues from both step \`.log\` files and AI response sections in prompt \`.md\` files.`;
}
/**
 * Build the final merge prompt that consolidates multiple partial batch results.
 */
export function buildMergePrompt(partialPlans, projectRoot) {
    const sections = partialPlans
        .map((plan, index) => `### Batch ${index + 1} Results\n\n${plan}`)
        .join('\n\n---\n\n');
    return `**Role**: You are a Senior Software Engineer consolidating a multi-batch log review.

**Task**: The workflow log files for \`${projectRoot}\` were analysed in ${partialPlans.length} batches due to context-window constraints. Consolidate the partial results below into a single, de-duplicated, prioritised fix plan.

Output a final Markdown document with:
- A **Summary** table (severity counts across all batches)
- A **Critical Issues** section (🔴)
- A **Warning Issues** section (⚠️)
- A **Info** section (ℹ️)
- A **No-Action Required** section for false positives or already-fixed items

De-duplicate issues that appear in multiple batches. Preserve all unique issues.

${sections}`;
}
/**
 * Convenience alias for single-batch use: build a complete prompt from all log entries.
 */
export function buildFixLogPrompt(entries, projectRoot) {
    return buildBatchPrompt(entries, projectRoot, 1, 1);
}
/**
 * Print `text` to stdout simulating a streaming typewriter effect.
 * Characters are written synchronously; the "delay" is achieved by grouping
 * characters into small chunks so the terminal renders progressively.
 */
async function printStreaming(text) {
    for (let index = 0; index < text.length; index += STREAM_CHUNK_SIZE) {
        process.stdout.write(text.slice(index, index + STREAM_CHUNK_SIZE));
        if (STREAM_DELAY_MS > 0) {
            await new Promise((resolve) => setTimeout(resolve, STREAM_DELAY_MS));
        }
    }
}
/**
 * Print a styled batch header to the terminal.
 */
function printBatchHeader(batchNum, totalBatches, fileCount, estTokens) {
    const bar = '━'.repeat(60);
    console.log('');
    console.log(chalk.cyan(bar));
    console.log(chalk.cyan.bold(`  Batch ${batchNum}/${totalBatches}  `) +
        chalk.gray(`${fileCount} file(s)  ~${estTokens.toLocaleString()} tokens`));
    console.log(chalk.cyan(bar));
    console.log('');
}
/**
 * Execute the fix-log-issues command.
 */
export async function fixLogIssuesCommand(options = {}) {
    const cwd = process.cwd();
    const validation = validateFixLogOptions(options);
    if (!validation.isValid) {
        validation.errors.forEach((errorMessage) => logger.error(`  ${errorMessage}`));
        process.exit(1);
    }
    const logDir = resolveLogDirectory(options, cwd);
    const projectRoot = resolveProjectRoot(options, cwd);
    const latestOnly = options.latest || false;
    const dryRun = options.dryRun || false;
    const model = options.model || DEFAULT_MODEL;
    console.log('');
    console.log(chalk.cyan.bold('Fix Log Issues'));
    console.log(chalk.gray('─'.repeat(60)));
    console.log(chalk.gray(`Log directory:  ${logDir}`));
    console.log(chalk.gray(`Project root:   ${projectRoot}`));
    console.log(chalk.gray(`Model:          ${model}`));
    if (latestOnly) {
        console.log(chalk.gray('Mode:           latest run only'));
    }
    console.log('');
    const spinner = ora('Discovering log files...').start();
    const runs = (await discoverLogFilesAsync(logDir, latestOnly, fs.promises));
    if (runs.length === 0) {
        spinner.fail(chalk.yellow(`No workflow log runs found in: ${logDir}`));
        process.exit(0);
    }
    const allLogFiles = runs.flatMap((run) => run.files);
    spinner.succeed(`Found ${runs.length} run(s), ${allLogFiles.length} file(s) (steps + prompts)`);
    const loadSpinner = ora('Loading log file contents...').start();
    const loadedEntries = await Promise.all(allLogFiles.map(async (filePath) => {
        try {
            const content = await fs.promises.readFile(filePath, 'utf-8');
            return { filePath, content };
        }
        catch (error) {
            logger.warn(`Could not read: ${filePath} (${getErrorMessage(error)})`);
            return null;
        }
    }));
    const logEntries = loadedEntries.filter(isLogEntry);
    loadSpinner.succeed(`Loaded ${logEntries.length} file(s) into context`);
    const maxBodyChars = maxBodyCharsForModel(model);
    const batches = batchLogEntries(logEntries, maxBodyChars);
    const tokenLimit = MODEL_CONTEXT_LIMITS[model] ?? DEFAULT_TOKEN_LIMIT;
    if (batches.length > 1) {
        console.log('');
        console.log(chalk.yellow(`⚠  Content split into ${batches.length} batches`) +
            chalk.gray(` (model: ${model}, limit: ~${tokenLimit.toLocaleString()} tokens)`));
    }
    const initSpinner = ora('Initialising AI...').start();
    const aiHelper = new AiHelper({ promptsDir: options.promptsDir || null });
    try {
        const initialized = await aiHelper.initialize();
        if (!initialized) {
            initSpinner.fail('AI is not available. Check your Copilot SDK configuration.');
            process.exit(1);
        }
        initSpinner.succeed('AI ready');
    }
    catch (error) {
        initSpinner.fail(`AI initialisation failed: ${getErrorMessage(error)}`);
        process.exit(1);
    }
    const partialResults = [];
    try {
        for (let index = 0; index < batches.length; index += 1) {
            const batch = batches[index];
            const batchNum = index + 1;
            const batchContent = batch.map((entry) => entry.content).join('');
            const estTokens = estimateTokenCount(batchContent) + PROMPT_OVERHEAD_TOKENS;
            const requestOptions = {
                persona: 'code_quality_analyst',
                model,
                validate: false,
                stream: true,
            };
            printBatchHeader(batchNum, batches.length, batch.length, estTokens);
            const prompt = buildBatchPrompt(batch, projectRoot, batchNum, batches.length);
            let streamedText = '';
            const onChunk = (delta) => {
                streamedText += delta;
                process.stdout.write(delta);
            };
            let batchResponse;
            try {
                batchResponse = await aiHelper.executeRequest(prompt, requestOptions, onChunk);
            }
            catch (error) {
                console.log('');
                console.log(chalk.red(`✖ Batch ${batchNum} failed: ${getErrorMessage(error)}`));
                process.exit(1);
            }
            const responseText = batchResponse.content || streamedText;
            if (!streamedText && responseText) {
                await printStreaming(responseText);
            }
            console.log('');
            partialResults.push(responseText);
        }
    }
    finally {
        await aiHelper.cleanup();
    }
    let finalMarkdown = partialResults[0] ?? '';
    if (partialResults.length > 1) {
        console.log('');
        console.log(chalk.cyan('━'.repeat(60)));
        console.log(chalk.cyan.bold('  Consolidating results from all batches...'));
        console.log(chalk.cyan('━'.repeat(60)));
        console.log('');
        const mergeHelper = new AiHelper({ promptsDir: options.promptsDir || null });
        const mergePrompt = buildMergePrompt(partialResults, projectRoot);
        const requestOptions = {
            persona: 'code_quality_analyst',
            model,
            validate: false,
            stream: true,
        };
        await mergeHelper.initialize();
        let mergedText = '';
        const onMergeChunk = (delta) => {
            mergedText += delta;
            process.stdout.write(delta);
        };
        let mergeResponse;
        try {
            mergeResponse = await mergeHelper.executeRequest(mergePrompt, requestOptions, onMergeChunk);
        }
        finally {
            await mergeHelper.cleanup();
        }
        finalMarkdown = mergeResponse.content || mergedText;
        if (!mergedText && finalMarkdown) {
            await printStreaming(finalMarkdown);
        }
        console.log('');
    }
    if (options.output) {
        if (dryRun) {
            console.log('');
            console.log(chalk.yellow(`[dry-run] Would write fix plan to: ${options.output}`));
        }
        else {
            try {
                const outputPath = path.isAbsolute(options.output)
                    ? options.output
                    : path.resolve(cwd, options.output);
                fs.mkdirSync(path.dirname(outputPath), { recursive: true });
                fs.writeFileSync(outputPath, finalMarkdown, 'utf-8');
                console.log('');
                console.log(chalk.green(`✅  Fix plan written to: ${outputPath}`));
            }
            catch (error) {
                logger.error(`Failed to write output file: ${getErrorMessage(error)}`);
            }
        }
    }
}
const fixLogIssuesModule = {
    fixLogIssuesCommand,
    validateFixLogOptions,
    resolveLogDirectory,
    resolveProjectRoot,
    formatIssueSummary,
    estimateTokenCount,
    maxBodyCharsForModel,
    batchLogEntries,
    buildBatchPrompt,
    buildFixLogPrompt,
    buildMergePrompt,
};
export default fixLogIssuesModule;
