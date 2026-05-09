/**
 * P8: Multi-Platform Adaptation - Platform Types
 * 
 * Defines platform types and interfaces for cross-platform support.
 * Current: Electron only → Target: Web/Telegram/Feishu
 */

export type PlatformType = 'electron' | 'web' | 'telegram' | 'feishu'

export interface PlatformInfo {
  type: PlatformType
  name: string
  version: string
  capabilities: PlatformCapabilities
}

export interface PlatformCapabilities {
  // File system access
  fs: {
    read: boolean      // Can read files
    write: boolean      // Can write files
    watch: boolean       // Can watch file changes
    selectDir: boolean  // Can open directory picker
  }
  // Network
  network: {
    http: boolean       // Can make HTTP requests
    websocket: boolean  // Can use WebSocket
  }
  // System
  system: {
    notifications: boolean  // Can show native notifications
    clipboard: boolean       // Can access clipboard
    shell: boolean           // Can open external URLs
  }
  // UI
  ui: {
    window: boolean         // Has window management
    dialog: boolean         // Has native dialogs
    tray: boolean           // Has system tray
    trayMenu: boolean       // Has tray context menu
  }
  // Storage
  storage: {
    localStorage: boolean    // Has localStorage
    indexedDB: boolean       // Has IndexedDB
    fileSystem: boolean      // Has file system storage
  }
  // Communication
  communication: {
    telegram: boolean       // Telegram bot integration
    feishu: boolean         // Feishu integration
    webhooks: boolean       // Webhook support
  }
}

export interface PlatformAdapter {
  // Platform identification
  readonly platform: PlatformType
  
  // Initialize platform
  initialize(): Promise<void>
  
  // Capabilities
  getCapabilities(): PlatformCapabilities
  
  // File system operations
  fs: {
    readFile(path: string): Promise<string>
    writeFile(path: string, content: string): Promise<void>
    exists(path: string): Promise<boolean>
    readDir(path: string): Promise<Array<{ name: string; isDirectory: boolean; path: string }>>
    selectDirectory(): Promise<string | null>
  }
  
  // Network operations
  network: {
    fetch(url: string, options?: RequestInit): Promise<Response>
    websocket(url: string, onMessage: (data: string) => void): WebSocketAdapter
  }
  
  // System operations
  system: {
    showNotification(title: string, body: string): Promise<void>
    copyToClipboard(text: string): Promise<void>
    openExternal(url: string): Promise<void>
    getLocale(): string
    getTimezone(): string
  }
  
  // Window operations
  window: {
    minimize(): Promise<void>
    maximize(): Promise<void>
    close(): Promise<void>
    isMaximized(): Promise<boolean>
  }
  
  // Storage operations
  storage: {
    get<T>(key: string): Promise<T | null>
    set<T>(key: string, value: T): Promise<void>
    remove(key: string): Promise<void>
    clear(): Promise<void>
  }
}

export interface WebSocketAdapter {
  send(data: string): void
  close(): void
  onOpen(callback: () => void): void
  onClose(callback: () => void): void
  onError(callback: (error: Error) => void): void
}

// Default capabilities by platform
export const DEFAULT_CAPABILITIES: Record<PlatformType, PlatformCapabilities> = {
  electron: {
    fs: { read: true, write: true, watch: true, selectDir: true },
    network: { http: true, websocket: true },
    system: { notifications: true, clipboard: true, shell: true },
    ui: { window: true, dialog: true, tray: true, trayMenu: true },
    storage: { localStorage: true, indexedDB: true, fileSystem: true },
    communication: { telegram: false, feishu: false, webhooks: true }
  },
  web: {
    fs: { read: false, write: false, watch: false, selectDir: false },
    network: { http: true, websocket: true },
    system: { notifications: true, clipboard: true, shell: true },
    ui: { window: false, dialog: true, tray: false, trayMenu: false },
    storage: { localStorage: true, indexedDB: true, fileSystem: false },
    communication: { telegram: false, feishu: false, webhooks: true }
  },
  telegram: {
    fs: { read: false, write: false, watch: false, selectDir: false },
    network: { http: true, websocket: true },
    system: { notifications: true, clipboard: true, shell: false },
    ui: { window: false, dialog: false, tray: false, trayMenu: false },
    storage: { localStorage: true, indexedDB: false, fileSystem: false },
    communication: { telegram: true, feishu: false, webhooks: true }
  },
  feishu: {
    fs: { read: false, write: false, watch: false, selectDir: false },
    network: { http: true, websocket: true },
    system: { notifications: true, clipboard: true, shell: false },
    ui: { window: false, dialog: false, tray: false, trayMenu: false },
    storage: { localStorage: true, indexedDB: false, fileSystem: false },
    communication: { telegram: false, feishu: true, webhooks: true }
  }
}