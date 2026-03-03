/**
 * Shell Command Executor
 * @module core/executor
 * @description Re-exports executor from olinda_shell_interface.js (GitHub CDN install).
 * @see https://github.com/mpbarbosa/olinda_shell_interface.js
 */

export { execute, executeStream, executeSudo } from 'olinda_shell_interface.js/core/executor';

export { execute as default } from 'olinda_shell_interface.js/core/executor';
