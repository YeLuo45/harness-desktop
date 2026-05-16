/**
 * Channel Adapter Abstract Base Class
 * 
 * Defines the interface for all channel adapters (Telegram, Discord, Feishu, etc.)
 */

import type { AgentMessage } from '../services/messageBus'
import type { AdapterStats } from './types'

export abstract class ChannelAdapter {
  abstract readonly channelType: string
  protected stats: AdapterStats = {
    messagesReceived: 0,
    messagesSent: 0,
    errors: 0
  }
  protected running = false

  /**
   * Connect to the channel
   */
  abstract connect(): Promise<void>

  /**
   * Disconnect from the channel
   */
  abstract disconnect(): void

  /**
   * Send a message through the channel
   */
  abstract send(message: AgentMessage): Promise<void>

  /**
   * Get adapter statistics
   */
  getStats(): AdapterStats {
    return { ...this.stats }
  }

  /**
   * Check if adapter is running
   */
  isRunning(): boolean {
    return this.running
  }

  /**
   * Record a received message
   */
  protected recordReceived(): void {
    this.stats.messagesReceived++
    this.stats.lastActivity = Date.now()
  }

  /**
   * Record a sent message
   */
  protected recordSent(): void {
    this.stats.messagesSent++
    this.stats.lastActivity = Date.now()
  }

  /**
   * Record an error
   */
  protected recordError(): void {
    this.stats.errors++
    this.stats.lastActivity = Date.now()
  }
}