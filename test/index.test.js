/**
 * Tests for main index.js entry point
 * Ensures all exports are properly defined and accessible
 */

import * as index from '../src/index.js';

describe('index.js - Public API Exports', () => {
  describe('Phase 1: Core Foundation exports', () => {
    it('should export colors utilities', () => {
      expect(index.colors).toBeDefined();
      expect(index.colorize).toBeDefined();
      expect(index.supportsColor).toBeDefined();
    });

    it('should export Logger class and instance', () => {
      expect(index.Logger).toBeDefined();
      expect(index.logger).toBeDefined();
      expect(index.LogLevel).toBeDefined();
    });

    it('should export executor functions', () => {
      expect(index.execute).toBeDefined();
      expect(index.executeStream).toBeDefined();
      expect(index.executeSudo).toBeDefined();
    });

    it('should export system detection utilities', () => {
      expect(index.OS).toBeDefined();
      expect(index.PackageManager).toBeDefined();
      expect(index.detectOS).toBeDefined();
      expect(index.detectPackageManager).toBeDefined();
      expect(index.commandExists).toBeDefined();
      expect(index.getSystemInfo).toBeDefined();
    });

    it('should export version utilities', () => {
      expect(index.parseVersion).toBeDefined();
      expect(index.compareVersions).toBeDefined();
      expect(index.isGreaterThan).toBeDefined();
      expect(index.isLessThan).toBeDefined();
      expect(index.isEqual).toBeDefined();
      expect(index.getLatestVersion).toBeDefined();
    });

    it('should export error classes', () => {
      expect(index.WorkflowError).toBeDefined();
      expect(index.SystemError).toBeDefined();
      expect(index.ExecutionError).toBeDefined();
      expect(index.ConfigurationError).toBeDefined();
      expect(index.ValidationError).toBeDefined();
      expect(index.FileSystemError).toBeDefined();
    });
  });

  describe('Phase 2: Configuration & State Management exports', () => {
    it('should export Config class', () => {
      expect(index.Config).toBeDefined();
    });

    it('should export Backlog class', () => {
      expect(index.Backlog).toBeDefined();
    });

    it('should export SessionManager class', () => {
      expect(index.SessionManager).toBeDefined();
    });

    it('should export Metrics class', () => {
      expect(index.Metrics).toBeDefined();
    });
  });

  describe('Phase 3: File Operations exports', () => {
    it('should export file operation utilities', () => {
      expect(index.validatePath).toBeDefined();
      expect(index.filterByExtension).toBeDefined();
      expect(index.FileOperations).toBeDefined();
    });

    it('should export edit operation utilities', () => {
      expect(index.findMatches).toBeDefined();
      expect(index.replaceAll).toBeDefined();
      expect(index.EditOperations).toBeDefined();
    });

    it('should export general utilities', () => {
      expect(index.camelCase).toBeDefined();
      expect(index.dedupe).toBeDefined();
      expect(index.deepClone).toBeDefined();
    });

    it('should export ArgumentParser', () => {
      expect(index.ArgumentParser).toBeDefined();
    });

    it('should export CleanupManager', () => {
      expect(index.CleanupManager).toBeDefined();
    });
  });

  describe('Phase 6: AI Integration exports', () => {
    it('should export JqWrapper', () => {
      expect(index.JqWrapper).toBeDefined();
    });

    it('should export AI persona functions', () => {
      expect(index.getAllPersonas).toBeDefined();
      expect(index.getPersonaById).toBeDefined();
    });

    it('should export AI validation functions', () => {
      expect(index.validateResponse).toBeDefined();
      expect(index.calculateConfidenceScore).toBeDefined();
    });

    it('should export AiCache', () => {
      expect(index.AiCache).toBeDefined();
    });

    it('should export PromptBuilder', () => {
      expect(index.PromptBuilder).toBeDefined();
    });

    it('should export AiHelper', () => {
      expect(index.AiHelper).toBeDefined();
    });
  });

  describe('Phase 7: Workflow Orchestration exports', () => {
    it('should export WorkflowEngine', () => {
      expect(index.WorkflowEngine).toBeDefined();
    });

    it('should export StepRegistry', () => {
      expect(index.StepRegistry).toBeDefined();
    });

    it('should export DependencyResolver', () => {
      expect(index.DependencyResolver).toBeDefined();
    });

    it('should export StepExecutor', () => {
      expect(index.StepExecutor).toBeDefined();
    });

    it('should export ConditionalExecutor', () => {
      expect(index.ConditionalExecutor).toBeDefined();
    });

    it('should export CheckpointManager', () => {
      expect(index.CheckpointManager).toBeDefined();
    });
  });

  describe('Phase 8: Performance Optimization exports', () => {
    it('should export PerformanceTracker', () => {
      expect(index.PerformanceTracker).toBeDefined();
    });

    it('should export PerformanceMonitor', () => {
      expect(index.PerformanceMonitor).toBeDefined();
    });

    it('should export AnalysisCache', () => {
      expect(index.AnalysisCache).toBeDefined();
    });

    it('should export optimization modules', () => {
      expect(index.IncrementalAnalyzer).toBeDefined();
      expect(index.MLOptimizer).toBeDefined();
      expect(index.DocsOnlyOptimizer).toBeDefined();
      expect(index.CodeChangesOptimizer).toBeDefined();
      expect(index.FullChangesOptimizer).toBeDefined();
    });

    it('should export MultiStagePipeline', () => {
      expect(index.MultiStagePipeline).toBeDefined();
    });

    it('should export Step1 processors', () => {
      expect(index.Step1IncrementalProcessor).toBeDefined();
      expect(index.Step1ParallelProcessor).toBeDefined();
    });

    it('should export WorkflowProfileManager', () => {
      expect(index.WorkflowProfileManager).toBeDefined();
    });

    it('should export DependencyCache', () => {
      expect(index.DependencyCache).toBeDefined();
    });
  });

  describe('Phase 9: Workflow Steps exports', () => {
    it('should export Step 0 analyzer', () => {
      expect(index.Step0Analyzer).toBeDefined();
    });

    it('should export Step 1 documentation analyzer', () => {
      expect(index.Step1DocumentationAnalyzer).toBeDefined();
    });

    it('should export Step 2 consistency analyzer', () => {
      expect(index.Step2ConsistencyAnalyzer).toBeDefined();
    });

    it('should export Step 3 script analyzer', () => {
      expect(index.Step3ScriptAnalyzer).toBeDefined();
    });

    it('should export Step 4 config analyzer', () => {
      expect(index.Step4ConfigAnalyzer).toBeDefined();
    });

    it('should export Step 5 directory analyzer', () => {
      expect(index.Step5DirectoryAnalyzer).toBeDefined();
    });

    it('should export Step 6 test reviewer', () => {
      expect(index.Step6TestReviewer).toBeDefined();
    });

    it('should export Step 7 test generator', () => {
      expect(index.Step7TestGenerator).toBeDefined();
    });

    it('should export Step 8 test executor', () => {
      expect(index.Step8TestExecutor).toBeDefined();
    });

    it('should export Step 9 dependency validator', () => {
      expect(index.Step9DependencyValidator).toBeDefined();
    });

    it('should export Step 10 code quality analyzer', () => {
      expect(index.Step10CodeQualityAnalyzer).toBeDefined();
    });

    it('should export Step 11 context analyzer', () => {
      expect(index.Step11ContextAnalyzer).toBeDefined();
    });

    it('should export Step 12 git finalization', () => {
      expect(index.Step12GitFinalization).toBeDefined();
    });

    it('should export Step 13 markdown lint', () => {
      expect(index.Step13MarkdownLint).toBeDefined();
    });

    it('should export Step 14 prompt engineer', () => {
      expect(index.Step14PromptEngineer).toBeDefined();
    });

    it('should export Step 15 UX analysis', () => {
      expect(index.Step15UxAnalysis).toBeDefined();
    });

    it('should export Step 16 version update', () => {
      expect(index.Step16VersionUpdate).toBeDefined();
    });

    it('should export Step 0b bootstrap docs', () => {
      expect(index.Step0bBootstrapDocs).toBeDefined();
    });

    it('should export Step 02_5 documentation optimizer', () => {
      expect(index.DocumentationOptimizer).toBeDefined();
      expect(index.HeuristicsAnalyzer).toBeDefined();
      expect(index.GitAnalyzer).toBeDefined();
      expect(index.VersionAnalyzer).toBeDefined();
      expect(index.ConsolidationManager).toBeDefined();
      expect(index.ReportingManager).toBeDefined();
      expect(index.AiAnalyzer).toBeDefined();
    });
  });

  describe('Export validation', () => {
    it('should have no undefined exports', () => {
      const undefinedExports = [];
      for (const [key, value] of Object.entries(index)) {
        if (value === undefined) {
          undefinedExports.push(key);
        }
      }
      expect(undefinedExports).toEqual([]);
    });

    it('should export expected minimum number of items', () => {
      const exportCount = Object.keys(index).length;
      // We have 300+ exports across all phases
      expect(exportCount).toBeGreaterThan(300);
    });
  });
});
