import path from 'path';

export const DEFAULT_MAX_PROMPT_ENTRY_CHARS = 4_000;
export const DEFAULT_MAX_PROMPT_PARTITION_CHARS = 9_000;
export const DEFAULT_MAX_PROMPT_ENTRIES_PER_PARTITION = 4;

function normalizeReviewPath(filePath) {
  return String(filePath ?? '').replace(/\\/g, '/');
}

/**
 * Filter and deduplicate review target paths with a caller-provided predicate.
 *
 * @param {string[]} files - File paths to normalize
 * @param {(filePath: string) => boolean} predicate - Inclusion predicate
 * @returns {string[]}
 */
export function filterReviewTargets(files, predicate) {
  const seen = new Set();

  return (Array.isArray(files) ? files : [])
    .filter((filePath) => {
      const normalized = normalizeReviewPath(filePath);
      if (typeof predicate !== 'function' || !predicate(normalized) || seen.has(normalized)) {
        return false;
      }
      seen.add(normalized);
      return true;
    })
    .map(normalizeReviewPath);
}

/**
 * Load readable review files from disk for prompt and heuristic processing.
 *
 * @param {Object} fileOps - FileOperations-compatible object
 * @param {string} projectRoot - Project root directory
 * @param {string[]} relativeFiles - Relative file paths to read
 * @returns {Promise<{fileContents: string[], fileEntries: Array<{relativePath: string, content: string}>}>}
 */
export async function loadReadableReviewFiles(fileOps, projectRoot, relativeFiles) {
  const fileContents = [];
  const fileEntries = [];

  const readResults = await Promise.allSettled(
    (Array.isArray(relativeFiles) ? relativeFiles : []).map(async (relFile) => {
      const absPath = path.isAbsolute(relFile) ? relFile : path.join(projectRoot, relFile);
      const content = await fileOps.readFile(absPath);
      return { relativePath: relFile, content };
    })
  );

  for (const result of readResults) {
    if (result.status !== 'fulfilled') {
      // Skip unreadable files silently
      continue;
    }

    fileContents.push(result.value.content);
    fileEntries.push(result.value);
  }

  return { fileContents, fileEntries };
}

/**
 * Split a single source file into prompt-safe entries without dropping content.
 *
 * @param {{relativePath: string, content: string}} entry - Source file entry
 * @param {number} [maxEntryChars=DEFAULT_MAX_PROMPT_ENTRY_CHARS] - Max chars per entry
 * @returns {Array<{relativePath: string, sourcePath: string, content: string}>}
 */
export function splitPromptEntry(entry, maxEntryChars = DEFAULT_MAX_PROMPT_ENTRY_CHARS) {
  const sourcePath = entry?.relativePath ?? '';
  const content = entry?.content ?? '';

  if (content.length <= maxEntryChars) {
    return [{ relativePath: sourcePath, sourcePath, content }];
  }

  const parts = [];
  let start = 0;
  while (start < content.length) {
    let end = Math.min(start + maxEntryChars, content.length);
    if (end < content.length) {
      const cutAt = content.lastIndexOf('\n', end);
      if (cutAt > start) end = cutAt;
    }
    if (end <= start) end = Math.min(start + maxEntryChars, content.length);
    parts.push(content.slice(start, end));
    start = end;
    if (content[start] === '\n') start += 1;
  }

  return parts.map((partContent, index) => ({
    relativePath: `${sourcePath} (part ${index + 1}/${parts.length})`,
    sourcePath,
    content: partContent,
  }));
}

function estimatePromptEntryChars(entry) {
  return (entry?.relativePath?.length ?? 0) + (entry?.content?.length ?? 0) + 32;
}

/**
 * Partition the review source payload into prompt-safe batches.
 *
 * @param {Array<{relativePath: string, content: string}>} fileEntries - Raw file entries
 * @param {Object} [options]
 * @param {number} [options.maxPartitionChars=DEFAULT_MAX_PROMPT_PARTITION_CHARS] - Max chars per prompt batch
 * @param {number} [options.maxEntryChars=DEFAULT_MAX_PROMPT_ENTRY_CHARS] - Max chars per prompt entry
 * @param {number} [options.maxEntriesPerPartition=DEFAULT_MAX_PROMPT_ENTRIES_PER_PARTITION] - Max entries per batch
 * @returns {Array<{entries: Array<{relativePath: string, sourcePath: string, content: string}>, scopePaths: string[]}>}
 */
export function buildPromptPartitions(fileEntries, options = {}) {
  if (!Array.isArray(fileEntries) || fileEntries.length === 0) return [];

  const {
    maxPartitionChars = DEFAULT_MAX_PROMPT_PARTITION_CHARS,
    maxEntryChars = DEFAULT_MAX_PROMPT_ENTRY_CHARS,
    maxEntriesPerPartition = DEFAULT_MAX_PROMPT_ENTRIES_PER_PARTITION,
  } = options;

  const promptEntries = fileEntries.flatMap((entry) => splitPromptEntry(entry, maxEntryChars));
  const partitions = [];
  let currentEntries = [];
  let currentChars = 0;

  const flush = () => {
    if (currentEntries.length === 0) return;
    partitions.push({
      entries: currentEntries,
      scopePaths: [...new Set(currentEntries.map((entry) => entry.sourcePath))],
    });
    currentEntries = [];
    currentChars = 0;
  };

  for (const entry of promptEntries) {
    const entryChars = estimatePromptEntryChars(entry);
    const wouldOverflow =
      currentEntries.length > 0 &&
      (currentChars + entryChars > maxPartitionChars ||
        currentEntries.length >= maxEntriesPerPartition);

    if (wouldOverflow) flush();

    currentEntries.push(entry);
    currentChars += entryChars;
  }

  flush();
  return partitions;
}

/**
 * Build a markdown block for the current prompt partition.
 *
 * @param {Array<{relativePath: string, sourcePath: string, content: string}>} entries - Prompt entries
 * @returns {string}
 */
export function buildPromptFileContentsBlock(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return '';

  return entries
    .map(({ relativePath, sourcePath, content }) => {
      const ext = (sourcePath || relativePath).split('.').pop() ?? '';
      return `### \`${relativePath}\`\n\`\`\`${ext}\n${content}\n\`\`\``;
    })
    .join('\n\n');
}
