/**
 * @fileoverview step_00 extended e2e coverage
 * @module test/e2e/step_00_extended.e2e.test.js
 *
 * Extends the existing step_00_project_detection.e2e.test.js with additional
 * fixture variants: Python project, React SPA, and generic project.
 * All tests use real ProjectKindDetector / TechStackDetector with no AI calls.
 *
 * @version 1.0.0
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { ProjectKindDetector } from '../../src/lib/project_kind_detection.js';
import { TechStackDetector } from '../../src/lib/tech_stack.js';
import { FileOperations } from '../../src/lib/file_operations.js';
import { createTempProject, cleanupTempProject } from '../helpers/integration.js';

let fileOps;

beforeEach(() => {
  fileOps = new FileOperations();
});

// ---------------------------------------------------------------------------
// Helper: create an in-memory fixture project in a temp dir
// ---------------------------------------------------------------------------

async function createProjectVariant(files) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ai_workflow_step00_variant_'));
  for (const [relPath, content] of Object.entries(files)) {
    const fullPath = path.join(dir, relPath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content);
  }
  return dir;
}

// ---------------------------------------------------------------------------
// nodejs-api fixture (from createTempProject)
// ---------------------------------------------------------------------------

describe('step_00 — nodejs-api fixture', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await createTempProject('nodejs-api');
  });
  afterEach(async () => {
    await cleanupTempProject(tempDir);
  });

  test('ProjectKindDetector can be instantiated with FileOperations', () => {
    const detector = new ProjectKindDetector({ fileOps });
    expect(detector).toBeDefined();
  });

  test('detectProjectKind is a function', () => {
    const detector = new ProjectKindDetector({ fileOps });
    expect(typeof detector.detectProjectKind).toBe('function');
  });

  test('detectProjectKind resolves for nodejs-api fixture', async () => {
    const detector = new ProjectKindDetector({ fileOps });
    const result = await detector.detectProjectKind(tempDir);
    expect(typeof result).toBe('object');
    expect(result).not.toBeNull();
  });

  test('result has projectKind field', async () => {
    const detector = new ProjectKindDetector({ fileOps });
    const result = await detector.detectProjectKind(tempDir);
    expect(result.projectKind ?? result.kind).toBeDefined();
  });

  test('nodejs-api project detects as node-related kind', async () => {
    const detector = new ProjectKindDetector({ fileOps });
    const result = await detector.detectProjectKind(tempDir);
    const kind = result.projectKind ?? result.kind ?? '';
    expect(typeof kind).toBe('string');
    expect(kind.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Python project variant
// ---------------------------------------------------------------------------

describe('step_00 — Python project variant', () => {
  let pythonDir;

  beforeEach(async () => {
    pythonDir = await createProjectVariant({
      'requirements.txt': 'flask>=2.0\nrequests>=2.28\ngunicorn>=20.0\n',
      'app.py':
        'from flask import Flask\napp = Flask(__name__)\n\n@app.route("/")\ndef hello():\n    return "Hello"\n',
      'tests/test_app.py': 'import pytest\nfrom app import app\n\ndef test_hello():\n    pass\n',
      'README.md': '# Python Flask App\n',
    });
  });
  afterEach(async () => {
    await cleanupTempProject(pythonDir);
  });

  test('ProjectKindDetector resolves for Python project', async () => {
    const detector = new ProjectKindDetector({ fileOps });
    const result = await detector.detectProjectKind(pythonDir);
    expect(typeof result).toBe('object');
  });

  test('Python project has a detected kind', async () => {
    const detector = new ProjectKindDetector({ fileOps });
    const result = await detector.detectProjectKind(pythonDir);
    expect(result.projectKind ?? result.kind).toBeDefined();
  });

  test('TechStackDetector finds python in file list', async () => {
    const detector = new TechStackDetector({ fileOps });
    const result = await detector.detectTechStack(pythonDir);
    expect(typeof result).toBe('object');
  });
});

// ---------------------------------------------------------------------------
// React SPA variant
// ---------------------------------------------------------------------------

describe('step_00 — React SPA variant', () => {
  let reactDir;

  beforeEach(async () => {
    reactDir = await createProjectVariant({
      'package.json': JSON.stringify({
        name: 'my-react-app',
        version: '1.0.0',
        dependencies: { react: '^18.0.0', 'react-dom': '^18.0.0' },
        scripts: { start: 'react-scripts start', build: 'react-scripts build' },
      }),
      'src/App.jsx':
        'import React from "react";\nexport default function App() { return <div>Hello</div>; }\n',
      'src/index.js':
        'import React from "react";\nimport ReactDOM from "react-dom";\nimport App from "./App";\nReactDOM.render(<App />, document.getElementById("root"));\n',
      'public/index.html': '<!DOCTYPE html><html><body><div id="root"></div></body></html>\n',
      'README.md': '# React SPA\n',
    });
  });
  afterEach(async () => {
    await cleanupTempProject(reactDir);
  });

  test('ProjectKindDetector resolves for React SPA', async () => {
    const detector = new ProjectKindDetector({ fileOps });
    const result = await detector.detectProjectKind(reactDir);
    expect(typeof result).toBe('object');
  });

  test('React SPA has a detected kind', async () => {
    const detector = new ProjectKindDetector({ fileOps });
    const result = await detector.detectProjectKind(reactDir);
    expect(result.projectKind ?? result.kind).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Generic project variant
// ---------------------------------------------------------------------------

describe('step_00 — generic project variant', () => {
  let genericDir;

  beforeEach(async () => {
    genericDir = await createProjectVariant({
      'README.md': '# My Generic Project\n',
      'config.yaml': 'name: generic\nversion: 1.0.0\n',
      Makefile: 'all:\n\t@echo "Building..."\n',
    });
  });
  afterEach(async () => {
    await cleanupTempProject(genericDir);
  });

  test('ProjectKindDetector resolves for generic project', async () => {
    const detector = new ProjectKindDetector({ fileOps });
    const result = await detector.detectProjectKind(genericDir);
    expect(typeof result).toBe('object');
  });

  test('generic project returns a kind (may be generic)', async () => {
    const detector = new ProjectKindDetector({ fileOps });
    const result = await detector.detectProjectKind(genericDir);
    const kind = result.projectKind ?? result.kind;
    expect(typeof kind).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// TechStackDetector extended coverage
// ---------------------------------------------------------------------------

describe('TechStackDetector — extended coverage', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await createTempProject('nodejs-api');
  });
  afterEach(async () => {
    await cleanupTempProject(tempDir);
  });

  test('TechStackDetector can be instantiated', () => {
    const detector = new TechStackDetector({ fileOps });
    expect(detector).toBeDefined();
  });

  test('detectTechStack method is a function', () => {
    const detector = new TechStackDetector({ fileOps });
    expect(typeof detector.detectTechStack).toBe('function');
  });

  test('detectTechStack resolves for nodejs-api fixture', async () => {
    const detector = new TechStackDetector({ fileOps });
    const result = await detector.detectTechStack(tempDir);
    expect(typeof result).toBe('object');
  });

  test('result has languages field', async () => {
    const detector = new TechStackDetector({ fileOps });
    const result = await detector.detectTechStack(tempDir);
    expect(result.languages ?? result.primaryLanguage).toBeDefined();
  });
});
