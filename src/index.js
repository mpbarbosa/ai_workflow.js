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
export { ConfigManager } from './lib/config.js';
export { BacklogManager } from './lib/backlog.js';
export { SessionManager } from './lib/session_manager.js';
export { MetricsCollector } from './lib/metrics.js';

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
