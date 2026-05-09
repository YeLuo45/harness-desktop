import type { WorkflowPackage, MarketplaceConfig, defaultMarketplaceConfig } from './marketplaceTypes'

const STORAGE_KEY = 'agent_marketplace_store'

export class MarketplaceStore {
  private cache: Map<string, WorkflowPackage> = new Map()
  private index: string[] = []
  
  async init(): Promise<void> {
    try {
      const data = localStorage.getItem(STORAGE_KEY)
      if (data) {
        const parsed = JSON.parse(data)
        this.cache = new Map(parsed.cache || [])
        this.index = parsed.index || []
      }
    } catch (e) {
      console.warn('Failed to load marketplace store:', e)
    }
  }
  
  async save(): Promise<void> {
    try {
      const data = {
        cache: Array.from(this.cache.entries()),
        index: this.index
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (e) {
      console.warn('Failed to save marketplace store:', e)
    }
  }
  
  async set(id: string, pkg: WorkflowPackage): Promise<void> {
    this.cache.set(id, pkg)
    if (!this.index.includes(id)) {
      this.index.push(id)
    }
    await this.save()
  }
  
  async get(id: string): Promise<WorkflowPackage | undefined> {
    return this.cache.get(id)
  }
  
  async delete(id: string): Promise<void> {
    this.cache.delete(id)
    this.index = this.index.filter(i => i !== id)
    await this.save()
  }
  
  async getAll(): Promise<WorkflowPackage[]> {
    return this.index.map(id => this.cache.get(id)).filter(Boolean) as WorkflowPackage[]
  }
  
  async clear(): Promise<void> {
    this.cache.clear()
    this.index = []
    await this.save()
  }
}

export const marketplaceStore = new MarketplaceStore()
