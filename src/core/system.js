/**
 * System Information Module
 * @module core/system
 * @description Re-exports system module from olinda_shell_interface.js (GitHub CDN install).
 * @see https://github.com/mpbarbosa/olinda_shell_interface.js
 */

export { OS, PackageManager, detectOS, detectPackageManager, commandExists, getSystemInfo } from 'olinda_shell_interface.js/core/system';

export { SystemError } from 'olinda_shell_interface.js/utils/errors';

import { OS, PackageManager, detectOS, detectPackageManager, commandExists, getSystemInfo } from 'olinda_shell_interface.js/core/system';
export default { OS, PackageManager, detectOS, detectPackageManager, commandExists, getSystemInfo };
