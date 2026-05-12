/**
 * Platform Detection Module
 * Detects the current operating system and architecture at runtime
 */

import { Platform, Arch, PlatformInfo } from './types';

const platformString = typeof process !== 'undefined' ? process.platform : 'unknown';
const archString = typeof process !== 'undefined' ? process.arch : 'unknown';

/**
 * Detect the current platform
 */
export function detect(): Platform {
  switch (platformString) {
    case 'win32':
      return Platform.Windows;
    case 'linux':
      return Platform.Linux;
    case 'darwin':
      return Platform.MacOS;
    default:
      return Platform.Unknown;
  }
}

/**
 * Detect the current architecture
 */
export function getArch(): Arch {
  switch (archString) {
    case 'x64':
      return Arch.X64;
    case 'ia32':
    case 'x86':
      return Arch.X86;
    case 'arm64':
      return Arch.Arm64;
    case 'arm':
      return Arch.Arm;
    default:
      return Arch.Unknown;
  }
}

/**
 * Check if running on Windows
 */
export function isWindows(): boolean {
  return detect() === Platform.Windows;
}

/**
 * Check if running on Linux
 */
export function isLinux(): boolean {
  return detect() === Platform.Linux;
}

/**
 * Check if running on macOS
 */
export function isMacOS(): boolean {
  return detect() === Platform.MacOS;
}

/**
 * Check if running on a 64-bit system
 */
export function is64Bit(): boolean {
  const arch = getArch();
  return arch === Arch.X64 || arch === Arch.Arm64;
}

/**
 * Get comprehensive platform information
 */
export function getPlatformInfo(): PlatformInfo {
  const platform = detect();
  const arch = getArch();

  let homedir: string;
  let hostname: string;

  if (typeof process !== 'undefined') {
    homedir = process.env.HOME || process.env.USERPROFILE || process.env.HOMEPATH || '';
    hostname = process.env.HOSTNAME || require('os').hostname();
  } else {
    homedir = '';
    hostname = '';
  }

  return {
    platform,
    arch,
    isWindows: platform === Platform.Windows,
    isLinux: platform === Platform.Linux,
    isMacOS: platform === Platform.MacOS,
    is64Bit: is64Bit(),
    homedir,
    hostname,
    platformString: `${platform}-${arch}`,
  };
}

/**
 * Get the platform implementation factory function
 * This is a lazy-loaded getter to avoid circular dependencies
 */
let _platformImpl: any = null;

export function getPlatformImpl() {
  if (_platformImpl) {
    return _platformImpl;
  }

  // Lazy import to avoid circular dependency issues
  const pathAdapter = require('./pathAdapter').createPathAdapter();
  const processAdapter = require('./processAdapter').createProcessAdapter();
  const shellAdapter = require('./shellAdapter').createShellAdapter();

  _platformImpl = {
    path: pathAdapter,
    process: processAdapter,
    shell: shellAdapter,
  };

  return _platformImpl;
}

export default {
  detect,
  getArch,
  isWindows,
  isLinux,
  isMacOS,
  is64Bit,
  getPlatformInfo,
  getPlatformImpl,
};
