/**
 * Channel Store
 * 
 * Persistent storage for channel configurations using zustand + electron-store.
 * Manages Telegram, Discord, Feishu and future channel configs.
 * Bot tokens are stored securely via electron-store IPC.
 */

import { create } from 'zustand'
import type { TelegramConfig, DiscordConfig, FeishuConfig } from '../channels/types'

const TELEGRAM_STORE_KEY = 'telegramConfig'
const DISCORD_STORE_KEY = 'discordConfig'
const FEISHU_STORE_KEY = 'feishuConfig'

interface ChannelState {
  telegram: TelegramConfig | null
  discord: DiscordConfig | null
  feishu: FeishuConfig | null
  // Telegram
  loadTelegramConfig: () => Promise<void>
  saveTelegramConfig: (config: TelegramConfig) => Promise<void>
  updateTelegramConfig: (updates: Partial<TelegramConfig>) => Promise<void>
  setTelegramEnabled: (enabled: boolean) => Promise<void>
  clearTelegramConfig: () => Promise<void>
  // Discord
  loadDiscordConfig: () => Promise<void>
  saveDiscordConfig: (config: DiscordConfig) => Promise<void>
  updateDiscordConfig: (updates: Partial<DiscordConfig>) => Promise<void>
  setDiscordEnabled: (enabled: boolean) => Promise<void>
  clearDiscordConfig: () => Promise<void>
  // Feishu
  loadFeishuConfig: () => Promise<void>
  saveFeishuConfig: (config: FeishuConfig) => Promise<void>
  updateFeishuConfig: (updates: Partial<FeishuConfig>) => Promise<void>
  setFeishuEnabled: (enabled: boolean) => Promise<void>
  clearFeishuConfig: () => Promise<void>
}

/**
 * Get electron API config store (browser context)
 */
function getElectronConfigStore(): {
  get: (key: string) => Promise<unknown>
  set: (key: string, value: unknown) => Promise<boolean>
  getAll: () => Promise<Record<string, unknown>>
} | null {
  const electronAPI = (window as unknown as { electronAPI?: {
    config: {
      get: (key: string) => Promise<unknown>
      set: (key: string, value: unknown) => Promise<boolean>
      getAll: () => Promise<Record<string, unknown>>
    }
  } }).electronAPI
  return electronAPI?.config || null
}

