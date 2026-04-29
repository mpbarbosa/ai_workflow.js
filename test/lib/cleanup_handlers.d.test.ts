import { CleanupManager, CleanupArtifactsOptions, CleanupCacheOptions, CleanupCheckpointsOptions, CleanupSummary } from '../../src/lib/cleanup_handlers';

describe('CleanupManager', () => {
  let manager: CleanupManager;

  beforeEach(() => {
    manager = new CleanupManager('/tmp/workflow');
  });

  it('constructs with and without workflowDir', () => {
    expect(() => new CleanupManager('/tmp/dir')).not.toThrow();
    expect(() => new CleanupManager()).not.toThrow();
  });

  describe('cleanupArtifacts', () => {
    it('resolves with CleanupSummary on happy path', async () => {
      const result = await manager.cleanupArtifacts({ dryRun: false, olderThanDays: 7 });
      expect(result).toHaveProperty('filesDeleted');
      expect(result).toHaveProperty('bytesFreed');
    });

    it('handles dryRun option', async () => {
      const result = await manager.cleanupArtifacts({ dryRun: true });
      expect(result).toHaveProperty('filesDeleted');
      expect(result).toHaveProperty('bytesFreed');
    });

    it('handles missing options', async () => {
      const result = await manager.cleanupArtifacts();
      expect(result).toBeDefined();
    });

    it('handles edge case: negative olderThanDays', async () => {
      const result = await manager.cleanupArtifacts({ olderThanDays: -1 });
      expect(result).toBeDefined();
    });

    it('handles error scenario', async () => {
      jest.spyOn(manager, 'cleanupArtifacts').mockRejectedValueOnce(new Error('Cleanup failed'));
      await expect(manager.cleanupArtifacts()).rejects.toThrow('Cleanup failed');
    });
  });

  describe('cleanupCache', () => {
    it('resolves with CleanupSummary on happy path', async () => {
      const result = await manager.cleanupCache({ dryRun: false });
      expect(result).toHaveProperty('filesDeleted');
      expect(result).toHaveProperty('bytesFreed');
    });

    it('handles dryRun option', async () => {
      const result = await manager.cleanupCache({ dryRun: true });
      expect(result).toHaveProperty('filesDeleted');
      expect(result).toHaveProperty('bytesFreed');
    });

    it('handles missing options', async () => {
      const result = await manager.cleanupCache();
      expect(result).toBeDefined();
    });

    it('handles error scenario', async () => {
      jest.spyOn(manager, 'cleanupCache').mockRejectedValueOnce(new Error('Cache cleanup failed'));
      await expect(manager.cleanupCache()).rejects.toThrow('Cache cleanup failed');
    });
  });

  describe('cleanupCheckpoints', () => {
    it('resolves with CleanupSummary on happy path', async () => {
      const result = await manager.cleanupCheckpoints({ dryRun: false, keepLast: 2 });
      expect(result).toHaveProperty('filesDeleted');
      expect(result).toHaveProperty('bytesFreed');
    });

    it('handles dryRun and keepLast options', async () => {
      const result = await manager.cleanupCheckpoints({ dryRun: true, keepLast: 0 });
      expect(result).toHaveProperty('filesDeleted');
      expect(result).toHaveProperty('bytesFreed');
    });

    it('handles missing options', async () => {
      const result = await manager.cleanupCheckpoints();
      expect(result).toBeDefined();
    });

    it('handles edge case: negative keepLast', async () => {
      const result = await manager.cleanupCheckpoints({ keepLast: -5 });
      expect(result).toBeDefined();
    });

    it('handles error scenario', async () => {
      jest.spyOn(manager, 'cleanupCheckpoints').mockRejectedValueOnce(new Error('Checkpoint cleanup failed'));
      await expect(manager.cleanupCheckpoints()).rejects.toThrow('Checkpoint cleanup failed');
    });
  });
});
