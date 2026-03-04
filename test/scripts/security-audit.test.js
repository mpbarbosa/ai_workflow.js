// test/security-audit.test.js

import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';

jest.mock('fs/promises');
jest.mock('path');
jest.mock('child_process');

const {
  checkHardcodedSecrets,
  checkCommandInjection,
  checkPathTraversal,
  checkDependencies,
  getAllJSFiles,
  generateReport,
  runSecurityAudit,
  findings,
  colors,
} = await import('../scripts/security-audit.js');

describe('security-audit.js', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    findings.critical = [];
    findings.high = [];
    findings.medium = [];
    findings.low = [];
    findings.info = [];
  });

  describe('checkHardcodedSecrets', () => {
    it('should detect hardcoded secrets in JS files (happy path)', async () => {
      fs.readFile.mockResolvedValueOnce("api_key = '12345'\npassword = 'secret'");
      path.relative.mockReturnValue('src/file.js');
      getAllJSFiles.mockResolvedValue(['src/file.js']);
      await checkHardcodedSecrets();
      expect(findings.high.length).toBeGreaterThan(0);
      expect(findings.high[0].type).toBe('Hardcoded Secret');
    });

    it('should skip commented lines and test data', async () => {
      fs.readFile.mockResolvedValueOnce("// api_key = '12345'\npassword = 'secret'");
      path.relative.mockReturnValue('src/file.js');
      getAllJSFiles.mockResolvedValue(['src/file.js']);
      await checkHardcodedSecrets();
      expect(findings.high.length).toBe(1);
      expect(findings.high[0].description).toMatch(/Password/);
    });

    it('should handle no secrets found', async () => {
      fs.readFile.mockResolvedValueOnce("const x = 1;");
      path.relative.mockReturnValue('src/file.js');
      getAllJSFiles.mockResolvedValue(['src/file.js']);
      await checkHardcodedSecrets();
      expect(findings.high.length).toBe(0);
    });
  });

  describe('checkCommandInjection', () => {
    it('should detect command injection risks', async () => {
      fs.readFile.mockResolvedValueOnce("exec('ls ' + userInput)\nspawn('cmd ' + arg)");
      path.relative.mockReturnValue('src/inject.js');
      getAllJSFiles.mockResolvedValue(['src/inject.js']);
      await checkCommandInjection();
      expect(findings.high.length).toBeGreaterThan(0);
      expect(findings.high[0].type).toBe('Command Injection Risk');
    });

    it('should detect use of eval()', async () => {
      fs.readFile.mockResolvedValueOnce("eval(userCode)");
      path.relative.mockReturnValue('src/eval.js');
      getAllJSFiles.mockResolvedValue(['src/eval.js']);
      await checkCommandInjection();
      expect(findings.high.some(f => f.description === 'Use of eval()')).toBe(true);
    });

    it('should handle no command injection found', async () => {
      fs.readFile.mockResolvedValueOnce("console.log('safe')");
      path.relative.mockReturnValue('src/safe.js');
      getAllJSFiles.mockResolvedValue(['src/safe.js']);
      await checkCommandInjection();
      expect(findings.high.length).toBe(0);
    });
  });

  describe('checkPathTraversal', () => {
    it('should detect path traversal risks', async () => {
      fs.readFile.mockResolvedValueOnce("path.join('/base', userInput + '/file')");
      path.relative.mockReturnValue('src/path.js');
      getAllJSFiles.mockResolvedValue(['src/path.js']);
      await checkPathTraversal();
      expect(findings.medium.length).toBeGreaterThan(0);
      expect(findings.medium[0].type).toBe('Path Traversal Risk');
    });

    it('should skip safe usage with projectRoot', async () => {
      fs.readFile.mockResolvedValueOnce("path.join(projectRoot, file)");
      path.relative.mockReturnValue('src/safe.js');
      getAllJSFiles.mockResolvedValue(['src/safe.js']);
      await checkPathTraversal();
      expect(findings.medium.length).toBe(0);
    });

    it('should handle no path traversal found', async () => {
      fs.readFile.mockResolvedValueOnce("const x = 1;");
      path.relative.mockReturnValue('src/none.js');
      getAllJSFiles.mockResolvedValue(['src/none.js']);
      await checkPathTraversal();
      expect(findings.medium.length).toBe(0);
    });
  });

  describe('checkDependencies', () => {
    it('should detect critical and high vulnerabilities', async () => {
      exec.mockImplementation((cmd, opts, cb) => {
        cb(null, JSON.stringify({
          metadata: {
            vulnerabilities: {
              critical: 2,
              high: 3,
              moderate: 1,
              low: 0,
            },
          },
        }));
      });
      await checkDependencies();
      expect(findings.critical.length).toBe(1);
      expect(findings.high.length).toBe(1);
    });

    it('should handle no vulnerabilities', async () => {
      exec.mockImplementation((cmd, opts, cb) => {
        cb(null, JSON.stringify({
          metadata: {
            vulnerabilities: {
              critical: 0,
              high: 0,
              moderate: 0,
              low: 0,
            },
          },
        }));
      });
      await checkDependencies();
      expect(findings.critical.length).toBe(0);
      expect(findings.high.length).toBe(0);
    });

    it('should handle npm audit failure', async () => {
      exec.mockImplementation((cmd, opts, cb) => {
        cb(new Error('fail'), '');
      });
      await checkDependencies();
      // Should not throw, findings unchanged
      expect(findings.critical.length).toBe(0);
      expect(findings.high.length).toBe(0);
    });
  });

  describe('getAllJSFiles', () => {
    it('should recursively find JS files', async () => {
      const dirents = [
        { name: 'a.js', isDirectory: () => false, isFile: () => true },
        { name: 'sub', isDirectory: () => true, isFile: () => false },
      ];
      fs.readdir.mockResolvedValueOnce(dirents);
      fs.readdir.mockResolvedValueOnce([
        { name: 'b.js', isDirectory: () => false, isFile: () => true },
      ]);
      path.join.mockImplementation((...args) => args.join('/'));
      const files = await getAllJSFiles('/root');
      expect(files).toContain('/root/a.js');
      expect(files).toContain('/root/sub/b.js');
    });

    it('should skip hidden directories', async () => {
      const dirents = [
        { name: '.hidden', isDirectory: () => true, isFile: () => false },
        { name: 'file.js', isDirectory: () => false, isFile: () => true },
      ];
      fs.readdir.mockResolvedValueOnce(dirents);
      path.join.mockImplementation((...args) => args.join('/'));
      const files = await getAllJSFiles('/root');
      expect(files).toContain('/root/file.js');
      expect(files).not.toContain('/root/.hidden/file.js');
    });
  });

  describe('generateReport', () => {
    it('should report no issues found', () => {
      findings.critical = [];
      findings.high = [];
      findings.medium = [];
      findings.low = [];
      expect(generateReport()).toBe(0);
    });

    it('should report critical issues and return exit code 2', () => {
      findings.critical = [{ type: 'Dependency Vulnerability', description: 'Critical issue' }];
      expect(generateReport()).toBe(2);
    });

    it('should report high issues and return exit code 1', () => {
      findings.critical = [];
      findings.high = [{ type: 'Hardcoded Secret', description: 'High issue' }];
      expect(generateReport()).toBe(1);
    });

    it('should report medium issues and return exit code 0', () => {
      findings.critical = [];
      findings.high = [];
      findings.medium = [{ type: 'Path Traversal Risk', description: 'Medium issue' }];
      expect(generateReport()).toBe(0);
    });
  });

  describe('runSecurityAudit', () => {
    it('should run all checks and exit with correct code (happy path)', async () => {
      checkHardcodedSecrets.mockResolvedValue();
      checkCommandInjection.mockResolvedValue();
      checkPathTraversal.mockResolvedValue();
      checkDependencies.mockResolvedValue();
      generateReport.mockReturnValue(0);
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
      await runSecurityAudit();
      expect(exitSpy).toHaveBeenCalledWith(0);
      exitSpy.mockRestore();
    });

    it('should handle errors and exit with code 1', async () => {
      checkHardcodedSecrets.mockRejectedValue(new Error('fail'));
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
      await expect(runSecurityAudit()).rejects.toThrow();
      exitSpy.mockRestore();
    });
  });
});
