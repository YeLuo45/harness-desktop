/**
 * Hierarchy Node Utilities - P17 Hierarchy System
 * 
 * Utility functions for working with hierarchy nodes.
 * Includes validation, comparison, and node manipulation helpers.
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  HierarchyNode,
  HierarchyNodeData,
  HierarchyNodeType,
  HierarchyLink,
} from './hierarchyTypes';

// ============================================================================
// Node Creation
// ============================================================================

export function createHierarchyNode(
  data: HierarchyNodeData,
  parent?: HierarchyNode | null
): HierarchyNode {
  const now = Date.now();
  const nodeId = uuidv4();
  
  const level = parent ? parent.level + 1 : 0;
  const path = parent ? [...parent.path, nodeId] : [nodeId];
  const nodeType = data.type ?? (parent === null ? 'root' : 'branch');

  return {
    id: nodeId,
    name: data.name,
    type: nodeType,
    level,
    parentId: parent?.id ?? null,
    children: [],
    depth: level,
    path,
    metadata: data.metadata,
    createdAt: now,
    updatedAt: now,
  };
}

export function createLeafNode(
  name: string,
  parent: HierarchyNode,
  metadata?: Record<string, unknown>
): HierarchyNode {
  return createHierarchyNode({
    name,
    type: 'leaf',
    metadata,
  }, parent);
}

export function createBranchNode(
  name: string,
  parent: HierarchyNode,
  metadata?: Record<string, unknown>
): HierarchyNode {
  return createHierarchyNode({
    name,
    type: 'branch',
    metadata,
  }, parent);
}

// ============================================================================
// Node Validation
// ============================================================================

export function isValidNode(node: HierarchyNode): boolean {
  if (!node.id || typeof node.id !== 'string') return false;
  if (!node.name || typeof node.name !== 'string') return false;
  if (!['root', 'branch', 'leaf'].includes(node.type)) return false;
  if (typeof node.level !== 'number' || node.level < 0) return false;
  if (!Array.isArray(node.children)) return false;
  if (!Array.isArray(node.path)) return false;
  if (node.parentId !== null && typeof node.parentId !== 'string') return false;
  return true;
}

export function isLeafNode(node: HierarchyNode): boolean {
  return node.children.length === 0;
}

export function isRootNode(node: HierarchyNode): boolean {
  return node.parentId === null;
}

export function isBranchNode(node: HierarchyNode): boolean {
  return node.type === 'branch';
}

export function hasChildren(node: HierarchyNode): boolean {
  return node.children.length > 0;
}

export function isDescendantOf(node: HierarchyNode, ancestorId: string): boolean {
  return node.path.includes(ancestorId);
}

export function isAncestorOf(ancestor: HierarchyNode, node: HierarchyNode): boolean {
  return node.path.includes(ancestor.id);
}

// ============================================================================
// Node Comparison
// ============================================================================

export function compareNodes(nodeA: HierarchyNode, nodeB: HierarchyNode): number {
  // Compare by path first
  const minLength = Math.min(nodeA.path.length, nodeB.path.length);
  for (let i = 0; i < minLength; i++) {
    if (nodeA.path[i] !== nodeB.path[i]) {
      return nodeA.path[i] < nodeB.path[i] ? -1 : 1;
    }
  }
  // Shorter path comes first (ancestor before descendant)
  return nodeA.path.length - nodeB.path.length;
}

export function areNodesEqual(nodeA: HierarchyNode, nodeB: HierarchyNode): boolean {
  return nodeA.id === nodeB.id;
}

export function areSiblings(nodeA: HierarchyNode, nodeB: HierarchyNode): boolean {
  return nodeA.parentId === nodeB.parentId && nodeA.parentId !== null;
}

export function areCousins(nodeA: HierarchyNode, nodeB: HierarchyNode): boolean {
  return nodeA.parentId !== nodeB.parentId && 
         nodeA.parentId !== null && 
         nodeB.parentId !== null &&
         nodeA.level === nodeB.level;
}

// ============================================================================
// Node Path Utilities
// ============================================================================

export function getNodeDepth(node: HierarchyNode): number {
  return node.path.length - 1;
}

export function getNodeLevel(node: HierarchyNode): number {
  return node.level;
}

export function getNodeAncestry(node: HierarchyNode): string[] {
  return node.path.slice(0, -1); // Exclude the node itself
}

export function getNodeSiblings(node: HierarchyNode, allNodes: Map<string, HierarchyNode>): HierarchyNode[] {
  if (!node.parentId) return [];
  
  const parent = allNodes.get(node.parentId);
  if (!parent) return [];
  
  return parent.children
    .map(id => allNodes.get(id))
    .filter((n): n is HierarchyNode => n !== undefined && n.id !== node.id);
}

export function getNodeDegree(node: HierarchyNode): number {
  return node.children.length;
}

export function getSubtreeSize(node: HierarchyNode, allNodes: Map<string, HierarchyNode>): number {
  let count = 1;
  for (const childId of node.children) {
    const child = allNodes.get(childId);
    if (child) {
      count += getSubtreeSize(child, allNodes);
    }
  }
  return count;
}

export function getLongestPathFrom(node: HierarchyNode, allNodes: Map<string, HierarchyNode>): number {
  if (node.children.length === 0) return 0;
  
  let maxChildDepth = 0;
  for (const childId of node.children) {
    const child = allNodes.get(childId);
    if (child) {
      const childDepth = 1 + getLongestPathFrom(child, allNodes);
      maxChildDepth = Math.max(maxChildDepth, childDepth);
    }
  }
  return maxChildDepth;
}

// ============================================================================
// Node Link Utilities
// ============================================================================

export function createLink(sourceId: string, targetId: string, weight?: number): HierarchyLink {
  return {
    sourceId,
    targetId,
    weight,
  };
}

export function getLinkWeight(link: HierarchyLink): number {
  return link.weight ?? 1;
}

export function normalizePath(path: string[]): string[] {
  return [...new Set(path)];
}

// ============================================================================
// Node Transformation
// ============================================================================

export function cloneNode(node: HierarchyNode, newParentId?: string): HierarchyNode {
  return {
    ...node,
    id: uuidv4(),
    parentId: newParentId ?? node.parentId,
    path: newParentId ? [...node.path, uuidv4()] : [...node.path],
    children: [], // Children need to be cloned separately
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function renameNode(node: HierarchyNode, newName: string): HierarchyNode {
  return {
    ...node,
    name: newName,
    updatedAt: Date.now(),
  };
}

export function updateNodeMetadata(
  node: HierarchyNode,
  metadata: Record<string, unknown>
): HierarchyNode {
  return {
    ...node,
    metadata: { ...node.metadata, ...metadata },
    updatedAt: Date.now(),
  };
}

export function setNodeType(node: HierarchyNode, type: HierarchyNodeType): HierarchyNode {
  return {
    ...node,
    type,
    updatedAt: Date.now(),
  };
}

// ============================================================================
// Node Search Utilities
// ============================================================================

export function findNodeByName(
  nodes: HierarchyNode[],
  name: string
): HierarchyNode | undefined {
  return nodes.find(n => n.name === name);
}

export function findNodesByNamePattern(
  nodes: HierarchyNode[],
  pattern: RegExp
): HierarchyNode[] {
  return nodes.filter(n => pattern.test(n.name));
}

export function findNodesByType(
  nodes: HierarchyNode[],
  type: HierarchyNodeType
): HierarchyNode[] {
  return nodes.filter(n => n.type === type);
}

export function findNodesAtLevel(
  nodes: HierarchyNode[],
  level: number
): HierarchyNode[] {
  return nodes.filter(n => n.level === level);
}

export function findLeaves(nodes: HierarchyNode[]): HierarchyNode[] {
  return nodes.filter(n => n.children.length === 0);
}

export function findRoots(nodes: HierarchyNode[]): HierarchyNode[] {
  return nodes.filter(n => n.parentId === null);
}
