/**
 * AI Workflow Automation - Core Module
 * @version 1.0.0
 * @description Entry point for the core functionality and public API
 * @module index
 * Part of: AI Workflow Automation v1.0.0
 */

export { colors, colorize, supportsColor } from './core/colors.js';
export { Logger, logger, LogLevel } from './core/logger.js';
export { execute, executeStream, executeSudo } from './core/executor.js';
export {
  OS,
  PackageManager,
  detectOS,
  detectPackageManager,
  commandExists,
  getSystemInfo,
} from './core/system.js';
export {
  parseVersion,
  compareVersions,
  isGreaterThan,
  isLessThan,
  isEqual,
  getLatestVersion,
} from './core/version.js';
export {
  WorkflowError,
  SystemError,
  ExecutionError,
  ConfigurationError,
  ValidationError,
  FileSystemError,
} from './utils/errors.js';

// Phase 2.1 exports (v2.0.0)
export { Config } from './lib/config.js';
export { Backlog } from './lib/backlog.js';
export { SessionManager } from './lib/session_manager.js';
export { Metrics } from './lib/metrics.js';

// Phase 8 exports (v2.0.0)
export { PerformanceTracker } from './lib/performance.js';
export {
  DEFAULT_THRESHOLDS,
  ALERT_SEVERITY,
  PerformanceMonitor,
} from './lib/performance_monitoring.js';
export { DEFAULT_CACHE_CONFIG, INVALIDATION_REASONS, AnalysisCache } from './lib/analysis_cache.js';
export {
  IncrementalAnalyzer,
  DEFAULT_CONFIG as INCREMENTAL_CONFIG,
  CHANGE_TYPES,
  calculateFileHash,
  detectFileChanges,
  calculateChangeStats,
} from './lib/incremental_analysis.js';
export {
  MLOptimizer,
  DEFAULT_CONFIG as ML_CONFIG,
  PREDICTION,
  SKIP_REASON,
  predictSkippability,
  calculateAccuracy,
} from './lib/ml_optimization.js';
export {
  DocsOnlyOptimizer,
  DOCS_PATTERNS,
  ALWAYS_RUN_STEPS,
  SKIPPABLE_STEPS,
  isDocsFile,
  isDocsOnlyChange,
  filterDocsOnlySteps,
} from './lib/docs_only_optimization.js';
export {
  CodeChangesOptimizer,
  CODE_PATTERNS,
  ALWAYS_RUN_STEPS as CODE_ALWAYS_RUN_STEPS,
  CONDITIONAL_STEPS,
  isCodeFile,
  categorizeCodeFile,
  analyzeCodePatterns,
  filterStepsForCode,
} from './lib/code_changes_optimization.js';
export {
  FullChangesOptimizer,
  OPTIMIZATION_STRATEGIES,
  CONFIDENCE_THRESHOLDS,
  STRATEGY_PRIORITIES,
  analyzeOptimizationCandidates,
  selectOptimizationStrategy,
  determineOptimizedSteps,
} from './lib/full_changes_optimization.js';
export {
  MultiStagePipeline,
  PIPELINE_STAGES,
  STAGE_DEFINITIONS,
  TIME_BUDGETS,
  groupStepsByStage,
  selectStagesByTime,
  selectStagesByChanges,
  buildStagePlan,
} from './lib/multi_stage_pipeline.js';
export {
  Step1IncrementalProcessor,
  DEFAULT_CONFIG as STEP1_CONFIG,
  DOC_CATEGORIES,
  VALIDATION_PRIORITY,
  calculateContentHash,
  categorizeDocFile,
  getValidationPriority,
  detectDocumentationChanges,
  filterByPriority,
  sortByPriority,
} from './lib/step1_incremental.js';
export {
  Step1ParallelProcessor,
  EXECUTION_STRATEGY,
  TASK_STATUS,
  createValidationTask,
  createValidationTasks,
  sortTasksByPriority,
  determineExecutionStrategy,
  splitIntoBatches,
  mergeValidationResults,
} from './lib/step1_parallel.js';

