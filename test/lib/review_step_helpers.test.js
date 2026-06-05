// test/review_step_helpers.test.js

import { jest } from '@jest/globals';

jest.unstable_mockModule('../../src/lib/review_prompt_scope.js', () => ({
  buildPromptFileContentsBlock: jest.fn((entries) => entries.map((e) => e.content).join('\n')),
  buildPromptPartitions: jest.fn((fileEntries, _opts) => [
    {
      entries: fileEntries.map((e) => ({
        ...e,
        sourcePath: e.relativePath,
        content: e.content,
      })),
      scopePaths: fileEntries.map((e) => e.relativePath),
    },
  ]),
  DEFAULT_MAX_PROMPT_ENTRY_CHARS: 1000,
  DEFAULT_MAX_PROMPT_ENTRIES_PER_PARTITION: 10,
  DEFAULT_MAX_PROMPT_PARTITION_CHARS: 5000,
  splitPromptEntry: jest.fn((entry, maxEntryChars = 1000) => {
    if (!entry || typeof entry.content !== 'string') return [];
    if (entry.content.length <= maxEntryChars) {
      return [
        {
          relativePath: entry.relativePath,
          sourcePath: entry.relativePath,
          content: entry.content,
        },
      ];
    }
    // Split into chunks
    const chunks = [];
    let i = 0;
    while (i < entry.content.length) {
      chunks.push({
        relativePath: entry.relativePath,
        sourcePath: entry.relativePath,
        content: entry.content.slice(i, i + maxEntryChars),
      });
      i += maxEntryChars;
    }
    return chunks;
  }),
}));

const {
  MAX_PROMPT_ENTRY_CHARS,
  MAX_PROMPT_PARTITION_CHARS,
  MAX_PROMPT_ENTRIES_PER_PARTITION,
  MAX_FILE_PATHS_IN_CONTEXT,
  splitReviewPromptEntry,
  buildReviewPromptPartitions,
  buildReviewFileContentsBlock,
  buildPartitionFilePathsContext,
  buildSplitFileCoverage,
  runPartitionedAiResponses,
  runPartitionedAiAnalysis,
} = await import('../../src/lib/review_step_helpers.js');

