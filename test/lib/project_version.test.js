import path from 'path';
import { tmpdir } from 'os';
import { mkdtemp, mkdir, writeFile } from 'fs/promises';
import { readProjectVersionFromPackage } from '../../src/lib/project_version.js';

describe('readProjectVersionFromPackage', () => {
  test('returns null when workingDirectory is missing', async () => {
    await expect(readProjectVersionFromPackage(null)).resolves.toBeNull();
    await expect(readProjectVersionFromPackage('')).resolves.toBeNull();
  });

  test('reads and trims version from package.json', async () => {
    const projectDir = await mkdtemp(path.join(tmpdir(), 'project-version-'));
    await writeFile(
      path.join(projectDir, 'package.json'),
      JSON.stringify({ name: 'demo-project', version: ' 1.2.3 ' }),
      'utf8'
    );

    await expect(readProjectVersionFromPackage(projectDir)).resolves.toBe('1.2.3');
  });

  test('returns null when package.json is missing', async () => {
    const projectDir = await mkdtemp(path.join(tmpdir(), 'project-version-missing-'));

    await expect(readProjectVersionFromPackage(projectDir)).resolves.toBeNull();
  });

  test('returns null when package.json has no usable version', async () => {
    const projectDir = await mkdtemp(path.join(tmpdir(), 'project-version-empty-'));
    await writeFile(
      path.join(projectDir, 'package.json'),
      JSON.stringify({ name: 'demo-project', version: '   ' }),
      'utf8'
    );

    await expect(readProjectVersionFromPackage(projectDir)).resolves.toBeNull();
  });

  test('returns null when package.json is invalid JSON', async () => {
    const projectDir = await mkdtemp(path.join(tmpdir(), 'project-version-invalid-'));
    await writeFile(path.join(projectDir, 'package.json'), '{ invalid json }', 'utf8');

    await expect(readProjectVersionFromPackage(projectDir)).resolves.toBeNull();
  });

  test('returns null when package.json cannot be read', async () => {
    const projectDir = await mkdtemp(path.join(tmpdir(), 'project-version-unreadable-'));
    await mkdir(path.join(projectDir, 'package.json'));

    await expect(readProjectVersionFromPackage(projectDir)).resolves.toBeNull();
  });
});
