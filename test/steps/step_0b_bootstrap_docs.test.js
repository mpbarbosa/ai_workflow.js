/**
 * Tests for Step 0b: Bootstrap Documentation
 * @group steps
 */

import { jest } from '@jest/globals';
import {
  Step0bBootstrapDocs,
  DOC_TYPES,
  AI_HELPERS_PATH,
  shouldBootstrapDocs,
  identifyMissingDocs,
  determineBootstrapTargets,
  categorizeMissingDocs,
  filterSourceFiles,
  countFilesByExtension,
  determinePrimaryLanguage,
  buildTechnicalWriterPrompt,
  formatGapAnalysisReport,
  parseAiDocResponse,
  extractGitignoreDirNames,
} from '../../src/steps/step_0b_bootstrap_docs.js';

describe('Step 0b: Bootstrap Documentation', () => {
  // ========================================================================
  // PURE FUNCTIONS - Gap Analysis
  // ========================================================================

  describe('shouldBootstrapDocs', () => {
    test('returns true if README is too small', () => {
      const stats = {
        docCount: 5,
        readmeSize: 200,
        hasChangelog: true,
        hasDocsDir: true,
      };
      expect(shouldBootstrapDocs(stats)).toBe(true);
    });

    test('returns true if docs directory missing', () => {
      const stats = {
        docCount: 5,
        readmeSize: 1000,
        hasChangelog: true,
        hasDocsDir: false,
      };
      expect(shouldBootstrapDocs(stats)).toBe(true);
    });

    test('returns true if too few docs', () => {
      const stats = {
        docCount: 1,
        readmeSize: 1000,
        hasChangelog: true,
        hasDocsDir: true,
      };
      expect(shouldBootstrapDocs(stats)).toBe(true);
    });

    test('returns true if CHANGELOG missing', () => {
      const stats = {
        docCount: 5,
        readmeSize: 1000,
        hasChangelog: false,
        hasDocsDir: true,
      };
      expect(shouldBootstrapDocs(stats)).toBe(true);
    });

    test('returns false if all criteria met', () => {
      const stats = {
        docCount: 5,
        readmeSize: 1000,
        hasChangelog: true,
        hasDocsDir: true,
      };
      expect(shouldBootstrapDocs(stats)).toBe(false);
    });
  });

  describe('identifyMissingDocs', () => {
    test('identifies missing documentation files', () => {
      const existing = ['README.md', 'docs/API.md'];
      const missing = identifyMissingDocs(existing);

      expect(missing).toContain('CHANGELOG.md');
      expect(missing).toContain('CONTRIBUTING.md');
      expect(missing).toContain('LICENSE');
      expect(missing).not.toContain('README.md');
    });

    test('returns all docs if none exist', () => {
      const missing = identifyMissingDocs([]);
      expect(missing.length).toBe(Object.keys(DOC_TYPES).length);
    });

    test('returns empty if all docs exist', () => {
      const existing = Object.values(DOC_TYPES);
      const missing = identifyMissingDocs(existing);
      expect(missing).toEqual([]);
    });
  });

  describe('determineBootstrapTargets', () => {
    test('includes README when it exists but is undersized', () => {
      const targets = determineBootstrapTargets(['README.md', 'CHANGELOG.md'], {
        readmeSize: 90,
      });

      expect(targets[0]).toBe('README.md');
    });

    test('keeps missing docs when bootstrap is needed', () => {
      const targets = determineBootstrapTargets(['README.md'], {
        readmeSize: 1000,
      });

      expect(targets).toContain('CHANGELOG.md');
    });
  });

  describe('categorizeMissingDocs', () => {
    test('categorizes README as critical', () => {
      const missing = ['README.md', 'CHANGELOG.md', 'docs/API.md'];
      const categorized = categorizeMissingDocs(missing);

      expect(categorized.critical).toContain('README.md');
      expect(categorized.important).toContain('CHANGELOG.md');
      expect(categorized.optional).toContain('docs/API.md');
    });

    test('handles empty list', () => {
      const categorized = categorizeMissingDocs([]);
      expect(categorized.critical).toEqual([]);
      expect(categorized.important).toEqual([]);
      expect(categorized.optional).toEqual([]);
    });
  });

  describe('filterSourceFiles', () => {
    test('filters by source extensions', () => {
      const files = ['src/app.js', 'test/app.test.js', 'README.md', 'src/utils.py', 'package.json'];
      const source = filterSourceFiles(files);

      expect(source).toContain('src/app.js');
      expect(source).toContain('test/app.test.js');
      expect(source).toContain('src/utils.py');
      expect(source).not.toContain('README.md');
      expect(source).not.toContain('package.json');
    });

    test('handles empty list', () => {
      expect(filterSourceFiles([])).toEqual([]);
    });
  });

  describe('countFilesByExtension', () => {
    test('counts files by extension', () => {
      const files = ['app.js', 'utils.js', 'test.py', 'main.py', 'script.sh'];
      const counts = countFilesByExtension(files);

      expect(counts['.js']).toBe(2);
      expect(counts['.py']).toBe(2);
      expect(counts['.sh']).toBe(1);
    });

    test('handles empty list', () => {
      const counts = countFilesByExtension([]);
      expect(counts).toEqual({});
    });
  });

  describe('determinePrimaryLanguage', () => {
    test('identifies JavaScript as primary', () => {
      const counts = { '.js': 10, '.py': 3, '.sh': 1 };
      expect(determinePrimaryLanguage(counts)).toBe('JavaScript');
    });

    test('identifies Python as primary', () => {
      const counts = { '.js': 3, '.py': 15, '.sh': 1 };
      expect(determinePrimaryLanguage(counts)).toBe('Python');
    });

    test('handles unknown extension', () => {
      const counts = { '.xyz': 10 };
      expect(determinePrimaryLanguage(counts)).toBe('Unknown');
    });
  });

  // ========================================================================
  // PURE FUNCTIONS - Prompt Building
  // ========================================================================

  describe('buildTechnicalWriterPrompt', () => {
    test('builds complete prompt using inline fallback when no promptConfig provided', () => {
      const context = {
        projectName: 'My Project',
        projectDescription: 'A test project',
        primaryLanguage: 'JavaScript',
        docCount: 2,
        sourceCount: 50,
        missingDocs: ['CHANGELOG.md', 'CONTRIBUTING.md'],
      };

      const prompt = buildTechnicalWriterPrompt(context);

      expect(prompt).toContain('My Project');
      expect(prompt).toContain('A test project');
      expect(prompt).toContain('JavaScript');
      expect(prompt).toContain('CHANGELOG.md');
      expect(prompt).toContain('CONTRIBUTING.md');
      expect(prompt).toContain('Senior Technical Writer');
    });

    test('builds prompt from resolvedAiHelpers when provided', () => {
      const resolvedAiHelpers = {
        technical_writer_prompt: {
          role_prefix: 'You are a yaml-loaded technical writer.\n',
          behavioral_guidelines: 'Be helpful.\n',
          task_template:
            'Project: {project_name}\nProject Summary: {project_summary}\nLanguage: {primary_language}\nDocs: {doc_count}\nSources: {source_files}\n',
        },
      };
      const context = {
        projectName: 'YamlProject',
        projectDescription: 'Loaded from yaml',
        primaryLanguage: 'Python',
        docCount: 3,
        sourceCount: 10,
        missingDocs: ['CHANGELOG.md'],
        resolvedAiHelpers,
      };

      const prompt = buildTechnicalWriterPrompt(context);

      expect(prompt).toContain('yaml-loaded technical writer');
      expect(prompt).toContain('YamlProject');
      expect(prompt).toContain('Loaded from yaml');
      expect(prompt).toContain('Python');
      expect(prompt).toContain('CHANGELOG.md');
    });
  });

  describe('formatGapAnalysisReport', () => {
    test('formats complete report', () => {
      const data = {
        stats: {
          docCount: 2,
          sourceCount: 50,
          readmeSize: 1200,
          hasChangelog: false,
          hasDocsDir: true,
        },
        categorized: {
          critical: ['README.md'],
          important: ['CHANGELOG.md', 'CONTRIBUTING.md'],
          optional: ['docs/API.md'],
        },
        missingDocs: ['README.md', 'CHANGELOG.md', 'CONTRIBUTING.md', 'docs/API.md'],
        timestamp: '2026-02-08 13:30:00',
      };

      const report = formatGapAnalysisReport(data);

      expect(report).toContain('Step 0b: Documentation Gap Analysis Report');
      expect(report).toContain('Documentation Files**: 2');
      expect(report).toContain('Source Files**: 50');
      expect(report).toContain('Total Missing Documentation**: 4');
      expect(report).toContain('README.md');
      expect(report).toContain('CHANGELOG.md');
    });

    test('handles no missing docs', () => {
      const data = {
        stats: {
          docCount: 10,
          sourceCount: 50,
          readmeSize: 2000,
          hasChangelog: true,
          hasDocsDir: true,
        },
        categorized: { critical: [], important: [], optional: [] },
        missingDocs: [],
        timestamp: '2026-02-08 13:30:00',
      };

      const report = formatGapAnalysisReport(data);
      expect(report).toContain('Total Missing Documentation**: 0');
      expect(report).toContain('sufficient documentation coverage');
    });
  });

  describe('parseAiDocResponse', () => {
    test('parses single file from AI response', () => {
      const response = `## README.md\n\n### Priority: Critical\n\n### Content:\n\`\`\`markdown\n# My Project\nA great project.\n\`\`\`\n\n### Reasoning:\nEvery project needs a README.\n`;
      const results = parseAiDocResponse(response);
      expect(results).toHaveLength(1);
      expect(results[0].filename).toBe('README.md');
      expect(results[0].content).toContain('# My Project');
    });

    test('parses multiple files from AI response', () => {
      const response = [
        '## README.md',
        '### Priority: Critical',
        '### Content:',
        '```markdown',
        '# Project',
        '```',
        '---',
        '## CHANGELOG.md',
        '### Priority: Important',
        '### Content:',
        '```markdown',
        '# Changelog',
        '```',
      ].join('\n');
      const results = parseAiDocResponse(response);
      expect(results).toHaveLength(2);
      expect(results[0].filename).toBe('README.md');
      expect(results[1].filename).toBe('CHANGELOG.md');
    });

    test('parses nested path filenames', () => {
      const response = `## docs/API.md\n\n### Content:\n\`\`\`markdown\n# API\n\`\`\`\n`;
      const results = parseAiDocResponse(response);
      expect(results[0].filename).toBe('docs/API.md');
    });

    test('returns empty array for unparseable response', () => {
      expect(parseAiDocResponse('')).toEqual([]);
      expect(parseAiDocResponse('No sections here')).toEqual([]);
    });

    test('strips backtick formatting from filenames', () => {
      const response = '## `README.md`\n\n### Content:\n```markdown\n# Hi\n```\n';
      const results = parseAiDocResponse(response);
      expect(results[0].filename).toBe('README.md');
    });

    test('parses content block with non-markdown fence language (text)', () => {
      const response = '## CHANGELOG.md\n\n### Content:\n```text\n# Changelog\n```\n';
      const results = parseAiDocResponse(response);
      expect(results).toHaveLength(1);
      expect(results[0].filename).toBe('CHANGELOG.md');
      expect(results[0].content).toContain('# Changelog');
    });

    test('parses content block with bash fence language', () => {
      const response =
        '## docs/GETTING_STARTED.md\n\n### Content:\n```bash\n# Getting Started\n```\n';
      const results = parseAiDocResponse(response);
      expect(results).toHaveLength(1);
      expect(results[0].filename).toBe('docs/GETTING_STARTED.md');
    });

    test('parses content block with yaml fence language', () => {
      const response = '## .workflow-config.yaml\n\n### Content:\n```yaml\nkey: value\n```\n';
      const results = parseAiDocResponse(response);
      expect(results).toHaveLength(1);
      expect(results[0].content).toBe('key: value');
    });

    test('parses content block with bare (no-language) fence', () => {
      const response = '## CONTRIBUTING.md\n\n### Content:\n```\n# Contributing\n```\n';
      const results = parseAiDocResponse(response);
      expect(results).toHaveLength(1);
      expect(results[0].content).toContain('# Contributing');
    });
  });

  // ========================================================================
  // CONSTANTS - AI_HELPERS_PATH
  // ========================================================================

  describe('AI_HELPERS_PATH', () => {
    test('points to the ai_workflow.js package .workflow_core directory (not projectRoot)', () => {
      expect(AI_HELPERS_PATH).toMatch(/\.workflow_core[/\\]config[/\\]ai_helpers\.yaml$/);
      expect(AI_HELPERS_PATH).not.toContain('undefined');
    });

    test('AI_HELPERS_PATH resolves to an existing file', async () => {
      const { existsSync } = await import('fs');
      expect(existsSync(AI_HELPERS_PATH)).toBe(true);
    });
  });

  // ========================================================================
  // PURE FUNCTIONS - extractGitignoreDirNames
  // ========================================================================

  describe('extractGitignoreDirNames', () => {
    test('returns empty array for empty or non-string input', () => {
      expect(extractGitignoreDirNames('')).toEqual([]);
      expect(extractGitignoreDirNames(null)).toEqual([]);
      expect(extractGitignoreDirNames(undefined)).toEqual([]);
    });

    test('extracts simple directory names', () => {
      const content = 'node_modules\ndist\nbuild\n';
      expect(extractGitignoreDirNames(content)).toEqual(['node_modules', 'dist', 'build']);
    });

    test('strips trailing slashes', () => {
      const content = '.ai_workflow/\ncoverage/\n.env/\n';
      expect(extractGitignoreDirNames(content)).toEqual(['.ai_workflow', 'coverage', '.env']);
    });

    test('skips comments and empty lines', () => {
      const content = '# dependencies\nnode_modules\n\n# output\ndist/\n';
      expect(extractGitignoreDirNames(content)).toEqual(['node_modules', 'dist']);
    });

    test('skips wildcard patterns', () => {
      const content = '*.log\n*.tmp\n**/*.js\nnode_modules\n';
      expect(extractGitignoreDirNames(content)).toEqual(['node_modules']);
    });

    test('skips negation patterns', () => {
      const content = '!important.md\ndist\n';
      expect(extractGitignoreDirNames(content)).toEqual(['dist']);
    });

    test('skips nested path patterns to avoid wrongly excluding parent directories', () => {
      // e.g. "docs/api-generated/" must NOT cause the entire "docs/" to be excluded
      const content = 'src/generated/\nfoo/bar\ndist\n';
      expect(extractGitignoreDirNames(content)).toEqual(['dist']);
    });

    test('skips nested path patterns even when they share a top-level prefix', () => {
      // ".ai_workflow/backlog/" etc. should NOT imply excluding ".ai_workflow" unless
      // ".ai_workflow/" is listed as a top-level entry on its own.
      const content = '.ai_workflow/backlog/\n.ai_workflow/logs/\n.ai_workflow/metrics/\ndist\n';
      expect(extractGitignoreDirNames(content)).toEqual(['dist']);
    });

    test('includes dot-prefixed names like .ai_workflow', () => {
      const content = '.ai_workflow/\n.cache\n.env\n';
      expect(extractGitignoreDirNames(content)).toEqual(['.ai_workflow', '.cache', '.env']);
    });
  });

  // ========================================================================
  // STEP0BBOOTSTRAPDOCS - Integration Tests
  // ========================================================================

  describe('Step0bBootstrapDocs', () => {
    let mockFileOps;
    let mockBacklog;
    let mockLogger;

    beforeEach(() => {
      mockFileOps = {
        readFile: jest.fn(),
        writeFile: jest.fn(),
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
        debug: jest.fn(),
        step: jest.fn(),
      };
    });

    test('constructs with default options', () => {
      const step = new Step0bBootstrapDocs();
      expect(step).toBeInstanceOf(Step0bBootstrapDocs);
      expect(step.dryRun).toBe(false);
    });

    test('constructs with custom options', () => {
      const step = new Step0bBootstrapDocs({
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
      const step = new Step0bBootstrapDocs({
        backlog: mockBacklog,
        logger: mockLogger,
        dryRun: true,
      });

      const result = await step.execute();

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith('[DRY RUN] Documentation gap analysis preview:');
    });

    test('skips when documentation coverage is adequate and all catalog docs are present', async () => {
      const step = new Step0bBootstrapDocs({
        backlog: mockBacklog,
        logger: mockLogger,
      });

      step.gatherProjectStats = jest.fn().mockResolvedValue({
        docCount: 10,
        sourceCount: 50,
        readmeSize: 2000,
        hasChangelog: true,
        hasDocsDir: true,
      });

      // All DOC_TYPES catalog files are present — identifyMissingDocs returns []
      step.listExistingDocs = jest
        .fn()
        .mockResolvedValue([
          'README.md',
          'CHANGELOG.md',
          'CONTRIBUTING.md',
          'LICENSE',
          'docs/API.md',
          'docs/ARCHITECTURE.md',
          'docs/GETTING_STARTED.md',
        ]);

      const result = await step.execute();

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('all catalog documentation files present');
      expect(mockBacklog.saveStepSummary).toHaveBeenCalledWith(
        '0b',
        'Bootstrap_Docs',
        expect.stringContaining('Skipped'),
        '⏭️'
      );
    });

    test('executes successful gap analysis', async () => {
      const mockAiHelper = { initialize: jest.fn().mockResolvedValue(false) };
      const step = new Step0bBootstrapDocs({
        backlog: mockBacklog,
        logger: mockLogger,
        aiHelper: mockAiHelper,
      });

      step.gatherProjectStats = jest.fn().mockResolvedValue({
        docCount: 2,
        sourceCount: 50,
        readmeSize: 400,
        hasChangelog: false,
        hasDocsDir: true,
      });

      step.listExistingDocs = jest.fn().mockResolvedValue(['README.md', 'docs/API.md']);

      const result = await step.execute();

      expect(result.success).toBe(true);
      expect(result.missingDocs).toBeDefined();
      expect(result.categorized).toBeDefined();
      expect(mockBacklog.saveStepSummary).toHaveBeenCalled();
      expect(mockLogger.success).toHaveBeenCalledWith(
        expect.stringContaining('Step 0b: Documentation gap analysis completed')
      );
    });

    test('gatherProjectStats excludes .ai_workflow directory', async () => {
      const listFn = jest.fn().mockResolvedValue(['/proj/README.md', '/proj/src/index.js']);
      const step = new Step0bBootstrapDocs({
        backlog: mockBacklog,
        logger: { ...mockLogger, debug: jest.fn() },
        fileOps: {
          listDirectoryRecursive: listFn,
          stat: jest.fn().mockRejectedValue(new Error('not found')),
          readFile: jest.fn().mockResolvedValue('.ai_workflow/\nnode_modules\n'),
        },
        projectRoot: '/proj',
      });

      await step.gatherProjectStats();

      expect(listFn).toHaveBeenCalledWith('/proj', {
        exclude: expect.arrayContaining(['.ai_workflow', 'node_modules']),
      });
    });

    test('listExistingDocs excludes .ai_workflow directory', async () => {
      const listFn = jest.fn().mockResolvedValue(['/proj/README.md', '/proj/docs/API.md']);
      const step = new Step0bBootstrapDocs({
        backlog: mockBacklog,
        logger: mockLogger,
        fileOps: {
          listDirectoryRecursive: listFn,
          readFile: jest.fn().mockResolvedValue('.ai_workflow/\ncoverage/\n'),
        },
        projectRoot: '/proj',
      });

      const docs = await step.listExistingDocs();

      expect(listFn).toHaveBeenCalledWith('/proj', {
        exclude: expect.arrayContaining(['.ai_workflow', 'coverage']),
      });
      expect(docs).toContain('README.md');
      expect(docs).toContain('docs/API.md');
    });

    test('handles errors gracefully', async () => {
      const step = new Step0bBootstrapDocs({
        backlog: mockBacklog,
        logger: mockLogger,
      });

      step.gatherProjectStats = jest.fn().mockRejectedValue(new Error('File system error'));

      const result = await step.execute();

      expect(result.success).toBe(false);
      expect(result.error).toBe('File system error');
      expect(mockBacklog.saveStepIssues).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});
