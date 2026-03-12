import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

const mockReadFile = jest.fn();
const mockReaddir = jest.fn();
const mockExecAsync = jest.fn();

jest.unstable_mockModule('fs/promises', () => ({
  default: {
    readFile: mockReadFile,
    readdir: mockReaddir,
  },
}));

jest.unstable_mockModule('util', () => ({
  promisify: jest.fn(() => mockExecAsync),
}));

jest.unstable_mockModule('child_process', () => ({
  exec: jest.fn(),
}));

const {
  checkHardcodedSecrets,
  checkCommandInjection,
  checkPathTraversal,
  checkDependencies,
  getAllJSFiles,
  generateReport,
  runSecurityAudit,
  findings,
} = await import('../../scripts/security-audit.js');

describe('security-audit.js', () => {
  let consoleSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    findings.critical.splice(0);
    findings.high.splice(0);
    findings.medium.splice(0);
    findings.low.splice(0);
    findings.info.splice(0);
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('getAllJSFiles', () => {
    it('returns JS files in a flat directory', async () => {
      mockReaddir.mockResolvedValueOnce([
        { name: 'app.js', isDirectory: () => false, isFile: () => true },
        { name: 'readme.md', isDirectory: () => false, isFile: () => true },
      ]);
      const files = await getAllJSFiles('/src');
      expect(files.length).toBe(1);
      expect(files[0]).toContain('app.js');
    });

    it('recursively scans subdirectories', async () => {
      mockReaddir.mockResolvedValueOnce([
        { name: 'lib', isDirectory: () => true, isFile: () => false },
      ]);
      mockReaddir.mockResolvedValueOnce([
        { name: 'helper.js', isDirectory: () => false, isFile: () => true },
      ]);
      const files = await getAllJSFiles('/src');
      expect(files.length).toBe(1);
      expect(files[0]).toContain('helper.js');
    });

    it('skips hidden directories (starting with .)', async () => {
      mockReaddir.mockResolvedValueOnce([
        { name: '.git', isDirectory: () => true, isFile: () => false },
        { name: 'app.js', isDirectory: () => false, isFile: () => true },
      ]);
      const files = await getAllJSFiles('/src');
      expect(files.length).toBe(1);
    });

    it('returns empty array when directory is empty', async () => {
      mockReaddir.mockResolvedValueOnce([]);
      const files = await getAllJSFiles('/empty');
      expect(files).toEqual([]);
    });

    it('accepts an array of directories and combines results', async () => {
      // First dir: /src
      mockReaddir.mockResolvedValueOnce([
        { name: 'app.js', isDirectory: () => false, isFile: () => true },
      ]);
      // Second dir: /scripts
      mockReaddir.mockResolvedValueOnce([
        { name: 'audit.js', isDirectory: () => false, isFile: () => true },
      ]);
      const files = await getAllJSFiles(['/src', '/scripts']);
      expect(files.length).toBe(2);
      expect(files.some((f) => f.includes('app.js'))).toBe(true);
      expect(files.some((f) => f.includes('audit.js'))).toBe(true);
    });

    it('silently skips directories that do not exist (array form)', async () => {
      mockReaddir.mockResolvedValueOnce([
        { name: 'app.js', isDirectory: () => false, isFile: () => true },
      ]);
      // Second dir returns undefined (simulates missing dir with no mock queued)
      const files = await getAllJSFiles(['/src', '/nonexistent']);
      expect(files.length).toBe(1);
      expect(files[0]).toContain('app.js');
    });
  });

  describe('checkHardcodedSecrets', () => {
    it('detects hardcoded API key', async () => {
      mockReaddir.mockResolvedValueOnce([
        { name: 'app.js', isDirectory: () => false, isFile: () => true },
      ]);
      mockReadFile.mockResolvedValueOnce("const api_key = '12345';");
      await checkHardcodedSecrets();
      expect(findings.high.some((f) => f.type === 'Hardcoded Secret')).toBe(true);
    });

    it('detects hardcoded password', async () => {
      mockReaddir.mockResolvedValueOnce([
        { name: 'db.js', isDirectory: () => false, isFile: () => true },
      ]);
      mockReadFile.mockResolvedValueOnce("const password = 'hunter2';");
      await checkHardcodedSecrets();
      expect(findings.high.some((f) => f.description.includes('Password'))).toBe(true);
    });

    it('skips lines starting with //', async () => {
      mockReaddir.mockResolvedValueOnce([
        { name: 'app.js', isDirectory: () => false, isFile: () => true },
      ]);
      mockReadFile.mockResolvedValueOnce("// api_key = 'test'\n// password = 'secret'");
      await checkHardcodedSecrets();
      expect(findings.high.length).toBe(0);
    });

    it('finds no secrets in clean file', async () => {
      mockReaddir.mockResolvedValueOnce([
        { name: 'app.js', isDirectory: () => false, isFile: () => true },
      ]);
      mockReadFile.mockResolvedValueOnce('const x = 1; const y = 2;');
      await checkHardcodedSecrets();
      expect(findings.high.length).toBe(0);
    });

    it('finds no secrets when no JS files exist', async () => {
      mockReaddir.mockResolvedValueOnce([]);
      await checkHardcodedSecrets();
      expect(findings.high.length).toBe(0);
    });
  });

  describe('checkCommandInjection', () => {
    it('detects exec with string concatenation', async () => {
      mockReaddir.mockResolvedValueOnce([
        { name: 'run.js', isDirectory: () => false, isFile: () => true },
      ]);
      mockReadFile.mockResolvedValueOnce("exec('ls ' + userInput)");
      await checkCommandInjection();
      expect(findings.high.some((f) => f.type === 'Command Injection Risk')).toBe(true);
    });

    it('detects use of eval()', async () => {
      mockReaddir.mockResolvedValueOnce([
        { name: 'run.js', isDirectory: () => false, isFile: () => true },
      ]);
      mockReadFile.mockResolvedValueOnce('eval(code)');
      await checkCommandInjection();
      expect(findings.high.some((f) => f.description === 'Use of eval()')).toBe(true);
    });

    it('finds no injection risks in clean code', async () => {
      mockReaddir.mockResolvedValueOnce([
        { name: 'safe.js', isDirectory: () => false, isFile: () => true },
      ]);
      mockReadFile.mockResolvedValueOnce("console.log('hello');");
      await checkCommandInjection();
      expect(findings.high.length).toBe(0);
    });
  });

  describe('checkPathTraversal', () => {
    it('detects string concatenation in path.join', async () => {
      mockReaddir.mockResolvedValueOnce([
        { name: 'file.js', isDirectory: () => false, isFile: () => true },
      ]);
      mockReadFile.mockResolvedValueOnce("path.join('/base', userInput + '/data')");
      await checkPathTraversal();
      expect(findings.medium.some((f) => f.type === 'Path Traversal Risk')).toBe(true);
    });

    it('skips lines that reference projectRoot (safe usage)', async () => {
      mockReaddir.mockResolvedValueOnce([
        { name: 'file.js', isDirectory: () => false, isFile: () => true },
      ]);
      mockReadFile.mockResolvedValueOnce("path.join(projectRoot + dir, 'file')");
      await checkPathTraversal();
      expect(findings.medium.length).toBe(0);
    });

    it('finds no path traversal in clean code', async () => {
      mockReaddir.mockResolvedValueOnce([
        { name: 'safe.js', isDirectory: () => false, isFile: () => true },
      ]);
      mockReadFile.mockResolvedValueOnce("const resolved = path.resolve('/safe/dir');");
      await checkPathTraversal();
      expect(findings.medium.length).toBe(0);
    });
  });

  describe('checkDependencies', () => {
    it('adds critical and high findings from npm audit output', async () => {
      mockExecAsync.mockResolvedValueOnce({
        stdout: JSON.stringify({
          metadata: { vulnerabilities: { critical: 2, high: 3, moderate: 1, low: 0 } },
        }),
      });
      await checkDependencies();
      expect(findings.critical.length).toBe(1);
      expect(findings.high.length).toBe(1);
      expect(findings.critical[0].type).toBe('Dependency Vulnerability');
    });

    it('surfaces moderate vulnerabilities into findings.medium', async () => {
      mockExecAsync.mockResolvedValueOnce({
        stdout: JSON.stringify({
          metadata: { vulnerabilities: { critical: 0, high: 0, moderate: 3, low: 0 } },
        }),
      });
      await checkDependencies();
      expect(findings.medium.length).toBe(1);
      expect(findings.medium[0].type).toBe('Dependency Vulnerability');
      expect(findings.medium[0].description).toContain('3 moderate');
    });

    it('surfaces low vulnerabilities into findings.low', async () => {
      mockExecAsync.mockResolvedValueOnce({
        stdout: JSON.stringify({
          metadata: { vulnerabilities: { critical: 0, high: 0, moderate: 0, low: 5 } },
        }),
      });
      await checkDependencies();
      expect(findings.low.length).toBe(1);
      expect(findings.low[0].type).toBe('Dependency Vulnerability');
      expect(findings.low[0].description).toContain('5 low');
    });

    it('adds no findings when vulnerabilities are zero', async () => {
      mockExecAsync.mockResolvedValueOnce({
        stdout: JSON.stringify({
          metadata: { vulnerabilities: { critical: 0, high: 0, moderate: 0, low: 0 } },
        }),
      });
      await checkDependencies();
      expect(findings.critical.length).toBe(0);
      expect(findings.high.length).toBe(0);
    });

    it('handles npm audit failure gracefully (no throw)', async () => {
      mockExecAsync.mockRejectedValueOnce(new Error('npm audit failed'));
      await expect(checkDependencies()).resolves.toBeUndefined();
      expect(findings.critical.length).toBe(0);
    });

    it('handles missing metadata in audit output gracefully', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: JSON.stringify({}) });
      await expect(checkDependencies()).resolves.toBeUndefined();
    });
  });

  describe('generateReport', () => {
    it('returns 0 and prints success message when no issues', () => {
      expect(generateReport()).toBe(0);
    });

    it('returns 2 when critical issues exist', () => {
      findings.critical.push({
        type: 'Dependency Vulnerability',
        description: 'Critical vuln',
        action: 'Run npm audit fix',
      });
      expect(generateReport()).toBe(2);
    });

    it('returns 1 when only high issues exist', () => {
      findings.high.push({
        type: 'Hardcoded Secret',
        file: 'src/a.js',
        line: 1,
        description: 'Issue',
        code: 'bad code',
      });
      expect(generateReport()).toBe(1);
    });

    it('returns 0 when only medium issues exist', () => {
      findings.medium.push({
        type: 'Path Traversal Risk',
        file: 'src/b.js',
        line: 2,
        description: 'Risk',
      });
      expect(generateReport()).toBe(0);
    });

    it('truncates high issues display beyond 10 entries', () => {
      for (let i = 0; i < 12; i++) {
        findings.high.push({
          type: 'Hardcoded Secret',
          file: `src/f${i}.js`,
          line: i,
          description: `Issue ${i}`,
          code: 'code',
        });
      }
      expect(generateReport()).toBe(1);
    });

    it('truncates medium issues display beyond 5 entries', () => {
      for (let i = 0; i < 7; i++) {
        findings.medium.push({
          type: 'Path Traversal Risk',
          file: `src/f${i}.js`,
          line: i,
          description: `Risk ${i}`,
        });
      }
      expect(generateReport()).toBe(0);
    });
  });

  describe('runSecurityAudit', () => {
    it('runs all checks and exits 0 when no issues found', async () => {
      mockReaddir.mockResolvedValue([]);
      mockExecAsync.mockResolvedValueOnce({
        stdout: JSON.stringify({
          metadata: { vulnerabilities: { critical: 0, high: 0, moderate: 0, low: 0 } },
        }),
      });
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
      await runSecurityAudit();
      expect(exitSpy).toHaveBeenCalledWith(0);
      exitSpy.mockRestore();
    });

    it('exits with code 2 when critical vulnerabilities found', async () => {
      mockReaddir.mockResolvedValue([]);
      mockExecAsync.mockResolvedValueOnce({
        stdout: JSON.stringify({
          metadata: { vulnerabilities: { critical: 1, high: 0, moderate: 0, low: 0 } },
        }),
      });
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
      await runSecurityAudit();
      expect(exitSpy).toHaveBeenCalledWith(2);
      exitSpy.mockRestore();
    });

    it('writes JSON to stdout and exits when --json flag is present', async () => {
      mockReaddir.mockResolvedValue([]);
      mockExecAsync.mockResolvedValueOnce({
        stdout: JSON.stringify({
          metadata: { vulnerabilities: { critical: 0, high: 0, moderate: 0, low: 0 } },
        }),
      });
      process.argv.push('--json');
      const writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
      try {
        await runSecurityAudit();
        expect(writeSpy).toHaveBeenCalledTimes(1);
        const written = writeSpy.mock.calls[0][0];
        const parsed = JSON.parse(written.trim());
        expect(parsed).toHaveProperty('critical');
        expect(parsed).toHaveProperty('high');
        expect(parsed).toHaveProperty('medium');
        expect(parsed).toHaveProperty('low');
        expect(exitSpy).toHaveBeenCalledWith(0);
      } finally {
        process.argv.splice(process.argv.indexOf('--json'), 1);
        writeSpy.mockRestore();
        exitSpy.mockRestore();
      }
    });
  });
});
