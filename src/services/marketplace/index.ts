// Agent Marketplace - barrel export

export * from './marketplaceTypes'
export { Marketplace, marketplace } from './marketplace'
export { MarketplaceStore, marketplaceStore } from './marketplaceStore'
export { WorkflowPublisher, workflowPublisher } from './workflowPublisher'
export { WorkflowDiscovery, workflowDiscovery } from './workflowDiscovery'
export { RatingService, ratingService } from './ratingService'

/*
Quick Start:

import { marketplace, workflowPublisher, workflowDiscovery, ratingService } from './marketplace'

// Publish a workflow
const id = await workflowPublisher.publish({
  name: 'My Agent Workflow',
  description: 'An awesome agent workflow',
  tags: ['productivity', 'automation'],
  category: 'automation',
  workflow: { id: 'wf1', name: 'My Workflow', nodes: [], edges: [], config: {} },
  config: { timeout: 30000, retries: 3, parallel: false },
  author: { id: 'user1', name: 'John' }
})

// Search workflows
const results = await workflowDiscovery.search('automation', { category: 'automation' })

// Rate a workflow
await ratingService.rate({ workflowId: id, userId: 'user1', stars: 5, comment: 'Great!' })

// Get featured
const featured = await workflowDiscovery.getFeatured()
*/