export const useChannelStore = create<ChannelState>((set, get) => ({
  telegram: null,
  discord: null,
  feishu: null,

  // Telegram
  loadTelegramConfig: async () => {
    try {
      const store = getElectronConfigStore()
      if (!store) {
        console.warn('[ChannelStore] electronAPI not available')
        return
      }

      const stored = await store.get(TELEGRAM_STORE_KEY) as TelegramConfig | undefined
      if (stored) {
        set({ telegram: stored })
      }
    } catch (error) {
      console.error('[ChannelStore] Failed to load telegram config:', error)
    }
  },

  saveTelegramConfig: async (config: TelegramConfig) => {
    try {
      const store = getElectronConfigStore()
      if (!store) {
        throw new Error('electronAPI not available')
      }

      await store.set(TELEGRAM_STORE_KEY, config)
      set({ telegram: config })
    } catch (error) {
      console.error('[ChannelStore] Failed to save telegram config:', error)
      throw error
    }
  },

  updateTelegramConfig: async (updates: Partial<TelegramConfig>) => {
    const current = get().telegram
    if (!current) return

    const updated: TelegramConfig = {
      ...current,
      ...updates
    }

    await get().saveTelegramConfig(updated)
  },

  setTelegramEnabled: async (enabled: boolean) => {
    const current = get().telegram
    if (!current) return

    await get().saveTelegramConfig({
      ...current,
      enabled
    })
  },

  clearTelegramConfig: async () => {
    try {
      const store = getElectronConfigStore()
      if (!store) {
        throw new Error('electronAPI not available')
      }

      await store.set(TELEGRAM_STORE_KEY, null)
      set({ telegram: null })
    } catch (error) {
      console.error('[ChannelStore] Failed to clear telegram config:', error)
      throw error
    }
  },

  // Discord
  loadDiscordConfig: async () => {
    try {
      const store = getElectronConfigStore()
      if (!store) {
        console.warn('[ChannelStore] electronAPI not available')
        return
      }

      const stored = await store.get(DISCORD_STORE_KEY) as DiscordConfig | undefined
      if (stored) {
        set({ discord: stored })
      }
    } catch (error) {
      console.error('[ChannelStore] Failed to load discord config:', error)
    }
  },

  saveDiscordConfig: async (config: DiscordConfig) => {
    try {
      const store = getElectronConfigStore()
      if (!store) {
        throw new Error('electronAPI not available')
      }

      await store.set(DISCORD_STORE_KEY, config)
      set({ discord: config })
    } catch (error) {
      console.error('[ChannelStore] Failed to save discord config:', error)
      throw error
    }
  },

  updateDiscordConfig: async (updates: Partial<DiscordConfig>) => {
    const current = get().discord
    if (!current) return

    const updated: DiscordConfig = {
      ...current,
      ...updates
    }

    await get().saveDiscordConfig(updated)
  },

  setDiscordEnabled: async (enabled: boolean) => {
    const current = get().discord
    if (!current) return

    await get().saveDiscordConfig({
      ...current,
      enabled
    })
  },

  clearDiscordConfig: async () => {
    try {
      const store = getElectronConfigStore()
      if (!store) {
        throw new Error('electronAPI not available')
      }

      await store.set(DISCORD_STORE_KEY, null)
      set({ discord: null })
    } catch (error) {
      console.error('[ChannelStore] Failed to clear discord config:', error)
      throw error
    }
  },

  // Feishu
  loadFeishuConfig: async () => {
    try {
      const store = getElectronConfigStore()
      if (!store) {
        console.warn('[ChannelStore] electronAPI not available')
        return
      }

      const stored = await store.get(FEISHU_STORE_KEY) as FeishuConfig | undefined
      if (stored) {
        set({ feishu: stored })
      }
    } catch (error) {
      console.error('[ChannelStore] Failed to load feishu config:', error)
    }
  },

  saveFeishuConfig: async (config: FeishuConfig) => {
    try {
      const store = getElectronConfigStore()
      if (!store) {
        throw new Error('electronAPI not available')
      }

      await store.set(FEISHU_STORE_KEY, config)
      set({ feishu: config })
    } catch (error) {
      console.error('[ChannelStore] Failed to save feishu config:', error)
      throw error
    }
  },

  updateFeishuConfig: async (updates: Partial<FeishuConfig>) => {
    const current = get().feishu
    if (!current) return

    const updated: FeishuConfig = {
      ...current,
      ...updates
    }

    await get().saveFeishuConfig(updated)
  },

  setFeishuEnabled: async (enabled: boolean) => {
    const current = get().feishu
    if (!current) return

    await get().saveFeishuConfig({
      ...current,
      enabled
    })
  },

  clearFeishuConfig: async () => {
    try {
      const store = getElectronConfigStore()
      if (!store) {
        throw new Error('electronAPI not available')
      }

      await store.set(FEISHU_STORE_KEY, null)
      set({ feishu: null })
    } catch (error) {
      console.error('[ChannelStore] Failed to clear feishu config:', error)
      throw error
    }
  }
}))

/**
 * Get default Telegram config
 */
export function getDefaultTelegramConfig(): TelegramConfig {
  return {
    enabled: false,
    name: 'Telegram',
    type: 'telegram',
    botToken: '',
    allowedChatIds: []
  }
}

/**
 * Get default Discord config
 */
export function getDefaultDiscordConfig(): DiscordConfig {
  return {
    enabled: false,
    name: 'Discord',
    type: 'discord',
    botToken: '',
    guildId: '',
    allowedChannelIds: []
  }
}

/**
 * Get default Feishu config
 */
export function getDefaultFeishuConfig(): FeishuConfig {
  return {
    enabled: false,
    name: 'Feishu',
    type: 'feishu',
    appId: '',
    appSecret: ''
  }
}