/**
 * P8: Multi-Platform Adaptation - Feishu Platform Adapter
 * 
 * Platform adapter for Feishu (Lark) Mini App environment.
 */

import type { PlatformAdapter, PlatformCapabilities, WebSocketAdapter } from '../types'

export class FeishuPlatformAdapter implements PlatformAdapter {
  readonly platform = 'feishu' as const
  private initialized: boolean = false

  async initialize(): Promise<void> {
    // Feishu detection is handled by platformManager
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
      communication: { telegram: false, feishu: true, webhooks: true }
    }
  }

  get fs() {
    return {
      readFile: async (_path: string): Promise<string> => {
        throw new Error('File system access not available in Feishu environment')
      },
      
      writeFile: async (_path: string, _content: string): Promise<void> => {
        throw new Error('File system access not available in Feishu environment')
      },
      
      exists: async (_path: string): Promise<boolean> => {
        throw new Error('File system access not available in Feishu environment')
      },
      
      readDir: async (_dirPath: string): Promise<Array<{ name: string; isDirectory: boolean; path: string }>> => {
        throw new Error('File system access not available in Feishu environment')
      },
      
      selectDirectory: async (): Promise<string | null> => {
        throw new Error('Directory selection not available in Feishu environment')
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
        // Feishu Mini App has its own notification API
        // Use lark.H5API or similar if available
        if (typeof window !== 'undefined' && (window as any).lark?.core?.H5API) {
          // Feishu native notification
          try {
            await (window as any).lark.core.H5API.showToast?.({ title, message: body })
          } catch {
            // Fallback
          }
        }
        // Fallback to web notification
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(title, { body })
        }
      },
      
      copyToClipboard: async (text: string): Promise<void> => {
        await navigator.clipboard.writeText(text)
      },
      
      openExternal: async (url: string): Promise<void> => {
        // In Feishu, use external link API if available
        const lark = (window as any).lark
        if (lark?.core?.H5API?.openLink) {
          lark.core.H5API.openLink(url)
        } else {
          window.open(url, '_blank', 'noopener,noreferrer')
        }
      },
      
      getLocale: (): string => {
        const lark = (window as any).lark
        // Feishu locale is usually in the URL or app context
        const href = window.location?.href || ''
        if (href.includes('lang=zh')) return 'zh'
        if (href.includes('lang=en')) return 'en'
        return lark?.core?.H5API?.getLanguage?.() || navigator.language || 'en'
      },
      
      getTimezone: (): string => {
        return Intl.DateTimeFormat().resolvedOptions().timeZone
      }
    }
  }

  get window() {
    return {
      minimize: async (): Promise<void> => {
        console.warn('Window minimize not available in Feishu environment')
      },
      
      maximize: async (): Promise<void> => {
        console.warn('Window maximize not available in Feishu environment')
      },
      
      close: async (): Promise<void> => {
        const lark = (window as any).lark
        if (lark?.core?.H5API?.closeWindow) {
          lark.core.H5API.closeWindow()
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
          const value = localStorage.getItem(`feishu_${key}`)
          return value ? JSON.parse(value) : null
        } catch {
          return null
        }
      },
      
      set: async <T>(key: string, value: T): Promise<void> => {
        localStorage.setItem(`feishu_${key}`, JSON.stringify(value))
      },
      
      remove: async (key: string): Promise<void> => {
        localStorage.removeItem(`feishu_${key}`)
      },
      
      clear: async (): Promise<void> => {
        // Only clear feishu-prefixed keys
        const keys = Object.keys(localStorage).filter(k => k.startsWith('feishu_'))
        keys.forEach(k => localStorage.removeItem(k))
      }
    }
  }
}