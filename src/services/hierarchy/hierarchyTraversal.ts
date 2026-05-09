/**
 * Hierarchy Traversal - P17 Hierarchy System
 * 
 * Tree traversal algorithms and utilities for hierarchy structures.
 * Supports breadth-first, depth-first, and level-order traversal.
 */

import type {
  HierarchyNode,
  HierarchyTree,
  TraversalResult,
  TraversalOptions,
  TraversalCallback,
  HierarchyDirection,
  HierarchyLevel,
  SubtreeInfo,
} from './hierarchyTypes';
import { isLeafNode, isRootNode } from './hierarchyNode';

// ============================================================================
// Traversal Result Builder
// ============================================================================

function buildTraversalResult(
  node: HierarchyNode,
  depth: number
): TraversalResult {
  return {
    nodeId: node.id,
    depth,
    parentId: node.parentId,
    children: [...node.children],
    path: [...node.path],
  };
}

// ============================================================================
// Breadth-First Traversal (Level Order)
// ============================================================================

export function breadthFirstTraversal(
  tree: HierarchyTree,
  startNodeId: string | null = null,
  options: Partial<TraversalOptions> = {}
): TraversalResult[] {
  const results: TraversalResult[] = [];
  const visited = new Set<string>();
  
  const startId = startNodeId ?? tree.rootId;
  const queue: Array<{ nodeId: string; depth: number }> = [{ nodeId: startId, depth: 0 }];
  
  while (queue.length > 0) {
    const { nodeId, depth } = queue.shift()!;
    
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);
    
    const node = tree.nodes.get(nodeId);
    if (!node) continue;
    
    // Apply max depth filter
    if (options.maxDepth !== undefined && depth > options.maxDepth) continue;
    
    // Apply custom filter
    if (options.filter && !options.filter(node)) continue;
    
    // Skip root if includeRoot is false
    if (!options.includeRoot && isRootNode(node) && startId === tree.rootId) {
      // Still need to traverse children
    } else {
      results.push(buildTraversalResult(node, depth));
    }
    
    // Add children to queue
    for (const childId of node.children) {
      if (!visited.has(childId)) {
        queue.push({ nodeId: childId, depth: depth + 1 });
      }
    }
  }
  
  return results;
}

// ============================================================================
// Depth-First Traversal
// ============================================================================

export function depthFirstTraversal(
  tree: HierarchyTree,
  startNodeId: string | null = null,
  options: Partial<TraversalOptions> = {}
): TraversalResult[] {
  const results: TraversalResult[] = [];
  
  const startId = startNodeId ?? tree.rootId;
  const stack: Array<{ nodeId: string; depth: number }> = [{ nodeId: startId, depth: 0 }];
  
  while (stack.length > 0) {
    const { nodeId, depth } = stack.pop()!;
    
    const node = tree.nodes.get(nodeId);
    if (!node) continue;
    
    // Apply max depth filter
    if (options.maxDepth !== undefined && depth > options.maxDepth) continue;
    
    // Apply custom filter
    if (options.filter && !options.filter(node)) continue;
    
    // Skip root if includeRoot is false
    if (!options.includeRoot && isRootNode(node) && startId === tree.rootId) {
      // Continue to process children
    } else {
      results.push(buildTraversalResult(node, depth));
    }
    
    // Add children in reverse order so leftmost is processed first
    const children = [...node.children].reverse();
    for (const childId of children) {
      stack.push({ nodeId: childId, depth: depth + 1 });
    }
  }
  
  return results;
}

// ============================================================================
// Pre-order Traversal (Root before Children)
// ============================================================================

export function preOrderTraversal(
  tree: HierarchyTree,
  startNodeId: string | null = null,
  options: Partial<TraversalOptions> = {}
): TraversalResult[] {
  const results: TraversalResult[] = [];
  
  function visit(nodeId: string, depth: number): void {
    const node = tree.nodes.get(nodeId);
    if (!node) return;
    
    if (options.maxDepth !== undefined && depth > options.maxDepth) return;
    if (options.filter && !options.filter(node)) return;
    
    results.push(buildTraversalResult(node, depth));
    
    for (const childId of node.children) {
      visit(childId, depth + 1);
    }
  }
  
  visit(startNodeId ?? tree.rootId, 0);
  return results;
}

// ============================================================================
// Post-order Traversal (Children before Root)
// ============================================================================

