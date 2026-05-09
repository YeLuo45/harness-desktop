import { AgentNodeType, CanvasNode, Edge, Position, NodeDefinition, ExecutionResult } from './visualBuilderTypes'
import { editorStateManager } from './editorState'
import { nodeRegistry } from './nodeRegistry'
import { executionEngine } from './executionEngine'

export class CanvasEditor {
  private state = editorStateManager

  constructor() {
    this.state.subscribe(() => this.onStateChange())
  }

  private onStateChange(): void {
    // Override in UI integration
  }

  // Node operations
  addNode(type: AgentNodeType, position: Position): CanvasNode | undefined {
    const node = nodeRegistry.createNode(type, position)
    if (node) {
      this.state.addNode(node)
    }
    return node
  }

  removeNode(id: string): void {
    this.state.removeNode(id)
  }

  updateNode(id: string, updates: Partial<CanvasNode>): void {
    this.state.updateNode(id, updates)
  }

  getNode(id: string): CanvasNode | undefined {
    return this.state.getNode(id)
  }

  selectNode(id: string | undefined): void {
    this.state.selectNode(id)
  }

  duplicateNode(id: string): CanvasNode | undefined {
    const node = this.state.getNode(id)
    if (!node) return undefined

    const cloned = nodeRegistry.cloneNode(node)
    this.state.addNode(cloned)
    return cloned
  }

  // Edge operations
  connect(source: string, sourcePort: string, target: string, targetPort: string): Edge | undefined {
    // Validate connection
    const sourceNode = this.state.getNode(source)
    const targetNode = this.state.getNode(target)

    if (!sourceNode || !targetNode) return undefined

    const edge: Edge = {
      id: Math.random().toString(36).substring(2, 11),
      source,
      sourcePort,
      target,
      targetPort
    }

    this.state.addEdge(edge)
    return edge
  }

  disconnect(edgeId: string): void {
    this.state.removeEdge(edgeId)
  }

  // Canvas operations
  setScale(scale: number): void {
    this.state.setScale(scale)
  }

  pan(delta: Position): void {
    const current = this.state.getState().offset
    this.state.setOffset({ x: current.x + delta.x, y: current.y + delta.y })
  }

  // Execution
  async execute(): Promise<ExecutionResult> {
    const { nodes, edges } = this.state.getState()
    return executionEngine.execute(nodes, edges)
  }

  preview(): string[] {
    const { nodes, edges } = this.state.getState()
    return executionEngine.preview(nodes, edges)
  }

  stop(): void {
    executionEngine.stop()
  }

  // Persistence
  save(): void {
    this.state.save()
  }

  load(): boolean {
    return this.state.load()
  }

  clear(): void {
    this.state.clear()
  }

  export(): string {
    return this.state.export()
  }

  import(json: string): boolean {
    return this.state.import(json)
  }

  // Node definitions
  getNodeDefinitions(): NodeDefinition[] {
    return nodeRegistry.getAllDefinitions()
  }

  getNodeTypes(): AgentNodeType[] {
    return nodeRegistry.getNodeTypes()
  }
}

export const canvasEditor = new CanvasEditor()
