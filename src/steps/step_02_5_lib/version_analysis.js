/**
 * Step 02_5 Submodule: Version Analysis
 * Purpose: Version reference analysis for documentation outdatedness detection
 * Version: 2.0.0
 * Architecture: Referential transparency (pure functions + impure wrapper)
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default version analysis thresholds
 */
export const VERSION_THRESHOLDS = {
  MAJOR_GAP: 2, // Files referencing versions 2+ major versions behind
  MINOR_GAP: 5, // Files referencing versions 5+ minor versions behind
};

/**
 * Version reference patterns
 */
const VERSION_PATTERNS = [
  /v?(\d+\.\d+\.\d+)/gi, // v1.2.3 or 1.2.3
  /version\s+(\d+\.\d+\.\d+)/gi, // version 1.2.3
  /@(\d+\.\d+\.\d+)/g, // @1.2.3
  /\[(\d+\.\d+\.\d+)\]/g, // [1.2.3]
];

// ============================================================================
// PURE FUNCTIONS - Version Extraction
// ============================================================================

/**
 * Extract version references from content
 * @param {string} content - Document content
 * @returns {Array<string>} - Array of unique version strings
 */
export function extractVersionReferences(content) {
  const versions = new Set();

  for (const pattern of VERSION_PATTERNS) {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      const version = match[1].trim();
      if (version) {
        versions.add(version);
      }
    }
  }

  return Array.from(versions).sort();
}

/**
 * Parse semantic version string
 * @param {string} versionStr - Version string (e.g., "v1.2.3" or "1.2.3")
 * @returns {Object} - Parsed version {major, minor, patch}
 */
export function parseVersion(versionStr) {
  // Remove leading v/V
  const cleaned = versionStr.replace(/^[vV]/, '');

  // Split by dots
  const parts = cleaned.split('.').map((p) => parseInt(p, 10) || 0);

  return {
    major: parts[0] || 0,
    minor: parts[1] || 0,
    patch: parts[2] || 0,
  };
}

/**
 * Format version object to string
 * @param {Object} version - Version object {major, minor, patch}
 * @returns {string} - Formatted version string
 */
export function formatVersion(version) {
  return `${version.major}.${version.minor}.${version.patch}`;
}

// ============================================================================
// PURE FUNCTIONS - Version Comparison
// ============================================================================

/**
 * Compare two semantic versions
 * @param {string} v1 - First version string
 * @param {string} v2 - Second version string
 * @returns {number} - -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 */
export function compareVersions(v1, v2) {
  const ver1 = parseVersion(v1);
  const ver2 = parseVersion(v2);

  // Compare major
  if (ver1.major < ver2.major) return -1;
  if (ver1.major > ver2.major) return 1;

  // Compare minor
  if (ver1.minor < ver2.minor) return -1;
  if (ver1.minor > ver2.minor) return 1;

  // Compare patch
  if (ver1.patch < ver2.patch) return -1;
  if (ver1.patch > ver2.patch) return 1;

  return 0;
}

/**
 * Calculate version gap
 * @param {string} oldVersion - Old version string
 * @param {string} newVersion - New version string
 * @returns {Object} - Gap analysis {major, minor, patch}
 */
export function calculateVersionGap(oldVersion, newVersion) {
  const old = parseVersion(oldVersion);
  const newer = parseVersion(newVersion);

  return {
    major: newer.major - old.major,
    minor: newer.minor - old.minor,
    patch: newer.patch - old.patch,
  };
}

/**
 * Find oldest version in array
 * @param {Array<string>} versions - Array of version strings
 * @returns {string|null} - Oldest version or null if empty
 */
export function findOldestVersion(versions) {
  if (versions.length === 0) return null;

  let oldest = versions[0];
  for (let i = 1; i < versions.length; i++) {
    if (compareVersions(versions[i], oldest) < 0) {
      oldest = versions[i];
    }
  }

  return oldest;
}

/**
 * Find newest version in array
 * @param {Array<string>} versions - Array of version strings
 * @returns {string|null} - Newest version or null if empty
 */
export function findNewestVersion(versions) {
  if (versions.length === 0) return null;

  let newest = versions[0];
  for (let i = 1; i < versions.length; i++) {
    if (compareVersions(versions[i], newest) > 0) {
      newest = versions[i];
    }
  }

  return newest;
}

// ============================================================================
// PURE FUNCTIONS - Outdatedness Detection
// ============================================================================

/**
 * Determine if version references are outdated
 * @param {Array<string>} fileVersions - Versions found in file
 * @param {string} currentVersion - Current project version
 * @param {Object} thresholds - Gap thresholds
 * @returns {boolean} - True if outdated
 */