export function postOrderTraversal(
  tree: HierarchyTree,
  startNodeId: string | null = null,
  options: Partial<TraversalOptions> = {}
): TraversalResult[] {
  const results: TraversalResult[] = [];
  
  function visit(nodeId: string, depth: number): void {
    const node = tree.nodes.get(nodeId);
    if (!node) return;
    
    if (options.maxDepth !== undefined && depth > options.maxDepth) return;
    
    for (const childId of node.children) {
      visit(childId, depth + 1);
    }
    
    if (!options.filter || options.filter(node)) {
      results.push(buildTraversalResult(node, depth));
    }
  }
  
  visit(startNodeId ?? tree.rootId, 0);
  return results;
}

// ============================================================================
// Generic Traversal with Callback
// ============================================================================

export function traverseTree(
  tree: HierarchyTree,
  callback: TraversalCallback,
  direction: HierarchyDirection = 'depth_first',
  startNodeId: string | null = null,
  options: Partial<TraversalOptions> = {}
): void {
  const startId = startNodeId ?? tree.rootId;
  
  switch (direction) {
    case 'breadth_first':
      traverseBFS(tree, startId, callback, options);
      break;
    case 'depth_first':
    case 'level_order':
    default:
      traverseDFS(tree, startId, callback, options);
      break;
  }
}

function traverseBFS(
  tree: HierarchyTree,
  startId: string,
  callback: TraversalCallback,
  options: Partial<TraversalOptions>
): void {
  const visited = new Set<string>();
  const queue: Array<{ nodeId: string; depth: number }> = [{ nodeId: startId, depth: 0 }];
  
  while (queue.length > 0) {
    const { nodeId, depth } = queue.shift()!;
    
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);
    
    const node = tree.nodes.get(nodeId);
    if (!node) continue;
    if (options.maxDepth !== undefined && depth > options.maxDepth) continue;
    if (options.filter && !options.filter(node)) continue;
    
    const parent = node.parentId ? tree.nodes.get(node.parentId) : null;
    const result = callback(node, depth, parent);
    if (result === false) return; // Stop traversal
    
    for (const childId of node.children) {
      if (!visited.has(childId)) {
        queue.push({ nodeId: childId, depth: depth + 1 });
      }
    }
  }
}

function traverseDFS(
  tree: HierarchyTree,
  startId: string,
  callback: TraversalCallback,
  options: Partial<TraversalOptions>
): void {
  function visit(nodeId: string, depth: number): boolean | void {
    if (options.maxDepth !== undefined && depth > options.maxDepth) return;
    
    const node = tree.nodes.get(nodeId);
    if (!node) return;
    if (options.filter && !options.filter(node)) return;
    
    const parent = node.parentId ? tree.nodes.get(node.parentId) : null;
    const result = callback(node, depth, parent);
    if (result === false) return false;
    
    for (const childId of node.children) {
      const childResult = visit(childId, depth + 1);
      if (childResult === false) return false;
    }
  }
  
  visit(startId, 0);
}

// ============================================================================
// Level-based Operations
// ============================================================================

export function getAllLevels(tree: HierarchyTree): HierarchyLevel[] {
  const levelsMap = new Map<number, HierarchyNode[]>();
  
  for (const node of tree.nodes.values()) {
    if (!levelsMap.has(node.level)) {
      levelsMap.set(node.level, []);
    }
    levelsMap.get(node.level)!.push(node);
  }
  
  const levels: HierarchyLevel[] = [];
  for (const [level, nodes] of levelsMap.entries()) {
    levels.push({
      level,
      nodes,
      count: nodes.length,
    });
  }
  
  return levels.sort((a, b) => a.level - b.level);
}

export function getNodesAtLevel(tree: HierarchyTree, level: number): HierarchyNode[] {
  const nodes: HierarchyNode[] = [];
  
  for (const node of tree.nodes.values()) {
    if (node.level === level) {
      nodes.push(node);
    }
  }
  
  return nodes;
}

export function getLevelCount(tree: HierarchyTree): number {
  let maxLevel = 0;
  for (const node of tree.nodes.values()) {
    maxLevel = Math.max(maxLevel, node.level);
  }
  return maxLevel + 1;
}

// ============================================================================
// Subtree Operations
// ============================================================================

