/**
 * Sandbox Store - Zustand + electron-store for sandbox config persistence
 */

import { create } from 'zustand'
import { ToolSandboxConfig } from '../services/tools/toolSandbox'

interface SandboxState {
  config: ToolSandboxConfig
  isInitialized: boolean
  loadConfig: () => Promise<void>
  updateConfig: (updates: Partial<ToolSandboxConfig>) => Promise<void>
  setEnabled: (enabled: boolean) => Promise<void>
  setWorkspaceRoot: (path: string) => Promise<void>
  addAllowedCommand: (cmd: string) => Promise<void>
  removeAllowedCommand: (cmd: string) => Promise<void>
  addBlockedPath: (path: string) => Promise<void>
  removeBlockedPath: (path: string) => Promise<void>
  resetToDefaults: () => Promise<void>
}

const DEFAULT_SANDBOX_CONFIG: ToolSandboxConfig = {
  enabled: true,
  workspaceRoot: process.cwd() || '/tmp',
  allowedCommands: ['git', 'npm', 'node', 'python', 'python3', 'bun', 'pnpm', 'yarn'],
  blockedPaths: ['/etc', '/root', '/home', '/sys', '/proc'],
  timeout: 30000
}

const ELECTRON_STORE_KEY = 'sandboxConfig'

// electron-store integration (lazy loaded to avoid SSR issues)
function getElectronStore() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Store = require('electron-store')
    return new Store()
  } catch {
    return null
  }
}

export const useSandboxStore = create<SandboxState>((set, get) => ({
  config: DEFAULT_SANDBOX_CONFIG,
  isInitialized: false,

  loadConfig: async () => {
    try {
      const store = getElectronStore()
      if (store) {
        const stored = store.get(ELECTRON_STORE_KEY) as ToolSandboxConfig | undefined
        if (stored) {
          set({ config: { ...DEFAULT_SANDBOX_CONFIG, ...stored }, isInitialized: true })
          return
        }
      }
    } catch (error) {
      console.warn('[SandboxStore] Failed to load config from electron-store:', error)
    }
    // Fallback: try window.electronAPI if available
    try {
      const electronAPI = (window as any).electronAPI
      if (electronAPI?.config?.get) {
        const stored = await electronAPI.config.get(ELECTRON_STORE_KEY) as ToolSandboxConfig | undefined
        if (stored) {
          set({ config: { ...DEFAULT_SANDBOX_CONFIG, ...stored }, isInitialized: true })
          return
        }
      }
    } catch (error) {
      console.warn('[SandboxStore] Failed to load config from electronAPI:', error)
    }
    set({ config: DEFAULT_SANDBOX_CONFIG, isInitialized: true })
  },

  updateConfig: async (updates) => {
    const newConfig = { ...get().config, ...updates }
    set({ config: newConfig })
    await persistConfig(newConfig)
  },

  setEnabled: async (enabled) => {
    await get().updateConfig({ enabled })
  },

  setWorkspaceRoot: async (path) => {
    await get().updateConfig({ workspaceRoot: path })
  },

  addAllowedCommand: async (cmd) => {
    const { config } = get()
    if (!config.allowedCommands.includes(cmd)) {
      await get().updateConfig({
        allowedCommands: [...config.allowedCommands, cmd]
      })
    }
  },

  removeAllowedCommand: async (cmd) => {
    const { config } = get()
    await get().updateConfig({
      allowedCommands: config.allowedCommands.filter(c => c !== cmd)
    })
  },

  addBlockedPath: async (path) => {
    const { config } = get()
    if (!config.blockedPaths.includes(path)) {
      await get().updateConfig({
        blockedPaths: [...config.blockedPaths, path]
      })
    }
  },

  removeBlockedPath: async (path) => {
    const { config } = get()
    await get().updateConfig({
      blockedPaths: config.blockedPaths.filter(p => p !== path)
    })
  },

  resetToDefaults: async () => {
    set({ config: DEFAULT_SANDBOX_CONFIG })
    await persistConfig(DEFAULT_SANDBOX_CONFIG)
  }
}))

/**
 * Persist config to electron-store
 */
async function persistConfig(config: ToolSandboxConfig): Promise<void> {
  try {
    const store = getElectronStore()
    if (store) {
      store.set(ELECTRON_STORE_KEY, config)
      return
    }
  } catch (error) {
    console.warn('[SandboxStore] Failed to persist to electron-store:', error)
  }
  // Fallback: try window.electronAPI
  try {
    const electronAPI = (window as any).electronAPI
    if (electronAPI?.config?.set) {
      await electronAPI.config.set(ELECTRON_STORE_KEY, config)
    }
  } catch (error) {
    console.warn('[SandboxStore] Failed to persist via electronAPI:', error)
  }
}