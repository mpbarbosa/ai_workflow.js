/**
 * @fileoverview File Operations Module - File system operations with safe path validation
 * @module lib/file_operations
 * @description Re-exports file_operations from olinda_shell_interface.js.
 * @see https://github.com/mpbarbosa/olinda_shell_interface.js
 */

export {
  validatePath,
  filterByExtension,
  filterByPattern,
  sortByModificationTime,
  buildFileMetadata,
  calculateRelativePath,
  FileOperations,
} from 'olinda_shell_interface.js/core/file_operations';

export { FileSystemError } from 'olinda_shell_interface.js/utils/errors';
