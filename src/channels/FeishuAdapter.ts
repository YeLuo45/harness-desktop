/**
 * Feishu (Lark) Adapter
 * 
 * Implements Feishu/Lark Bot API integration using REST API + long polling.
 * Supports message receiving and sending through Feishu channels.
 */

import { v4 as uuidv4 } from 'uuid'
import type { AgentMessage } from '../services/messageBus'
import type { FeishuConfig } from './types'
import { ChannelAdapter } from './ChannelAdapter'

export class FeishuAdapter extends ChannelAdapter {
  readonly channelType = 'feishu'
  private config: FeishuConfig | null = null
  private messageCallback: ((message: AgentMessage) => void) | null = null
  private pollingInterval: ReturnType<typeof setInterval> | null = null
  private apiBase = 'https://open.feishu.cn/open-apis'
  private tenantAccessToken: string | null = null
  private tokenExpiry: number = 0

  /**
   * Initialize the adapter with configuration
   */
  initialize(config: FeishuConfig, messageCallback: (message: AgentMessage) => void): void {
    this.config = config
    this.messageCallback = messageCallback
  }

  /**
   * Connect to Feishu
   */
  async connect(): Promise<void> {
    if (!this.config?.appId || !this.config?.appSecret) {
      throw new Error('Feishu appId or appSecret not configured')
    }

    if (this.running) {
      console.log('[FeishuAdapter] Already connected')
      return
    }

    this.running = true
    console.log('[FeishuAdapter] Connecting...')

    // Get tenant access token
    await this.refreshToken()

    // Start long polling
    this.startPolling()

    console.log('[FeishuAdapter] Connected successfully')
  }

  /**
   * Disconnect from Feishu
   */
  disconnect(): void {
    this.running = false

    if (this.pollingInterval) {
      clearInterval(this.pollingInterval)
      this.pollingInterval = null
    }

    console.log('[FeishuAdapter] Disconnected')
  }

  /**
   * Send a message through Feishu
   */
  async send(message: AgentMessage): Promise<void> {
    if (!this.config?.appId || !this.running) {
      return
    }

    try {
      const payload = message.payload as Record<string, unknown>
      const text = this.formatMessage(message)
      const chatId = payload.channelId as string || message.toAgentId

      if (!chatId) {
        console.warn('[FeishuAdapter] No channelId in message payload')
        return
      }

      await this.sendMessage(chatId, text)
      this.recordSent()
    } catch (error) {
      console.error('[FeishuAdapter] Send error:', error)
      this.recordError()
    }
  }

  /**
   * Start long polling for updates
   */
  private startPolling(): void {
    // Poll every 5 seconds
    this.pollingInterval = setInterval(async () => {
      if (!this.running) return

      try {
        await this.pollMessages()
      } catch (error) {
        console.error('[FeishuAdapter] Polling error:', error)
        this.recordError()

        // Refresh token on auth errors
        if (error instanceof Error && error.message.includes('invalid_token')) {
          await this.refreshToken()
        }
      }
    }, 5000)
  }

  /**
   * Poll for new messages
   */
  private async pollMessages(): Promise<void> {
    // Check if token needs refresh
    if (Date.now() >= this.tokenExpiry) {
      await this.refreshToken()
    }

    // Feishu uses event subscription for real-time updates
    // For long polling, we check the message list
    // This is a simplified implementation - production would use webhook events
    const messages = await this.fetchRecentMessages()
    for (const msg of messages) {
      this.processMessage(msg)
    }
  }

