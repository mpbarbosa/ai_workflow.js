/**
 * @fileoverview Tests for Change Detection Module
 * Tests both pure functions and ChangeDetector class
 */

import {
  categorizeFile,
  analyzeChanges,
  calculateChangeImpact,
  detectChangeType,
  filterByCategory,
  groupByDirectory,
  calculateCoverageImpact,
  identifyRelatedTests,
  buildChangeSummary,
  shouldSkipStep,
  mergeChangeAnalysis,
  validateChangeData,
  ChangeDetector
} from '../../src/lib/change_detection.js';

// ============================================================================
// PURE FUNCTION TESTS
// ============================================================================

describe('change_detection - Pure Functions', () => {
  
  describe('categorizeFile', () => {
    test('categorizes code files', () => {
      expect(categorizeFile('src/app.js')).toBe('code');
      expect(categorizeFile('src/utils.ts')).toBe('code');
      expect(categorizeFile('lib/helper.py')).toBe('code');
    });
    
    test('categorizes test files', () => {
      expect(categorizeFile('src/app.test.js')).toBe('test');
      expect(categorizeFile('test/app.spec.js')).toBe('test');
      expect(categorizeFile('__tests__/app.js')).toBe('test');
      expect(categorizeFile('test/unit/app.js')).toBe('test');
    });
    
    test('categorizes documentation files', () => {
      expect(categorizeFile('README.md')).toBe('docs');
      expect(categorizeFile('docs/api.md')).toBe('docs');
      expect(categorizeFile('CHANGELOG.md')).toBe('docs');
      expect(categorizeFile('CONTRIBUTING.md')).toBe('docs');
    });
    
    test('categorizes config files', () => {
      expect(categorizeFile('package.json')).toBe('config');
      expect(categorizeFile('.eslintrc.json')).toBe('config');
      expect(categorizeFile('config.yaml')).toBe('config');
      expect(categorizeFile('.gitignore')).toBe('config');
    });
    
    test('categorizes asset files', () => {
      expect(categorizeFile('logo.png')).toBe('asset');
      expect(categorizeFile('styles.css')).toBe('asset');
      expect(categorizeFile('icon.svg')).toBe('asset');
    });
    
    test('handles invalid input', () => {
      expect(categorizeFile(null)).toBe('unknown');
      expect(categorizeFile('')).toBe('unknown');
      expect(categorizeFile('file.xyz')).toBe('unknown');
    });
  });
  
  describe('analyzeChanges', () => {
    test('analyzes mixed changes', () => {
      const files = [
        { file: 'src/app.js', status: 'modified' },
        { file: 'test/app.test.js', status: 'modified' },
        { file: 'README.md', status: 'modified' }
      ];
      
      const result = analyzeChanges(files);
      expect(result.categories.code).toEqual(['src/app.js']);
      expect(result.categories.test).toEqual(['test/app.test.js']);
      expect(result.categories.docs).toEqual(['README.md']);
      expect(result.impact).toBe('medium');
    });
    
    test('handles empty file list', () => {
      const result = analyzeChanges([]);
      expect(result.impact).toBe('none');
      expect(result.summary).toBe('No changes');
    });
    
    test('handles invalid input', () => {
      const result = analyzeChanges(null);
      expect(result.impact).toBe('none');
    });
  });
  
  describe('calculateChangeImpact', () => {
    test('returns high impact for many code changes', () => {
      const categories = {
        code: ['a.js', 'b.js', 'c.js', 'd.js', 'e.js', 'f.js'],
        test: []
      };
      expect(calculateChangeImpact(categories)).toBe('high');
    });
    
    test('returns high impact for many config changes', () => {
      const categories = {
        code: [],
        config: ['a.yaml', 'b.json', 'c.toml', 'd.yaml']
      };
      expect(calculateChangeImpact(categories)).toBe('high');
    });
    
    test('returns medium impact for some code changes', () => {
      const categories = {
        code: ['a.js', 'b.js'],
        test: ['a.test.js']
      };
      expect(calculateChangeImpact(categories)).toBe('medium');
    });
    
    test('returns low impact for only docs', () => {
      const categories = {
        code: [],
        docs: ['README.md', 'API.md']
      };
      expect(calculateChangeImpact(categories)).toBe('low');
    });
    
    test('returns none for no changes', () => {
      const categories = {};
      expect(calculateChangeImpact(categories)).toBe('none');
    });
    
    test('handles null input', () => {
      expect(calculateChangeImpact(null)).toBe('none');
    });
  });
  
  describe('detectChangeType', () => {
    test('detects feature additions', () => {
      const diff = '+function newFeature() { return true; }';
      expect(detectChangeType(diff)).toBe('feature');
    });
    
    test('detects bugfixes', () => {
      const diff = 'fix: resolve null pointer exception';
      expect(detectChangeType(diff)).toBe('bugfix');
    });
    
    test('detects refactoring', () => {
      const diff = 'refactor: simplify logic\n-function oldName()\n+function newName()';
      expect(detectChangeType(diff)).toBe('refactor');
    });
    
    test('defaults to chore for unclear changes', () => {
      const diff = 'update dependencies';
      expect(detectChangeType(diff)).toBe('chore');
    });
    
    test('handles null input', () => {
      expect(detectChangeType(null)).toBe('chore');
    });
  });
  
  describe('filterByCategory', () => {
    test('filters files by code category', () => {
      const files = ['src/app.js', 'README.md', 'test/app.test.js'];
      const result = filterByCategory(files, 'code');
      expect(result).toEqual(['src/app.js']);
    });
    
    test('filters files by test category', () => {
      const files = ['src/app.js', 'test/app.test.js', 'test/utils.spec.js'];
      const result = filterByCategory(files, 'test');
      expect(result).toEqual(['test/app.test.js', 'test/utils.spec.js']);
    });
    
    test('returns empty array for no matches', () => {
      const files = ['src/app.js'];
      const result = filterByCategory(files, 'docs');
      expect(result).toEqual([]);
    });
    
    test('handles invalid input', () => {
      expect(filterByCategory(null, 'code')).toEqual([]);
      expect(filterByCategory(['file.js'], null)).toEqual([]);
    });
  });
  
  describe('groupByDirectory', () => {
    test('groups files by directory', () => {
      const files = ['src/app.js', 'src/utils.js', 'test/app.test.js'];
      const result = groupByDirectory(files);
      
      expect(result['src/']).toEqual(['src/app.js', 'src/utils.js']);
      expect(result['test/']).toEqual(['test/app.test.js']);
    });
    
    test('handles files in root directory', () => {
      const files = ['README.md', 'package.json'];
      const result = groupByDirectory(files);
      expect(result['./']).toEqual(['README.md', 'package.json']);
    });
    
    test('handles empty file list', () => {
      const result = groupByDirectory([]);
      expect(result).toEqual({});
    });
    
    test('handles invalid input', () => {
      const result = groupByDirectory(null);
      expect(result).toEqual({});
    });
  });
  
  describe('calculateCoverageImpact', () => {
    test('calculates impact with full coverage', () => {
      const changes = {
        code: ['src/app.js'],
        test: ['test/app.test.js']
      };
      const result = calculateCoverageImpact(changes);
      expect(result.affected).toEqual(['src/app.js']);
      expect(result.confidence).toBe(1.0);
    });
    
    test('calculates impact with partial coverage', () => {
      const changes = {
        code: ['src/app.js', 'src/utils.js'],
        test: ['test/app.test.js']
      };
      const result = calculateCoverageImpact(changes);
      expect(result.confidence).toBe(0.5);
    });
    
    test('calculates impact with no tests', () => {
      const changes = {
        code: ['src/app.js'],
        test: []
      };
      const result = calculateCoverageImpact(changes);
      expect(result.confidence).toBe(0);
    });
    
    test('handles no code changes', () => {
      const changes = {
        code: [],
        test: ['test/app.test.js']
      };
      const result = calculateCoverageImpact(changes);
      expect(result.confidence).toBe(1.0);
    });
    
    test('handles null input', () => {
      const result = calculateCoverageImpact(null);
      expect(result.affected).toEqual([]);
      expect(result.confidence).toBe(0);
    });
  });
  
  describe('identifyRelatedTests', () => {
    test('identifies related test files', () => {
      const result = identifyRelatedTests('src/app.js', '.test.js');
      expect(result).toContain('src/app.test.js');
      expect(result).toContain('src/test/app.test.js');
      expect(result).toContain('src/__tests__/app.test.js');
    });
    
    test('handles different test patterns', () => {
      const result = identifyRelatedTests('src/app.js', '.spec.js');
      expect(result[0]).toContain('.spec.js');
    });
    
    test('handles null input', () => {
      const result = identifyRelatedTests(null);
      expect(result).toEqual([]);
    });
  });
  
  describe('buildChangeSummary', () => {
    test('builds summary for mixed changes', () => {
      const categories = {
        code: ['a.js', 'b.js'],
        test: ['a.test.js'],
        docs: ['README.md']
      };
      const result = buildChangeSummary(categories);
      expect(result).toBe('2 code files, 1 test file, 1 doc changed');
    });
    
    test('handles plural forms correctly', () => {
      const categories = {
        code: ['a.js'],
        test: ['a.test.js', 'b.test.js']
      };
      const result = buildChangeSummary(categories);
      expect(result).toBe('1 code file, 2 test files changed');
    });
    
    test('handles no changes', () => {
      const result = buildChangeSummary({});
      expect(result).toBe('No changes');
    });
    
    test('handles null input', () => {
      const result = buildChangeSummary(null);
      expect(result).toBe('No changes');
    });
  });
  
  describe('shouldSkipStep', () => {
    test('skips tests for docs-only changes', () => {
      const changes = { docs: ['README.md'], code: [], test: [] };
      expect(shouldSkipStep('run_tests', changes)).toBe(true);
    });
    
    test('runs tests for code changes', () => {
      const changes = { code: ['src/app.js'], docs: [], test: [] };
      expect(shouldSkipStep('run_tests', changes)).toBe(false);
    });
    
    test('skips lint for docs-only changes', () => {
      const changes = { docs: ['README.md'], code: [], test: [] };
      expect(shouldSkipStep('lint', changes)).toBe(true);
    });
    
    test('skips build for docs-only changes', () => {
      const changes = { docs: ['README.md'], code: [], test: [] };
      expect(shouldSkipStep('build', changes)).toBe(true);
    });
    
    test('does not skip unknown steps', () => {
      const changes = { docs: ['README.md'] };
      expect(shouldSkipStep('unknown_step', changes)).toBe(false);
    });
    
    test('handles invalid input', () => {
      expect(shouldSkipStep(null, {})).toBe(false);
      expect(shouldSkipStep('run_tests', null)).toBe(false);
    });
  });
  
  describe('mergeChangeAnalysis', () => {
    test('merges two analyses', () => {
      const a1 = {
        categories: { code: ['a.js'], test: [] },
        impact: 'low'
      };
      const a2 = {
        categories: { code: ['b.js'], test: ['a.test.js'] },
        impact: 'medium'
      };
      
      const result = mergeChangeAnalysis(a1, a2);
      expect(result.categories.code).toEqual(['a.js', 'b.js']);
      expect(result.categories.test).toEqual(['a.test.js']);
      expect(result.impact).toBe('medium');
    });
    
    test('takes higher impact level', () => {
      const a1 = { categories: {}, impact: 'low' };
      const a2 = { categories: {}, impact: 'high' };
      
      const result = mergeChangeAnalysis(a1, a2);
      expect(result.impact).toBe('high');
    });
    
    test('removes duplicates', () => {
      const a1 = { categories: { code: ['a.js', 'b.js'] }, impact: 'low' };
      const a2 = { categories: { code: ['b.js', 'c.js'] }, impact: 'low' };
      
      const result = mergeChangeAnalysis(a1, a2);
      expect(result.categories.code).toEqual(['a.js', 'b.js', 'c.js']);
    });
    
    test('handles null inputs', () => {
      const a1 = { categories: { code: ['a.js'] }, impact: 'low' };
      const result = mergeChangeAnalysis(a1, null);
      expect(result.categories.code).toEqual(['a.js']);
    });
  });
  
  describe('validateChangeData', () => {
    test('validates valid data', () => {
      const data = {
        categories: { code: ['a.js'], test: [] },
        impact: 'medium'
      };
      const result = validateChangeData(data);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
    
    test('rejects invalid categories', () => {
      const data = {
        categories: { invalid_category: ['a.js'] },
        impact: 'medium'
      };
      const result = validateChangeData(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid category: invalid_category');
    });
    
    test('rejects non-array category values', () => {
      const data = {
        categories: { code: 'not an array' },
        impact: 'medium'
      };
      const result = validateChangeData(data);
      expect(result.valid).toBe(false);
    });
    
    test('rejects invalid impact', () => {
      const data = {
        categories: { code: [] },
        impact: 'invalid'
      };
      const result = validateChangeData(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid impact: invalid');
    });
    
    test('rejects null data', () => {
      const result = validateChangeData(null);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Change data must be an object');
    });
  });
});

// ============================================================================
// CHANGE DETECTOR CLASS TESTS
// ============================================================================

describe('change_detection - ChangeDetector Class', () => {
  
  describe('constructor', () => {
    test('creates instance with defaults', () => {
      const detector = new ChangeDetector();
      expect(detector.projectKind).toBe('generic');
      expect(detector.lastAnalysis).toBeNull();
    });
    
    test('creates instance with custom options', () => {
      const mockGit = { status: async () => ({}) };
      const detector = new ChangeDetector({
        gitAutomation: mockGit,
        projectKind: 'nodejs_api'
      });
      expect(detector.gitAutomation).toBe(mockGit);
      expect(detector.projectKind).toBe('nodejs_api');
    });
  });
  
  describe('detectChanges', () => {
    test('detects changes from git status', async () => {
      const mockGit = {
        status: async () => ({
          staged: [{ file: 'src/app.js', status: 'modified' }],
          unstaged: [{ file: 'README.md', status: 'modified' }],
          untracked: ['new.js']
        })
      };
      
      const detector = new ChangeDetector({ gitAutomation: mockGit });
      const result = await detector.detectChanges();
      
      expect(result.categories.code).toContain('src/app.js');
      expect(result.categories.docs).toContain('README.md');
      expect(result.impact).not.toBe('none');
    });
    
    test('handles no git automation', async () => {
      const detector = new ChangeDetector();
      const result = await detector.detectChanges();
      
      expect(result.impact).toBe('none');
      expect(result.summary).toBe('No changes');
    });
    
    test('handles git errors', async () => {
      const mockGit = {
        status: async () => {
          throw new Error('Git error');
        }
      };
      
      const detector = new ChangeDetector({ gitAutomation: mockGit });
      const result = await detector.detectChanges();
      
      expect(result.impact).toBe('none');
      expect(result.summary).toContain('Error');
    });
  });
  
  describe('analyzeImpact', () => {
    test('analyzes impact from cached analysis', async () => {
      const detector = new ChangeDetector();
      detector.lastAnalysis = {
        categories: { code: ['a.js'], test: [] },
        impact: 'medium'
      };
      
      const result = await detector.analyzeImpact();
      expect(result.level).toBe('medium');
      expect(result.shouldRunTests).toBe(true);
    });
  });
  
  describe('getAffectedSteps', () => {
    test('returns affected steps based on changes', async () => {
      const mockGit = {
        status: async () => ({
          staged: [{ file: 'src/app.js', status: 'modified' }],
          unstaged: [],
          untracked: []
        })
      };
      
      const detector = new ChangeDetector({ gitAutomation: mockGit });
      await detector.detectChanges();
      const steps = await detector.getAffectedSteps();
      
      expect(steps).toContain('lint');
      expect(steps).toContain('run_tests');
    });
  });
  
  describe('categorizeChanges', () => {
    test('returns categorized changes', async () => {
      const detector = new ChangeDetector();
      detector.lastAnalysis = {
        categories: { code: ['a.js'], docs: ['README.md'] }
      };
      
      const result = await detector.categorizeChanges();
      expect(result.code).toEqual(['a.js']);
      expect(result.docs).toEqual(['README.md']);
    });
  });
  
  describe('getChangesSummary', () => {
    test('returns summary text', async () => {
      const detector = new ChangeDetector();
      detector.lastAnalysis = {
        summary: '2 code files, 1 doc changed'
      };
      
      const result = await detector.getChangesSummary();
      expect(result).toBe('2 code files, 1 doc changed');
    });
  });
  
  describe('shouldRunTests', () => {
    test('returns true for code changes', async () => {
      const detector = new ChangeDetector();
      detector.lastAnalysis = {
        categories: { code: ['a.js'], test: [], docs: [] }
      };
      
      const result = await detector.shouldRunTests();
      expect(result).toBe(true);
    });
    
    test('returns false for docs-only changes', async () => {
      const detector = new ChangeDetector();
      detector.lastAnalysis = {
        categories: { code: [], test: [], docs: ['README.md'] }
      };
      
      const result = await detector.shouldRunTests();
      expect(result).toBe(false);
    });
  });
  
  describe('shouldUpdateDocs', () => {
    test('returns true for code changes', async () => {
      const detector = new ChangeDetector();
      detector.lastAnalysis = {
        categories: { code: ['a.js'], docs: [] }
      };
      
      const result = await detector.shouldUpdateDocs();
      expect(result).toBe(true);
    });
    
    test('returns false for no code or doc changes', async () => {
      const detector = new ChangeDetector();
      detector.lastAnalysis = {
        categories: { code: [], docs: [], test: ['test.js'] }
      };
      
      const result = await detector.shouldUpdateDocs();
      expect(result).toBe(false);
    });
  });
});
