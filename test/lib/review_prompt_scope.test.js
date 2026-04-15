import { jest } from '@jest/globals';
import {
  buildPromptFileContentsBlock,
  buildPromptPartitions,
  filterReviewTargets,
  loadReadableReviewFiles,
  splitPromptEntry,
} from '../../src/lib/review_prompt_scope.js';

describe('review_prompt_scope', () => {
  test('filterReviewTargets deduplicates normalized paths through the predicate', () => {
    const predicate = jest.fn(
      (filePath) => filePath.endsWith('.js') && !filePath.startsWith('.ai_workflow/')
    );

    expect(
      filterReviewTargets(
        ['src\\index.js', 'src/index.js', 'README.md', '.ai_workflow/log.js'],
        predicate
      )
    ).toEqual(['src/index.js']);
    expect(predicate).toHaveBeenCalledWith('src/index.js');
  });

  test('loadReadableReviewFiles returns only readable file contents and entries', async () => {
    const fileOps = {
      readFile: jest.fn((filePath) => {
        if (filePath.endsWith('src/index.js')) return Promise.resolve('export const value = 1;\n');
        return Promise.reject(new Error('unreadable'));
      }),
    };

    const result = await loadReadableReviewFiles(fileOps, '/project', [
      'src/index.js',
      'src/missing.js',
    ]);

    expect(result.fileContents).toEqual(['export const value = 1;\n']);
    expect(result.fileEntries).toEqual([
      { relativePath: 'src/index.js', content: 'export const value = 1;\n' },
    ]);
  });

  test('loadReadableReviewFiles preserves input order across parallel reads', async () => {
    const fileOps = {
      readFile: jest.fn((filePath) => {
        if (filePath.endsWith('src/slow.js')) {
          return new Promise((resolve) => {
            setTimeout(() => resolve('slow\n'), 20);
          });
        }

        if (filePath.endsWith('src/fast.js')) {
          return new Promise((resolve) => {
            setTimeout(() => resolve('fast\n'), 1);
          });
        }

        return Promise.reject(new Error('unreadable'));
      }),
    };

    const result = await loadReadableReviewFiles(fileOps, '/project', [
      'src/slow.js',
      'src/fast.js',
    ]);

    expect(result.fileContents).toEqual(['slow\n', 'fast\n']);
    expect(result.fileEntries).toEqual([
      { relativePath: 'src/slow.js', content: 'slow\n' },
      { relativePath: 'src/fast.js', content: 'fast\n' },
    ]);
  });

  test('splitPromptEntry preserves full content across labeled parts', () => {
    const content = Array.from({ length: 1200 }, (_, index) => `line ${index}`).join('\n');
    const entries = splitPromptEntry({ relativePath: 'src/large.ts', content }, 1000);

    expect(entries.length).toBeGreaterThan(1);
    expect(entries[0].relativePath).toBe('src/large.ts (part 1/11)');
    expect(entries.at(-1)?.relativePath).toBe('src/large.ts (part 11/11)');
    expect(entries.map((entry) => entry.content).join('\n')).toBe(content);
  });

  test('buildPromptPartitions and buildPromptFileContentsBlock produce prompt-safe batches', () => {
    const fileEntries = Array.from({ length: 5 }, (_, index) => ({
      relativePath: `src/file${index}.html`,
      content: `<div>file ${index}</div>\n`,
    }));

    const partitions = buildPromptPartitions(fileEntries, {
      maxPartitionChars: 10_000,
      maxEntriesPerPartition: 4,
    });

    expect(partitions).toHaveLength(2);
    expect(partitions[0].scopePaths).toEqual([
      'src/file0.html',
      'src/file1.html',
      'src/file2.html',
      'src/file3.html',
    ]);
    expect(buildPromptFileContentsBlock(partitions[0].entries)).toContain('### `src/file0.html`');
  });
});
