/**
 * Project Kind Detection Module
 * @version 1.0.0
 * @description Auto-detect project type based on file patterns and structure
 * @module lib/project_kind_detection
 * Part of: AI Workflow Automation v1.2.0 (Phase 4)
 */

import path from 'path';
import { FileOperations } from './file_operations.js';
import { logger } from '../core/logger.js';

/**
 * PURE FUNCTIONS - All referentially transparent
 */

/**
 * Analyze package.json to determine Node.js project type (PURE)
 * @param {Object} packageJson - Parsed package.json content
 * @returns {Object} Detection result with kind and confidence
 */
export function analyzePackageJson(packageJson) {
  if (!packageJson || typeof packageJson !== 'object') {
    return { kind: null, confidence: 0, indicators: [] };
  }

  const indicators = [];
  const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

  // Check for React
  if (dependencies.react) {
    indicators.push('react_dependency');
    if (dependencies['react-dom']) {
      indicators.push('react_dom');
    }
    if (dependencies.next || dependencies.gatsby) {
      indicators.push('react_framework');
    }
    return { kind: 'react_spa', confidence: 90, indicators };
  }

  // Check for Node.js backend frameworks
  if (
    dependencies.express ||
    dependencies.koa ||
    dependencies.fastify ||
    dependencies['@nestjs/core']
  ) {
    indicators.push('backend_framework');
    return { kind: 'nodejs_api', confidence: 85, indicators };
  }

  // Check for test-only package (might be configuration library)
  const hasOnlyDevDeps =
    Object.keys(packageJson.dependencies || {}).length === 0 &&
    Object.keys(packageJson.devDependencies || {}).length > 0;
  if (hasOnlyDevDeps && packageJson.type !== 'module') {
    indicators.push('dev_deps_only');
    return { kind: 'configuration_library', confidence: 60, indicators };
  }

  // Generic Node.js project
  if (packageJson.name) {
    indicators.push('has_package_json');
    return { kind: 'nodejs_api', confidence: 60, indicators };
  }

  return { kind: null, confidence: 0, indicators };
}

/**
 * Analyze requirements.txt to determine Python project type (PURE)
 * @param {string} requirementsContent - Content of requirements.txt
 * @returns {Object} Detection result with kind and confidence
 */
export function analyzeRequirementsTxt(requirementsContent) {
  if (!requirementsContent || typeof requirementsContent !== 'string') {
    return { kind: null, confidence: 0, indicators: [] };
  }

  const indicators = [];
  const lowerContent = requirementsContent.toLowerCase();

  // Check for web frameworks
  if (
    lowerContent.includes('flask') ||
    lowerContent.includes('django') ||
    lowerContent.includes('fastapi') ||
    lowerContent.includes('tornado')
  ) {
    indicators.push('web_framework');
    return { kind: 'python_app', confidence: 85, indicators };
  }

  // Check for data science/ML packages
  if (
    lowerContent.includes('numpy') ||
    lowerContent.includes('pandas') ||
    lowerContent.includes('scikit-learn') ||
    lowerContent.includes('tensorflow')
  ) {
    indicators.push('data_science');
    return { kind: 'python_app', confidence: 80, indicators };
  }

  // Generic Python project
  indicators.push('has_requirements_txt');
  return { kind: 'python_app', confidence: 70, indicators };
}

/**
 * Detect project kind by file patterns (PURE)
 * @param {Array<string>} files - List of file paths
 * @returns {Object} Detection result with kind and confidence
 */
