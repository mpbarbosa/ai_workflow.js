import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import {
  getDefaultExclusionPatterns,
  parseGitignorePatterns,
  isExcluded,
  filterExcludedFiles,
  mergeExclusionPatterns,
  generateExclusionReport,
  ThirdPartyExclusionManager,
} from '../../src/lib/third_party_exclusion.js';

// ============================================================================
// PURE FUNCTION TESTS
// ============================================================================

describe('Third-Party Exclusion - Pure Functions', () => {
  describe('getDefaultExclusionPatterns', () => {
    it('should return Node.js patterns for nodejs_api', () => {
      const patterns = getDefaultExclusionPatterns('nodejs_api');

      expect(patterns).toContain('node_modules/**');
      expect(patterns).toContain('dist/**');
      expect(patterns).toContain('.git/**');
    });

    it('should return Python patterns for python_app', () => {
      const patterns = getDefaultExclusionPatterns('python_app');

      expect(patterns).toContain('venv/**');
      expect(patterns).toContain('__pycache__/**');
      expect(patterns).toContain('*.pyc');
    });

    it('should return React patterns for react_spa', () => {
      const patterns = getDefaultExclusionPatterns('react_spa');

      expect(patterns).toContain('node_modules/**');
      expect(patterns).toContain('.next/**');
    });

    it('should include common patterns for all project types', () => {
      const patterns = getDefaultExclusionPatterns('nodejs_api');

      expect(patterns).toContain('.git/**');
      expect(patterns).toContain('.vscode/**');
      expect(patterns).toContain('.DS_Store');
    });

    it('should return minimal patterns for generic project', () => {
      const patterns = getDefaultExclusionPatterns('generic');

      // Should have common patterns at least
      expect(patterns.length).toBeGreaterThan(5);
      expect(patterns).toContain('.git/**');
    });

    it('should include venv patterns for all project types (commonPatterns)', () => {
      for (const kind of ['nodejs_api', 'react_spa', 'generic', 'location_based_service']) {
        const patterns = getDefaultExclusionPatterns(kind);
        expect(patterns).toContain('venv/**');
        expect(patterns).toContain('.venv/**');
        expect(patterns).toContain('env/**');
      }
    });
  });

  describe('parseGitignorePatterns', () => {
    it('should parse basic patterns', () => {
      const gitignore = 'node_modules/\ndist/\n*.log';
      const patterns = parseGitignorePatterns(gitignore);

      expect(patterns).toContain('node_modules/**');
      expect(patterns).toContain('dist/**');
      expect(patterns).toContain('**/*.log');
    });

    it('should skip comments', () => {
      const gitignore = '# Comment\nnode_modules/\n# Another comment\ndist/';
      const patterns = parseGitignorePatterns(gitignore);

      expect(patterns.length).toBe(2);
      expect(patterns).toContain('node_modules/**');
    });

    it('should skip empty lines', () => {
      const gitignore = 'node_modules/\n\n\ndist/\n';
      const patterns = parseGitignorePatterns(gitignore);

      expect(patterns.length).toBe(2);
    });

    it('should handle patterns without slashes', () => {
      const gitignore = '*.log\n*.tmp';
      const patterns = parseGitignorePatterns(gitignore);

      expect(patterns).toContain('**/*.log');
      expect(patterns).toContain('**/*.tmp');
    });

    it('should skip negation patterns', () => {
      const gitignore = 'node_modules/\n!important.js';
      const patterns = parseGitignorePatterns(gitignore);

      expect(patterns.length).toBe(1);
      expect(patterns).toContain('node_modules/**');
    });

    it('should handle null input', () => {
      const patterns = parseGitignorePatterns(null);

      expect(patterns).toEqual([]);
    });
  });

  describe('isExcluded', () => {
    it('should exclude node_modules files', () => {
      const patterns = ['node_modules/**'];
      const result = isExcluded('node_modules/express/index.js', patterns);

      expect(result.excluded).toBe(true);
      expect(result.matchedPattern).toBe('node_modules/**');
    });

    it('should exclude files matching wildcard', () => {
      const patterns = ['**/*.log'];
      const result = isExcluded('logs/app.log', patterns);

      expect(result.excluded).toBe(true);
    });

    it('should not exclude non-matching files', () => {
      const patterns = ['node_modules/**', 'dist/**'];
      const result = isExcluded('src/index.js', patterns);

      expect(result.excluded).toBe(false);
      expect(result.matchedPattern).toBeNull();
    });

    it('should handle paths with multiple directories', () => {
      const patterns = ['**/test/**/*.js'];
      const result = isExcluded('src/test/utils/helper.js', patterns);

      expect(result.excluded).toBe(true);
    });

    it('should handle .git exclusion', () => {
      const patterns = ['.git/**'];
      const result = isExcluded('.git/config', patterns);

      expect(result.excluded).toBe(true);
    });

    it('should handle exact file matches', () => {
      const patterns = ['**/.DS_Store'];
      const result = isExcluded('.DS_Store', patterns);

      expect(result.excluded).toBe(true);
    });

    it('should handle null file path', () => {
      const patterns = ['node_modules/**'];
      const result = isExcluded(null, patterns);

      expect(result.excluded).toBe(false);
    });

    it('should handle empty patterns', () => {
      const result = isExcluded('src/index.js', []);

      expect(result.excluded).toBe(false);
    });
  });

  describe('filterExcludedFiles', () => {
    it('should filter out excluded files', () => {
      const files = ['src/index.js', 'node_modules/express/index.js', 'dist/bundle.js'];
      const patterns = ['node_modules/**', 'dist/**'];

      const result = filterExcludedFiles(files, patterns);

      expect(result.included).toEqual(['src/index.js']);
      expect(result.excluded.length).toBe(2);
    });

    it('should provide exclusion reasons', () => {
      const files = ['node_modules/express/index.js'];
      const patterns = ['node_modules/**'];

      const result = filterExcludedFiles(files, patterns);

      expect(result.excluded[0].path).toBe('node_modules/express/index.js');
      expect(result.excluded[0].pattern).toBe('node_modules/**');
      expect(result.excluded[0].reason).toContain('Matches exclusion pattern');
    });

    it('should handle all files included', () => {
      const files = ['src/index.js', 'src/utils.js'];
      const patterns = ['node_modules/**'];

      const result = filterExcludedFiles(files, patterns);

      expect(result.included).toEqual(files);
      expect(result.excluded).toEqual([]);
    });

    it('should handle all files excluded', () => {
      const files = ['node_modules/a.js', 'node_modules/b.js'];
      const patterns = ['node_modules/**'];

      const result = filterExcludedFiles(files, patterns);

      expect(result.included).toEqual([]);
      expect(result.excluded.length).toBe(2);
    });

    it('should handle empty file list', () => {
      const result = filterExcludedFiles([], ['node_modules/**']);

      expect(result.included).toEqual([]);
      expect(result.excluded).toEqual([]);
    });

    it('should handle empty patterns', () => {
      const files = ['src/index.js'];
      const result = filterExcludedFiles(files, []);

      expect(result.included).toEqual(files);
      expect(result.excluded).toEqual([]);
    });
  });

  describe('mergeExclusionPatterns', () => {
    it('should merge multiple pattern arrays', () => {
      const patterns1 = ['node_modules/**', 'dist/**'];
      const patterns2 = ['*.log', 'tmp/**'];

      const merged = mergeExclusionPatterns(patterns1, patterns2);

      expect(merged.length).toBe(4);
      expect(merged).toContain('node_modules/**');
      expect(merged).toContain('*.log');
    });

    it('should remove duplicates', () => {
      const patterns1 = ['node_modules/**', 'dist/**'];
      const patterns2 = ['node_modules/**', '*.log'];

      const merged = mergeExclusionPatterns(patterns1, patterns2);

      expect(merged.length).toBe(3);
      expect(merged.filter((p) => p === 'node_modules/**').length).toBe(1);
    });

    it('should handle empty arrays', () => {
      const merged = mergeExclusionPatterns([], ['*.log']);

      expect(merged).toEqual(['*.log']);
    });

    it('should handle no arguments', () => {
      const merged = mergeExclusionPatterns();

      expect(merged).toEqual([]);
    });
  });

  describe('generateExclusionReport', () => {
    it('should generate report with statistics', () => {
      const filterResult = {
        included: ['src/a.js', 'src/b.js'],
        excluded: [
          { path: 'node_modules/a.js', pattern: 'node_modules/**', reason: 'test' },
          { path: 'node_modules/b.js', pattern: 'node_modules/**', reason: 'test' },
          { path: 'dist/bundle.js', pattern: 'dist/**', reason: 'test' },
        ],
      };

      const report = generateExclusionReport(filterResult);

      expect(report).toContain('File Exclusion Report');
      expect(report).toContain('Total files: 5');
      expect(report).toContain('Included: 2');
      expect(report).toContain('Excluded: 3');
      expect(report).toContain('node_modules/**');
    });

    it('should handle no exclusions', () => {
      const filterResult = {
        included: ['src/a.js', 'src/b.js'],
        excluded: [],
      };

      const report = generateExclusionReport(filterResult);

      expect(report).toContain('Included: 2');
      expect(report).toContain('Excluded: 0');
    });

    it('should handle null input', () => {
      const report = generateExclusionReport(null);

      expect(report).toContain('No exclusion data');
    });
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('Third-Party Exclusion - Integration', () => {
  let tempDir;
  let manager;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-exclusion-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should initialize with default patterns for nodejs_api', async () => {
    manager = new ThirdPartyExclusionManager({
      projectRoot: tempDir,
      projectKind: 'nodejs_api',
    });

    await manager.initialize();

    const patterns = manager.getPatterns();
    expect(patterns).toContain('node_modules/**');
    expect(patterns).toContain('.git/**');
  });

  it('should load patterns from .gitignore', async () => {
    await fs.writeFile(path.join(tempDir, '.gitignore'), 'build/\n*.log\n');

    manager = new ThirdPartyExclusionManager({
      projectRoot: tempDir,
      projectKind: 'generic',
    });

    await manager.initialize();

    const patterns = manager.getPatterns();
    expect(patterns).toContain('build/**');
    expect(patterns).toContain('**/*.log');
  });

  it('should exclude node_modules files', async () => {
    manager = new ThirdPartyExclusionManager({
      projectRoot: tempDir,
      projectKind: 'nodejs_api',
    });

    await manager.initialize();

    const result = manager.isExcluded(path.join(tempDir, 'node_modules/express/index.js'));

    expect(result.excluded).toBe(true);
  });

  it('should filter file list correctly', async () => {
    manager = new ThirdPartyExclusionManager({
      projectRoot: tempDir,
      projectKind: 'nodejs_api',
    });

    await manager.initialize();

    const files = [
      path.join(tempDir, 'src/index.js'),
      path.join(tempDir, 'node_modules/express/index.js'),
      path.join(tempDir, 'dist/bundle.js'),
    ];

    const result = manager.filterFiles(files);

    expect(result.included).toHaveLength(1);
    expect(result.included[0]).toContain('src/index.js');
    expect(result.excluded).toHaveLength(2);
  });

  it('should get included files from project', async () => {
    // Create project structure
    await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });
    await fs.mkdir(path.join(tempDir, 'node_modules'), { recursive: true });
    await fs.writeFile(path.join(tempDir, 'src', 'index.js'), 'code');
    await fs.writeFile(path.join(tempDir, 'node_modules', 'pkg.js'), 'code');

    manager = new ThirdPartyExclusionManager({
      projectRoot: tempDir,
      projectKind: 'nodejs_api',
    });

    await manager.initialize();

    const included = await manager.getIncludedFiles();

    expect(included.some((f) => f.includes('src/index.js'))).toBe(true);
    expect(included.some((f) => f.includes('node_modules'))).toBe(false);
  });

  it('should add custom patterns', async () => {
    manager = new ThirdPartyExclusionManager({
      projectRoot: tempDir,
      projectKind: 'generic',
    });

    await manager.initialize();

    manager.addPatterns(['custom/**', '*.custom']);

    const patterns = manager.getPatterns();
    expect(patterns).toContain('custom/**');
    expect(patterns).toContain('*.custom');
  });

  it('should generate exclusion report', async () => {
    // Create files
    await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });
    await fs.mkdir(path.join(tempDir, 'node_modules'), { recursive: true });
    await fs.writeFile(path.join(tempDir, 'src', 'index.js'), 'code');
    await fs.writeFile(path.join(tempDir, 'node_modules', 'pkg.js'), 'code');

    manager = new ThirdPartyExclusionManager({
      projectRoot: tempDir,
      projectKind: 'nodejs_api',
    });

    await manager.initialize();

    const report = await manager.generateReport();

    expect(report).toContain('File Exclusion Report');
    expect(report).toContain('Total files:');
    expect(report).toContain('Excluded:');
  });

  it('should handle Python project patterns', async () => {
    manager = new ThirdPartyExclusionManager({
      projectRoot: tempDir,
      projectKind: 'python_app',
    });

    await manager.initialize();

    const patterns = manager.getPatterns();
    expect(patterns).toContain('venv/**');
    expect(patterns).toContain('__pycache__/**');
    expect(patterns).toContain('*.pyc');
  });

  it('should handle missing .gitignore gracefully', async () => {
    manager = new ThirdPartyExclusionManager({
      projectRoot: tempDir,
      projectKind: 'nodejs_api',
    });

    await manager.initialize();

    // Should still have default patterns
    const patterns = manager.getPatterns();
    expect(patterns.length).toBeGreaterThan(0);
  });
});
