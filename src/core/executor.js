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
    return {
      execute: (...args) => executorLike.execute(...args),
      executeStream:
        typeof executorLike.executeStream === 'function'
          ? (...args) => executorLike.executeStream(...args)
          : executeStream,
      executeSudo:
        typeof executorLike.executeSudo === 'function'
          ? (...args) => executorLike.executeSudo(...args)
          : executeSudo,
    };
  }

  return {
    execute,
    executeStream,
    executeSudo,
  };
}

export default execute;
