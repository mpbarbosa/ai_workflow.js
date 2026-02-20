/**
 * Tech Stack Detection Module
 * @version 2.0.0
 * @description Detect languages, frameworks, build systems, and tools in a project
 * @module lib/tech_stack
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
 * Detect programming languages from file extensions
 * @param {Array<string>} files - List of file paths
 * @returns {Object} Language detection results { languages: Array, primary: string }
 * @pure
 */
export function detectLanguagesFromFiles(files) {
  if (!files || !Array.isArray(files)) {
    return { languages: [], primary: null };
  }

  const languagePatterns = {
    javascript: ['.js', '.mjs', '.cjs', '.jsx'],
    typescript: ['.ts', '.tsx'],
    python: ['.py', '.pyw'],
    bash: ['.sh', '.bash', '.bats'],
    go: ['.go'],
    rust: ['.rs'],
    java: ['.java'],
    yaml: ['.yaml', '.yml'],
    json: ['.json'],
    markdown: ['.md'],
    html: ['.html', '.htm'],
    css: ['.css', '.scss', '.sass', '.less'],
  };

  const counts = {};

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();

    for (const [lang, extensions] of Object.entries(languagePatterns)) {
      if (extensions.includes(ext)) {
        counts[lang] = (counts[lang] || 0) + 1;
      }
    }
  }

  // Sort by count, descending
  const languages = Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .map(([lang]) => lang);

  // Primary is the most common, excluding config files
  const codeLanguages = languages.filter((lang) => !['yaml', 'json', 'markdown'].includes(lang));

  return {
    languages,
    primary: codeLanguages[0] || languages[0] || null,
  };
}

/**
 * Detect frameworks from package.json dependencies
 * @param {Object} packageJson - Parsed package.json content
 * @returns {Array<Object>} Detected frameworks [{ name, type, version }]
 * @pure
 */
export function detectFrameworksFromPackageJson(packageJson) {
  if (!packageJson || typeof packageJson !== 'object') {
    return [];
  }

  const deps = {
    ...(packageJson.dependencies || {}),
    ...(packageJson.devDependencies || {}),
  };

  const frameworks = [];

  // Web frameworks
  const frameworkPatterns = {
    express: { type: 'web-framework', name: 'Express.js' },
    koa: { type: 'web-framework', name: 'Koa' },
    '@nestjs/core': { type: 'web-framework', name: 'NestJS' },
    fastify: { type: 'web-framework', name: 'Fastify' },
    hapi: { type: 'web-framework', name: 'Hapi' },

    // Frontend frameworks
    react: { type: 'frontend-framework', name: 'React' },
    vue: { type: 'frontend-framework', name: 'Vue.js' },
    '@angular/core': { type: 'frontend-framework', name: 'Angular' },
    svelte: { type: 'frontend-framework', name: 'Svelte' },
    next: { type: 'meta-framework', name: 'Next.js' },
    gatsby: { type: 'meta-framework', name: 'Gatsby' },
    nuxt: { type: 'meta-framework', name: 'Nuxt.js' },

    // Testing frameworks
    jest: { type: 'test-framework', name: 'Jest' },
    mocha: { type: 'test-framework', name: 'Mocha' },
    vitest: { type: 'test-framework', name: 'Vitest' },
    '@playwright/test': { type: 'test-framework', name: 'Playwright' },
    cypress: { type: 'test-framework', name: 'Cypress' },

    // Build tools
    webpack: { type: 'build-tool', name: 'Webpack' },
    vite: { type: 'build-tool', name: 'Vite' },
    rollup: { type: 'build-tool', name: 'Rollup' },
    esbuild: { type: 'build-tool', name: 'esbuild' },
    parcel: { type: 'build-tool', name: 'Parcel' },
  };

  for (const [pkg, info] of Object.entries(frameworkPatterns)) {
    if (deps[pkg]) {
      frameworks.push({
        name: info.name,
        type: info.type,
        version: deps[pkg],
        package: pkg,
      });
    }
  }

  return frameworks;
}