  /**
   * Fetch recent messages from Feishu
   */
  private async fetchRecentMessages(): Promise<Array<{
    message_id: string
    chat_id: string
    content: string
    sender: { sender_id: { user_id: string }; sender_type: string }
    create_time: string
  }>> {
    if (!this.tenantAccessToken) return []

    // Use chat messages API - this is simplified
    // Production would use event subscription webhooks
    const response = await fetch(
      `${this.apiBase}/im/v1/messages?container_id_type=chat&container_id=test&page_size=20`,
      {
        headers: {
          'Authorization': `Bearer ${this.tenantAccessToken}`,
          'Content-Type': 'application/json'
        }
      }
    )

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('invalid_token')
      }
      throw new Error(`Feishu API error: ${response.status}`)
    }

    const data = await response.json() as { code: number; data?: { items?: Array<{
      message_id: string
      chat_id: string
      content: string
      sender: { sender_id: { user_id: string }; sender_type: string }
      create_time: string
    }> } }

    if (data.code !== 0 || !data.data?.items) {
      return []
    }

    return data.data.items
  }

  /**
   * Process incoming Feishu message
   */
  private processMessage(feishuMsg: {
    message_id: string
    chat_id: string
    content: string
    sender: { sender_id: { user_id: string }; sender_type: string }
    create_time: string
  }): void {
    // Skip non-text messages (content is JSON stringified)
    let text: string
    try {
      const parsed = JSON.parse(feishuMsg.content)
      text = parsed.text || ''
    } catch {
      text = feishuMsg.content
    }

    if (!text?.trim()) return

    // Check if bot message
    if (feishuMsg.sender.sender_type === 'bot') return

    this.recordReceived()

    // Check if message starts with command prefix
    const commandPrefix = '/'
    if (text.startsWith(commandPrefix)) {
      // Parse command
      const parts = text.slice(1).split(' ')
      const command = parts[0].toLowerCase()
      const args = parts.slice(1).join(' ')

      // Handle provider command
      if (command === 'provider') {
        this.handleProvider(feishuMsg.chat_id, args)
        return
      }

      // For other commands, continue with normal message handling
    }

    const agentMessage: AgentMessage = {
      id: uuidv4(),
      type: 'feishu_message',
      fromRole: 'feishu',
      fromAgentId: feishuMsg.chat_id,
      toRole: 'planner',
      payload: {
        text,
        channelId: feishuMsg.chat_id,
        feishuMsgId: feishuMsg.message_id,
        userId: feishuMsg.sender.sender_id.user_id
      },
      priority: 'normal',
      deliveryMode: 'reliable',
      timestamp: parseInt(feishuMsg.create_time) * 1000,
      retryCount: 0,
      maxRetries: 3,
      status: 'pending'
    }

    if (this.messageCallback) {
      this.messageCallback(agentMessage)
    }
  }

  /**
   * Send message via Feishu API
   */
  private async sendMessage(chatId: string, text: string): Promise<void> {
    if (!this.tenantAccessToken) {
      throw new Error('Not authenticated with Feishu')
    }

    const url = `${this.apiBase}/im/v1/messages`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.tenantAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        receive_id: chatId,
        msg_type: 'text',
        content: JSON.stringify({ text })
      })
    })

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('invalid_token')
      }
      throw new Error(`Failed to send message: ${response.status}`)
    }
  }

  /**
   * Refresh tenant access token
   */
  private async refreshToken(): Promise<void> {
    if (!this.config?.appId || !this.config?.appSecret) return

    const response = await fetch(`${this.apiBase}/auth/v3/tenant_access_token/internal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: this.config.appId,
        app_secret: this.config.appSecret
      })
    })

    if (!response.ok) {
      throw new Error(`Failed to get Feishu token: ${response.status}`)
    }

    const data = await response.json() as {
      code: number
      tenant_access_token?: string
      expire?: number
    }

    if (data.code !== 0 || !data.tenant_access_token) {
      throw new Error('Failed to get Feishu tenant access token')
    }

    this.tenantAccessToken = data.tenant_access_token
    // Refresh 5 minutes before expiry
    this.tokenExpiry = Date.now() + ((data.expire || 7200) - 300) * 1000
  }

  /**
   * Handle provider command
   */
  private async handleProvider(chatId: string, args: string): Promise<void> {
    const name = args.trim().toLowerCase()
    const validProviders = ['openai', 'anthropic', 'azure', 'google', 'custom']

    if (!name) {
      await this.sendMessage(chatId, `⚠️ Usage: /provider <name>\nValid providers: ${validProviders.join(', ')}`)
      return
    }

    if (validProviders.includes(name as any)) {
      import('../store/providerStore').then(({ useProviderStore }) => {
        useProviderStore.getState().setCurrentProvider(name as any)
      }).catch(console.error)
      await this.sendMessage(chatId, `✅ Provider switched to ${name}`)
    } else {
      await this.sendMessage(chatId, `❌ Unknown provider: ${name}\nValid providers: ${validProviders.join(', ')}`)
    }
  }

  /**
   * Format agent message for Feishu
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