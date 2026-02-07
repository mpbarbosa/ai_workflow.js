/**
 * Project Kind Configuration Module
 * @version 2.0.0
 * @description Load and manage project kind configurations from ai_workflow_core
 * @module lib/project_kind_config
 * Part of: AI Workflow Automation v1.2.0 (Phase 4)
 */

import path from 'path';
import yaml from 'js-yaml';
import { FileOperations } from './file_operations.js';
import { logger } from '../core/logger.js';

// ============================================================================
// PURE FUNCTIONS (No I/O, testable)
// ============================================================================

/**
 * Parse YAML content into JavaScript object
 * @param {string} yamlContent - YAML content to parse
 * @returns {Object|null} Parsed object or null on error
 * @pure
 */
export function parseYaml(yamlContent) {
  if (!yamlContent || typeof yamlContent !== 'string') {
    return null;
  }

  try {
    return yaml.load(yamlContent);
  } catch {
    return null;
  }
}

/**
 * Extract project kind configuration from parsed YAML
 * @param {Object} parsedYaml - Parsed project_kinds.yaml content
 * @param {string} projectKind - Project kind to extract (e.g., 'nodejs_api')
 * @returns {Object|null} Project kind config or null if not found
 * @pure
 */
export function extractProjectKindConfig(parsedYaml, projectKind) {
  if (!parsedYaml || typeof parsedYaml !== 'object') {
    return null;
  }

  if (!projectKind || typeof projectKind !== 'string') {
    return null;
  }

  const projectKinds = parsedYaml.project_kinds;
  if (!projectKinds || typeof projectKinds !== 'object') {
    return null;
  }

  const config = projectKinds[projectKind];
  if (!config || typeof config !== 'object') {
    return null;
  }

  return config;
}

/**
 * Merge user overrides into base configuration
 * @param {Object} baseConfig - Base configuration from project_kinds.yaml
 * @param {Object} overrides - User overrides from .workflow-config.yaml
 * @returns {Object} Merged configuration
 * @pure
 */
export function mergeConfigurations(baseConfig, overrides) {
  if (!baseConfig || typeof baseConfig !== 'object') {
    return overrides || {};
  }

  if (!overrides || typeof overrides !== 'object') {
    return { ...baseConfig };
  }

  // Deep merge: overrides take precedence
  const merged = { ...baseConfig };

  for (const key in overrides) {
    if (overrides[key] === null || overrides[key] === undefined) {
      continue;
    }

    if (
      typeof overrides[key] === 'object' &&
      !Array.isArray(overrides[key]) &&
      typeof merged[key] === 'object' &&
      !Array.isArray(merged[key])
    ) {
      // Recursively merge objects
      merged[key] = mergeConfigurations(merged[key], overrides[key]);
    } else {
      // Override arrays and primitives
      merged[key] = overrides[key];
    }
  }

  return merged;
}

/**
 * Validate project structure against validation rules
 * @param {Array<string>} existingFiles - List of existing files in project
 * @param {Array<string>} existingDirs - List of existing directories in project
 * @param {Object} validationRules - Validation rules from config
 * @returns {Object} Validation result { valid, missingFiles, missingDirs, errors }
 * @pure
 */
export function validateProjectStructure(existingFiles, existingDirs, validationRules) {
  if (!validationRules || typeof validationRules !== 'object') {
    return {
      valid: true,
      missingFiles: [],
      missingDirs: [],
      errors: [],
    };
  }

  const result = {
    valid: true,
    missingFiles: [],
    missingDirs: [],
    errors: [],
  };

  // Check required files
  const requiredFiles = validationRules.required_files || [];
  const fileSet = new Set(existingFiles || []);

  for (const requiredFile of requiredFiles) {
    // Handle patterns like "*.sh"
    if (requiredFile.includes('*')) {
      const pattern = requiredFile.replace(/\*/g, '.*');
      const regex = new RegExp(`^${pattern}$`);
      const found = existingFiles.some((file) => regex.test(file));

      if (!found) {
        result.missingFiles.push(requiredFile);
        result.valid = false;
      }
    } else if (!fileSet.has(requiredFile)) {
      result.missingFiles.push(requiredFile);
      result.valid = false;
    }
  }

  // Check required directories
  const requiredDirs = validationRules.required_directories || [];
  const dirSet = new Set(existingDirs || []);

  for (const requiredDir of requiredDirs) {
    if (!dirSet.has(requiredDir)) {
      result.missingDirs.push(requiredDir);
      result.valid = false;
    }
  }

  return result;
}

