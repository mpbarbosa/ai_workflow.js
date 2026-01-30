/**
 * Command Executor Module
 * @version 1.0.0
 * @description Shell command execution with dry-run support and output capture
 * @module core/executor
 * Part of: AI Workflow Automation v1.0.0
 */

import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { ExecutionError } from '../utils/errors.js';

const execAsync = promisify(exec);

/**
 * Execute a shell command and return the result
 * @param {string} command - Command to execute
 * @param {object} options - Execution options
 * @returns {Promise<{stdout: string, stderr: string, exitCode: number}>}
 */
export async function execute(command, options = {}) {
  const {
    cwd = process.cwd(),
    env = process.env,
    timeout = 300000, // 5 minutes default
    shell = true,
  } = options;

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd,
      env,
      timeout,
      shell,
      maxBuffer: 10 * 1024 * 1024, // 10MB
    });

    return {
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      exitCode: 0,
    };
  } catch (error) {
    const exitCode = error.code || 1;
    const stdout = error.stdout ? error.stdout.toString().trim() : '';
    const stderr = error.stderr ? error.stderr.toString().trim() : '';

    throw new ExecutionError(`Command failed: ${command}`, exitCode, stdout, stderr);
  }
}

/**
 * Execute a command with streaming output
 * @param {string} command - Command to execute
 * @param {object} options - Execution options
 * @returns {Promise<number>} Exit code
 */
export function executeStream(command, options = {}) {
  return new Promise((resolve, reject) => {
    const { cwd = process.cwd(), env = process.env, onStdout = null, onStderr = null } = options;

    const [cmd, ...args] = command.split(' ');
    const child = spawn(cmd, args, {
      cwd,
      env,
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: true,
    });

    if (onStdout) {
      child.stdout.on('data', (data) => onStdout(data.toString()));
    } else {
      child.stdout.pipe(process.stdout);
    }

    if (onStderr) {
      child.stderr.on('data', (data) => onStderr(data.toString()));
    } else {
      child.stderr.pipe(process.stderr);
    }

    child.on('close', (code) => {
      if (code === 0) {
        resolve(code);
      } else {
        reject(new ExecutionError(`Command failed with exit code ${code}`, code));
      }
    });

    child.on('error', (error) => {
      reject(new ExecutionError(`Failed to execute command: ${error.message}`));
    });
  });
}

/**
 * Execute command with sudo if needed
 * @param {string} command - Command to execute
 * @param {object} options - Execution options
 * @returns {Promise<{stdout: string, stderr: string, exitCode: number}>}
 */
export async function executeSudo(command, options = {}) {
  const needsSudo = process.platform !== 'win32' && process.getuid && process.getuid() !== 0;
  const finalCommand = needsSudo ? `sudo ${command}` : command;
  return execute(finalCommand, options);
}

export default {
  execute,
  executeStream,
  executeSudo,
};
