// Agent Market Types

export enum WorkflowCategory {
  PRODUCTIVITY = 'productivity',
  CREATIVE = 'creative',
  RESEARCH = 'research',
  AUTOMATION = 'automation',
  ANALYSIS = 'analysis'
}

export interface AuthorInfo {
  id: string
  name: string
  avatar?: string
}

export interface SerializedWorkflow {
  id: string
  name: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  config: Record<string, unknown>
}

export interface WorkflowNode {
  id: string
  type: string
  position: { x: number; y: number }
  data: Record<string, unknown>
}

export interface WorkflowEdge {
  id: string
  source: string
  target: string
  label?: string
}

export interface WorkflowConfig {
  timeout: number
  retries: number
  parallel: boolean
}

export interface WorkflowStats {
  downloads: number
  views: number
  rating: number
  ratingCount: number
}

export interface WorkflowPackage {
  id: string
  name: string
  version: string
  description: string
  author: AuthorInfo
  tags: string[]
  category: WorkflowCategory
  workflow: SerializedWorkflow
  config: WorkflowConfig
  stats: WorkflowStats
  publishedAt: number
  updatedAt: number
}

export interface SearchQuery {
  query?: string
  tags?: string[]
  category?: WorkflowCategory
  authorId?: string
  minRating?: number
  sortBy: 'relevance' | 'rating' | 'downloads' | 'recent'
  limit: number
  offset: number
}

export interface SearchResult {
  items: WorkflowPackage[]
  total: number
  hasMore: boolean
}

export interface Rating {
  userId: string
  workflowId: string
  stars: number
  comment?: string
  createdAt: number
}

export interface RatingSummary {
  average: number
  count: number
  distribution: { stars: number; count: number }[]
}

export interface MarketplaceConfig {
  storageKey: string
  maxWorkflows: number
  cacheDuration: number
}

export const defaultMarketplaceConfig: MarketplaceConfig = {
  storageKey: 'agent_marketplace',
  maxWorkflows: 1000,
  cacheDuration: 5 * 60 * 1000
}
