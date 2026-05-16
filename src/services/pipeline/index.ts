/**
 * Pipeline Services
 * 
 * Phase-gated pipeline orchestration for multi-agent workflows.
 */

export { PhaseGateway, type Phase, type PhaseConfig, type PipelineContext, type PhaseHistory } from './phaseGateway'
export { PipelineOrchestrator, type PipelineOptions } from './pipelineOrchestrator'