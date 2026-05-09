import { CanvasNode, Edge, EditorState, Position, ExecutionStep } from './visualBuilderTypes'

const STORAGE_KEY = 'visual_builder_state'

export class EditorStateManager {
  private state: EditorState = {
    nodes: [],
    edges: [],
    scale: 1,
    offset: { x: 0, y: 0 },
    isExecuting: false,
    executionSteps: []
  }

  private listeners: Set<() => void> = new Set()

  getState(): EditorState {
    return { ...this.state }
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify(): void {
    this.listeners.forEach(l => l())
  }

  // Node operations
  addNode(node: CanvasNode): void {
    this.state.nodes.push(node)
    this.notify()
  }

  removeNode(id: string): void {
    this.state.nodes = this.state.nodes.filter(n => n.id !== id)
    // Remove connected edges
    this.state.edges = this.state.edges.filter(
      e => e.source !== id && e.target !== id
    )
    if (this.state.selectedNodeId === id) {
      this.state.selectedNodeId = undefined
    }
    this.notify()
  }

  updateNode(id: string, updates: Partial<CanvasNode>): void {
    const idx = this.state.nodes.findIndex(n => n.id === id)
    if (idx >= 0) {
      this.state.nodes[idx] = { ...this.state.nodes[idx], ...updates }
      this.notify()
    }
  }

  getNode(id: string): CanvasNode | undefined {
    return this.state.nodes.find(n => n.id === id)
  }

  // Edge operations
  addEdge(edge: Edge): void {
    // Prevent duplicate edges
    const exists = this.state.edges.some(
      e => e.source === edge.source &&
           e.sourcePort === edge.sourcePort &&
           e.target === edge.target &&
           e.targetPort === edge.targetPort
    )
    if (!exists) {
      this.state.edges.push(edge)
      this.notify()
    }
  }

  removeEdge(id: string): void {
    this.state.edges = this.state.edges.filter(e => e.id !== id)
    this.notify()
  }

  // Selection
  selectNode(id: string | undefined): void {
    this.state.selectedNodeId = id
    this.notify()
  }

  // Canvas operations
  setScale(scale: number): void {
    this.state.scale = Math.max(0.1, Math.min(2, scale))
    this.notify()
  }

  setOffset(offset: Position): void {
    this.state.offset = offset
    this.notify()
  }

  // Execution state
  setExecuting(isExecuting: boolean): void {
    this.state.isExecuting = isExecuting
    this.notify()
  }

  setExecutionSteps(steps: ExecutionStep[]): void {
    this.state.executionSteps = steps
    this.notify()
  }

  updateExecutionStep(nodeId: string, updates: Partial<ExecutionStep>): void {
    const idx = this.state.executionSteps.findIndex(s => s.nodeId === nodeId)
    if (idx >= 0) {
      this.state.executionSteps[idx] = { ...this.state.executionSteps[idx], ...updates }
      this.notify()
    }
  }

  // Persistence
  save(): void {
    try {
      const data = {
        nodes: this.state.nodes,
        edges: this.state.edges
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (e) {
      console.warn('Failed to save editor state:', e)
    }
  }

  load(): boolean {
    try {
      const data = localStorage.getItem(STORAGE_KEY)
      if (data) {
        const parsed = JSON.parse(data)
        this.state.nodes = parsed.nodes || []
        this.state.edges = parsed.edges || []
        this.notify()
        return true
      }
    } catch (e) {
      console.warn('Failed to load editor state:', e)
    }
    return false
  }

  clear(): void {
    this.state.nodes = []
    this.state.edges = []
    this.state.selectedNodeId = undefined
    this.state.executionSteps = []
    localStorage.removeItem(STORAGE_KEY)
    this.notify()
  }

  // Export/Import
  export(): string {
    return JSON.stringify({
      nodes: this.state.nodes,
      edges: this.state.edges
    }, null, 2)
  }

  import(json: string): boolean {
    try {
      const parsed = JSON.parse(json)
      if (parsed.nodes && parsed.edges) {
        this.state.nodes = parsed.nodes
        this.state.edges = parsed.edges
        this.notify()
        return true
      }
    } catch (e) {
      console.warn('Failed to import editor state:', e)
    }
    return false
  }
}

export const editorStateManager = new EditorStateManager()
