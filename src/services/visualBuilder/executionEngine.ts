import { CanvasNode, Edge, ExecutionStep, ExecutionResult, AgentNodeType } from './visualBuilderTypes'
import { editorStateManager } from './editorState'

export class ExecutionEngine {
  private isRunning = false
  private shouldStop = false

  async execute(nodes: CanvasNode[], edges: Edge[]): Promise<ExecutionResult> {
    if (this.isRunning) {
      throw new Error('Execution already in progress')
    }

    this.isRunning = true
    this.shouldStop = false
    editorStateManager.setExecuting(true)

    const startTime = Date.now()
    const steps: ExecutionStep[] = []
    const nodeMap = new Map(nodes.map(n => [n.id, n]))

    // Find trigger node
    const triggerNode = nodes.find(n => n.type === AgentNodeType.TRIGGER)
    if (!triggerNode) {
      return this.finishWithError(steps, startTime, 'No trigger node found')
    }

    // BFS/DFS execution from trigger
    const visited = new Set<string>()
    const executionOrder: string[] = []

    const traverse = (nodeId: string): void => {
      if (visited.has(nodeId) || this.shouldStop) return
      visited.add(nodeId)
      executionOrder.push(nodeId)

      // Find outgoing edges
      const outgoing = edges.filter(e => e.source === nodeId)
      for (const edge of outgoing) {
        traverse(edge.target)
      }
    }

    traverse(triggerNode.id)

    // Execute nodes in order
    for (const nodeId of executionOrder) {
      if (this.shouldStop) break

      const node = nodeMap.get(nodeId)!
      const step: ExecutionStep = {
        nodeId,
        status: 'running',
        startTime: Date.now()
      }

      steps.push(step)
      editorStateManager.setExecutionSteps([...steps])
      editorStateManager.updateExecutionStep(nodeId, { status: 'running', startTime: Date.now() })

      try {
        // Simulate node execution
        const output = await this.executeNode(node, steps, nodeMap, edges)
        step.status = 'completed'
        step.output = output
        step.endTime = Date.now()
      } catch (error) {
        step.status = 'failed'
        step.error = error instanceof Error ? error.message : 'Unknown error'
        step.endTime = Date.now()
        editorStateManager.updateExecutionStep(nodeId, step)
        break
      }

      editorStateManager.updateExecutionStep(nodeId, step)
    }

    const duration = Date.now() - startTime
    const success = steps.every(s => s.status === 'completed')

    this.isRunning = false
    editorStateManager.setExecuting(false)

    return {
      success,
      steps,
      duration,
      output: steps.length > 0 ? steps[steps.length - 1].output : undefined
    }
  }

  private async executeNode(
    node: CanvasNode,
    steps: ExecutionStep[],
    nodeMap: Map<string, CanvasNode>,
    edges: Edge[]
  ): Promise<unknown> {
    // Simulate async execution
    await new Promise(resolve => setTimeout(resolve, 100))

    switch (node.type) {
      case AgentNodeType.TRIGGER:
        return { triggered: true, nodeId: node.id }

      case AgentNodeType.AGENT:
        return { agentOutput: `Processed by ${node.data.label}`, nodeId: node.id }

      case AgentNodeType.CONDITION:
        const config = node.data.config as { expression?: string }
        const result = config.expression ? eval(config.expression) : true
        return { conditionResult: result, nodeId: node.id }

      case AgentNodeType.PARALLEL:
        return { parallelOutput: true, nodeId: node.id }

      case AgentNodeType.MERGE:
        return { mergedOutput: true, nodeId: node.id }

      case AgentNodeType.OUTPUT:
        return { finalOutput: true, nodeId: node.id }

      default:
        return { output: true, nodeId: node.id }
    }
  }

  stop(): void {
    if (this.isRunning) {
      this.shouldStop = true
    }
  }

  // Preview execution path without running
  preview(nodes: CanvasNode[], edges: Edge[]): string[] {
    if (nodes.length === 0) return []

    const triggerNode = nodes.find(n => n.type === AgentNodeType.TRIGGER)
    if (!triggerNode) return []

    const visited = new Set<string>()
    const order: string[] = []

    const traverse = (nodeId: string): void => {
      if (visited.has(nodeId)) return
      visited.add(nodeId)
      order.push(nodeId)

      const outgoing = edges.filter(e => e.source === nodeId)
      for (const edge of outgoing) {
        traverse(edge.target)
      }
    }

    traverse(triggerNode.id)
    return order
  }

  private finishWithError(steps: ExecutionStep[], startTime: number, message: string): ExecutionResult {
    this.isRunning = false
    editorStateManager.setExecuting(false)

    return {
      success: false,
      steps,
      duration: Date.now() - startTime,
      output: undefined
    }
  }
}

export const executionEngine = new ExecutionEngine()
