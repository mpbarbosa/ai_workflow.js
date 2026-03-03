/**
 * Logger Module
 * @description Re-exports from olinda_utils.js — source of truth is there.
 * @module core/logger
 */

export { Logger, logger, LogLevel, stripAnsi } from 'olinda_utils.js';

import { logger as _logger } from 'olinda_utils.js';
export default _logger;
