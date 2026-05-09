import { AgentNodeType, NodeDefinition, CanvasNode, Position, NodeData } from './visualBuilderTypes'
import { defaultNodeDefinitions } from './visualBuilderTypes'

const generateId = (): string => Math.random().toString(36).substring(2, 11)

export class NodeRegistry {
  private definitions: Map<AgentNodeType, NodeDefinition> = new Map()

  constructor() {
    this.registerDefaults()
  }

  private registerDefaults(): void {
    defaultNodeDefinitions.forEach(def => {
      this.register(def)
    })
  }

  register(definition: NodeDefinition): void {
    this.definitions.set(definition.type, definition)
  }

  getDefinition(type: AgentNodeType): NodeDefinition | undefined {
    return this.definitions.get(type)
  }

  getAllDefinitions(): NodeDefinition[] {
    return Array.from(this.definitions.values())
  }

  createNode(type: AgentNodeType, position: Position): CanvasNode | undefined {
    const def = this.getDefinition(type)
    if (!def) return undefined

    const id = generateId()
    const nodeData: NodeData = {
      label: def.defaultData.label || def.label,
      description: def.description,
      config: { ...def.defaultData.config },
      inputs: [...(def.inputs || [])],
      outputs: [...(def.outputs || [])]
    }

    return {
      id,
      type,
      position,
      data: nodeData
    }
  }

  cloneNode(node: CanvasNode, offset: Position = { x: 50, y: 50 }): CanvasNode {
    const def = this.getDefinition(node.type)
    return {
      id: generateId(),
      type: node.type,
      position: {
        x: node.position.x + offset.x,
        y: node.position.y + offset.y
      },
      data: {
        ...node.data,
        config: { ...node.data.config },
        inputs: node.data.inputs ? [...node.data.inputs] : undefined,
        outputs: node.data.outputs ? [...node.data.outputs] : undefined
      }
    }
  }

  getNodeTypes(): AgentNodeType[] {
    return Array.from(this.definitions.keys())
  }
}

export const nodeRegistry = new NodeRegistry()