// Phase 3 exports (v2.0.0)
export {
  validatePath,
  filterByExtension,
  filterByPattern,
  sortByModificationTime,
  buildFileMetadata,
  calculateRelativePath,
  FileOperations,
} from './lib/file_operations.js';

export {
  findMatches,
  replaceAll,
  replaceFirst,
  insertAtLine,
  appendText,
  prependText,
  deleteLines,
  extractLines,
  getLineRange,
  replaceLineRange,
  generateDiff,
  formatDiff,
  EditOperations,
} from './lib/edit_operations.js';

export {
  // String utilities
  camelCase,
  kebabCase,
  snakeCase,
  pascalCase,
  capitalize,
  truncate,
  sanitize,
  cleanWhitespace,
  escapeRegex,
  // Array utilities
  dedupe,
  chunk,
  flatten,
  groupBy,
  sortBy,
  intersection,
  difference,
  partition,
  // Object utilities
  deepClone,
  deepMerge,
  pick,
  omit,
  getProperty,
  setProperty,
  hasProperty,
  deepEqual,
  isEmpty,
} from './lib/utils.js';

export {
  parseArguments,
  validateArguments,
  validateType,
  coerceTypes,
  applyDefaults,
  generateHelpText,
  normalizeAliases,
  ArgumentParser,
} from './lib/argument_parser.js';

export {
  shouldCleanByAge,
  shouldCleanBySize,
  filterByAge,
  filterBySize,
  calculateTotalSize,
  sortByOldest,
  sortByLargest,
  selectFilesForSizeLimit,
  formatDuration,
  formatSize,
  generateCleanupSummary,
  CleanupManager,
} from './lib/cleanup_handlers.js';

// Phase 6 exports (v2.0.0) - AI Integration
export {
  validateJson,
  sanitizeArgjsonValue,
  parseJqArguments,
  validateArgjsonPairs,
  buildJqCommand,
  JqWrapper,
} from './lib/jq_wrapper.js';

export {
  getAllPersonas,
  getPersonaById,
  getPersonaByName,
  getPersonasByTask,
  getPersonasByExpertise,
  validatePersona,
  getPersonaCount,
  getPersonaIds,
  personaExists,
} from './lib/ai_personas.js';

export {
  validateResponse,
  validateJsonSchema,
  calculateConfidenceScore,
  getConfidenceLevel,
  meetsConfidenceThreshold,
  analyzeContentQuality,
  countSections,
  determineFallbackAction,
  generateRetryStrategy,
  validateAIResponse,
} from './lib/ai_validation.js';

export {
  generateCacheKey,
  isCacheValid,
  shouldInvalidateCache,
  calculateCacheStats,
  filterEntriesByAge,
  createCacheEntry,
  mergeCacheMetrics,
  validateCacheConfig,
  AiCache,
} from './lib/ai_cache.js';

export {
  buildPromptFromTemplate,
  injectProjectContext,
  formatCodeBlock,
  buildFileListContext,
  truncateContext,
  buildStructuredPrompt,
  buildDocAnalysisPrompt,
  buildConsistencyPrompt,
  buildTestReviewPrompt,
  buildTestGenPrompt,
  buildCodeQualityPrompt,
  buildTechnicalWriterPrompt,
  PromptBuilder,
} from './lib/ai_prompt_builder.js';

export {
  parseAiResponse,
  parseErrorResponse,
  formatBatchRequests,
  calculateRetryDelay,
  shouldRetry,
  mergeRequestOptions,
  AiHelper,
} from './lib/ai_helpers.js';

export {
  validateWorkflowConfig,
  buildExecutionPlan,
  shouldExecuteStep,
  mergeStepResults,
  calculateWorkflowProgress,
  validateStepDefinition,
  createExecutionContext,
  WorkflowEngine,
} from './orchestrator/workflow_engine.js';

export {
  createStepDefinition,
  validateStepMetadata,
  matchStepRequirements,
  groupStepsByPhase,
  filterStepsByTags,
  filterStepsByEnabled,
  findStepsByPhase,
  sortStepsById,
  validateStepDependencies,
  StepRegistry,
} from './orchestrator/step_registry.js';

