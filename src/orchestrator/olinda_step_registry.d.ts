/**
 * Vendored from `olinda_orchestrator/src/step_registry.ts` v0.4.1.
 *
 * The upstream module now imports helper functions from
 * `generic_step_registry.ts`. This repository keeps those helpers inlined here
 * because `tsconfig.json` compiles this file directly with `allowJs=false`,
 * while the local legacy `generic_step_registry.js` still serves the older
 * phase-based registry implementation.
 */
type StepExecutor<TContext = unknown, TResult = unknown> = (context: TContext) => Promise<TResult> | TResult;
/** Free-form string that identifies a pipeline stage (e.g. `'build'`, `'deploy'`, `'default'`). */
export type StepStage = string;
/**
 * @deprecated Use `StepStage` instead. `phase` is a legacy alias for `stage`.
 */
export type WorkflowPhase = StepStage;
/** Alias for `StepExecutor` used in registry definitions. */
export type StepHandler<TContext = unknown, TResult = unknown> = StepExecutor<TContext, TResult>;
/** Optional runtime preconditions a step needs before it can execute. */
export type StepRequirements = {
    files?: string[];
    tools?: string[];
    config?: Record<string, unknown>;
    env?: string[];
};
/** Arbitrary key-value pairs attached to a step definition. */
export type StepMetadataRecord = Record<string, unknown>;
/**
 * Loose input shape accepted by `createStepDefinition` and `StepRegistry.register`.
 * Accepts legacy field aliases (`phase`, `handler`, `registered`) alongside canonical ones.
 */
export type StepDefinitionInput = {
    id: string;
    name: string;
    description: string;
    stage?: StepStage;
    /** @deprecated Use `stage` instead. */
    phase?: WorkflowPhase;
    dependencies?: string[];
    tags?: string[];
    critical?: boolean;
    enabled?: boolean;
    timeout?: number;
    requirements?: StepRequirements;
    execute?: StepExecutor;
    /** @deprecated Use `execute` instead. */
    handler?: StepHandler;
    registeredAt?: number | null;
    /** @deprecated Use `registeredAt` instead. */
    registered?: number | null;
    version?: string;
    metadata?: StepMetadataRecord;
};
/** Normalized, fully-defaulted step shape stored internally by the registry. */
export type StepDefinition = {
    id: string;
    name: string;
    description: string;
    stage: StepStage;
    dependencies: string[];
    tags: string[];
    critical: boolean;
    enabled: boolean;
    timeout: number;
    requirements: StepRequirements;
    execute?: StepExecutor;
    metadata: StepMetadataRecord & {
        registeredAt: number | null;
        version: string;
    };
};
/** Runtime values checked against a step's `requirements` declaration. */
export type StepRequirementContext = {
    files?: string[];
    tools?: string[];
    config?: Record<string, unknown>;
    env?: Record<string, unknown>;
};
/** Result of checking a step's requirements against a context. */
export type RequirementMatchResult = {
    met: boolean;
    missing: string[];
};
/** Result of validating dependency references across a set of steps. */
export type DependencyValidationResult = {
    valid: boolean;
    errors: string[];
};
/** Aggregate counts returned by `StepRegistry.getStats()`. */
export type StepRegistryStats = {
    total: number;
    enabled: number;
    disabled: number;
    critical: number;
    byStage: Record<StepStage, number>;
};
/** Filter options accepted by `StepRegistry.list()`. */
export type StepListFilter = {
    stage?: StepStage;
    /** @deprecated Use `stage` instead. */
    phase?: WorkflowPhase;
    tags?: string[];
    enabledOnly?: boolean;
};
/** Thrown when a step definition fails validation (bad input from the caller). */
export declare class StepRegistryValidationError extends Error {
    constructor(message: string);
}
/** Thrown for internal registry failures unrelated to caller-provided input. */
export declare class StepRegistrySystemError extends Error {
    constructor(message: string);
}
export declare function validateStepMetadata(metadata: unknown): string[];
/**
 * Creates a normalized `StepDefinition` from loose input, applying all defaults.
 * @throws {StepRegistryValidationError} when the input fails validation.
 */
