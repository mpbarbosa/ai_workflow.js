/**
 * Tests for Step 15: UX Analysis
 * @group steps
 */

import { jest } from '@jest/globals';
import {
  Step15UxAnalysis,
  shouldRunUxAnalysis,
  shouldExcludeFile,
  isUiFile,
  categorizeUiFile,
  filterUiFiles,
  filterFrameworkUiFiles,
  groupUiFilesByType,
  selectKeyFiles,
  buildUxAnalysisPrompt,
  calculateSeverityScore,
  parseUxAnalysisResult,
  formatUxAnalysisReport,
  FRAMEWORK_EXTENSIONS,
  EXCLUDED_DIRECTORIES,
} from '../../src/steps/step_15_ux_analysis.js';

describe('Step 15: UX Analysis', () => {
  // ========================================================================
  // PURE FUNCTIONS - UI Detection
  // ========================================================================

  describe('shouldRunUxAnalysis', () => {
    test('returns true for react_spa', () => {
      expect(shouldRunUxAnalysis('react_spa')).toBe(true);
    });

    test('returns true for vue_spa', () => {
      expect(shouldRunUxAnalysis('vue_spa')).toBe(true);
    });

    test('returns true for static_website', () => {
      expect(shouldRunUxAnalysis('static_website')).toBe(true);
    });

    test('returns false for nodejs_api', () => {
      expect(shouldRunUxAnalysis('nodejs_api')).toBe(false);
    });

    test('normalizes hyphens to underscores', () => {
      expect(shouldRunUxAnalysis('react-spa')).toBe(true);
      expect(shouldRunUxAnalysis('static-website')).toBe(true);
    });
  });

  describe('shouldExcludeFile', () => {
    test('excludes node_modules', () => {
      expect(shouldExcludeFile('src/node_modules/package/file.js')).toBe(true);
      expect(shouldExcludeFile('node_modules/package/file.js')).toBe(true);
    });

    test('excludes .git directory', () => {
      expect(shouldExcludeFile('src/.git/config')).toBe(true);
      expect(shouldExcludeFile('.git/config')).toBe(true);
    });

    test('excludes dist and build', () => {
      expect(shouldExcludeFile('dist/bundle.js')).toBe(true);
      expect(shouldExcludeFile('src/build/output.js')).toBe(true);
    });

    test('excludes TypeDoc generated docs directory (docs/api)', () => {
      expect(shouldExcludeFile('docs/api/classes/GeoPosition.html')).toBe(true);
      expect(shouldExcludeFile('docs/api/assets/style.css')).toBe(true);
      expect(shouldExcludeFile('docs/api/index.html')).toBe(true);
    });

    test('excludes alternate doc output directories', () => {
      expect(shouldExcludeFile('typedoc/index.html')).toBe(true);
      expect(shouldExcludeFile('api-docs/classes/Foo.html')).toBe(true);
      expect(shouldExcludeFile('jsdoc/global.html')).toBe(true);
    });

    test('excludes coverage HTML reports', () => {
      expect(shouldExcludeFile('coverage/lcov-report/src/index.html')).toBe(true);
      expect(shouldExcludeFile('src/lcov-report/index.html')).toBe(true);
    });

    test('includes normal files', () => {
      expect(shouldExcludeFile('src/components/App.jsx')).toBe(false);
      expect(shouldExcludeFile('public/index.html')).toBe(false);
    });

    test('EXCLUDED_DIRECTORIES includes generated-doc entries', () => {
      expect(EXCLUDED_DIRECTORIES).toContain('docs/api');
      expect(EXCLUDED_DIRECTORIES).toContain('typedoc');
      expect(EXCLUDED_DIRECTORIES).toContain('api-docs');
      expect(EXCLUDED_DIRECTORIES).toContain('jsdoc');
      expect(EXCLUDED_DIRECTORIES).toContain('lcov-report');
    });
  });

  describe('isUiFile', () => {
    test('identifies React files', () => {
      expect(isUiFile('src/App.jsx')).toBe(true);
      expect(isUiFile('src/App.tsx')).toBe(true);
    });

    test('identifies Vue files', () => {
      expect(isUiFile('src/App.vue')).toBe(true);
    });

    test('identifies HTML files', () => {
      expect(isUiFile('public/index.html')).toBe(true);
    });

    test('identifies CSS files', () => {
      expect(isUiFile('src/styles.css')).toBe(true);
      expect(isUiFile('src/styles.scss')).toBe(true);
    });

    test('rejects non-UI files', () => {
      expect(isUiFile('src/utils.js')).toBe(false);
      expect(isUiFile('README.md')).toBe(false);
    });
  });

  describe('categorizeUiFile', () => {
    test('categorizes React files', () => {
      expect(categorizeUiFile('src/App.jsx')).toBe('react');
      expect(categorizeUiFile('src/App.tsx')).toBe('react');
    });

    test('categorizes Vue files', () => {
      expect(categorizeUiFile('src/App.vue')).toBe('vue');
    });

    test('categorizes HTML files', () => {
      expect(categorizeUiFile('public/index.html')).toBe('html');
    });

    test('categorizes CSS files', () => {
      expect(categorizeUiFile('src/styles.css')).toBe('css');
      expect(categorizeUiFile('src/styles.scss')).toBe('css');
    });

    test('returns null for non-UI files', () => {
      expect(categorizeUiFile('src/utils.js')).toBeNull();
    });
  });

  describe('filterUiFiles', () => {
    test('filters to only UI files', () => {
      const files = [
        'src/App.jsx',
        'src/utils.js',
        'src/styles.css',
        'node_modules/package/file.js',
        'public/index.html',
        'README.md',
      ];
      const result = filterUiFiles(files);
      expect(result).toEqual(['src/App.jsx', 'src/styles.css', 'public/index.html']);
    });

    test('returns empty array for no UI files', () => {
      const files = ['src/utils.js', 'README.md', 'package.json'];
      expect(filterUiFiles(files)).toEqual([]);
    });
  });

  // ========================================================================
  // PURE FUNCTIONS - Framework UI Detection (non-UI project probe)
  // ========================================================================

  describe('FRAMEWORK_EXTENSIONS', () => {
    test('contains React/Vue/Svelte extensions', () => {
      expect(FRAMEWORK_EXTENSIONS).toContain('.jsx');
      expect(FRAMEWORK_EXTENSIONS).toContain('.tsx');
      expect(FRAMEWORK_EXTENSIONS).toContain('.vue');
      expect(FRAMEWORK_EXTENSIONS).toContain('.svelte');
    });

    test('does NOT contain .html or .css', () => {
      expect(FRAMEWORK_EXTENSIONS).not.toContain('.html');
      expect(FRAMEWORK_EXTENSIONS).not.toContain('.css');
      expect(FRAMEWORK_EXTENSIONS).not.toContain('.scss');
      expect(FRAMEWORK_EXTENSIONS).not.toContain('.less');
    });
  });

  describe('filterFrameworkUiFiles', () => {
    test('keeps React/Vue/Svelte files', () => {
      const files = [
        'src/App.jsx',
        'src/Button.tsx',
        'src/Home.vue',
        'src/Widget.svelte',
        'public/index.html',
        'src/styles.css',
        'src/utils.ts',
      ];
      const result = filterFrameworkUiFiles(files);
      expect(result).toEqual([
        'src/App.jsx',
        'src/Button.tsx',
        'src/Home.vue',
        'src/Widget.svelte',
      ]);
    });

    test('excludes plain .html and .css (the false-positive types)', () => {
      const files = ['public/index.html', 'assets/styles.css', 'docs/page.scss'];
      expect(filterFrameworkUiFiles(files)).toEqual([]);
    });

    test('excludes files in EXCLUDED_DIRECTORIES', () => {
      const files = ['node_modules/react/index.jsx', 'dist/app.jsx', 'src/App.vue'];
      const result = filterFrameworkUiFiles(files);
      expect(result).toEqual(['src/App.vue']);
    });

    test('returns empty array for no framework files', () => {
      const files = ['src/utils.ts', 'README.md', 'package.json'];
      expect(filterFrameworkUiFiles(files)).toEqual([]);
    });

    // Regression test: the exact scenario from paraty_geocore.js workflow run
    // that caused step_15 to execute falsely.
    test('regression: TypeDoc HTML/CSS files do NOT trigger framework detection', () => {
      const typedocFiles = [
        'docs/api/classes/GeoPosition.html',
        'docs/api/classes/ObserverSubject.html',
        'docs/api/classes/GeocodingState.html',
        'docs/api/classes/GeoPositionError.html',
        'docs/api/classes/DualObserverSubject.html',
        'docs/api/functions/calculateDistance.html',
        'docs/api/functions/delay.html',
        'docs/api/hierarchy.html',
        'docs/api/index.html',
        'docs/api/interfaces/GeoCoords.html',
        'docs/api/interfaces/GeoPositionInput.html',
        'docs/api/interfaces/GeocodingStateSnapshot.html',
        'docs/api/modules.html',
        'docs/api/types/AccuracyQuality.html',
        'docs/api/types/ObserverFunction.html',
        'docs/api/types/ObserverObject.html',
        'docs/api/variables/EARTH_RADIUS_METERS.html',
        'docs/api/assets/highlight.css',
        'docs/api/assets/style.css',
      ];
      // Using filterFrameworkUiFiles (the probe used for non-UI projects) must
      // return an empty list so that step_15 correctly skips.
      expect(filterFrameworkUiFiles(typedocFiles)).toEqual([]);
    });

    test('regression: TypeDoc HTML + actual Vue SPA — only Vue file triggers', () => {
      const hybridProject = [
        'docs/api/index.html',
        'docs/api/assets/style.css',
        'src/ui/App.vue',
        'src/ui/components/Map.vue',
      ];
      const result = filterFrameworkUiFiles(hybridProject);
      expect(result).toEqual(['src/ui/App.vue', 'src/ui/components/Map.vue']);
    });
  });

  describe('groupUiFilesByType', () => {
    test('groups files by UI type', () => {
      const files = [
        'src/App.jsx',
        'src/Button.tsx',
        'src/Home.vue',
        'public/index.html',
        'src/styles.css',
      ];
      const groups = groupUiFilesByType(files);
      expect(groups.react).toEqual(['src/App.jsx', 'src/Button.tsx']);
      expect(groups.vue).toEqual(['src/Home.vue']);
      expect(groups.html).toEqual(['public/index.html']);
      expect(groups.css).toEqual(['src/styles.css']);
    });

    test('returns empty groups for no files', () => {
      const groups = groupUiFilesByType([]);
      expect(groups.react).toEqual([]);
      expect(groups.vue).toEqual([]);
      expect(groups.html).toEqual([]);
    });
  });

  // ========================================================================
  // PURE FUNCTIONS - File Selection
  // ========================================================================

  describe('selectKeyFiles', () => {
    test('prioritizes HTML files first', () => {
      const uiFiles = ['src/styles.css', 'src/index.html', 'src/about.html'];
      const fileGroups = { html: ['src/index.html', 'src/about.html'], css: ['src/styles.css'] };
      const result = selectKeyFiles(uiFiles, fileGroups);
      expect(result[0]).toBe('src/index.html');
      expect(result[1]).toBe('src/about.html');
      expect(result[2]).toBe('src/styles.css');
    });

    test('fills remaining slots with CSS files', () => {
      const uiFiles = ['src/a.css', 'src/b.css'];
      const fileGroups = { html: [], css: ['src/a.css', 'src/b.css'] };
      const result = selectKeyFiles(uiFiles, fileGroups, 5);
      expect(result).toEqual(['src/a.css', 'src/b.css']);
    });

    test('respects maxFiles cap', () => {
      const htmlFiles = ['a.html', 'b.html', 'c.html'];
      const cssFiles = ['a.css', 'b.css', 'c.css'];
      const fileGroups = { html: htmlFiles, css: cssFiles };
      const result = selectKeyFiles([...htmlFiles, ...cssFiles], fileGroups, 4);
      expect(result).toHaveLength(4);
      expect(result.slice(0, 3)).toEqual(htmlFiles);
      expect(result[3]).toBe('a.css');
    });

    test('handles empty fileGroups', () => {
      const result = selectKeyFiles([], { html: [], css: [] }, 10);
      expect(result).toEqual([]);
    });

    test('handles missing fileGroups keys', () => {
      const result = selectKeyFiles(['src/app.vue'], {}, 5);
      expect(result).toEqual([]);
    });

    test('[BUG FIX] includes CSS files even when HTML count exceeds maxFiles', () => {
      // Real-world case: 197 html files, 27 css files, maxFiles=10
      const htmlFiles = Array.from({ length: 197 }, (_, i) => `page${i}.html`);
      const cssFiles = Array.from({ length: 27 }, (_, i) => `style${i}.css`);
      const result = selectKeyFiles([...htmlFiles, ...cssFiles], {
        html: htmlFiles,
        css: cssFiles,
      });
      const cssInResult = result.filter((f) => f.endsWith('.css'));
      expect(cssInResult.length).toBeGreaterThan(0); // CSS must always be represented
      expect(result.length).toBe(10); // Total capped at maxFiles
    });
  });

  // ========================================================================
  // PURE FUNCTIONS - UX Analysis Prompt Building
  // ========================================================================

  describe('buildUxAnalysisPrompt', () => {
    test('builds prompt with all context', () => {
      const context = {
        projectType: 'react_spa',
        fileCount: 25,
        fileSample: ['src/App.jsx', 'src/Button.tsx'],
        fileGroups: { react: ['src/App.jsx'], vue: [], html: [] },
      };
      const prompt = buildUxAnalysisPrompt(context);
      expect(prompt).toContain('Project Type: react_spa');
      expect(prompt).toContain('UI Files Found: 25');
      expect(prompt).toContain('src/App.jsx');
      expect(prompt).toContain('... and 23 more files');
      expect(prompt).toContain('react: 1 files');
      expect(prompt).toContain('Accessibility Issues');
      expect(prompt).toContain('WCAG 2.1');
    });

    test('handles small file counts', () => {
      const context = {
        projectType: 'static_website',
        fileCount: 3,
        fileSample: ['index.html', 'about.html', 'styles.css'],
        fileGroups: { html: ['index.html', 'about.html'], css: ['styles.css'] },
      };
      const prompt = buildUxAnalysisPrompt(context);
      expect(prompt).toContain('UI Files Found: 3');
      expect(prompt).not.toContain('... and');
    });

    test('includes file contents section when fileContents provided', () => {
      const context = {
        projectType: 'static_website',
        fileCount: 1,
        fileSample: ['index.html'],
        fileGroups: { html: ['index.html'], css: [] },
        fileContents: [{ file: 'index.html', content: '<html><body>Hello</body></html>' }],
      };
      const prompt = buildUxAnalysisPrompt(context);
      expect(prompt).toContain('Sample File Contents');
      expect(prompt).toContain('// index.html');
      expect(prompt).toContain('<html><body>Hello</body></html>');
    });

    test('omits file contents section when fileContents absent', () => {
      const context = {
        projectType: 'react_spa',
        fileCount: 2,
        fileSample: ['src/App.jsx'],
        fileGroups: { react: ['src/App.jsx'], html: [], css: [] },
      };
      const prompt = buildUxAnalysisPrompt(context);
      expect(prompt).not.toContain('Sample File Contents');
    });

    test('omits file contents section when fileContents is empty array', () => {
      const context = {
        projectType: 'react_spa',
        fileCount: 2,
        fileSample: ['src/App.jsx'],
        fileGroups: { react: ['src/App.jsx'], html: [], css: [] },
        fileContents: [],
      };
      const prompt = buildUxAnalysisPrompt(context);
      expect(prompt).not.toContain('Sample File Contents');
    });
  });

  describe('calculateSeverityScore', () => {
    test('scores critical accessibility issues highest', () => {
      const issue = { category: 'accessibility', severity: 'critical' };
      expect(calculateSeverityScore(issue)).toBe(15); // 10 * 1.5
    });

    test('scores critical usability issues', () => {
      const issue = { category: 'usability', severity: 'critical' };
      expect(calculateSeverityScore(issue)).toBe(13); // 10 * 1.3
    });

    test('scores warnings lower', () => {
      const issue = { category: 'accessibility', severity: 'warning' };
      expect(calculateSeverityScore(issue)).toBe(8); // 5 * 1.5, rounded
    });

    test('scores suggestions lowest', () => {
      const issue = { category: 'visual', severity: 'suggestion' };
      expect(calculateSeverityScore(issue)).toBe(2); // 2 * 1.0
    });
  });

  describe('parseUxAnalysisResult', () => {
    test('parses critical issues', () => {
      const text = `## Critical Issues
### Issue 1
**Severity**: Critical
### Issue 2
**Severity**: Critical`;
      const result = parseUxAnalysisResult(text);
      expect(result.criticalCount).toBe(2);
    });

    test('parses warnings', () => {
      const text = `## Warnings
### Warning 1
**Severity**: Warning`;
      const result = parseUxAnalysisResult(text);
      expect(result.warningCount).toBe(1);
    });

    test('parses improvement suggestions', () => {
      const text = `## Improvement Suggestions
### Suggestion 1
### Suggestion 2
### Suggestion 3`;
      const result = parseUxAnalysisResult(text);
      expect(result.suggestionCount).toBe(3);
    });

    test('calculates total issues', () => {
      const text = `**Severity**: Critical
**Severity**: Critical
**Severity**: Warning
## Improvement Suggestions
### Suggestion 1`;
      const result = parseUxAnalysisResult(text);
      expect(result.totalIssues).toBe(4); // 2 critical + 1 warning + 1 suggestion
    });
  });

  describe('formatUxAnalysisReport', () => {
    test('formats complete report', () => {
      const data = {
        projectType: 'react_spa',
        fileCount: 25,
        analysisResult: '# Analysis\n\nSome findings...',
        issueCounts: {
          criticalCount: 2,
          warningCount: 3,
          suggestionCount: 5,
          totalIssues: 10,
        },
        timestamp: '2026-02-08 13:15:00',
      };
      const report = formatUxAnalysisReport(data);
      expect(report).toContain('Step 15: UX Analysis Report');
      expect(report).toContain('Project Type**: react_spa');
      expect(report).toContain('UI Files Analyzed**: 25');
      expect(report).toContain('Critical Issues**: 2');
      expect(report).toContain('Warnings**: 3');
      expect(report).toContain('Improvement Suggestions**: 5');
      expect(report).toContain('Total Findings**: 10');
      expect(report).toContain('# Analysis');
    });
  });

  // ========================================================================
  // ========================================================================
  // STEP15UXANALYSIS - readFilesSample Tests
  // ========================================================================

  describe('Step15UxAnalysis.readFilesSample', () => {
    test('reads content from files', async () => {
      const mockReadFile = jest.fn().mockResolvedValue('<html>content</html>');
      const step = new Step15UxAnalysis({
        fileOps: { readFile: mockReadFile },
        logger: {
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          success: jest.fn(),
          step: jest.fn(),
        },
      });

      const result = await step.readFilesSample(['index.html'], '/root');
      expect(result).toHaveLength(1);
      expect(result[0].file).toBe('index.html');
      expect(result[0].content).toBe('<html>content</html>');
    });

    test('truncates files exceeding maxBytesPerFile', async () => {
      const longContent = 'x'.repeat(5000);
      const mockReadFile = jest.fn().mockResolvedValue(longContent);
      const step = new Step15UxAnalysis({
        fileOps: { readFile: mockReadFile },
        logger: {
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          success: jest.fn(),
          step: jest.fn(),
        },
      });

      const result = await step.readFilesSample(['big.html'], '/root', 100, 10000);
      expect(result[0].content).toHaveLength(100 + '\n... (truncated)'.length);
      expect(result[0].content).toContain('... (truncated)');
    });

    test('stops when maxTotalBytes is reached', async () => {
      const mockReadFile = jest.fn().mockResolvedValue('x'.repeat(100));
      const step = new Step15UxAnalysis({
        fileOps: { readFile: mockReadFile },
        logger: {
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          success: jest.fn(),
          step: jest.fn(),
        },
      });

      const result = await step.readFilesSample(
        ['a.html', 'b.html', 'c.html'],
        '/root',
        200,
        100 // exactly one file's size — loop breaks before reading second
      );
      expect(result).toHaveLength(1);
    });

    test('skips unreadable files silently', async () => {
      const mockReadFile = jest
        .fn()
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockResolvedValueOnce('good content');
      const step = new Step15UxAnalysis({
        fileOps: { readFile: mockReadFile },
        logger: {
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          success: jest.fn(),
          step: jest.fn(),
        },
      });

      const result = await step.readFilesSample(['missing.html', 'good.html'], '/root');
      expect(result).toHaveLength(1);
      expect(result[0].file).toBe('good.html');
    });

    test('returns empty array when no files provided', async () => {
      const step = new Step15UxAnalysis({
        fileOps: { readFile: jest.fn() },
        logger: {
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          success: jest.fn(),
          step: jest.fn(),
        },
      });

      const result = await step.readFilesSample([], '/root');
      expect(result).toEqual([]);
    });
  });

  // ========================================================================
  // STEP15UXANALYSIS - Integration Tests
  // ========================================================================

  describe('Step15UxAnalysis', () => {
    let mockFileOps;
    let mockBacklog;
    let mockLogger;

    beforeEach(() => {
      mockFileOps = {
        listFiles: jest.fn(),
      };
      mockBacklog = {
        saveStepSummary: jest.fn(),
        saveStepIssues: jest.fn(),
      };
      mockLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        success: jest.fn(),
        step: jest.fn(),
      };
    });

    test('constructs with default options', () => {
      const step = new Step15UxAnalysis();
      expect(step).toBeInstanceOf(Step15UxAnalysis);
      expect(step.dryRun).toBe(false);
    });

    test('constructs with custom options', () => {
      const step = new Step15UxAnalysis({
        fileOps: mockFileOps,
        backlog: mockBacklog,
        logger: mockLogger,
        dryRun: true,
        projectRoot: '/custom/root',
      });
      expect(step.fileOps).toBe(mockFileOps);
      expect(step.dryRun).toBe(true);
      expect(step.projectRoot).toBe('/custom/root');
    });

    test('executes dry-run mode', async () => {
      const step = new Step15UxAnalysis({
        backlog: mockBacklog,
        logger: mockLogger,
        dryRun: true,
      });

      const result = await step.execute();

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith('[DRY RUN] UX analysis preview:');
    });

    test('skips for non-UI project type', async () => {
      const step = new Step15UxAnalysis({
        backlog: mockBacklog,
        logger: mockLogger,
      });

      // Mock discoverFiles to avoid real filesystem globbing (which is slow and
      // would find .html files in docs/api/html/, preventing the skip).
      step.discoverFiles = jest.fn().mockResolvedValue([]);

      const result = await step.execute({ projectType: 'nodejs_api' });

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('non-web project kind: nodejs_api');
      expect(mockBacklog.saveStepSummary).toHaveBeenCalledWith(
        '15',
        'UX_Analysis',
        expect.stringContaining('Skipped'),
        '⏭️'
      );
    });

    test('skips when no UI files found', async () => {
      const step = new Step15UxAnalysis({
        backlog: mockBacklog,
        logger: mockLogger,
      });

      // Mock discoverFiles to return empty array
      step.discoverFiles = jest.fn().mockResolvedValue([]);

      const result = await step.execute({ projectType: 'react_spa' });

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('no UI files found');
    });

    test('executes successful analysis', async () => {
      const step = new Step15UxAnalysis({
        backlog: mockBacklog,
        logger: mockLogger,
      });

      // Mock discoverFiles to return UI files
      step.discoverFiles = jest
        .fn()
        .mockResolvedValue(['src/App.jsx', 'src/Button.tsx', 'src/styles.css']);

      // Mock performAnalysis to return mock result
      step.performAnalysis = jest.fn().mockResolvedValue(`
**Severity**: Critical
**Severity**: Warning
## Improvement Suggestions
### Suggestion 1
      `);

      const result = await step.execute({ projectType: 'react_spa' });

      expect(result.success).toBe(true);
      expect(result.fileCount).toBe(3);
      expect(result.issueCounts).toBeDefined();
      expect(result.issueCounts.criticalCount).toBe(1);
      expect(result.issueCounts.warningCount).toBe(1);
      expect(mockBacklog.saveStepSummary).toHaveBeenCalled();
      expect(mockLogger.success).toHaveBeenCalledWith(
        expect.stringContaining('Step 15: UX Analysis completed')
      );
    });

    test('handles errors gracefully', async () => {
      const step = new Step15UxAnalysis({
        backlog: mockBacklog,
        logger: mockLogger,
      });

      step.discoverFiles = jest.fn().mockRejectedValue(new Error('File system error'));

      const result = await step.execute({ projectType: 'react_spa' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('File system error');
      expect(mockBacklog.saveStepIssues).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    // [BUG FIX 9a42860] persona renamed from 'ui_ux_designer' to 'ux_analyst'
    test('[BUG FIX] performAnalysis calls executeRequest with persona: ux_analyst', async () => {
      const requests = [];
      const step = new Step15UxAnalysis({
        backlog: mockBacklog,
        logger: mockLogger,
      });
      step.aiHelper = {
        initialize: jest.fn().mockResolvedValue(false),
        executeRequest: jest.fn().mockImplementation(async (prompt, opts) => {
          requests.push(opts);
          return '**Severity**: None';
        }),
      };

      await step.performAnalysis('/project', 'react_spa', ['src/App.jsx'], {});

      expect(requests.length).toBeGreaterThan(0);
      expect(requests[0].persona).toBe('ux_analyst');
    });

    // [BUG FIX 9a42860] promptsDir must be forwarded to AiHelper
    test('[BUG FIX] promptsDir option is accepted without error', () => {
      const step = new Step15UxAnalysis({
        backlog: mockBacklog,
        logger: mockLogger,
        promptsDir: '/tmp/prompts/step_15',
      });
      expect(step).toBeDefined();
      expect(step.aiHelper).toBeDefined();
    });
  });
});
