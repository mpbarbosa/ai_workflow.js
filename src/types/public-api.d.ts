/**
 * ai_workflow.js — Public API Type Definitions
 * @version 1.0.0
 */

// ---------------------------------------------------------------------------
// Core: Colors
// ---------------------------------------------------------------------------

export interface ColorMap {
  reset: string;
  bright: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  gray: string;
  bgRed: string;
  bgGreen: string;
  bgYellow: string;
  bgBlue: string;
}

export declare const colors: ColorMap;
export declare function colorize(text: string, color: keyof ColorMap): string;
export declare function supportsColor(): boolean;

// ---------------------------------------------------------------------------
// Core: Logger
// ---------------------------------------------------------------------------

export declare enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  SUCCESS = 'success',
}

export interface LogOptions {
  level?: LogLevel;
  prefix?: string;
  timestamp?: boolean;
}

export declare class Logger {
  constructor(options?: LogOptions);
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  success(message: string, ...args: unknown[]): void;
}

export declare const logger: Logger;

// ---------------------------------------------------------------------------
// Core: Executor
// ---------------------------------------------------------------------------

export interface ExecuteOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
  silent?: boolean;
}

export interface ExecuteResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  success: boolean;
}

export declare function execute(command: string, options?: ExecuteOptions): Promise<ExecuteResult>;
export declare function executeStream(
  command: string,
  onData: (chunk: string) => void,
  options?: ExecuteOptions
): Promise<ExecuteResult>;
export declare function executeSudo(command: string, options?: ExecuteOptions): Promise<ExecuteResult>;

// ---------------------------------------------------------------------------
// Core: System
// ---------------------------------------------------------------------------

export declare enum OS {
  LINUX = 'linux',
  MACOS = 'macos',
  WINDOWS = 'windows',
  UNKNOWN = 'unknown',
}

export declare enum PackageManager {
  NPM = 'npm',
  YARN = 'yarn',
  PNPM = 'pnpm',
  PIP = 'pip',
  PIPENV = 'pipenv',
  POETRY = 'poetry',
  UNKNOWN = 'unknown',
}

export interface SystemInfo {
  os: OS;
  packageManager: PackageManager;
  nodeVersion: string;
  platform: string;
  arch: string;
}

export declare function detectOS(): OS;
export declare function detectPackageManager(cwd?: string): Promise<PackageManager>;
export declare function commandExists(command: string): Promise<boolean>;
export declare function getSystemInfo(): Promise<SystemInfo>;

// ---------------------------------------------------------------------------
// Core: Version
// ---------------------------------------------------------------------------

export interface Version {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
  build?: string;
  raw: string;
}

export declare function parseVersion(versionString: string): Version;
export declare function compareVersions(a: Version | string, b: Version | string): -1 | 0 | 1;
export declare function isGreaterThan(a: Version | string, b: Version | string): boolean;
export declare function isLessThan(a: Version | string, b: Version | string): boolean;
export declare function isEqual(a: Version | string, b: Version | string): boolean;
export declare function getLatestVersion(versions: string[]): string;

// ---------------------------------------------------------------------------
// Utils: Errors
// ---------------------------------------------------------------------------

export declare class WorkflowError extends Error {
  readonly code: string;
  readonly context?: Record<string, unknown>;
  constructor(message: string, code?: string, context?: Record<string, unknown>);
}

export declare class SystemError extends WorkflowError {
  constructor(message: string, context?: Record<string, unknown>);
}

export declare class ExecutionError extends WorkflowError {
  readonly exitCode?: number;
  constructor(message: string, exitCode?: number, context?: Record<string, unknown>);
}

export declare class ConfigurationError extends WorkflowError {
  constructor(message: string, context?: Record<string, unknown>);
}

export declare class ValidationError extends WorkflowError {
  constructor(message: string, context?: Record<string, unknown>);
}

