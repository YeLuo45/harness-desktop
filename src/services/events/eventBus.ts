/**
 * Event Bus (Singleton)
 * Provides publish, subscribe, on, and off methods for event communication
 */

import { Event, EventType, EventHandler, Subscriber } from './types';
import * as subscriber from './subscriber';
import * as logger from './eventLogger';

class EventBus {
  private static instance: EventBus;

  private constructor() {}

  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  /**
   * Subscribe to an event with a handler
   * Returns a subscriber that can be used to unsubscribe
   */
  subscribe<T = unknown>(
    type: EventType,
    handler: EventHandler<T>,
    priority: number = 0
  ): Subscriber<T> {
    return subscriber.register(type, handler, priority);
  }

  /**
   * Alias for subscribe
   */
  on<T = unknown>(
    type: EventType,
    handler: EventHandler<T>,
    priority: number = 0
  ): Subscriber<T> {
    return this.subscribe(type, handler, priority);
  }

  /**
   * Unsubscribe by subscriber id or type+handler
   */
  off(subscriberId: string): boolean;
  off(type: EventType, handler: EventHandler): boolean;
  off(subscriberIdOrType: string | EventType, handler?: EventHandler): boolean {
    if (typeof subscriberIdOrType === 'string') {
      return subscriber.unregister(subscriberIdOrType);
    }
    if (handler) {
      const subs = subscriber.getSubscribers(subscriberIdOrType);
      const found = subs.find((s) => s.handler === handler);
      if (found) {
        return subscriber.unregister(found.id);
      }
    }
    return false;
  }

  /**
   * Publish an event
   */
  async publish<T = unknown>(type: EventType, payload: T, source?: string): Promise<void> {
    const event: Event<T> = {
      type,
      payload,
      timestamp: Date.now(),
      source,
    };

    logger.log(event);

    const subs = subscriber.getSubscribers(type);
    const onceIds: string[] = [];

    for (const sub of subs) {
      try {
        await sub.handler(event);
      } catch (err) {
        console.error(`[EventBus] Handler error for ${String(type)}:`, err);
      }
      if (sub.once) {
        onceIds.push(sub.id);
      }
    }

    onceIds.forEach((id) => subscriber.unregister(id));
  }

  /**
   * Alias for publish
   */
  emit<T = unknown>(type: EventType, payload: T, source?: string): Promise<void> {
    return this.publish(type, payload, source);
  }

  /**
   * Get subscriber count for an event type
   */
  subscriberCount(type?: EventType): number {
    return subscriber.count(type);
  }
}

export const eventBus = EventBus.getInstance();
export default eventBus;
