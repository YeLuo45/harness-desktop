/**
 * Telegram Adapter
 * 
 * Implements Telegram Bot API integration using long polling (getUpdates).
 * Supports /start, /status, /task commands.
 */

import { v4 as uuidv4 } from 'uuid'
import type { AgentMessage } from '../services/messageBus'
import type { TelegramConfig, TelegramUpdate, TelegramCommand } from './types'
import { ChannelAdapter } from './ChannelAdapter'

export class TelegramAdapter extends ChannelAdapter {
  readonly channelType = 'telegram'
  private config: TelegramConfig | null = null
  private messageCallback: ((message: AgentMessage) => void) | null = null
  private pollingInterval: ReturnType<typeof setInterval> | null = null
  private offset = 0
  private apiBase = 'https://api.telegram.org/bot'

  /**
   * Initialize the adapter with configuration
   */
  initialize(config: TelegramConfig, messageCallback: (message: AgentMessage) => void): void {
    this.config = config
    this.messageCallback = messageCallback
  }

  /**
   * Connect to Telegram using long polling
   */
  async connect(): Promise<void> {
    if (!this.config?.botToken) {
      throw new Error('Telegram bot token not configured')
    }

    if (this.running) {
      console.log('[TelegramAdapter] Already connected')
      return
    }

    this.running = true
    console.log('[TelegramAdapter] Connecting...')

    // Start long polling
    this.startPolling()

    console.log('[TelegramAdapter] Connected successfully')
  }

  /**
   * Disconnect from Telegram
   */
  disconnect(): void {
    this.running = false

    if (this.pollingInterval) {
      clearInterval(this.pollingInterval)
      this.pollingInterval = null
    }

    console.log('[TelegramAdapter] Disconnected')
  }

  /**
   * Send a message through Telegram
   */
  async send(message: AgentMessage): Promise<void> {
    if (!this.config?.botToken || !this.running) {
      return
    }

    try {
      const payload = message.payload as Record<string, unknown>
      const text = this.formatMessage(message)
      const chatId = payload.chatId as number | undefined

      if (!chatId) {
        console.warn('[TelegramAdapter] No chatId in message payload')
        return
      }

      await this.sendMessage(chatId, text)
      this.recordSent()
    } catch (error) {
      console.error('[TelegramAdapter] Send error:', error)
      this.recordError()
    }
  }

  /**
   * Start long polling for updates
   */
  private startPolling(): void {
    // Poll every 2 seconds
    this.pollingInterval = setInterval(async () => {
      if (!this.running) return

      try {
        await this.fetchUpdates()
      } catch (error) {
        console.error('[TelegramAdapter] Polling error:', error)
        this.recordError()
      }
    }, 2000)
  }

  /**
   * Fetch updates from Telegram Bot API
   */
  private async fetchUpdates(): Promise<void> {
    if (!this.config?.botToken) return

    const url = `${this.apiBase}${this.config.botToken}/getUpdates`
    const params = new URLSearchParams({
      offset: String(this.offset),
      timeout: '5',
      allowed_updates: JSON.stringify(['message'])
    })

    const response = await fetch(`${url}?${params}`)
    if (!response.ok) {
      throw new Error(`Telegram API error: ${response.status}`)
    }

    const data = await response.json() as { ok: boolean; result?: TelegramUpdate[] }

    if (!data.ok || !data.result?.length) {
      return
    }

    // Process updates
    for (const update of data.result) {
      if (update.message) {
        this.processMessage(update)
      }
      // Update offset to acknowledge receipt
      this.offset = update.update_id + 1
    }
  }

  /**
   * Process incoming Telegram message
   */
  private processMessage(update: TelegramUpdate): void {
    const message = update.message
    if (!message || !message.text) return

    // Check if user is whitelisted
    if (!this.isWhitelisted(message.from?.id || message.chat.id)) {
      console.warn('[TelegramAdapter] User not whitelisted:', message.from?.id)
      return
    }

    // Parse command
    const command = this.parseCommand(message.text, message.from?.id || message.chat.id, message.message_id)
    if (!command) return

    this.recordReceived()

    // Handle commands
    switch (command.command) {
      case '/start':
        this.handleStart(command)
        break
      case '/status':
        this.handleStatus(command)
        break
      case '/task':
        this.handleTask(command)
        break
      default:
        this.handleUnknown(command)
    }
  }

