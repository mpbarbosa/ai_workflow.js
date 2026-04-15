import fs from 'fs';
import path from 'path';

jest.mock('fs');
jest.mock('path', () => {
  const actual = jest.requireActual('path');
  return {
    ...actual,
    join: jest.fn((...args) => args.join('/')),
    dirname: jest.fn(() => '/mock/dirname'),
  };
});
jest.mock('url', () => ({
  fileURLToPath: jest.fn(() => '/mock/dirname/scripts/postprocess-typedoc-media-links.js'),
}));

// Re-import the script after mocks
beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
});

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
  ];

  it('should update files with matching content and log correct count', () => {
    // Setup: all files exist, all have content to replace
    fs.existsSync.mockImplementation((filePath) => true);
    fs.readFileSync.mockImplementation((filePath) => {
      if (filePath === rewrites[0].filePath)
        return 'Some text (docs/reports/bugfixes/BUGFIX_WORKFLOWDIR_RESOLUTION_2026_02_21.md) more text';
      if (filePath === rewrites[1].filePath)
        return 'Link: (../../.ai_workflow/)';
      if (filePath === rewrites[2].filePath)
        return 'See (../../CHANGELOG.md)';
      return '';
    });
    fs.writeFileSync.mockImplementation(() => {});

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    require('./postprocess-typedoc-media-links.js');

    expect(fs.writeFileSync).toHaveBeenCalledTimes(3);
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      rewrites[0].filePath,
      'Some text (../../../reports/bugfixes/BUGFIX_WORKFLOWDIR_RESOLUTION_2026_02_21.md) more text',
      'utf-8'
    );
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      rewrites[1].filePath,
      'Link: (../../../../.ai_workflow/)',
      'utf-8'
    );
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      rewrites[2].filePath,
      'See (../../../../CHANGELOG.md)',
      'utf-8'
    );
    expect(logSpy).toHaveBeenCalledWith(
      'TypeDoc media link post-processing complete (3 file(s) updated).'
    );
    logSpy.mockRestore();
  });

  it('should skip files that do not exist', () => {
    fs.existsSync.mockImplementation((filePath) => filePath !== rewrites[1].filePath);
    fs.readFileSync.mockImplementation(() => 'irrelevant');
    fs.writeFileSync.mockImplementation(() => {});
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    require('./postprocess-typedoc-media-links.js');

    // Only 2 files exist, so only 2 writes
    expect(fs.writeFileSync).toHaveBeenCalledTimes(2);
    expect(logSpy).toHaveBeenCalledWith(
      'TypeDoc media link post-processing complete (2 file(s) updated).'
    );
    logSpy.mockRestore();
  });

  it('should not write files if no replacements are found', () => {
    fs.existsSync.mockImplementation(() => true);
    fs.readFileSync.mockImplementation(() => 'No links to replace here');
    fs.writeFileSync.mockImplementation(() => {});
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    require('./postprocess-typedoc-media-links.js');

    expect(fs.writeFileSync).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(
      'TypeDoc media link post-processing complete (0 file(s) updated).'
    );
    logSpy.mockRestore();
  });

  it('should handle files with multiple occurrences of the same link', () => {
    fs.existsSync.mockImplementation(() => true);
    fs.readFileSync.mockImplementation((filePath) => {
      if (filePath === rewrites[0].filePath)
        return '(docs/reports/bugfixes/BUGFIX_WORKFLOWDIR_RESOLUTION_2026_02_21.md) and again (docs/reports/bugfixes/BUGFIX_WORKFLOWDIR_RESOLUTION_2026_02_21.md)';
      return '';
    });
    fs.writeFileSync.mockImplementation(() => {});
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    require('./postprocess-typedoc-media-links.js');

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      rewrites[0].filePath,
      '(../../../reports/bugfixes/BUGFIX_WORKFLOWDIR_RESOLUTION_2026_02_21.md) and again (../../../reports/bugfixes/BUGFIX_WORKFLOWDIR_RESOLUTION_2026_02_21.md)',
      'utf-8'
    );
    expect(logSpy).toHaveBeenCalledWith(
      'TypeDoc media link post-processing complete (1 file(s) updated).'
    );
    logSpy.mockRestore();
  });

  it('should not throw if readFileSync throws (simulate read error)', () => {
    fs.existsSync.mockImplementation(() => true);
    fs.readFileSync.mockImplementation(() => {
      throw new Error('Read error');
    });
    fs.writeFileSync.mockImplementation(() => {});
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    expect(() => require('./postprocess-typedoc-media-links.js')).not.toThrow();
    expect(fs.writeFileSync).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(
      'TypeDoc media link post-processing complete (0 file(s) updated).'
    );
    logSpy.mockRestore();
  });

  it('should not throw if writeFileSync throws (simulate write error)', () => {
    fs.existsSync.mockImplementation(() => true);
    fs.readFileSync.mockImplementation(() => '(../../CHANGELOG.md)');
    fs.writeFileSync.mockImplementation(() => {
      throw new Error('Write error');
    });
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    expect(() => require('./postprocess-typedoc-media-links.js')).not.toThrow();
    expect(logSpy).toHaveBeenCalledWith(
      'TypeDoc media link post-processing complete (0 file(s) updated).'
    );
    logSpy.mockRestore();
  });
});
