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
export {
  ErrorCategory,
  classifyError as classifyRetryError,
  shouldRetry as shouldRetryOp,
  calculateDelay as calculateRetryBackoff,
  withRetry,
} from './utils/retry.js';

// Utility functions (via olinda_shell_interface.js v0.5.10 / olinda_utils.js v0.3.14)
export {
  camelCase,
  kebabCase,
  snakeCase,
  pascalCase,
  capitalize,
  truncate,
  sanitize,
  cleanWhitespace,
  escapeRegex,
  dedupe,
  chunk,
  flatten,
  groupBy,
  sortBy,
  intersection,
  difference,
  partition,
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

// Phase 2.1 exports (v2.0.0)
export { Config } from './lib/config.js';
export { Backlog } from './lib/backlog.js';
export { SessionManager } from './lib/session_manager.js';
export { Metrics } from './lib/metrics.js';

// Phase 5 extension exports (v2.0.0)
export {
  CommitHistory,
  readCommitHistory,
  createEmptyHistory,
  getLastRunCommit,
  createRunEntry,
  appendRunEntry,
  capHistory,
  serializeHistory,
  isValidCommitHash,
  COMMIT_HISTORY_VERSION,
  DEFAULT_MAX_RUNS,
  COMMIT_HISTORY_FILENAME,
} from './lib/commit_history.js';

// Log Parser exports (v2.0.0)
export {
  SEVERITY as LOG_SEVERITY,
  CATEGORY as LOG_CATEGORY,
  parseLogLine,
  extractIssues,
  discoverLogFiles,
  suggestFix,
  filterBySeverity,
  sortIssuesByPriority,
  validateFileReferences as validateLogFileReferences,
  generateFixPlan,
  formatFixPlanMarkdown,
} from './lib/log_parser.js';

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
// Git Submodules (v2.0.0) - Phase 5 Git Integration
export {
  GitSubmodules,
  SUBMODULE_STATUS,
  SUBMODULE_COMMANDS,
  parseSubmoduleStatus,
  parseSubmoduleConfig,
  hasSubmodules,
  isSubmoduleInitialized,
  isSubmoduleModified,
  hasSubmoduleMergeConflict,
  getSubmodulesByStatus,
  categorizeSubmodules,
  buildSubmoduleCommand,
  validateSubmodulePath,
  formatSubmoduleSummary,
} from './lib/git_submodules.js';

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
  resolveRoleRef,
  resolveAllRoleRefs,
  loadResolvedAiHelpers,
  AI_HELPERS_PATH,
  PROMPT_ROLES_PATH,
} from './lib/ai_prompt_builder.js';

export {
  parseAiResponse,
  parseErrorResponse,
  formatBatchRequests,
  calculateRetryDelay,
  shouldRetry,
  mergeRequestOptions,
  AiHelper,
  defineTool,
} from './lib/ai_helpers.js';

export {
  buildSmokeTestPrompt,
  validateSmokeTestResponse,
  formatSmokeTestResult,
  runSdkSmokeTest,
} from './lib/sdk_smoke_test.js';

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
// Phase 9: Workflow Steps Implementation (17 steps) ✅ COMPLETE
// Status: 17/17 steps complete (100%)
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

// Step 4: Configuration Validation
export {
  Step4ConfigAnalyzer,
  CONFIG_PATTERNS,
  SECRET_PATTERNS,
  CONFIG_ISSUE_TYPE,
  isConfigFile,
  getConfigType,
  validateJsonSyntax,
  validateYamlSyntax,
  validateConfigSyntax,
  scanForSecrets,
  checkConfigBestPractices,
  formatConfigReport,
} from './steps/step_04_config_validation.js';

// Step 5: Directory Structure Validation
export {
  Step5DirectoryAnalyzer,
  DIR_CATEGORIES,
  CATEGORY_PATTERNS,
  CATEGORY_DIRS,
  ROOT_ALLOWED_FILES,
  EXCLUDED_DIRS,
  shouldStayInRoot,
  categorizeMisplacedDoc,
  getTargetDir,
  shouldIncludeDir,
  extractCriticalDirs,
  getDefaultCriticalDirs,
  isDirectoryDocumented,
  validateDirectoryStructure,
  formatDirectoryReport,
} from './steps/step_05_directory.js';

// Step 6: Test Review
export {
  Step6TestReviewer,
  TEST_PATTERNS,
  COVERAGE_PATHS,
  getTestPatterns,
  getCoveragePaths,
  isTestFile,
  categorizeTestFiles,
  parseCoveragePercentage,
  getCoverageStatus,
  calculateTestStatistics,
  formatTestReport,
} from './steps/step_06_test_review.js';