export function getSubtree(
  tree: HierarchyTree,
  rootId: string
): SubtreeInfo | null {
  const root = tree.nodes.get(rootId);
  if (!root) return null;
  
  const nodes: HierarchyNode[] = [];
  const leaves: HierarchyNode[] = [];
  
  traverseTree(
    tree,
    (node) => {
      nodes.push(node);
      if (isLeafNode(node)) {
        leaves.push(node);
      }
    },
    'depth_first',
    rootId
  );
  
  const maxDepth = Math.max(...nodes.map(n => n.depth)) - root.depth;
  
  return {
    rootId,
    nodeCount: nodes.length,
    maxDepth,
    leaves,
    nodes,
  };
}

export function getSubtreeRoots(tree: HierarchyTree): HierarchyNode[] {
  return breadthFirstTraversal(tree, null, { includeRoot: true })
    .filter(r => r.depth === 0)
    .map(r => tree.nodes.get(r.nodeId)!)
    .filter(Boolean);
}

// ============================================================================
// Path Operations
// ============================================================================

export function getPathToRoot(
  tree: HierarchyTree,
  nodeId: string
): HierarchyNode[] {
  const path: HierarchyNode[] = [];
  let current = tree.nodes.get(nodeId);
  
  while (current) {
    path.unshift(current);
    current = current.parentId ? tree.nodes.get(current.parentId) : undefined;
  }
  
  return path;
}

export function getPathFromRoot(
  tree: HierarchyTree,
  nodeId: string
): HierarchyNode[] {
  const path: HierarchyNode[] = [];
  let current = tree.nodes.get(nodeId);
  
  while (current) {
    path.push(current);
    current = current.parentId ? tree.nodes.get(current.parentId) : undefined;
  }
  
  return path.reverse();
}

export function getLowestCommonAncestor(
  tree: HierarchyTree,
  nodeIdA: string,
  nodeIdB: string
): HierarchyNode | null {
  const nodeA = tree.nodes.get(nodeIdA);
  const nodeB = tree.nodes.get(nodeIdB);
  
  if (!nodeA || !nodeB) return null;
  
  const pathA = new Set(nodeA.path);
  let current = nodeB;
  
  while (current) {
    if (pathA.has(current.id)) {
      return current;
    }
    current = current.parentId ? tree.nodes.get(current.parentId) ?? undefined : undefined;
  }
  
  return null;
}

export function getDistanceBetweenNodes(
  tree: HierarchyTree,
  nodeIdA: string,
  nodeIdB: string
): number {
  const lca = getLowestCommonAncestor(tree, nodeIdA, nodeIdB);
  if (!lca) return -1;
  
  const nodeA = tree.nodes.get(nodeIdA)!;
  const nodeB = tree.nodes.get(nodeIdB)!;
  
  return (nodeA.depth - lca.depth) + (nodeB.depth - lca.depth);
}

// ============================================================================
// Tree Statistics
// ============================================================================

export function calculateTreeWidth(tree: HierarchyTree): number {
  const levelCounts = new Map<number, number>();
  
  for (const node of tree.nodes.values()) {
    levelCounts.set(node.level, (levelCounts.get(node.level) ?? 0) + 1);
  }
  
  let maxWidth = 0;
  for (const count of levelCounts.values()) {
    maxWidth = Math.max(maxWidth, count);
  }
  
  return maxWidth;
}

export function calculateAverageBranchingFactor(tree: HierarchyTree): number {
  let totalChildren = 0;
  let branchNodeCount = 0;
  
  for (const node of tree.nodes.values()) {
    if (node.children.length > 0) {
      totalChildren += node.children.length;
      branchNodeCount++;
    }
  }
  
  return branchNodeCount > 0 ? totalChildren / branchNodeCount : 0;
}

export function isTreeBalanced(tree: HierarchyTree, maxDepthDifference: number = 1): boolean {
  const leaves = Array.from(tree.nodes.values()).filter(n => isLeafNode(n));
  
  if (leaves.length === 0) return true;
  
  const depths = leaves.map(n => n.depth);
  const minDepth = Math.min(...depths);
  const maxDepth = Math.max(...depths);
  
  return (maxDepth - minDepth) <= maxDepthDifference;
}

export function isTreeComplete(tree: HierarchyTree): boolean {
  const levels = getAllLevels(tree);
  const lastLevel = levels[levels.length - 1];
  
  if (!lastLevel) return true;
  
  // A complete tree has all levels fully filled except possibly the last
  for (let i = 0; i < levels.length - 1; i++) {
    const expectedCount = Math.pow(2, i);
    if (levels[i].count !== expectedCount) {
      return false;
    }
  }
  
  return true;
}
