/**
 * Event System Types
 */

export type EventType = string | symbol;

/** Event payload */
export interface Event<T = unknown> {
  type: EventType;
  payload: T;
  timestamp: number;
  source?: string;
}

/** Handler function for an event */
export type EventHandler<T = unknown> = (event: Event<T>) => void | Promise<void>;

/** Subscriber metadata */
export interface Subscriber<T = unknown> {
  id: string;
  type: EventType;
  handler: EventHandler<T>;
  priority: number;
  once?: boolean;
}

/** Event map for typed subscribe/publish */
export interface EventMap {
  [key: string]: unknown;
}