export function isVersionOutdated(fileVersions, currentVersion, thresholds = VERSION_THRESHOLDS) {
  if (fileVersions.length === 0) return false;

  const oldest = findOldestVersion(fileVersions);
  if (!oldest) return false;

  const gap = calculateVersionGap(oldest, currentVersion);

  // Check if major version gap exceeds threshold
  if (gap.major >= thresholds.MAJOR_GAP) return true;

  // Check if minor version gap exceeds threshold (same major version)
  if (gap.major === 0 && gap.minor >= thresholds.MINOR_GAP) return true;

  return false;
}

/**
 * Calculate version staleness score (0-100)
 * @param {Array<string>} fileVersions - Versions found in file
 * @param {string} currentVersion - Current project version
 * @returns {number} - Staleness score (0-100, higher = more stale)
 */
export function calculateVersionStaleness(fileVersions, currentVersion) {
  if (fileVersions.length === 0) return 0;

  const oldest = findOldestVersion(fileVersions);
  if (!oldest) return 0;

  const gap = calculateVersionGap(oldest, currentVersion);

  // Major version gap: 40 points per major version
  const majorScore = Math.min(60, gap.major * 40);

  // Minor version gap: 5 points per minor version
  const minorScore = Math.min(30, gap.minor * 5);

  // Patch version gap: 1 point per patch version
  const patchScore = Math.min(10, gap.patch * 1);

  return Math.min(100, majorScore + minorScore + patchScore);
}

// ============================================================================
// PURE FUNCTIONS - Analysis Results
// ============================================================================

/**
 * Build version analysis for a file
 * @param {string} filePath - File path
 * @param {Object} data - Analysis data
 * @param {Array<string>} data.versions - Versions found
 * @param {string} data.currentVersion - Current project version
 * @param {Object} data.thresholds - Thresholds
 * @returns {Object} - Analysis result
 */
export function buildVersionAnalysis(filePath, data) {
  const { versions, currentVersion, thresholds } = data;

  if (versions.length === 0) {
    return {
      file: filePath,
      hasVersions: false,
      versions: [],
      oldestVersion: null,
      newestVersion: null,
      versionGap: null,
      isOutdated: false,
      stalenessScore: 0,
    };
  }

  const oldest = findOldestVersion(versions);
  const newest = findNewestVersion(versions);
  const gap = oldest ? calculateVersionGap(oldest, currentVersion) : null;
  const isOutdated = isVersionOutdated(versions, currentVersion, thresholds);
  const stalenessScore = calculateVersionStaleness(versions, currentVersion);

  return {
    file: filePath,
    hasVersions: true,
    versions,
    oldestVersion: oldest,
    newestVersion: newest,
    versionGap: gap,
    isOutdated,
    stalenessScore,
  };
}

/**
 * Filter analyses by outdated status
 * @param {Array<Object>} analyses - Array of version analyses
 * @returns {Array<Object>} - Outdated analyses
 */
export function filterOutdatedFiles(analyses) {
  return analyses.filter((a) => a.isOutdated);
}

/**
 * Sort analyses by staleness score descending
 * @param {Array<Object>} analyses - Array of version analyses
 * @returns {Array<Object>} - Sorted analyses
 */
export function sortByVersionStaleness(analyses) {
  return [...analyses].sort((a, b) => b.stalenessScore - a.stalenessScore);
}

/**
 * Generate version analysis summary
 * @param {Array<Object>} analyses - Array of version analyses
 * @returns {Object} - Summary statistics
 */
export function generateVersionSummary(analyses) {
  const withVersions = analyses.filter((a) => a.hasVersions);
  const outdated = filterOutdatedFiles(analyses);

  const avgScore =
    withVersions.length > 0
      ? Math.round(withVersions.reduce((sum, a) => sum + a.stalenessScore, 0) / withVersions.length)
      : 0;

  const versionCounts = {};
  for (const analysis of withVersions) {
    for (const version of analysis.versions) {
      versionCounts[version] = (versionCounts[version] || 0) + 1;
    }
  }

  return {
    totalFiles: analyses.length,
    filesWithVersions: withVersions.length,
    filesWithoutVersions: analyses.length - withVersions.length,
    outdatedFiles: outdated.length,
    avgStalenessScore: avgScore,
    commonVersions: Object.entries(versionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([version, count]) => ({ version, count })),
  };
}

// ============================================================================
// VERSION ANALYZER - Impure Wrapper Class
// ============================================================================

/**
 * Version analyzer for documentation outdatedness detection
 * Manages file operations and analysis coordination
 */