/**
 * Detect frameworks from requirements.txt
 * @param {string} requirementsTxt - Contents of requirements.txt
 * @returns {Array<Object>} Detected frameworks [{ name, type, version }]
 * @pure
 */
export function detectFrameworksFromRequirements(requirementsTxt) {
  if (!requirementsTxt || typeof requirementsTxt !== 'string') {
    return [];
  }

  const frameworks = [];
  const lines = requirementsTxt.split('\n');

  const frameworkPatterns = {
    flask: { type: 'web-framework', name: 'Flask' },
    django: { type: 'web-framework', name: 'Django' },
    fastapi: { type: 'web-framework', name: 'FastAPI' },
    tornado: { type: 'web-framework', name: 'Tornado' },
    pyramid: { type: 'web-framework', name: 'Pyramid' },

    // Testing
    pytest: { type: 'test-framework', name: 'Pytest' },
    unittest2: { type: 'test-framework', name: 'unittest2' },

    // Data science
    pandas: { type: 'data-library', name: 'Pandas' },
    numpy: { type: 'data-library', name: 'NumPy' },
    tensorflow: { type: 'ml-framework', name: 'TensorFlow' },
    pytorch: { type: 'ml-framework', name: 'PyTorch' },
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Parse package==version or package>=version format
    const match = trimmed.match(/^([a-zA-Z0-9-_]+)([>=<]+.*)?$/);
    if (!match) continue;

    const pkg = match[1].toLowerCase();
    const version = match[2] || '';

    if (frameworkPatterns[pkg]) {
      frameworks.push({
        name: frameworkPatterns[pkg].name,
        type: frameworkPatterns[pkg].type,
        version: version.replace(/^[>=<]+/, ''),
        package: pkg,
      });
    }
  }

  return frameworks;
}

/**
 * Detect build system from project files
 * @param {Array<string>} files - List of file paths
 * @param {Object} packageJson - Parsed package.json (optional)
 * @returns {Object} Build system info { name, files: [] }
 * @pure
 */
export function detectBuildSystem(files, _packageJson = null) {
  if (!files || !Array.isArray(files)) {
    return { name: 'none', files: [] };
  }

  const fileSet = new Set(files.map((f) => path.basename(f)));

  // Check for various build systems
  if (fileSet.has('package.json')) {
    if (fileSet.has('yarn.lock')) {
      return { name: 'yarn', files: ['package.json', 'yarn.lock'] };
    }
    if (fileSet.has('pnpm-lock.yaml')) {
      return { name: 'pnpm', files: ['package.json', 'pnpm-lock.yaml'] };
    }
    if (fileSet.has('package-lock.json')) {
      return { name: 'npm', files: ['package.json', 'package-lock.json'] };
    }
    return { name: 'npm', files: ['package.json'] };
  }

  if (fileSet.has('Cargo.toml')) {
    return { name: 'cargo', files: ['Cargo.toml'] };
  }

  if (fileSet.has('go.mod')) {
    return { name: 'go', files: ['go.mod'] };
  }

  if (fileSet.has('pom.xml')) {
    return { name: 'maven', files: ['pom.xml'] };
  }

  if (fileSet.has('build.gradle') || fileSet.has('build.gradle.kts')) {
    return {
      name: 'gradle',
      files: fileSet.has('build.gradle.kts') ? ['build.gradle.kts'] : ['build.gradle'],
    };
  }

  if (fileSet.has('Makefile')) {
    return { name: 'make', files: ['Makefile'] };
  }

  if (fileSet.has('pyproject.toml')) {
    return { name: 'poetry', files: ['pyproject.toml'] };
  }

  if (fileSet.has('setup.py')) {
    return { name: 'setuptools', files: ['setup.py'] };
  }

  return { name: 'none', files: [] };
}

