/**
 * P8: Multi-Platform Adaptation - PlatformManager Tests
 * 
 * TDD tests for platform detection and adapter selection.
 * Note: Tests use HARNESS_PLATFORM env var for isolation instead of mocking globals.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { 
  platformManager, 
  getPlatform, 
  getCapabilities, 
  supports,
  isDesktop,
  isMobile,
  getPlatformInfo,
  type PlatformType,
  type PlatformCapabilities
} from '../services/platform'

// Helper to create clean window mock
const createWindowMock = (overrides: Record<string, any> = {}) => ({
  location: { href: '' },
  electron: undefined,
  Telegram: undefined,
  ...overrides
})

describe('Platform Manager', () => {
  beforeEach(() => {
    // Reset platform manager state
    platformManager.reset()
    // Clear env
    vi.stubEnv('HARNESS_PLATFORM', '')
  })

  describe('platform detection via env var', () => {
    it('should use HARNESS_PLATFORM env var when set to electron', async () => {
      vi.stubEnv('HARNESS_PLATFORM', 'electron')
      
      await platformManager.initialize()
      
      expect(platformManager.getPlatform()).toBe('electron')
    })

    it('should use HARNESS_PLATFORM env var when set to web', async () => {
      vi.stubEnv('HARNESS_PLATFORM', 'web')
      
      await platformManager.initialize()
      
      expect(platformManager.getPlatform()).toBe('web')
    })

    it('should use HARNESS_PLATFORM env var when set to telegram', async () => {
      vi.stubEnv('HARNESS_PLATFORM', 'telegram')
      
      await platformManager.initialize()
      
      expect(platformManager.getPlatform()).toBe('telegram')
    })

    it('should use HARNESS_PLATFORM env var when set to feishu', async () => {
      vi.stubEnv('HARNESS_PLATFORM', 'feishu')
      
      await platformManager.initialize()
      
      expect(platformManager.getPlatform()).toBe('feishu')
    })
  })

  describe('getPlatformInfo', () => {
    it('should return platform info with correct type for electron', async () => {
      vi.stubEnv('HARNESS_PLATFORM', 'electron')
      await platformManager.initialize()
      
      const info = platformManager.getPlatformInfo()
      
      expect(info.type).toBe('electron')
      expect(info.name).toBe('Harness Desktop')
      expect(info.version).toBe('1.0.0')
      expect(info.capabilities).toBeDefined()
    })

    it('should return platform info with correct type for web', async () => {
      vi.stubEnv('HARNESS_PLATFORM', 'web')
      await platformManager.initialize()
      
      const info = platformManager.getPlatformInfo()
      
      expect(info.type).toBe('web')
      expect(info.name).toBe('Harness Web')
    })
  })

  describe('getCapabilities', () => {
    it('should return electron capabilities when on electron', async () => {
      vi.stubEnv('HARNESS_PLATFORM', 'electron')
      await platformManager.initialize()
      
      const caps = getCapabilities()
      
      expect(caps.fs.read).toBe(true)
      expect(caps.fs.write).toBe(true)
      expect(caps.ui.window).toBe(true)
      expect(caps.ui.tray).toBe(true)
    })

    it('should return web capabilities when on web', async () => {
      vi.stubEnv('HARNESS_PLATFORM', 'web')
      await platformManager.initialize()
      
      const caps = getCapabilities()
      
      expect(caps.fs.read).toBe(false)
      expect(caps.fs.write).toBe(false)
      expect(caps.ui.window).toBe(false)
      expect(caps.ui.tray).toBe(false)
    })

    it('should return telegram capabilities when on telegram', async () => {
      vi.stubEnv('HARNESS_PLATFORM', 'telegram')
      await platformManager.initialize()
      
      const caps = getCapabilities()
      
      // Telegram adapter now implemented - has telegram communication capability
      expect(caps.fs.read).toBe(false)
      expect(caps.fs.write).toBe(false)
      expect(caps.communication.telegram).toBe(true)
      expect(caps.communication.feishu).toBe(false)
    })
  })

  describe('supports', () => {
    it('should return true for available electron capabilities', async () => {
      vi.stubEnv('HARNESS_PLATFORM', 'electron')
      await platformManager.initialize()
      
      expect(supports('fs')).toBe(true)
      expect(supports('network')).toBe(true)
    })

    it('should return false for unavailable web capabilities', async () => {
      vi.stubEnv('HARNESS_PLATFORM', 'web')
      await platformManager.initialize()
      
      expect(supports('fs')).toBe(false)
      // Web has dialog: true, so supports('ui') returns true
      expect(supports('ui')).toBe(true)
    })
  })

  describe('isDesktop / isMobile', () => {
    it('should correctly identify desktop platform', async () => {
      vi.stubEnv('HARNESS_PLATFORM', 'electron')
      await platformManager.initialize()
      
      expect(isDesktop()).toBe(true)
      expect(isMobile()).toBe(false)
    })

    it('should correctly identify mobile platform', async () => {
      vi.stubEnv('HARNESS_PLATFORM', 'telegram')
      await platformManager.initialize()
      
      expect(isDesktop()).toBe(false)
      expect(isMobile()).toBe(true)
    })

    it('should identify feishu as mobile', async () => {
      vi.stubEnv('HARNESS_PLATFORM', 'feishu')
      await platformManager.initialize()
      
      expect(isDesktop()).toBe(false)
      expect(isMobile()).toBe(true)
    })
  })
})

describe('Platform Capabilities', () => {
  beforeEach(() => {
    platformManager.reset()
  })

  describe('Electron', () => {
    it('should have full filesystem capabilities', async () => {
      vi.stubEnv('HARNESS_PLATFORM', 'electron')
      await platformManager.initialize()
      
      const caps = getCapabilities()
      
      expect(caps.fs.read).toBe(true)
      expect(caps.fs.write).toBe(true)
      expect(caps.fs.watch).toBe(true)
      expect(caps.fs.selectDir).toBe(true)
    })

    it('should have full UI capabilities', async () => {
      vi.stubEnv('HARNESS_PLATFORM', 'electron')
      await platformManager.initialize()
      
      const caps = getCapabilities()
      
      expect(caps.ui.window).toBe(true)
      expect(caps.ui.dialog).toBe(true)
      expect(caps.ui.tray).toBe(true)
      expect(caps.ui.trayMenu).toBe(true)
    })

    it('should have communication capabilities', async () => {
      vi.stubEnv('HARNESS_PLATFORM', 'electron')
      await platformManager.initialize()
      
      const caps = getCapabilities()
      
      expect(caps.communication.webhooks).toBe(true)
      expect(caps.communication.telegram).toBe(false)
      expect(caps.communication.feishu).toBe(false)
    })
  })

  describe('Web', () => {
    it('should have limited filesystem capabilities', async () => {
      vi.stubEnv('HARNESS_PLATFORM', 'web')
      await platformManager.initialize()
      
      const caps = getCapabilities()
      
      expect(caps.fs.read).toBe(false)
      expect(caps.fs.write).toBe(false)
      expect(caps.fs.watch).toBe(false)
      expect(caps.fs.selectDir).toBe(false)
    })

    it('should have network capabilities', async () => {
      vi.stubEnv('HARNESS_PLATFORM', 'web')
      await platformManager.initialize()
      
      const caps = getCapabilities()
      
      expect(caps.network.http).toBe(true)
      expect(caps.network.websocket).toBe(true)
    })

    it('should have storage capabilities', async () => {
      vi.stubEnv('HARNESS_PLATFORM', 'web')
      await platformManager.initialize()
      
      const caps = getCapabilities()
      
      expect(caps.storage.localStorage).toBe(true)
      expect(caps.storage.indexedDB).toBe(true)
      expect(caps.storage.fileSystem).toBe(false)
    })
  })

  describe('Telegram', () => {
    it('should have limited filesystem (falls back to web)', async () => {
      vi.stubEnv('HARNESS_PLATFORM', 'telegram')
      await platformManager.initialize()
      
      const caps = getCapabilities()
      
      expect(caps.fs.read).toBe(false)
      expect(caps.fs.write).toBe(false)
    })

    it('should have webhooks communication', async () => {
      vi.stubEnv('HARNESS_PLATFORM', 'telegram')
      await platformManager.initialize()
      
      const caps = getCapabilities()
      
      expect(caps.communication.webhooks).toBe(true)
    })
  })

  describe('Feishu', () => {
    it('should have limited filesystem (falls back to web)', async () => {
      vi.stubEnv('HARNESS_PLATFORM', 'feishu')
      await platformManager.initialize()
      
      const caps = getCapabilities()
      
      expect(caps.fs.read).toBe(false)
      expect(caps.fs.write).toBe(false)
    })
  })
})