/**
 * @fileoverview Step 0d: Docker Pre-flight Validation (v1.0.0)
 * @module steps/step_0d_docker_preflight
 *
 * Validates the Docker environment and build prerequisites before any Docker
 * operations are attempted. Skips gracefully when no Docker files are present
 * in the project. When a Node.js project's Dockerfile contains `RUN npm ci`,
 * the step also validates that `package-lock.json` is resolvable inside the
 * Docker build context, catching issues such as non-existent package version
 * specifiers that `npm audit` cannot detect.
 *
 * Checks performed (in order):
 *  1. Docker file detection — skip if none found
 *  2. Docker CLI availability (`docker --version`)
 *  3. Docker daemon connectivity (`docker info`)
 *  4. Available disk space (warn if < 5 GB free on CWD filesystem)
 *  5. Base-image resolvability (`docker manifest inspect` per unique FROM image)
 *  6. Node.js lockfile npm-ci compatibility (reuses validateLockfileStructure
 *     from step_09_dependencies + `npm install --dry-run --ignore-scripts`)
 *  7. .dockerignore coverage (warns if package-lock.json is excluded)
 *
 * @version 1.0.0
 * @since 2026-04-06
 */

import path from 'path';
import fs from 'fs';

import { STEP_KIND } from './step_contract.js';
import { logger } from '../core/logger.js';
import executor, { normalizeExecutor } from '../core/executor.js';
import { Backlog } from '../lib/backlog.js';
import { validateLockfileStructure } from './step_09_dependencies.js';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Minimum free disk space (bytes) before a warning is emitted. */
export const MIN_DISK_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB

/** Dockerfile name patterns to scan for. */
export const DOCKERFILE_PATTERNS = [
  'Dockerfile',
  'Dockerfile.test',
  'Dockerfile.dev',
  'Dockerfile.prod',
];

/** Marker text in a Dockerfile that signals `npm ci` is used. */
export const NPM_CI_PATTERN = /RUN\s+npm\s+ci\b/;

/** FROM line pattern (handles multi-stage builds; captures the image reference). */
export const FROM_LINE_PATTERN = /^FROM\s+([^\s]+)/im;

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} DockerFile
 * @property {string} absPath   - Absolute path to the file
 * @property {string} name      - Basename
 * @property {string} content   - Raw file content
 */

/**
 * @typedef {Object} CheckResult
 * @property {boolean}  passed   - Whether the check passed
 * @property {string}   message  - Human-readable outcome
 * @property {string[]} [issues] - Detailed issues found (if any)
 */

/**
 * @typedef {Object} PreflightReport
 * @property {boolean}   passed         - True when all executed checks passed
 * @property {boolean}   [skipped]      - True when no Docker files were found
 * @property {string}    [skipReason]   - Human-readable skip reason
 * @property {Object}    checks         - Map of check name → CheckResult
 * @property {string[]}  dockerFiles    - Detected Dockerfile paths (relative)
 * @property {string[]}  baseImages     - Unique base images found in Dockerfiles
 */

// ── Pure Functions — File Detection ──────────────────────────────────────────

/**
 * Find all Dockerfile-family files in a directory (non-recursive, top-level only).
 * @pure
 * @param {string} projectRoot - Absolute path to project root
 * @returns {string[]} Relative paths of detected Docker files
 */
export function detectDockerFiles(projectRoot) {
  const candidates = [...DOCKERFILE_PATTERNS, 'docker-compose.yml', 'docker-compose.yaml'];

  return candidates.filter((name) => {
    try {
      fs.accessSync(path.join(projectRoot, name));
      return true;
    } catch {
      return false;
    }
  });
}

/**
 * Read and return Dockerfile entries (name + content) from a list of relative paths.
 * @pure (I/O hidden behind synchronous fs.readFileSync for simplicity)
 * @param {string}   projectRoot   - Absolute project root
 * @param {string[]} relPaths      - Relative paths returned by detectDockerFiles
 * @returns {DockerFile[]} Parsed Dockerfile entries (excludes non-Dockerfile files)
 */
export function readDockerfiles(projectRoot, relPaths) {
  return relPaths
    .filter((p) => /^Dockerfile/.test(path.basename(p)))
    .map((rel) => {
      const absPath = path.join(projectRoot, rel);
      let content = '';
      try {
        content = fs.readFileSync(absPath, 'utf8');
      } catch {
        // unreadable — leave content empty
      }
      return { absPath, name: rel, content };
    });
}

