/**
 * Subscriber Manager
 * Handles registration, unregistration, retrieval, and priority sorting of event subscribers
 */

import { EventType, EventHandler, Subscriber } from './types';

const subscribers = new Map<string, Subscriber[]>();

function getSubscriberId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getOrCreateList(type: EventType): Subscriber[] {
  const key = String(type);
  if (!subscribers.has(key)) {
    subscribers.set(key, []);
  }
  return subscribers.get(key)!;
}

/**
 * Register a subscriber for an event type
 */
export function register<T = unknown>(
  type: EventType,
  handler: EventHandler<T>,
  priority: number = 0
): Subscriber<T> {
  const subscriber: Subscriber<T> = {
    id: getSubscriberId(),
    type,
    handler: handler as EventHandler,
    priority,
  };

  const list = getOrCreateList(type);
  list.push(subscriber);
  list.sort((a, b) => b.priority - a.priority);

  return subscriber;
}

/**
 * Unregister a subscriber by id
 */
export function unregister(subscriberId: string): boolean {
  const keys = Array.from(subscribers.keys());
  for (const key of keys) {
    const list = subscribers.get(key)!;
    const index = list.findIndex((s) => s.id === subscriberId);
    if (index !== -1) {
      list.splice(index, 1);
      if (list.length === 0) {
        subscribers.delete(key);
      }
      return true;
    }
  }
  return false;
}

/**
 * Get all subscribers for an event type
 */
export function getSubscribers(type: EventType): Subscriber[] {
  return subscribers.get(String(type)) ?? [];
}

/**
 * Clear all subscribers
 */
export function clearAll(): void {
  subscribers.clear();
}

/**
 * Get subscriber count
 */
export function count(type?: EventType): number {
  if (type) {
    return subscribers.get(String(type))?.length ?? 0;
  }
  let total = 0;
  const lists = Array.from(subscribers.values());
  for (const list of lists) {
    total += list.length;
  }
  return total;
}
