/**
 * Channel Types
 * 
 * Type definitions for multi-channel adapter system.
 * Supports Telegram, Discord, Feishu and future channels.
 */

import type { AgentMessage } from '../services/messageBus'

export type ChannelType = 'telegram' | 'discord' | 'feishu'

export interface ChannelConfig {
  enabled: boolean
  name: string
  type: ChannelType
}

export interface TelegramConfig extends ChannelConfig {
  type: 'telegram'
  botToken: string
  allowedChatIds: string[]
}

export interface DiscordConfig extends ChannelConfig {
  type: 'discord'
  botToken: string
  guildId: string
  allowedChannelIds: string[]
}

export interface FeishuConfig extends ChannelConfig {
  type: 'feishu'
  appId: string
  appSecret: string
  botName?: string
}

export interface AdapterStats {
  messagesReceived: number
  messagesSent: number
  errors: number
  lastActivity?: number
}

/**
 * Telegram update types
 */
export interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
  edited_message?: TelegramMessage
}

export interface TelegramMessage {
  message_id: number
  from?: TelegramUser
  chat: TelegramChat
  date: number
  text?: string
  entities?: TelegramEntity[]
}

export interface TelegramUser {
  id: number
  is_bot: boolean
  first_name: string
  last_name?: string
  username?: string
}

export interface TelegramChat {
  id: number
  type: string
  title?: string
  username?: string
  first_name?: string
  last_name?: string
}

export interface TelegramEntity {
  type: string
  offset: number
  length: number
}

/**
 * Telegram command types
 */
export interface TelegramCommand {
  command: string
  args: string
  chatId: number
  userId: number
  messageId: number
}