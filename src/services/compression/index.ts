// Compression types and interfaces
export * from './types'

// Compression strategies (original implementations)
export * from './strategies/lightweightStrategy'
export * from './strategies/moderateStrategy'
export * from './strategies/aggressiveStrategy'

// New strategy implementations
export { LightweightCompressionStrategy } from './strategies/lightweight'
export { ModerateCompressionStrategy } from './strategies/moderate'
export { AggressiveCompressionStrategy } from './strategies/aggressive'

// Orchestrator
export * from './compressionOrchestrator'

// Pointer index for efficient querying
export { PointerIndex, getPointerIndex, initPointerIndex } from './pointerIndex'

// File association tracker
export { FileAssociationTracker, getFileAssociationTracker, initFileAssociationTracker } from './fileAssociation'
export type { FileOperation, FileAssociation } from './fileAssociation'

// Re-export CompressionOptions
export type { CompressionOptions } from './compressionOrchestrator'
