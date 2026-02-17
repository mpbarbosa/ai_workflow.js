#!/usr/bin/env node
/**
 * Security Audit Script
 *
 * Performs automated security checks on the codebase:
 * - Hardcoded secrets/credentials
 * - Command injection vulnerabilities
 * - Path traversal risks
 * - Input validation issues
 * - Dependency vulnerabilities
 *
 * Usage: node scripts/security-audit.js
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

// Security findings
const findings = {
  critical: [],
  high: [],
  medium: [],
  low: [],
  info: [],
};

/**
 * Check for hardcoded secrets
 */
async function checkHardcodedSecrets() {
  console.log(`${colors.cyan}▶${colors.reset} Checking for hardcoded secrets...`);

  const patterns = [
    { pattern: /api[_-]?key\s*=\s*['"][^'"]+['"]/gi, name: 'API Key' },
    { pattern: /password\s*=\s*['"][^'"]+['"]/gi, name: 'Password' },
    { pattern: /token\s*=\s*['"][^'"]+['"]/gi, name: 'Token' },
    { pattern: /secret\s*=\s*['"][^'"]+['"]/gi, name: 'Secret' },
    { pattern: /aws_?access_?key/gi, name: 'AWS Access Key' },
    { pattern: /private_?key/gi, name: 'Private Key' },
  ];

  const files = await getAllJSFiles(path.join(projectRoot, 'src'));
  let issueCount = 0;

  for (const file of files) {
    const content = await fs.readFile(file, 'utf-8');
    const relativePath = path.relative(projectRoot, file);

    for (const { pattern, name } of patterns) {
      const matches = content.match(pattern);
      if (matches) {
        // Filter out comments and test data
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (pattern.test(lines[i]) && !lines[i].trim().startsWith('//')) {
            findings.high.push({
              type: 'Hardcoded Secret',
              file: relativePath,
              line: i + 1,
              description: `Possible hardcoded ${name} detected`,
              code: lines[i].trim().substring(0, 80),
            });
            issueCount++;
          }
        }
      }
    }
  }

  console.log(`  Found ${issueCount} potential secrets\n`);
}

/**
 * Check for command injection vulnerabilities
 */
async function checkCommandInjection() {
  console.log(`${colors.cyan}▶${colors.reset} Checking for command injection...`);

  const dangerousPatterns = [
    { pattern: /exec\s*\([^)]*\+/g, name: 'String concatenation in exec()' },
    { pattern: /spawn\s*\([^)]*\+/g, name: 'String concatenation in spawn()' },
    { pattern: /execSync\s*\([^)]*\+/g, name: 'String concatenation in execSync()' },
    { pattern: /eval\s*\(/g, name: 'Use of eval()' },
  ];

  const files = await getAllJSFiles(path.join(projectRoot, 'src'));
  let issueCount = 0;

  for (const file of files) {
    const content = await fs.readFile(file, 'utf-8');
    const relativePath = path.relative(projectRoot, file);

    for (const { pattern, name } of dangerousPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (pattern.test(lines[i])) {
            findings.high.push({
              type: 'Command Injection Risk',
              file: relativePath,
              line: i + 1,
              description: name,
              code: lines[i].trim().substring(0, 80),
            });
            issueCount++;
          }
        }
      }
    }
  }

  console.log(`  Found ${issueCount} potential command injection risks\n`);
}

/**
 * Check for path traversal vulnerabilities
 */
async function checkPathTraversal() {
  console.log(`${colors.cyan}▶${colors.reset} Checking for path traversal...`);

  const patterns = [
    { pattern: /path\.join\s*\([^)]*\+/g, name: 'String concat in path.join()' },
    { pattern: /fs\.\w+\s*\([^)]*\+/g, name: 'String concat in fs operations' },
  ];

  const files = await getAllJSFiles(path.join(projectRoot, 'src'));
  let issueCount = 0;

  for (const file of files) {
    const content = await fs.readFile(file, 'utf-8');
    const relativePath = path.relative(projectRoot, file);

    for (const { pattern, name } of patterns) {
      const matches = content.match(pattern);
      if (matches) {
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (pattern.test(lines[i]) && !lines[i].includes('projectRoot')) {
            findings.medium.push({
              type: 'Path Traversal Risk',
              file: relativePath,
              line: i + 1,
              description: name,
              code: lines[i].trim().substring(0, 80),
            });
            issueCount++;
          }
        }
      }
    }
  }

  console.log(`  Found ${issueCount} potential path traversal risks\n`);
}

/**
 * Check npm dependencies for vulnerabilities
 */
