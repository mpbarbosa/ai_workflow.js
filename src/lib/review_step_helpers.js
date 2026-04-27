/**
 * Shared helpers for partitioned AI review steps.
 * @module lib/review_step_helpers
 */

import {
  buildPromptFileContentsBlock,
  buildPromptPartitions,
  DEFAULT_MAX_PROMPT_ENTRY_CHARS,
  DEFAULT_MAX_PROMPT_ENTRIES_PER_PARTITION,
  DEFAULT_MAX_PROMPT_PARTITION_CHARS,
  splitPromptEntry,
} from './review_prompt_scope.js';

export {
  DEFAULT_MAX_PROMPT_ENTRY_CHARS as MAX_PROMPT_ENTRY_CHARS,
  DEFAULT_MAX_PROMPT_PARTITION_CHARS as MAX_PROMPT_PARTITION_CHARS,
  DEFAULT_MAX_PROMPT_ENTRIES_PER_PARTITION as MAX_PROMPT_ENTRIES_PER_PARTITION,
} from './review_prompt_scope.js';

export const MAX_FILE_PATHS_IN_CONTEXT = 20;

/**
 * Split a source file into prompt-safe review entries without truncating content.
 *
 * @param {{relativePath: string, content: string}} entry - Source file entry
 * @param {number} [maxEntryChars=DEFAULT_MAX_PROMPT_ENTRY_CHARS] - Max chars per entry
 * @returns {Array<{relativePath: string, sourcePath: string, content: string}>}
 */
export const splitReviewPromptEntry = splitPromptEntry;

/**
 * Partition review entries into prompt-safe batches using the repo defaults.
 *
 * @param {Array<{relativePath: string, content: string}>} fileEntries - Raw file entries
 * @param {number} [maxPartitionChars=DEFAULT_MAX_PROMPT_PARTITION_CHARS] - Max chars per prompt batch
 * @param {number} [maxEntryChars=DEFAULT_MAX_PROMPT_ENTRY_CHARS] - Max chars per prompt entry
 * @returns {Array<{entries: Array<{relativePath: string, sourcePath: string, content: string}>, scopePaths: string[]}>}
 */
export function buildReviewPromptPartitions(
  fileEntries,
  maxPartitionChars = DEFAULT_MAX_PROMPT_PARTITION_CHARS,
  maxEntryChars = DEFAULT_MAX_PROMPT_ENTRY_CHARS
) {
  return buildPromptPartitions(fileEntries, {
    maxPartitionChars,
    maxEntryChars,
    maxEntriesPerPartition: DEFAULT_MAX_PROMPT_ENTRIES_PER_PARTITION,
  });
}

/**
 * Build the markdown file-content block for a prompt partition.
 *
 * @param {Array<{relativePath: string, sourcePath: string, content: string}>} entries - Prompt entries
 * @returns {string}
 */
export const buildReviewFileContentsBlock = buildPromptFileContentsBlock;

/**
 * Build the indented file-path list shown in review prompts for the current partition.
 *
 * @param {Array<{relativePath: string}>} entries - Prompt entries in the current partition
 * @param {number} [maxFilePathsInContext=MAX_FILE_PATHS_IN_CONTEXT] - Max file paths to list before summarizing
 * @returns {string}
 */
export function buildPartitionFilePathsContext(
  entries,
  maxFilePathsInContext = MAX_FILE_PATHS_IN_CONTEXT
) {
  const partitionDisplayPaths = Array.isArray(entries)
    ? entries.map((entry) => entry?.relativePath).filter(Boolean)
    : [];
  const filePathList = partitionDisplayPaths
    .slice(0, maxFilePathsInContext)
    .map((filePath) => `      - ${filePath}`)
    .join('\n');

  return partitionDisplayPaths.length > maxFilePathsInContext
    ? `${filePathList}\n      ... and ${partitionDisplayPaths.length - maxFilePathsInContext} more`
    : filePathList;
}

/**
 * Execute a partitioned AI workflow and join the collected response sections.
 *
 * @param {object} opts
 * @param {Array<object>} opts.partitions - Output of buildPromptPartitions()
 * @param {function(partition: object, partitionCtx: {index: number, total: number, isMultiPartition: boolean}): string} opts.buildPrompt
 *   Called for each partition; returns the prompt string to send (falsy return skips the partition)
 * @param {function(partition: object, partitionCtx: {index: number, total: number, isMultiPartition: boolean}, prompt: string): Promise<unknown>} opts.executePartition
 *   Executes the AI request for the partition and returns the raw response payload
 * @param {function(response: unknown): string} [opts.extractContent]
 *   Maps the raw response payload into the text that should be appended to the joined output
 * @param {function(response: unknown, currentSuccess: boolean): boolean} [opts.trackSuccess]
 *   Updates the aggregate success flag after each partition response
 * @returns {Promise<{success: boolean, content: string}>}
 */
export async function runPartitionedAiResponses({
  partitions,
  buildPrompt,
  executePartition,
  extractContent = (response) => response?.content ?? response?.text ?? '',
  trackSuccess = (_response, currentSuccess) => currentSuccess,
  shouldContinue = () => true,
}) {
  const aiSections = [];
  let success = true;

  for (let i = 0; i < partitions.length; i++) {
    if (!shouldContinue()) {
      break;
    }

    const partition = partitions[i];
    const partitionCtx = {
      index: i,
      total: partitions.length,
      isMultiPartition: partitions.length > 1,
    };
    const prompt = buildPrompt(partition, partitionCtx);

    if (!prompt) continue;

    const response = await executePartition(partition, partitionCtx, prompt);
    if (!shouldContinue()) {
      break;
    }
    success = trackSuccess(response, success);
    const responseContent = extractContent(response);

    if (responseContent) {
      aiSections.push(
        partitionCtx.isMultiPartition
          ? `#### Partition ${i + 1} of ${partitions.length}\n\n${responseContent}`
          : responseContent
      );
    }
  }

  return {
    success,
    content: aiSections.join('\n\n'),
  };
}

/**
 * Runs AI analysis across prompt partitions, collecting and joining the results.
 *
 * @param {object} opts
 * @param {Array<object>} opts.partitions - Output of buildPromptPartitions()
 * @param {function(partition: object, partitionCtx: {index: number, total: number, isMultiPartition: boolean}): string} opts.buildPrompt
 *   Called for each partition; returns the prompt string to send (falsy return skips the partition)
 * @param {function(partition: object, partitionCtx: {index: number, total: number, isMultiPartition: boolean}): string} opts.buildCacheKey
 *   Called for each partition; returns the cache key string
 * @param {string} opts.persona - AI persona string passed to aiHelper.executeRequest
 * @param {import('./ai_cache.js').AiCache} opts.aiCache
 * @param {import('./ai_helpers.js').AiHelper} opts.aiHelper
 * @returns {Promise<string>} Joined AI content string (partitions separated by '\n\n')
 */
export async function runPartitionedAiAnalysis({
  partitions,
  buildPrompt,
  buildCacheKey,
  persona,
  aiCache,
  aiHelper,
}) {
  const result = await runPartitionedAiResponses({
    partitions,
    buildPrompt,
    executePartition: async (partition, partitionCtx, prompt) => {
      const cacheKey = buildCacheKey(partition, partitionCtx);
      return aiCache.withCache(prompt, cacheKey, async () => {
        const aiResult = await aiHelper.executeRequest(prompt, { persona });
        return aiResult?.content ?? '';
      });
    },
    extractContent: (response) => response || '',
  });

  return result.content;
}
