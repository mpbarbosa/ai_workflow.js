import os from 'os';
import { execSync } from 'child_process';
import { SystemError } from '../utils/errors.js';

/**
 * Operating system types
 */
export const OS = {
  LINUX: 'linux',
  MACOS: 'darwin',
  WINDOWS: 'win32',
  UNKNOWN: 'unknown',
};

/**
 * Package manager types
 */
export const PackageManager = {
  APT: 'apt',
  PACMAN: 'pacman',
  DNF: 'dnf',
  ZYPPER: 'zypper',
  BREW: 'brew',
  CHOCOLATEY: 'choco',
  WINGET: 'winget',
  UNKNOWN: 'unknown',
};

/**
 * Detect the current operating system
 * @returns {string} OS constant
 */
export function detectOS() {
  const platform = os.platform();
  return platform === 'darwin'
    ? OS.MACOS
    : platform === 'win32'
      ? OS.WINDOWS
      : platform === 'linux'
        ? OS.LINUX
        : OS.UNKNOWN;
}

/**
 * Detect the system package manager
 * @returns {string} PackageManager constant
 */
export function detectPackageManager() {
  const osType = detectOS();

  try {
    switch (osType) {
      case OS.LINUX:
        return detectLinuxPackageManager();
      case OS.MACOS:
        return commandExists('brew') ? PackageManager.BREW : PackageManager.UNKNOWN;
      case OS.WINDOWS:
        return detectWindowsPackageManager();
      default:
        return PackageManager.UNKNOWN;
    }
  } catch (error) {
    throw new SystemError(`Failed to detect package manager: ${error.message}`);
  }
}

/**
 * Detect Linux package manager
 */
function detectLinuxPackageManager() {
  if (commandExists('apt-get')) return PackageManager.APT;
  if (commandExists('pacman')) return PackageManager.PACMAN;
  if (commandExists('dnf')) return PackageManager.DNF;
  if (commandExists('zypper')) return PackageManager.ZYPPER;
  return PackageManager.UNKNOWN;
}

/**
 * Detect Windows package manager
 */
function detectWindowsPackageManager() {
  if (commandExists('winget')) return PackageManager.WINGET;
  if (commandExists('choco')) return PackageManager.CHOCOLATEY;
  return PackageManager.UNKNOWN;
}

/**
 * Check if a command exists on the system
 * @param {string} command - Command to check
 * @returns {boolean} true if command exists
 */
export function commandExists(command) {
  try {
    const checkCmd = os.platform() === 'win32' ? `where ${command}` : `command -v ${command}`;
    execSync(checkCmd, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get system information
 * @returns {object} System details
 */
export function getSystemInfo() {
  return {
    platform: os.platform(),
    os: detectOS(),
    arch: os.arch(),
    release: os.release(),
    hostname: os.hostname(),
    cpus: os.cpus().length,
    memory: {
      total: os.totalmem(),
      free: os.freemem(),
    },
    packageManager: detectPackageManager(),
  };
}

export default {
  OS,
  PackageManager,
  detectOS,
  detectPackageManager,
  commandExists,
  getSystemInfo,
};
