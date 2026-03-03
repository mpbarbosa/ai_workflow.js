/**
 * Tests for core/system.js
 * Verifies re-exports from olinda_shell_interface.js behave correctly.
 * Ported from: https://github.com/mpbarbosa/olinda_shell_interface.js/blob/main/test/core/system.test.ts
 */

import os from 'os';
import { jest } from '@jest/globals';
import {
  OS,
  PackageManager,
  detectOS,
  detectPackageManager,
  commandExists,
  getSystemInfo,
  SystemError,
} from '../../src/core/system.js';

// ─── OS constant ─────────────────────────────────────────────────────────────

describe('OS', () => {
  it('has LINUX value', () => expect(OS.LINUX).toBe('linux'));
  it('has MACOS value', () => expect(OS.MACOS).toBe('darwin'));
  it('has WINDOWS value', () => expect(OS.WINDOWS).toBe('win32'));
  it('has UNKNOWN value', () => expect(OS.UNKNOWN).toBe('unknown'));
});

// ─── PackageManager constant ──────────────────────────────────────────────────

describe('PackageManager', () => {
  it('has APT value', () => expect(PackageManager.APT).toBe('apt'));
  it('has PACMAN value', () => expect(PackageManager.PACMAN).toBe('pacman'));
  it('has DNF value', () => expect(PackageManager.DNF).toBe('dnf'));
  it('has ZYPPER value', () => expect(PackageManager.ZYPPER).toBe('zypper'));
  it('has BREW value', () => expect(PackageManager.BREW).toBe('brew'));
  it('has CHOCOLATEY value', () => expect(PackageManager.CHOCOLATEY).toBe('choco'));
  it('has WINGET value', () => expect(PackageManager.WINGET).toBe('winget'));
  it('has UNKNOWN value', () => expect(PackageManager.UNKNOWN).toBe('unknown'));
});

// ─── detectOS ────────────────────────────────────────────────────────────────

describe('detectOS', () => {
  afterEach(() => jest.restoreAllMocks());

  it('returns a known OS constant', () => {
    expect(Object.values(OS)).toContain(detectOS());
  });

  it('returns OS.LINUX when platform is linux', () => {
    jest.spyOn(os, 'platform').mockReturnValue('linux');
    expect(detectOS()).toBe(OS.LINUX);
  });

  it('returns OS.MACOS when platform is darwin', () => {
    jest.spyOn(os, 'platform').mockReturnValue('darwin');
    expect(detectOS()).toBe(OS.MACOS);
  });

  it('returns OS.WINDOWS when platform is win32', () => {
    jest.spyOn(os, 'platform').mockReturnValue('win32');
    expect(detectOS()).toBe(OS.WINDOWS);
  });

  it('returns OS.UNKNOWN for an unrecognized platform', () => {
    jest.spyOn(os, 'platform').mockReturnValue('freebsd');
    expect(detectOS()).toBe(OS.UNKNOWN);
  });
});

// ─── commandExists ───────────────────────────────────────────────────────────

describe('commandExists', () => {
  it('returns true for a known command (node)', () => {
    expect(commandExists('node')).toBe(true);
  });

  it('returns false for a nonexistent command', () => {
    expect(commandExists('__no_such_cmd_xyz__')).toBe(false);
  });

  it('returns a boolean', () => {
    expect(typeof commandExists('node')).toBe('boolean');
  });
});

// ─── detectPackageManager ────────────────────────────────────────────────────

describe('detectPackageManager', () => {
  afterEach(() => jest.restoreAllMocks());

  it('returns a known PackageManager constant', () => {
    expect(Object.values(PackageManager)).toContain(detectPackageManager());
  });

  it('returns UNKNOWN for an unrecognized OS', () => {
    jest.spyOn(os, 'platform').mockReturnValue('freebsd');
    expect(detectPackageManager()).toBe(PackageManager.UNKNOWN);
  });

  it('returns a valid constant on macOS', () => {
    jest.spyOn(os, 'platform').mockReturnValue('darwin');
    expect(Object.values(PackageManager)).toContain(detectPackageManager());
  });
});

// ─── getSystemInfo ───────────────────────────────────────────────────────────

describe('getSystemInfo', () => {
  let info;

  beforeAll(() => {
    info = getSystemInfo();
  });

  it('returns an object', () => {
    expect(typeof info).toBe('object');
    expect(info).not.toBeNull();
  });

  it('has a string platform', () => expect(typeof info.platform).toBe('string'));
  it('has a known os constant', () => expect(Object.values(OS)).toContain(info.os));
  it('has a string arch', () => expect(typeof info.arch).toBe('string'));
  it('has a string release', () => expect(typeof info.release).toBe('string'));
  it('has a string hostname', () => expect(typeof info.hostname).toBe('string'));
  it('has a numeric cpus count > 0', () => {
    expect(typeof info.cpus).toBe('number');
    expect(info.cpus).toBeGreaterThan(0);
  });
  it('has memory.total > 0', () => expect(info.memory.total).toBeGreaterThan(0));
  it('has memory.free >= 0', () => expect(info.memory.free).toBeGreaterThanOrEqual(0));
  it('has a known packageManager constant', () => {
    expect(Object.values(PackageManager)).toContain(info.packageManager);
  });
});

// ─── SystemError ─────────────────────────────────────────────────────────────

describe('SystemError', () => {
  it('is instanceof Error', () => {
    expect(new SystemError('msg')).toBeInstanceOf(Error);
  });

  it('has name SystemError', () => {
    expect(new SystemError('msg').name).toBe('SystemError');
  });

  it('carries the message', () => {
    expect(new SystemError('boom').message).toBe('boom');
  });
});
