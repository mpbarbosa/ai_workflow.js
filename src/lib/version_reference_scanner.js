/**
 * Shared helpers for extracting current-state version references from markdown.
 *
 * The documentation steps must distinguish between:
 * - current package/document version claims (actionable for mismatch checks)
 * - historical markers such as "Since:", changelog release headings, upstream
 *   dependency versions, and documentation snapshot labels
 *
 * @module lib/version_reference_scanner
 */

const VERSION_TOKEN_PATTERN =
  /(^|[^A-Za-z0-9])(?<version>v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[A-Za-z0-9.-]+)?)(?=$|[^A-Za-z0-9])/g;

const CURRENT_VERSION_CUE_PATTERN =
  /\b(?:current version|documentation version|package version|release version|version|release)\b/iu;

const HISTORICAL_VERSION_CUE_PATTERN =
  /\b(?:since|introduced in|introduced|added in|available since|upstream version|upstream package version|documentation snapshot|snapshot|historical|archived|deprecated as of|as of)\b/iu;

const HISTORICAL_VERSION_HEADING_PATTERN =
  /^\s{0,3}#{1,6}\s*(?:\[[^\]]*v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[A-Za-z0-9.-]+)?[^\]]*\]|release\b\s+v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[A-Za-z0-9.-]+)?\b|v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[A-Za-z0-9.-]+)?\b(?:\s*[-–—]|$))/iu;

const MARKDOWN_FENCE_PATTERN = /^\s*```/u;
const MARKDOWN_HEADING_PATTERN = /^\s{0,3}#{1,6}\s+/u;

function normalizeLineForVersionScan(line) {
  return String(line ?? '')
    .replace(/[*`]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim()
    .toLowerCase();
}

function extractVersionTokensFromLine(line) {
  return Array.from(
    String(line ?? '').matchAll(VERSION_TOKEN_PATTERN),
    (match) => match.groups?.version
  ).filter(Boolean);
}

function isCurrentVersionHeading(line, versions) {
  if (!MARKDOWN_HEADING_PATTERN.test(line) || versions.length === 0) {
    return false;
  }

  const headingText = String(line).replace(MARKDOWN_HEADING_PATTERN, '').trim();
  const withoutVersions = versions.reduce(
    (current, version) => current.replace(version, ' ').replace(version.replace(/^v/u, ''), ' '),
    headingText
  );

  return /[A-Za-z]/u.test(withoutVersions);
}

export function stripUrlsForVersionScan(content) {
  return String(content ?? '')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/giu, '$1')
    .replace(/https?:\/\/\S+/giu, '');
}

/**
 * Extract version strings that are framed as current-state metadata or headings.
 *
 * Historical markers such as changelog release headings, "Since:" labels,
 * upstream dependency version labels, and documentation snapshots are ignored.
 *
 * @param {string} content - Markdown content
 * @returns {string[]} Unique version strings that should participate in current-version checks
 */
export function extractCurrentVersionReferences(content) {
  const sanitized = stripUrlsForVersionScan(content);
  const found = new Set();
  let inFence = false;

  for (const rawLine of sanitized.split('\n')) {
    if (MARKDOWN_FENCE_PATTERN.test(rawLine)) {
      inFence = !inFence;
      continue;
    }

    if (inFence) {
      continue;
    }

    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    if (HISTORICAL_VERSION_HEADING_PATTERN.test(line)) {
      continue;
    }

    const versions = extractVersionTokensFromLine(line);
    if (versions.length === 0) {
      continue;
    }

    const normalized = normalizeLineForVersionScan(line);
    if (HISTORICAL_VERSION_CUE_PATTERN.test(normalized)) {
      continue;
    }

    if (!CURRENT_VERSION_CUE_PATTERN.test(normalized) && !isCurrentVersionHeading(line, versions)) {
      continue;
    }

    versions.forEach((version) => found.add(version));
  }

  return [...found];
}
