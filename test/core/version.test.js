// test/core/version.test.js

import * as versionModule from '../../src/core/version.js';

describe('core/version module exports', () => {
  it('should export parseVersion, compareVersions, isGreaterThan, isLessThan, isEqual, getLatestVersion', () => {
    expect(versionModule).toHaveProperty('parseVersion');
    expect(versionModule).toHaveProperty('compareVersions');
    expect(versionModule).toHaveProperty('isGreaterThan');
    expect(versionModule).toHaveProperty('isLessThan');
    expect(versionModule).toHaveProperty('isEqual');
    expect(versionModule).toHaveProperty('getLatestVersion');
  });
});

describe('Version utilities', () => {
  const {
    parseVersion,
    compareVersions,
    isGreaterThan,
    isLessThan,
    isEqual,
    getLatestVersion,
  } = versionModule;

  describe('parseVersion', () => {
    it('should parse valid semantic version string', () => {
      const v = parseVersion('1.2.3');
      expect(v).toEqual({ major: 1, minor: 2, patch: 3 });
    });

    it('should parse version with pre-release and build metadata', () => {
      const v = parseVersion('2.0.0-beta+exp.sha.5114f85');
      expect(v.major).toBe(2);
      expect(v.minor).toBe(0);
      expect(v.patch).toBe(0);
      expect(v.prerelease).toBe('beta');
      expect(v.build).toBe('exp.sha.5114f85');
    });

    it('should throw on invalid version string', () => {
      expect(() => parseVersion('invalid')).toThrow();
      expect(() => parseVersion('1.2')).toThrow();
      expect(() => parseVersion('')).toThrow();
    });
  });

  describe('compareVersions', () => {
    it('should return 0 for equal versions', () => {
      expect(compareVersions('1.2.3', '1.2.3')).toBe(0);
    });

    it('should return -1 if first is less than second', () => {
      expect(compareVersions('1.2.3', '1.2.4')).toBe(-1);
      expect(compareVersions('1.2.3', '2.0.0')).toBe(-1);
    });

    it('should return 1 if first is greater than second', () => {
      expect(compareVersions('2.0.0', '1.2.4')).toBe(1);
      expect(compareVersions('1.3.0', '1.2.9')).toBe(1);
    });

    it('should handle pre-release comparison', () => {
      expect(compareVersions('1.2.3-beta', '1.2.3')).toBe(-1);
      expect(compareVersions('1.2.3', '1.2.3-beta')).toBe(1);
    });

    it('should throw on invalid input', () => {
      expect(() => compareVersions('1.2.3', 'bad')).toThrow();
      expect(() => compareVersions('', '1.2.3')).toThrow();
    });
  });

  describe('isGreaterThan', () => {
    it('should return true if first is greater', () => {
      expect(isGreaterThan('2.0.0', '1.9.9')).toBe(true);
    });
    it('should return false if first is not greater', () => {
      expect(isGreaterThan('1.0.0', '1.0.0')).toBe(false);
      expect(isGreaterThan('1.0.0', '2.0.0')).toBe(false);
    });
    it('should throw on invalid input', () => {
      expect(() => isGreaterThan('bad', '1.0.0')).toThrow();
    });
  });

  describe('isLessThan', () => {
    it('should return true if first is less', () => {
      expect(isLessThan('1.0.0', '1.0.1')).toBe(true);
    });
    it('should return false if first is not less', () => {
      expect(isLessThan('2.0.0', '1.0.0')).toBe(false);
      expect(isLessThan('1.0.0', '1.0.0')).toBe(false);
    });
    it('should throw on invalid input', () => {
      expect(() => isLessThan('1.0.0', 'bad')).toThrow();
    });
  });

  describe('isEqual', () => {
    it('should return true for equal versions', () => {
      expect(isEqual('1.2.3', '1.2.3')).toBe(true);
    });
    it('should return false for different versions', () => {
      expect(isEqual('1.2.3', '1.2.4')).toBe(false);
      expect(isEqual('1.2.3', '1.2.3-beta')).toBe(false);
    });
    it('should throw on invalid input', () => {
      expect(() => isEqual('1.2.3', '')).toThrow();
    });
  });

  describe('getLatestVersion', () => {
    it('should return the latest version from a list', () => {
      const versions = ['1.0.0', '1.2.3', '2.0.0', '1.2.4'];
      expect(getLatestVersion(versions)).toBe('2.0.0');
    });
    it('should handle pre-release versions', () => {
      const versions = ['1.2.3-beta', '1.2.3', '1.2.2'];
      expect(getLatestVersion(versions)).toBe('1.2.3');
    });
    it('should throw if list is empty or contains invalid versions', () => {
      expect(() => getLatestVersion([])).toThrow();
      expect(() => getLatestVersion(['bad', '1.0.0'])).toThrow();
    });
  });
});
