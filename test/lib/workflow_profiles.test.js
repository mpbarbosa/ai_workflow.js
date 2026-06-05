/**
 * @fileoverview Tests for Workflow Profiles (v2.0.0)
 * @module test/lib/workflow_profiles
 */

import { jest } from '@jest/globals';
import {
  WORKFLOW_PROFILES,
  PROFILE_PATTERNS,
  matchesPattern,
  categorizeChanges,
  selectProfile,
  getProfile,
  getSkipSteps,
  getFocusSteps,
  calculateSavings,
  isValidProfile,
  getAllProfiles,
  formatProfileInfo,
  WorkflowProfileManager,
} from '../../src/lib/workflow_profiles.js';

describe('Workflow Profiles', () => {
  describe('Constants', () => {
    test('WORKFLOW_PROFILES contains all expected profiles', () => {
      expect(WORKFLOW_PROFILES).toHaveProperty('docs_only');
      expect(WORKFLOW_PROFILES).toHaveProperty('code_changes');
      expect(WORKFLOW_PROFILES).toHaveProperty('test_changes');
      expect(WORKFLOW_PROFILES).toHaveProperty('infrastructure');
      expect(WORKFLOW_PROFILES).toHaveProperty('full_validation');
    });

    test('each profile has required properties', () => {
      for (const [name, profile] of Object.entries(WORKFLOW_PROFILES)) {
        expect(profile).toHaveProperty('name');
        expect(profile).toHaveProperty('description');
        expect(profile).toHaveProperty('skipSteps');
        expect(profile).toHaveProperty('focusSteps');
        expect(profile).toHaveProperty('estimatedTime');
        expect(profile).toHaveProperty('savingsPercent');
        expect(profile.name).toBe(name);
      }
    });

    test('PROFILE_PATTERNS contains patterns for each category', () => {
      expect(PROFILE_PATTERNS).toHaveProperty('docs_only');
      expect(PROFILE_PATTERNS).toHaveProperty('code_changes');
      expect(PROFILE_PATTERNS).toHaveProperty('test_changes');
      expect(PROFILE_PATTERNS).toHaveProperty('infrastructure');
    });
  });

  describe('Pure Functions', () => {
    describe('matchesPattern', () => {
      test('matches markdown files for docs pattern', () => {
        const patterns = PROFILE_PATTERNS.docs_only;
        expect(matchesPattern('README.md', patterns)).toBe(true);
        expect(matchesPattern('CHANGELOG.md', patterns)).toBe(true);
        expect(matchesPattern('docs/guide.md', patterns)).toBe(true);
      });

      test('matches JavaScript files for code pattern', () => {
        const patterns = PROFILE_PATTERNS.code_changes;
        expect(matchesPattern('src/index.js', patterns)).toBe(true);
        expect(matchesPattern('lib/utils.js', patterns)).toBe(true);
        expect(matchesPattern('app.mjs', patterns)).toBe(true);
      });

      test('matches TypeScript files for code pattern', () => {
        const patterns = PROFILE_PATTERNS.code_changes;
        expect(matchesPattern('src/index.ts', patterns)).toBe(true);
        expect(matchesPattern('src/auth/login.tsx', patterns)).toBe(true);
        expect(matchesPattern('lib/utils.ts', patterns)).toBe(true);
      });

      test('matches test files for test pattern', () => {
        const patterns = PROFILE_PATTERNS.test_changes;
        expect(matchesPattern('test/unit.test.js', patterns)).toBe(true);
        expect(matchesPattern('app_test.js', patterns)).toBe(true);
      });

      test('matches TypeScript test files for test pattern', () => {
        const patterns = PROFILE_PATTERNS.test_changes;
        expect(matchesPattern('test/unit.test.ts', patterns)).toBe(true);
        expect(matchesPattern('test/domain/entities/GeoPositionError.test.ts', patterns)).toBe(
          true
        );
        expect(matchesPattern('tests/auth.spec.ts', patterns)).toBe(true);
        expect(matchesPattern('src/auth_test.ts', patterns)).toBe(true);
      });

      test('matches config files for infrastructure pattern', () => {
        const patterns = PROFILE_PATTERNS.infrastructure;
        expect(matchesPattern('package.json', patterns)).toBe(true);
        expect(matchesPattern('.github/workflows/ci.yml', patterns)).toBe(true);
        expect(matchesPattern('config.yaml', patterns)).toBe(true);
      });

      test('does not match non-matching files', () => {
        const patterns = PROFILE_PATTERNS.docs_only;
        expect(matchesPattern('src/index.js', patterns)).toBe(false);
        expect(matchesPattern('image.png', patterns)).toBe(false);
      });
    });

    describe('categorizeChanges', () => {
      test('categorizes documentation files', () => {
        const files = ['README.md', 'docs/api.md', 'CHANGELOG.md'];
        const counts = categorizeChanges(files);

        expect(counts.docs).toBe(3);
        expect(counts.code).toBe(0);
        expect(counts.tests).toBe(0);
        expect(counts.infrastructure).toBe(0);
        expect(counts.total).toBe(3);
      });

      test('categorizes code files', () => {
        const files = ['src/index.js', 'lib/utils.js'];
        const counts = categorizeChanges(files);

        expect(counts.docs).toBe(0);
        expect(counts.code).toBe(2);
        expect(counts.tests).toBe(0);
        expect(counts.total).toBe(2);
      });

      test('categorizes test files', () => {
        const files = ['test/unit.test.js', 'app_test.js'];
        const counts = categorizeChanges(files);

        expect(counts.tests).toBe(2);
        expect(counts.code).toBe(0);
        expect(counts.total).toBe(2);
      });

      test('categorizes TypeScript test files as tests, not other', () => {
        const files = [
          'test/domain/entities/GeoPositionError.test.ts',
          'test/domain/entities/GeoPositionOptions.test.ts',
          'test/infrastructure/providers/BrowserGeolocationProvider.test.ts',
        ];
        const counts = categorizeChanges(files);

        expect(counts.tests).toBe(3);
        expect(counts.other).toBe(0);
        expect(counts.total).toBe(3);
      });

      test('categorizes TypeScript source files as code, not other', () => {
        const files = ['src/auth.ts', 'src/components/Login.tsx'];
        const counts = categorizeChanges(files);

        expect(counts.code).toBe(2);
        expect(counts.other).toBe(0);
        expect(counts.total).toBe(2);
      });

      test('categorizes infrastructure files', () => {
        const files = ['package.json', '.github/workflows/ci.yml'];
        const counts = categorizeChanges(files);

        expect(counts.infrastructure).toBe(2);
        expect(counts.total).toBe(2);
      });

      test('categorizes mixed files correctly', () => {
        const files = [
          'README.md',
          'src/index.js',
          'test/unit.test.js',
          'package.json',
          'unknown.xyz',
        ];
        const counts = categorizeChanges(files);

        expect(counts.docs).toBe(1);
        expect(counts.code).toBe(1);
        expect(counts.tests).toBe(1);
        expect(counts.infrastructure).toBe(1);
        expect(counts.other).toBe(1);
        expect(counts.total).toBe(5);
      });

      test('handles empty file list', () => {
        const counts = categorizeChanges([]);
        expect(counts.total).toBe(0);
        expect(counts.docs).toBe(0);
      });
    });

    describe('selectProfile', () => {
      test('selects docs_only for pure documentation changes', () => {
        const counts = { docs: 3, code: 0, tests: 0, infrastructure: 0, other: 0, total: 3 };
        expect(selectProfile(counts)).toBe('docs_only');
      });

      test('selects code_changes when code is modified', () => {
        const counts = { docs: 1, code: 2, tests: 0, infrastructure: 0, other: 0, total: 3 };
        expect(selectProfile(counts)).toBe('code_changes');
      });

      test('selects test_changes for pure test changes', () => {
        const counts = { docs: 0, code: 0, tests: 2, infrastructure: 0, other: 0, total: 2 };
        expect(selectProfile(counts)).toBe('test_changes');
      });

      test('selects full_validation for infrastructure mixed with code changes', () => {
        const counts = { docs: 1, code: 1, tests: 0, infrastructure: 1, other: 0, total: 3 };
        expect(selectProfile(counts)).toBe('full_validation');
      });

      test('selects full_validation for no changes', () => {
        const counts = { docs: 0, code: 0, tests: 0, infrastructure: 0, other: 0, total: 0 };
        expect(selectProfile(counts)).toBe('full_validation');
      });

      test('selects full_validation for mixed/unknown changes', () => {
        const counts = { docs: 0, code: 0, tests: 0, infrastructure: 0, other: 5, total: 5 };
        expect(selectProfile(counts)).toBe('full_validation');
      });

      test('selects full_validation for infrastructure mixed with code/test changes', () => {
        const counts = { docs: 5, code: 3, tests: 2, infrastructure: 1, other: 0, total: 11 };
        expect(selectProfile(counts)).toBe('full_validation');
      });

      test('selects infrastructure for infra-only changes', () => {
        const counts = { docs: 0, code: 0, tests: 0, infrastructure: 4, other: 0, total: 4 };
        expect(selectProfile(counts)).toBe('infrastructure');
      });

      test('selects infrastructure for infra and docs changes only', () => {
        const counts = { docs: 3, code: 0, tests: 0, infrastructure: 2, other: 0, total: 5 };
        expect(selectProfile(counts)).toBe('infrastructure');
      });
    });

    describe('getProfile', () => {
      test('returns profile for valid name', () => {
        const profile = getProfile('docs_only');
        expect(profile).not.toBeNull();
        expect(profile.name).toBe('docs_only');
      });

      test('returns null for invalid name', () => {
        expect(getProfile('invalid_profile')).toBeNull();
      });
    });

    describe('getSkipSteps', () => {
      test('returns skip steps for docs_only', () => {
        const skipSteps = getSkipSteps('docs_only');
        expect(skipSteps).toEqual([7, 8]);
      });

      test('returns empty array for full_validation', () => {
        const skipSteps = getSkipSteps('full_validation');
        expect(skipSteps).toEqual([]);
      });

      test('returns empty array for invalid profile', () => {
        const skipSteps = getSkipSteps('invalid');
        expect(skipSteps).toEqual([]);
      });
    });

    describe('getFocusSteps', () => {
      test('returns focus steps for docs_only', () => {
        const focusSteps = getFocusSteps('docs_only');
        expect(focusSteps).toEqual([1, 2, 4, 10]);
      });

      test('returns "all" for full_validation', () => {
        const focusSteps = getFocusSteps('full_validation');
        expect(focusSteps).toBe('all');
      });

      test('returns "all" for invalid profile', () => {
        const focusSteps = getFocusSteps('invalid');
        expect(focusSteps).toBe('all');
      });
    });

    describe('calculateSavings', () => {
      test('calculates savings for docs_only (60%)', () => {
        const savings = calculateSavings('docs_only', 25);
        expect(savings.baselineMinutes).toBe(25);
        expect(savings.savingsPercent).toBe(60);
        expect(savings.savedMinutes).toBe(15);
        expect(savings.estimatedMinutes).toBe(10);
      });

      test('calculates savings for code_changes (20%)', () => {
        const savings = calculateSavings('code_changes', 25);
        expect(savings.savingsPercent).toBe(20);
        expect(savings.savedMinutes).toBe(5);
        expect(savings.estimatedMinutes).toBe(20);
      });

      test('returns zero savings for full_validation', () => {
        const savings = calculateSavings('full_validation', 25);
        expect(savings.savingsPercent).toBe(0);
        expect(savings.savedMinutes).toBe(0);
        expect(savings.estimatedMinutes).toBe(25);
      });

      test('uses default baseline of 25 minutes', () => {
        const savings = calculateSavings('docs_only');
        expect(savings.baselineMinutes).toBe(25);
      });

      test('returns zero for invalid profile', () => {
        const savings = calculateSavings('invalid', 25);
        expect(savings.savingsPercent).toBe(0);
        expect(savings.savedMinutes).toBe(0);
      });
    });

    describe('isValidProfile', () => {
      test('returns true for valid profiles', () => {
        expect(isValidProfile('docs_only')).toBe(true);
        expect(isValidProfile('code_changes')).toBe(true);
        expect(isValidProfile('full_validation')).toBe(true);
      });

      test('returns false for invalid profiles', () => {
        expect(isValidProfile('invalid')).toBe(false);
        expect(isValidProfile('')).toBe(false);
        expect(isValidProfile(null)).toBe(false);
      });
    });

    describe('getAllProfiles', () => {
      test('returns all profile names', () => {
        const profiles = getAllProfiles();
        expect(profiles).toHaveLength(5);
        expect(profiles).toContain('docs_only');
        expect(profiles).toContain('code_changes');
        expect(profiles).toContain('test_changes');
        expect(profiles).toContain('infrastructure');
        expect(profiles).toContain('full_validation');
      });
    });

    describe('formatProfileInfo', () => {
      test('formats profile info correctly', () => {
        const info = formatProfileInfo('docs_only');
        expect(info).toContain('Profile: docs_only');
        expect(info).toContain('Description: Documentation changes only');
        expect(info).toContain('Time Savings: 60%');
        expect(info).toContain('Skip Steps: 7, 8');
      });

      test('handles invalid profile', () => {
        const info = formatProfileInfo('invalid');
        expect(info).toContain('Unknown profile: invalid');
      });
    });
  });

  describe('WorkflowProfileManager Integration', () => {
    let manager;
    let mockGitAutomation;

    beforeEach(() => {
      mockGitAutomation = {
        status: jest.fn(),
      };
      manager = new WorkflowProfileManager({
        gitAutomation: mockGitAutomation,
        env: {},
      });
    });

    describe('constructor', () => {
      test('initializes with default values', () => {
        expect(manager.currentProfile).toBeNull();
        expect(manager.changeCounts).toBeNull();
      });

      test('accepts custom environment', () => {
        const customEnv = { WORKFLOW_PROFILE: 'docs_only' };
        const customManager = new WorkflowProfileManager({ env: customEnv });
        expect(customManager.env).toBe(customEnv);
      });
    });

    describe('detectProfile', () => {
      test('detects docs_only profile', async () => {
        mockGitAutomation.status.mockResolvedValue({
          modified: ['README.md', 'docs/guide.md'],
          added: [],
          deleted: [],
        });

        const profile = await manager.detectProfile();
        expect(profile).toBe('docs_only');
        expect(manager.getCurrentProfile()).toBe('docs_only');
      });

      test('detects code_changes profile', async () => {
        mockGitAutomation.status.mockResolvedValue({
          modified: ['src/index.js', 'README.md'],
          added: [],
          deleted: [],
        });

        const profile = await manager.detectProfile();
        expect(profile).toBe('code_changes');
      });

      test('uses manual profile from environment', async () => {
        manager.env.WORKFLOW_PROFILE = 'test_changes';
        const profile = await manager.detectProfile();
        expect(profile).toBe('test_changes');
        expect(mockGitAutomation.status).not.toHaveBeenCalled();
      });

      test('falls back to full_validation on invalid manual profile', async () => {
        manager.env.WORKFLOW_PROFILE = 'invalid_profile';
        const profile = await manager.detectProfile();
        expect(profile).toBe('full_validation');
      });

      test('skips detection when SKIP_PROFILE_DETECTION is true', async () => {
        manager.env.SKIP_PROFILE_DETECTION = 'true';
        const profile = await manager.detectProfile();
        expect(profile).toBe('full_validation');
        expect(mockGitAutomation.status).not.toHaveBeenCalled();
      });

      test('falls back to full_validation on git error', async () => {
        mockGitAutomation.status.mockRejectedValue(new Error('Git error'));
        const profile = await manager.detectProfile();
        expect(profile).toBe('full_validation');
      });
    });

    describe('getCurrentProfile', () => {
      test('returns null before detection', () => {
        expect(manager.getCurrentProfile()).toBeNull();
      });

      test('returns profile after detection', async () => {
        mockGitAutomation.status.mockResolvedValue({
          modified: ['README.md'],
          added: [],
          deleted: [],
        });
        await manager.detectProfile();
        expect(manager.getCurrentProfile()).toBe('docs_only');
      });
    });

    describe('getSkipSteps', () => {
      test('returns skip steps for detected profile', async () => {
        mockGitAutomation.status.mockResolvedValue({
          modified: ['README.md'],
          added: [],
          deleted: [],
        });
        await manager.detectProfile();
        expect(manager.getSkipSteps()).toEqual([7, 8]);
      });

      test('returns empty array before detection', () => {
        expect(manager.getSkipSteps()).toEqual([]);
      });
    });

    describe('shouldSkipStep', () => {
      test('returns true for steps in skip list', async () => {
        mockGitAutomation.status.mockResolvedValue({
          modified: ['README.md'],
          added: [],
          deleted: [],
        });
        await manager.detectProfile();
        expect(manager.shouldSkipStep(7)).toBe(true);
        expect(manager.shouldSkipStep(8)).toBe(true);
      });

      test('returns false for steps not in skip list', async () => {
        mockGitAutomation.status.mockResolvedValue({
          modified: ['README.md'],
          added: [],
          deleted: [],
        });
        await manager.detectProfile();
        expect(manager.shouldSkipStep(1)).toBe(false);
        expect(manager.shouldSkipStep(2)).toBe(false);
      });
    });

    describe('getSavings', () => {
      test('returns savings for detected profile', async () => {
        mockGitAutomation.status.mockResolvedValue({
          modified: ['README.md'],
          added: [],
          deleted: [],
        });
        await manager.detectProfile();
        const savings = manager.getSavings();
        expect(savings.savingsPercent).toBe(60);
        expect(savings.savedMinutes).toBe(15);
      });

      test('returns null before detection', () => {
        expect(manager.getSavings()).toBeNull();
      });
    });

    describe('setProfile', () => {
      test('sets profile manually', () => {
        manager.setProfile('code_changes');
        expect(manager.getCurrentProfile()).toBe('code_changes');
      });

      test('throws error for invalid profile', () => {
        expect(() => manager.setProfile('invalid')).toThrow('Invalid profile name: invalid');
      });
    });

    describe('reset', () => {
      test('resets profile state', async () => {
        mockGitAutomation.status.mockResolvedValue({
          modified: ['README.md'],
          added: [],
          deleted: [],
        });
        await manager.detectProfile();
        expect(manager.getCurrentProfile()).not.toBeNull();

        manager.reset();
        expect(manager.getCurrentProfile()).toBeNull();
        expect(manager.changeCounts).toBeNull();
      });
    });

    // [BUG FIX f5fbf32] refreshWithFiles() — update profile from CommitHistory file list
    describe('refreshWithFiles', () => {
      test('[BUG FIX] updates currentProfile based on provided file list', () => {
        // Provide only doc files → profile should be docs_only
        manager.refreshWithFiles(['README.md', 'docs/guide.md', 'CHANGELOG.md']);
        expect(manager.currentProfile).toBe('docs_only');
        expect(manager.changeCounts).toBeDefined();
        expect(manager.changeCounts.docs).toBeGreaterThan(0);
      });

      test('[BUG FIX] updates to code_changes profile for source files', () => {
        manager.refreshWithFiles(['src/index.js', 'src/utils.js', 'src/api.ts']);
        expect(manager.currentProfile).toBe('code_changes');
      });

      test('[BUG FIX] ignores empty array and leaves profile unchanged', () => {
        manager.setProfile('docs_only');
        manager.refreshWithFiles([]);
        // Profile must remain as previously set
        expect(manager.getCurrentProfile()).toBe('docs_only');
      });

      test('[BUG FIX] ignores non-array input and leaves profile unchanged', () => {
        manager.setProfile('code_changes');
        manager.refreshWithFiles(null);
        manager.refreshWithFiles(undefined);
        manager.refreshWithFiles('not-an-array');
        expect(manager.getCurrentProfile()).toBe('code_changes');
      });

      test('[BUG FIX] full_validation for mixed code + infra files', () => {
        manager.refreshWithFiles([
          'src/api.js',
          'src/utils.ts',
          'package.json',
          '.github/workflows/ci.yml',
        ]);
        // infra + code → full_validation
        expect(manager.currentProfile).toBe('full_validation');
      });
    });

    // [BUG FIX f5fbf32] detectProfile handles both git status output formats
    describe('detectProfile status format disambiguation', () => {
      test('[BUG FIX] handles flat {modified, added, deleted} string-array git status format', async () => {
        // The pre-fix code assumed only this format — must still work
        mockGitAutomation.status.mockResolvedValue({
          modified: ['src/index.js'],
          added: [],
          deleted: [],
        });

        const profile = await manager.detectProfile();
        expect(profile).toBe('code_changes');
      });

      test('[BUG FIX] handles {staged, unstaged, untracked} object-array git status format', async () => {
        // parseGitStatus() returns objects with .file property — this format was ignored before the fix
        mockGitAutomation.status.mockResolvedValue({
          staged: [{ file: 'src/index.js', status: 'M' }],
          unstaged: [{ file: 'src/utils.js', status: 'M' }],
          untracked: [],
        });

        const profile = await manager.detectProfile();
        expect(profile).toBe('code_changes');
        expect(manager.changeCounts.code).toBeGreaterThan(0);
      });

      test('[BUG FIX] staged-format with only doc files yields docs_only profile', async () => {
        mockGitAutomation.status.mockResolvedValue({
          staged: [{ file: 'README.md', status: 'M' }],
          unstaged: [{ file: 'docs/guide.md', status: 'M' }],
          untracked: [],
        });

        const profile = await manager.detectProfile();
        expect(profile).toBe('docs_only');
      });
    });
  });
});
