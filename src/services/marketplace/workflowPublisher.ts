import { WorkflowPackage, SerializedWorkflow, AuthorInfo, WorkflowCategory, WorkflowConfig } from './marketplaceTypes'
import { marketplace } from './marketplace'

export interface PublishOptions {
  name: string
  description: string
  tags: string[]
  category: WorkflowCategory
  workflow: SerializedWorkflow
  config: WorkflowConfig
  author: AuthorInfo
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

const MAX_NAME_LENGTH = 100
const MAX_DESC_LENGTH = 500
const MAX_TAGS = 10

export class WorkflowPublisher {
  validateWorkflow(workflow: SerializedWorkflow): ValidationResult {
    const errors: string[] = []

    if (!workflow.id) errors.push('Workflow ID is required')
    if (!workflow.name) errors.push('Workflow name is required')
    if (!workflow.nodes || workflow.nodes.length === 0) {
      errors.push('Workflow must have at least one node')
    }
    if (!workflow.edges) errors.push('Workflow edges are required')

    // Validate nodes
    if (workflow.nodes) {
      workflow.nodes.forEach((node, idx) => {
        if (!node.id) errors.push(`Node ${idx} missing ID`)
        if (!node.type) errors.push(`Node ${idx} missing type`)
      })
    }

    // Validate edges reference valid nodes
    if (workflow.nodes && workflow.edges) {
      const nodeIds = new Set(workflow.nodes.map(n => n.id))
      workflow.edges.forEach((edge, idx) => {
        if (!nodeIds.has(edge.source)) {
          errors.push(`Edge ${idx} references invalid source: ${edge.source}`)
        }
        if (!nodeIds.has(edge.target)) {
          errors.push(`Edge ${idx} references invalid target: ${edge.target}`)
        }
      })
    }

    return { valid: errors.length === 0, errors }
  }

  validateMetadata(pkg: Partial<WorkflowPackage>): ValidationResult {
    const errors: string[] = []

    if (!pkg.name || pkg.name.length === 0) {
      errors.push('Name is required')
    } else if (pkg.name.length > MAX_NAME_LENGTH) {
      errors.push(`Name exceeds ${MAX_NAME_LENGTH} characters`)
    }

    if (!pkg.description || pkg.description.length === 0) {
      errors.push('Description is required')
    } else if (pkg.description.length > MAX_DESC_LENGTH) {
      errors.push(`Description exceeds ${MAX_DESC_LENGTH} characters`)
    }

    if (!pkg.tags || pkg.tags.length === 0) {
      errors.push('At least one tag is required')
    } else if (pkg.tags.length > MAX_TAGS) {
      errors.push(`Maximum ${MAX_TAGS} tags allowed`)
    }

    if (!pkg.category) {
      errors.push('Category is required')
    }

    if (!pkg.author) {
      errors.push('Author info is required')
    }

    return { valid: errors.length === 0, errors }
  }

  async publish(options: PublishOptions): Promise<string> {
    // Validate workflow structure
    const workflowValidation = this.validateWorkflow(options.workflow)
    if (!workflowValidation.valid) {
      throw new Error(`Invalid workflow: ${workflowValidation.errors.join(', ')}`)
    }

    // Validate metadata
    const pkg: Omit<WorkflowPackage, 'id' | 'stats' | 'publishedAt' | 'updatedAt'> = {
      name: options.name,
      description: options.description,
      tags: options.tags,
      category: options.category,
      workflow: options.workflow,
      config: options.config,
      author: options.author,
      version: '1.0.0'
    }

    const metaValidation = this.validateMetadata(pkg)
    if (!metaValidation.valid) {
      throw new Error(`Invalid metadata: ${metaValidation.errors.join(', ')}`)
    }

    return marketplace.publish(pkg)
  }

  async updateVersion(id: string, version: string, workflow: SerializedWorkflow): Promise<void> {
    const pkg = await marketplace.getById(id)
    if (!pkg) throw new Error(`Workflow ${id} not found`)

    const workflowValidation = this.validateWorkflow(workflow)
    if (!workflowValidation.valid) {
      throw new Error(`Invalid workflow: ${workflowValidation.errors.join(', ')}`)
    }

    await marketplace.update(id, {
      version,
      workflow,
      updatedAt: Date.now()
    })
  }
}

export const workflowPublisher = new WorkflowPublisher()
