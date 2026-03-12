export declare class WorkflowError extends Error {
  constructor(message: string, code?: string, details?: Record<string, unknown>);
}
export declare class ConfigError extends WorkflowError {
  constructor(message: string, code?: string, details?: Record<string, unknown>);
}
export declare class SystemError extends WorkflowError {
  constructor(message: string, code?: string, details?: Record<string, unknown>);
}
export declare class ValidationError extends WorkflowError {
  constructor(message: string, code?: string, details?: Record<string, unknown>);
}
export declare class StepError extends WorkflowError {
  constructor(message: string, code?: string, details?: Record<string, unknown>);
}
export declare class AiError extends WorkflowError {
  constructor(message: string, code?: string, details?: Record<string, unknown>);
}
