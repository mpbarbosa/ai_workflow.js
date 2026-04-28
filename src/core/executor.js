/**
 * Shell Command Executor
 * @module core/executor
 * @description Re-exports executor from olinda_shell_interface.js (GitHub CDN install).
 * @see https://github.com/mpbarbosa/olinda_shell_interface.js
 */

import { execute, executeStream, executeSudo } from 'olinda_shell_interface.js/core/executor';

export { execute, executeStream, executeSudo };

export function normalizeExecutor(executorLike = execute) {
  if (typeof executorLike === 'function') {
    return {
      execute: executorLike,
      executeStream,
      executeSudo,
    };
  }

  if (executorLike && typeof executorLike.execute === 'function') {
    if (typeof executorLike.executeStream !== 'function') {
      executorLike.executeStream = executeStream;
    }
    if (typeof executorLike.executeSudo !== 'function') {
      executorLike.executeSudo = executeSudo;
    }
    return executorLike;
  }

  return {
    execute,
    executeStream,
    executeSudo,
  };
}

export default execute;
