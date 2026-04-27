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

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { logger } from '../../core/logger.js';
import { AiHelper } from '../../lib/ai_helpers.js';
import { discoverLogFilesAsync } from '../../lib/log_parser.js';

// ============================================================================
// CONSTANTS
// ============================================================================

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

/** Safety margin: use this fraction of the model's context limit. */
const CONTEXT_SAFETY_MARGIN = 0.85;

/**
 * Conservative chars-per-token ratio for code/log content.
 * Real-world logs tokenise at roughly 2.5 chars/token.
 */
const CHARS_PER_TOKEN = 2.5;

/** Approximate token overhead for the static preamble + footer in each batch prompt. */
const PROMPT_OVERHEAD_TOKENS = 600;

// ============================================================================
// PURE FUNCTIONS
// ============================================================================

/**
 * Estimate token count of a string using a conservative chars-per-token ratio.
 * @pure
 * @param {string} text
 * @returns {number}
 */
export function estimateTokenCount(text) {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Compute the maximum body characters that fit in a single batch prompt
 * for the given model, after reserving overhead for instructions and completion.
 * @pure
 * @param {string} model - Model identifier
 * @returns {number} Maximum content characters per batch
 */
export function maxBodyCharsForModel(model) {
  const tokenLimit = MODEL_CONTEXT_LIMITS[model] ?? 64_000;
  const usableTokens = Math.floor(tokenLimit * CONTEXT_SAFETY_MARGIN) - PROMPT_OVERHEAD_TOKENS;
  return Math.floor(usableTokens * CHARS_PER_TOKEN);
}

/**
 * Validate fix-log-issues command options.
 * @pure
 * @param {Object} options - Command options
 * @returns {{ isValid: boolean, errors: string[] }}
 */
export function validateFixLogOptions(options) {
  const errors = [];
  const validSeverities = ['critical', 'warning', 'all'];

  if (options.severity && !validSeverities.includes(options.severity)) {
    errors.push(
      `Invalid --severity value '${options.severity}'. Must be one of: ${validSeverities.join(', ')}`
    );
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
 * @pure
 * @param {Object} options - Command options
 * @param {string} cwd - Current working directory
 * @returns {string} Resolved absolute path to the log directory
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
 * @pure
 * @param {Object} options - Command options
 * @param {string} cwd - Current working directory
 * @returns {string} Resolved absolute project root path
 */
export function resolveProjectRoot(options, cwd) {
  if (!options.projectRoot) return cwd;
  return path.isAbsolute(options.projectRoot)
    ? options.projectRoot
    : path.resolve(cwd, options.projectRoot);
}

/**
 * Format a terminal summary line for an issue count.
 * @pure
 * @param {number} critical
 * @param {number} warning
 * @param {number} total
 * @returns {string[]}
 */
export function formatIssueSummary(critical, warning, total) {
  if (total === 0) return [chalk.green('✅  No issues found in the selected log files.')];

  const lines = [chalk.white.bold(`Found ${total} issue(s):`)];
  if (critical > 0) lines.push(chalk.red(`  🔴 Critical: ${critical}`));
  if (warning > 0) lines.push(chalk.yellow(`  ⚠️  Warning:  ${warning}`));
  const info = total - critical - warning;
  if (info > 0) lines.push(chalk.gray(`  ℹ️  Info:     ${info}`));
  return lines;
}

/**
 * Split log entries into batches that each fit within `maxBodyChars`.
 *
 * Files are ordered: step `.log` files first (higher priority), then prompt
 * `.md` files. Within each group the original discovery order is preserved.
 * A single file that exceeds `maxBodyChars` on its own is placed alone in
 * its own batch (the AI will receive what it can handle).
 *
 * @pure
 * @param {Array<{filePath: string, content: string}>} entries
 * @param {number} maxBodyChars - Maximum total content chars per batch
 * @returns {Array<Array<{filePath: string, content: string}>>} Array of batches
 */
export function batchLogEntries(entries, maxBodyChars) {
  // Priority order: .log files first
  const ordered = [
    ...entries.filter((e) => e.filePath.endsWith('.log')),
    ...entries.filter((e) => !e.filePath.endsWith('.log')),
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

  if (current.length > 0) batches.push(current);

  return batches;
}

/**
 * Build the prompt for a single analysis batch.
 * @pure
 * @param {Array<{filePath: string, content: string}>} entries - Files in this batch
 * @param {string} projectRoot
 * @param {number} batchNum - 1-based batch index
 * @param {number} totalBatches - Total number of batches
 * @returns {string}
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
- An **Info** section
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
 * @pure
 * @param {string[]} partialPlans - Raw AI output from each batch
 * @param {string} projectRoot
 * @returns {string}
 */
export function buildMergePrompt(partialPlans, projectRoot) {
  const sections = partialPlans
    .map((plan, i) => `### Batch ${i + 1} Results\n\n${plan}`)
    .join('\n\n---\n\n');

  return `**Role**: You are a Senior Software Engineer consolidating a multi-batch log review.

**Task**: The workflow log files for \`${projectRoot}\` were analysed in ${partialPlans.length} batches due to context-window constraints. Consolidate the partial results below into a single, de-duplicated, prioritised fix plan.

Output a final Markdown document with:
- A **Summary** table (severity counts across all batches)
- A **Critical Issues** section (🔴)
- A **Warning Issues** section (⚠️)
- An **Info** section (ℹ️)
- A **No-Action Required** section for false positives or already-fixed items

De-duplicate issues that appear in multiple batches. Preserve all unique issues.

${sections}`;
}

/**
 * Convenience alias for single-batch use: build a complete prompt from all log entries.
 * Equivalent to `buildBatchPrompt(entries, projectRoot, 1, 1)`.
 * @pure
 * @param {Array<{filePath: string, content: string}>} entries
 * @param {string} projectRoot
 * @returns {string}
 */
export function buildFixLogPrompt(entries, projectRoot) {
  return buildBatchPrompt(entries, projectRoot, 1, 1);
}

// ============================================================================
// IMPURE HELPERS - Terminal streaming display
// ============================================================================

/**
 * Print `text` to stdout simulating a streaming typewriter effect.
 * Characters are written synchronously; the "delay" is achieved by grouping
 * characters into small chunks so the terminal renders progressively.
 * @param {string} text - Text to display
 */
async function printStreaming(text) {
  const CHUNK_SIZE = 6; // chars per write — gives a smooth print feel
  const DELAY_MS = 0; // no artificial delay needed; I/O pressure creates the effect

  for (let i = 0; i < text.length; i += CHUNK_SIZE) {
    process.stdout.write(text.slice(i, i + CHUNK_SIZE));
    if (DELAY_MS > 0) await new Promise((r) => setTimeout(r, DELAY_MS));
  }
}

/**
 * Print a styled batch header to the terminal.
 * @param {number} batchNum - 1-based batch index
 * @param {number} totalBatches - Total number of batches
 * @param {number} fileCount - Number of files in this batch
 * @param {number} estTokens - Estimated token count for this batch
 */
function printBatchHeader(batchNum, totalBatches, fileCount, estTokens) {
  const bar = '━'.repeat(60);
  console.log('');
  console.log(chalk.cyan(bar));
  console.log(
    chalk.cyan.bold(`  Batch ${batchNum}/${totalBatches}  `) +
      chalk.gray(`${fileCount} file(s)  ~${estTokens.toLocaleString()} tokens`)
  );
  console.log(chalk.cyan(bar));
  console.log('');
}

// ============================================================================
// IMPURE WRAPPER - Command Entry Point
// ============================================================================

/**
 * Execute the fix-log-issues command.
 *
 * @param {Object} options - Command options
 * @param {string} [options.logDir] - Path to log directory
 * @param {string} [options.projectRoot] - Project root for codebase validation
 * @param {string} [options.workflowDir] - Workflow directory (default: .ai_workflow)
 * @param {string} [options.output] - Path to write the Markdown fix plan
 * @param {boolean} [options.latest] - Use only the most recent log run
 * @param {string} [options.severity] - Filter severity (critical|warning|all)
 * @param {string} [options.model] - Model to use (default: gpt-4.1)
 * @param {boolean} [options.dryRun] - Preview without writing output file
 * @param {boolean} [options.verbose] - Enable verbose output
 * @returns {Promise<void>}
 */
export async function fixLogIssuesCommand(options = {}) {
  const cwd = process.cwd();

  // --- Validate options ---
  const validation = validateFixLogOptions(options);
  if (!validation.isValid) {
    validation.errors.forEach((err) => logger.error(`  ${err}`));
    process.exit(1);
  }

  const logDir = resolveLogDirectory(options, cwd);
  const projectRoot = resolveProjectRoot(options, cwd);
  const latestOnly = options.latest || false;
  const dryRun = options.dryRun || false;
  const model = options.model || 'gpt-4.1';

  console.log('');
  console.log(chalk.cyan.bold('Fix Log Issues'));
  console.log(chalk.gray('─'.repeat(60)));
  console.log(chalk.gray(`Log directory:  ${logDir}`));
  console.log(chalk.gray(`Project root:   ${projectRoot}`));
  console.log(chalk.gray(`Model:          ${model}`));
  if (latestOnly) console.log(chalk.gray('Mode:           latest run only'));
  console.log('');

  // --- Discover log files ---
  const spinner = ora('Discovering log files...').start();
  const runs = await discoverLogFilesAsync(logDir, latestOnly, fs.promises);

  if (runs.length === 0) {
    spinner.fail(chalk.yellow(`No workflow log runs found in: ${logDir}`));
    process.exit(0);
  }

  const allLogFiles = runs.flatMap((r) => r.files);
  spinner.succeed(`Found ${runs.length} run(s), ${allLogFiles.length} file(s) (steps + prompts)`);

  // --- Load file contents ---
  const loadSpinner = ora('Loading log file contents...').start();
  const loadedEntries = await Promise.all(
    allLogFiles.map(async (filePath) => {
      try {
        const content = await fs.promises.readFile(filePath, 'utf-8');
        return { filePath, content };
      } catch (err) {
        logger.warn(`Could not read: ${filePath} (${err.message})`);
        return null;
      }
    })
  );
  const logEntries = loadedEntries.filter(Boolean);
  loadSpinner.succeed(`Loaded ${logEntries.length} file(s) into context`);

  // --- Batch files to fit within the model's token window ---
  const maxBodyChars = maxBodyCharsForModel(model);
  const batches = batchLogEntries(logEntries, maxBodyChars);
  const tokenLimit = MODEL_CONTEXT_LIMITS[model] ?? 64_000;

  if (batches.length > 1) {
    console.log('');
    console.log(
      chalk.yellow(`⚠  Content split into ${batches.length} batches`) +
        chalk.gray(` (model: ${model}, limit: ~${tokenLimit.toLocaleString()} tokens)`)
    );
  }

  // --- Initialise AI helper ---
  const initSpinner = ora('Initialising AI...').start();
  const aiHelper = new AiHelper({ promptsDir: options.promptsDir || null });

  try {
    const initialized = await aiHelper.initialize();
    if (!initialized) {
      initSpinner.fail('AI is not available. Check your Copilot SDK configuration.');
      process.exit(1);
    }
    initSpinner.succeed('AI ready');
  } catch (err) {
    initSpinner.fail(`AI initialisation failed: ${err.message}`);
    process.exit(1);
  }

  // --- Process each batch, streaming output to terminal ---
  const partialResults = [];

  try {
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const batchNum = i + 1;
      const batchContent = batch.map((e) => e.content).join('');
      const estTokens = estimateTokenCount(batchContent) + PROMPT_OVERHEAD_TOKENS;

      printBatchHeader(batchNum, batches.length, batch.length, estTokens);

      const prompt = buildBatchPrompt(batch, projectRoot, batchNum, batches.length);

      // Collect streamed chunks
      let streamedText = '';
      const onChunk = (delta) => {
        streamedText += delta;
        process.stdout.write(delta);
      };

      let batchResponse;
      try {
        batchResponse = await aiHelper.executeRequest(
          prompt,
          { persona: 'code_quality_analyst', model, validate: false, stream: true },
          onChunk
        );
      } catch (err) {
        console.log('');
        console.log(chalk.red(`✖ Batch ${batchNum} failed: ${err.message}`));
        process.exit(1);
      }

      // If onChunk was never called (SDK doesn't support streaming), print the response now
      const responseText = batchResponse.content || streamedText;
      if (!streamedText && responseText) {
        await printStreaming(responseText);
      }

      console.log('');
      partialResults.push(responseText);
    }
  } finally {
    await aiHelper.cleanup();
  }

  // --- Merge partial results (if more than one batch) ---
  let finalMarkdown;

  if (partialResults.length === 1) {
    finalMarkdown = partialResults[0];
  } else {
    console.log('');
    console.log(chalk.cyan('━'.repeat(60)));
    console.log(chalk.cyan.bold('  Consolidating results from all batches...'));
    console.log(chalk.cyan('━'.repeat(60)));
    console.log('');

    const mergeHelper = new AiHelper({ promptsDir: options.promptsDir || null });
    await mergeHelper.initialize();

    const mergePrompt = buildMergePrompt(partialResults, projectRoot);

    let mergedText = '';
    const onMergeChunk = (delta) => {
      mergedText += delta;
      process.stdout.write(delta);
    };

    let mergeResponse;
    try {
      mergeResponse = await mergeHelper.executeRequest(
        mergePrompt,
        { persona: 'code_quality_analyst', model, validate: false, stream: true },
        onMergeChunk
      );
    } finally {
      await mergeHelper.cleanup();
    }

    finalMarkdown = mergeResponse.content || mergedText;
    if (!mergedText && finalMarkdown) {
      await printStreaming(finalMarkdown);
    }

    console.log('');
  }

  // --- Write or print final plan ---
  if (options.output) {
    if (dryRun) {
      console.log('');
      console.log(chalk.yellow(`[dry-run] Would write fix plan to: ${options.output}`));
    } else {
      try {
        const outputPath = path.isAbsolute(options.output)
          ? options.output
          : path.resolve(cwd, options.output);
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, finalMarkdown, 'utf-8');
        console.log('');
        console.log(chalk.green(`✅  Fix plan written to: ${outputPath}`));
      } catch (err) {
        logger.error(`Failed to write output file: ${err.message}`);
      }
    }
  }
}

export default {
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