// Step 7: Test Generation
export {
  Step7TestGenerator,
  SOURCE_PATTERNS,
  TEST_FILE_PATTERNS,
  EXCLUDE_FILES,
  EXCLUDE_DIRS,
  getSourcePatterns,
  getTestPatterns as getTestFilePatterns,
  shouldExcludeFile,
  hasCorrespondingTest,
  findUntestedFiles,
  calculateCoverage,
  categorizeUntestedFiles,
  formatTestGenerationReport,
} from './steps/step_07_test_gen.js';

// Step 8: Test Execution
export {
  Step8TestExecutor,
  TEST_COMMANDS,
  COVERAGE_FILES,
  TEST_RESULT_PATTERNS,
  getTestCommand,
  getCoverageFiles,
  hasTestScript,
  extractTestCommand,
  parseJestOutput,
  parsePytestOutput,
  parseTestOutput,
  parseJestCoverage,
  determineTestStatus,
  formatTestReport as formatTestExecutionReport,
} from './steps/step_08_test_exec.js';

// Step 9: Dependency Validation
export {
  Step9DependencyValidator,
  DEPENDENCY_FILES,
  AUDIT_COMMANDS,
  OUTDATED_COMMANDS,
  SEVERITY,
  getDependencyFiles,
  getAuditCommand,
  getOutdatedCommand,
  supportsDependencyValidation,
  parsePackageJson,
  parseNpmAudit,
  parseNpmOutdated,
  determineSeverity,
  formatDependencyReport,
} from './steps/step_09_dependencies.js';

// Step 10: Code Quality Analysis
export {
  Step10CodeQualityAnalyzer,
  LINTER_COMMANDS,
  SOURCE_EXTENSIONS,
  QUALITY_THRESHOLDS,
  getLinterCommand,
  getSourceExtensions,
  isSourceFile,
  extractLinterCommand,
  parseEslintOutput,
  parseFlake8Output,
  parseLinterOutput,
  calculateIssueRate,
  determineQualityRating,
  formatQualityReport,
} from './steps/step_10_code_quality.js';

// Step 11: Context Analysis
export {
  Step11ContextAnalyzer,
  IMPACT_THRESHOLDS,
  COMPLETION_THRESHOLDS,
  calculateCompletionRate,
  determineCompletionStatus,
  calculateImpactScore,
  determineImpactLevel,
  aggregateIssues,
  calculateDuration,
  formatDuration as formatContextDuration,
  formatContextReport,
} from './steps/step_11_context.js';

// Step 12: Git Finalization
export {
  Step12GitFinalization,
  COMMIT_TYPES,
  CHANGE_CATEGORIES,
  GIT_OPERATIONS,
  parseGitStatus,
  categorizeFiles,
  inferCommitType,
  calculateImpactScore as calculateGitImpactScore,
  generateCommitMessage,
  parseDiffSummary,
  parseCommitCounts,
  formatGitReport,
} from './steps/step_12_git_finalization.js';

// Step 13: Markdown Linting
export {
  Step13MarkdownLint,
  MARKDOWN_PATTERNS,
  ANTI_PATTERNS,
  LINTER_COMMANDS as MARKDOWN_LINTER_COMMANDS,
  SEVERITY_LEVELS,
  filterMarkdownFiles,
  shouldExcludePath,
  parseMdlOutput,
  groupIssuesByFile,
  groupIssuesByRule,
  calculateLintStats,
  checkMissingSpaceAfterHash,
  checkMalformedBold,
  checkTrailingWhitespace,
  checkMultipleBlankLines,
  detectAntiPatterns,
  formatLintReport,
  determineLintStatus,
} from './steps/step_13_markdown_lint.js';

// Step 14: Prompt Engineer Analysis
export {
  Step14PromptEngineer,
  PROJECT_TYPES,
  PROMPT_QUALITY_CRITERIA,
  QUALITY_THRESHOLDS as PROMPT_QUALITY_THRESHOLDS,
  shouldRunPromptAnalysis,
  extractPersonaNames,
  extractPromptContent,
  calculatePromptQuality,
  determineQualityRating as determinePromptQualityRating,
  identifyImprovements,
  calculateAggregateStats,
  formatAnalysisReport,
} from './steps/step_14_prompt_engineer.js';

// Step 15: UX Analysis
export {
  Step15UxAnalysis,
  UI_PROJECT_TYPES,
  UI_FILE_PATTERNS,
  UX_CATEGORIES,
  SEVERITY_LEVELS as UX_SEVERITY_LEVELS,
  shouldRunUxAnalysis,
  shouldExcludeFile as shouldExcludeUxFile,
  isUiFile,
  categorizeUiFile,
  filterUiFiles,
  groupUiFilesByType,
  buildUxAnalysisPrompt,
  calculateSeverityScore,
  parseUxAnalysisResult,
  formatUxAnalysisReport,
} from './steps/step_15_ux_analysis.js';

