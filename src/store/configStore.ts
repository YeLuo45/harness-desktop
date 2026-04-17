import { create } from 'zustand'
import type { AppConfig, ModelProvider } from '../types'

interface ConfigState {
  config: AppConfig
  loadConfig: () => Promise<void>
  updateConfig: (updates: Partial<AppConfig>) => Promise<void>
  setApiKey: (key: string) => Promise<void>
  setModel: (model: ModelProvider, endpoint?: string, modelName?: string) => Promise<void>
  setWorkDir: (dir: string) => Promise<void>
}

const defaultConfig: AppConfig = {
  apiKey: '',
  model: 'openai',
  modelEndpoint: 'https://api.openai.com/v1',
  modelName: 'gpt-4o',
  workDir: '',
  contextWindow: 128000,
  riskConfirmation: {
    medium: true,
    high: true
  },
  // v2: Verification config
  verification: {
    level: 'loose',
    autoRetry: true,
    maxRetries: 3,
    degradeOnFailure: true
  },
  // v2: SubAgent config
  subAgent: {
    enabled: false,
    maxConcurrentAgents: 4,
    maxKVCacheSize: 128000,
    maxSubtasks: 5
  }
}

export const useConfigStore = create<ConfigState>((set, get) => ({
  config: defaultConfig,

  loadConfig: async () => {
    try {
      const electronAPI = (window as any).electronAPI
      if (!electronAPI) {
        console.warn('electronAPI not available')
        return
      }
      const stored = await electronAPI.config.getAll()
      set({
        config: {
          apiKey: (stored.apiKey as string) || '',
          model: (stored.model as ModelProvider) || 'openai',
          modelEndpoint: (stored.modelEndpoint as string) || 'https://api.openai.com/v1',
          modelName: (stored.modelName as string) || 'gpt-4o',
          workDir: (stored.workDir as string) || '',
          contextWindow: (stored.contextWindow as number) || 128000,
          riskConfirmation: (stored.riskConfirmation as { medium: boolean; high: boolean }) || { medium: true, high: true },
          // v2: Load verification config
          verification: (stored.verification as AppConfig['verification']) || {
            level: 'loose',
            autoRetry: true,
            maxRetries: 3,
            degradeOnFailure: true
          },
          // v2: Load sub-agent config
          subAgent: (stored.subAgent as AppConfig['subAgent']) || {
            enabled: false,
            maxConcurrentAgents: 4,
            maxKVCacheSize: 128000,
            maxSubtasks: 5
          }
        }
      })
    } catch (error) {
      console.error('Failed to load config:', error)
    }
  },

  updateConfig: async (updates) => {
    const electronAPI = (window as any).electronAPI
    const newConfig = { ...get().config, ...updates }
    set({ config: newConfig })

    if (electronAPI) {
      for (const [key, value] of Object.entries(updates)) {
        await electronAPI.config.set(key, value)
      }
    }
  },

  setApiKey: async (key) => {
    const electronAPI = (window as any).electronAPI
    set((state) => ({ config: { ...state.config, apiKey: key } }))
    if (electronAPI) {
      await electronAPI.config.set('apiKey', key)
    }
  },

  setModel: async (model, endpoint, modelName) => {
    const electronAPI = (window as any).electronAPI
    const updates: Partial<AppConfig> = { model }

    if (endpoint) updates.modelEndpoint = endpoint
    if (modelName) updates.modelName = modelName

    set((state) => ({ config: { ...state.config, ...updates } }))

    if (electronAPI) {
      await electronAPI.config.set('model', model)
      if (endpoint) await electronAPI.config.set('modelEndpoint', endpoint)
      if (modelName) await electronAPI.config.set('modelName', modelName)
    }
  },

  setWorkDir: async (dir) => {
    const electronAPI = (window as any).electronAPI
    set((state) => ({ config: { ...state.config, workDir: dir } }))
    if (electronAPI) {
      await electronAPI.config.set('workDir', dir)
    }
  }
}))
