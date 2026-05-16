/**
 * Discord Adapter
 * 
 * Implements Discord Bot API integration using long polling via REST API.
 * Supports message receiving and sending through Discord channels.
 */

import { v4 as uuidv4 } from 'uuid'
import type { AgentMessage } from '../services/messageBus'
import type { DiscordConfig } from './types'
import { ChannelAdapter } from './ChannelAdapter'

export class DiscordAdapter extends ChannelAdapter {
  readonly channelType = 'discord'
  private config: DiscordConfig | null = null
  private messageCallback: ((message: AgentMessage) => void) | null = null
  private pollingInterval: ReturnType<typeof setInterval> | null = null
  private apiBase = 'https://discord.com/api/v10'
  private lastMessageIds: Map<string, string> = new Map()

  /**
   * Initialize the adapter with configuration
   */
  initialize(config: DiscordConfig, messageCallback: (message: AgentMessage) => void): void {
    this.config = config
    this.messageCallback = messageCallback
  }

  /**
   * Connect to Discord using long polling
   */
  async connect(): Promise<void> {
    if (!this.config?.botToken) {
      throw new Error('Discord bot token not configured')
    }

    if (this.running) {
      console.log('[DiscordAdapter] Already connected')
      return
    }

    this.running = true
    console.log('[DiscordAdapter] Connecting...')

    // Start long polling
    this.startPolling()

    console.log('[DiscordAdapter] Connected successfully')
  }

  /**
   * Disconnect from Discord
   */
  disconnect(): void {
    this.running = false

    if (this.pollingInterval) {
      clearInterval(this.pollingInterval)
      this.pollingInterval = null
    }

    console.log('[DiscordAdapter] Disconnected')
  }

  /**
   * Send a message through Discord
   */
  async send(message: AgentMessage): Promise<void> {
    if (!this.config?.botToken || !this.running) {
      return
    }

    try {
      const payload = message.payload as Record<string, unknown>
      const text = this.formatMessage(message)
      const channelId = payload.channelId as string || message.toAgentId

      if (!channelId) {
        console.warn('[DiscordAdapter] No channelId in message payload')
        return
      }

      await this.sendMessage(channelId, text)
      this.recordSent()
    } catch (error) {
      console.error('[DiscordAdapter] Send error:', error)
      this.recordError()
    }
  }

  /**
   * Start long polling for updates
   */
  private startPolling(): void {
    // Poll every 3 seconds
    this.pollingInterval = setInterval(async () => {
      if (!this.running) return

      try {
        await this.fetchMessages()
      } catch (error) {
        console.error('[DiscordAdapter] Polling error:', error)
        this.recordError()
      }
    }, 3000)
  }

  /**
   * Fetch messages from allowed channels
   */
  private async fetchMessages(): Promise<void> {
    if (!this.config?.botToken || !this.config.allowedChannelIds?.length) return

    for (const channelId of this.config.allowedChannelIds) {
      try {
        await this.fetchChannelMessages(channelId)
      } catch (error) {
        console.error(`[DiscordAdapter] Error fetching channel ${channelId}:`, error)
      }
    }
  }