/**
 * Extract unique base images from a list of Dockerfiles.
 * Handles multi-stage builds; filters out `scratch` and build-arg references.
 * @pure
 * @param {DockerFile[]} dockerfiles - Parsed Dockerfile entries
 * @returns {string[]} Unique image references (e.g. ["node:22-alpine"])
 */
export function extractBaseImages(dockerfiles) {
  const images = new Set();
  for (const { content } of dockerfiles) {
    const lines = content.split('\n');
    for (const line of lines) {
      const m = /^FROM\s+([^\s]+)/i.exec(line.trim());
      if (!m) continue;
      const image = m[1];
      // Skip scratch (no manifest), ARG-interpolated references, and aliases
      if (image === 'scratch' || image.startsWith('$') || /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(image)) {
        continue;
      }
      images.add(image);
    }
  }
  return [...images];
}

/**
 * Determine whether any of the given Dockerfiles invoke `npm ci`.
 * @pure
 * @param {DockerFile[]} dockerfiles - Parsed Dockerfile entries
 * @returns {boolean}
 */
export function dockerfilesUseNpmCi(dockerfiles) {
  return dockerfiles.some(({ content }) => NPM_CI_PATTERN.test(content));
}

/**
 * Check whether `package-lock.json` is excluded by `.dockerignore`.
 * Returns true (i.e. a problem was found) when the file would be ignored.
 * @pure
 * @param {string} projectRoot - Absolute project root
 * @returns {boolean}
 */
export function isLockfileDockerIgnored(projectRoot) {
  const ignorePath = path.join(projectRoot, '.dockerignore');
  try {
    const content = fs.readFileSync(ignorePath, 'utf8');
    return content.split('\n').some((line) => {
      const trimmed = line.trim();
      return (
        trimmed === 'package-lock.json' || trimmed === '*.lock' || trimmed === '*.json' // overly broad — would also exclude package-lock.json
      );
    });
  } catch {
    return false; // no .dockerignore — not a problem
  }
}

// ── Pure Functions — Reporting ────────────────────────────────────────────────

/**
 * Format the pre-flight report as a human-readable markdown string.
 * @pure
 * @param {PreflightReport} report - Preflight result object
 * @returns {string} Markdown-formatted report
 */
export function formatPreflightReport(report) {
  if (report.skipped) {
    return `## Docker Pre-flight Validation\n\n⏭️ Skipped — ${report.skipReason}\n`;
  }

  const statusIcon = (passed) => (passed ? '✅' : '❌');
  const lines = ['## Docker Pre-flight Validation', ''];

  if (report.dockerFiles.length > 0) {
    lines.push(`**Docker files detected:** ${report.dockerFiles.join(', ')}`);
  }
  if (report.baseImages.length > 0) {
    lines.push(`**Base images:** ${report.baseImages.join(', ')}`);
  }
  lines.push('');

  for (const [name, result] of Object.entries(report.checks)) {
    lines.push(`${statusIcon(result.passed)} **${name}**: ${result.message}`);
    if (result.issues && result.issues.length > 0) {
      for (const issue of result.issues) {
        lines.push(`   - ${issue}`);
      }
    }
  }

  lines.push('');
  lines.push(
    report.passed
      ? '✅ All Docker pre-flight checks passed.'
      : '⚠️ Some Docker pre-flight checks failed — review issues above.'
  );
  return lines.join('\n');
}

// ── Impure Class — Step0dDockerPreflight ─────────────────────────────────────

/**
 * Step 0d: Docker Pre-flight Validation
 *
 * Validates the Docker environment and build prerequisites. Skips cleanly
 * when no Docker files are found in the project.
 */
export class Step0dDockerPreflight {
  static stepKind = STEP_KIND.PROJECT;

  constructor(options = {}) {
    this.executor = normalizeExecutor(options.executor || executor);
    this.backlog = options.backlog || new Backlog();
    this._validateLockfileStructure =
      options.validateLockfileStructure ?? validateLockfileStructure;
  }

