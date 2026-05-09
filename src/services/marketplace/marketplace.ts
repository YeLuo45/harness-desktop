import {
  WorkflowPackage,
  SearchQuery,
  SearchResult,
  WorkflowCategory,
  Rating,
  RatingSummary,
  AuthorInfo,
  SerializedWorkflow,
  WorkflowStats
} from './marketplaceTypes'
import { marketplaceStore } from './marketplaceStore'

// Simple ID generator
const generateId = (): string => Math.random().toString(36).substring(2, 15)

// Fuzzy search helper
const fuzzyMatch = (text: string, query: string): boolean => {
  const lower = text.toLowerCase()
  const q = query.toLowerCase()
  return lower.includes(q)
}

export class Marketplace {
  private initialized = false

  async init(): Promise<void> {
    if (this.initialized) return
    await marketplaceStore.init()
    this.initialized = true
  }

  async publish(pkg: Omit<WorkflowPackage, 'id' | 'stats' | 'publishedAt' | 'updatedAt'>): Promise<string> {
    await this.init()
    const id = generateId()
    const now = Date.now()
    const fullPkg: WorkflowPackage = {
      ...pkg,
      id,
      stats: { downloads: 0, views: 0, rating: 0, ratingCount: 0 },
      publishedAt: now,
      updatedAt: now
    }
    await marketplaceStore.set(id, fullPkg)
    return id
  }

  async unpublish(id: string): Promise<void> {
    await this.init()
    await marketplaceStore.delete(id)
  }

  async update(id: string, updates: Partial<WorkflowPackage>): Promise<void> {
    await this.init()
    const existing = await marketplaceStore.get(id)
    if (!existing) throw new Error(`Workflow ${id} not found`)
    const updated: WorkflowPackage = {
      ...existing,
      ...updates,
      id,
      updatedAt: Date.now()
    }
    await marketplaceStore.set(id, updated)
  }

  async getById(id: string): Promise<WorkflowPackage | undefined> {
    await this.init()
    const pkg = await marketplaceStore.get(id)
    if (pkg) {
      // Increment view count
      pkg.stats.views++
      await marketplaceStore.set(id, pkg)
    }
    return pkg
  }

  async getByAuthor(authorId: string): Promise<WorkflowPackage[]> {
    await this.init()
    const all = await marketplaceStore.getAll()
    return all.filter(p => p.author.id === authorId)
  }

  async search(query: SearchQuery): Promise<SearchResult> {
    await this.init()
    let results = await marketplaceStore.getAll()

    // Filter by text query
    if (query.query) {
      const q = query.query.toLowerCase()
      results = results.filter(p =>
        fuzzyMatch(p.name, q) ||
        fuzzyMatch(p.description, q) ||
        p.tags.some(t => fuzzyMatch(t, q))
      )
    }

    // Filter by category
    if (query.category) {
      results = results.filter(p => p.category === query.category)
    }

    // Filter by author
    if (query.authorId) {
      results = results.filter(p => p.author.id === query.authorId)
    }

    // Filter by min rating
    if (query.minRating !== undefined) {
      results = results.filter(p => p.stats.rating >= query.minRating!)
    }

    // Filter by tags
    if (query.tags && query.tags.length > 0) {
      results = results.filter(p =>
        query.tags!.some(t => p.tags.includes(t))
      )
    }

    // Sort
    switch (query.sortBy) {
      case 'rating':
        results.sort((a, b) => b.stats.rating - a.stats.rating)
        break
      case 'downloads':
        results.sort((a, b) => b.stats.downloads - a.stats.downloads)
        break
      case 'recent':
        results.sort((a, b) => b.publishedAt - a.publishedAt)
        break
      default:
        // relevance - use view count as proxy
        results.sort((a, b) => b.stats.views - a.stats.views)
    }

    const total = results.length
    const offset = query.offset || 0
    const limit = query.limit || 20
    const items = results.slice(offset, offset + limit)

    return {
      items,
      total,
      hasMore: offset + limit < total
    }
  }

  async getFeatured(): Promise<WorkflowPackage[]> {
    await this.init()
    const all = await marketplaceStore.getAll()
    return all
      .filter(p => p.stats.ratingCount >= 3)
      .sort((a, b) => b.stats.rating - a.stats.rating)
      .slice(0, 10)
  }

  async getTrending(): Promise<WorkflowPackage[]> {
    await this.init()
    const all = await marketplaceStore.getAll()
    return all
      .sort((a, b) => b.stats.downloads - a.stats.downloads)
      .slice(0, 10)
  }

  // Rating methods
  private ratings: Map<string, Rating[]> = new Map()

  async rate(workflowId: string, userId: string, stars: number, comment?: string): Promise<void> {
    const ratings = this.ratings.get(workflowId) || []
    const existingIdx = ratings.findIndex(r => r.userId === userId)
    const rating: Rating = {
      userId,
      workflowId,
      stars: Math.max(1, Math.min(5, stars)),
      comment,
      createdAt: Date.now()
    }
    
    if (existingIdx >= 0) {
      ratings[existingIdx] = rating
    } else {
      ratings.push(rating)
    }
    this.ratings.set(workflowId, ratings)

    // Update workflow stats
    const pkg = await marketplaceStore.get(workflowId)
    if (pkg) {
      const count = ratings.length
      const avg = ratings.reduce((sum, r) => sum + r.stars, 0) / count
      pkg.stats.rating = Math.round(avg * 10) / 10
      pkg.stats.ratingCount = count
      await marketplaceStore.set(workflowId, pkg)
    }
  }

  async getRatings(workflowId: string): Promise<Rating[]> {
    return this.ratings.get(workflowId) || []
  }

  async getRatingSummary(workflowId: string): Promise<RatingSummary> {
    const ratings = this.ratings.get(workflowId) || []
    if (ratings.length === 0) {
      return { average: 0, count: 0, distribution: [] }
    }
    
    const sum = ratings.reduce((s, r) => s + r.stars, 0)
    const avg = sum / ratings.length
    const distribution: { stars: number; count: number }[] = []
    
    for (let i = 1; i <= 5; i++) {
      const count = ratings.filter(r => r.stars === i).length
      distribution.push({ stars: i, count })
    }
    
    return {
      average: Math.round(avg * 10) / 10,
      count: ratings.length,
      distribution
    }
  }

  // Download tracking
  async trackDownload(workflowId: string): Promise<void> {
    const pkg = await marketplaceStore.get(workflowId)
    if (pkg) {
      pkg.stats.downloads++
      await marketplaceStore.set(workflowId, pkg)
    }
  }
}

export const marketplace = new Marketplace()
