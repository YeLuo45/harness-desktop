/**
 * P8: Multi-Platform Adaptation - Platform Manager
 * 
 * Central manager for platform detection and adapter selection.
 */

import { 
  type PlatformType, 
  type PlatformAdapter, 
  type PlatformCapabilities,
  type PlatformInfo,
  DEFAULT_CAPABILITIES 
} from './types'
import { ElectronPlatformAdapter } from './adapters/electronAdapter'
import { WebPlatformAdapter } from './adapters/webAdapter'
import { TelegramPlatformAdapter } from './adapters/telegramAdapter'
import { FeishuPlatformAdapter } from './adapters/feishuAdapter'

export { type PlatformType, type PlatformAdapter, type PlatformCapabilities }

const platformAdapters: Record<PlatformType, PlatformAdapter | null> = {
  electron: null,
  web: null,
  telegram: null,
  feishu: null
}

class PlatformManager {
  private currentPlatform: PlatformType = 'electron'
  private adapter: PlatformAdapter | null = null
  private initialized: boolean = false

  /**
   * Reset manager state (for testing)
   */
  reset(): void {
    this.currentPlatform = 'electron'
    this.adapter = null
    this.initialized = false
  }

  /**
   * Initialize platform detection and adapter
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    // Detect current platform
    this.currentPlatform = this.detectPlatform()
    
    // Create appropriate adapter
    this.adapter = await this.createAdapter(this.currentPlatform)
    
    // Initialize the adapter
    if (this.adapter) {
      await this.adapter.initialize()
    }
    
    this.initialized = true
  }

  /**
   * Detect the current platform
   */
  detectPlatform(): PlatformType {
    // Check environment variables first (for testing)
    const envPlatform = process.env.HARNESS_PLATFORM
    if (envPlatform && ['electron', 'web', 'telegram', 'feishu'].includes(envPlatform)) {
      return envPlatform as PlatformType
    }

    // Check if running in Electron
    if (typeof window !== 'undefined' && 'electron' in window) {
      return 'electron'
    }

    // Check if running in Telegram Mini App
    if (typeof window !== 'undefined' && 'Telegram' in window) {
      return 'telegram'
    }

    // Check if running in Feishu
    if (typeof window !== 'undefined') {
      const href = window.location?.href || ''
      if (href.includes('feishu') || href.includes('larksuite')) {
        return 'feishu'
      }
    }

    // Default to web
    return 'web'
  }

  /**
   * Create adapter for platform
   */
  private async createAdapter(platform: PlatformType): Promise<PlatformAdapter | null> {
    switch (platform) {
      case 'electron':
        if (platformAdapters.electron) return platformAdapters.electron
        return new ElectronPlatformAdapter()
      
      case 'web':
        if (platformAdapters.web) return platformAdapters.web
        return new WebPlatformAdapter()
      
      case 'telegram':
        if (platformAdapters.telegram) return platformAdapters.telegram
        return new TelegramPlatformAdapter()
      
      case 'feishu':
        if (platformAdapters.feishu) return platformAdapters.feishu
        return new FeishuPlatformAdapter()
      
      default:
        return null
    }
  }

  /**
   * Get current platform
   */
  getPlatform(): PlatformType {
    return this.currentPlatform
  }

  /**
   * Get current adapter
   */
  getAdapter(): PlatformAdapter | null {
    return this.adapter
  }

  /**
   * Get platform info
   */
  getPlatformInfo(): PlatformInfo {
    const capabilities = this.adapter?.getCapabilities() || DEFAULT_CAPABILITIES[this.currentPlatform]
    
    return {
      type: this.currentPlatform,
      name: this.getPlatformName(this.currentPlatform),
      version: '1.0.0',
      capabilities
    }
  }

  /**
   * Get capabilities for current platform
   */
  getCapabilities(): PlatformCapabilities {
    return this.adapter?.getCapabilities() || DEFAULT_CAPABILITIES[this.currentPlatform]
  }

  /**
   * Check if platform supports a capability
   */
  supports(capability: keyof PlatformCapabilities): boolean {
    const caps = this.getCapabilities()
    const value = caps[capability]
    if (typeof value === 'boolean') return value
    // For nested capabilities (fs, network, system, ui, storage, communication),
    // check if any capability is true
    return Object.values(value as Record<string, boolean>).some(Boolean)
  }

  /**
   * Check if current platform is desktop (Electron)
   */
  isDesktop(): boolean {
    return this.currentPlatform === 'electron'
  }

  /**
   * Check if current platform is mobile web
   */
  isMobile(): boolean {
    return this.currentPlatform === 'telegram' || this.currentPlatform === 'feishu'
  }

  /**
   * Get platform display name
   */
  private getPlatformName(platform: PlatformType): string {
    const names: Record<PlatformType, string> = {
      electron: 'Harness Desktop',
      web: 'Harness Web',
      telegram: 'Harness Telegram',
      feishu: 'Harness Feishu'
    }
    return names[platform]
  }

  /**
   * Register a custom platform adapter
   */
  registerAdapter(platform: PlatformType, adapter: PlatformAdapter): void {
    platformAdapters[platform] = adapter
  }

  /**
   * Switch to a different platform (for testing)
   */
  async switchPlatform(platform: PlatformType): Promise<void> {
    this.currentPlatform = platform
    this.adapter = await this.createAdapter(platform)
    if (this.adapter) {
      await this.adapter.initialize()
    }
  }
}

// Singleton instance
export const platformManager = new PlatformManager()

// Export convenience functions
export const getPlatform = () => platformManager.getPlatform()
export const getCapabilities = () => platformManager.getCapabilities()
export const supports = (capability: keyof PlatformCapabilities) => platformManager.supports(capability)
export const isDesktop = () => platformManager.isDesktop()
export const isMobile = () => platformManager.isMobile()
export const getPlatformInfo = () => platformManager.getPlatformInfo()