export {
  buildDependencyGraph,
  topologicalSort,
  detectCircularDependencies,
  groupParallelSteps,
  validateDependencies,
  canRunInParallel,
  calculateCriticalPath,
  DependencyResolver,
} from './orchestrator/dependency_resolver.js';

export {
  validateStepInput,
  validateStepOutput,
  calculateTimeout,
  shouldRetryStep,
  formatStepResult,
  isTimedOut,
  buildErrorMessage,
  StepExecutor,
} from './orchestrator/step_executor.js';

export {
  shouldSkipStep,
  adaptStepToProjectKind,
  calculateChangeImpact,
  evaluateCondition,
  buildSkipReason,
  matchesPattern,
  filterFilesByPattern,
  doesChangeAffectStep,
  calculateStepPriority,
  ConditionalExecutor,
} from './orchestrator/conditional_executor.js';

export {
  CheckpointManager,
  createCheckpointData,
  validateCheckpoint,
  mergeCheckpointState,
  calculateCheckpointAge,
  shouldCleanupCheckpoint,
  generateCheckpointId,
  parseCheckpointId,
  filterCheckpointsByWorkflow,
  sortCheckpointsByTime,
} from './orchestrator/checkpoint_manager.js';

// Phase 8: Performance Optimization (v2.0.0) - COMPLETE ✅
export {
  WorkflowProfileManager,
  WORKFLOW_PROFILES,
  PROFILE_PATTERNS,
  matchesPattern as matchesWorkflowPattern,
  categorizeChanges,
  selectProfile,
  getProfile as getWorkflowProfile,
  getSkipSteps as getWorkflowSkipSteps,
  getFocusSteps as getWorkflowFocusSteps,
  calculateSavings as calculateWorkflowSavings,
  isValidProfile as isValidWorkflowProfile,
  getAllProfiles as getAllWorkflowProfiles,
  formatProfileInfo,
} from './lib/workflow_profiles.js';

export {
  DependencyCache,
  DEPENDENCY_CACHE_CONFIG,
  CACHE_TYPE as DEPENDENCY_CACHE_TYPE,
  generateCacheKey as generateDependencyCacheKey,
  isCacheValid as isDependencyCacheValid,
  calculateCacheAge as calculateDependencyCacheAge,
  formatCacheAge as formatDependencyCacheAge,
  calculateCacheStats as calculateDependencyCacheStats,
  filterExpiredEntries as filterExpiredDependencyCacheEntries,
  createCacheEntry as createDependencyCacheEntry,
  createCacheIndex as createDependencyCacheIndex,
  isValidCacheType as isValidDependencyCacheType,
  getCacheFilePaths as getDependencyCacheFilePaths,
} from './lib/dependency_cache.js';

// ============================================================================
// Phase 9: Workflow Steps Implementation (20 steps) 🚧 IN PROGRESS
// Status: 4/20 steps complete (20%)
// ============================================================================

// Step 0: Pre-Analysis
export {
  Step0Analyzer,
  CHANGE_SCOPE,
  FILE_CATEGORY,
  classifyFile,
  classifyFiles,
  determineChangeScope,
  formatAnalysisSummary,
  createBacklogContent,
} from './steps/step_00_analyze.js';

// Step 1: Documentation Validation
export {
  Step1DocumentationAnalyzer,
  validateDocumentationCounts,
  checkVersionReferences,
  classifyChangedFiles,
  shouldRunAiAnalysis,
} from './steps/step_01_documentation.js';

// Step 2: Consistency Analysis
export {
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
} from './steps/step_02_consistency.js';

// Step 3: Script Reference Validation
export {
  Step3ScriptAnalyzer,
  getScriptPatterns,
  getScriptDirectories,
  extractScriptReferences,
  validateScriptReferences,
  validateShebang,
  isScriptDocumented,
  formatScriptReport,
  SCRIPT_ISSUE_TYPE,
} from './steps/step_03_script_refs.js';
