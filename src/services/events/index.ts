/**
 * Event Services
 * Unified exports for the event system
 */

export * from './types';
export { eventBus } from './eventBus';
import { eventBus } from './eventBus';
export const subscribe = eventBus.subscribe.bind(eventBus);
export const on = eventBus.on.bind(eventBus);
export const off = eventBus.off.bind(eventBus);
export const unsubscribe = eventBus.off.bind(eventBus);
export * as subscriber from './subscriber';
export * as eventLogger from './eventLogger';
