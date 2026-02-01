/**
 * Tests for Project Kind Detection Module
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import {
  analyzePackageJson,
  analyzeRequirementsTxt,
  detectByFilePatterns,
  detectByDirectoryStructure,
  calculateConfidence,
  ProjectKindDetector,
} from '../../src/lib/project_kind_detection.js';

describe('Project Kind Detection - Pure Functions', () => {
  describe('analyzePackageJson', () => {
    it('should detect React SPA from dependencies', () => {
      const packageJson = {
        name: 'my-react-app',
        dependencies: {
          react: '^18.0.0',
          'react-dom': '^18.0.0',
        },
      };

      const result = analyzePackageJson(packageJson);

      expect(result.kind).toBe('react_spa');
      expect(result.confidence).toBeGreaterThanOrEqual(85);
      expect(result.indicators).toContain('react_dependency');
    });

    it('should detect Node.js API from Express', () => {
      const packageJson = {
        name: 'my-api',
        dependencies: {
          express: '^4.18.0',
        },
      };

      const result = analyzePackageJson(packageJson);

      expect(result.kind).toBe('nodejs_api');
      expect(result.confidence).toBeGreaterThanOrEqual(80);
      expect(result.indicators).toContain('backend_framework');
    });

    it('should detect configuration library from dev-only deps', () => {
      const packageJson = {
        name: 'my-config',
        devDependencies: {
          jest: '^29.0.0',
          eslint: '^8.0.0',
        },
      };

      const result = analyzePackageJson(packageJson);

      expect(result.kind).toBe('configuration_library');
      expect(result.indicators).toContain('dev_deps_only');
    });

    it('should handle null package.json', () => {
      const result = analyzePackageJson(null);

      expect(result.kind).toBeNull();
      expect(result.confidence).toBe(0);
      expect(result.indicators).toEqual([]);
    });

    it('should handle invalid package.json', () => {
      const result = analyzePackageJson('not an object');

      expect(result.kind).toBeNull();
      expect(result.confidence).toBe(0);
    });
  });

  describe('analyzeRequirementsTxt', () => {
    it('should detect Python app from Flask', () => {
      const requirements = 'Flask==2.3.0\nrequests==2.28.0';

      const result = analyzeRequirementsTxt(requirements);

      expect(result.kind).toBe('python_app');
      expect(result.confidence).toBeGreaterThanOrEqual(80);
      expect(result.indicators).toContain('web_framework');
    });

    it('should detect Python app from Django', () => {
      const requirements = 'Django==4.2.0\npsycopg2==2.9.0';

      const result = analyzeRequirementsTxt(requirements);

      expect(result.kind).toBe('python_app');
      expect(result.confidence).toBeGreaterThanOrEqual(80);
    });

    it('should detect Python app from data science packages', () => {
      const requirements = 'numpy==1.24.0\npandas==2.0.0\nscikit-learn==1.2.0';

      const result = analyzeRequirementsTxt(requirements);

      expect(result.kind).toBe('python_app');
      expect(result.confidence).toBeGreaterThanOrEqual(75);
      expect(result.indicators).toContain('data_science');
    });

    it('should handle null requirements', () => {
      const result = analyzeRequirementsTxt(null);

      expect(result.kind).toBeNull();
      expect(result.confidence).toBe(0);
    });

    it('should detect generic Python project', () => {
      const requirements = 'requests==2.28.0\npytest==7.3.0';

      const result = analyzeRequirementsTxt(requirements);

      expect(result.kind).toBe('python_app');
      expect(result.confidence).toBeGreaterThanOrEqual(60);
    });
  });

  describe('detectByFilePatterns', () => {
    it('should detect shell script automation from high shell percentage', () => {
      const files = ['script1.sh', 'script2.sh', 'script3.sh', 'utils.sh', 'README.md'];

      const result = detectByFilePatterns(files);

      expect(result.kind).toBe('shell_script_automation');
      expect(result.confidence).toBeGreaterThanOrEqual(75);
      expect(result.indicators).toContain('high_shell_percentage');
    });

    it('should detect static website from HTML without build', () => {
      const files = ['index.html', 'about.html', 'style.css', 'script.js'];

      const result = detectByFilePatterns(files);

      expect(result.kind).toBe('static_website');
      expect(result.confidence).toBeGreaterThanOrEqual(70);
    });

    it('should detect configuration library from YAML/MD files', () => {
      const files = [
        'config1.yaml',
        'config2.yaml',
        'config3.yaml',
        'config4.yaml',
        'README.md',
        'GUIDE.md',
        'API.md',
        'CHANGELOG.md',
      ];

      const result = detectByFilePatterns(files);

      expect(result.kind).toBe('configuration_library');
      expect(result.confidence).toBeGreaterThanOrEqual(65);
    });

    it('should return null for empty file list', () => {
      const result = detectByFilePatterns([]);

      expect(result.kind).toBeNull();
      expect(result.confidence).toBe(0);
    });

    it('should handle null input', () => {
      const result = detectByFilePatterns(null);

      expect(result.kind).toBeNull();
      expect(result.confidence).toBe(0);
    });
  });

  describe('detectByDirectoryStructure', () => {
    it('should detect configuration library from config + docs + examples', () => {
      const directories = ['config', 'docs', 'examples', 'scripts'];

      const result = detectByDirectoryStructure(directories);

      expect(result.kind).toBe('configuration_library');
      expect(result.confidence).toBeGreaterThanOrEqual(70);
      expect(result.indicators).toContain('config_lib_structure');
    });

    it('should detect React SPA from public + src', () => {
      const directories = ['public', 'src', 'node_modules'];

      const result = detectByDirectoryStructure(directories);

      expect(result.kind).toBe('react_spa');
      expect(result.confidence).toBeGreaterThanOrEqual(60);
      expect(result.indicators).toContain('spa_structure');
    });

    it('should detect generic app from src + tests', () => {
      const directories = ['src', 'tests', 'docs'];

      const result = detectByDirectoryStructure(directories);

      expect(result.kind).toBe('generic');
      expect(result.confidence).toBeGreaterThanOrEqual(40);
    });

    it('should handle empty directory list', () => {
      const result = detectByDirectoryStructure([]);

      expect(result.kind).toBeNull();
      expect(result.confidence).toBe(0);
    });

    it('should handle null input', () => {
      const result = detectByDirectoryStructure(null);

      expect(result.kind).toBeNull();
      expect(result.confidence).toBe(0);
    });
  });

  describe('calculateConfidence', () => {
    it('should select highest confidence detection', () => {
      const detections = [
        { kind: 'nodejs_api', confidence: 60, indicators: ['package_json'] },
        { kind: 'react_spa', confidence: 90, indicators: ['react_dep'] },
        { kind: 'nodejs_api', confidence: 50, indicators: ['src_dir'] },
      ];

      const result = calculateConfidence(detections);

      // nodejs_api gets 60 + 50 = 110 (capped at 100)
      // react_spa gets 90
      // So nodejs_api wins
      expect(result.kind).toBe('nodejs_api');
      expect(result.confidence).toBe(100);
    });

    it('should sum confidence for same kind', () => {
      const detections = [
        { kind: 'nodejs_api', confidence: 60, indicators: ['package_json'] },
        { kind: 'nodejs_api', confidence: 50, indicators: ['express'] },
      ];

      const result = calculateConfidence(detections);

      expect(result.kind).toBe('nodejs_api');
      expect(result.confidence).toBe(100); // Capped at 100
    });

    it('should filter out null detections', () => {
      const detections = [
        { kind: null, confidence: 0, indicators: [] },
        { kind: 'python_app', confidence: 80, indicators: ['flask'] },
      ];

      const result = calculateConfidence(detections);

      expect(result.kind).toBe('python_app');
      expect(result.confidence).toBe(80);
    });

    it('should return generic for empty detections', () => {
      const result = calculateConfidence([]);

      expect(result.kind).toBe('generic');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.indicators).toContain('no_detection');
    });

    it('should deduplicate indicators', () => {
      const detections = [
        { kind: 'nodejs_api', confidence: 60, indicators: ['package_json', 'express'] },
        { kind: 'nodejs_api', confidence: 50, indicators: ['package_json', 'src'] },
      ];

      const result = calculateConfidence(detections);

      const packageJsonCount = result.indicators.filter((i) => i === 'package_json').length;
      expect(packageJsonCount).toBe(1);
    });
  });
});

describe('Project Kind Detection - Integration', () => {
  let tempDir;
  let detector;

  beforeEach(async () => {
    // Create temp directory
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'project-detection-test-'));
    detector = new ProjectKindDetector({ verbose: false });
  });

  afterEach(async () => {
    // Cleanup temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should detect Node.js API project', async () => {
    // Create package.json
    await fs.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'test-api',
        dependencies: { express: '^4.18.0' },
      })
    );

    const result = await detector.detectProjectKind(tempDir);

    expect(result.kind).toBe('nodejs_api');
    expect(result.confidence).toBeGreaterThan(50);
  });

  it('should detect React SPA project', async () => {
    // Create package.json
    await fs.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'test-react-app',
        dependencies: {
          react: '^18.0.0',
          'react-dom': '^18.0.0',
        },
      })
    );

    // Create public and src directories
    await fs.mkdir(path.join(tempDir, 'public'));
    await fs.mkdir(path.join(tempDir, 'src'));

    const result = await detector.detectProjectKind(tempDir);

    expect(result.kind).toBe('react_spa');
    expect(result.confidence).toBeGreaterThan(80);
  });

  it('should detect Python app project', async () => {
    // Create requirements.txt
    await fs.writeFile(path.join(tempDir, 'requirements.txt'), 'Flask==2.3.0\nrequests==2.28.0');

    const result = await detector.detectProjectKind(tempDir);

    expect(result.kind).toBe('python_app');
    expect(result.confidence).toBeGreaterThan(50);
  });

  it('should detect shell script automation', async () => {
    // Create multiple shell scripts (need >30% of files)
    await fs.writeFile(path.join(tempDir, 'script1.sh'), '#!/bin/bash\necho "test"');
    await fs.writeFile(path.join(tempDir, 'script2.sh'), '#!/bin/bash\necho "test"');
    await fs.writeFile(path.join(tempDir, 'script3.sh'), '#!/bin/bash\necho "test"');
    await fs.writeFile(path.join(tempDir, 'utils.sh'), '#!/bin/bash\necho "test"');
    await fs.writeFile(path.join(tempDir, 'README.md'), '# Test');

    const result = await detector.detectProjectKind(tempDir);

    // With 4 .sh files out of 5 total, it's 80% shell scripts
    // Should trigger shell_script_automation detection
    expect(result.kind).toBe('shell_script_automation');
    expect(result.confidence).toBeGreaterThan(70);
  });

  it('should detect configuration library', async () => {
    // Create config, docs, examples directories
    await fs.mkdir(path.join(tempDir, 'config'));
    await fs.mkdir(path.join(tempDir, 'docs'));
    await fs.mkdir(path.join(tempDir, 'examples'));

    // Create YAML and MD files (need >40% config/doc files)
    await fs.writeFile(path.join(tempDir, 'config', 'config1.yaml'), 'key: value');
    await fs.writeFile(path.join(tempDir, 'config', 'config2.yaml'), 'key: value');
    await fs.writeFile(path.join(tempDir, 'config', 'config3.yaml'), 'key: value');
    await fs.writeFile(path.join(tempDir, 'config', 'config4.yaml'), 'key: value');
    await fs.writeFile(path.join(tempDir, 'docs', 'README.md'), '# Docs');
    await fs.writeFile(path.join(tempDir, 'docs', 'API.md'), '# API');
    await fs.writeFile(path.join(tempDir, 'docs', 'GUIDE.md'), '# Guide');
    await fs.writeFile(path.join(tempDir, 'docs', 'CHANGELOG.md'), '# Changes');

    const result = await detector.detectProjectKind(tempDir);

    expect(result.kind).toBe('configuration_library');
    expect(result.confidence).toBeGreaterThan(50);
  });

  it('should handle non-existent directory gracefully', async () => {
    const result = await detector.detectProjectKind('/non/existent/path');

    expect(result.kind).toBe('generic');
    expect(result.error).toBeDefined();
  });

  it('should default to generic for ambiguous project', async () => {
    // Create minimal project with unclear type
    await fs.writeFile(path.join(tempDir, 'README.md'), '# Test');

    const result = await detector.detectProjectKind(tempDir);

    expect(result.kind).toBe('generic');
    expect(result.confidence).toBeGreaterThan(0);
  });
});