/**
 * Detect test framework from project configuration
 * @param {Object} packageJson - Parsed package.json
 * @param {Array<string>} files - List of file paths
 * @returns {Object} Test framework info { name, command }
 * @pure
 */
export function detectTestFramework(packageJson, files) {
  const result = { name: null, command: null };

  // Check package.json for test framework
  if (packageJson && typeof packageJson === 'object') {
    const deps = {
      ...(packageJson.dependencies || {}),
      ...(packageJson.devDependencies || {}),
    };

    if (deps.jest) {
      result.name = 'jest';
      result.command = 'npm test';
      return result;
    }

    if (deps.vitest) {
      result.name = 'vitest';
      result.command = 'npm test';
      return result;
    }

    if (deps.mocha) {
      result.name = 'mocha';
      result.command = 'npm test';
      return result;
    }

    if (deps['@playwright/test']) {
      result.name = 'playwright';
      result.command = 'npx playwright test';
      return result;
    }
  }

  // Check for Python test frameworks
  if (files && Array.isArray(files)) {
    const hasRequirementsTxt = files.some((f) => f.endsWith('requirements.txt'));
    const hasPyFiles = files.some((f) => f.endsWith('.py'));

    if (hasRequirementsTxt || hasPyFiles) {
      result.name = 'pytest';
      result.command = 'pytest';
      return result;
    }

    // Check for shell script tests
    const hasShellTests = files.some(
      (f) => f.includes('test') && (f.endsWith('.sh') || f.endsWith('.bash'))
    );

    if (hasShellTests) {
      result.name = 'bash_unit';
      result.command = 'bash tests/run_tests.sh';
      return result;
    }
  }

  return result;
}

/**
 * Detect linters from configuration files
 * @param {Array<string>} files - List of file paths
 * @param {Object} packageJson - Parsed package.json (optional)
 * @returns {Array<Object>} Detected linters [{ name, configFile }]
 * @pure
 */
export function detectLinters(files, packageJson = null) {
  if (!files || !Array.isArray(files)) {
    return [];
  }

  const linters = [];
  const fileSet = new Set(files.map((f) => path.basename(f)));

  // ESLint
  if (
    fileSet.has('.eslintrc.js') ||
    fileSet.has('.eslintrc.json') ||
    fileSet.has('.eslintrc.yml') ||
    fileSet.has('eslint.config.js') ||
    fileSet.has('eslint.config.mjs')
  ) {
    linters.push({ name: 'eslint', configFile: '.eslintrc.*' });
  } else if (packageJson && packageJson.eslintConfig) {
    linters.push({ name: 'eslint', configFile: 'package.json' });
  }

  // Prettier
  if (
    fileSet.has('.prettierrc') ||
    fileSet.has('.prettierrc.json') ||
    fileSet.has('.prettierrc.js') ||
    fileSet.has('prettier.config.js')
  ) {
    linters.push({ name: 'prettier', configFile: '.prettierrc' });
  }

  // Python linters
  if (fileSet.has('.pylintrc') || fileSet.has('pylintrc')) {
    linters.push({ name: 'pylint', configFile: '.pylintrc' });
  }

  if (fileSet.has('.flake8')) {
    linters.push({ name: 'flake8', configFile: '.flake8' });
  }

  if (fileSet.has('pyproject.toml')) {
    // Black, isort, mypy can be configured in pyproject.toml
    linters.push({ name: 'black', configFile: 'pyproject.toml' });
  }

  // ShellCheck (detect from shell files)
  const hasShellFiles = Array.from(fileSet).some((f) => f.endsWith('.sh') || f.endsWith('.bash'));
  if (hasShellFiles) {
    linters.push({ name: 'shellcheck', configFile: null });
  }

  return linters;
}

/**
 * Generate human-readable tech stack report
 * @param {Object} techStack - Complete tech stack data
 * @returns {string} Formatted report
 * @pure
 */
