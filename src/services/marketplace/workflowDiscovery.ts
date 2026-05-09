import { SearchQuery, SearchResult, WorkflowPackage, WorkflowCategory } from './marketplaceTypes'
import { marketplace } from './marketplace'

export interface DiscoveryOptions {
  category?: WorkflowCategory
  tags?: string[]
  authorId?: string
}

export class WorkflowDiscovery {
  async search(query: string, options?: DiscoveryOptions): Promise<SearchResult> {
    const searchQuery: SearchQuery = {
      query,
      tags: options?.tags,
      category: options?.category,
      authorId: options?.authorId,
      sortBy: 'relevance',
      limit: 20,
      offset: 0
    }
    return marketplace.search(searchQuery)
  }

  async browseByCategory(category: WorkflowCategory, limit = 20, offset = 0): Promise<SearchResult> {
    return marketplace.search({
      category,
      sortBy: 'rating',
      limit,
      offset
    })
  }

  async browseByAuthor(authorId: string): Promise<WorkflowPackage[]> {
    return marketplace.getByAuthor(authorId)
  }

  async getFeatured(): Promise<WorkflowPackage[]> {
    return marketplace.getFeatured()
  }

  async getTrending(): Promise<WorkflowPackage[]> {
    return marketplace.getTrending()
  }

  async getRecent(limit = 20): Promise<SearchResult> {
    return marketplace.search({
      sortBy: 'recent',
      limit
    })
  }

  async getById(id: string): Promise<WorkflowPackage | undefined> {
    return marketplace.getById(id)
  }

  // Get related workflows (same category or overlapping tags)
  async getRelated(id: string, limit = 5): Promise<WorkflowPackage[]> {
    const pkg = await marketplace.getById(id)
    if (!pkg) return []

    const all = await marketplace.search({
      category: pkg.category,
      sortBy: 'rating',
      limit: 50
    })

    return all.items
      .filter(p => p.id !== id)
      .filter(p => p.tags.some(t => pkg.tags.includes(t)))
      .slice(0, limit)
  }

  // Get popular tags
  async getPopularTags(limit = 20): Promise<{ tag: string; count: number }[]> {
    const all = await marketplace.search({ sortBy: 'relevance', limit: 100 })
    const tagCounts = new Map<string, number>()

    all.items.forEach(pkg => {
      pkg.tags.forEach(tag => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)
      })
    })

    return Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
  }
}

export const workflowDiscovery = new WorkflowDiscovery()