export class VersionAnalyzer {
  constructor(options = {}) {
    this.fileOps = options.fileOps; // FileOperations instance
    this.currentVersion = options.currentVersion || '0.0.0';
    this.thresholds = options.thresholds || VERSION_THRESHOLDS;
    this.logger = options.logger || console;
  }

  /**
   * Detect current project version from various sources
   * @param {string} projectRoot - Project root directory
   * @returns {Promise<string>} - Detected version or '0.0.0'
   */
  async detectProjectVersion(projectRoot) {
    try {
      // Try package.json
      try {
        const packageJson = JSON.parse(await this.fileOps.readFile(`${projectRoot}/package.json`));
        if (packageJson.version) {
          this.logger.info(`Detected version from package.json: ${packageJson.version}`);
          return packageJson.version;
        }
      } catch {
        // Not found or invalid
      }

      // Try pyproject.toml
      try {
        const pyproject = await this.fileOps.readFile(`${projectRoot}/pyproject.toml`);
        const match = pyproject.match(/^version\s*=\s*"([^"]+)"/m);
        if (match) {
          this.logger.info(`Detected version from pyproject.toml: ${match[1]}`);
          return match[1];
        }
      } catch {
        // Not found
      }

      // Try CHANGELOG.md
      try {
        const changelog = await this.fileOps.readFile(`${projectRoot}/CHANGELOG.md`);
        const versions = extractVersionReferences(changelog);
        if (versions.length > 0) {
          const latest = findNewestVersion(versions);
          this.logger.info(`Detected version from CHANGELOG.md: ${latest}`);
          return latest;
        }
      } catch {
        // Not found
      }

      this.logger.warn('Could not detect project version, using 0.0.0');
      return '0.0.0';
    } catch (error) {
      this.logger.error(`Error detecting version: ${error.message}`);
      return '0.0.0';
    }
  }

  /**
   * Analyze version references in files
   * @param {Array<string>} filePaths - Array of file paths
   * @returns {Promise<Array<Object>>} - Array of version analyses
   */
  async analyzeFiles(filePaths) {
    this.logger.info(
      `Analyzing version references in ${filePaths.length} files (current: ${this.currentVersion})...`
    );

    const analyses = [];

    for (const file of filePaths) {
      try {
        const content = await this.fileOps.readFile(file);
        const versions = extractVersionReferences(content);

        const analysis = buildVersionAnalysis(file, {
          versions,
          currentVersion: this.currentVersion,
          thresholds: this.thresholds,
        });

        analyses.push(analysis);
      } catch (error) {
        this.logger.warn(`Could not analyze ${file}: ${error.message}`);
      }
    }

    this.logger.info(`Completed version analysis for ${analyses.length} files`);
    return analyses;
  }

  /**
   * Get outdated files
   * @param {Array<Object>} analyses - Version analyses
   * @returns {Array<Object>} - Outdated file analyses
   */
  getOutdatedFiles(analyses) {
    return filterOutdatedFiles(analyses);
  }

  /**
   * Get summary statistics
   * @param {Array<Object>} analyses - Version analyses
   * @returns {Object} - Summary statistics
   */
  getSummary(analyses) {
    return generateVersionSummary(analyses);
  }

  /**
   * Format analysis results for display
   * @param {Array<Object>} analyses - Version analyses
   * @param {number} limit - Maximum number to show
   * @returns {string} - Formatted output
   */
  formatResults(analyses, limit = 10) {
    const sorted = sortByVersionStaleness(analyses);
    const summary = generateVersionSummary(analyses);

    let output = `\n=== Version Analysis Summary ===\n`;
    output += `Total Files: ${summary.totalFiles}\n`;
    output += `Files with Versions: ${summary.filesWithVersions}\n`;
    output += `Outdated Files: ${summary.outdatedFiles}\n`;
    output += `Average Staleness Score: ${summary.avgStalenessScore}/100\n\n`;

    if (summary.commonVersions.length > 0) {
      output += `Most Common Versions:\n`;
      for (const { version, count } of summary.commonVersions) {
        output += `  - v${version}: ${count} files\n`;
      }
      output += `\n`;
    }

    const outdated = sorted.filter((a) => a.isOutdated).slice(0, limit);
    if (outdated.length > 0) {
      output += `Top ${Math.min(limit, outdated.length)} Outdated Files:\n`;
      for (const analysis of outdated) {
        output += `  - ${analysis.file}\n`;
        output += `    Oldest: v${analysis.oldestVersion}, `;
        output += `Gap: ${analysis.versionGap.major}.${analysis.versionGap.minor}.${analysis.versionGap.patch}, `;
        output += `Score: ${analysis.stalenessScore}/100\n`;
      }
    }

    return output;
  }
}
