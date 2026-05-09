/**
 * Election Events - P18 Election System
 * 
 * Event handling utilities and event emitter implementation
 * for the multi-agent election system.
 */

import type { ElectionEvent, ElectionEventType } from './electionTypes';

// ============================================================================
// Event Listener Types
// ============================================================================

export type ElectionEventListener = (event: ElectionEvent) => void | Promise<void>;

export interface EventSubscription {
  unsubscribe: () => void;
}

// ============================================================================
// Event Emitter Implementation
// ============================================================================

export class ElectionEventEmitter {
  private listeners: Map<ElectionEventType, Set<ElectionEventListener>>;
  private globalListeners: Set<ElectionEventListener>;
  private eventHistory: ElectionEvent[];

  constructor(maxHistorySize = 100) {
    this.listeners = new Map();
    this.globalListeners = new Set();
    this.eventHistory = [];
  }

  /**
   * Subscribe to all events
   */
  on(listener: ElectionEventListener): EventSubscription {
    this.globalListeners.add(listener);
    return {
      unsubscribe: () => this.globalListeners.delete(listener),
    };
  }

  /**
   * Subscribe to specific event type
   */
  onType(type: ElectionEventType, listener: ElectionEventListener): EventSubscription {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);
    
    return {
      unsubscribe: () => {
        const set = this.listeners.get(type);
        if (set) {
          set.delete(listener);
        }
      },
    };
  }

  /**
   * Subscribe once (auto-unsubscribes after first event)
   */
  once(type: ElectionEventType, listener: ElectionEventListener): EventSubscription {
    const wrappedListener = async (event: ElectionEvent) => {
      await listener(event);
      this.off(type, wrappedListener);
    };
    return this.onType(type, wrappedListener);
  }

  /**
   * Unsubscribe a listener
   */
  off(type: ElectionEventType, listener: ElectionEventListener): void {
    const set = this.listeners.get(type);
    if (set) {
      set.delete(listener);
    }
  }

  /**
   * Remove all listeners
   */
  removeAllListeners(): void {
    this.listeners.clear();
    this.globalListeners.clear();
  }

  /**
   * Emit an event
   */
  emit(event: ElectionEvent): void {
    // Store in history
    this.eventHistory.push(event);
    if (this.eventHistory.length > 100) {
      this.eventHistory.shift();
    }

    // Call type-specific listeners
    const typeListeners = this.listeners.get(event.type);
    if (typeListeners) {
      for (const listener of typeListeners) {
        try {
          listener(event);
        } catch (error) {
          console.error(`Error in event listener for ${event.type}:`, error);
        }
      }
    }

    // Call global listeners
    for (const listener of this.globalListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error(`Error in global event listener:`, error);
      }
    }
  }

  /**
   * Get event history
   */
  getHistory(type?: ElectionEventType): ElectionEvent[] {
    if (type) {
      return this.eventHistory.filter(e => e.type === type);
    }
    return [...this.eventHistory];
  }

  /**
   * Get latest event of a type
   */
  getLatest(type: ElectionEventType): ElectionEvent | undefined {
    for (let i = this.eventHistory.length - 1; i >= 0; i--) {
      if (this.eventHistory[i].type === type) {
        return this.eventHistory[i];
      }
    }
    return undefined;
  }

  /**
   * Get listener count
   */
  getListenerCount(type?: ElectionEventType): number {
    if (type) {
      return (this.listeners.get(type)?.size || 0) + this.globalListeners.size;
    }
    return this.globalListeners.size;
  }
}

// ============================================================================
// Event Utilities
// ============================================================================

export function formatEventTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function formatEventDuration(startTimestamp: number, endTimestamp: number): string {
  const durationMs = endTimestamp - startTimestamp;
  const seconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${seconds}s`;
}

export function getEventDescription(type: ElectionEventType): string {
  const descriptions: Record<ElectionEventType, string> = {
    election_created: 'Election has been created',
    nomination_started: 'Nomination phase has started',
    candidate_nominated: 'A new candidate has been nominated',
    candidate_withdrawn: 'A candidate has withdrawn',
    campaign_started: 'Campaign phase has started',
    voting_started: 'Voting has started',
    vote_cast: 'A vote has been cast',
    vote_changed: 'A voter has changed their vote',
    counting_started: 'Vote counting has started',
    counting_completed: 'Vote counting has completed',
    runoff_triggered: 'A runoff election has been triggered',
    election_completed: 'Election has been completed',
    election_cancelled: 'Election has been cancelled',
  };
  
  return descriptions[type] || `Unknown event: ${type}`;
}

export function isElectionPhaseEvent(type: ElectionEventType): boolean {
  return [
    'nomination_started',
    'campaign_started',
    'voting_started',
    'counting_started',
    'election_completed',
    'election_cancelled',
  ].includes(type);
}

export function isVoteEvent(type: ElectionEventType): boolean {
  return ['vote_cast', 'vote_changed'].includes(type);
}

export function isCandidateEvent(type: ElectionEventType): boolean {
  return ['candidate_nominated', 'candidate_withdrawn'].includes(type);
}

// ============================================================================
// Event Aggregator (for combining multiple events)
// ============================================================================

export interface EventAggregation {
  totalEvents: number;
  eventsByType: Map<ElectionEventType, number>;
  firstEvent: ElectionEvent | null;
  lastEvent: ElectionEvent | null;
  duration: number;
}

export function aggregateEvents(events: ElectionEvent[]): EventAggregation {
  if (events.length === 0) {
    return {
      totalEvents: 0,
      eventsByType: new Map(),
      firstEvent: null,
      lastEvent: null,
      duration: 0,
    };
  }

  const eventsByType = new Map<ElectionEventType, number>();
  for (const event of events) {
    eventsByType.set(event.type, (eventsByType.get(event.type) || 0) + 1);
  }

  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
  const firstEvent = sorted[0];
  const lastEvent = sorted[sorted.length - 1];

  return {
    totalEvents: events.length,
    eventsByType,
    firstEvent,
    lastEvent,
    duration: lastEvent.timestamp - firstEvent.timestamp,
  };
}

// ============================================================================
// Event Filters
// ============================================================================

export interface EventFilter {
  types?: ElectionEventType[];
  electionId?: string;
  since?: number;
  until?: number;
}

export function filterEvents(events: ElectionEvent[], filter: EventFilter): ElectionEvent[] {
  return events.filter(event => {
    if (filter.types && filter.types.length > 0 && !filter.types.includes(event.type)) {
      return false;
    }
    if (filter.electionId && event.electionId !== filter.electionId) {
      return false;
    }
    if (filter.since && event.timestamp < filter.since) {
      return false;
    }
    if (filter.until && event.timestamp > filter.until) {
      return false;
    }
    return true;
  });
}

// ============================================================================
// Event Logger (for debugging)
// ============================================================================

export class ElectionEventLogger {
  private logs: Array<{ timestamp: number; message: string; data?: unknown }>;

  constructor() {
    this.logs = [];
  }

  log(message: string, data?: unknown): void {
    this.logs.push({
      timestamp: Date.now(),
      message,
      data,
    });
  }

  getLogs(): ReadonlyArray<{ timestamp: number; message: string; data?: unknown }> {
    return this.logs;
  }

  clear(): void {
    this.logs = [];
  }

  export(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}