async function checkDependencies() {
  console.log(`${colors.cyan}▶${colors.reset} Checking npm dependencies...`);

  try {
    const { stdout } = await execAsync('npm audit --json', {
      cwd: projectRoot,
    });

    const auditResult = JSON.parse(stdout);

    if (auditResult.metadata) {
      const { vulnerabilities } = auditResult.metadata;

      console.log(`  Critical: ${vulnerabilities.critical || 0}`);
      console.log(`  High: ${vulnerabilities.high || 0}`);
      console.log(`  Moderate: ${vulnerabilities.moderate || 0}`);
      console.log(`  Low: ${vulnerabilities.low || 0}`);

      if (vulnerabilities.critical > 0) {
        findings.critical.push({
          type: 'Dependency Vulnerability',
          description: `${vulnerabilities.critical} critical vulnerabilities in dependencies`,
          action: 'Run "npm audit fix" to resolve',
        });
      }

      if (vulnerabilities.high > 0) {
        findings.high.push({
          type: 'Dependency Vulnerability',
          description: `${vulnerabilities.high} high vulnerabilities in dependencies`,
          action: 'Run "npm audit fix" to resolve',
        });
      }
    }
  } catch {
    console.log(`  ${colors.yellow}⚠${colors.reset} npm audit failed or found issues`);
  }

  console.log('');
}

/**
 * Recursively get all JS files
 */
async function getAllJSFiles(dir) {
  const files = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory() && !entry.name.startsWith('.')) {
      files.push(...(await getAllJSFiles(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Generate security report
 */
function generateReport() {
  console.log(`${colors.cyan}═══════════════════════════════════${colors.reset}`);
  console.log(`${colors.cyan}       Security Audit Report${colors.reset}`);
  console.log(`${colors.cyan}═══════════════════════════════════${colors.reset}\n`);

  const totalIssues =
    findings.critical.length + findings.high.length + findings.medium.length + findings.low.length;

  if (totalIssues === 0) {
    console.log(`${colors.green}✓ No security issues found!${colors.reset}\n`);
    return 0;
  }

  // Critical issues
  if (findings.critical.length > 0) {
    console.log(`${colors.red}CRITICAL (${findings.critical.length})${colors.reset}`);
    findings.critical.forEach((issue, i) => {
      console.log(`  ${i + 1}. ${issue.type}: ${issue.description}`);
      if (issue.file) console.log(`     ${colors.gray}${issue.file}:${issue.line}${colors.reset}`);
      if (issue.action) console.log(`     ${colors.yellow}→${colors.reset} ${issue.action}`);
    });
    console.log('');
  }

  // High issues
  if (findings.high.length > 0) {
    console.log(`${colors.red}HIGH (${findings.high.length})${colors.reset}`);
    findings.high.slice(0, 10).forEach((issue, i) => {
      console.log(`  ${i + 1}. ${issue.type}: ${issue.description}`);
      if (issue.file) console.log(`     ${colors.gray}${issue.file}:${issue.line}${colors.reset}`);
      if (issue.code) console.log(`     ${colors.gray}${issue.code}${colors.reset}`);
    });
    if (findings.high.length > 10) {
      console.log(`  ${colors.gray}... and ${findings.high.length - 10} more${colors.reset}`);
    }
    console.log('');
  }

  // Medium issues
  if (findings.medium.length > 0) {
    console.log(`${colors.yellow}MEDIUM (${findings.medium.length})${colors.reset}`);
    findings.medium.slice(0, 5).forEach((issue, i) => {
      console.log(`  ${i + 1}. ${issue.type}: ${issue.description}`);
      if (issue.file) console.log(`     ${colors.gray}${issue.file}:${issue.line}${colors.reset}`);
    });
    if (findings.medium.length > 5) {
      console.log(`  ${colors.gray}... and ${findings.medium.length - 5} more${colors.reset}`);
    }
    console.log('');
  }

  console.log(`${colors.cyan}Summary:${colors.reset}`);
  console.log(`  Total issues: ${totalIssues}`);
  console.log(`  Critical: ${findings.critical.length}`);
  console.log(`  High: ${findings.high.length}`);
  console.log(`  Medium: ${findings.medium.length}`);
  console.log(`  Low: ${findings.low.length}\n`);

  // Return exit code based on severity
  if (findings.critical.length > 0) return 2;
  if (findings.high.length > 0) return 1;
  return 0;
}

/**
 * Main audit function
 */
async function runSecurityAudit() {
  console.log(`${colors.cyan}Starting Security Audit...${colors.reset}\n`);

  await checkHardcodedSecrets();
  await checkCommandInjection();
  await checkPathTraversal();
  await checkDependencies();

  const exitCode = generateReport();
  process.exit(exitCode);
}

// Run audit
runSecurityAudit().catch((error) => {
  console.error(`${colors.red}Error:${colors.reset}`, error.message);
  process.exit(1);
});
