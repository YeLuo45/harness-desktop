/**
 * Hierarchy Services - P17 Hierarchy System
 * 
 * Hierarchical tree structure management system for organizing
 * and traversing tree-like data structures.
 * 
 * @example
 * import { 
 *   hierarchyService,
 *   HierarchyService,
 *   hierarchyTraversal,
 *   hierarchyNode,
 * } from '@/services/hierarchy';
 */

// Types
export * from './hierarchyTypes';

// Core Service
export { HierarchyService, hierarchyService } from './hierarchyService';
export { DEFAULT_HIERARCHY_CONFIG } from './hierarchyService';

// Node Utilities
export * from './hierarchyNode';

// Traversal Utilities
export * from './hierarchyTraversal';

// ============================================================================
// Quick Start Example
// ============================================================================

/**
 * Quick Start: Create and manage hierarchical structures
 * 
 * ```typescript
 * import { hierarchyService } from '@/services/hierarchy';
 * 
 * async function main() {
 *   // 1. Create a new hierarchy tree
 *   const tree = hierarchyService.createTree('Organization Chart');
 *   
 *   // 2. Add nodes
 *   const engineering = hierarchyService.addNode(tree.id, {
 *     name: 'Engineering',
 *     type: 'branch',
 *   });
 *   
 *   const frontend = hierarchyService.addNode(tree.id, {
 *     name: 'Frontend Team',
 *     type: 'branch',
 *     parentId: engineering.id,
 *   });
 *   
 *   const backend = hierarchyService.addNode(tree.id, {
 *     name: 'Backend Team',
 *     type: 'branch',
 *     parentId: engineering.id,
 *   });
 *   
 *   // 3. Add leaf nodes
 *   hierarchyService.addNode(tree.id, {
 *     name: 'Alice',
 *     type: 'leaf',
 *     parentId: frontend.id,
 *     metadata: { role: 'Senior Developer' },
 *   });
 *   
 *   hierarchyService.addNode(tree.id, {
 *     name: 'Bob',
 *     type: 'leaf',
 *     parentId: backend.id,
 *     metadata: { role: 'Backend Developer' },
 *   });
 *   
 *   // 4. Query the tree
 *   const children = hierarchyService.getChildren(tree.id, engineering.id);
 *   console.log('Engineering teams:', children.map(c => c.name));
 *   
 *   const ancestors = hierarchyService.getAncestors(tree.id, 'alice-node-id');
 *   console.log('Alice ancestry:', ancestors.map(a => a.name));
 *   
 *   // 5. Listen to changes
 *   hierarchyService.subscribe(tree.id, (event) => {
 *     console.log(`[${event.type}]`, event.nodeId);
 *   });
 *   
 *   // 6. Move a node
 *   hierarchyService.moveNode(tree.id, 'bob-node-id', frontend.id);
 * }
 * 
 * main();
 * ```
 */

/**
 * Quick Start: Traverse hierarchies
 * 
 * ```typescript
 * import { 
 *   hierarchyTraversal,
 *   hierarchyService,
 * } from '@/services/hierarchy';
 * 
 * function traverse() {
 *   const tree = hierarchyService.createTree('Test Tree');
 *   const nodeA = hierarchyService.addNode(tree.id, { name: 'A' });
 *   hierarchyService.addNode(tree.id, { name: 'B', parentId: nodeA.id });
 *   hierarchyService.addNode(tree.id, { name: 'C', parentId: nodeA.id });
 *   
 *   // Breadth-first traversal
 *   const bfsResults = hierarchyTraversal.breadthFirstTraversal(tree);
 *   console.log('BFS:', bfsResults.map(r => r.nodeId));
 *   
 *   // Depth-first traversal
 *   const dfsResults = hierarchyTraversal.depthFirstTraversal(tree);
 *   console.log('DFS:', dfsResults.map(r => r.nodeId));
 *   
 *   // Get all levels
 *   const levels = hierarchyTraversal.getAllLevels(tree);
 *   console.log('Levels:', levels);
 *   
 *   // Find LCA
 *   const lca = hierarchyTraversal.getLowestCommonAncestor(tree, 'node-b', 'node-c');
 *   console.log('LCA of B and C:', lca?.name);
 * }
 * 
 * traverse();
 * ```
 */

// ============================================================================
// Default Export
// ============================================================================

export default {
  service: hierarchyService,
};
