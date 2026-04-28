import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

const mockExistsSync = jest.fn();
const mockReadFileSync = jest.fn();
const mockWriteFileSync = jest.fn();

jest.unstable_mockModule('fs', () => ({
  default: {
    existsSync: mockExistsSync,
    readFileSync: mockReadFileSync,
    writeFileSync: mockWriteFileSync,
  },
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
}));

jest.unstable_mockModule('path', () => {
  const actual = jest.requireActual('path');
  return {
    ...actual,
    join: jest.fn((...args) => args.join('/')),
    dirname: jest.fn(() => '/mock/dirname'),
  };
});

jest.unstable_mockModule('url', () => ({
  fileURLToPath: jest.fn(() => '/mock/dirname/scripts/postprocess-typedoc-media-links.js'),
}));

const { postprocessTypedocMediaLinks } =
  await import('../../scripts/postprocess-typedoc-media-links.js');

describe('postprocess-typedoc-media-links.js', () => {
  const rewrites = [
    {
      filePath: '/mock/dirname/../docs/api/html/media/CHANGELOG.md',
      replacements: [
        [
          '(docs/reports/bugfixes/BUGFIX_WORKFLOWDIR_RESOLUTION_2026_02_21.md)',
          '(../../../reports/bugfixes/BUGFIX_WORKFLOWDIR_RESOLUTION_2026_02_21.md)',
        ],
      ],
    },
    {
      filePath: '/mock/dirname/../docs/api/html/media/CLEANUP_ARTIFACTS.md',
      replacements: [['(../../.ai_workflow/)', '(../../../../.ai_workflow/)']],
    },
    {
      filePath: '/mock/dirname/../docs/api/html/media/PREPARE_RELEASE.md',
      replacements: [['(../../CHANGELOG.md)', '(../../../../CHANGELOG.md)']],
    },
    {
      filePath: '/mock/dirname/../docs/api/html/media/MIGRATION_PLAN.md',
      replacements: [
        ['(../../guides/MIGRATION_GUIDE.md)', '(../../../guides/MIGRATION_GUIDE.md)'],
        ['(../../WORKFLOW_ENGINE_REQUIREMENTS.md)', '(../../../WORKFLOW_ENGINE_REQUIREMENTS.md)'],
        ['(../../ARCHITECTURE.md)', '(../../../ARCHITECTURE.md)'],
        ['(../../README.md)', '(../../../README.md)'],
      ],
    },
  ];

  let logSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('should update files with matching content and log correct count', async () => {
    mockExistsSync.mockImplementation(() => true);
    mockReadFileSync.mockImplementation((filePath) => {
      if (filePath === rewrites[0].filePath)
        return 'Some text (docs/reports/bugfixes/BUGFIX_WORKFLOWDIR_RESOLUTION_2026_02_21.md) more text';
      if (filePath === rewrites[1].filePath) return 'Link: (../../.ai_workflow/)';
      if (filePath === rewrites[2].filePath) return 'See (../../CHANGELOG.md)';
      if (filePath === rewrites[3].filePath) {
        return [
          '(../../guides/MIGRATION_GUIDE.md)',
          '(../../WORKFLOW_ENGINE_REQUIREMENTS.md)',
          '(../../ARCHITECTURE.md)',
          '(../../README.md)',
        ].join('\n');
      }
      return '';
    });

    postprocessTypedocMediaLinks();

    expect(mockWriteFileSync).toHaveBeenCalledTimes(4);
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      rewrites[0].filePath,
      'Some text (../../../reports/bugfixes/BUGFIX_WORKFLOWDIR_RESOLUTION_2026_02_21.md) more text',
      'utf-8'
    );
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      rewrites[1].filePath,
      'Link: (../../../../.ai_workflow/)',
      'utf-8'
    );
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      rewrites[2].filePath,
      'See (../../../../CHANGELOG.md)',
      'utf-8'
    );
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      rewrites[3].filePath,
      [
        '(../../../guides/MIGRATION_GUIDE.md)',
        '(../../../WORKFLOW_ENGINE_REQUIREMENTS.md)',
        '(../../../ARCHITECTURE.md)',
        '(../../../README.md)',
      ].join('\n'),
      'utf-8'
    );
    expect(logSpy).toHaveBeenCalledWith(
      'TypeDoc media link post-processing complete (4 file(s) updated).'
    );
  });

  it('should skip files that do not exist', async () => {
    mockExistsSync.mockImplementation((filePath) => filePath !== rewrites[1].filePath);
    mockReadFileSync.mockImplementation((filePath) => {
      if (filePath === rewrites[0].filePath) {
        return 'Some text (docs/reports/bugfixes/BUGFIX_WORKFLOWDIR_RESOLUTION_2026_02_21.md) more text';
      }
      if (filePath === rewrites[2].filePath) return 'See (../../CHANGELOG.md)';
      if (filePath === rewrites[3].filePath) return '(../../README.md)';
      return '';
    });

    postprocessTypedocMediaLinks();

    expect(mockWriteFileSync).toHaveBeenCalledTimes(3);
    expect(logSpy).toHaveBeenCalledWith(
      'TypeDoc media link post-processing complete (3 file(s) updated).'
    );
  });

  it('should not write files if no replacements are found', async () => {
    mockExistsSync.mockImplementation(() => true);
    mockReadFileSync.mockImplementation(() => 'No links to replace here');

    postprocessTypedocMediaLinks();

    expect(mockWriteFileSync).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(
      'TypeDoc media link post-processing complete (0 file(s) updated).'
    );
  });

  it('should handle files with multiple occurrences of the same link', async () => {
    mockExistsSync.mockImplementation(() => true);
    mockReadFileSync.mockImplementation((filePath) => {
      if (filePath === rewrites[0].filePath) {
        return '(docs/reports/bugfixes/BUGFIX_WORKFLOWDIR_RESOLUTION_2026_02_21.md) and again (docs/reports/bugfixes/BUGFIX_WORKFLOWDIR_RESOLUTION_2026_02_21.md)';
      }
      return '';
    });

    postprocessTypedocMediaLinks();

    expect(mockWriteFileSync).toHaveBeenCalledWith(
      rewrites[0].filePath,
      '(../../../reports/bugfixes/BUGFIX_WORKFLOWDIR_RESOLUTION_2026_02_21.md) and again (../../../reports/bugfixes/BUGFIX_WORKFLOWDIR_RESOLUTION_2026_02_21.md)',
      'utf-8'
    );
    expect(logSpy).toHaveBeenCalledWith(
      'TypeDoc media link post-processing complete (1 file(s) updated).'
    );
  });

  it('should propagate read errors', async () => {
    mockExistsSync.mockImplementation(() => true);
    mockReadFileSync.mockImplementation(() => {
      throw new Error('Read error');
    });

    expect(() => postprocessTypedocMediaLinks()).toThrow('Read error');
    expect(mockWriteFileSync).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('should propagate write errors', async () => {
    mockExistsSync.mockImplementation(() => true);
    mockReadFileSync.mockImplementation(() => '(../../CHANGELOG.md)');
    mockWriteFileSync.mockImplementation(() => {
      throw new Error('Write error');
    });

    expect(() => postprocessTypedocMediaLinks()).toThrow('Write error');
    expect(logSpy).not.toHaveBeenCalled();
  });
});
