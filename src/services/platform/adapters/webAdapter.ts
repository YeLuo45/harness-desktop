/**
 * P8: Multi-Platform Adaptation - Web Platform Adapter
 * 
 * Platform adapter for web environments (including Telegram Mini App and Feishu web).
 */

import type { PlatformAdapter, PlatformCapabilities, WebSocketAdapter } from '../types'

export class WebPlatformAdapter implements PlatformAdapter {
  readonly platform = 'web' as const

  async initialize(): Promise<void> {
    // No special initialization needed for web
  }

  getCapabilities(): PlatformCapabilities {
    return {
      fs: { read: false, write: false, watch: false, selectDir: false },
      network: { http: true, websocket: true },
      system: { notifications: this.supportsNotifications(), clipboard: true, shell: true },
      ui: { window: false, dialog: true, tray: false, trayMenu: false },
      storage: { localStorage: true, indexedDB: true, fileSystem: false },
      communication: { telegram: false, feishu: false, webhooks: true }
    }
  }

  private supportsNotifications(): boolean {
    if (typeof window === 'undefined') return false
    return 'Notification' in window
  }

  get fs() {
    return {
      readFile: async (_path: string): Promise<string> => {
        throw new Error('File system access not available in web environment')
      },
      
      writeFile: async (_path: string, _content: string): Promise<void> => {
        throw new Error('File system access not available in web environment')
      },
      
      exists: async (_path: string): Promise<boolean> => {
        throw new Error('File system access not available in web environment')
      },
      
      readDir: async (_dirPath: string): Promise<Array<{ name: string; isDirectory: boolean; path: string }>> => {
        throw new Error('File system access not available in web environment')
      },
      
      selectDirectory: async (): Promise<string | null> => {
        // Use file input as fallback
        return new Promise((resolve) => {
          const input = document.createElement('input')
          input.type = 'file'
          input.webkitdirectory = true
          input.onchange = () => {
            const dir = input.files?.[0]?.webkitRelativePath?.split('/')[0] || null
            resolve(dir)
          }
          input.click()
        })
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
        if ('Notification' in window) {
          if (Notification.permission === 'granted') {
            new Notification(title, { body })
          } else if (Notification.permission !== 'denied') {
            const permission = await Notification.requestPermission()
            if (permission === 'granted') {
              new Notification(title, { body })
            }
          }
        }
      },
      
      copyToClipboard: async (text: string): Promise<void> => {
        await navigator.clipboard.writeText(text)
      },
      
      openExternal: async (url: string): Promise<void> => {
        window.open(url, '_blank', 'noopener,noreferrer')
      },
      
      getLocale: (): string => {
        return navigator.language || 'en-US'
      },
      
      getTimezone: (): string => {
        return Intl.DateTimeFormat().resolvedOptions().timeZone
      }
    }
  }

  get window() {
    return {
      minimize: async (): Promise<void> => {
        // Web apps cannot control window
        console.warn('Window minimize not available in web environment')
      },
      
      maximize: async (): Promise<void> => {
        // Web apps cannot control window
        console.warn('Window maximize not available in web environment')
      },
      
      close: async (): Promise<void> => {
        // Web apps cannot control window
        console.warn('Window close not available in web environment')
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
          const value = localStorage.getItem(key)
          return value ? JSON.parse(value) : null
        } catch {
          return null
        }
      },
      
      set: async <T>(key: string, value: T): Promise<void> => {
        localStorage.setItem(key, JSON.stringify(value))
      },
      
      remove: async (key: string): Promise<void> => {
        localStorage.removeItem(key)
      },
      
      clear: async (): Promise<void> => {
        localStorage.clear()
      }
    }
  }
}