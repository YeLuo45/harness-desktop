/**
 * Hierarchy Service - P17 Hierarchy System
 * 
 * Core service for creating and managing hierarchical tree structures.
 * Provides CRUD operations, tree manipulation, and event handling.
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  HierarchyNode,
  HierarchyNodeData,
  HierarchyTree,
  HierarchyConfig,
  HierarchyEvent,
  HierarchyEventType,
  HierarchyNodeType,
  DEFAULT_HIERARCHY_CONFIG,
} from './hierarchyTypes';

// Re-export config constant
export const DEFAULT_HIERARCHY_CONFIG = {
  allowMultipleRoots: false,
  maxDepth: 100,
  maxChildren: 1000,
  autoIncrementLevel: true,
};

// ============================================================================
// Event Listener Types
// ============================================================================

type HierarchyEventListener = (event: HierarchyEvent) => void;

// ============================================================================
// Hierarchy Service Implementation
// ============================================================================

export class HierarchyService {
  private trees: Map<string, HierarchyTree> = new Map();
  private listeners: Map<string, Set<HierarchyEventListener>> = new Map();

  /**
   * Create a new hierarchy tree
   */
  createTree(name: string, config: Partial<HierarchyConfig> = {}): HierarchyTree {
    const id = uuidv4();
    const rootId = uuidv4();
    const now = Date.now();

    const rootNode: HierarchyNode = {
      id: rootId,
      name: name,
      type: 'root',
      level: 0,
      parentId: null,
      children: [],
      depth: 0,
      path: [rootId],
      createdAt: now,
      updatedAt: now,
    };

    const tree: HierarchyTree = {
      id,
      name,
      rootId,
      nodes: new Map([[rootId, rootNode]]),
      nodeCount: 1,
      maxDepth: 0,
      createdAt: now,
      updatedAt: now,
    };

    this.trees.set(id, tree);
    return tree;
  }

  /**
   * Get a tree by ID
   */
  getTree(treeId: string): HierarchyTree | undefined {
    return this.trees.get(treeId);
  }

  /**
   * Delete a tree
   */
  deleteTree(treeId: string): boolean {
    const tree = this.trees.get(treeId);
    if (!tree) return false;
    
    this.trees.delete(treeId);
    this.listeners.delete(treeId);
    this.emitEvent(treeId, 'tree_cleared', undefined);
    return true;
  }

  /**
   * Add a node to a tree
   */
  addNode(
    treeId: string,
    data: HierarchyNodeData,
    afterNodeId?: string
  ): HierarchyNode | null {
    const tree = this.trees.get(treeId);
    if (!tree) return null;

    const config = DEFAULT_HIERARCHY_CONFIG;
    const parentId = data.parentId ?? null;

    // Validate parent exists
    if (parentId !== null) {
      const parent = tree.nodes.get(parentId);
      if (!parent) return null;
      if (tree.nodes.size >= config.maxChildren!) return null;
    }

    // Check for multiple roots
    if (parentId === null && !config.allowMultipleRoots && tree.nodeCount > 0) {
      return null;
    }

    const now = Date.now();
    const nodeId = uuidv4();
    const level = data.parentId 
      ? (tree.nodes.get(data.parentId)!.level + 1)
      : 0;

    // Check depth limit
    if (level > config.maxDepth!) return null;

    // Build path
    const path = parentId 
      ? [...tree.nodes.get(parentId)!.path, nodeId]
      : [nodeId];

    const nodeType: HierarchyNodeType = data.type ?? 
      (parentId === null ? 'root' : 'branch');

    const node: HierarchyNode = {
      id: nodeId,
      name: data.name,
      type: nodeType,
      level,
      parentId,
      children: [],
      depth: level,
      path,
      metadata: data.metadata,
      createdAt: now,
      updatedAt: now,
    };

    tree.nodes.set(nodeId, node);

    // Update parent's children
    if (parentId) {
      const parent = tree.nodes.get(parentId)!;
      if (afterNodeId) {
        const index = parent.children.indexOf(afterNodeId);
        if (index !== -1) {
          parent.children.splice(index + 1, 0, nodeId);
        } else {
          parent.children.push(nodeId);
        }
      } else {
        parent.children.push(nodeId);
      }
      parent.updatedAt = now;
    }

    // Update tree stats
    tree.nodeCount++;
    tree.maxDepth = Math.max(tree.maxDepth, level);
    tree.updatedAt = now;

    this.emitEvent(treeId, 'node_added', nodeId);
    return node;
  }

  /**
   * Remove a node and its subtree
   */
  removeNode(treeId: string, nodeId: string): boolean {
    const tree = this.trees.get(treeId);
    if (!tree) return false;

    const node = tree.nodes.get(nodeId);
    if (!node) return false;

    // Cannot remove root without deleting tree
    if (node.parentId === null) return false;

    // Collect all nodes to remove (subtree)
    const nodesToRemove = this.collectSubtree(nodeId, tree);
    
    // Remove from parent's children
    const parent = tree.nodes.get(node.parentId);
    if (parent) {
      parent.children = parent.children.filter(id => id !== nodeId);
      parent.updatedAt = Date.now();
    }

    // Remove all nodes in subtree
    for (const id of nodesToRemove) {
      tree.nodes.delete(id);
    }

    // Update tree stats
    tree.nodeCount -= nodesToRemove.size;
    tree.maxDepth = this.calculateMaxDepth(tree);
    tree.updatedAt = Date.now();

    this.emitEvent(treeId, 'node_removed', nodeId);
    return true;
  }

  /**
   * Move a node to a new parent
   */
  moveNode(
    treeId: string,
    nodeId: string,
    newParentId: string | null,
    afterNodeId?: string
  ): boolean {
    const tree = this.trees.get(treeId);
    if (!tree) return false;

    const node = tree.nodes.get(nodeId);
    if (!node) return false;
    if (node.parentId === null) return false; // Cannot move root

    const newParent = newParentId ? tree.nodes.get(newParentId) : null;
    if (newParentId && !newParent) return false;

    // Prevent moving to own descendant
    if (newParent && this.isDescendant(tree, nodeId, newParentId)) {
      return false;
    }

    const previousParentId = node.parentId;
    const now = Date.now();

    // Remove from old parent
    if (previousParentId) {
      const oldParent = tree.nodes.get(previousParentId);
      if (oldParent) {
        oldParent.children = oldParent.children.filter(id => id !== nodeId);
        oldParent.updatedAt = now;
      }
    }

    // Update node
    const oldPath = node.path;
    node.parentId = newParentId;
    node.level = newParentId ? (newParent!.level + 1) : 0;
    node.depth = node.level;
    node.path = newParentId 
      ? [...newParent!.path, nodeId]
      : [nodeId];
    node.updatedAt = now;

    // Add to new parent
    if (newParentId) {
      const parent = tree.nodes.get(newParentId)!;
      if (afterNodeId) {
        const index = parent.children.indexOf(afterNodeId);
        if (index !== -1) {
          parent.children.splice(index + 1, 0, nodeId);
        } else {
          parent.children.push(nodeId);
        }
      } else {
        parent.children.push(nodeId);
      }
      parent.updatedAt = now;
    }

    // Update all descendants' paths and levels
    this.updateDescendantPaths(tree, nodeId, oldPath, node.path, node.level);

    // Update tree stats
    tree.maxDepth = this.calculateMaxDepth(tree);
    tree.updatedAt = now;

    this.emitEvent(treeId, 'node_moved', nodeId, previousParentId, newParentId);
    return true;
  }

  /**
   * Update a node's data
   */
  updateNode(
    treeId: string,
    nodeId: string,
    updates: Partial<Pick<HierarchyNode, 'name' | 'metadata'>>
  ): HierarchyNode | null {
    const tree = this.trees.get(treeId);
    if (!tree) return null;

    const node = tree.nodes.get(nodeId);
    if (!node) return null;

    if (updates.name !== undefined) {
      node.name = updates.name;
    }
    if (updates.metadata !== undefined) {
      node.metadata = { ...node.metadata, ...updates.metadata };
    }
    node.updatedAt = Date.now();
    tree.updatedAt = Date.now();

    this.emitEvent(treeId, 'node_updated', nodeId);
    return node;
  }

  /**
   * Get a node by ID
   */
  getNode(treeId: string, nodeId: string): HierarchyNode | undefined {
    return this.trees.get(treeId)?.nodes.get(nodeId);
  }

  /**
   * Get all nodes at a specific level
   */
  getNodesAtLevel(treeId: string, level: number): HierarchyNode[] {
    const tree = this.trees.get(treeId);
    if (!tree) return [];

    const result: HierarchyNode[] = [];
    for (const node of tree.nodes.values()) {
      if (node.level === level) {
        result.push(node);
      }
    }
    return result;
  }

  /**
   * Get all root nodes (for trees with multiple roots)
   */
  getRootNodes(treeId: string): HierarchyNode[] {
    const tree = this.trees.get(treeId);
    if (!tree) return [];

    const roots: HierarchyNode[] = [];
    for (const node of tree.nodes.values()) {
      if (node.parentId === null) {
        roots.push(node);
      }
    }
    return roots;
  }

  /**
   * Get children of a node
   */
  getChildren(treeId: string, nodeId: string): HierarchyNode[] {
    const tree = this.trees.get(treeId);
    if (!tree) return [];

    const node = tree.nodes.get(nodeId);
    if (!node) return [];

    return node.children
      .map(id => tree.nodes.get(id))
      .filter((n): n is HierarchyNode => n !== undefined);
  }

  /**
   * Get parent of a node
   */
  getParent(treeId: string, nodeId: string): HierarchyNode | null {
    const tree = this.trees.get(treeId);
    if (!tree) return null;

    const node = tree.nodes.get(nodeId);
    if (!node) return null;

    return node.parentId ? tree.nodes.get(node.parentId) ?? null : null;
  }

  /**
   * Get all ancestors of a node
   */
  getAncestors(treeId: string, nodeId: string): HierarchyNode[] {
    const tree = this.trees.get(treeId);
    if (!tree) return [];

    const ancestors: HierarchyNode[] = [];
    let current = tree.nodes.get(nodeId);
    
    while (current && current.parentId) {
      const parent = tree.nodes.get(current.parentId);
      if (parent) {
        ancestors.push(parent);
        current = parent;
      } else {
        break;
      }
    }

    return ancestors;
  }

  /**
   * Get all descendants of a node
   */
  getDescendants(treeId: string, nodeId: string): HierarchyNode[] {
    const tree = this.trees.get(treeId);
    if (!tree) return [];

    const descendants: HierarchyNode[] = [];
    const queue = [nodeId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const node = tree.nodes.get(currentId);
      if (!node) continue;

      for (const childId of node.children) {
        const child = tree.nodes.get(childId);
        if (child) {
          descendants.push(child);
          queue.push(childId);
        }
      }
    }

    return descendants;
  }

  /**
   * Get subtree info
   */
  getSubtreeInfo(treeId: string, nodeId: string): {
    nodeCount: number;
    maxDepth: number;
    leaves: HierarchyNode[];
  } | null {
    const tree = this.trees.get(treeId);
    if (!tree) return null;

    const node = tree.nodes.get(nodeId);
    if (!node) return null;

    const descendants = this.getDescendants(treeId, nodeId);
    const allNodes = [node, ...descendants];
    
    const leaves = allNodes.filter(n => n.children.length === 0);
    const maxDepth = Math.max(...allNodes.map(n => n.depth));

    return {
      nodeCount: allNodes.length,
      maxDepth,
      leaves,
    };
  }

  // ============================================================================
  // Event Handling
  // ============================================================================

  subscribe(treeId: string, listener: HierarchyEventListener): () => void {
    if (!this.listeners.has(treeId)) {
      this.listeners.set(treeId, new Set());
    }
    this.listeners.get(treeId)!.add(listener);
    
    return () => {
      this.listeners.get(treeId)?.delete(listener);
    };
  }

  private emitEvent(
    treeId: string,
    type: HierarchyEventType,
    nodeId?: string,
    previousParentId?: string | null,
    newParentId?: string | null
  ): void {
    const event: HierarchyEvent = {
      type,
      treeId,
      nodeId,
      previousParentId,
      newParentId,
      timestamp: Date.now(),
    };

    this.listeners.get(treeId)?.forEach(listener => listener(event));
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private collectSubtree(nodeId: string, tree: HierarchyTree): Set<string> {
    const nodes = new Set<string>([nodeId]);
    const queue = [nodeId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const node = tree.nodes.get(currentId);
      if (!node) continue;

      for (const childId of node.children) {
        nodes.add(childId);
        queue.push(childId);
      }
    }

    return nodes;
  }

  private calculateMaxDepth(tree: HierarchyTree): number {
    let maxDepth = 0;
    for (const node of tree.nodes.values()) {
      maxDepth = Math.max(maxDepth, node.depth);
    }
    return maxDepth;
  }

  private isDescendant(tree: HierarchyTree, nodeId: string, potentialDescendantId: string): boolean {
    let current = tree.nodes.get(potentialDescendantId);
    while (current && current.parentId) {
      if (current.parentId === nodeId) return true;
      current = tree.nodes.get(current.parentId);
    }
    return false;
  }

  private updateDescendantPaths(
    tree: HierarchyTree,
    nodeId: string,
    oldPath: string[],
    newPath: string[],
    newLevel: number
  ): void {
    const descendants = this.getDescendants(tree.id, nodeId);
    
    for (const desc of descendants) {
      // Replace old path prefix with new path prefix
      desc.path = newPath.concat(
        desc.path.slice(oldPath.length)
      );
      desc.level = newLevel + (desc.path.length - newPath.length);
      desc.depth = desc.level;
    }
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const hierarchyService = new HierarchyService();
