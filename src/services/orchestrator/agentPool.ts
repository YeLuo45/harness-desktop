/**
 * Agent Pool Manager
 * Manages a pool of agents with capabilities, load balancing, and availability tracking
 */

import { AgentSpec, AgentCapability, AgentPoolConfig } from './types';

/** Default agent pool configuration */
const DEFAULT_CONFIG: AgentPoolConfig = {
  minAgents: 1,
  maxAgents: 10,
  agentSpecs: [],
  loadBalancingStrategy: 'least_load',
};

/**
 * Agent Pool Manager for distributing tasks across available agents
 */
export class AgentPool {
  private agents: Map<string, AgentSpec> = new Map();
  private config: AgentPoolConfig;
  private taskQueue: Map<string, string[]> = new Map(); // agentId -> taskIds
  
  constructor(config: Partial<AgentPoolConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initializeAgents();
  }
  
  /**
   * Initializes agents from configuration
   */
  private initializeAgents(): void {
    for (const spec of this.config.agentSpecs) {
      this.agents.set(spec.id, { ...spec });
    }
  }
  
  /**
   * Registers a new agent to the pool
   */
  registerAgent(spec: AgentSpec): boolean {
    if (this.agents.size >= this.config.maxAgents) {
      console.warn(`Agent pool full (max: ${this.config.maxAgents}). Cannot register ${spec.id}`);
      return false;
    }
    
    if (this.agents.has(spec.id)) {
      console.warn(`Agent ${spec.id} already registered. Updating.`);
    }
    
    this.agents.set(spec.id, { ...spec, currentLoad: 0, isAvailable: true });
    return true;
  }
  
  /**
   * Removes an agent from the pool
   */
  removeAgent(agentId: string): boolean {
    if (!this.agents.has(agentId)) {
      return false;
    }
    
    // Wait for current tasks to complete or reassign
    const agent = this.agents.get(agentId);
    if (agent && agent.currentLoad > 0) {
      console.warn(`Agent ${agentId} has ${agent.currentLoad} active tasks. Removal deferred.`);
      return false;
    }
    
    this.agents.delete(agentId);
    this.taskQueue.delete(agentId);
    return true;
  }
  
  /**
   * Gets an available agent matching the required capabilities
   */
  getAvailableAgent(requiredCapabilities: AgentCapability[]): AgentSpec | null {
    const availableAgents = this.getAllAvailableAgents();
    
    if (availableAgents.length === 0) {
      return null;
    }
    
    // Filter by capabilities
    const matchingAgents = availableAgents.filter(agent =>
      requiredCapabilities.some(cap => agent.capabilities.includes(cap))
    );
    
    if (matchingAgents.length === 0) {
      // Fall back to any available agent with GENERAL capability
      const fallback = availableAgents.find(agent =>
        agent.capabilities.includes(AgentCapability.GENERAL)
      );
      return fallback || null;
    }
    
    // Apply load balancing strategy
    return this.selectAgent(matchingAgents);
  }
  
  /**
   * Gets all currently available agents
   */
  getAllAvailableAgents(): AgentSpec[] {
    return Array.from(this.agents.values())
      .filter(agent => agent.isAvailable && agent.currentLoad < agent.maxConcurrentTasks);
  }
  
  /**
   * Selects an agent based on the configured load balancing strategy
   */
  private selectAgent(agents: AgentSpec[]): AgentSpec {
    switch (this.config.loadBalancingStrategy) {
      case 'least_load':
        return agents.reduce((min, agent) =>
          agent.currentLoad < min.currentLoad ? agent : min
        );
      
      case 'round_robin':
        // Simple round-robin: pick the agent with lowest load among those with same capacity
        const sorted = [...agents].sort((a, b) => a.currentLoad - b.currentLoad);
        return sorted[0];
      
      case 'capability_match':
        // Already filtered by capabilities, just pick least loaded
        return agents.reduce((min, agent) =>
          agent.currentLoad < min.currentLoad ? agent : min
        );
      
      default:
        return agents[0];
    }
  }
  
  /**
   * Assigns a task to an agent, incrementing their load
   */
  assignTask(agentId: string, taskId: string): boolean {
    const agent = this.agents.get(agentId);
    
    if (!agent) {
      console.error(`Agent ${agentId} not found`);
      return false;
    }
    
    if (!agent.isAvailable) {
      console.error(`Agent ${agentId} is not available`);
      return false;
    }
    
    if (agent.currentLoad >= agent.maxConcurrentTasks) {
      console.error(`Agent ${agentId} at max capacity`);
      return false;
    }
    
    agent.currentLoad++;
    
    // Track task assignment
    if (!this.taskQueue.has(agentId)) {
      this.taskQueue.set(agentId, []);
    }
    this.taskQueue.get(agentId)!.push(taskId);
    
    return true;
  }
  
  /**
   * Releases a task from an agent, decrementing their load
   */
  releaseTask(agentId: string, taskId: string): boolean {
    const agent = this.agents.get(agentId);
    
    if (!agent) {
      return false;
    }
    
    if (agent.currentLoad > 0) {
      agent.currentLoad--;
    }
    
    // Remove from task queue
    const tasks = this.taskQueue.get(agentId);
    if (tasks) {
      const index = tasks.indexOf(taskId);
      if (index > -1) {
        tasks.splice(index, 1);
      }
    }
    
    return true;
  }
  
  /**
   * Gets the current load for an agent
   */
  getAgentLoad(agentId: string): number {
    return this.agents.get(agentId)?.currentLoad || 0;
  }
  
  /**
   * Gets all registered agents
   */
  getAllAgents(): AgentSpec[] {
    return Array.from(this.agents.values());
  }
  
  /**
   * Gets agent by ID
   */
  getAgent(agentId: string): AgentSpec | undefined {
    return this.agents.get(agentId);
  }
  
  /**
   * Updates agent availability status
   */
  setAgentAvailability(agentId: string, isAvailable: boolean): boolean {
    const agent = this.agents.get(agentId);
    
    if (!agent) {
      return false;
    }
    
    agent.isAvailable = isAvailable;
    return true;
  }
  
  /**
   * Gets pool statistics
   */
  getStats(): {
    totalAgents: number;
    availableAgents: number;
    totalLoad: number;
    averageLoad: number;
  } {
    const agents = this.getAllAgents();
    const available = agents.filter(a => a.isAvailable);
    const totalLoad = agents.reduce((sum, a) => sum + a.currentLoad, 0);
    
    return {
      totalAgents: agents.length,
      availableAgents: available.length,
      totalLoad,
      averageLoad: agents.length > 0 ? totalLoad / agents.length : 0,
    };
  }
  
  /**
   * Checks if any agent can handle the required capabilities
   */
  canHandle(requiredCapabilities: AgentCapability[]): boolean {
    return this.getAvailableAgent(requiredCapabilities) !== null;
  }
  
  /**
   * Scales the pool (adds/removes agents based on load)
   */
  scale(desiredSize: number): void {
    const currentSize = this.agents.size;
    
    if (desiredSize > currentSize && desiredSize <= this.config.maxAgents) {
      // Scale up - would typically spawn new agents
      console.log(`Scaling up from ${currentSize} to ${desiredSize} agents`);
    } else if (desiredSize < currentSize) {
      // Scale down - remove agents with no load
      console.log(`Scaling down from ${currentSize} to ${desiredSize} agents`);
    }
  }
}

export default AgentPool;
