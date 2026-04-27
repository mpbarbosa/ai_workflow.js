/**
 * Minimal type surface for the JavaScript cleanup handlers module used by
 * TypeScript sources.
 */

export interface CleanupSummary {
  filesDeleted?: number;
  bytesFreed?: number;
}

export interface CleanupArtifactsOptions {
  dryRun?: boolean;
  olderThanDays?: number;
}

export interface CleanupCacheOptions {
  dryRun?: boolean;
}

export interface CleanupCheckpointsOptions {
  dryRun?: boolean;
  keepLast?: number;
}

export class CleanupManager {
  constructor(workflowDir?: string);
  cleanupArtifacts(options?: CleanupArtifactsOptions): Promise<CleanupSummary>;
  cleanupCache(options?: CleanupCacheOptions): Promise<CleanupSummary>;
  cleanupCheckpoints(options?: CleanupCheckpointsOptions): Promise<CleanupSummary>;
}
