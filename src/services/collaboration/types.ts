/**
 * Collaboration Types
 * 
 * Defines types for multi-agent collaboration and approval workflows.
 */

/**
 * Persona roles for agent collaboration
 */
export type PersonaRole = 'MemoryExpert' | 'EmotionAnalyst' | 'Advisor' | 'Researcher' | 'Coder';

/**
 * Approval status for workflows
 */
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'delegated' | 'expired';

/**
 * Priority levels for approval requests
 */
export type PriorityLevel = 'low' | 'medium' | 'high' | 'critical';

/**
 * Collaboration participant
 */
export interface CollaborationParticipant {
  id: string;
  role: PersonaRole;
  name: string;
  isAvailable: boolean;
}

/**
 * Approval request
 */
export interface ApprovalRequest {
  id: string;
  requesterId: string;
  requesterRole: PersonaRole;
  targetRole: PersonaRole;
  priority: PriorityLevel;
  status: ApprovalStatus;
  createdAt: number;
  expiresAt?: number;
  metadata?: Record<string, unknown>;
}