  /**
   * Fetch messages from a specific channel
   */
  private async fetchChannelMessages(channelId: string): Promise<void> {
    if (!this.config?.botToken) return

    const lastMsgId = this.lastMessageIds.get(channelId)
    const url = lastMsgId
      ? `${this.apiBase}/channels/${channelId}/messages?limit=20&before=${lastMsgId}`
      : `${this.apiBase}/channels/${channelId}/messages?limit=20`

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bot ${this.config.botToken}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`Discord API error: ${response.status}`)
    }

    const messages = await response.json() as Array<{
      id: string
      content: string
      author: { id: string; bot: boolean; username: string }
      channel_id: string
      timestamp: string
    }>

    if (!messages?.length) return

    // Store the latest message ID for next poll
    this.lastMessageIds.set(channelId, messages[0].id)

    // Process messages in reverse order (oldest first)
    for (const msg of messages.reverse()) {
      this.processMessage(msg)
    }
  }

  /**
   * Process incoming Discord message
   */
  private processMessage(discordMsg: {
    id: string
    content: string
    author: { id: string; bot: boolean; username: string }
    channel_id: string
    timestamp: string
  }): void {
    // Ignore bot messages
    if (discordMsg.author.bot) return

    // Ignore empty messages
    if (!discordMsg.content?.trim()) return

    // Check if message starts with command prefix
    const commandPrefix = '!'
    if (!discordMsg.content.startsWith(commandPrefix)) {
      // For non-command messages, just relay them
      this.recordReceived()

      const agentMessage: AgentMessage = {
        id: uuidv4(),
        type: 'discord_message',
        fromRole: 'discord',
        fromAgentId: discordMsg.channel_id,
        toRole: 'planner',
        payload: {
          text: discordMsg.content,
          channelId: discordMsg.channel_id,
          discordMsgId: discordMsg.id,
          username: discordMsg.author.username
        },
        priority: 'normal',
        deliveryMode: 'reliable',
        timestamp: new Date(discordMsg.timestamp).getTime(),
        retryCount: 0,
        maxRetries: 3,
        status: 'pending'
      }

      if (this.messageCallback) {
        this.messageCallback(agentMessage)
      }
      return
    }

    // Parse command
    const parts = discordMsg.content.slice(1).split(' ')
    const command = parts[0].toLowerCase()
    const args = parts.slice(1).join(' ')

    this.recordReceived()

    // Handle commands
    switch (command) {
      case 'start':
      case 'help':
        this.handleHelp(discordMsg.channel_id)
        break
      case 'status':
        this.handleStatus(discordMsg.channel_id)
        break
      case 'task':
        this.handleTask(discordMsg, args)
        break
      default:
        this.handleUnknown(discordMsg.channel_id, command)
    }
  }

  /**
   * Handle help command
   */
  private async handleHelp(channelId: string): Promise<void> {
    const helpMessage = `🤖 **Harness Desktop Bot**

Welcome! I am connected to your Harness Desktop agent.

Available commands:
• !start - Show welcome message
• !status - Check agent status
• !task <description> - Submit a task

I'll notify you when your tasks are complete.`

    await this.sendMessage(channelId, helpMessage)
  }

  /**
   * Handle status command
   */
  private async handleStatus(channelId: string): Promise<void> {
    const statusMessage = `📊 **Agent Status**

Status: Ready
Mode: Unattended Operation
Channels: Connected`

    await this.sendMessage(channelId, statusMessage)
  }

  /**
   * Handle task command
   */
  private async handleTask(
    discordMsg: { id: string; author: { id: string; username: string }; channel_id: string },
    args: string
  ): Promise<void> {
    if (!args.trim()) {
      await this.sendMessage(discordMsg.channel_id, '⚠️ Usage: !task <task description>')
      return
    }

    const agentMessage: AgentMessage = {
      id: uuidv4(),
      type: 'discord_command',
      fromRole: 'discord',
      fromAgentId: discordMsg.channel_id,
      toRole: 'planner',
      payload: {
        command: 'task',
        text: args,
        channelId: discordMsg.channel_id,
        userId: discordMsg.author.id,
        username: discordMsg.author.username,
        discordMsgId: discordMsg.id
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
      await this.sendMessage(discordMsg.channel_id, '✅ Task submitted to agent queue')
    }
  }

  /**
   * Handle unknown commands
   */
  private async handleUnknown(channelId: string, command: string): Promise<void> {
    await this.sendMessage(
      channelId,
      `❓ Unknown command: ${command}\n\nTry !status to check agent status.`
    )
  }

  /**
   * Send message via Discord Bot API
   */
  private async sendMessage(channelId: string, text: string): Promise<void> {
    if (!this.config?.botToken) return

    const url = `${this.apiBase}/channels/${channelId}/messages`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${this.config.botToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ content: text })
    })

    if (!response.ok) {
      throw new Error(`Failed to send message: ${response.status}`)
    }
  }

  /**
   * Format agent message for Discord
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