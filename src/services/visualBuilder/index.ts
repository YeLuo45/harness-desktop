// Visual Builder - barrel export

export * from './visualBuilderTypes'
export { CanvasEditor, canvasEditor } from './canvasEditor'
export { NodeRegistry, nodeRegistry } from './nodeRegistry'
export { ExecutionEngine, executionEngine } from './executionEngine'
export { EditorStateManager, editorStateManager } from './editorState'

/*
Quick Start:

import { canvasEditor, AgentNodeType } from './visualBuilder'

// Add nodes
canvasEditor.addNode(AgentNodeType.TRIGGER, { x: 100, y: 100 })
canvasEditor.addNode(AgentNodeType.AGENT, { x: 100, y: 200 })
canvasEditor.addNode(AgentNodeType.OUTPUT, { x: 100, y: 300 })

// Connect nodes
canvasEditor.connect('trigger-node-id', 'out', 'agent-node-id', 'in')
canvasEditor.connect('agent-node-id', 'out', 'output-node-id', 'in')

// Execute
const result = await canvasEditor.execute()

// Save
canvasEditor.save()

// Export
const json = canvasEditor.export()
*/
