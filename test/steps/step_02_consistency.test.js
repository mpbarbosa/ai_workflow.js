/**
 * Tests for Step 2: Consistency Analysis
 * @group steps
 */

import {
  Step2ConsistencyAnalyzer,
  validateSemver,
  extractVersions,
  checkVersionConsistency,
  extractLinks,
  isFileReference,
  normalizeFilePath,
  validateFileReferences,
  formatConsistencyReport,
  ISSUE_TYPE,
} from '../../src/steps/step_02_consistency.js';

describe('Step 2: Consistency Analysis', () => {
  // ========================================================================
  // PURE FUNCTIONS - Version Validation
  // ========================================================================

  describe('validateSemver', () => {
    test('validates correct semantic versions', () => {
      expect(validateSemver('1.0.0')).toBe(true);
      expect(validateSemver('0.1.0')).toBe(true);
      expect(validateSemver('10.20.30')).toBe(true);
    });

    test('validates versions with v prefix', () => {
      expect(validateSemver('v1.0.0')).toBe(true);
      expect(validateSemver('v2.3.4')).toBe(true);
    });

    test('validates prerelease versions', () => {
      expect(validateSemver('1.0.0-alpha')).toBe(true);
      expect(validateSemver('1.0.0-alpha.1')).toBe(true);
      expect(validateSemver('1.0.0-beta.2')).toBe(true);
    });

    test('validates versions with build metadata', () => {
      expect(validateSemver('1.0.0+20130313144700')).toBe(true);
      expect(validateSemver('1.0.0-beta+exp.sha.5114f85')).toBe(true);
    });

    test('rejects invalid versions', () => {
      expect(validateSemver('1.0')).toBe(false);
      expect(validateSemver('1')).toBe(false);
      expect(validateSemver('abc')).toBe(false);
      expect(validateSemver('1.0.0.0')).toBe(false);
    });

    test('handles edge cases', () => {
      expect(validateSemver('')).toBe(false);
      expect(validateSemver(null)).toBe(false);
      expect(validateSemver(undefined)).toBe(false);
    });
  });

  describe('extractVersions', () => {
    test('extracts single version', () => {
      const content = 'Version 1.2.3 is the latest';
      expect(extractVersions(content)).toContain('1.2.3');
    });

    test('extracts multiple versions', () => {
      const content = 'Upgraded from 1.0.0 to 2.0.0';
      const versions = extractVersions(content);
      expect(versions).toContain('1.0.0');
      expect(versions).toContain('2.0.0');
    });

    test('extracts versions with v prefix', () => {
      const content = 'Version v1.2.3 released';
      expect(extractVersions(content)).toContain('v1.2.3');
    });

    test('extracts prerelease versions', () => {
      const content = 'Try 1.0.0-beta.1 now';
      expect(extractVersions(content)).toContain('1.0.0-beta.1');
    });

    test('removes duplicates', () => {
      const content = '1.0.0 and 1.0.0 again';
      expect(extractVersions(content)).toHaveLength(1);
    });

    test('handles content with no versions', () => {
      const content = 'No versions here';
      expect(extractVersions(content)).toHaveLength(0);
    });
  });

  describe('checkVersionConsistency', () => {
    test('passes with consistent versions', () => {
      const fileVersions = [
        { file: 'README.md', versions: ['1.0.0'] },
        { file: 'CHANGELOG.md', versions: ['v1.0.0'] },
      ];
      const result = checkVersionConsistency(fileVersions, '1.0.0');

      expect(result.consistent).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    test('detects version mismatches', () => {
      const fileVersions = [
        { file: 'README.md', versions: ['1.0.0'] },
        { file: 'CHANGELOG.md', versions: ['2.0.0'] },
      ];
      const result = checkVersionConsistency(fileVersions, '1.0.0');

      expect(result.consistent).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues[0].file).toBe('CHANGELOG.md');
      expect(result.issues[0].found).toBe('2.0.0');
    });

    test('normalizes v prefix', () => {
      const fileVersions = [{ file: 'README.md', versions: ['v1.0.0'] }];
      const result = checkVersionConsistency(fileVersions, '1.0.0');

      expect(result.consistent).toBe(true);
    });

    test('tracks unique versions', () => {
      const fileVersions = [
        { file: 'README.md', versions: ['1.0.0', '2.0.0'] },
        { file: 'CHANGELOG.md', versions: ['1.0.0'] },
      ];
      const result = checkVersionConsistency(fileVersions, '1.0.0');

      expect(result.uniqueVersions).toContain('1.0.0');
      expect(result.uniqueVersions).toContain('2.0.0');
    });

    test('counts files checked', () => {
      const fileVersions = [
        { file: 'file1.md', versions: ['1.0.0'] },
        { file: 'file2.md', versions: ['1.0.0'] },
        { file: 'file3.md', versions: ['1.0.0'] },
      ];
      const result = checkVersionConsistency(fileVersions, '1.0.0');

      expect(result.totalChecked).toBe(3);
    });
  });

  // ========================================================================
  // PURE FUNCTIONS - Link Validation
  // ========================================================================

  describe('extractLinks', () => {
    test('extracts markdown links', () => {
      const content = 'See [documentation](docs/guide.md) for details';
      const links = extractLinks(content);

      expect(links).toHaveLength(1);
      expect(links[0].text).toBe('documentation');
      expect(links[0].url).toBe('docs/guide.md');
      expect(links[0].type).toBe('markdown');
    });

    test('extracts multiple links', () => {
      const content = '[Link 1](file1.md) and [Link 2](file2.md)';
      const links = extractLinks(content);

      expect(links).toHaveLength(2);
    });

    test('extracts autolinks', () => {
      const content = 'Visit <https://example.com> for more';
      const links = extractLinks(content);

      expect(links).toHaveLength(1);
      expect(links[0].type).toBe('autolink');
      expect(links[0].url).toBe('https://example.com');
    });

    test('tracks line numbers', () => {
      const content = 'Line 1\nSee [link](file.md) on line 2\nLine 3';
      const links = extractLinks(content);

      expect(links[0].line).toBe(2);
    });

    test('handles content with no links', () => {
      const content = 'No links in this content';
      expect(extractLinks(content)).toHaveLength(0);
    });
  });

  describe('isFileReference', () => {
    test('identifies file references', () => {
      expect(isFileReference('docs/guide.md')).toBe(true);
      expect(isFileReference('./README.md')).toBe(true);
      expect(isFileReference('../parent/file.md')).toBe(true);
    });

    test('excludes external URLs', () => {
      expect(isFileReference('https://example.com')).toBe(false);
      expect(isFileReference('http://example.com')).toBe(false);
    });

    test('excludes anchors', () => {
      expect(isFileReference('#section')).toBe(false);
    });
  });

  describe('normalizeFilePath', () => {
    test('removes anchor fragments', () => {
      expect(normalizeFilePath('file.md#section')).toBe('file.md');
    });

    test('removes leading ./', () => {
      expect(normalizeFilePath('./file.md')).toBe('file.md');
    });

    test('resolves relative to base', () => {
      expect(normalizeFilePath('guide.md', 'docs')).toBe('docs/guide.md');
    });

    test('handles multiple slashes', () => {
      expect(normalizeFilePath('docs//guide.md', 'base')).toBe('base/docs/guide.md');
    });
  });

  describe('validateFileReferences', () => {
    test('passes when all links exist', () => {
      const links = [
        { url: 'docs/guide.md', text: 'Guide', line: 1 },
        { url: 'README.md', text: 'README', line: 2 },
      ];
      const existingFiles = new Set(['docs/guide.md', 'README.md']);

      const issues = validateFileReferences(links, existingFiles, 'index.md');
      expect(issues).toHaveLength(0);
    });

    test('detects broken file links', () => {
      const links = [{ url: 'missing.md', text: 'Missing', line: 1 }];
      const existingFiles = new Set(['other.md']);

      const issues = validateFileReferences(links, existingFiles, 'index.md');
      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe(ISSUE_TYPE.BROKEN_LINK);
    });

    test('skips external URLs', () => {
      const links = [{ url: 'https://example.com', text: 'External', line: 1 }];
      const existingFiles = new Set();

      const issues = validateFileReferences(links, existingFiles, 'index.md');
      expect(issues).toHaveLength(0);
    });

    test('resolves relative paths', () => {
      const links = [{ url: './guide.md', text: 'Guide', line: 1 }];
      const existingFiles = new Set(['docs/guide.md']);

      const issues = validateFileReferences(links, existingFiles, 'docs/index.md');
      expect(issues).toHaveLength(0);
    });
  });

  // ========================================================================
  // PURE FUNCTIONS - Reporting
  // ========================================================================

  describe('formatConsistencyReport', () => {
    test('formats report with no issues', () => {
      const results = {
        filesChecked: 10,
        totalIssues: 0,
        brokenLinks: [],
        versionIssues: [],
      };
      const report = formatConsistencyReport(results);

      expect(report).toContain('## Step 2');
      expect(report).toContain('Files checked**: 10');
      expect(report).toContain('✅');
    });

    test('formats report with issues', () => {
      const results = {
        filesChecked: 5,
        totalIssues: 2,
        brokenLinks: [{ file: 'README.md', line: 10, text: 'Link', link: 'missing.md' }],
        versionIssues: [{ file: 'CHANGELOG.md', found: '2.0.0', expected: '1.0.0' }],
      };
      const report = formatConsistencyReport(results);

      expect(report).toContain('Total issues**: 2');
      expect(report).toContain('⚠️');
      expect(report).toContain('Broken Links');
      expect(report).toContain('Version Issues');
    });

    test('limits displayed issues', () => {
      const brokenLinks = Array.from({ length: 15 }, (_, i) => ({
        file: `file${i}.md`,
        line: i,
        text: 'Link',
        link: 'missing.md',
      }));

      const results = {
        filesChecked: 20,
        totalIssues: 15,
        brokenLinks,
        versionIssues: [],
      };
      const report = formatConsistencyReport(results);

      expect(report).toContain('... and 5 more');
    });
  });

  // ========================================================================
  // STEP 2 ANALYZER - Integration Tests
  // ========================================================================

  describe('Step2ConsistencyAnalyzer', () => {
    let analyzer;
    let mockFileOps;
    let mockBacklog;

    beforeEach(() => {
      mockFileOps = {
        readFile: () => Promise.resolve(''),
        glob: () => Promise.resolve([]),
      };

      mockBacklog = {
        saveStepSummary: () => Promise.resolve(),
      };

      analyzer = new Step2ConsistencyAnalyzer({
        fileOps: mockFileOps,
        backlog: mockBacklog,
      });
    });

    test('skips when no documentation found', async () => {
      mockFileOps.glob = () => Promise.resolve([]);

      const result = await analyzer.execute('/project');

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('no_docs');
    });

    test('executes successfully with documentation', async () => {
      mockFileOps.glob = () => Promise.resolve(['README.md', 'docs/guide.md']);
      mockFileOps.readFile = (path) => {
        if (path.endsWith('package.json')) {
          return Promise.resolve(JSON.stringify({ version: '1.0.0' }));
        }
        return Promise.resolve('Version 1.0.0\n[Link](guide.md)');
      };

      const result = await analyzer.execute('/project');

      expect(result.success).toBe(true);
      expect(result.filesChecked).toBe(2);
      expect(result.totalIssues).toBeDefined();
    });

    test('detects broken links', async () => {
      mockFileOps.glob = () => Promise.resolve(['README.md']);
      mockFileOps.readFile = () => Promise.resolve('[Link](missing.md)');

      const result = await analyzer.execute('/project');

      expect(result.success).toBe(true);
      expect(result.brokenLinks.length).toBeGreaterThan(0);
    });

    test('detects version inconsistencies', async () => {
      mockFileOps.glob = () => Promise.resolve(['README.md']);
      mockFileOps.readFile = (path) => {
        if (path.endsWith('package.json')) {
          return Promise.resolve(JSON.stringify({ version: '1.0.0' }));
        }
        return Promise.resolve('Version 2.0.0'); // Mismatch
      };

      const result = await analyzer.execute('/project');

      expect(result.success).toBe(true);
      expect(result.versionIssues.length).toBeGreaterThan(0);
    });

    test('handles missing package.json', async () => {
      mockFileOps.glob = () => Promise.resolve(['README.md']);
      mockFileOps.readFile = (path) => {
        if (path.endsWith('package.json')) {
          return Promise.reject(new Error('Not found'));
        }
        return Promise.resolve('Content');
      };

      const result = await analyzer.execute('/project');

      expect(result.success).toBe(true);
      expect(result.versionIssues).toHaveLength(0); // No version to check
    });

    test('saves report to backlog', async () => {
      let savedContent = null;
      mockFileOps.glob = () => Promise.resolve(['README.md']);
      mockFileOps.readFile = () => Promise.resolve('Content');
      mockBacklog.saveStepSummary = (step, title, content) => {
        savedContent = content;
        return Promise.resolve();
      };

      await analyzer.execute('/project');

      expect(savedContent).toBeTruthy();
      expect(savedContent).toContain('Step 2');
    });

    test('handles file system errors gracefully', async () => {
      mockFileOps.glob = () => Promise.reject(new Error('File system error'));

      // Should not throw, but return no docs found
      const result = await analyzer.execute('/project');

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('no_docs');
    });
  });
});
