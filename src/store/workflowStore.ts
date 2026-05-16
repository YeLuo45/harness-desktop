// src/store/workflowStore.ts
import { Workflow } from '../types/workflow';

// electron-store key for workflows
const WORKFLOWS_KEY = 'workflows';

// Get stored workflows from electron-store
function getStoredWorkflows(): Workflow[] {
  const electronAPI = (window as any).electronAPI;
  if (electronAPI?.store) {
    return electronAPI.store.get(WORKFLOWS_KEY, []);
  }
  // Fallback for dev without electron
  const stored = localStorage.getItem(WORKFLOWS_KEY);
  return stored ? JSON.parse(stored) : [];
}

// Save workflows to electron-store
function saveWorkflows(workflows: Workflow[]): void {
  const electronAPI = (window as any).electronAPI;
  if (electronAPI?.store) {
    electronAPI.store.set(WORKFLOWS_KEY, workflows);
  } else {
    localStorage.setItem(WORKFLOWS_KEY, JSON.stringify(workflows));
  }
}

export const workflowStore = {
  // Get all workflows
  getAll(): Workflow[] {
    return getStoredWorkflows();
  },

  // Get a single workflow by ID
  getById(id: string): Workflow | undefined {
    const workflows = getStoredWorkflows();
    return workflows.find(w => w.id === id);
  },

  // Save a workflow (create or update)
  save(workflow: Workflow): Workflow {
    const workflows = getStoredWorkflows();
    const now = Date.now();
    
    if (workflow.id) {
      // Update existing
      const index = workflows.findIndex(w => w.id === workflow.id);
      if (index !== -1) {
        workflow.updatedAt = now;
        workflows[index] = workflow;
      } else {
        workflow.createdAt = now;
        workflow.updatedAt = now;
        workflows.push(workflow);
      }
    } else {
      // Create new
      workflow.id = `wf_${now}_${Math.random().toString(36).substr(2, 9)}`;
      workflow.createdAt = now;
      workflow.updatedAt = now;
      workflows.push(workflow);
    }
    
    saveWorkflows(workflows);
    return workflow;
  },

  // Delete a workflow by ID
  delete(id: string): boolean {
    const workflows = getStoredWorkflows();
    const index = workflows.findIndex(w => w.id === id);
    if (index === -1) return false;
    
    workflows.splice(index, 1);
    saveWorkflows(workflows);
    return true;
  },

  // List all workflow summaries (for cards)
  listSummaries(): Array<{ id: string; name: string; nodeCount: number; updatedAt: number }> {
    return getStoredWorkflows().map(w => ({
      id: w.id,
      name: w.name,
      nodeCount: w.nodes.length,
      updatedAt: w.updatedAt,
    }));
  },
};