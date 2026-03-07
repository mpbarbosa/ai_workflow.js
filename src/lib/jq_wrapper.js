/**
 * @fileoverview JQ Wrapper Module - Safe JSON operations with jq command
 * @module lib/jq_wrapper
 * @description Re-exports jq_wrapper from olinda_shell_interface.js.
 * @see https://github.com/mpbarbosa/olinda_shell_interface.js
 */

export {
  validateJson,
  sanitizeArgjsonValue,
  parseJqArguments,
  validateArgjsonPairs,
  buildJqCommand,
  JqExecutionError,
  JqWrapper,
} from 'olinda_shell_interface.js/core/jq_wrapper';