  /**
   * Check if user is in allowed list
   */
  private isWhitelisted(userId: number): boolean {
    if (!this.config?.allowedChatIds?.length) {
      return true // No restrictions
    }
    return this.config.allowedChatIds.includes(String(userId))
  }

  /**
   * Parse command from message text
   */
  private parseCommand(text: string, userId: number, messageId: number): TelegramCommand | null {
    const trimmed = text.trim()

    if (!trimmed.startsWith('/')) {
      return null
    }

    const parts = trimmed.split(' ')
    const commandPart = parts[0]
    const command = commandPart.split('@')[0] // Handle bot username suffix
    const args = parts.slice(1).join(' ')

    return {
      command,
      args,
      chatId: userId,
      userId,
      messageId
    }
  }

  /**
   * Handle /start command
   */
  private async handleStart(command: TelegramCommand): Promise<void> {
    const welcomeMessage = `🤖 *Harness Desktop Bot*

Welcome! I am connected to your Harness Desktop agent.

Available commands:
• /status - Check agent status
• /task \<description\> - Submit a task

I'll notify you when your tasks are complete.`

    await this.sendMessage(command.chatId, welcomeMessage)
  }

  /**
   * Handle /status command
   */
  private async handleStatus(command: TelegramCommand): Promise<void> {
    const statusMessage = `📊 *Agent Status*

Status: Ready
Mode: Unattended Operation
Channels: Connected`

    await this.sendMessage(command.chatId, statusMessage)
  }

  /**
   * Handle /task command
   */
  private async handleTask(command: TelegramCommand): Promise<void> {
    if (!command.args.trim()) {
      await this.sendMessage(command.chatId, '⚠️ Usage: /task \<task description\>')
      return
    }

    // Create agent message for task
    const agentMessage: AgentMessage = {
      id: uuidv4(),
      type: 'telegram_command',
      fromRole: 'telegram',
      fromAgentId: String(command.userId),
      toRole: 'planner',
      payload: {
        command: 'task',
        text: command.args,
        chatId: command.chatId,
        userId: command.userId,
        messageId: command.messageId
      },
      priority: 'normal',
      deliveryMode: 'reliable',
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: 3,
      status: 'pending'
    }

    // Send to message bus via callback
    if (this.messageCallback) {
      this.messageCallback(agentMessage)
      await this.sendMessage(command.chatId, '✅ Task submitted to agent queue')
    }
  }

  /**
   * Handle unknown commands
   */
  private async handleUnknown(command: TelegramCommand): Promise<void> {
    await this.sendMessage(
      command.chatId,
      `❓ Unknown command: ${command.command}\n\nTry /status to check agent status.`
    )
  }

  /**
   * Send message via Telegram Bot API
   */
  private async sendMessage(chatId: number, text: string): Promise<void> {
    if (!this.config?.botToken) return

    const url = `${this.apiBase}${this.config.botToken}/sendMessage`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown'
      })
    })

    if (!response.ok) {
      throw new Error(`Failed to send message: ${response.status}`)
    }
  }

  /**
   * Format agent message for Telegram
   */
  private formatMessage(message: AgentMessage): string {
    const payload = message.payload as Record<string, unknown>

    if (typeof payload === 'string') {
      return payload
    }

    const status = payload.status as string | undefined
    const result = payload.result as string | undefined
    const error = payload.error as string | undefined

    if (error) {
      return `❌ Error: ${error}`
    }

    if (result) {
      return `✅ ${result}`
    }

    if (status) {
      return `📋 Status: ${status}`
    }

    return JSON.stringify(payload, null, 2)
  }
}