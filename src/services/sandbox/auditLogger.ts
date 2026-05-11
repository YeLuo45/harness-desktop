/**
 * Audit Logger - Append-only audit trail for sandbox operations
 */

import * as fs from 'fs';
import * as path from 'path';
import { AuditEntry, AuditEventType } from './types';

export class AuditLogger {
  private logFilePath: string;
  private fd: number | null = null;
  private buffer: AuditEntry[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private readonly FLUSH_INTERVAL_MS = 1000;
  private readonly MAX_BUFFER_SIZE = 100;

  constructor(logFilePath: string, autoFlush = true) {
    this.logFilePath = logFilePath;
    this.ensureLogDirectory();
    
    if (autoFlush) {
      this.startAutoFlush();
    }
  }

  private ensureLogDirectory(): void {
    const dir = path.dirname(this.logFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private startAutoFlush(): void {
    this.flushInterval = setInterval(() => {
      this.flush();
    }, this.FLUSH_INTERVAL_MS);
  }

  /**
   * Log an audit entry
   */
  log(entry: AuditEntry): void {
    this.buffer.push(entry);
    
    if (this.buffer.length >= this.MAX_BUFFER_SIZE) {
      this.flush();
    }
  }

  /**
   * Log a specific event type with details
   */
  logEvent(event: AuditEventType, details: string, resourceUsage?: AuditEntry['resourceUsage']): void {
    this.log({
      timestamp: new Date().toISOString(),
      event,
      details,
      resourceUsage,
    });
  }

  /**
   * Flush buffered entries to disk (append mode)
   */
  flush(): void {
    if (this.buffer.length === 0) return;

    const entriesToWrite = this.buffer.splice(0, this.buffer.length);
    
    try {
      // Open in append mode if not already open
      if (this.fd === null) {
        this.fd = fs.openSync(this.logFilePath, 'a');
      }

      // Write each entry as a JSON line
      for (const entry of entriesToWrite) {
        const line = JSON.stringify(entry) + '\n';
        fs.writeSync(this.fd, line);
      }
    } catch (error) {
      // Prepend failed entries back to buffer
      this.buffer.unshift(...entriesToWrite);
      throw error;
    }
  }

  /**
   * Close the logger and flush remaining entries
   */
  close(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    this.flush();

    if (this.fd !== null) {
      fs.closeSync(this.fd);
      this.fd = null;
    }
  }

  /**
   * Read all audit entries from the log file
   */
  readAll(): AuditEntry[] {
    if (!fs.existsSync(this.logFilePath)) {
      return [];
    }

    const content = fs.readFileSync(this.logFilePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim() !== '');
    
    return lines.map(line => JSON.parse(line) as AuditEntry);
  }

  /**
   * Get entries filtered by event type
   */
  getEntriesByEvent(event: AuditEventType): AuditEntry[] {
    return this.readAll().filter(entry => entry.event === event);
  }

  /**
   * Get entries within a time range
   */
  getEntriesInTimeRange(startTime: string, endTime: string): AuditEntry[] {
    return this.readAll().filter(entry => {
      return entry.timestamp >= startTime && entry.timestamp <= endTime;
    });
  }

  /**
   * Get statistics for the audit log
   */
  getStatistics(): {
    totalEntries: number;
    eventCounts: Record<AuditEventType, number>;
    timeRange: { start: string; end: string } | null;
  } {
    const entries = this.readAll();
    
    if (entries.length === 0) {
      return {
        totalEntries: 0,
        eventCounts: {} as Record<AuditEventType, number>,
        timeRange: null,
      };
    }

    const eventCounts = {} as Record<AuditEventType, number>;
    for (const entry of entries) {
      eventCounts[entry.event] = (eventCounts[entry.event] || 0) + 1;
    }

    return {
      totalEntries: entries.length,
      eventCounts,
      timeRange: {
        start: entries[0].timestamp,
        end: entries[entries.length - 1].timestamp,
      },
    };
  }

  /**
   * Get the log file path
   */
  getLogFilePath(): string {
    return this.logFilePath;
  }

  /**
   * Check if logger is open
   */
  isOpen(): boolean {
    return this.fd !== null;
  }
}
