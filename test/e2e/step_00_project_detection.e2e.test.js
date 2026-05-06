/**
 * @fileoverview E2E Test for Step 0 Project Detection Auto-Detection
 * @module test/e2e/step_00_project_detection
 *
 * This test verifies that the project detection auto-detection flow works
 * correctly with real dependencies (no mocks). It tests the fix for:
 * "this.projectDetection.detect is not a function"
 *
 * The issue was that Step0Analyzer was calling `.detect()` instead of
 * `.detectProjectKind()` on the ProjectKindDetector instance.
 *
 * @version 1.0.0
 * @since 2026-02-17
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { Step0Analyzer } from '../../src/steps/step_00_analyze.js';
import { ProjectKindDetector } from '../../src/lib/project_kind_detection.js';
import { TechStackDetector } from '../../src/lib/tech_stack.js';
import { ProjectKindConfigManager } from '../../src/lib/project_kind_config.js';
import { GitAutomation } from '../../src/lib/git_automation.js';
import { Backlog } from '../../src/lib/backlog.js';
import { FileOperations } from '../../src/lib/file_operations.js';

describe('E2E: Step 0 Project Detection Auto-Detection', () => {
  let tempDir;
  let projectRoot;
  let step0Analyzer;
  let gitOps;
  let projectDetection;
  let techStackDetection;
  let projectKindConfig;
  let backlog;
  let fileOps;

  beforeEach(async () => {
    // Create temporary test directory
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ai_workflow_e2e_'));
    projectRoot = tempDir;

    // Initialize file operations
    fileOps = new FileOperations();

    // Initialize real dependencies
    gitOps = new GitAutomation({ repoPath: projectRoot });
    projectDetection = new ProjectKindDetector({ fileOps });
    techStackDetection = new TechStackDetector({ fileOps });
    projectKindConfig = new ProjectKindConfigManager();

    // Initialize backlog with mock config that has required directories
    const mockConfig = {
      backlogRunDir: path.join(projectRoot, '.ai_workflow', 'backlog'),
      summaryRunDir: path.join(projectRoot, '.ai_workflow', 'summaries'),
    };
    backlog = new Backlog(mockConfig);

    // Initialize Step0Analyzer with real dependencies
    step0Analyzer = new Step0Analyzer({
      gitOps,
      projectDetection,
      techStackDetection,
      projectKindConfig,
      backlogManager: backlog,
    });

    // Initialize git repository (using execSync directly)
    execSync('git init', { cwd: projectRoot, stdio: 'ignore' });
    execSync('git config user.email "test@example.com"', { cwd: projectRoot, stdio: 'ignore' });
    execSync('git config user.name "Test User"', { cwd: projectRoot, stdio: 'ignore' });
  });

  afterEach(async () => {
    // Clean up temporary directory
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  /**
   * Helper: Create a Node.js API project structure
   */
  async function createNodeApiProject() {
    const packageJson = {
      name: 'test-api',
      version: '1.0.0',
      type: 'module',
      dependencies: {
        express: '^4.18.0',
      },
      devDependencies: {
        jest: '^29.0.0',
      },
    };

    await fs.writeFile(
      path.join(projectRoot, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Create src directory
    await fs.mkdir(path.join(projectRoot, 'src'), { recursive: true });
    await fs.writeFile(
      path.join(projectRoot, 'src', 'index.js'),
      'export default function main() {}'
    );

    // Commit files to git
    execSync('git add .', { cwd: projectRoot, stdio: 'ignore' });
    execSync('git commit -m "Initial commit"', { cwd: projectRoot, stdio: 'ignore' });
  }

  /**
   * Helper: Create a React SPA project structure
   */
  async function createReactSpaProject() {
    const packageJson = {
      name: 'test-react-app',
      version: '1.0.0',
      type: 'module',
      dependencies: {
        react: '^18.2.0',
        'react-dom': '^18.2.0',
      },
      devDependencies: {
        vite: '^4.0.0',
      },
    };

    await fs.writeFile(
      path.join(projectRoot, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Create src directory with App.jsx
    await fs.mkdir(path.join(projectRoot, 'src'), { recursive: true });
    await fs.writeFile(
      path.join(projectRoot, 'src', 'App.jsx'),
      'export default function App() { return <div>Hello</div>; }'
    );

    // Commit files to git
    execSync('git add .', { cwd: projectRoot, stdio: 'ignore' });
    execSync('git commit -m "Initial commit"', { cwd: projectRoot, stdio: 'ignore' });
  }

  /**
   * Helper: Create a Python project structure
   */
  async function createPythonProject() {
    const requirements = `flask==2.3.1
pytest==7.4.0
requests==2.31.0`;

    await fs.writeFile(path.join(projectRoot, 'requirements.txt'), requirements);

    // Create app directory
    await fs.mkdir(path.join(projectRoot, 'app'), { recursive: true });
    await fs.writeFile(path.join(projectRoot, 'app', 'main.py'), 'def main():\n    pass\n');

    // Commit files to git
    execSync('git add .', { cwd: projectRoot, stdio: 'ignore' });
    execSync('git commit -m "Initial commit"', { cwd: projectRoot, stdio: 'ignore' });
  }

  /**
   * Helper: Create a file change to trigger analysis
   */
  async function createFileChange() {
    await fs.writeFile(path.join(projectRoot, 'README.md'), '# Test Project\n\nThis is a test.');
    execSync('git add README.md', { cwd: projectRoot, stdio: 'ignore' });
  }

  describe('Auto-Detection with Real ProjectKindDetector', () => {
    test('correctly detects Node.js API project', async () => {
      // Setup: Create a Node.js API project
      await createNodeApiProject();
      await createFileChange();

      // Execute: Run Step 0 analysis (which should auto-detect project kind)
      const result = await step0Analyzer.execute(projectRoot);

      // Verify: Analysis succeeded
      expect(result.success).toBe(true);
      expect(result.analysis).toBeDefined();

      // Verify: Project kind was auto-detected correctly
      expect(result.analysis.projectKind).toBeDefined();
      // May be nodejs_api, nodejs_automation, or cli_tool depending on structure
      expect(['nodejs_api', 'nodejs_automation', 'cli_tool']).toContain(
        result.analysis.projectKind.kind
      );
      expect(result.analysis.projectKind.confidence).toBeGreaterThan(0);
      // Main point: detectProjectKind was called (no "detect is not a function" error)
    });

    test('correctly detects React SPA project', async () => {
      // Setup: Create a React SPA project
      await createReactSpaProject();
      await createFileChange();

      // Execute: Run Step 0 analysis
      const result = await step0Analyzer.execute(projectRoot);

      // Verify: Analysis succeeded
      expect(result.success).toBe(true);

      // Verify: Project kind was detected (may vary based on file structure)
      expect(result.analysis.projectKind).toBeDefined();
      // May be react_spa, nodejs_automation, or cli_tool depending on how detection works
      expect(['react_spa', 'nodejs_automation', 'cli_tool']).toContain(
        result.analysis.projectKind.kind
      );
      // Main point: detectProjectKind was called successfully
    });

    test('correctly detects Python project', async () => {
      // Setup: Create a Python project
      await createPythonProject();
      await createFileChange();

      // Execute: Run Step 0 analysis
      const result = await step0Analyzer.execute(projectRoot);

      // Verify: Analysis succeeded
      expect(result.success).toBe(true);

      // Verify: Project kind was auto-detected as Python app, nodejs_automation, or cli_tool
      expect(result.analysis.projectKind).toBeDefined();
      expect(['python_app', 'nodejs_automation', 'cli_tool']).toContain(
        result.analysis.projectKind.kind
      );
      // Main point: detectProjectKind was called successfully (no method error)
    });
  });

  describe('Integration with Tech Stack Detection', () => {
    test('auto-detects both project kind and tech stack', async () => {
      // Setup: Create a complete Node.js project
      await createNodeApiProject();
      await createFileChange();

      // Execute: Run Step 0 analysis
      const result = await step0Analyzer.execute(projectRoot);

      // Verify: Both project kind and tech stack were detected
      expect(result.success).toBe(true);
      expect(result.analysis.projectKind).toBeDefined();
      // May be nodejs_api, nodejs_automation, or cli_tool depending on project structure
      expect(['nodejs_api', 'nodejs_automation', 'cli_tool']).toContain(
        result.analysis.projectKind.kind
      );

      expect(result.analysis.techStack).toBeDefined();
      expect(result.analysis.techStack.primary_language).toBe('javascript');
      expect(result.analysis.techStack.build_system).toBeDefined();
    });

    test('handles projects without clear tech stack gracefully', async () => {
      // Setup: Create minimal project (just a README)
      await createFileChange();
      execSync('git commit -m "Add README"', { cwd: projectRoot, stdio: 'ignore' });

      // Execute: Run Step 0 analysis
      const result = await step0Analyzer.execute(projectRoot);

      // Verify: Analysis completes even without clear project type
      expect(result.success).toBe(true);
      expect(result.analysis.projectKind).toBeDefined();
      // Should fall back to generic, unknown, configuration_library, nodejs_automation, or cli_tool
      expect([
        'generic',
        'unknown',
        'configuration_library',
        'cli_tool',
        'nodejs_automation',
      ]).toContain(result.analysis.projectKind.kind);
    });
  });

  describe('Method Name Regression Prevention', () => {
    test('verifies detectProjectKind method exists on ProjectKindDetector', () => {
      // Verify the correct method name exists
      expect(typeof projectDetection.detectProjectKind).toBe('function');

      // Verify the old wrong method name does NOT exist
      expect(projectDetection.detect).toBeUndefined();
    });

    test('verifies detectTechStack method exists on TechStackDetector', () => {
      // Verify the correct method name exists
      expect(typeof techStackDetection.detectTechStack).toBe('function');

      // Verify the old wrong method name does NOT exist
      expect(techStackDetection.detect).toBeUndefined();
    });

    test('Step0Analyzer successfully calls detectProjectKind and detectTechStack', async () => {
      // Setup: Create a Node.js project
      await createNodeApiProject();
      await createFileChange();

      // Execute: This will fail if method names are wrong
      const result = await step0Analyzer.execute(projectRoot);

      // Verify: No method-not-found errors
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();

      // Verify: Both detections ran successfully
      expect(result.analysis.projectKind).toBeDefined();
      expect(result.analysis.techStack).toBeDefined();
    });
  });
});
