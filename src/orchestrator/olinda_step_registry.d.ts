/**
 * Vendored from `olinda_orchestrator/src/step_registry.ts` v0.2.1.
 *
 * The upstream dependency currently ships TypeScript source in the GitHub
 * tarball without a built `dist/` directory, so this local copy is compiled
 * with the rest of the repo and can be imported safely from runtime JS.
 */
type StepExecutor<TContext = unknown, TResult = unknown> = (context: TContext) => Promise<TResult> | TResult;
export type StepStage = string;
export type WorkflowPhase = StepStage;
export type StepHandler<TContext = unknown, TResult = unknown> = StepExecutor<TContext, TResult>;
export type StepRequirements = {
    files?: string[];
    tools?: string[];
    config?: Record<string, unknown>;
    env?: string[];
};
export type StepMetadataRecord = Record<string, unknown>;
export type StepDefinitionInput = {
    id: string;
    name: string;
    description: string;
    stage?: StepStage;
    phase?: WorkflowPhase;
    dependencies?: string[];
    tags?: string[];
    critical?: boolean;
    enabled?: boolean;
    timeout?: number;
    requirements?: StepRequirements;
    execute?: StepExecutor;
    handler?: StepHandler;
    registeredAt?: number | null;
    registered?: number | null;
    version?: string;
    metadata?: StepMetadataRecord;
};
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
export type StepRequirementContext = {
    files?: string[];
    tools?: string[];
    config?: Record<string, unknown>;
    env?: Record<string, unknown>;
};
export type RequirementMatchResult = {
    met: boolean;
    missing: string[];
};
export type DependencyValidationResult = {
    valid: boolean;
    errors: string[];
};
export type StepRegistryStats = {
    total: number;
    enabled: number;
    disabled: number;
    critical: number;
    byStage: Record<StepStage, number>;
};
export type StepListFilter = {
    stage?: StepStage;
    phase?: WorkflowPhase;
    tags?: string[];
    enabledOnly?: boolean;
};
export declare class StepRegistryValidationError extends Error {
    constructor(message: string);
}
export declare class StepRegistrySystemError extends Error {
    constructor(message: string);
}
export declare function validateStepMetadata(metadata: unknown): string[];
export declare function createStepDefinition(metadata: StepDefinitionInput): StepDefinition;
export declare function matchStepRequirements(step: Pick<StepDefinition, 'requirements'>, context?: StepRequirementContext): RequirementMatchResult;
export declare function groupStepsByStage(steps: StepDefinition[]): Record<StepStage, StepDefinition[]>;
export declare function groupStepsByPhase(steps: StepDefinition[]): Record<WorkflowPhase, StepDefinition[]>;
export declare function filterStepsByTags(steps: StepDefinition[], tags?: string[]): StepDefinition[];
export declare function filterStepsByEnabled(steps: StepDefinition[], enabledOnly?: boolean): StepDefinition[];
export declare function findStepsByStage(steps: StepDefinition[], stage: StepStage): StepDefinition[];
export declare function findStepsByPhase(steps: StepDefinition[], phase: WorkflowPhase): StepDefinition[];
export declare function sortStepsById(steps: StepDefinition[]): StepDefinition[];
export declare function validateStepDependencies(steps: StepDefinition[]): DependencyValidationResult;
export declare class StepRegistry {
    private readonly steps;
    private registrationOrder;
    register(stepId: string, definition: Omit<StepDefinitionInput, 'id'>): StepDefinition;
    update(stepId: string, updates: Partial<StepDefinitionInput>): StepDefinition;
    unregister(stepId: string): boolean;
    get(stepId: string): StepDefinition | null;
    has(stepId: string): boolean;
    list(filter?: StepListFilter): StepDefinition[];
    getByStage(): Record<StepStage, StepDefinition[]>;
    getByPhase(): Record<WorkflowPhase, StepDefinition[]>;
    getInOrder(): StepDefinition[];
    validateAll(): DependencyValidationResult;
    checkRequirements(stepId: string, context?: StepRequirementContext): RequirementMatchResult;
    clear(): void;
    getStats(): StepRegistryStats;
    loadStepsFromDirectory(dir: string): never;
}
export {};
//# sourceMappingURL=olinda_step_registry.d.ts.map