// Step 16: Version Update
export {
  Step16VersionUpdate,
  SEMVER_PATTERN,
  VERSION_PATTERN_REGEX,
  BUMP_TYPES,
  METADATA_FILES,
  HEURISTIC_THRESHOLDS,
  extractVersion,
  parseVersion as parseSemanticVersion,
  incrementVersion,
  detectVersionPatterns,
  replaceVersion,
  determineHeuristicBumpType,
  parseAiBumpRecommendation,
  buildVersionBumpPrompt,
  calculateUpdateStats,
  formatVersionUpdateReport,
} from './steps/step_16_version_update.js';

// Step 0b: Bootstrap Documentation
export {
  Step0bBootstrapDocs,
  DOC_TYPES,
  DOC_THRESHOLDS,
  SOURCE_EXTENSIONS as DOC_SOURCE_EXTENSIONS,
  shouldBootstrapDocs,
  identifyMissingDocs,
  categorizeMissingDocs,
  filterSourceFiles,
  countFilesByExtension,
  determinePrimaryLanguage,
  buildTechnicalWriterPrompt as buildBootstrapDocPrompt,
  formatGapAnalysisReport,
} from './steps/step_0b_bootstrap_docs.js';

// Step 02_5: Documentation Optimization
// Main orchestrator
export {
  DocumentationOptimizer,
  DEFAULT_CONFIG as DOC_OPTIMIZE_DEFAULT_CONFIG,
  PHASES as DOC_OPTIMIZE_PHASES,
  mergeConfig as mergeDocOptimizeConfig,
  validateConfig as validateDocOptimizeConfig,
  createInitialState as createDocOptimizeState,
  updateState as updateDocOptimizeState,
  aggregateResults as aggregateDocOptimizeResults,
  calculateExecutionTime as calculateDocOptimizeExecutionTime,
} from './steps/step_02_5_doc_optimize.js';

// Step 02_5 submodules
export {
  HeuristicsAnalyzer,
  SIMILARITY_THRESHOLDS,
  calculateFileHash as calculateDocFileHash,
  findExactDuplicates,
  levenshteinDistance,
  extractDocumentTitle,
  normalizeTitle,
  calculateTitleSimilarity,
  extractSignificantWords,
  calculateJaccardSimilarity,
  calculateContentSimilarity,
  calculateSizeSimilarity,
  calculateCombinedSimilarity,
  findRedundantPairs,
} from './steps/step_02_5_lib/heuristics.js';

export {
  GitAnalyzer,
  GIT_THRESHOLDS,
  parseGitLog as parseGitLogForDocs,
  extractLastModified,
  countRecentCommits,
  calculateAgeMonths,
  isRecentlyModified,
  determineStalenessLevel,
  calculateStalenessScore,
  countFileReferences,
  findReferencingFiles,
} from './steps/step_02_5_lib/git_analysis.js';

export {
  VersionAnalyzer,
  VERSION_THRESHOLDS,
  extractVersionReferences,
  parseVersion as parseDocVersion,
  compareVersions as compareDocVersions,
  calculateVersionGap,
  isVersionOutdated,
  calculateVersionStaleness,
  findOldestVersion,
  findNewestVersion,
} from './steps/step_02_5_lib/version_analysis.js';

export {
  ConsolidationManager,
  ARCHIVE_STRUCTURE,
  selectKeepFile,
  buildConsolidationPlan,
  generateArchivePath,
  generateArchiveDirectories,
  calculateConsolidationStats,
  formatConsolidationAction,
} from './steps/step_02_5_lib/consolidation.js';

export {
  ReportingManager,
  REPORT_SECTIONS,
  DEFAULT_RECOMMENDATIONS as DOC_OPTIMIZE_RECOMMENDATIONS,
  calculateTotalSize as calculateDocTotalSize,
  calculateSizeSavings,
  estimateTokenSavings,
  calculateOptimizationMetrics,
  formatTimestamp as formatDocTimestamp,
  formatFileList,
  formatRedundantPairs,
  formatSummarySection,
  formatActionsSection,
  formatRecommendationsSection,
  formatArchiveSection,
  generateOptimizationReport,
  formatConsoleSummary as formatDocConsoleSummary,
} from './steps/step_02_5_lib/reporting.js';

export {
  AiAnalyzer,
  CONFIDENCE_THRESHOLDS as AI_CONFIDENCE_THRESHOLDS,
  ANALYSIS_RESULT,
  isEdgeCase,
  filterEdgeCases,
  countEdgeCases,
  buildRedundancyPrompt,
  parseAiResponse as parseAiRedundancyResponse,
  calculateConfidenceBoost,
  applyAiAnalysis,
  generateAnalysisSummary as generateAiAnalysisSummary,
} from './steps/step_02_5_lib/ai_analyzer.js';
