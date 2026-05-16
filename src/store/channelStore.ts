/**
 * Channel Store
 * 
 * Persistent storage for channel configurations using zustand + electron-store.
 * Manages Telegram, Discord, Feishu and future channel configs.
 * Bot tokens are stored securely via electron-store IPC.
 */

import { create } from 'zustand'
import type { TelegramConfig } from '../channels/types'

const CHANNEL_STORE_KEY = 'channelConfig'

interface ChannelState {
  telegram: TelegramConfig | null
  loadTelegramConfig: () => Promise<void>
  saveTelegramConfig: (config: TelegramConfig) => Promise<void>
  updateTelegramConfig: (updates: Partial<TelegramConfig>) => Promise<void>
  setTelegramEnabled: (enabled: boolean) => Promise<void>
  clearTelegramConfig: () => Promise<void>
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

  loadTelegramConfig: async () => {
    try {
      const store = getElectronConfigStore()
      if (!store) {
        console.warn('[ChannelStore] electronAPI not available')
        return
      }

      const stored = await store.get(CHANNEL_STORE_KEY) as TelegramConfig | undefined
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

      await store.set(CHANNEL_STORE_KEY, config)
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

      await store.set(CHANNEL_STORE_KEY, null)
      set({ telegram: null })
    } catch (error) {
      console.error('[ChannelStore] Failed to clear telegram config:', error)
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