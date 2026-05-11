/**
 * File Isolator - Handles filesystem path validation with whitelist/blacklist
 */

import * as path from 'path';
import { AuditEntry, FileIsolatorConfig, AuditEventType } from './types';

export class FileIsolator {
  private config: FileIsolatorConfig;
  private allowedPaths: Set<string> = new Set();
  private blockedPaths: Set<string> = new Set();

  constructor(config: FileIsolatorConfig) {
    this.config = config;
    this.initializePaths();
  }

  private initializePaths(): void {
    // Normalize and add allowed paths
    if (this.config.allowedPaths) {
      for (const p of this.config.allowedPaths) {
        this.allowedPaths.add(this.normalizePath(p));
      }
    }

    // Normalize and add blocked paths
    if (this.config.blockedPaths) {
      for (const p of this.config.blockedPaths) {
        this.blockedPaths.add(this.normalizePath(p));
      }
    }

    // If working directory is set, add it to allowed paths
    if (this.config.workingDirectory) {
      this.allowedPaths.add(this.normalizePath(this.config.workingDirectory));
    }
  }

  private normalizePath(p: string): string {
    return path.normalize(path.resolve(p));
  }

  /**
   * Check if a path is allowed for access
   */
  isPathAllowed(filePath: string): boolean {
    const normalizedPath = this.normalizePath(filePath);
    const resolvedPath = path.resolve(filePath);

    // If blocked paths are defined, check them first
    if (this.blockedPaths.size > 0) {
      for (const blocked of this.blockedPaths) {
        if (resolvedPath.startsWith(blocked) || normalizedPath.startsWith(blocked)) {
          return false;
        }
      }
    }

    // If allowed paths are defined, check them
    if (this.allowedPaths.size > 0) {
      for (const allowed of this.allowedPaths) {
        if (resolvedPath.startsWith(allowed) || normalizedPath.startsWith(allowed)) {
          return true;
        }
      }
      return false;
    }

    // If no restrictions, allow by default
    return true;
  }

  /**
   * Validate a path and create an audit entry
   */
  validatePath(filePath: string, operation: string, onAudit: (entry: AuditEntry) => void): boolean {
    const normalizedPath = this.normalizePath(filePath);
    const isAllowed = this.isPathAllowed(filePath);

    if (isAllowed) {
      onAudit({
        timestamp: new Date().toISOString(),
        event: 'FILE_ACCESS_ALLOWED' as AuditEventType,
        details: `${operation}: ${normalizedPath}`,
      });
    } else {
      onAudit({
        timestamp: new Date().toISOString(),
        event: 'FILE_ACCESS_DENIED' as AuditEventType,
        details: `${operation} denied: ${normalizedPath}`,
      });
    }

    return isAllowed;
  }

  /**
   * Get the allowed paths list
   */
  getAllowedPaths(): string[] {
    return Array.from(this.allowedPaths);
  }

  /**
   * Get the blocked paths list
   */
  getBlockedPaths(): string[] {
    return Array.from(this.blockedPaths);
  }

  /**
   * Add an allowed path dynamically
   */
  addAllowedPath(p: string): void {
    this.allowedPaths.add(this.normalizePath(p));
  }

  /**
   * Add a blocked path dynamically
   */
  addBlockedPath(p: string): void {
    this.blockedPaths.add(this.normalizePath(p));
  }

  /**
   * Remove an allowed path
   */
  removeAllowedPath(p: string): boolean {
    return this.allowedPaths.delete(this.normalizePath(p));
  }

  /**
   * Remove a blocked path
   */
  removeBlockedPath(p: string): boolean {
    return this.blockedPaths.delete(this.normalizePath(p));
  }
}