  /**
   * Execute Step 0d: Docker pre-flight validation.
   * @param {string} projectRoot - Absolute path to project root
   * @returns {Promise<import('./step_contract.js').StepResult>}
   */
  async execute(projectRoot) {
    try {
      logger.step('Step 0d: Docker Pre-flight Validation');

      // ── 1. Detect Docker files ───────────────────────────────────────────
      const dockerFiles = detectDockerFiles(projectRoot);

      if (dockerFiles.length === 0) {
        logger.info('No Docker files detected — skipping Docker pre-flight');

        const report = formatPreflightReport({
          skipped: true,
          skipReason: 'No Docker files (Dockerfile, docker-compose.yml) found in project root',
          checks: {},
          dockerFiles: [],
          baseImages: [],
        });

        await this.backlog.saveStepSummary('0d', 'Docker Pre-flight Validation', report);

        return { success: true, skipped: true, reason: 'No Docker files found' };
      }

      logger.info(`Docker files detected: ${dockerFiles.join(', ')}`);

      const dockerfileEntries = readDockerfiles(projectRoot, dockerFiles);
      const baseImages = extractBaseImages(dockerfileEntries);
      const checks = {};
      const issues = [];

      // ── 2. Docker CLI availability ───────────────────────────────────────
      checks['Docker CLI'] = await this._checkDockerCli();
      if (!checks['Docker CLI'].passed) issues.push('Docker CLI not available');

      // ── 3. Docker daemon connectivity ────────────────────────────────────
      checks['Docker daemon'] = await this._checkDockerDaemon();
      if (!checks['Docker daemon'].passed) issues.push('Docker daemon not running');

      // ── 4. Disk space ────────────────────────────────────────────────────
      checks['Disk space'] = await this._checkDiskSpace(projectRoot);
      if (!checks['Disk space'].passed) issues.push('Low disk space for Docker');

      // ── 5. Base-image resolvability ──────────────────────────────────────
      if (baseImages.length > 0) {
        checks['Base images'] = await this._checkBaseImages(baseImages);
        if (!checks['Base images'].passed) issues.push('One or more base images unreachable');
      }

      // ── 6. Node.js lockfile npm-ci compatibility ─────────────────────────
      if (dockerfilesUseNpmCi(dockerfileEntries)) {
        checks['Lockfile (npm ci)'] = await this._checkLockfileNpmCi(projectRoot);
        if (!checks['Lockfile (npm ci)'].passed) {
          issues.push('package-lock.json incompatible with npm ci inside Docker');
        }
      }

      // ── 7. .dockerignore coverage ────────────────────────────────────────
      checks['.dockerignore'] = this._checkDockerignore(projectRoot);
      if (!checks['.dockerignore'].passed) issues.push('.dockerignore excludes package-lock.json');

      const passed = issues.length === 0;
      const preflight = { passed, checks, dockerFiles, baseImages };

      const report = formatPreflightReport(preflight);

      if (passed) {
        logger.success('All Docker pre-flight checks passed');
      } else {
        logger.warn(`Docker pre-flight issues found (${issues.length}):`);
        for (const issue of issues) {
          logger.warn(`  • ${issue}`);
        }
      }

      await this.backlog.saveStepSummary('0d', 'Docker Pre-flight Validation', report);

      return {
        success: true, // pre-flight issues are warnings — don't block workflow
        passed,
        dockerFiles,
        baseImages,
        issues,
        checks,
      };
    } catch (err) {
      logger.error(`Step 0d failed unexpectedly: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * Check Docker CLI is installed and reachable.
   * @returns {Promise<CheckResult>}
   */
  async _checkDockerCli() {
    try {
      const result = await this.executor.execute('docker --version', {
        shell: true,
        timeout: 10000,
      });
      const version = (result.stdout || '').trim().split('\n')[0] || 'unknown';
      return { passed: true, message: version };
    } catch {
      return { passed: false, message: 'Docker CLI not found or not executable' };
    }
  }

  /**
   * Check Docker daemon is running and accessible.
   * @returns {Promise<CheckResult>}
   */
  async _checkDockerDaemon() {
    try {
      await this.executor.execute('docker info --format "{{.ServerVersion}}"', {
        shell: true,
        timeout: 15000,
      });
      return { passed: true, message: 'Daemon reachable' };
    } catch (err) {
      const hint = (err.stderr || '').includes('permission denied')
        ? 'Permission denied — try running with sudo or add user to docker group'
        : 'Docker daemon not running — start it with: sudo systemctl start docker';
      return { passed: false, message: hint };
    }
  }

  /**
   * Check available disk space on the filesystem containing projectRoot.
   * @param {string} projectRoot
   * @returns {Promise<CheckResult>}
   */
  async _checkDiskSpace(projectRoot) {
    try {
      // `df -k <path>` outputs kilobytes in the 4th column (available)
      const result = await this.executor.execute(
        `df -k "${projectRoot}" | tail -1 | awk '{print $4}'`,
        {
          shell: true,
          timeout: 5000,
        }
      );
      const availableKb = parseInt((result.stdout || '0').trim(), 10);
      const availableBytes = availableKb * 1024;
      const availableGb = (availableBytes / 1024 ** 3).toFixed(1);

      if (availableBytes < MIN_DISK_BYTES) {
        return {
          passed: false,
          message: `Only ${availableGb} GB available — Docker builds may fail (< 5 GB recommended)`,
        };
      }
      return { passed: true, message: `${availableGb} GB available` };
    } catch {
      return { passed: true, message: 'Disk space check skipped (df unavailable)' };
    }
  }

  /**
   * Verify each base image has a reachable manifest.
   * @param {string[]} images
   * @returns {Promise<CheckResult>}
   */
  async _checkBaseImages(images) {
    const unreachable = [];

    for (const image of images) {
      try {
        await this.executor.execute(`docker manifest inspect ${image}`, {
          shell: true,
          timeout: 30000,
        });
      } catch {
        unreachable.push(image);
      }
    }

    if (unreachable.length > 0) {
      return {
        passed: false,
        message: `${unreachable.length} base image(s) unreachable`,
        issues: unreachable.map((img) => `Cannot reach: ${img}`),
      };
    }

    return { passed: true, message: `All ${images.length} base image(s) reachable` };
  }

  /**
   * Validate package-lock.json is compatible with `npm ci` inside Docker.
   * Re-uses validateLockfileStructure from step_09 and runs npm install --dry-run.
   * @param {string} projectRoot
   * @returns {Promise<CheckResult>}
   */
  async _checkLockfileNpmCi(projectRoot) {
    const lockfilePath = path.join(projectRoot, 'package-lock.json');

    if (!fs.existsSync(lockfilePath)) {
      return {
        passed: false,
        message: 'package-lock.json not found — npm ci will fail inside Docker',
      };
    }

    // Structural validation (synchronous, pure)
    const structuralResult = this._validateLockfileStructure(lockfilePath);
    const structuralIssues = structuralResult.issues || [];

    // Dry-run install to catch unresolvable version ranges
    let dryRunIssues = [];
    try {
      await this.executor.execute('npm install --dry-run --ignore-scripts 2>&1', {
        cwd: projectRoot,
        shell: true,
        timeout: 60000,
      });
    } catch (dryRunError) {
      const output = ((dryRunError.stdout || '') + (dryRunError.stderr || '')).trim();
      // Extract the most relevant npm error lines
      const errorLines = output
        .split('\n')
        .filter((l) => l.includes('npm error') || l.includes('notarget') || l.includes('ETARGET'))
        .slice(0, 5);
      dryRunIssues = errorLines.length > 0 ? errorLines : [output.slice(0, 300)];
    }

    const allIssues = [...structuralIssues, ...dryRunIssues];

    if (allIssues.length > 0) {
      return {
        passed: false,
        message: `Lockfile has ${allIssues.length} issue(s) that will cause npm ci to fail`,
        issues: allIssues,
      };
    }

    return { passed: true, message: 'package-lock.json is compatible with npm ci' };
  }

  /**
   * Check that .dockerignore does not exclude package-lock.json.
   * @param {string} projectRoot
   * @returns {CheckResult}
   */
  _checkDockerignore(projectRoot) {
    const excluded = isLockfileDockerIgnored(projectRoot);
    if (excluded) {
      return {
        passed: false,
        message: '.dockerignore excludes package-lock.json — npm ci will fail inside Docker',
        issues: ['Add "!package-lock.json" to .dockerignore to un-exclude it'],
      };
    }
    return { passed: true, message: '.dockerignore does not exclude package-lock.json' };
  }
}

export default Step0dDockerPreflight;
