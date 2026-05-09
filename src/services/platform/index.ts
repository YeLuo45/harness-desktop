/**
 * P8: Multi-Platform Adaptation - Platform Module
 * 
 * Export all platform-related types and utilities.
 */

export { 
  type PlatformType, 
  type PlatformAdapter, 
  type PlatformCapabilities,
  type PlatformInfo,
  type WebSocketAdapter,
  DEFAULT_CAPABILITIES 
} from './types'

export { platformManager, getPlatform, getCapabilities, supports, isDesktop, isMobile, getPlatformInfo } from './platformManager'

export { ElectronPlatformAdapter } from './adapters/electronAdapter'
export { WebPlatformAdapter } from './adapters/webAdapter'