/**
 * Version comparison utilities using semantic versioning
 */

/**
 * Parse a version string into components
 * @param {string} version - Version string (e.g., "1.2.3" or "v1.2.3-beta")
 * @returns {object} Parsed version components
 */
export function parseVersion(version) {
  if (!version) {
    return { major: 0, minor: 0, patch: 0, prerelease: '', build: '' };
  }

  // Remove leading 'v' if present
  const cleanVersion = version.replace(/^v/, '');

  // Match semver pattern
  const match = cleanVersion.match(
    /^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z-.]+))?(?:\+([0-9A-Za-z-.]+))?$/
  );

  if (!match) {
    throw new Error(`Invalid version format: ${version}`);
  }

  return {
    major: parseInt(match[1] || '0', 10),
    minor: parseInt(match[2] || '0', 10),
    patch: parseInt(match[3] || '0', 10),
    prerelease: match[4] || '',
    build: match[5] || '',
  };
}

/**
 * Compare two versions
 * @param {string} version1 - First version
 * @param {string} version2 - Second version
 * @returns {number} -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 */
export function compareVersions(version1, version2) {
  const v1 = parseVersion(version1);
  const v2 = parseVersion(version2);

  // Compare major, minor, patch
  if (v1.major !== v2.major) return v1.major - v2.major;
  if (v1.minor !== v2.minor) return v1.minor - v2.minor;
  if (v1.patch !== v2.patch) return v1.patch - v2.patch;

  // Handle prerelease
  if (v1.prerelease && !v2.prerelease) return -1;
  if (!v1.prerelease && v2.prerelease) return 1;
  if (v1.prerelease && v2.prerelease) {
    return v1.prerelease.localeCompare(v2.prerelease);
  }

  return 0;
}

/**
 * Check if version1 is greater than version2
 * @param {string} version1 - First version
 * @param {string} version2 - Second version
 * @returns {boolean}
 */
export function isGreaterThan(version1, version2) {
  return compareVersions(version1, version2) > 0;
}

/**
 * Check if version1 is less than version2
 * @param {string} version1 - First version
 * @param {string} version2 - Second version
 * @returns {boolean}
 */
export function isLessThan(version1, version2) {
  return compareVersions(version1, version2) < 0;
}

/**
 * Check if version1 equals version2
 * @param {string} version1 - First version
 * @param {string} version2 - Second version
 * @returns {boolean}
 */
export function isEqual(version1, version2) {
  return compareVersions(version1, version2) === 0;
}

/**
 * Get the latest version from an array of versions
 * @param {string[]} versions - Array of version strings
 * @returns {string} Latest version
 */
export function getLatestVersion(versions) {
  if (!versions || versions.length === 0) {
    return null;
  }

  return versions.reduce((latest, current) => {
    return compareVersions(current, latest) > 0 ? current : latest;
  });
}

export default {
  parseVersion,
  compareVersions,
  isGreaterThan,
  isLessThan,
  isEqual,
  getLatestVersion,
};
