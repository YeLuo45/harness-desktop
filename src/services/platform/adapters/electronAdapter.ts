/**
 * P8: Multi-Platform Adaptation - Electron Platform Adapter
 * 
 * Platform adapter for Electron desktop environment.
 */

import type { PlatformAdapter, PlatformCapabilities, WebSocketAdapter } from '../types'
import type { ElectronAPI } from '../../types'

export class ElectronPlatformAdapter implements PlatformAdapter {
  readonly platform = 'electron' as const
  private electronAPI: ElectronAPI | null = null

  async initialize(): Promise<void> {
    // Get Electron API from window
    if (typeof window !== 'undefined' && 'electron' in window) {
      this.electronAPI = (window as any).electron
    }
  }

  getCapabilities(): PlatformCapabilities {
    return {
      fs: { read: true, write: true, watch: true, selectDir: true },
      network: { http: true, websocket: true },
      system: { notifications: true, clipboard: true, shell: true },
      ui: { window: true, dialog: true, tray: true, trayMenu: true },
      storage: { localStorage: true, indexedDB: true, fileSystem: true },
      communication: { telegram: false, feishu: false, webhooks: true }
    }
  }

  get fs() {
    return {
      readFile: async (path: string): Promise<string> => {
        const result = await this.electronAPI?.fs.readFile(path)
        if (result?.success) {
          return result.content || ''
        }
        throw new Error(result?.error || 'Failed to read file')
      },
      
      writeFile: async (path: string, content: string): Promise<void> => {
        const result = await this.electronAPI?.fs.writeFile(path, content)
        if (!result?.success) {
          throw new Error(result?.error || 'Failed to write file')
        }
      },
      
      exists: async (path: string): Promise<boolean> => {
        return await this.electronAPI?.fs.exists(path) || false
      },
      
      readDir: async (dirPath: string): Promise<Array<{ name: string; isDirectory: boolean; path: string }>> => {
        const entries = await this.electronAPI?.fs.readDir(dirPath)
        if (Array.isArray(entries)) {
          return entries
        }
        throw new Error('Failed to read directory')
      },
      
      selectDirectory: async (): Promise<string | null> => {
        return await this.electronAPI?.dialog.selectWorkDir() || null
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
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(title, { body })
        }
      },
      
      copyToClipboard: async (text: string): Promise<void> => {
        await navigator.clipboard.writeText(text)
      },
      
      openExternal: async (url: string): Promise<void> => {
        await this.electronAPI?.shell.openExternal(url)
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
        await this.electronAPI?.window.minimize()
      },
      
      maximize: async (): Promise<void> => {
        await this.electronAPI?.window.maximize()
      },
      
      close: async (): Promise<void> => {
        await this.electronAPI?.window.close()
      },
      
      isMaximized: async (): Promise<boolean> => {
        return await this.electronAPI?.window.isMaximized() || false
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