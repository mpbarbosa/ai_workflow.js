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
  canBeTypeOnlySourceFile,
  isTypeOnlySourceFile,
  categorizeUntestedFiles,
  formatTestGenerationReport,
  getTestOutputPath,
  buildSingleFileTestPrompt,
  buildTargetModuleSpecifiers,
  extractTestCode,
  findGeneratedTestProblems,
  buildTestFilesSummary,
  usesRuntimeTargetModule,
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

    test('excludes minified and vendored assets', () => {
      expect(shouldExcludeFile('src/assets/js/jquery.min.js')).toBe(true);
      expect(shouldExcludeFile('src/vendor/react.js')).toBe(true);
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

    test('can include excluded unmatched files for raw inventory accounting', () => {
      const result = findUntestedFiles({
        sourceFiles: ['src/assets/js/jquery.min.js', 'src/utils.js'],
        testFiles: [],
        language: 'javascript',
        includeExcluded: true,
      });

      expect(result).toContain('src/assets/js/jquery.min.js');
      expect(result).toContain('src/utils.js');
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

  describe('type-only source detection', () => {
    test('detects TypeScript declaration-only modules', () => {
      expect(canBeTypeOnlySourceFile('src/types/contracts.ts')).toBe(true);
      expect(
        isTypeOnlySourceFile(
          'src/types/contracts.ts',
          'import type { Foo } from "./foo.js";\nexport interface Bar { baz: Foo }\nexport type Qux = string;\n'
        )
      ).toBe(true);
    });

    test('does not classify runtime exports as type-only', () => {
      expect(
        isTypeOnlySourceFile(
          'src/status.ts',
          'export enum Status { Ready, Waiting }\nexport interface Metadata { ok: boolean }\n'
        )
      ).toBe(false);
      expect(
        isTypeOnlySourceFile(
          'src/runtime.ts',
          'export interface Foo { value: number }\nexport const answer = 42;\n'
        )
      ).toBe(false);
    });

    test('treats .d.ts files as type-only', () => {
      expect(isTypeOnlySourceFile('src/contracts.d.ts', 'export interface Foo {}')).toBe(true);
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

  describe('formatTestGenerationReport', () => {
    test('reports excluded unmatched assets separately from actionable gaps', () => {
      const report = formatTestGenerationReport({
        totalSourceFiles: 5,
        totalActionableSourceFiles: 4,
        totalTestFiles: 2,
        rawUntestedFiles: ['src/assets/js/jquery.min.js', 'src/utils.js'],
        untestedFiles: ['src/utils.js'],
        excludedUntestedFiles: ['src/assets/js/jquery.min.js'],
        categories: { src: ['src/utils.js'] },
      });

      expect(report).toContain('**Untested Files**: 1');
      expect(report).toContain('**Excluded From Actionable Gaps**: 1');
      expect(report).toContain('excluded from action because they appear to be minified');
    });

    test('reports type-only files separately from actionable gaps', () => {
      const report = formatTestGenerationReport({
        totalSourceFiles: 3,
        totalActionableSourceFiles: 1,
        totalTestFiles: 1,
        rawUntestedFiles: ['src/types/contracts.ts'],
        untestedFiles: ['src/runtime/service.ts'],
        excludedUntestedFiles: [],
        typeOnlySourceFiles: ['src/types/contracts.ts'],
        categories: { src: ['src/runtime/service.ts'] },
      });

      expect(report).toContain('**Type-Only Source Files Excluded**: 1');
      expect(report).toContain('declaration-only TypeScript file(s) were excluded');
    });
  });

  // ========================================================================
  // PURE FUNCTIONS - Reporting
  // ========================================================================

  describe('formatTestGenerationReport', () => {
    test('formats report with complete test file inventory', () => {
      const results = {
        totalSourceFiles: 10,
        totalActionableSourceFiles: 10,
        totalTestFiles: 10,
        untestedFiles: [],
        coveragePercentage: 100,
        categories: {},
      };

      const report = formatTestGenerationReport(results);

      expect(report).toContain('Test Generation Report');
      expect(report).toContain('**Total Source Files**: 10');
      expect(report).toContain('**Matched Actionable Source Files**: 10/10');
      expect(report).toContain('Inventory Type');
      expect(report).toContain('Test File Inventory Complete');
    });

    test('formats report with inventory gaps when files are untested', () => {
      const results = {
        totalSourceFiles: 10,
        totalActionableSourceFiles: 10,
        totalTestFiles: 9,
        untestedFiles: ['src/utils.js'],
        coveragePercentage: 90,
        categories: { src: ['src/utils.js'] },
      };

      const report = formatTestGenerationReport(results);

      expect(report).toContain('Test File Inventory Gaps');
      expect(report).toContain('1 of 10 actionable runtime source file(s)');
    });

    test('includes recommendations for untested files', () => {
      const results = {
        totalSourceFiles: 10,
        totalActionableSourceFiles: 10,
        totalTestFiles: 5,
        untestedFiles: ['src/utils.js'],
        coveragePercentage: 50,
        categories: {},
      };

      const report = formatTestGenerationReport(results);

      expect(report).toContain('Recommendations');
      expect(report).toContain('Prioritize testing');
      expect(report).toContain(
        'Confirm measured coverage with the real test runner coverage report'
      );
    });

    test('truncates long untested lists', () => {
      const untestedFiles = Array(25)
        .fill(null)
        .map((_, i) => `src/file${i}.js`);

      const results = {
        totalSourceFiles: 30,
        totalActionableSourceFiles: 30,
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

    test('Vue TS: src/components/AppBar.vue → __tests__/components/AppBar.vue.test.ts when preferred root is __tests__', () => {
      expect(
        getTestOutputPath('src/components/AppBar.vue', 'typescript', {
          preferredTestRoot: '__tests__',
        })
      ).toBe('__tests__/components/AppBar.vue.test.ts');
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

  describe('buildTargetModuleSpecifiers', () => {
    test('includes extensionless and .js specifiers for TypeScript sources', () => {
      const specifiers = buildTargetModuleSpecifiers(
        'src/types/contracts.ts',
        '__tests__/types/contracts.test.ts'
      );

      expect(specifiers).toEqual(
        new Set([
          '../../src/types/contracts.ts',
          '../../src/types/contracts',
          '../../src/types/contracts.js',
        ])
      );
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

    test('uses framework-specific mock API guidance in prompt', () => {
      const prompt = buildSingleFileTestPrompt(
        'src/foo.ts',
        'export const foo = 1;',
        'typescript',
        null,
        'test/foo.test.ts',
        { detectedTestFramework: 'vitest', mockApiGuidance: '`vi.mock()` with a factory function' }
      );
      expect(prompt).toContain('`vi.mock()` with a factory function');
      expect(prompt).not.toContain('`jest.mock()` with a factory function instead');
    });

    test('uses the target test extension for the output fence while preserving the source fence', () => {
      const prompt = buildSingleFileTestPrompt(
        'src/components/views/ExtraView.vue',
        '<template><div /></template>',
        'typescript',
        null,
        '__tests__/components/views/ExtraView.vue.test.ts'
      );

      expect(prompt).toContain('single fenced code block (```ts ... ```)');
      expect(prompt).toContain('```vue\n<template><div /></template>\n```');
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

  describe('findGeneratedTestProblems', () => {
    test('rejects @ts-expect-error, placeholder comments, and forbidden dynamic import shims', () => {
      const problems = findGeneratedTestProblems({
        testCode: [
          '// @ts-expect-error test helper',
          '// Add any other required fields if present in real CachedLocationSnapshot',
          "const shim = globalThis['import'];",
        ].join('\n'),
        testOutputPath: '__tests__/composables/useLocationSnapshot.test.ts',
        testFramework: 'Jest',
      });

      expect(problems).toEqual([
        'generated test uses `@ts-expect-error` despite the prompt forbidding type-error suppressions',
        'generated test contains placeholder comments instead of an implemented mocking/lifecycle strategy',
        "generated test uses `globalThis['import']`, which step_07 explicitly forbids",
      ]);
    });

    test('rejects Vue SFC output and Vitest APIs for Jest projects', () => {
      const problems = findGeneratedTestProblems({
        testCode: [
          '<script lang="ts">',
          "import { vi } from '@jest/globals';",
          "vi.mock('vue-router', () => ({ useRoute: vi.fn() }));",
          '</script>',
        ].join('\n'),
        testOutputPath: '__tests__/components/views/BottomNav.vue.test.ts',
        testFramework: 'Jest',
      });

      expect(problems).toEqual([
        'generated test is formatted as a Vue SFC instead of a plain module for `__tests__/components/views/BottomNav.vue.test.ts`',
        'generated test uses Vitest APIs even though the project requires Jest idioms',
      ]);
    });

    test('accepts plain Jest test modules that do not contain forbidden constructs', () => {
      expect(
        findGeneratedTestProblems({
          testCode: [
            "import { sum } from '../../src/sum.js';",
            '',
            "describe('sum', () => {",
            "  it('adds two numbers', () => {",
            '    expect(sum(1, 2)).toBe(3);',
            '  });',
            '});',
          ].join('\n'),
          testOutputPath: '__tests__/sum.test.ts',
          testFramework: 'Jest',
        })
      ).toEqual([]);
    });
  });

  describe('usesRuntimeTargetModule', () => {
    test('rejects tests that only import types from the target module', () => {
      expect(
        usesRuntimeTargetModule({
          sourceFile: 'src/types/contracts.ts',
          testOutputPath: '__tests__/types/contracts.test.ts',
          testCode:
            "import type { Contracts } from '../../src/types/contracts.js';\n\ndescribe('contracts', () => {\n  it('keeps local mocks working', () => {\n    const value = {} as Contracts;\n    expect(value).toBeDefined();\n  });\n});\n",
        })
      ).toBe(false);
    });

    test('accepts tests that import and use a runtime export from the target module', () => {
      expect(
        usesRuntimeTargetModule({
          sourceFile: 'src/runtime/status.ts',
          testOutputPath: 'test/runtime/status.test.ts',
          testCode:
            "import { Status } from '../../src/runtime/status.js';\n\ndescribe('Status', () => {\n  it('exposes enum members', () => {\n    expect(Status.Ready).toBe(0);\n  });\n});\n",
        })
      ).toBe(true);
    });

    test('accepts mixed imports when a runtime binding is still exercised', () => {
      expect(
        usesRuntimeTargetModule({
          sourceFile: 'src/runtime/service.ts',
          testOutputPath: 'test/runtime/service.test.ts',
          testCode:
            "import { createService, type ServiceOptions } from '../../src/runtime/service.js';\n\ndescribe('service', () => {\n  it('creates a service', () => {\n    const options = {} as ServiceOptions;\n    expect(createService(options)).toBeDefined();\n  });\n});\n",
        })
      ).toBe(true);
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
      expect(result.totalActionableSourceFiles).toBe(2);
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
      expect(result.totalActionableSourceFiles).toBe(2);
      expect(result.untestedFiles).toContain('src/helpers.js');
    });

    test('excludes type-only files from actionable inventory metrics', async () => {
      mockFileOps.glob = (pattern) => {
        if (pattern.includes('src/**/*.js')) {
          return Promise.resolve([]);
        }
        if (pattern.includes('src/**/*.ts')) {
          return Promise.resolve(['src/runtime/service.ts', 'src/types/contracts.ts']);
        }
        if (pattern.includes('**/*.test.ts')) {
          return Promise.resolve(['test/runtime/service.test.ts']);
        }
        return Promise.resolve([]);
      };
      mockFileOps.readFile = (filePath) => {
        if (filePath.endsWith('src/runtime/service.ts')) {
          return Promise.resolve('export const createService = () => ({ ok: true });');
        }
        if (filePath.endsWith('src/types/contracts.ts')) {
          return Promise.resolve('export interface Contracts { ok: boolean }\n');
        }
        return Promise.reject(new Error('not found'));
      };
      mockTechStack.detectAll = () => Promise.resolve({ languages: ['typescript'] });

      const result = await generator.execute('/project');

      expect(result.totalSourceFiles).toBe(2);
      expect(result.totalActionableSourceFiles).toBe(1);
      expect(result.coveragePercentage).toBe(100);
      expect(result.typeOnlySourceFiles).toEqual(['src/types/contracts.ts']);
      expect(result.untestedFiles).toHaveLength(0);
    });

    test('reads Jest unit config and existing Vue test examples from __tests__', async () => {
      mockFileOps.readFile = (filePath) => {
        if (filePath.endsWith('package.json')) {
          return Promise.resolve(
            JSON.stringify({
              scripts: {
                test: 'node jest/bin/jest.js',
                'test:unit': 'node jest/bin/jest.js --config=jest.config.unit.js',
              },
              devDependencies: {
                jest: '^30.0.0',
                'ts-jest': '^29.0.0',
              },
            })
          );
        }
        if (filePath.endsWith('jest.config.unit.js')) {
          return Promise.resolve(`
            export default {
              testMatch: ['**/__tests__/**/*.ts', '**/*.test.ts'],
              moduleNameMapper: {
                '^vue-router$': '<rootDir>/node_modules/vue-router/dist/vue-router.cjs'
              }
            };
          `);
        }
        if (filePath.endsWith('tsconfig.json')) {
          return Promise.resolve(
            JSON.stringify({ compilerOptions: { strict: true, paths: { '@/*': ['src/*'] } } })
          );
        }
        if (filePath.endsWith('__tests__/components/AppBar.vue.test.ts')) {
          return Promise.resolve(
            "import { mount } from '@vue/test-utils';\nimport AppBar from '../../src/components/AppBar.vue';\n"
          );
        }
        return Promise.reject(new Error('not found'));
      };
      mockFileOps.glob = (pattern) => {
        if (pattern.includes('__tests__/**/*.vue.test.ts')) {
          return Promise.resolve(['__tests__/components/AppBar.vue.test.ts']);
        }
        return Promise.resolve([]);
      };

      const context = await generator._readProjectTestContext(
        '/project',
        'typescript',
        'src/components/AppBar.vue'
      );

      expect(context.preferredTestRoot).toBe('__tests__');
      expect(context.jestConstraints).toContain('jest.config.unit.js');
      expect(context.jestConstraints).toContain('Do NOT emit `.test.vue` files');
      expect(context.testImportExamples).toContain('__tests__/components/AppBar.vue.test.ts');
    });

    test('handles no source files', async () => {
      mockFileOps.glob = () => Promise.resolve([]);

      const result = await generator.execute('/project');

      expect(result.success).toBe(true);
      expect(result.totalSourceFiles).toBe(0);
      expect(result.totalActionableSourceFiles).toBe(0);
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
      mockAiHelper.executeRequest = () =>
        Promise.resolve({
          content:
            "```js\nimport { x } from '../src/utils.js';\n\ndescribe('x', () => {\n  it('uses runtime export', () => {\n    expect(x).toBe(1);\n  });\n});\n```",
        });

      let writtenPath = null;
      mockFileOps.writeFile = (p) => {
        writtenPath = p;
        return Promise.resolve();
      };

      const result = await generator.execute('/project');

      expect(result.generatedFiles).toHaveLength(1);
      expect(writtenPath).toContain('utils.test.js');
    });

    test('rejects generated tests that only import types from the target module', async () => {
      mockFileOps.glob = (pattern) => {
        if (pattern.includes('src/**/*.ts')) return Promise.resolve(['src/types/contracts.ts']);
        return Promise.resolve([]);
      };
      mockTechStack.detectAll = () => Promise.resolve({ languages: ['typescript'] });
      mockFileOps.readFile = (p) => {
        if (p.endsWith('src/types/contracts.ts')) {
          return Promise.resolve(
            'export const runtimeValue = 1;\nexport interface Contracts { ok: boolean }\n'
          );
        }
        return Promise.reject(new Error('not found'));
      };
      mockAiHelper.initialize = () => Promise.resolve(true);
      mockAiHelper.executeRequest = () =>
        Promise.resolve({
          content:
            "```ts\nimport type { Contracts } from '../../src/types/contracts.js';\n\ndescribe('contracts', () => {\n  it('keeps local mocks working', () => {\n    const value = {} as Contracts;\n    expect(value).toBeDefined();\n  });\n});\n```",
        });

      let writeCount = 0;
      mockFileOps.writeFile = () => {
        writeCount++;
        return Promise.resolve();
      };

      const result = await generator.execute('/project');

      expect(writeCount).toBe(0);
      expect(result.generatedFiles).toHaveLength(0);
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
      mockAiHelper.executeRequest = () =>
        Promise.resolve({
          content:
            "```js\nimport { x } from '../src/file0.js';\n\ndescribe('generated', () => {\n  it('uses runtime export', () => {\n    expect(x).toBeDefined();\n  });\n});\n```",
        });

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

    test('uses prompt truncation instead of skipping oversized source files', async () => {
      mockFileOps.glob = (pattern) => {
        if (pattern.includes('src/**/*.js')) return Promise.resolve(['src/map.js']);
        return Promise.resolve([]);
      };
      mockFileOps.readFile = (filePath) => {
        if (filePath.includes('.test.')) {
          return Promise.reject(new Error('not found'));
        }
        return Promise.resolve('x'.repeat(MAX_SOURCE_FILE_CHARS + 100));
      };
      mockAiHelper.initialize = () => Promise.resolve(true);
      mockAiHelper.executeRequest = () =>
        Promise.resolve({
          content:
            "```js\nimport { x } from '../src/map.js';\n\ndescribe('map', () => {\n  it('uses runtime export', () => {\n    expect(x).toBeDefined();\n  });\n});\n```",
        });

      const result = await generator.execute('/project');

      expect(result.generatedFiles).toEqual(['test/map.test.js']);
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