export declare class FileSystemError extends WorkflowError {
  readonly path?: string;
  constructor(message: string, path?: string, context?: Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// Utils: Retry
// ---------------------------------------------------------------------------

export declare enum ErrorCategory {
  TRANSIENT = 'transient',
  PERMANENT = 'permanent',
  TIMEOUT = 'timeout',
  RATE_LIMIT = 'rate_limit',
}

export interface RetryOptions {
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
}

export declare function classifyRetryError(error: Error): ErrorCategory;
export declare function shouldRetryOp(error: Error, attempt: number, maxAttempts: number): boolean;
export declare function calculateRetryBackoff(attempt: number, options?: RetryOptions): number;
export declare function withRetry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T>;

// ---------------------------------------------------------------------------
// Phase 2: Config
// ---------------------------------------------------------------------------

export interface WorkflowConfig {
  project_name?: string;
  primary_language?: string;
  project_kind?: string;
  test_framework?: string;
  [key: string]: unknown;
}

export declare class Config {
  constructor(configPath?: string);
  load(): Promise<WorkflowConfig>;
  save(config: WorkflowConfig): Promise<void>;
  get<T = unknown>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  validate(): Promise<{ valid: boolean; errors: string[] }>;
}

// ---------------------------------------------------------------------------
// Phase 2: Backlog
// ---------------------------------------------------------------------------

export interface BacklogEntry {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'done' | 'skipped';
  phase?: string;
  description?: string;
}

export declare class Backlog {
  constructor(backlogDir: string);
  addEntry(entry: BacklogEntry): Promise<void>;
  updateEntry(id: string, updates: Partial<BacklogEntry>): Promise<void>;
  getEntries(): Promise<BacklogEntry[]>;
  generateSummary(): Promise<string>;
}

// ---------------------------------------------------------------------------
// Phase 2: SessionManager
// ---------------------------------------------------------------------------

export interface SessionEntry {
  id: string;
  description: string;
  startTime: number;
}

export declare class SessionManager {
  constructor();
  generateSessionId(stepNum: number, operation: string): string;
  registerSession(sessionId: string, description?: string): void;
  unregisterSession(sessionId: string): void;
  getSession(sessionId: string): SessionEntry | null;
  getActiveSessions(): string[];
  isSessionActive(sessionId: string): boolean;
  getSessionCount(): number;
}

// ---------------------------------------------------------------------------
// Phase 2: Metrics
// ---------------------------------------------------------------------------

export interface StepMetrics {
  stepNumber: number;
  startTime?: number;
  endTime?: number;
  duration?: number;
  status?: string;
}

export interface AllMetrics {
  steps: StepMetrics[];
  workflow?: { startTime: number; endTime?: number; success?: boolean };
}

export declare class Metrics {
  constructor(config: { metricsDir: string });
  initMetrics(): void;
  startStepTimer(stepNumber: number): void;
  endStepTimer(stepNumber: number, status: string): void;
  getStepDuration(stepNumber: number): number | null;
  markWorkflowComplete(success: boolean): void;
  saveCurrentMetrics(): Promise<void>;
  getAllMetrics(): AllMetrics;
}

// ---------------------------------------------------------------------------
// Phase 3: FileOperations
// ---------------------------------------------------------------------------

export interface FileMetadata {
  path: string;
  name: string;
  extension: string;
  size: number;
  modifiedAt: Date;
  isDirectory: boolean;
}

export declare function validatePath(filePath: string, allowedRoot?: string): boolean;
export declare function filterByExtension(files: string[], extensions: string[]): string[];
export declare function filterByPattern(files: string[], patterns: RegExp[]): string[];
export declare function sortByModificationTime(files: string[]): Promise<string[]>;
export declare function buildFileMetadata(filePath: string): Promise<FileMetadata>;
export declare function calculateRelativePath(from: string, to: string): string;

export declare class FileOperations {
  constructor(options?: { dryRun?: boolean });
  readFile(filePath: string): Promise<string>;
  writeFile(filePath: string, content: string): Promise<void>;
  copyFile(src: string, dest: string): Promise<void>;
  deleteFile(filePath: string): Promise<void>;
  exists(filePath: string): Promise<boolean>;
  listFiles(dir: string, options?: { recursive?: boolean; extensions?: string[] }): Promise<string[]>;
}

// ---------------------------------------------------------------------------
// Phase 3: EditOperations
// ---------------------------------------------------------------------------

export declare function findMatches(content: string, pattern: string | RegExp): RegExpMatchArray[];
export declare function replaceAll(content: string, pattern: string | RegExp, replacement: string): string;
export declare function replaceFirst(content: string, pattern: string | RegExp, replacement: string): string;
export declare function insertAtLine(content: string, lineNumber: number, text: string): string;
export declare function appendText(content: string, text: string): string;
export declare function prependText(content: string, text: string): string;
export declare function deleteLines(content: string, start: number, end: number): string;
export declare function extractLines(content: string, start: number, end: number): string;
export declare function generateDiff(original: string, modified: string): string;
export declare function formatDiff(diff: string): string;

export declare class EditOperations {
  constructor(options?: { dryRun?: boolean });
  editFile(filePath: string, fn: (content: string) => string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Phase 3: ArgumentParser
// ---------------------------------------------------------------------------

export interface ArgSchema {
  [key: string]: {
    type: 'string' | 'boolean' | 'number' | 'array';
    alias?: string;
    default?: unknown;
    required?: boolean;
    description?: string;
  };
}

export declare function parseArguments(argv: string[], schema?: ArgSchema): Record<string, unknown>;
export declare function validateArguments(args: Record<string, unknown>, schema: ArgSchema): { valid: boolean; errors: string[] };
export declare function generateHelpText(schema: ArgSchema, command?: string): string;

export declare class ArgumentParser {
  constructor(schema: ArgSchema);
  parse(argv: string[]): Record<string, unknown>;
  validate(args: Record<string, unknown>): { valid: boolean; errors: string[] };
  help(command?: string): string;
}

// ---------------------------------------------------------------------------
// Phase 3: CleanupManager
// ---------------------------------------------------------------------------

export declare function shouldCleanByAge(filePath: string, maxAgeMs: number, currentTime?: number): Promise<boolean>;
export declare function filterByAge(files: string[], maxAgeMs: number): Promise<string[]>;
export declare function calculateTotalSize(files: string[]): Promise<number>;
export declare function formatSize(bytes: number): string;

export declare class CleanupManager {
  constructor(config?: { maxAge?: number; maxSize?: number });
  cleanDirectory(dir: string, options?: { dryRun?: boolean }): Promise<{ removed: string[]; freed: number }>;
}

// ---------------------------------------------------------------------------
// Phase 5: GitAutomation
// ---------------------------------------------------------------------------

export interface GitStatus {
  staged: Array<{ file: string; status: string }>;
  unstaged: Array<{ file: string; status: string }>;
  untracked: Array<{ file: string; status: string }>;
}

export interface GitDiff {
  files: Array<{ path: string; additions: number; deletions: number }>;
  insertions: number;
  deletions: number;
}

export declare function parseGitStatus(output: string): GitStatus;

export declare class GitAutomation {
  constructor(repoPath?: string);
  status(): Promise<GitStatus>;
  diff(options?: { staged?: boolean }): Promise<string>;
  add(files: string[]): Promise<void>;
  commit(message: string): Promise<void>;
  log(options?: { maxCount?: number }): Promise<Array<{ hash: string; message: string; date: string }>>;
}

// ---------------------------------------------------------------------------
// Phase 5: ChangeDetection
// ---------------------------------------------------------------------------

export interface FileChange {
  file: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
}

export interface ChangeCategories {
  code: FileChange[];
  test: FileChange[];
  docs: FileChange[];
  config: FileChange[];
  asset: FileChange[];
  unknown: FileChange[];
}

export interface AnalyzeChangesResult {
  categories: ChangeCategories;
  impact: string;
  summary: string;
}

export declare function analyzeChanges(files: FileChange[]): AnalyzeChangesResult;
export declare function calculateChangeImpact(categories: ChangeCategories): string;

// ---------------------------------------------------------------------------
// Phase 6: AI Integration
// ---------------------------------------------------------------------------

export interface AiPersona {
  id: string;
  name: string;
  task: string;
  expertise: string[];
  systemPrompt: string;
}

export declare function getAllPersonas(): AiPersona[];
export declare function getPersonaById(id: string): AiPersona | undefined;
export declare function getPersonasByTask(task: string): AiPersona[];
export declare function validatePersona(persona: unknown): boolean;

export interface AiValidationResult {
  valid: boolean;
  confidence: number;
  issues: string[];
}

export declare function validateAIResponse(response: string, schema?: object): AiValidationResult;
export declare function calculateConfidenceScore(response: string): number;

export declare class AiCache {
  constructor(config?: { ttl?: number; maxSize?: number; cacheDir?: string });
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  invalidate(key: string): Promise<void>;
  clear(): Promise<void>;
}

export interface PromptOptions {
  maxTokens?: number;
  includeContext?: boolean;
}

export declare function buildPromptFromTemplate(template: string, variables: Record<string, string>): string;
export declare function buildDocAnalysisPrompt(files: string[], context?: string): string;
export declare function buildTestGenPrompt(sourceFile: string, existingTests?: string): string;

export declare class PromptBuilder {
  constructor(options?: PromptOptions);
  build(template: string, variables: Record<string, string>): string;
}

export declare class AiHelper {
  constructor(options?: { retries?: number; timeout?: number });
  request(prompt: string, options?: { persona?: string }): Promise<string>;
}

export declare function parseAiResponse(response: string): { content: string; metadata?: object };
export declare function shouldRetry(error: Error, attempt: number): boolean;
export declare function defineTool(name: string, description: string, inputSchema: object): object;

// ---------------------------------------------------------------------------
// Phase 7: WorkflowEngine
// ---------------------------------------------------------------------------

export interface WorkflowConfig {
  steps: StepDefinition[];
  dryRun?: boolean;
  parallel?: boolean;
  checkpointDir?: string;
  verbose?: boolean;
  streamingEnabled?: boolean;
}

export interface ExecutionContext {
  step: StepDefinition;
  global: Record<string, unknown>;
  results: Record<string, StepResult>;
  metadata: { stepId: string; stepName: string; phase: string };
}

export interface StepResult {
  success: boolean;
  dryRun?: boolean;
  output?: string;
  error?: string;
  contextUpdate?: Record<string, unknown>;
  duration?: number;
}

export declare function validateWorkflowConfig(config: unknown): { valid: boolean; errors: string[] };
export declare function buildExecutionPlan(steps: StepDefinition[], options?: object): StepDefinition[];
export declare function createExecutionContext(
  step: StepDefinition,
  globalContext: Record<string, unknown>,
  previousResults: Record<string, StepResult>
): ExecutionContext;
export declare function mergeStepResults(
  current: Record<string, StepResult>,
  newResult: StepResult,
  stepId: string
): Record<string, StepResult>;
export declare function calculateWorkflowProgress(results: Record<string, StepResult>): number;

export declare class WorkflowEngine {
  constructor(config: WorkflowConfig);
  run(): Promise<Record<string, StepResult>>;
  pause(): void;
  resume(): void;
}

// ---------------------------------------------------------------------------
// Phase 7: StepRegistry
// ---------------------------------------------------------------------------

export interface StepDefinition {
  id: string;
  name: string;
  phase: string;
  dependencies?: string[];
  tags?: string[];
  enabled?: boolean;
  timeout?: number;
  retries?: number;
  conditions?: object[];
  execute: (context: ExecutionContext) => Promise<StepResult>;
}

export declare function createStepDefinition(def: Omit<StepDefinition, 'execute'> & { execute: StepDefinition['execute'] }): StepDefinition;
export declare function validateStepMetadata(step: unknown): { valid: boolean; errors: string[] };
export declare function sortStepsById(steps: StepDefinition[]): StepDefinition[];

export declare class StepRegistry {
  constructor();
  register(step: StepDefinition): void;
  get(id: string): StepDefinition | undefined;
  getAll(): StepDefinition[];
  findByPhase(phase: string): StepDefinition[];
  findByTags(tags: string[]): StepDefinition[];
}

// ---------------------------------------------------------------------------
// Phase 7: DependencyResolver
// ---------------------------------------------------------------------------

export interface DependencyGraph {
  nodes: Map<string, StepDefinition>;
  edges: Map<string, Set<string>>;
  inDegree: Map<string, number>;
}

export interface CircularDependencyResult {
  hasCycle: boolean;
  cycle: string[] | null;
}

export declare function buildDependencyGraph(steps: StepDefinition[]): DependencyGraph;
export declare function topologicalSort(graph: DependencyGraph): string[];
export declare function detectCircularDependencies(graph: DependencyGraph): CircularDependencyResult;
export declare function canRunInParallel(stepA: StepDefinition, stepB: StepDefinition, graph: DependencyGraph): boolean;
export declare function calculateCriticalPath(graph: DependencyGraph): string[];
export declare function validateDependencies(steps: StepDefinition[]): { valid: boolean; errors: string[] };

export declare class DependencyResolver {
  constructor();
  resolve(steps: StepDefinition[]): StepDefinition[][];
  getCriticalPath(steps: StepDefinition[]): string[];
}

// ---------------------------------------------------------------------------
// Phase 7: StepExecutor
// ---------------------------------------------------------------------------

export declare function validateStepInput(step: StepDefinition, context: ExecutionContext): { valid: boolean; errors: string[] };
export declare function calculateTimeout(step: StepDefinition, options?: object): number;
export declare function shouldRetryStep(step: StepDefinition, error: Error, attempt: number): boolean;
export declare function formatStepResult(result: StepResult, step: StepDefinition): StepResult;

export declare class StepExecutor {
  constructor(options?: { defaultTimeout?: number });
  execute(step: StepDefinition, context: ExecutionContext): Promise<StepResult>;
}

// ---------------------------------------------------------------------------
// Phase 7: ConditionalExecutor
// ---------------------------------------------------------------------------

export interface SkipResult {
  shouldSkip: boolean;
  reason: string;
}

export interface StepCondition {
  type: 'impact' | 'filePattern' | 'phase' | 'projectKind';
  [key: string]: unknown;
}

export declare function shouldSkipStep(
  step: StepDefinition,
  changes: { files: FileChange[] },
  impact: string
): SkipResult;
export declare function evaluateCondition(condition: boolean | StepCondition | ((ctx: ExecutionContext) => boolean), context: ExecutionContext): boolean;
export declare function calculateChangeImpact(categories: ChangeCategories): string;

export declare class ConditionalExecutor {
  constructor();
  shouldExecute(step: StepDefinition, context: ExecutionContext): SkipResult;
}

// ---------------------------------------------------------------------------
// Phase 7: CheckpointManager
// ---------------------------------------------------------------------------

export interface CheckpointState {
  currentStep: string;
  completedSteps: string[];
  failedSteps: string[];
  skippedSteps: string[];
  results: Record<string, StepResult>;
  context: Record<string, unknown>;
}

export interface CheckpointData {
  workflowId: string;
  timestamp: number;
  state: CheckpointState;
  metadata: { totalSteps: number; progress: number };
}

export declare function createCheckpointData(workflowId: string, state: CheckpointState): CheckpointData;
export declare function validateCheckpoint(data: unknown): { valid: boolean; errors: string[] };
export declare function mergeCheckpointState(current: CheckpointState, saved: Partial<CheckpointState>): CheckpointState;
export declare function generateCheckpointId(workflowId: string, timestamp?: number): string;
export declare function parseCheckpointId(id: string): { workflowId: string; timestamp: number };
export declare function sortCheckpointsByTime(checkpoints: CheckpointData[]): CheckpointData[];

export declare class CheckpointManager {
  constructor(checkpointDir: string);
  save(data: CheckpointData): Promise<void>;
  load(checkpointId: string): Promise<CheckpointData | null>;
  list(): Promise<CheckpointData[]>;
  delete(checkpointId: string): Promise<void>;
  cleanup(maxAge?: number): Promise<number>;
}
