/**
 * Hierarchy Types - P17 Hierarchy System
 * 
 * Core type definitions for hierarchical structure management.
 * Supports tree structures, hierarchy traversal, and level-based operations.
 */

// ============================================================================
// Hierarchy Node Types
// ============================================================================

export type HierarchyNodeType = 
  | 'root'
  | 'branch'
  | 'leaf';

export type HierarchyDirection = 
  | 'breadth_first'
  | 'depth_first'
  | 'level_order';

export interface HierarchyNode {
  id: string;
  name: string;
  type: HierarchyNodeType;
  level: number;
  parentId: string | null;
  children: string[];
  depth: number;
  path: string[];
  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface HierarchyNodeData {
  name: string;
  type?: HierarchyNodeType;
  parentId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface HierarchyLink {
  sourceId: string;
  targetId: string;
  weight?: number;
  label?: string;
}

// ============================================================================
// Hierarchy Tree Types
// ============================================================================

export interface HierarchyTree {
  id: string;
  name: string;
  rootId: string;
  nodes: Map<string, HierarchyNode>;
  nodeCount: number;
  maxDepth: number;
  createdAt: number;
  updatedAt: number;
}

export interface HierarchyConfig {
  allowMultipleRoots?: boolean;
  maxDepth?: number;
  maxChildren?: number;
  autoIncrementLevel?: boolean;
}

// ============================================================================
// Hierarchy Query Types
// ============================================================================

export interface HierarchyQuery {
  nodeId?: string;
  level?: number;
  name?: string;
  namePattern?: string;
  type?: HierarchyNodeType;
  maxResults?: number;
}

export interface HierarchyPath {
  nodes: HierarchyNode[];
  totalWeight: number;
  length: number;
}

export interface HierarchyLevel {
  level: number;
  nodes: HierarchyNode[];
  count: number;
}

// ============================================================================
// Hierarchy Traversal Types
// ============================================================================

export interface TraversalResult {
  nodeId: string;
  depth: number;
  parentId: string | null;
  children: string[];
  path: string[];
}

export interface TraversalOptions {
  direction: HierarchyDirection;
  includeRoot?: boolean;
  maxDepth?: number;
  filter?: (node: HierarchyNode) => boolean;
}

export interface TraversalCallback {
  (node: HierarchyNode, depth: number, parent: HierarchyNode | null): void | boolean;
}

// ============================================================================
// Hierarchy Statistics Types
// ============================================================================

export interface HierarchyStats {
  totalNodes: number;
  maxDepth: number;
  averageDepth: number;
  nodesByLevel: Map<number, number>;
  nodesByType: Map<HierarchyNodeType, number>;
  branchFactor: number;
}

export interface SubtreeInfo {
  rootId: string;
  nodeCount: number;
  maxDepth: number;
  leaves: HierarchyNode[];
  nodes: HierarchyNode[];
}

// ============================================================================
// Hierarchy Change Event Types
// ============================================================================

export type HierarchyEventType =
  | 'node_added'
  | 'node_removed'
  | 'node_moved'
  | 'node_updated'
  | 'tree_cleared'
  | 'tree_reorganized';

export interface HierarchyEvent {
  type: HierarchyEventType;
  treeId: string;
  nodeId?: string;
  previousParentId?: string | null;
  newParentId?: string | null;
  timestamp: number;
  data?: unknown;
}

// ============================================================================
// Hierarchy Comparison Types
// ============================================================================

export interface DifferenceNode {
  id: string;
  name: string;
  status: 'added' | 'removed' | 'modified' | 'unchanged';
  path?: string[];
}

export interface HierarchyDiff {
  treeAId: string;
  treeBId: string;
  differences: DifferenceNode[];
  addedCount: number;
  removedCount: number;
  modifiedCount: number;
}

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_HIERARCHY_CONFIG: HierarchyConfig = {
  allowMultipleRoots: false,
  maxDepth: 100,
  maxChildren: 1000,
  autoIncrementLevel: true,
};

export const MAX_HIERARCHY_ID_LENGTH = 256;
export const MAX_HIERARCHY_NAME_LENGTH = 512;
