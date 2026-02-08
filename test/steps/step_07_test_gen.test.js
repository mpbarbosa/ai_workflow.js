/**
 * Tests for Step 7: Test Generation
 * @group steps
 */

import {
  Step7TestGenerator,
  getSourcePatterns,
  getTestPatterns,
  shouldExcludeFile,
  hasCorrespondingTest,
  findUntestedFiles,
  calculateCoverage,
  categorizeUntestedFiles,
  formatTestGenerationReport,
} from '../../src/steps/step_07_test_gen.js';

describe('Step 7: Test Generation', () => {
  // ========================================================================
  // PURE FUNCTIONS - Test Gap Detection
  // ========================================================================

  describe('getSourcePatterns', () => {
    test('returns JavaScript patterns', () => {
      const patterns = getSourcePatterns('javascript');
      expect(patterns).toContain('src/**/*.js');
    });

    test('returns Python patterns', () => {
      const patterns = getSourcePatterns('python');
      expect(patterns).toContain('src/**/*.py');
    });

    test('defaults to JavaScript for unknown language', () => {
      const patterns = getSourcePatterns('unknown');
      expect(patterns).toContain('src/**/*.js');
    });
  });

  describe('getTestPatterns', () => {
    test('returns JavaScript test patterns', () => {
      const patterns = getTestPatterns('javascript');
      expect(patterns).toContain('.test.js');
      expect(patterns).toContain('.spec.js');
    });

    test('returns Python test patterns', () => {
      const patterns = getTestPatterns('python');
      expect(patterns).toContain('test_');
      expect(patterns).toContain('_test.py');
    });

    test('defaults to JavaScript for unknown language', () => {
      const patterns = getTestPatterns('unknown');
      expect(patterns).toContain('.test.js');
    });
  });

  describe('shouldExcludeFile', () => {
    test('excludes __init__.py', () => {
      expect(shouldExcludeFile('src/__init__.py')).toBe(true);
    });

    test('excludes index.js', () => {
      expect(shouldExcludeFile('src/index.js')).toBe(true);
    });

    test('excludes config.js', () => {
      expect(shouldExcludeFile('src/config.js')).toBe(true);
    });

    test('includes regular files', () => {
      expect(shouldExcludeFile('src/utils.js')).toBe(false);
      expect(shouldExcludeFile('src/module.py')).toBe(false);
    });
  });

  describe('hasCorrespondingTest', () => {
    test('finds JavaScript test with .test.js', () => {
      const result = hasCorrespondingTest('src/utils.js', ['src/utils.test.js'], 'javascript');
      expect(result).toBe(true);
    });

    test('finds JavaScript test with .spec.js', () => {
      const result = hasCorrespondingTest('src/utils.js', ['src/utils.spec.js'], 'javascript');
      expect(result).toBe(true);
    });

    test('finds JavaScript test in __tests__', () => {
      const result = hasCorrespondingTest(
        'src/utils.js',
        ['src/__tests__/utils.test.js'],
        'javascript'
      );
      expect(result).toBe(true);
    });

    test('finds Python test with test_ prefix', () => {
      const result = hasCorrespondingTest('src/module.py', ['src/test_module.py'], 'python');
      expect(result).toBe(true);
    });

    test('finds Python test with _test.py suffix', () => {
      const result = hasCorrespondingTest('src/module.py', ['src/module_test.py'], 'python');
      expect(result).toBe(true);
    });

    test('finds Go test', () => {
      const result = hasCorrespondingTest('utils.go', ['utils_test.go'], 'go');
      expect(result).toBe(true);
    });

    test('returns false when no test found', () => {
      const result = hasCorrespondingTest('src/utils.js', ['src/other.test.js'], 'javascript');
      expect(result).toBe(false);
    });
  });

  describe('findUntestedFiles', () => {
    test('identifies untested JavaScript files', () => {
      const result = findUntestedFiles({
        sourceFiles: ['src/utils.js', 'src/helpers.js'],
        testFiles: ['src/utils.test.js'],
        language: 'javascript',
      });

      expect(result).toContain('src/helpers.js');
      expect(result).not.toContain('src/utils.js');
    });

    test('excludes files that should be excluded', () => {
      const result = findUntestedFiles({
        sourceFiles: ['src/utils.js', 'src/index.js'],
        testFiles: [],
        language: 'javascript',
      });

      expect(result).toContain('src/utils.js');
      expect(result).not.toContain('src/index.js');
    });

    test('excludes test files from untested list', () => {
      const result = findUntestedFiles({
        sourceFiles: ['src/utils.js', 'src/utils.test.js'],
        testFiles: ['src/utils.test.js'],
        language: 'javascript',
      });

      expect(result).not.toContain('src/utils.test.js');
    });

    test('handles empty arrays', () => {
      const result = findUntestedFiles({
        sourceFiles: [],
        testFiles: [],
        language: 'javascript',
      });

      expect(result).toHaveLength(0);
    });
  });

  describe('calculateCoverage', () => {
    test('calculates 100% coverage', () => {
      expect(calculateCoverage(10, 10)).toBe(100);
    });

    test('calculates 50% coverage', () => {
      expect(calculateCoverage(5, 10)).toBe(50);
    });

    test('calculates 0% coverage', () => {
      expect(calculateCoverage(0, 10)).toBe(0);
    });

    test('handles zero total files', () => {
      expect(calculateCoverage(0, 0)).toBe(0);
    });

    test('rounds to nearest integer', () => {
      expect(calculateCoverage(7, 10)).toBe(70);
    });
  });

  describe('categorizeUntestedFiles', () => {
    test('categorizes files by directory', () => {
      const files = ['src/utils.js', 'src/helpers.js', 'lib/parser.js'];
      const result = categorizeUntestedFiles(files);

      expect(result.src).toHaveLength(2);
      expect(result.lib).toHaveLength(1);
    });

    test('categorizes root files', () => {
      const files = ['utils.js', 'helpers.js'];
      const result = categorizeUntestedFiles(files);

      expect(result.root).toHaveLength(2);
    });

    test('handles empty array', () => {
      const result = categorizeUntestedFiles([]);
      expect(Object.keys(result)).toHaveLength(0);
    });
  });

  // ========================================================================
  // PURE FUNCTIONS - Reporting
  // ========================================================================

  describe('formatTestGenerationReport', () => {
    test('formats report with 100% coverage', () => {
      const results = {
        totalSourceFiles: 10,
        totalTestFiles: 10,
        untestedFiles: [],
        coveragePercentage: 100,
        categories: {},
      };

      const report = formatTestGenerationReport(results);

      expect(report).toContain('Test Generation Report');
      expect(report).toContain('**Total Source Files**: 10');
      expect(report).toContain('**Test Coverage**: 100%');
      expect(report).toContain('Excellent Coverage');
    });

    test('formats report with good coverage', () => {
      const results = {
        totalSourceFiles: 10,
        totalTestFiles: 9,
        untestedFiles: ['src/utils.js'],
        coveragePercentage: 90,
        categories: { src: ['src/utils.js'] },
      };

      const report = formatTestGenerationReport(results);

      expect(report).toContain('Good Coverage');
      expect(report).toContain('90%');
    });

    test('formats report with moderate coverage', () => {
      const results = {
        totalSourceFiles: 10,
        totalTestFiles: 6,
        untestedFiles: ['src/a.js', 'src/b.js', 'src/c.js', 'src/d.js'],
        coveragePercentage: 60,
        categories: {},
      };

      const report = formatTestGenerationReport(results);

      expect(report).toContain('Moderate Coverage');
      expect(report).toContain('60%');
    });

    test('formats report with low coverage', () => {
      const results = {
        totalSourceFiles: 10,
        totalTestFiles: 2,
        untestedFiles: Array(8).fill('src/file.js'),
        coveragePercentage: 20,
        categories: {},
      };

      const report = formatTestGenerationReport(results);

      expect(report).toContain('Low Coverage');
      expect(report).toContain('20%');
    });

    test('includes recommendations for untested files', () => {
      const results = {
        totalSourceFiles: 10,
        totalTestFiles: 5,
        untestedFiles: ['src/utils.js'],
        coveragePercentage: 50,
        categories: {},
      };

      const report = formatTestGenerationReport(results);

      expect(report).toContain('Recommendations');
      expect(report).toContain('Prioritize testing');
    });

    test('truncates long untested lists', () => {
      const untestedFiles = Array(25)
        .fill(null)
        .map((_, i) => `src/file${i}.js`);

      const results = {
        totalSourceFiles: 30,
        totalTestFiles: 5,
        untestedFiles,
        coveragePercentage: 17,
        categories: {},
      };

      const report = formatTestGenerationReport(results);

      expect(report).toContain('... and 5 more');
    });
  });

  // ========================================================================
  // STEP 7 ANALYZER - Integration Tests
  // ========================================================================

  describe('Step7TestGenerator', () => {
    let generator;
    let mockFileOps;
    let mockBacklog;
    let mockTechStack;

    beforeEach(() => {
      mockFileOps = {
        glob: () => Promise.resolve([]),
      };

      mockBacklog = {
        saveStepSummary: () => Promise.resolve(),
      };

      mockTechStack = {
        detectAll: () => Promise.resolve({ languages: ['javascript'] }),
      };

      generator = new Step7TestGenerator({
        fileOps: mockFileOps,
        backlog: mockBacklog,
        techStack: mockTechStack,
      });
    });

    test('executes successfully with full coverage', async () => {
      mockFileOps.glob = (pattern) => {
        if (pattern.includes('src/**/*.js')) {
          return Promise.resolve(['src/utils.js', 'src/helpers.js']);
        }
        if (pattern.includes('**/*.test.js')) {
          return Promise.resolve(['src/utils.test.js', 'src/helpers.test.js']);
        }
        return Promise.resolve([]);
      };

      const result = await generator.execute('/project');

      expect(result.success).toBe(true);
      expect(result.coveragePercentage).toBe(100);
      expect(result.untestedFiles).toHaveLength(0);
    });

    test('identifies untested files', async () => {
      mockFileOps.glob = (pattern) => {
        if (pattern.includes('src/**/*.js')) {
          return Promise.resolve(['src/utils.js', 'src/helpers.js']);
        }
        if (pattern.includes('**/*.test.js')) {
          return Promise.resolve(['src/utils.test.js']);
        }
        return Promise.resolve([]);
      };

      const result = await generator.execute('/project');

      expect(result.success).toBe(true);
      expect(result.coveragePercentage).toBe(50);
      expect(result.untestedFiles).toContain('src/helpers.js');
    });

    test('handles no source files', async () => {
      mockFileOps.glob = () => Promise.resolve([]);

      const result = await generator.execute('/project');

      expect(result.success).toBe(true);
      expect(result.totalSourceFiles).toBe(0);
      expect(result.coveragePercentage).toBe(0);
    });

    test('saves report to backlog', async () => {
      let savedTitle = '';
      mockBacklog.saveStepSummary = (step, title) => {
        savedTitle = title;
        return Promise.resolve();
      };

      mockFileOps.glob = () => Promise.resolve([]);

      await generator.execute('/project');

      expect(savedTitle).toBe('Test Generation');
    });

    test('handles glob errors gracefully', async () => {
      // Glob errors are caught and ignored in discoverSourceFiles/discoverTestFiles
      mockFileOps.glob = () => Promise.reject(new Error('File system error'));

      const result = await generator.execute('/project');

      // Should complete with no files found
      expect(result.success).toBe(true);
      expect(result.totalSourceFiles).toBe(0);
    });

    test('handles tech stack detection errors', async () => {
      mockTechStack.detectAll = () => Promise.reject(new Error('Detection error'));

      // Should fallback to javascript
      mockFileOps.glob = () => Promise.resolve([]);
      const result = await generator.execute('/project');

      expect(result.success).toBe(true);
    });
  });
});