export function detectByFilePatterns(files) {
  if (!Array.isArray(files)) {
    return { kind: null, confidence: 0, indicators: [] };
  }

  const indicators = [];
  const fileStats = {
    shellScripts: 0,
    jsFiles: 0,
    pyFiles: 0,
    htmlFiles: 0,
    yamlFiles: 0,
    mdFiles: 0,
    totalFiles: files.length,
  };

  files.forEach((file) => {
    const ext = path.extname(file).toLowerCase();
    if (ext === '.sh' || ext === '.bash') fileStats.shellScripts++;
    if (ext === '.js' || ext === '.jsx' || ext === '.ts' || ext === '.tsx') fileStats.jsFiles++;
    if (ext === '.py') fileStats.pyFiles++;
    if (ext === '.html' || ext === '.htm') fileStats.htmlFiles++;
    if (ext === '.yaml' || ext === '.yml') fileStats.yamlFiles++;
    if (ext === '.md') fileStats.mdFiles++;
  });

  // Shell script automation (high shell script percentage)
  if (fileStats.shellScripts > 0 && fileStats.shellScripts / fileStats.totalFiles > 0.3) {
    indicators.push('high_shell_percentage');
    return { kind: 'shell_script_automation', confidence: 80, indicators };
  }

  // Static website (HTML + no build files)
  if (fileStats.htmlFiles > 0 && fileStats.jsFiles < 5 && !files.includes('package.json')) {
    indicators.push('html_without_build');
    return { kind: 'static_website', confidence: 75, indicators };
  }

  // Configuration library (high YAML/MD percentage)
  if (
    fileStats.yamlFiles > 3 &&
    fileStats.mdFiles > 3 &&
    (fileStats.yamlFiles + fileStats.mdFiles) / fileStats.totalFiles > 0.4
  ) {
    indicators.push('high_config_doc_percentage');
    return { kind: 'configuration_library', confidence: 70, indicators };
  }

  return { kind: null, confidence: 0, indicators };
}

/**
 * Detect project kind by directory structure (PURE)
 * @param {Array<string>} directories - List of directory paths
 * @returns {Object} Detection result with kind and confidence
 */
export function detectByDirectoryStructure(directories) {
  if (!Array.isArray(directories)) {
    return { kind: null, confidence: 0, indicators: [] };
  }

  const indicators = [];
  const dirSet = new Set(directories.map((d) => path.basename(d)));

  // Check for common patterns
  const hasPublic = dirSet.has('public');
  const hasSrc = dirSet.has('src');
  const hasTests = dirSet.has('tests') || dirSet.has('test') || dirSet.has('__tests__');
  const hasDocs = dirSet.has('docs');
  const hasConfig = dirSet.has('config');
  const hasExamples = dirSet.has('examples');

  // Configuration library pattern
  if (hasConfig && hasDocs && hasExamples && !hasSrc) {
    indicators.push('config_lib_structure');
    return { kind: 'configuration_library', confidence: 75, indicators };
  }

  // React SPA pattern (public + src)
  if (hasPublic && hasSrc) {
    indicators.push('spa_structure');
    return { kind: 'react_spa', confidence: 65, indicators };
  }

  // Generic application pattern
  if (hasSrc && hasTests) {
    indicators.push('standard_app_structure');
    return { kind: 'generic', confidence: 50, indicators };
  }

  return { kind: null, confidence: 0, indicators };
}

/**
 * Calculate overall confidence score (PURE)
 * @param {Array<Object>} detectionResults - Array of detection results
 * @returns {Object} Best match with combined confidence
 */
export function calculateConfidence(detectionResults) {
  if (!Array.isArray(detectionResults) || detectionResults.length === 0) {
    return { kind: 'generic', confidence: 30, indicators: ['no_detection'] };
  }

  // Filter out null detections
  const validResults = detectionResults.filter((r) => r.kind !== null);

  if (validResults.length === 0) {
    return { kind: 'generic', confidence: 30, indicators: ['no_valid_detection'] };
  }

  // Group by kind and sum confidence
  const kindScores = {};
  validResults.forEach((result) => {
    if (!kindScores[result.kind]) {
      kindScores[result.kind] = { confidence: 0, indicators: [] };
    }
    // Add confidence, but track original values
    kindScores[result.kind].confidence += result.confidence;
    kindScores[result.kind].indicators.push(...result.indicators);
  });

  // Find highest confidence
  let bestKind = null;
  let bestConfidence = 0;
  let bestIndicators = [];

  Object.entries(kindScores).forEach(([kind, data]) => {
    if (data.confidence > bestConfidence) {
      bestKind = kind;
      bestConfidence = data.confidence;
      bestIndicators = data.indicators;
    }
  });

  // Cap confidence at 100
  const cappedConfidence = Math.min(bestConfidence, 100);

  return {
    kind: bestKind || 'generic',
    confidence: cappedConfidence,
    indicators: Array.from(new Set(bestIndicators)),
  };
}

