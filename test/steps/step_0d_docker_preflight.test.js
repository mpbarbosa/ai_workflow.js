// test/steps/step_0d_docker_preflight.test.js

import fs from 'fs';
import path from 'path';
import { jest } from '@jest/globals';
import {
  detectDockerFiles,
  readDockerfiles,
  extractBaseImages,
  dockerfilesUseNpmCi,
  isLockfileDockerIgnored,
  formatPreflightReport,
  Step0dDockerPreflight,
  MIN_DISK_BYTES,
  DOCKERFILE_PATTERNS,
  NPM_CI_PATTERN,
  FROM_LINE_PATTERN,
} from '../../src/steps/step_0d_docker_preflight.js';

describe('step_0d_docker_preflight pure functions', () => {
  describe('detectDockerFiles', () => {
    beforeEach(() => {
      jest.spyOn(fs, 'accessSync').mockImplementation((p) => {
        if (p.endsWith('Dockerfile') || p.endsWith('docker-compose.yml')) return true;
        throw new Error('not found');
      });
    });
    afterEach(() => jest.restoreAllMocks());

    it('detects Dockerfile and docker-compose.yml', () => {
      const files = detectDockerFiles('/fake/project');
      expect(files).toContain('Dockerfile');
      expect(files).toContain('docker-compose.yml');
    });

    it('returns empty array if no files found', () => {
      jest.spyOn(fs, 'accessSync').mockImplementation(() => { throw new Error('not found'); });
      expect(detectDockerFiles('/fake/project')).toEqual([]);
    });
  });

  describe('readDockerfiles', () => {
    beforeEach(() => {
      jest.spyOn(fs, 'readFileSync').mockImplementation((p) => {
        if (p.endsWith('Dockerfile')) return 'FROM node:22-alpine\nRUN npm ci';
        throw new Error('unreadable');
      });
    });
    afterEach(() => jest.restoreAllMocks());

    it('reads Dockerfile content', () => {
      const res = readDockerfiles('/root', ['Dockerfile', 'not-a-dockerfile.txt']);
      expect(res).toHaveLength(1);
      expect(res[0].content).toContain('FROM node:22-alpine');
    });

    it('returns empty content if file unreadable', () => {
      jest.spyOn(fs, 'readFileSync').mockImplementation(() => { throw new Error('fail'); });
      const res = readDockerfiles('/root', ['Dockerfile']);
      expect(res[0].content).toBe('');
    });
  });

  describe('extractBaseImages', () => {
    it('extracts unique base images, skips scratch and ARGs', () => {
      const dockerfiles = [
        { content: 'FROM node:22-alpine\nFROM scratch\nFROM $BASE\nFROM buildstage as builder' },
        { content: 'FROM node:22-alpine' },
      ];
      const images = extractBaseImages(dockerfiles);
      expect(images).toEqual(['node:22-alpine']);
    });

    it('returns empty if no FROM lines', () => {
      expect(extractBaseImages([{ content: 'RUN echo hi' }])).toEqual([]);
    });
  });

  describe('dockerfilesUseNpmCi', () => {
    it('returns true if any Dockerfile uses RUN npm ci', () => {
      expect(dockerfilesUseNpmCi([{ content: 'RUN npm ci' }])).toBe(true);
    });
    it('returns false if none use npm ci', () => {
      expect(dockerfilesUseNpmCi([{ content: 'RUN npm install' }])).toBe(false);
    });
  });

  describe('isLockfileDockerIgnored', () => {
    afterEach(() => jest.restoreAllMocks());

    it('returns true if .dockerignore excludes package-lock.json', () => {
      jest.spyOn(fs, 'readFileSync').mockReturnValue('package-lock.json\n');
      expect(isLockfileDockerIgnored('/root')).toBe(true);
    });

    it('returns true if .dockerignore excludes *.lock', () => {
      jest.spyOn(fs, 'readFileSync').mockReturnValue('*.lock\n');
      expect(isLockfileDockerIgnored('/root')).toBe(true);
    });

    it('returns false if .dockerignore does not exist', () => {
      jest.spyOn(fs, 'readFileSync').mockImplementation(() => { throw new Error('no file'); });
      expect(isLockfileDockerIgnored('/root')).toBe(false);
    });

    it('returns false if .dockerignore does not exclude lockfile', () => {
      jest.spyOn(fs, 'readFileSync').mockReturnValue('node_modules\n');
      expect(isLockfileDockerIgnored('/root')).toBe(false);
    });
  });

  describe('formatPreflightReport', () => {
    it('formats skipped report', () => {
      const report = formatPreflightReport({ skipped: true, skipReason: 'No Docker', checks: {}, dockerFiles: [], baseImages: [] });
      expect(report).toContain('⏭️ Skipped');
    });

    it('formats passing report', () => {
      const report = formatPreflightReport({
        passed: true,
        checks: { 'Docker CLI': { passed: true, message: 'ok' } },
        dockerFiles: ['Dockerfile'],
        baseImages: ['node:22-alpine'],
      });
      expect(report).toContain('✅ All Docker pre-flight checks passed.');
    });

    it('formats failing report with issues', () => {
      const report = formatPreflightReport({
        passed: false,
        checks: { 'Docker CLI': { passed: false, message: 'fail', issues: ['not found'] } },
        dockerFiles: ['Dockerfile'],
        baseImages: [],
      });
      expect(report).toContain('❌ **Docker CLI**: fail');
      expect(report).toContain('not found');
      expect(report).toContain('⚠️ Some Docker pre-flight checks failed');
    });
  });
});

