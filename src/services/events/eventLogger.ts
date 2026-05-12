/**
 * Event Logger
 * Records, queries, and clears event logs
 */

import { Event, EventType } from './types';

const eventLogs: Event[] = [];
const MAX_LOGS = 1000;

export interface LogQuery {
  type?: EventType;
  source?: string;
  startTime?: number;
  endTime?: number;
  limit?: number;
  offset?: number;
}

/**
 * Record an event to the log
 */
export function log(event: Event): void {
  eventLogs.push({ ...event, timestamp: event.timestamp ?? Date.now() });
  if (eventLogs.length > MAX_LOGS) {
    eventLogs.shift();
  }
}

/**
 * Query event logs with filters
 */
export function query(options: LogQuery = {}): Event[] {
  const { type, source, startTime, endTime, limit = 100, offset = 0 } = options;

  let results = eventLogs.filter((e) => {
    if (type !== undefined && e.type !== type) return false;
    if (source !== undefined && e.source !== source) return false;
    if (startTime !== undefined && e.timestamp < startTime) return false;
    if (endTime !== undefined && e.timestamp > endTime) return false;
    return true;
  });

  return results.slice(offset, offset + limit);
}

/**
 * Clear all event logs
 */
export function clear(): void {
  eventLogs.length = 0;
}

/**
 * Get total log count
 */
export function size(): number {
  return eventLogs.length;
}
