// scripts/analyze-change-impact.test.js

import * as impactModule from '../../scripts/analyze-change-impact.js';

describe('analyze-change-impact.js core functions', () => {
  // Extract functions for direct testing
  const {
    matchPattern,
    matchesAnyPattern,
    analyzeChangeImpact,
    determineExecutionStrategy,
    STEP_PATTERNS,
    IMPACT_LEVELS,
  } = impactModule;

  describe('matchPattern', () => {
    it('should match exact file names', () => {
      expect(matchPattern('package.json', 'package.json')).toBe(true);
      expect(matchPattern('src/index.js', 'src/index.js')).toBe(true);
    });

    it('should match simple * patterns', () => {
      expect(matchPattern('src/foo.js', 'src/*.js')).toBe(true);
      expect(matchPattern('src/bar.js', 'src/*.js')).toBe(true);
      expect(matchPattern('src/foo/bar.js', 'src/*.js')).toBe(false);
    });

    it('should match ** patterns', () => {
      expect(matchPattern('src/foo/bar.js', 'src/**/*.js')).toBe(true);
      expect(matchPattern('src/bar.js', 'src/**/*.js')).toBe(true);
      expect(matchPattern('test/lib/foo.test.js', 'test/lib/**/*.test.js')).toBe(true);
    });

    it('should match ? patterns', () => {
      expect(matchPattern('src/a.js', 'src/?.js')).toBe(true);
      expect(matchPattern('src/ab.js', 'src/?.js')).toBe(false);
    });

    it('should not match unrelated files', () => {
      expect(matchPattern('docs/readme.md', 'src/**/*.js')).toBe(false);
      expect(matchPattern('foo.txt', '*.js')).toBe(false);
    });
  });

  describe('matchesAnyPattern', () => {
    it('should return true if any file matches any pattern', () => {
      const files = ['src/foo.js', 'docs/readme.md'];
      const patterns = ['src/*.js', '*.md'];
      expect(matchesAnyPattern(files, patterns)).toBe(true);
    });

    it('should return false if no files match', () => {
      const files = ['foo.txt', 'bar.py'];
      const patterns = ['src/*.js', '*.md'];
      expect(matchesAnyPattern(files, patterns)).toBe(false);
    });

    it('should handle empty files and patterns', () => {
      expect(matchesAnyPattern([], ['*.js'])).toBe(false);
      expect(matchesAnyPattern(['foo.js'], [])).toBe(false);
    });
  });

  describe('analyzeChangeImpact', () => {
    it('should detect impact for unit-tests and integration-tests', () => {
      const files = ['src/core/logger.js', 'src/orchestrator/workflow_engine.js'];
      const result = analyzeChangeImpact(files);
      expect(result.steps['unit-tests'].shouldRun).toBe(true);
      expect(result.steps['integration-tests'].shouldRun).toBe(true);
      expect(result.maxImpact).toBe('high');
      expect(result.totalFiles).toBe(2);
    });

    it('should detect documentation-only changes', () => {
      const files = ['README.md', 'docs/guide.md'];
      const result = analyzeChangeImpact(files);
      expect(result.steps.documentation.shouldRun).toBe(true);
      expect(result.steps['unit-tests'].shouldRun).toBe(false);
      expect(result.maxImpact).toBe('low');
    });

    it('should handle CI config changes', () => {
      const files = ['.github/workflows/ci.yml', 'package.json'];
      const result = analyzeChangeImpact(files);
      expect(result.steps['ci-config'].shouldRun).toBe(true);
      // package.json also triggers unit-tests (high impact), so maxImpact is 'high'
      expect(result.maxImpact).toBe('high');
    });

    it('should handle empty changed files', () => {
      const result = analyzeChangeImpact([]);
      Object.values(result.steps).forEach(step => {
        expect(step.shouldRun).toBe(false);
      });
      expect(result.maxImpact).toBe('low');
      expect(result.totalFiles).toBe(0);
    });

    it('should handle large changeset', () => {
      const files = Array.from({ length: 101 }, (_, i) => `src/file${i}.js`);
      const result = analyzeChangeImpact(files);
      expect(result.totalFiles).toBe(101);
    });
  });

  describe('determineExecutionStrategy', () => {
    it('should skip all if no files changed', () => {
      const analysis = analyzeChangeImpact([]);
      const strategy = determineExecutionStrategy(analysis);
      expect(strategy.strategy).toBe('skip-all');
      expect(strategy.reason).toMatch(/No files changed/);
    });

    it('should run all if large changeset', () => {
      const files = Array.from({ length: 101 }, (_, i) => `src/file${i}.js`);
      const analysis = analyzeChangeImpact(files);
      const strategy = determineExecutionStrategy(analysis);
      expect(strategy.strategy).toBe('run-all');
      expect(strategy.reason).toMatch(/Large changeset/);
      Object.values(strategy.steps).forEach(step => {
        expect(step.shouldRun).toBe(true);
      });
    });

    it('should select docs-only strategy for documentation changes', () => {
      const files = ['README.md', 'docs/guide.md'];
      const analysis = analyzeChangeImpact(files);
      const strategy = determineExecutionStrategy(analysis);
      expect(strategy.strategy).toBe('docs-only');
      expect(strategy.steps['unit-tests'].shouldRun).toBe(false);
      expect(strategy.steps.documentation.shouldRun).toBe(true);
    });

    it('should run all for CI config changes', () => {
      const files = ['.github/workflows/ci.yml', 'package.json'];
      const analysis = analyzeChangeImpact(files);
      const strategy = determineExecutionStrategy(analysis);
      expect(strategy.strategy).toBe('run-all');
      Object.values(strategy.steps).forEach(step => {
        expect(step.shouldRun).toBe(true);
      });
    });

    it('should select unit-only strategy for unit test changes', () => {
      const files = ['src/core/logger.js', 'test/lib/logger.test.js'];
      const analysis = analyzeChangeImpact(files);
      const strategy = determineExecutionStrategy(analysis);
      expect(strategy.strategy).toBe('unit-only');
      expect(strategy.steps['unit-tests'].shouldRun).toBe(true);
      expect(strategy.steps['integration-tests'].shouldRun).toBe(false);
    });

    it('should select selective strategy for mixed changes', () => {
      // Both unit-tests and integration-tests must be triggered to avoid unit-only path
      const files = ['src/core/logger.js', 'src/orchestrator/workflow_engine.js', 'docs/guide.md'];
      const analysis = analyzeChangeImpact(files);
      const strategy = determineExecutionStrategy(analysis);
      expect(strategy.strategy).toBe('selective');
      expect(strategy.steps['unit-tests'].shouldRun).toBe(true);
      expect(strategy.steps['integration-tests'].shouldRun).toBe(true);
      expect(strategy.steps.documentation.shouldRun).toBe(true);
    });
  });

  describe('STEP_PATTERNS and IMPACT_LEVELS', () => {
    it('should have expected step names and impact levels', () => {
      expect(Object.keys(STEP_PATTERNS)).toEqual(
        expect.arrayContaining(['unit-tests', 'integration-tests', 'linting', 'documentation', 'ci-config'])
      );
      expect(IMPACT_LEVELS).toHaveProperty('critical', 3);
      expect(IMPACT_LEVELS).toHaveProperty('high', 2);
      expect(IMPACT_LEVELS).toHaveProperty('medium', 1);
      expect(IMPACT_LEVELS).toHaveProperty('low', 0);
    });
  });
});