/**
 * WRAPPER CLASS - Handles I/O and side effects
 */

export class ProjectKindDetector {
  constructor(options = {}) {
    this.fileOps = options.fileOps || new FileOperations();
    this.verbose = options.verbose || false;
  }

  /**
   * Detect project kind (main function)
   * @param {string} projectRoot - Project root directory
   * @returns {Promise<Object>} Detection result
   */
  async detectProjectKind(projectRoot) {
    if (this.verbose) {
      logger.info(`Detecting project kind for: ${projectRoot}`);
    }

    const detectionResults = [];

    try {
      // Check for package.json (Node.js)
      const packageJsonPath = path.join(projectRoot, 'package.json');
      if (await this.fileOps.exists(packageJsonPath)) {
        const packageJson = JSON.parse(await this.fileOps.readFile(packageJsonPath));
        const result = analyzePackageJson(packageJson);
        if (result.kind) {
          detectionResults.push(result);
          if (this.verbose) {
            logger.debug(`package.json analysis: ${result.kind} (${result.confidence}%)`);
          }
        }
      }

      // Check for requirements.txt (Python)
      const requirementsPath = path.join(projectRoot, 'requirements.txt');
      if (await this.fileOps.exists(requirementsPath)) {
        const requirementsContent = await this.fileOps.readFile(requirementsPath);
        const result = analyzeRequirementsTxt(requirementsContent);
        if (result.kind) {
          detectionResults.push(result);
          if (this.verbose) {
            logger.debug(`requirements.txt analysis: ${result.kind} (${result.confidence}%)`);
          }
        }
      }

      // List all files for pattern detection (recursively)
      // Note: listDirectoryRecursive returns an array of file path strings
      const allFiles = await this.fileOps.listDirectoryRecursive(projectRoot);

      // Extract just the file names (basename) from full paths
      const files = allFiles.map((filePath) => path.basename(filePath));

      // Detect by file patterns
      const patternResult = detectByFilePatterns(files);
      if (patternResult.kind) {
        detectionResults.push(patternResult);
        if (this.verbose) {
          logger.debug(
            `File pattern analysis: ${patternResult.kind} (${patternResult.confidence}%)`
          );
        }
      }

      // Get directories for structure detection
      const allDirs = await this.fileOps.listDirectoryRecursive(projectRoot, {
        includeDirectories: true,
      });
      const directories = allDirs.map((dirPath) => path.basename(dirPath));
      const structureResult = detectByDirectoryStructure(directories);
      if (structureResult.kind) {
        detectionResults.push(structureResult);
        if (this.verbose) {
          logger.debug(
            `Directory structure analysis: ${structureResult.kind} (${structureResult.confidence}%)`
          );
        }
      }

      // Calculate final result
      const finalResult = calculateConfidence(detectionResults);

      if (this.verbose) {
        logger.info(`Final detection: ${finalResult.kind} (${finalResult.confidence}% confidence)`);
        logger.debug(`Indicators: ${finalResult.indicators.join(', ')}`);
      }

      return finalResult;
    } catch (error) {
      logger.error(`Error detecting project kind: ${error.message}`);
      return {
        kind: 'generic',
        confidence: 30,
        indicators: ['detection_error'],
        error: error.message,
      };
    }
  }
}
