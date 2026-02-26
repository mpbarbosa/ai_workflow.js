/**
 * @fileoverview Tests for Step 0: Pre-Analysis (v2.0.0)
 * @module test/steps/step_00_analyze
 */

import {
  classifyFile,
  classifyFiles,
  determineChangeScope,
  formatAnalysisSummary,
  createBacklogContent,
  Step0Analyzer,
  CHANGE_SCOPE,
  FILE_CATEGORY,
} from '../../src/steps/step_00_analyze.js';

describe('Step 0: Pre-Analysis', () => {
  // ========================================================================
  // PURE FUNCTIONS - File Classification
  // ========================================================================

  describe('classifyFile', () => {
    describe('workflow artifacts', () => {
      test('classifies .ai_workflow files as artifacts', () => {
        expect(classifyFile('.ai_workflow/backlog/report.md')).toBe(
          FILE_CATEGORY.WORKFLOW_ARTIFACT
        );
        expect(classifyFile('.ai_workflow/logs/step1.log')).toBe(FILE_CATEGORY.WORKFLOW_ARTIFACT);
      });

      test('classifies src/workflow artifacts as artifacts', () => {
        expect(classifyFile('src/workflow/backlog/report.md')).toBe(
          FILE_CATEGORY.WORKFLOW_ARTIFACT
        );
        expect(classifyFile('src/workflow/logs/step1.log')).toBe(FILE_CATEGORY.WORKFLOW_ARTIFACT);
      });
    });

    describe('documentation files', () => {
      test('classifies docs/ files as documentation', () => {
        expect(classifyFile('docs/README.md')).toBe(FILE_CATEGORY.DOCUMENTATION);
        expect(classifyFile('docs/api/methods.md')).toBe(FILE_CATEGORY.DOCUMENTATION);
      });

      test('classifies markdown files as documentation', () => {
        expect(classifyFile('README.md')).toBe(FILE_CATEGORY.DOCUMENTATION);
        expect(classifyFile('CHANGELOG.md')).toBe(FILE_CATEGORY.DOCUMENTATION);
        expect(classifyFile('notes.md')).toBe(FILE_CATEGORY.DOCUMENTATION);
      });
    });

    describe('test files', () => {
      test('classifies test/ directory files as tests', () => {
        expect(classifyFile('test/core/logger.test.js')).toBe(FILE_CATEGORY.TEST);
        expect(classifyFile('tests/unit/utils.test.js')).toBe(FILE_CATEGORY.TEST);
      });

      test('classifies test patterns as tests', () => {
        expect(classifyFile('src/utils_test.js')).toBe(FILE_CATEGORY.TEST);
        expect(classifyFile('src/utils.test.js')).toBe(FILE_CATEGORY.TEST);
        expect(classifyFile('src/utils.spec.js')).toBe(FILE_CATEGORY.TEST);
        expect(classifyFile('src/test_utils.js')).toBe(FILE_CATEGORY.TEST);
      });

      test('handles multiple languages', () => {
        expect(classifyFile('test_utils.py')).toBe(FILE_CATEGORY.TEST);
        expect(classifyFile('utils_test.go')).toBe(FILE_CATEGORY.TEST);
        expect(classifyFile('utils.test.ts')).toBe(FILE_CATEGORY.TEST);
        expect(classifyFile('utils.spec.tsx')).toBe(FILE_CATEGORY.TEST);
      });
    });

    describe('configuration files', () => {
      test('classifies config files by extension', () => {
        expect(classifyFile('config.yaml')).toBe(FILE_CATEGORY.CONFIG);
        expect(classifyFile('settings.yml')).toBe(FILE_CATEGORY.CONFIG);
        expect(classifyFile('package.json')).toBe(FILE_CATEGORY.CONFIG);
        expect(classifyFile('Cargo.toml')).toBe(FILE_CATEGORY.CONFIG);
        expect(classifyFile('app.ini')).toBe(FILE_CATEGORY.CONFIG);
        expect(classifyFile('nginx.conf')).toBe(FILE_CATEGORY.CONFIG);
      });
    });

    describe('source code files', () => {
      test('classifies src/ files as source', () => {
        expect(classifyFile('src/core/logger.js')).toBe(FILE_CATEGORY.SOURCE);
        expect(classifyFile('src/utils/helpers.py')).toBe(FILE_CATEGORY.SOURCE);
      });

      test('classifies lib/ files as source', () => {
        expect(classifyFile('lib/config.js')).toBe(FILE_CATEGORY.SOURCE);
        expect(classifyFile('lib/parser.go')).toBe(FILE_CATEGORY.SOURCE);
      });

      test('classifies source extensions as source', () => {
        expect(classifyFile('script.sh')).toBe(FILE_CATEGORY.SOURCE);
        expect(classifyFile('app.js')).toBe(FILE_CATEGORY.SOURCE);
        expect(classifyFile('main.py')).toBe(FILE_CATEGORY.SOURCE);
        expect(classifyFile('server.go')).toBe(FILE_CATEGORY.SOURCE);
        expect(classifyFile('App.java')).toBe(FILE_CATEGORY.SOURCE);
        expect(classifyFile('main.rs')).toBe(FILE_CATEGORY.SOURCE);
        expect(classifyFile('utils.ts')).toBe(FILE_CATEGORY.SOURCE);
        expect(classifyFile('Component.tsx')).toBe(FILE_CATEGORY.SOURCE);
        expect(classifyFile('program.c')).toBe(FILE_CATEGORY.SOURCE);
        expect(classifyFile('program.cpp')).toBe(FILE_CATEGORY.SOURCE);
      });
    });

    describe('edge cases', () => {
      test('defaults unclassified files to config', () => {
        expect(classifyFile('random.txt')).toBe(FILE_CATEGORY.CONFIG);
        expect(classifyFile('image.png')).toBe(FILE_CATEGORY.CONFIG);
      });
    });
  });

  describe('classifyFiles', () => {
    test('classifies empty array', () => {
      const result = classifyFiles([]);
      expect(result.counts.documentation).toBe(0);
      expect(result.counts.test).toBe(0);
      expect(result.counts.source).toBe(0);
      expect(result.counts.config).toBe(0);
      expect(result.categorizedFiles.documentation).toEqual([]);
    });

    test('classifies mixed files correctly', () => {
      const files = [
        'README.md',
        'docs/api.md',
        'test/unit.test.js',
        'src/app.js',
        'config.yaml',
        '.ai_workflow/logs/step1.log',
      ];

      const result = classifyFiles(files);

      expect(result.counts.documentation).toBe(2);
      expect(result.counts.test).toBe(1);
      expect(result.counts.source).toBe(1);
      expect(result.counts.config).toBe(1);
      expect(result.counts.workflow_artifact).toBe(0); // Not counted

      expect(result.categorizedFiles.documentation).toEqual(['README.md', 'docs/api.md']);
      expect(result.categorizedFiles.test).toEqual(['test/unit.test.js']);
      expect(result.categorizedFiles.source).toEqual(['src/app.js']);
      expect(result.categorizedFiles.config).toEqual(['config.yaml']);
    });

    test('excludes workflow artifacts from counts', () => {
      const files = ['.ai_workflow/backlog/report.md', 'src/workflow/logs/step1.log', 'README.md'];

      const result = classifyFiles(files);

      expect(result.counts.documentation).toBe(1);
      expect(result.counts.workflow_artifact).toBe(0);
      expect(result.categorizedFiles.documentation).toEqual(['README.md']);
    });

    test('handles all documentation files', () => {
      const files = ['README.md', 'CHANGELOG.md', 'docs/guide.md', 'docs/api/methods.md'];

      const result = classifyFiles(files);

      expect(result.counts.documentation).toBe(4);
      expect(result.counts.test).toBe(0);
      expect(result.counts.source).toBe(0);
    });

    test('handles all test files', () => {
      const files = [
        'test/unit.test.js',
        'tests/integration.spec.js',
        'src/utils_test.py',
        'lib/parser.test.ts',
      ];

      const result = classifyFiles(files);

      expect(result.counts.test).toBe(4);
      expect(result.counts.documentation).toBe(0);
      expect(result.counts.source).toBe(0);
    });

    test('handles all source files', () => {
      const files = ['src/app.js', 'src/utils.ts', 'lib/config.py', 'main.go', 'script.sh'];

      const result = classifyFiles(files);

      expect(result.counts.source).toBe(5);
      expect(result.counts.test).toBe(0);
      expect(result.counts.documentation).toBe(0);
    });
  });

  // ========================================================================
  // PURE FUNCTIONS - Change Scope Detection
  // ========================================================================

  describe('determineChangeScope', () => {
    test('returns NO_CHANGES for zero modified files', () => {
      const counts = { documentation: 0, test: 0, source: 0, config: 0 };
      expect(determineChangeScope(counts, 0)).toBe(CHANGE_SCOPE.NO_CHANGES);
    });

    test('returns DOCUMENTATION_ONLY for only doc changes', () => {
      const counts = { documentation: 5, test: 0, source: 0, config: 0 };
      expect(determineChangeScope(counts, 5)).toBe(CHANGE_SCOPE.DOCUMENTATION_ONLY);
    });

    test('returns TESTS_ONLY for only test changes', () => {
      const counts = { documentation: 0, test: 3, source: 0, config: 0 };
      expect(determineChangeScope(counts, 3)).toBe(CHANGE_SCOPE.TESTS_ONLY);
    });

    test('returns SOURCE_CODE for only source changes', () => {
      const counts = { documentation: 0, test: 0, source: 7, config: 0 };
      expect(determineChangeScope(counts, 7)).toBe(CHANGE_SCOPE.SOURCE_CODE);
    });

    test('returns CONFIGURATION for only config changes', () => {
      const counts = { documentation: 0, test: 0, source: 0, config: 2 };
      expect(determineChangeScope(counts, 2)).toBe(CHANGE_SCOPE.CONFIGURATION);
    });

    test('returns FULL_STACK for code + tests + docs', () => {
      const counts = { documentation: 2, test: 3, source: 5, config: 0 };
      expect(determineChangeScope(counts, 10)).toBe(CHANGE_SCOPE.FULL_STACK);
    });

    test('returns CODE_AND_TESTS for code + tests', () => {
      const counts = { documentation: 0, test: 3, source: 4, config: 0 };
      expect(determineChangeScope(counts, 7)).toBe(CHANGE_SCOPE.CODE_AND_TESTS);
    });

    test('returns CODE_AND_DOCS for code + docs', () => {
      const counts = { documentation: 2, test: 0, source: 3, config: 0 };
      expect(determineChangeScope(counts, 5)).toBe(CHANGE_SCOPE.CODE_AND_DOCS);
    });

    test('returns MIXED_CHANGES for other combinations', () => {
      const counts = { documentation: 1, test: 0, source: 0, config: 2 };
      expect(determineChangeScope(counts, 3)).toBe(CHANGE_SCOPE.MIXED_CHANGES);
    });

    test('handles missing properties gracefully', () => {
      const counts = {}; // No properties
      expect(determineChangeScope(counts, 5)).toBe(CHANGE_SCOPE.MIXED_CHANGES);
    });
  });

  // ========================================================================
  // PURE FUNCTIONS - Formatting
  // ========================================================================

  describe('formatAnalysisSummary', () => {
    test('formats basic analysis', () => {
      const analysis = {
        commitsAhead: 3,
        modifiedFiles: 10,
        changeScope: 'full-stack',
        fileCounts: { documentation: 2, test: 3, source: 4, config: 1 },
      };

      const summary = formatAnalysisSummary(analysis);

      expect(summary).toContain('Commits ahead: 3');
      expect(summary).toContain('Modified files: 10');
      expect(summary).toContain('Change scope: full-stack');
      expect(summary).toContain('Documentation: 2 files');
      expect(summary).toContain('Tests: 3 files');
      expect(summary).toContain('Source: 4 files');
      expect(summary).toContain('Config: 1 files');
    });

    test('includes project kind info', () => {
      const analysis = {
        commitsAhead: 1,
        modifiedFiles: 5,
        changeScope: 'code-only',
        fileCounts: { source: 5 },
        projectKind: {
          kind: 'nodejs_api',
          description: 'Node.js API Server',
          confidence: 95,
        },
      };

      const summary = formatAnalysisSummary(analysis);

      expect(summary).toContain('Project kind: Node.js API Server (95% confidence)');
    });

    test('includes tech stack info', () => {
      const analysis = {
        commitsAhead: 2,
        modifiedFiles: 3,
        changeScope: 'mixed',
        fileCounts: {},
        techStack: {
          primaryLanguage: 'javascript',
          buildSystem: 'npm',
          testFramework: 'jest',
        },
      };

      const summary = formatAnalysisSummary(analysis);

      expect(summary).toContain('Language: javascript');
      expect(summary).toContain('Build system: npm');
      expect(summary).toContain('Test framework: jest');
    });

    test('omits missing optional fields', () => {
      const analysis = {
        commitsAhead: 0,
        modifiedFiles: 0,
        changeScope: 'no-changes',
      };

      const summary = formatAnalysisSummary(analysis);

      expect(summary).not.toContain('Project kind:');
      expect(summary).not.toContain('Language:');
    });
  });

  describe('createBacklogContent', () => {
    test('creates basic backlog content', () => {
      const analysis = {
        commitsAhead: 5,
        modifiedFiles: 12,
        changeScope: 'full-stack',
        fileCounts: { documentation: 3, test: 4, source: 4, config: 1 },
      };

      const content = createBacklogContent(analysis);

      expect(content).toContain('**Commits Ahead:** 5');
      expect(content).toContain('**Modified Files:** 12');
      expect(content).toContain('**Change Scope:** full-stack');
      expect(content).toContain('- Documentation: 3');
      expect(content).toContain('- Tests: 4');
      expect(content).toContain('- Source: 4');
      expect(content).toContain('- Config: 1');
    });

    test('includes tech stack section', () => {
      const analysis = {
        commitsAhead: 1,
        modifiedFiles: 1,
        changeScope: 'code-only',
        fileCounts: {},
        techStack: {
          primaryLanguage: 'python',
          buildSystem: 'setuptools',
          testFramework: 'pytest',
          packageFile: 'setup.py',
        },
      };

      const content = createBacklogContent(analysis);

      expect(content).toContain('### Tech Stack');
      expect(content).toContain('**Language:** python');
      expect(content).toContain('**Build System:** setuptools');
      expect(content).toContain('**Test Framework:** pytest');
      expect(content).toContain('**Package File:** setup.py');
    });

    test('includes project kind section', () => {
      const analysis = {
        commitsAhead: 1,
        modifiedFiles: 1,
        changeScope: 'docs-only',
        fileCounts: {},
        projectKind: {
          kind: 'shell_script_automation',
          description: 'Shell Script Automation',
          confidence: 100,
        },
      };

      const content = createBacklogContent(analysis);

      expect(content).toContain('### Project Kind');
      expect(content).toContain('**Type:** Shell Script Automation');
      expect(content).toContain('**Confidence:** 100%');
      expect(content).toContain('**Identifier:** shell_script_automation');
    });

    test('includes smoke test section if present', () => {
      const analysis = {
        commitsAhead: 1,
        modifiedFiles: 1,
        changeScope: 'tests-only',
        fileCounts: {},
        smokeTest: {
          status: '✅ Passed',
          details: 'Test infrastructure validated successfully',
        },
      };

      const content = createBacklogContent(analysis);

      expect(content).toContain('### Test Infrastructure Pre-Validation');
      expect(content).toContain('**Status:** ✅ Passed');
      expect(content).toContain('**Details:** Test infrastructure validated successfully');
    });

    test('includes git status if provided', () => {
      const analysis = {
        commitsAhead: 1,
        modifiedFiles: 2,
        changeScope: 'code-only',
        fileCounts: {},
      };
      const gitStatus = 'M  src/app.js\nM  src/utils.js';

      const content = createBacklogContent(analysis, gitStatus);

      expect(content).toContain('### Modified Files List');
      expect(content).toContain('M  src/app.js');
      expect(content).toContain('M  src/utils.js');
    });
  });

  // ========================================================================
  // INTEGRATION TESTS - Step0Analyzer Class
  // ========================================================================

  describe('Step0Analyzer', () => {
    let mockGitOps;
    let mockProjectDetection;
    let mockTechStackDetection;
    let mockProjectKindConfig;
    let mockBacklogManager;
    let analyzer;

    beforeEach(() => {
      // Mock dependencies
      mockGitOps = {
        getCommitsAhead: () => Promise.resolve(3),
        getTotalChanges: () => Promise.resolve(10),
        getModifiedFiles: () =>
          Promise.resolve([
            'README.md',
            'docs/api.md',
            'test/unit.test.js',
            'test/integration.test.js',
            'src/app.js',
            'src/utils.js',
            'src/config.js',
            'lib/parser.js',
            'config.yaml',
            '.env',
          ]),
        getStatusOutput: () => Promise.resolve('M  README.md\nM  src/app.js'),
      };

      mockProjectDetection = {
        detectProjectKind: () =>
          Promise.resolve({
            kind: 'nodejs_api',
            description: 'Node.js API Server',
            confidence: 95,
          }),
        getKindDescription: () => Promise.resolve('Node.js API Server'),
      };

      mockTechStackDetection = {
        detectTechStack: () =>
          Promise.resolve({
            primaryLanguage: 'javascript',
            buildSystem: 'npm',
            testFramework: 'jest',
            packageFile: 'package.json',
          }),
      };

      mockProjectKindConfig = {
        getProjectKind: () => Promise.resolve(null),
      };

      mockBacklogManager = {
        saveStepIssues: () => Promise.resolve(undefined),
        saveStepSummary: () => Promise.resolve(undefined),
      };

      analyzer = new Step0Analyzer({
        gitOps: mockGitOps,
        projectDetection: mockProjectDetection,
        techStackDetection: mockTechStackDetection,
        projectKindConfig: mockProjectKindConfig,
        backlogManager: mockBacklogManager,
      });
    });

    test('executes successfully with full analysis', async () => {
      const result = await analyzer.execute('/test/project');

      expect(result.success).toBe(true);
      expect(result.analysis).toBeDefined();
      expect(result.analysis.commitsAhead).toBe(3);
      expect(result.analysis.modifiedFiles).toBe(10);
      expect(result.analysis.changeScope).toBe(CHANGE_SCOPE.FULL_STACK);
      expect(result.analysis.fileCounts.documentation).toBe(2);
      expect(result.analysis.fileCounts.test).toBe(2);
      expect(result.analysis.fileCounts.source).toBe(4);
      expect(result.analysis.fileCounts.config).toBe(2);
    });

    test('includes contextUpdate with detected projectType', async () => {
      const result = await analyzer.execute('/test/project');

      expect(result.contextUpdate).toBeDefined();
      expect(result.contextUpdate.projectType).toBe(result.analysis.projectKind?.kind ?? null);
    });

    test('contextUpdate uses configured project kind when available', async () => {
      analyzer.projectKindConfig.getProjectKind = () => Promise.resolve('react_spa');

      const result = await analyzer.execute('/test/project');

      expect(result.contextUpdate.projectType).toBe('react_spa');
    });

    test('uses configured project kind if available', async () => {
      // Override mock for this test
      analyzer.projectKindConfig.getProjectKind = () => Promise.resolve('react_spa');

      const result = await analyzer.execute('/test/project');

      expect(result.success).toBe(true);
      expect(result.analysis.projectKind.kind).toBe('react_spa');
      expect(result.analysis.projectKind.confidence).toBe(100);
      expect(result.analysis.projectKind.source).toBe('config');
    });

    test('auto-detects project kind if not configured', async () => {
      const result = await analyzer.execute('/test/project');

      expect(result.success).toBe(true);
      expect(result.analysis.projectKind.kind).toBe('nodejs_api');
      expect(result.analysis.projectKind.confidence).toBe(95);
      expect(result.analysis.projectKind.source).toBe('auto-detected');
    });

    test('detects tech stack', async () => {
      const result = await analyzer.execute('/test/project');

      expect(result.success).toBe(true);
      expect(result.analysis.techStack.primaryLanguage).toBe('javascript');
      expect(result.analysis.techStack.buildSystem).toBe('npm');
      expect(result.analysis.techStack.testFramework).toBe('jest');
    });

    test('saves to backlog', async () => {
      // Track calls
      let stepIssuesCalled = false;
      let stepSummaryCalled = false;

      analyzer.backlogManager.saveStepIssues = (...args) => {
        stepIssuesCalled = true;
        expect(args[0]).toBe(0);
        expect(args[1]).toBe('Pre_Analysis');
        expect(args[2]).toContain('**Commits Ahead:** 3');
        return Promise.resolve();
      };

      analyzer.backlogManager.saveStepSummary = (...args) => {
        stepSummaryCalled = true;
        expect(args[0]).toBe(0);
        expect(args[1]).toBe('Pre_Analysis');
        expect(args[2]).toContain('Analyzed 10 modified files');
        expect(args[3]).toBe('✅');
        return Promise.resolve();
      };

      await analyzer.execute('/test/project');

      expect(stepIssuesCalled).toBe(true);
      expect(stepSummaryCalled).toBe(true);
    });

    test('handles errors gracefully', async () => {
      analyzer.gitOps.getCommitsAhead = () => Promise.reject(new Error('Git error'));

      const result = await analyzer.execute('/test/project');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Git error');
    });

    test('handles missing dependencies', async () => {
      const minimalAnalyzer = new Step0Analyzer({
        gitOps: mockGitOps,
      });

      const result = await minimalAnalyzer.execute('/test/project');

      expect(result.success).toBe(true);
      expect(result.analysis.projectKind).toBeNull();
      expect(result.analysis.techStack).toBeNull();
    });

    test('returns correct metadata', () => {
      const metadata = analyzer.getMetadata();

      expect(metadata.id).toBe(0);
      expect(metadata.name).toBe('Pre-Analysis');
      expect(metadata.canSkip).toBe(false);
      expect(metadata.dependencies).toEqual([]);
    });
  });
});
