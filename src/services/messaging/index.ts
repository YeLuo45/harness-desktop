/**
 * Messaging Service - P16 Messaging System
 * 
 * Barrel export for all messaging-related services.
 * 
 * @example
 * import { 
 *   MessageQueue,
 *   MessageBus,
 *   ConversationManager,
 *   ConversationHandler,
 *   createMessageQueue,
 *   createMessageBus,
 *   createConversationManager,
 *   createConversationHandler,
 * } from '@/services/messaging';
 */

// Types
export * from './messageTypes';

// Core Components
export { MessageQueue, createMessageQueue } from './messageQueue';
export { MessageBus, createMessageBus } from './messageBus';
export { ConversationManager, createConversationManager } from './conversationManager';
export { ConversationHandler, createConversationHandler } from './conversationHandler';

// ============================================================================
// Quick Start Example
// ============================================================================

/**
 * Quick Start: Set up a basic messaging system
 * 
 * ```typescript
 * import { 
 *   createMessageQueue, 
 *   createMessageBus, 
 *   createConversationManager,
 *   createConversationHandler,
 * } from '@/services/messaging';
 * 
 * async function main() {
 *   // Create components
 *   const messageQueue = createMessageQueue();
 *   const messageBus = createMessageBus();
 *   const conversationManager = createConversationManager();
 *   const conversationHandler = createConversationHandler(conversationManager);
 *   
 *   // Create a conversation
 *   const conversation = conversationHandler.startConversation('direct', ['user1', 'user2']);
 *   
 *   // Send a message
 *   const message = await conversationHandler.sendMessage(
 *     conversation.id,
 *     'user1',
 *     { type: 'text', text: 'Hello!' }
 *   );
 *   
 *   // Queue the message
 *   messageQueue.enqueue(message);
 *   messageQueue.start();
 *   
 *   console.log('Message sent:', message);
 * }
 * 
 * main();
 * ```
 */

/**
 * Quick Start: Set up pub/sub messaging
 * 
 * ```typescript
 * import { createMessageBus } from '@/services/messaging';
 * 
 * // Create message bus with pub/sub
 * const messageBus = createMessageBus({ enablePubSub: true });
 * 
 * // Create a topic
 * messageBus.createTopic('notifications', ['notification']);
 * 
 * // Subscribe to topic
 * messageBus.subscribe('notifications', (message) => {
 *   console.log('Received notification:', message);
 * });
 * 
 * // Process a message
 * const result = await messageBus.process({
 *   id: 'msg-1',
 *   conversationId: 'conv-1',
 *   senderId: 'user1',
 *   recipientId: 'user2',
 *   content: { type: 'notification', text: 'New alert!' },
 *   status: 'pending',
 *   priority: 'high',
 *   timestamp: Date.now(),
 *   retryCount: 0,
 * });
 * ```
 */

// ============================================================================
// Default Export
// ============================================================================

import { createMessageQueue } from './messageQueue';
import { createMessageBus } from './messageBus';
import { createConversationManager } from './conversationManager';
import { createConversationHandler } from './conversationHandler';

export default {
  messageQueue: createMessageQueue,
  messageBus: createMessageBus,
  conversationManager: createConversationManager,
  conversationHandler: createConversationHandler,
};