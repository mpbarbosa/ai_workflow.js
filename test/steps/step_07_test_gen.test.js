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
  getTestOutputPath,
  buildSingleFileTestPrompt,
  extractTestCode,
  buildTestFilesSummary,
  MAX_FILES_TO_GENERATE,
  MAX_SOURCE_FILE_CHARS,
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

    test('JavaScript patterns include TypeScript and Vue for mixed projects', () => {
      const patterns = getSourcePatterns('javascript');
      expect(patterns).toContain('src/**/*.ts');
      expect(patterns).toContain('src/**/*.vue');
      expect(patterns).toContain('src/**/*.tsx');
    });

    // [BUG FIX a24b86d] jsx was missing — TypeScript/React projects use .jsx
    test('[BUG FIX] JavaScript patterns include JSX for React projects', () => {
      const patterns = getSourcePatterns('javascript');
      expect(patterns).toContain('src/**/*.jsx');
    });

    test('[BUG FIX] TypeScript patterns include tsx for React/TypeScript projects', () => {
      const patterns = getSourcePatterns('typescript');
      expect(patterns).toContain('src/**/*.tsx');
    });

    test('TypeScript patterns include Vue files', () => {
      const patterns = getSourcePatterns('typescript');
      expect(patterns).toContain('src/**/*.ts');
      expect(patterns).toContain('src/**/*.vue');
    });

    test('returns Python patterns', () => {
      const patterns = getSourcePatterns('python');
      expect(patterns).toContain('src/**/*.py');
    });

    test('defaults to JavaScript for unknown language', () => {
      const patterns = getSourcePatterns('unknown');
      expect(patterns).toContain('src/**/*.js');
    });

    test('defaults to JavaScript for null/undefined language', () => {
      expect(getSourcePatterns(null)).toContain('src/**/*.js');
      expect(getSourcePatterns(undefined)).toContain('src/**/*.js');
    });
  });

  describe('getTestPatterns', () => {
    test('returns JavaScript test patterns', () => {
      const patterns = getTestPatterns('javascript');
      expect(patterns).toContain('.test.js');
      expect(patterns).toContain('.spec.js');
    });

    test('JavaScript test patterns include TypeScript test patterns', () => {
      const patterns = getTestPatterns('javascript');
      expect(patterns).toContain('.test.ts');
      expect(patterns).toContain('.spec.ts');
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

    test('defaults to JavaScript for null/undefined language', () => {
      expect(getTestPatterns(null)).toContain('.test.js');
      expect(getTestPatterns(undefined)).toContain('.test.js');
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

    test('returns false for null/undefined filePath', () => {
      expect(shouldExcludeFile(null)).toBe(false);
      expect(shouldExcludeFile(undefined)).toBe(false);
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
  // PURE FUNCTIONS - AI test generation helpers
  // ========================================================================

  describe('getTestOutputPath', () => {
    test('JS: src/foo.js → test/foo.test.js', () => {
      expect(getTestOutputPath('src/foo.js', 'javascript')).toBe('test/foo.test.js');
    });

    test('TS: src/lib/bar.ts → test/lib/bar.test.ts', () => {
      expect(getTestOutputPath('src/lib/bar.ts', 'typescript')).toBe('test/lib/bar.test.ts');
    });

    test('Python: src/module.py → test/test_module.py', () => {
      expect(getTestOutputPath('src/module.py', 'python')).toBe('test/test_module.py');
    });

    test('Go: pkg/utils.go → test/utils_test.go', () => {
      expect(getTestOutputPath('pkg/utils.go', 'go')).toBe('test/pkg/utils_test.go');
    });

    test('Java: src/Foo.java → test/FooTest.java (mapped from src)', () => {
      expect(getTestOutputPath('src/Foo.java', 'java')).toBe('test/FooTest.java');
    });

    test('non-src dir: lib/helper.js → test/lib/helper.test.js', () => {
      expect(getTestOutputPath('lib/helper.js', 'javascript')).toBe('test/lib/helper.test.js');
    });
  });

  describe('buildSingleFileTestPrompt', () => {
    test('includes file path in prompt', () => {
      const prompt = buildSingleFileTestPrompt('src/foo.js', 'const x = 1;', 'javascript');
      expect(prompt).toContain('src/foo.js');
    });

    test('includes source content in prompt', () => {
      const prompt = buildSingleFileTestPrompt('src/foo.js', 'const x = 1;', 'javascript');
      expect(prompt).toContain('const x = 1;');
    });

    test('truncates content exceeding MAX_SOURCE_FILE_CHARS', () => {
      const big = 'x'.repeat(MAX_SOURCE_FILE_CHARS + 100);
      const prompt = buildSingleFileTestPrompt('src/foo.js', big, 'javascript');
      expect(prompt).toContain('...(truncated)');
    });

    test('includes language in prompt', () => {
      const prompt = buildSingleFileTestPrompt('src/foo.py', 'def f(): pass', 'python');
      expect(prompt).toContain('python');
    });
  });

  describe('extractTestCode', () => {
    test('extracts code from fenced block', () => {
      const response = 'Here is the test:\n```js\nconst x = 1;\n```\nDone.';
      expect(extractTestCode(response)).toBe('const x = 1;');
    });

    test('extracts code from language-tagged block', () => {
      const response = '```typescript\nimport foo from "./foo";\n```';
      expect(extractTestCode(response)).toBe('import foo from "./foo";');
    });

    test('returns null when no code block present', () => {
      expect(extractTestCode('No code here')).toBeNull();
    });

    test('handles multiline code blocks', () => {
      const response = '```js\nline1\nline2\nline3\n```';
      expect(extractTestCode(response)).toBe('line1\nline2\nline3');
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
    let mockAiHelper;
    let mockAiCache;

    beforeEach(() => {
      mockFileOps = {
        glob: () => Promise.resolve([]),
        readFile: () => Promise.reject(new Error('not found')),
        writeFile: () => Promise.resolve(),
      };

      mockBacklog = {
        saveStepSummary: () => Promise.resolve(),
      };

      mockTechStack = {
        detectAll: () => Promise.resolve({ languages: ['javascript'] }),
      };

      mockAiHelper = {
        initialize: () => Promise.resolve(false), // disabled by default in unit tests
        executeRequest: () => Promise.resolve({ content: '```js\ntest code\n```' }),
      };

      mockAiCache = {
        init: () => Promise.resolve(),
        withCache: (_prompt, _key, fn) => fn(),
        withFileChangeGuard: (_stepId, _fileContents, fn) => fn(),
      };

      generator = new Step7TestGenerator({
        fileOps: mockFileOps,
        backlog: mockBacklog,
        techStack: mockTechStack,
        aiHelper: mockAiHelper,
        aiCache: mockAiCache,
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

    test('result includes generatedFiles array', async () => {
      mockFileOps.glob = () => Promise.resolve([]);
      const result = await generator.execute('/project');
      expect(Array.isArray(result.generatedFiles)).toBe(true);
    });

    test('AI generates test file for untested source file', async () => {
      // Source file exists, test file does not
      mockFileOps.glob = (pattern) => {
        if (pattern.includes('src/**/*.js')) return Promise.resolve(['src/utils.js']);
        return Promise.resolve([]);
      };
      mockFileOps.readFile = (p) => {
        if (p.includes('utils.js') && !p.includes('test')) return Promise.resolve('const x = 1;');
        return Promise.reject(new Error('not found')); // test file does not exist yet
      };
      mockAiHelper.initialize = () => Promise.resolve(true);

      let writtenPath = null;
      mockFileOps.writeFile = (p) => {
        writtenPath = p;
        return Promise.resolve();
      };

      const result = await generator.execute('/project');

      expect(result.generatedFiles).toHaveLength(1);
      expect(writtenPath).toContain('utils.test.js');
    });

    test('AI generation is skipped when AI unavailable', async () => {
      mockFileOps.glob = (pattern) => {
        if (pattern.includes('src/**/*.js')) return Promise.resolve(['src/utils.js']);
        return Promise.resolve([]);
      };
      mockAiHelper.initialize = () => Promise.resolve(false);

      let writeCount = 0;
      mockFileOps.writeFile = () => {
        writeCount++;
        return Promise.resolve();
      };

      const result = await generator.execute('/project');

      expect(writeCount).toBe(0);
      expect(result.generatedFiles).toHaveLength(0);
    });

    test('AI generation error does not fail the step', async () => {
      mockFileOps.glob = (pattern) => {
        if (pattern.includes('src/**/*.js')) return Promise.resolve(['src/utils.js']);
        return Promise.resolve([]);
      };
      mockAiHelper.initialize = () => Promise.resolve(true);
      mockAiHelper.executeRequest = () => Promise.reject(new Error('AI timeout'));
      mockFileOps.readFile = () => Promise.resolve('const x = 1;');

      const result = await generator.execute('/project');

      expect(result.success).toBe(true);
    });

    test('respects MAX_FILES_TO_GENERATE cap', async () => {
      const manyFiles = Array.from({ length: 10 }, (_, i) => `src/file${i}.js`);
      mockFileOps.glob = (pattern) => {
        if (pattern.includes('src/**/*.js')) return Promise.resolve(manyFiles);
        return Promise.resolve([]);
      };
      mockFileOps.readFile = (p) => {
        if (!p.includes('.test.')) return Promise.resolve('const x = 1;');
        return Promise.reject(new Error('not found'));
      };
      mockAiHelper.initialize = () => Promise.resolve(true);

      const writtenPaths = [];
      mockFileOps.writeFile = (p) => {
        writtenPaths.push(p);
        return Promise.resolve();
      };

      await generator.execute('/project');

      expect(writtenPaths.length).toBeLessThanOrEqual(MAX_FILES_TO_GENERATE);
    });

    test('skips existing test files', async () => {
      mockFileOps.glob = (pattern) => {
        if (pattern.includes('src/**/*.js')) return Promise.resolve(['src/utils.js']);
        return Promise.resolve([]);
      };
      // Both source and test file "exist"
      mockFileOps.readFile = () => Promise.resolve('existing content');
      mockAiHelper.initialize = () => Promise.resolve(true);

      let writeCount = 0;
      mockFileOps.writeFile = () => {
        writeCount++;
        return Promise.resolve();
      };

      const result = await generator.execute('/project');

      expect(writeCount).toBe(0);
      expect(result.generatedFiles).toHaveLength(0);
    });
  });

  // ==========================================================================
  // PURE FUNCTIONS - buildTestFilesSummary
  // ==========================================================================

  describe('buildTestFilesSummary', () => {
    test('returns "none" for empty array', () => {
      expect(buildTestFilesSummary([])).toBe('none');
    });

    test('returns "none" for null/undefined', () => {
      expect(buildTestFilesSummary(null)).toBe('none');
      expect(buildTestFilesSummary(undefined)).toBe('none');
    });

    test('reports total count and single directory', () => {
      const files = ['test/a.test.js', 'test/b.test.js', 'test/c.test.js'];
      const result = buildTestFilesSummary(files);
      expect(result).toContain('3 test files');
      expect(result).toContain('test/');
      expect(result).toContain('(3)');
    });

    test('groups files by top-level directory', () => {
      const files = [
        '__tests__/unit/foo.test.ts',
        '__tests__/integration/bar.test.ts',
        'test/baz.test.js',
      ];
      const result = buildTestFilesSummary(files);
      expect(result).toContain('__tests__/');
      expect(result).toContain('test/');
      expect(result).toContain('3 test files across 2 directories');
    });

    test('shows sample filenames (basenames, up to 3)', () => {
      const files = [
        '__tests__/a.test.ts',
        '__tests__/b.test.ts',
        '__tests__/c.test.ts',
        '__tests__/d.test.ts',
      ];
      const result = buildTestFilesSummary(files);
      expect(result).toContain('a.test.ts');
      expect(result).toContain('+1 more');
    });

    test('does not append "more" when exactly 3 files in a dir', () => {
      const files = ['t/a.test.js', 't/b.test.js', 't/c.test.js'];
      const result = buildTestFilesSummary(files);
      expect(result).not.toContain('more');
    });

    test('handles large portfolio (174 files) without slicing', () => {
      const files = Array.from({ length: 174 }, (_, i) => `__tests__/unit/file${i}.test.ts`);
      const result = buildTestFilesSummary(files);
      expect(result).toContain('174 test files');
      expect(result).toContain('+171 more');
    });

    test('handles root-level files (no directory separator)', () => {
      const files = ['a.test.js', 'b.test.js'];
      const result = buildTestFilesSummary(files);
      expect(result).toContain('(root)/');
    });
  });
});
