/**
 * Virtual File System
 * Provides controlled file system access within sandboxed environments
 */

import * as fs from 'fs';
import * as path from 'path';
import { FileEntry } from './types';

export interface FSConfig {
  rootPath: string;
  readOnly: boolean;
  maxFileSize: number; // bytes
  allowedPaths: string[];
  deniedPaths: string[];
}

export class VirtualFileSystem {
  private config: FSConfig;
  private fileCache: Map<string, string> = new Map();

  constructor(config: FSConfig) {
    this.config = config;
  }

  /**
   * Check if a path is allowed access
   */
  isPathAllowed(filePath: string): boolean {
    const normalized = path.normalize(filePath);
    
    // Check denied paths first
    for (const denied of this.config.deniedPaths) {
      if (normalized.startsWith(denied)) return false;
    }

    // Check allowed paths if specified
    if (this.config.allowedPaths.length > 0) {
      return this.config.allowedPaths.some(allowed => normalized.startsWith(allowed));
    }

    return true;
  }

  /**
   * Read a file
   */
  async readFile(filePath: string): Promise<string> {
    if (!this.isPathAllowed(filePath)) {
      throw new Error(`Access denied: ${filePath}`);
    }

    const fullPath = path.join(this.config.rootPath, filePath);
    
    if (this.fileCache.has(fullPath)) {
      return this.fileCache.get(fullPath)!;
    }

    return new Promise((resolve, reject) => {
      fs.readFile(fullPath, 'utf8', (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });
  }

  /**
   * Write to a file
   */
  async writeFile(filePath: string, content: string): Promise<void> {
    if (!this.isPathAllowed(filePath)) {
      throw new Error(`Access denied: ${filePath}`);
    }

    if (this.config.readOnly) {
      throw new Error('File system is read-only');
    }

    const fullPath = path.join(this.config.rootPath, filePath);
    
    // Check file size limit
    if (content.length > this.config.maxFileSize) {
      throw new Error(`File exceeds maximum size of ${this.config.maxFileSize} bytes`);
    }

    return new Promise((resolve, reject) => {
      fs.writeFile(fullPath, content, 'utf8', (err) => {
        if (err) reject(err);
        else {
          this.fileCache.set(fullPath, content);
          resolve();
        }
      });
    });
  }

  /**
   * List directory contents
   */
  async listDir(dirPath: string): Promise<FileEntry[]> {
    if (!this.isPathAllowed(dirPath)) {
      throw new Error(`Access denied: ${dirPath}`);
    }

    const fullPath = path.join(this.config.rootPath, dirPath);

    return new Promise((resolve, reject) => {
      fs.readdir(fullPath, { withFileTypes: true }, async (err, entries) => {
        if (err) {
          reject(err);
          return;
        }

        const fileEntries: FileEntry[] = [];
        
        for (const entry of entries) {
          const entryPath = path.join(fullPath, entry.name);
          
          try {
            const stats = await this.stat(entryPath);
            fileEntries.push({
              path: entryPath,
              type: entry.isDirectory() ? 'directory' : entry.isSymbolicLink() ? 'symlink' : 'file',
              ...stats
            });
          } catch {
            // Skip files we can't stat
          }
        }

        resolve(fileEntries);
      });
    });
  }

  /**
   * Get file/directory stats
   */
  async stat(filePath: string): Promise<{ size: number; permissions: string; modifiedAt: Date; createdAt: Date }> {
    const fullPath = path.join(this.config.rootPath, filePath);

    return new Promise((resolve, reject) => {
      fs.stat(fullPath, (err, stats) => {
        if (err) {
          reject(err);
          return;
        }
        resolve({
          size: stats.size,
          permissions: stats.mode.toString(8),
          modifiedAt: stats.mtime,
          createdAt: stats.birthtime
        });
      });
    });
  }

  /**
   * Check if path exists
   */
  async exists(filePath: string): Promise<boolean> {
    const fullPath = path.join(this.config.rootPath, filePath);
    
    return new Promise((resolve) => {
      fs.access(fullPath, fs.constants.F_OK, (err) => {
        resolve(!err);
      });
    });
  }

  /**
   * Delete a file
   */
  async deleteFile(filePath: string): Promise<void> {
    if (!this.isPathAllowed(filePath)) {
      throw new Error(`Access denied: ${filePath}`);
    }

    if (this.config.readOnly) {
      throw new Error('File system is read-only');
    }

    const fullPath = path.join(this.config.rootPath, filePath);

    return new Promise((resolve, reject) => {
      fs.unlink(fullPath, (err) => {
        if (err) reject(err);
        else {
          this.fileCache.delete(fullPath);
          resolve();
        }
      });
    });
  }

  /**
   * Create a directory
   */
  async createDir(dirPath: string): Promise<void> {
    if (!this.isPathAllowed(dirPath)) {
      throw new Error(`Access denied: ${dirPath}`);
    }

    if (this.config.readOnly) {
      throw new Error('File system is read-only');
    }

    const fullPath = path.join(this.config.rootPath, dirPath);

    return new Promise((resolve, reject) => {
      fs.mkdir(fullPath, { recursive: true }, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Copy a file
   */
  async copyFile(src: string, dest: string): Promise<void> {
    if (!this.isPathAllowed(src) || !this.isPathAllowed(dest)) {
      throw new Error(`Access denied`);
    }

    if (this.config.readOnly) {
      throw new Error('File system is read-only');
    }

    const srcPath = path.join(this.config.rootPath, src);
    const destPath = path.join(this.config.rootPath, dest);

    return new Promise((resolve, reject) => {
      fs.copyFile(srcPath, destPath, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Clear the file cache
   */
  clearCache(): void {
    this.fileCache.clear();
  }
}

/**
 * Default FS config for sandboxed environments
 */
export function createSandboxFS(rootPath: string): VirtualFileSystem {
  return new VirtualFileSystem({
    rootPath,
    readOnly: false,
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedPaths: [rootPath],
    deniedPaths: ['/etc', '/root', '/home']
  });
}
