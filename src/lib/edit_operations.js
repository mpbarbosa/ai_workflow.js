/**
 * @fileoverview File Editing Operations Module - File content editing utilities
 * @module lib/edit_operations
 * @description Re-exports edit_operations from olinda_shell_interface.js (GitHub CDN install).
 * @see https://github.com/mpbarbosa/olinda_shell_interface.js
 */

export {
  findMatches,
  replaceAll,
  replaceFirst,
  insertAtLine,
  appendText,
  prependText,
  deleteLines,
  extractLines,
  getLineRange,
  replaceLineRange,
  generateDiff,
  formatDiff,
  EditOperations,
} from 'olinda_shell_interface.js/core/edit_operations';

export { FileSystemError } from 'olinda_shell_interface.js/utils/errors';

