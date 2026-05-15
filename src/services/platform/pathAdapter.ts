/**
 * Cross-Platform Path Adapter
 * Provides consistent path operations across Windows, Linux, and macOS
 */

import * as path from 'path';
import * as os from 'os';
import { IPathAdapter } from './types';

function createPathAdapter(): IPathAdapter {
  const isWindows = process.platform === 'win32';

  /**
   * Convert a path to the native format for the current platform
   */
  function toNativePath(p: string): string {
    if (isWindows) {
      return toWindowsPath(p);
    }
    return toPosixPath(p);
  }

  /**
   * Convert a path to a POSIX-compatible format (forward slashes)
   */
  function toPosixPath(p: string): string {
    return p.replace(/\\/g, '/');
  }

  /**
   * Convert a Windows-style path to native format
   */
  function toWindowsPath(p: string): string {
    if (!isWindows) {
      return p.replace(/\//g, '\\');
    }
    return p;
  }

  /**
   * Check if a path is absolute
   */
  function isAbsolute(p: string): boolean {
    if (isWindows) {
      // Windows: starts with drive letter (C:\) or UNC (\\)
      return /^[a-zA-Z]:[\\\/]/.test(p) || /^\\\\/.test(p);
    }
    return p.startsWith('/');
  }

  /**
   * Join path segments
   */
  function join(...paths: string[]): string {
    if (isWindows) {
      return paths.map(p => p.replace(/\//g, '\\')).join('\\');
    }
    return paths.join('/');
  }

  /**
   * Get the base name of a path
   */
  function basename(p: string, ext?: string): string {
    const normalized = toPosixPath(p);
    const parts = normalized.split('/');
    const base = parts[parts.length - 1] || '';
    if (ext && base.endsWith(ext)) {
      return base.slice(0, -ext.length);
    }
    return base;
  }

  /**
   * Get the directory name of a path
   */
  function dirname(p: string): string {
    if (isWindows) {
      // Handle Windows paths properly
      const match = p.match(/^([a-zA-Z]:)?(.*)[\\\/][^\\\/]+$/);
      if (match) {
        return match[1] ? match[1] + match[2] : match[2] || '.';
      }
      return '.';
    }
    const normalized = toPosixPath(p);
    const lastSlash = normalized.lastIndexOf('/');
    if (lastSlash === -1) return '.';
    if (lastSlash === 0) return '/';
    return normalized.slice(0, lastSlash);
  }

  /**
   * Get the file extension
   */
  function extname(p: string): string {
    const base = basename(p);
    const lastDot = base.lastIndexOf('.');
    if (lastDot === -1 || lastDot === 0) return '';
    return base.slice(lastDot);
  }

  /**
   * Normalize a path (resolve . and ..)
   */
  function normalize(p: string): string {
    if (isWindows) {
      // Normalize Windows path separators first
      const normalized = p.replace(/\//g, '\\');
      const parts = normalized.split(/[\\\/]+/);
      const result: string[] = [];
      let driveLetter = '';

      for (const part of parts) {
        if (part === '' || part === '.') continue;
        if (part === '..') {
          const last = result[result.length - 1];
          if (last && last !== '..' && !result.includes('..')) {
            result.pop();
          } else if (!isAbsolute(p)) {
            result.push(part);
          }
        } else {
          if (result.length === 0 && /^[a-zA-Z]:$/.test(part)) {
            driveLetter = part + '\\';
          } else {
            result.push(part);
          }
        }
      }

      const normalizedPath = driveLetter + result.join('\\');
      return normalizedPath || (isAbsolute(p) ? driveLetter : '.');
    }

    const normalized = toPosixPath(p);
    const parts = normalized.split('/');
    const result: string[] = [];

    for (const part of parts) {
      if (part === '' || part === '.') continue;
      if (part === '..') {
        const last = result[result.length - 1];
        if (last && last !== '..') {
          result.pop();
        } else if (!isAbsolute(p)) {
          result.push(part);
        }
      } else {
        result.push(part);
      }
    }

    let resultPath = result.join('/');
    if (isAbsolute(p)) {
      resultPath = '/' + resultPath;
    }
    return resultPath || '.';
  }

  /**
   * Resolve to an absolute path
   */
  function resolve(...paths: string[]): string {
    if (paths.length === 0) {
      return process.cwd();
    }

    let resolvedPath = paths[0];
    
    if (isAbsolute(resolvedPath)) {
      return normalize(resolvedPath);
    }

    for (let i = 1; i < paths.length; i++) {
      if (isAbsolute(paths[i])) {
        resolvedPath = paths[i];
        break;
      }
      resolvedPath = join(resolvedPath, paths[i]);
    }

    const cwd = process.cwd();
    return isAbsolute(resolvedPath) 
      ? normalize(resolvedPath) 
      : normalize(join(cwd, resolvedPath));
  }

  /**
   * Get the path to the user's home directory
   */
  function home(): string {
    return os.homedir();
  }

  /**
   * Get the path to a temp directory
   */
  function tmpdir(): string {
    return os.tmpdir();
  }

  return {
    sep: process.platform === 'win32' ? '\\' : '/',
    toNativePath,
    toPosixPath,
    toWindowsPath,
    isAbsolute,
    join,
    basename,
    dirname,
    extname,
    normalize,
    resolve,
    home,
    tmpdir,
  };
}

export { createPathAdapter };
export default createPathAdapter;