export function generateTechStackReport(techStack) {
  if (!techStack || typeof techStack !== 'object') {
    return 'No tech stack information available.';
  }

  const lines = [];

  lines.push('=== Tech Stack Report ===\n');

  // Languages
  if (techStack.languages && techStack.languages.length > 0) {
    lines.push('Languages:');
    lines.push(`  Primary: ${techStack.primary_language || 'Unknown'}`);
    lines.push(`  All: ${techStack.languages.join(', ')}`);
    lines.push('');
  }

  // Frameworks
  if (techStack.frameworks && techStack.frameworks.length > 0) {
    lines.push('Frameworks:');
    techStack.frameworks.forEach((fw) => {
      lines.push(`  - ${fw.name} (${fw.type}${fw.version ? `: ${fw.version}` : ''})`);
    });
    lines.push('');
  }

  // Build system
  if (techStack.build_system) {
    lines.push('Build System:');
    lines.push(`  ${techStack.build_system}`);
    lines.push('');
  }

  // Test framework
  if (techStack.test_framework) {
    lines.push('Test Framework:');
    lines.push(`  ${techStack.test_framework}`);
    if (techStack.test_command) {
      lines.push(`  Command: ${techStack.test_command}`);
    }
    lines.push('');
  }

  // Linters
  if (techStack.linters && techStack.linters.length > 0) {
    lines.push('Linters:');
    techStack.linters.forEach((linter) => {
      lines.push(`  - ${linter.name}${linter.configFile ? ` (${linter.configFile})` : ''}`);
    });
    lines.push('');
  }

  return lines.join('\n');
}

// ============================================================================
// I/O WRAPPER CLASS
// ============================================================================

/**
 * Normalize a language name from config (e.g. "bash shell script") to a canonical key
 * used in TEST_PATTERNS, SOURCE_PATTERNS, etc.
 * @param {string} lang - Raw language string from config or detection
 * @returns {string|null} Canonical language key, or null if unrecognized
 * @pure
 */
export function normalizeLanguageName(lang) {
  if (!lang || typeof lang !== 'string') return null;
  const lower = lang.toLowerCase();
  if (lower.includes('bash') || lower.includes('shell') || lower.endsWith('.sh')) return 'bash';
  if (lower.includes('typescript') || lower === 'ts') return 'typescript';
  if (lower.includes('javascript') || lower === 'js') return 'javascript';
  if (lower.includes('python') || lower === 'py') return 'python';
  if (lower === 'go' || lower.includes('golang')) return 'go';
  if (lower.includes('java') && !lower.includes('javascript')) return 'java';
  if (lower.includes('ruby') || lower === 'rb') return 'ruby';
  if (lower.includes('rust') || lower === 'rs') return 'rust';
  return lower;
}

/**
 * Tech Stack Detector
 * Analyzes project to detect languages, frameworks, and tools
 */