/**
 * Extract specific configuration sections
 * @param {Object} config - Full project kind configuration
 * @param {string} section - Section to extract (e.g., 'testing', 'quality', 'ai_guidance')
 * @returns {Object|null} Section configuration or null
 * @pure
 */
export function extractConfigSection(config, section) {
  if (!config || typeof config !== 'object') {
    return null;
  }

  if (!section || typeof section !== 'string') {
    return null;
  }

  const sectionData = config[section];
  if (!sectionData) {
    return null;
  }

  return typeof sectionData === 'object' ? { ...sectionData } : sectionData;
}

// ============================================================================
// I/O WRAPPER CLASS
// ============================================================================

/**
 * Project Kind Configuration Manager
 * Loads and manages project kind configurations from ai_workflow_core
 */
export class ProjectKindConfigManager {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.coreConfigPath = options.coreConfigPath || path.join(this.projectRoot, '.workflow_core');
    this.fileOps = options.fileOps || new FileOperations({ dryRun: false });
    this.configCache = new Map();
    this.verbose = options.verbose || false;
  }

  /**
   * Get path to project_kinds.yaml in ai_workflow_core
   * @returns {string} Full path to project_kinds.yaml
   */
  getProjectKindsPath() {
    return path.join(this.coreConfigPath, 'config', 'project_kinds.yaml');
  }

  /**
   * Load and parse project_kinds.yaml file
   * @returns {Promise<Object|null>} Parsed YAML content or null on error
   */
  async loadProjectKindsYaml() {
    const yamlPath = this.getProjectKindsPath();

    if (this.verbose) {
      logger.info(`Loading project_kinds.yaml from: ${yamlPath}`);
    }

    try {
      const exists = await this.fileOps.exists(yamlPath);
      if (!exists) {
        logger.error(`project_kinds.yaml not found at: ${yamlPath}`);
        return null;
      }

      const content = await this.fileOps.readFile(yamlPath);
      const parsed = parseYaml(content);

      if (!parsed) {
        logger.error(`Failed to parse project_kinds.yaml at: ${yamlPath}`);
        return null;
      }

      return parsed;
    } catch (error) {
      logger.error(`Error loading project_kinds.yaml: ${error.message}`);
      return null;
    }
  }

  /**
   * Load configuration for a specific project kind
   * @param {string} projectKind - Project kind (e.g., 'nodejs_api')
   * @returns {Promise<Object|null>} Project kind configuration or null
   */
  async loadConfig(projectKind) {
    // Check cache first
    if (this.configCache.has(projectKind)) {
      if (this.verbose) {
        logger.info(`Using cached config for: ${projectKind}`);
      }
      return this.configCache.get(projectKind);
    }

    // Load from file
    const parsed = await this.loadProjectKindsYaml();
    if (!parsed) {
      return null;
    }

    const config = extractProjectKindConfig(parsed, projectKind);
    if (!config) {
      logger.error(`Project kind '${projectKind}' not found in project_kinds.yaml`);
      return null;
    }

    // Cache for future use
    this.configCache.set(projectKind, config);

    if (this.verbose) {
      logger.info(`Loaded config for: ${projectKind}`);
    }

    return config;
  }

  /**
   * Load configuration with user overrides
   * @param {string} projectKind - Project kind
   * @param {Object} userOverrides - User overrides from .workflow-config.yaml
   * @returns {Promise<Object|null>} Merged configuration
   */
  async loadConfigWithOverrides(projectKind, userOverrides = {}) {
    const baseConfig = await this.loadConfig(projectKind);
    if (!baseConfig) {
      return null;
    }

    return mergeConfigurations(baseConfig, userOverrides);
  }

  /**
   * Get validation rules for a project kind
   * @param {string} projectKind - Project kind
   * @returns {Promise<Object|null>} Validation rules
   */
  async getValidationRules(projectKind) {
    const config = await this.loadConfig(projectKind);
    return extractConfigSection(config, 'validation');
  }

  /**
   * Get testing configuration for a project kind
   * @param {string} projectKind - Project kind
   * @returns {Promise<Object|null>} Testing configuration
   */
  async getTestingConfig(projectKind) {
    const config = await this.loadConfig(projectKind);
    return extractConfigSection(config, 'testing');
  }

  /**
   * Get quality standards for a project kind
   * @param {string} projectKind - Project kind
   * @returns {Promise<Object|null>} Quality standards
   */
  async getQualityStandards(projectKind) {
    const config = await this.loadConfig(projectKind);
    return extractConfigSection(config, 'quality');
  }

  /**
   * Get AI guidance for a project kind
   * @param {string} projectKind - Project kind
   * @returns {Promise<Object|null>} AI guidance
   */
  async getAIGuidance(projectKind) {
    const config = await this.loadConfig(projectKind);
    return extractConfigSection(config, 'ai_guidance');
  }

  /**
   * Get deployment configuration for a project kind
   * @param {string} projectKind - Project kind
   * @returns {Promise<Object|null>} Deployment configuration
   */
  async getDeploymentConfig(projectKind) {
    const config = await this.loadConfig(projectKind);
    return extractConfigSection(config, 'deployment');
  }

  /**
   * Validate project structure against project kind rules
   * @param {string} projectKind - Project kind
   * @returns {Promise<Object>} Validation result
   */
  async validateProject(projectKind) {
    const validationRules = await this.getValidationRules(projectKind);
    if (!validationRules) {
      return {
        valid: false,
        error: `No validation rules found for project kind: ${projectKind}`,
      };
    }

    // Get list of files and directories in project
    try {
      const allPaths = await this.fileOps.listDirectoryRecursive(this.projectRoot, {
        includeDirectories: true,
      });

      // Filter excluded patterns manually
      const excludePatterns = [
        'node_modules',
        '.git',
        'dist',
        'build',
        '.ai_workflow',
        '.workflow_core',
      ];

      const filtered = allPaths.filter((fullPath) => {
        const relativePath = path.relative(this.projectRoot, fullPath);
        return !excludePatterns.some((pattern) => relativePath.startsWith(pattern));
      });

      // Separate files and directories
      const files = [];
      const dirs = new Set();

      for (const fullPath of filtered) {
        const stats = await this.fileOps.stat(fullPath);
        const relativePath = path.relative(this.projectRoot, fullPath);

        if (stats.isFile) {
          files.push(relativePath);
        } else if (stats.isDirectory) {
          // Get directory name for validation (just the basename)
          dirs.add(path.basename(relativePath));
        }
      }

      return validateProjectStructure(files, Array.from(dirs), validationRules);
    } catch (error) {
      return {
        valid: false,
        error: `Error reading project structure: ${error.message}`,
      };
    }
  }

  /**
   * Clear configuration cache
   */
  clearCache() {
    this.configCache.clear();
    if (this.verbose) {
      logger.info('Configuration cache cleared');
    }
  }

  /**
   * Get all supported project kinds
   * @returns {Promise<Array<string>>} List of project kind names
   */
  async getSupportedProjectKinds() {
    const parsed = await this.loadProjectKindsYaml();
    if (!parsed || !parsed.project_kinds) {
      return [];
    }

    return Object.keys(parsed.project_kinds);
  }
}