export declare function createStepDefinition(metadata: StepDefinitionInput): StepDefinition;
export declare function matchStepRequirements(step: Pick<StepDefinition, 'requirements'>, context?: StepRequirementContext): RequirementMatchResult;
/** Groups steps by their `stage`, returning a map of stage name -> step array. */
export declare function groupStepsByStage(steps: StepDefinition[]): Record<StepStage, StepDefinition[]>;
/**
 * @deprecated Use `groupStepsByStage` instead. `phase` is a legacy alias for `stage`.
 */
export declare function groupStepsByPhase(steps: StepDefinition[]): Record<WorkflowPhase, StepDefinition[]>;
/**
 * Returns only the steps that match all of the provided tags.
 * Returns all steps when `tags` is empty or omitted.
 */
export declare function filterStepsByTags(steps: StepDefinition[], tags?: string[]): StepDefinition[];
/**
 * Returns only enabled steps when `enabledOnly` is true (the default).
 * Pass `false` to return all steps regardless of their `enabled` flag.
 */
export declare function filterStepsByEnabled(steps: StepDefinition[], enabledOnly?: boolean): StepDefinition[];
/** Returns all steps whose `stage` matches the given value. */
export declare function findStepsByStage(steps: StepDefinition[], stage: StepStage): StepDefinition[];
/**
 * @deprecated Use `findStepsByStage` instead. `phase` is a legacy alias for `stage`.
 */
export declare function findStepsByPhase(steps: StepDefinition[], phase: WorkflowPhase): StepDefinition[];
/**
 * Returns a sorted copy of `steps` ordered by the first numeric run in each ID.
 * Steps with no numeric component in their ID sort after all numbered steps.
 */
export declare function sortStepsById(steps: StepDefinition[]): StepDefinition[];
/**
 * Validates that every dependency declared on each step refers to a known step ID.
 * Returns `{ valid: true, errors: [] }` when all dependencies resolve.
 */
export declare function validateStepDependencies(steps: StepDefinition[]): DependencyValidationResult;
export declare class StepRegistry {
    private readonly steps;
    private registrationOrder;
    /**
     * Registers a new step under `stepId` with the provided definition.
     * @throws {StepRegistryValidationError} when `stepId` is already registered or the definition is invalid.
     */
    register(stepId: string, definition: Omit<StepDefinitionInput, 'id'>): StepDefinition;
    /**
     * Applies partial updates to an existing step, preserving all unspecified fields.
     * @throws {StepRegistryValidationError} when `stepId` is not found or the updated definition is invalid.
     */
    update(stepId: string, updates: Partial<StepDefinitionInput>): StepDefinition;
    /** Removes `stepId` from the registry. Returns `true` if the step existed and was removed. */
    unregister(stepId: string): boolean;
    /** Returns the step definition for `stepId`, or `null` if not found. */
    get(stepId: string): StepDefinition | null;
    /** Returns `true` when `stepId` is registered. */
    has(stepId: string): boolean;
    /**
     * Returns registered steps that match the filter, sorted by numeric ID order.
     * Defaults to returning only enabled steps; pass `{ enabledOnly: false }` to include disabled ones.
     */
    list(filter?: StepListFilter): StepDefinition[];
    /** Returns all registered steps grouped by their `stage` value. */
    getByStage(): Record<StepStage, StepDefinition[]>;
    /**
     * @deprecated Use `getByStage()` instead. `phase` is a legacy alias for `stage`.
     */
    getByPhase(): Record<WorkflowPhase, StepDefinition[]>;
    /** Returns all registered steps in the order they were registered. */
    getInOrder(): StepDefinition[];
    /** Validates all inter-step dependency references; returns errors for missing dependencies. */
    validateAll(): DependencyValidationResult;
    /**
     * Checks whether the requirements declared on `stepId` are satisfied by `context`.
     * @throws {StepRegistryValidationError} when `stepId` is not found.
     */
    checkRequirements(stepId: string, context?: StepRequirementContext): RequirementMatchResult;
    /** Removes all steps and resets registration order. */
    clear(): void;
    /** Returns aggregate counts for the registered steps (total, enabled, disabled, critical, by stage). */
    getStats(): StepRegistryStats;
    /**
     * Not yet implemented - placeholder for future directory-based step discovery.
     * @throws {StepRegistrySystemError} always, until this method is implemented.
     */
    loadStepsFromDirectory(dir: string): never;
}
export {};
//# sourceMappingURL=olinda_step_registry.d.ts.map