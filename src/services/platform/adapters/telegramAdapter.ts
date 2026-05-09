/**
 * P8: Multi-Platform Adaptation - Telegram Platform Adapter
 * 
 * Platform adapter for Telegram Mini App environment.
 */

import type { PlatformAdapter, PlatformCapabilities, WebSocketAdapter } from '../types'

export class TelegramPlatformAdapter implements PlatformAdapter {
  readonly platform = 'telegram' as const
  private initialized: boolean = false

  async initialize(): Promise<void> {
    // Telegram Mini App detection is handled by platformManager
    // No additional initialization needed
    this.initialized = true
  }

  getCapabilities(): PlatformCapabilities {
    return {
      fs: { read: false, write: false, watch: false, selectDir: false },
      network: { http: true, websocket: true },
      system: { notifications: true, clipboard: true, shell: false },
      ui: { window: false, dialog: false, tray: false, trayMenu: false },
      storage: { localStorage: true, indexedDB: false, fileSystem: false },
      communication: { telegram: true, feishu: false, webhooks: true }
    }
  }

  get fs() {
    return {
      readFile: async (_path: string): Promise<string> => {
        throw new Error('File system access not available in Telegram environment')
      },
      
      writeFile: async (_path: string, _content: string): Promise<void> => {
        throw new Error('File system access not available in Telegram environment')
      },
      
      exists: async (_path: string): Promise<boolean> => {
        throw new Error('File system access not available in Telegram environment')
      },
      
      readDir: async (_dirPath: string): Promise<Array<{ name: string; isDirectory: boolean; path: string }>> => {
        throw new Error('File system access not available in Telegram environment')
      },
      
      selectDirectory: async (): Promise<string | null> => {
        throw new Error('Directory selection not available in Telegram environment')
      }
    }
  }

  get network() {
    return {
      fetch: async (url: string, options?: RequestInit): Promise<Response> => {
        return fetch(url, options)
      },
      
      websocket: (url: string, onMessage: (data: string) => void): WebSocketAdapter => {
        const ws = new WebSocket(url)
        
        return {
          send: (data: string) => ws.send(data),
          close: () => ws.close(),
          onOpen: (callback: () => void) => { ws.onopen = callback },
          onClose: (callback: () => void) => { ws.onclose = callback },
          onError: (callback: (error: Error) => void) => { ws.onerror = () => callback(new Error('WebSocket error')) }
        }
      }
    }
  }

  get system() {
    return {
      showNotification: async (title: string, body: string): Promise<void> => {
        // Telegram Mini Apps have their own notification system
        // Use Telegram's showPopup or similar if available
        if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.HapticFeedback) {
          (window as any).Telegram.WebApp.HapticFeedback.notificationOccurred('success')
        }
        // Fallback to web notification if available
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(title, { body })
        }
      },
      
      copyToClipboard: async (text: string): Promise<void> => {
        await navigator.clipboard.writeText(text)
      },
      
      openExternal: async (url: string): Promise<void> => {
        // In Telegram Mini App, use linkTelegramMethod if available
        const tg = (window as any).Telegram?.WebApp
        if (tg?.openTelegramLink) {
          tg.openTelegramLink(url)
        } else {
          window.open(url, '_blank', 'noopener,noreferrer')
        }
      },
      
      getLocale: (): string => {
        const tg = (window as any).Telegram?.WebApp
        return tg?.initDataUnsafe?.user?.language_code || navigator.language || 'en'
      },
      
      getTimezone: (): string => {
        return Intl.DateTimeFormat().resolvedOptions().timeZone
      }
    }
  }

  get window() {
    return {
      minimize: async (): Promise<void> => {
        console.warn('Window minimize not available in Telegram environment')
      },
      
      maximize: async (): Promise<void> => {
        console.warn('Window maximize not available in Telegram environment')
      },
      
      close: async (): Promise<void> => {
        const tg = (window as any).Telegram?.WebApp
        if (tg?.close) {
          tg.close()
        }
      },
      
      isMaximized: async (): Promise<boolean> => {
        return false
      }
    }
  }

  get storage() {
    return {
      get: async <T>(key: string): Promise<T | null> => {
        try {
          const value = localStorage.getItem(`telegram_${key}`)
          return value ? JSON.parse(value) : null
        } catch {
          return null
        }
      },
      
      set: async <T>(key: string, value: T): Promise<void> => {
        localStorage.setItem(`telegram_${key}`, JSON.stringify(value))
      },
      
      remove: async (key: string): Promise<void> => {
        localStorage.removeItem(`telegram_${key}`)
      },
      
      clear: async (): Promise<void> => {
        // Only clear telegram-prefixed keys
        const keys = Object.keys(localStorage).filter(k => k.startsWith('telegram_'))
        keys.forEach(k => localStorage.removeItem(k))
      }
    }
  }
}