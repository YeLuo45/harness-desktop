/**
 * Platform Service - Cross-Platform Abstraction Layer
 * 
 * Provides unified interfaces for path, process, and shell operations
 * across Windows, Linux, and macOS.
 * 
 * @example
 * ```typescript
 * import platform from './services/platform';
 * 
 * // Get platform info
 * const info = platform.getPlatformInfo();
 * console.log(`Running on ${info.platform} (${info.arch})`);
 * 
 * // Use path adapter
 * const nativePath = platform.path.toNativePath('/usr/local/bin');
 * 
 * // Use process adapter
 * const cwd = platform.process.cwd();
 * 
 * // Use shell adapter
 * const shell = platform.shell.getShell();
 * ```
 */

export type {
  Platform,
  Arch,
  PlatformInfo,
  IPathAdapter,
  IProcessAdapter,
  IShellAdapter,
  ShellType,
  ShellInfo,
  DangerousCommand,
  IPlatformImpl,
} from './types';

export {
  detect,
  getArch,
  isWindows,
  isLinux,
  isMacOS,
  is64Bit,
  getPlatformInfo as getOSPlatformInfo,
  getPlatformImpl,
} from './platformDetect';

export { createPathAdapter } from './pathAdapter';
export { createProcessAdapter } from './processAdapter';
export { createShellAdapter } from './shellAdapter';

// Re-export from platformManager for harness platform detection
export {
  platformManager,
  getPlatform,
  getCapabilities,
  supports,
  isDesktop,
  isMobile,
  getPlatformInfo,
  type PlatformType,
  type PlatformCapabilities,
} from './platformManager';

import { getPlatformInfo, getPlatformImpl } from './platformDetect';
import { createPathAdapter } from './pathAdapter';
import { createProcessAdapter } from './processAdapter';
import { createShellAdapter } from './shellAdapter';

// Lazy-loaded singleton instances
let _pathAdapter: ReturnType<typeof createPathAdapter> | null = null;
let _processAdapter: ReturnType<typeof createProcessAdapter> | null = null;
let _shellAdapter: ReturnType<typeof createShellAdapter> | null = null;

const platformService = {
  /**
   * Get comprehensive platform information
   */
  getPlatformInfo,

  /**
   * Get platform implementation (lazy-loaded)
   */
  getPlatformImpl,

  /**
   * Get the path adapter instance (singleton)
   */
  get path() {
    if (!_pathAdapter) {
      _pathAdapter = createPathAdapter();
    }
    return _pathAdapter;
  },

  /**
   * Get the process adapter instance (singleton)
   */
  get process() {
    if (!_processAdapter) {
      _processAdapter = createProcessAdapter();
    }
    return _processAdapter;
  },

  /**
   * Get the shell adapter instance (singleton)
   */
  get shell() {
    if (!_shellAdapter) {
      _shellAdapter = createShellAdapter();
    }
    return _shellAdapter;
  },
};

export default platformService;