describe('Step0dDockerPreflight class', () => {
  let step, mockExecutor, mockBacklog;

  beforeEach(() => {
    mockExecutor = {
      execute: jest.fn(),
    };
    mockBacklog = { saveStepSummary: jest.fn().mockResolvedValue() };
    step = new Step0dDockerPreflight({ executor: mockExecutor, backlog: mockBacklog });
    jest.spyOn(fs, 'accessSync').mockImplementation((p) => {
      if (p.endsWith('Dockerfile')) return true;
      throw new Error('not found');
    });
    jest.spyOn(fs, 'readFileSync').mockImplementation((p) => {
      if (p.endsWith('Dockerfile')) return 'FROM node:22-alpine\nRUN npm ci';
      if (p.endsWith('.dockerignore')) throw new Error('no file');
      if (p.endsWith('package-lock.json')) return '{"lockfileVersion":2}';
      throw new Error('not found');
    });
    jest.spyOn(fs, 'existsSync').mockImplementation((p) => p.endsWith('package-lock.json'));
  });

  afterEach(() => jest.restoreAllMocks());

  it('skips when no Docker files found', async () => {
    jest.spyOn(fs, 'accessSync').mockImplementation(() => { throw new Error('not found'); });
    const result = await step.execute('/root');
    expect(result.skipped).toBe(true);
    expect(result.success).toBe(true);
    expect(mockBacklog.saveStepSummary).toHaveBeenCalled();
  });

  it('passes all checks (happy path)', async () => {
    mockExecutor.execute
      .mockResolvedValueOnce({ stdout: 'Docker version 25.0.0' }) // docker --version
      .mockResolvedValueOnce({ stdout: '25.0.0' }) // docker info
      .mockResolvedValueOnce({ stdout: `${6 * 1024 * 1024}` }) // df -k
      .mockResolvedValueOnce({}) // docker manifest inspect
      .mockResolvedValueOnce({}); // npm install --dry-run

    // validateLockfileStructure returns { issues: [] }
    jest.spyOn(require('../../src/steps/step_09_dependencies.js'), 'validateLockfileStructure').mockReturnValue({ issues: [] });

    const result = await step.execute('/root');
    expect(result.passed).toBe(true);
    expect(result.success).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.dockerFiles).toContain('Dockerfile');
    expect(mockBacklog.saveStepSummary).toHaveBeenCalled();
  });

  it('warns if Docker CLI is missing', async () => {
    mockExecutor.execute
      .mockRejectedValueOnce(new Error('not found')) // docker --version
      .mockResolvedValueOnce({ stdout: '25.0.0' }) // docker info
      .mockResolvedValueOnce({ stdout: `${6 * 1024 * 1024}` }) // df -k
      .mockResolvedValueOnce({}); // docker manifest inspect

    jest.spyOn(require('../../src/steps/step_09_dependencies.js'), 'validateLockfileStructure').mockReturnValue({ issues: [] });

    const result = await step.execute('/root');
    expect(result.passed).toBe(false);
    expect(result.issues).toContain('Docker CLI not available');
  });

  it('warns if Docker daemon is not running', async () => {
    mockExecutor.execute
      .mockResolvedValueOnce({ stdout: 'Docker version 25.0.0' }) // docker --version
      .mockRejectedValueOnce({ stderr: 'permission denied' }) // docker info
      .mockResolvedValueOnce({ stdout: `${6 * 1024 * 1024}` }) // df -k
      .mockResolvedValueOnce({}); // docker manifest inspect

    jest.spyOn(require('../../src/steps/step_09_dependencies.js'), 'validateLockfileStructure').mockReturnValue({ issues: [] });

    const result = await step.execute('/root');
    expect(result.passed).toBe(false);
    expect(result.issues).toContain('Docker daemon not running');
  });

  it('warns if disk space is low', async () => {
    mockExecutor.execute
      .mockResolvedValueOnce({ stdout: 'Docker version 25.0.0' }) // docker --version
      .mockResolvedValueOnce({ stdout: '25.0.0' }) // docker info
      .mockResolvedValueOnce({ stdout: `${1 * 1024 * 1024}` }) // df -k (1GB)
      .mockResolvedValueOnce({}); // docker manifest inspect

    jest.spyOn(require('../../src/steps/step_09_dependencies.js'), 'validateLockfileStructure').mockReturnValue({ issues: [] });

    const result = await step.execute('/root');
    expect(result.passed).toBe(false);
    expect(result.issues).toContain('Low disk space for Docker');
  });

  it('warns if base image is unreachable', async () => {
    mockExecutor.execute
      .mockResolvedValueOnce({ stdout: 'Docker version 25.0.0' }) // docker --version
      .mockResolvedValueOnce({ stdout: '25.0.0' }) // docker info
      .mockResolvedValueOnce({ stdout: `${6 * 1024 * 1024}` }) // df -k
      .mockRejectedValueOnce(new Error('unreachable')); // docker manifest inspect

    jest.spyOn(require('../../src/steps/step_09_dependencies.js'), 'validateLockfileStructure').mockReturnValue({ issues: [] });

    const result = await step.execute('/root');
    expect(result.passed).toBe(false);
    expect(result.issues).toContain('One or more base images unreachable');
  });

  it('warns if lockfile is missing', async () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(false);
    mockExecutor.execute
      .mockResolvedValueOnce({ stdout: 'Docker version 25.0.0' }) // docker --version
      .mockResolvedValueOnce({ stdout: '25.0.0' }) // docker info
      .mockResolvedValueOnce({ stdout: `${6 * 1024 * 1024}` }) // df -k
      .mockResolvedValueOnce({}); // docker manifest inspect

    jest.spyOn(require('../../src/steps/step_09_dependencies.js'), 'validateLockfileStructure').mockReturnValue({ issues: [] });

    const result = await step.execute('/root');
    expect(result.passed).toBe(false);
    expect(result.issues).toContain('package-lock.json incompatible with npm ci inside Docker');
  });

  it('warns if .dockerignore excludes lockfile', async () => {
    jest.spyOn(fs, 'readFileSync').mockImplementation((p) => {
      if (p.endsWith('.dockerignore')) return 'package-lock.json\n';
      if (p.endsWith('Dockerfile')) return 'FROM node:22-alpine\nRUN npm ci';
      if (p.endsWith('package-lock.json')) return '{"lockfileVersion":2}';
      throw new Error('not found');
    });
    mockExecutor.execute
      .mockResolvedValueOnce({ stdout: 'Docker version 25.0.0' }) // docker --version
      .mockResolvedValueOnce({ stdout: '25.0.0' }) // docker info
      .mockResolvedValueOnce({ stdout: `${6 * 1024 * 1024}` }) // df -k
      .mockResolvedValueOnce({}); // docker manifest inspect

    jest.spyOn(require('../../src/steps/step_09_dependencies.js'), 'validateLockfileStructure').mockReturnValue({ issues: [] });

    const result = await step.execute('/root');
    expect(result.passed).toBe(false);
    expect(result.issues).toContain('.dockerignore excludes package-lock.json');
  });

  it('returns error on unexpected failure', async () => {
    jest.spyOn(fs, 'accessSync').mockImplementation(() => { throw new Error('fail'); });
    jest.spyOn(fs, 'readFileSync').mockImplementation(() => { throw new Error('fail'); });
    mockExecutor.execute.mockImplementation(() => { throw new Error('fail'); });
    const result = await step.execute('/root');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