export class TechStackDetector {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.fileOps = options.fileOps || new FileOperations({ dryRun: false });
    this.cache = new Map();
    this.verbose = options.verbose || false;
  }

  /**
   * Detect complete tech stack for a project
   * @param {string} projectRoot - Project root directory (optional, uses constructor value)
   * @returns {Promise<Object>} Complete tech stack information
   */
  async detectTechStack(projectRoot = null) {
    const root = projectRoot || this.projectRoot;

    // Check cache
    const cacheKey = `techstack:${root}`;
    if (this.cache.has(cacheKey)) {
      if (this.verbose) {
        logger.info('Using cached tech stack');
      }
      return this.cache.get(cacheKey);
    }

    if (this.verbose) {
      logger.info(`Detecting tech stack for: ${root}`);
    }

    try {
      // Get all files in project
      const allFiles = await this.fileOps.listDirectoryRecursive(root);

      // Filter to root-level and src-level files
      const projectFiles = allFiles
        .filter((f) => {
          const rel = path.relative(root, f);
          return (
            !rel.startsWith('node_modules') &&
            !rel.startsWith('.git') &&
            !rel.startsWith('dist') &&
            !rel.startsWith('build')
          );
        })
        .map((f) => path.relative(root, f));

      // Load package.json if exists
      let packageJson = null;
      const packageJsonPath = path.join(root, 'package.json');
      if (await this.fileOps.exists(packageJsonPath)) {
        const content = await this.fileOps.readFile(packageJsonPath);
        try {
          packageJson = JSON.parse(content);
        } catch {
          packageJson = null;
        }
      }

      // Load requirements.txt if exists
      let requirementsTxt = null;
      const requirementsPath = path.join(root, 'requirements.txt');
      if (await this.fileOps.exists(requirementsPath)) {
        requirementsTxt = await this.fileOps.readFile(requirementsPath);
      }

      // Detect components
      const languageInfo = detectLanguagesFromFiles(projectFiles);
      const frameworksFromPackage = detectFrameworksFromPackageJson(packageJson);
      const frameworksFromRequirements = detectFrameworksFromRequirements(requirementsTxt);
      const buildSystem = detectBuildSystem(projectFiles, packageJson);
      const testFramework = detectTestFramework(packageJson, projectFiles);
      const linters = detectLinters(projectFiles, packageJson);

      // Combine results
      const techStack = {
        primary_language: languageInfo.primary,
        languages: languageInfo.languages,
        frameworks: [...frameworksFromPackage, ...frameworksFromRequirements],
        build_system: buildSystem.name,
        build_files: buildSystem.files,
        test_framework: testFramework.name,
        test_command: testFramework.command,
        linters,
        detected_at: new Date().toISOString(),
      };

      // Override primary_language with explicit config setting if present
      const configLang = await this._readConfigLanguage(root);
      if (configLang) {
        techStack.primary_language = configLang;
        if (!techStack.languages.includes(configLang)) {
          techStack.languages.unshift(configLang);
        } else {
          // Move config language to front so languages[0] returns the right value
          techStack.languages = [configLang, ...techStack.languages.filter((l) => l !== configLang)];
        }
      }

      // Cache result
      this.cache.set(cacheKey, techStack);

      if (this.verbose) {
        logger.info('Tech stack detection complete');
      }

      return techStack;
    } catch (error) {
      logger.error(`Tech stack detection failed: ${error.message}`);
      return {
        error: error.message,
        primary_language: null,
        languages: [],
        frameworks: [],
        build_system: 'none',
        test_framework: null,
        linters: [],
      };
    }
  }

  /**
   * Generate formatted tech stack report
   * @param {string} projectRoot - Project root directory (optional)
   * @returns {Promise<string>} Formatted report
   */
  async generateReport(projectRoot = null) {
    const techStack = await this.detectTechStack(projectRoot);
    return generateTechStackReport(techStack);
  }

  /**
   * Alias for detectTechStack — provided for backwards compatibility with steps
   * that call detectAll().
   * @param {string} projectRoot - Project root directory (optional)
   * @returns {Promise<Object>} Complete tech stack information
   */
  async detectAll(projectRoot = null) {
    return this.detectTechStack(projectRoot);
  }

  /**
   * Read primary_language from .workflow-config.yaml
   * @private
   * @param {string} projectRoot - Project root directory
   * @returns {Promise<string|null>} Normalized language name or null
   */
  async _readConfigLanguage(projectRoot) {
    try {
      const configPath = path.join(projectRoot, '.workflow-config.yaml');
      const exists = await this.fileOps.exists(configPath);
      if (!exists) return null;
      const content = await this.fileOps.readFile(configPath);
      const parsed = yaml.load(content);
      const rawLang = parsed?.tech_stack?.primary_language;
      return rawLang ? normalizeLanguageName(rawLang) : null;
    } catch {
      return null;
    }
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    if (this.verbose) {
      logger.info('Tech stack cache cleared');
    }
  }
}
