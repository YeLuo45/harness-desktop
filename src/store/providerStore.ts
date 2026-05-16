/**
 * Provider Store
 * 
 * Persistent storage for provider configurations using window.electronAPI.config.
 * Provides save/load functionality for provider configs and current provider selection.
 */

import { create } from 'zustand'

// ElectronConfigStore interface (same as roleStore)
interface ElectronConfigStore {
  get: (key: string) => Promise<unknown>
  set: (key: string, value: unknown) => Promise<boolean>
  getAll: () => Promise<Record<string, unknown>>
}

// Provider types
export type ProviderName = 'openai' | 'anthropic' | 'azure' | 'google' | 'custom'

export interface ProviderConfigState {
  apiKey: string
  endpoint?: string  // custom endpoint
  model?: string
}

const PROVIDER_CURRENT_KEY = 'provider.current'
const PROVIDER_CONFIGS_KEY = 'provider.configs'

const defaultConfigs: Record<ProviderName, ProviderConfigState | null> = {
  openai: null,
  anthropic: null,
  azure: null,
  google: null,
  custom: null,
}

interface ProviderStore {
  // Current active provider name
  currentProvider: ProviderName
  // Provider configs (api keys, endpoints)
  configs: Record<ProviderName, ProviderConfigState | null>
  // Loading state
  isLoaded: boolean
  // Load from persistent storage
  loadProviderState: () => Promise<void>
  // Set current provider
  setCurrentProvider: (name: ProviderName) => void
  // Update provider config
  updateConfig: (name: ProviderName, config: ProviderConfigState) => void
  // Clear provider config
  clearConfig: (name: ProviderName) => void
}

/**
 * Get the electron store instance
 */
function getStore(): ElectronConfigStore {
  const electronAPI = (window as unknown as { electronAPI?: { config: ElectronConfigStore } }).electronAPI
  if (!electronAPI?.config) {
    throw new Error('electronAPI.config not available')
  }
  return electronAPI.config
}

export const useProviderStore = create<ProviderStore>((set, get) => ({
  currentProvider: 'openai',
  configs: { ...defaultConfigs },
  isLoaded: false,

  loadProviderState: async () => {
    try {
      const store = getStore()
      const [storedCurrent, storedConfigs] = await Promise.all([
        store.get(PROVIDER_CURRENT_KEY),
        store.get(PROVIDER_CONFIGS_KEY)
      ])
      
      set({
        currentProvider: (storedCurrent as ProviderName) || 'openai',
        configs: (storedConfigs as Record<ProviderName, ProviderConfigState | null>) || { ...defaultConfigs },
        isLoaded: true
      })
    } catch (error) {
      console.warn('[ProviderStore] Failed to load provider state:', error)
      set({ isLoaded: true })
    }
  },

  setCurrentProvider: (name) => {
    const store = getStore()
    store.set(PROVIDER_CURRENT_KEY, name).catch(console.error)
    set({ currentProvider: name })
    
    // Also update providerManager
    if (typeof window !== 'undefined') {
      import('../services/providers').then(({ providerManager }) => {
        providerManager.setCurrentProvider(name)
      }).catch(console.error)
    }
  },

  updateConfig: (name, config) => {
    const store = getStore()
    const configs = { ...get().configs, [name]: config }
    store.set(PROVIDER_CONFIGS_KEY, configs).catch(console.error)
    set({ configs })
    
    // Update providerManager with new config
    if (typeof window !== 'undefined') {
      import('../services/providers').then(({ providerManager }) => {
        providerManager.updateProviderConfig(name, config.apiKey, config.endpoint, config.model)
      }).catch(console.error)
    }
  },

  clearConfig: (name) => {
    const store = getStore()
    const configs = { ...get().configs, [name]: null }
    store.set(PROVIDER_CONFIGS_KEY, configs).catch(console.error)
    set({ configs })
  },
}))