import fs from 'fs/promises';
import path from 'path';

/**
 * Read the target project's version from package.json.
 *
 * @param {string|null|undefined} workingDirectory - Target project root
 * @returns {Promise<string|null>} Trimmed version string or null when unavailable
 */
export async function readProjectVersionFromPackage(workingDirectory) {
  if (typeof workingDirectory !== 'string' || workingDirectory.trim().length === 0) {
    return null;
  }

  try {
    const pkgRaw = await fs.readFile(path.join(workingDirectory, 'package.json'), 'utf8');
    const liveVersion = JSON.parse(pkgRaw).version;
    if (typeof liveVersion === 'string' && liveVersion.trim()) {
      return liveVersion.trim();
    }
  } catch {
    // package.json absent or unreadable — caller decides fallback behavior
  }

  return null;
}