describe('review_step_helpers', () => {
  describe('constants', () => {
    it('should export correct constants', () => {
      expect(MAX_PROMPT_ENTRY_CHARS).toBe(1000);
      expect(MAX_PROMPT_PARTITION_CHARS).toBe(5000);
      expect(MAX_PROMPT_ENTRIES_PER_PARTITION).toBe(10);
      expect(MAX_FILE_PATHS_IN_CONTEXT).toBe(20);
    });
  });

  describe('splitReviewPromptEntry', () => {
    it('should split entry into one chunk if under maxEntryChars', () => {
      const entry = { relativePath: 'foo.js', content: 'abc' };
      const result = splitReviewPromptEntry(entry, 10);
      expect(result).toEqual([{ relativePath: 'foo.js', sourcePath: 'foo.js', content: 'abc' }]);
    });

    it('should split entry into multiple chunks if over maxEntryChars', () => {
      const entry = { relativePath: 'foo.js', content: 'a'.repeat(25) };
      const result = splitReviewPromptEntry(entry, 10);
      expect(result.length).toBe(3);
      expect(result[0].content).toBe('a'.repeat(10));
      expect(result[1].content).toBe('a'.repeat(10));
      expect(result[2].content).toBe('a'.repeat(5));
    });

    it('should return empty array for invalid entry', () => {
      expect(splitReviewPromptEntry(null)).toEqual([]);
      expect(splitReviewPromptEntry({})).toEqual([]);
    });
  });

  describe('buildReviewPromptPartitions', () => {
    it('should call buildPromptPartitions with correct args', () => {
      const fileEntries = [
        { relativePath: 'a.js', content: 'foo' },
        { relativePath: 'b.js', content: 'bar' },
      ];
      const result = buildReviewPromptPartitions(fileEntries, 123, 456);
      expect(result).toHaveLength(1);
      expect(result[0].entries).toHaveLength(2);
      expect(result[0].scopePaths).toEqual(['a.js', 'b.js']);
    });

    it('should use defaults if no args provided', () => {
      const fileEntries = [{ relativePath: 'a.js', content: 'foo' }];
      const result = buildReviewPromptPartitions(fileEntries);
      expect(result).toHaveLength(1);
      expect(result[0].entries[0].content).toBe('foo');
    });
  });

  describe('buildReviewFileContentsBlock', () => {
    it('should call buildPromptFileContentsBlock', () => {
      const entries = [
        { relativePath: 'a.js', sourcePath: 'a.js', content: 'foo' },
        { relativePath: 'b.js', sourcePath: 'b.js', content: 'bar' },
      ];
      const result = buildReviewFileContentsBlock(entries);
      expect(result).toBe('foo\nbar');
    });
  });

  describe('buildPartitionFilePathsContext', () => {
    it('should list all file paths if under maxFilePathsInContext', () => {
      const entries = [{ relativePath: 'a.js' }, { relativePath: 'b.js' }];
      const result = buildPartitionFilePathsContext(entries, 5);
      expect(result).toBe('      - a.js\n      - b.js');
    });

    it('should summarize if over maxFilePathsInContext', () => {
      const entries = Array.from({ length: 22 }, (_, i) => ({
        relativePath: `file${i}.js`,
      }));
      const result = buildPartitionFilePathsContext(entries, 20);
      expect(result).toContain('      ... and 2 more');
      expect(result.split('\n').length).toBe(21);
    });

    it('should handle empty or invalid entries', () => {
      expect(buildPartitionFilePathsContext([], 5)).toBe('');
      expect(buildPartitionFilePathsContext(null, 5)).toBe('');
      expect(buildPartitionFilePathsContext([{ foo: 'bar' }], 5)).toBe('');
    });
  });

  describe('buildSplitFileCoverage', () => {
    it('identifies fully covered and incomplete split files', () => {
      const coverage = buildSplitFileCoverage([
        { relativePath: 'src/app.ts (part 1/2)', sourcePath: 'src/app.ts' },
        { relativePath: 'src/app.ts (part 2/2)', sourcePath: 'src/app.ts' },
        { relativePath: 'src/large.ts (part 1/3)', sourcePath: 'src/large.ts' },
        { relativePath: 'src/other.ts', sourcePath: 'src/other.ts' },
      ]);

      expect(coverage.completeSplitSourcePaths).toEqual(['src/app.ts']);
      expect(coverage.incompleteSplitSourcePaths).toEqual(['src/large.ts']);
      expect(coverage.splitFileCoverage).toEqual([
        {
          sourcePath: 'src/app.ts',
          totalParts: 2,
          partsSeen: [1, 2],
          complete: true,
        },
        {
          sourcePath: 'src/large.ts',
          totalParts: 3,
          partsSeen: [1],
          complete: false,
        },
      ]);
    });

    it('returns empty coverage for invalid or unsplit entries', () => {
      expect(buildSplitFileCoverage(null)).toEqual({
        splitFileCoverage: [],
        completeSplitSourcePaths: [],
        incompleteSplitSourcePaths: [],
      });
      expect(
        buildSplitFileCoverage([{ relativePath: 'src/app.ts', sourcePath: 'src/app.ts' }])
      ).toEqual({
        splitFileCoverage: [],
        completeSplitSourcePaths: [],
        incompleteSplitSourcePaths: [],
      });
    });
  });

  describe('runPartitionedAiResponses', () => {
    it('should join single partition content', async () => {
      const partitions = [{ foo: 1 }];
      const buildPrompt = jest.fn(() => 'prompt');
      const executePartition = jest.fn(async () => ({ content: 'AI result' }));
      const result = await runPartitionedAiResponses({
        partitions,
        buildPrompt,
        executePartition,
      });
      expect(result.success).toBe(true);
      expect(result.content).toBe('AI result');
    });

    it('should join multiple partitions with headers', async () => {
      const partitions = [{ foo: 1 }, { foo: 2 }];
      const buildPrompt = jest.fn(() => 'prompt');
      const executePartition = jest
        .fn()
        .mockResolvedValueOnce({ content: 'A' })
        .mockResolvedValueOnce({ content: 'B' });
      const result = await runPartitionedAiResponses({
        partitions,
        buildPrompt,
        executePartition,
      });
      expect(result.content).toContain('#### Partition 1 of 2');
      expect(result.content).toContain('#### Partition 2 of 2');
      expect(result.content).toContain('A');
      expect(result.content).toContain('B');
    });

    it('should skip partitions with falsy prompt', async () => {
      const partitions = [{ foo: 1 }, { foo: 2 }];
      const buildPrompt = jest.fn((_, ctx) => (ctx.index === 0 ? 'prompt' : ''));
      const executePartition = jest.fn(async () => ({ content: 'A' }));
      const result = await runPartitionedAiResponses({
        partitions,
        buildPrompt,
        executePartition,
      });
      expect(result.content).toContain('A');
      expect(result.content).not.toContain('#### Partition 2 of 2');
    });

    it('should use extractContent and trackSuccess', async () => {
      const partitions = [{ foo: 1 }, { foo: 2 }];
      const buildPrompt = jest.fn(() => 'prompt');
      const executePartition = jest
        .fn()
        .mockResolvedValueOnce({ text: 'A' })
        .mockResolvedValueOnce({ text: 'B', fail: true });
      const extractContent = (resp) => resp.text;
      const trackSuccess = (resp, curr) => curr && !resp.fail;
      const result = await runPartitionedAiResponses({
        partitions,
        buildPrompt,
        executePartition,
        extractContent,
        trackSuccess,
      });
      expect(result.success).toBe(false);
      expect(result.content).toContain('A');
      expect(result.content).toContain('B');
    });

    it('should handle empty partitions', async () => {
      const result = await runPartitionedAiResponses({
        partitions: [],
        buildPrompt: jest.fn(),
        executePartition: jest.fn(),
      });
      expect(result.success).toBe(true);
      expect(result.content).toBe('');
    });

    it('should not add section if responseContent is falsy', async () => {
      const partitions = [{ foo: 1 }];
      const buildPrompt = jest.fn(() => 'prompt');
      const executePartition = jest.fn(async () => ({}));
      const extractContent = () => '';
      const result = await runPartitionedAiResponses({
        partitions,
        buildPrompt,
        executePartition,
        extractContent,
      });
      expect(result.content).toBe('');
    });
  });

  describe('runPartitionedAiAnalysis', () => {
    it('should join AI content from cache and helper', async () => {
      const partitions = [{ foo: 1 }, { foo: 2 }];
      const buildPrompt = jest.fn((p, ctx) => `prompt${ctx.index}`);
      const buildCacheKey = jest.fn((p, ctx) => `key${ctx.index}`);
      const aiCache = {
        withCache: jest.fn().mockImplementation((prompt, key, fn) => fn()),
      };
      const aiHelper = {
        executeRequest: jest
          .fn()
          .mockImplementation((prompt, { persona }) =>
            Promise.resolve({ content: `${persona}:${prompt}` })
          ),
      };
      const result = await runPartitionedAiAnalysis({
        partitions,
        buildPrompt,
        buildCacheKey,
        persona: 'testPersona',
        aiCache,
        aiHelper,
      });
      expect(result).toContain('testPersona:prompt0');
      expect(result).toContain('testPersona:prompt1');
      expect(aiCache.withCache).toHaveBeenCalledTimes(2);
      expect(aiHelper.executeRequest).toHaveBeenCalledTimes(2);
    });

    it('should handle empty partitions', async () => {
      const result = await runPartitionedAiAnalysis({
        partitions: [],
        buildPrompt: jest.fn(),
        buildCacheKey: jest.fn(),
        persona: 'persona',
        aiCache: { withCache: jest.fn() },
        aiHelper: { executeRequest: jest.fn() },
      });
      expect(result).toBe('');
    });
  });
});
