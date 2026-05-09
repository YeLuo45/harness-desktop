/**
 * Election Types - P18 Election System
 * 
 * Type definitions for multi-agent election and voting mechanisms
 * in the collaboration framework (P18 = Protocol 18 Election).
 */

// ============================================================================
// Election Core Types
// ============================================================================

export interface Election {
  id: string;
  name: string;
  description: string;
  scope: ElectionScope;
  voteType: VoteType;
  status: ElectionStatus;
  config: ElectionConfig;
  candidates: Candidate[];
  createdAt: number;
  startedAt?: number;
  endedAt?: number;
  result?: ElectionResult;
}

export type ElectionStatus = 
  | 'initialized'    // Election created, not started
  | 'nominating'    // Candidates being nominated
  | 'campaigning'   // Campaign phase
  | 'voting'        // Voting in progress
  | 'counting'      // Ballots being counted
  | 'completed'     // Election finished
  | 'cancelled';    // Election cancelled

export type ElectionScope = 
  | 'session'        // Election within single session
  | 'cross_session'  // Election across multiple sessions
  | 'global';        // Global system-wide election

export type VoteType = 
  | 'simple'         // One person one vote
  | 'ranked'         // Ranked choice voting
  | 'weighted'       // Weighted by influence/confidence
  | 'delegated';     // Delegated voting (liquid democracy)

export type CandidateStatus = 'nominated' | 'withdrawn' | 'elected' | 'defeated';

export interface Candidate {
  id: string;
  personaId: string;
  role: string;
  nominationScore: number;
  campaignStatement?: string;
  status: CandidateStatus;
  voteCount: number;
  rankedVotes?: Map<number, number>; // rank -> count for ranked voting
}

export interface Voter {
  id: string;
  personaId: string;
  role: string;
  weight: number;          // Voting weight (1.0 for simple)
  hasVoted: boolean;
  votedFor: string[];      // Candidate IDs
  voteTimestamp?: number;
  delegationChain?: string[]; // For delegated voting
}

// ============================================================================
// Ballot Types
// ============================================================================

export interface Ballot {
  id: string;
  electionId: string;
  voterId: string;
  votes: VoteEntry[];
  timestamp: number;
  isValid: boolean;
  invalidReason?: string;
}

export interface VoteEntry {
  candidateId: string;
  rank?: number;          // For ranked voting
  weight: number;          // Vote weight
}

export interface RankedBallot {
  rankings: string[];      // Ordered list of candidate IDs
  voterWeight: number;
}

// ============================================================================
// Election Result Types
// ============================================================================

export interface ElectionResult {
  electionId: string;
  winner: string | null;           // Winner candidate ID
  winnerName: string | null;
  totalVotes: number;
  turnout: number;                  // Percentage 0-100
  results: CandidateResult[];
  runoff?: {
    candidateIds: string[];
    reason: string;
  };
  timestamp: number;
  duration: number;                 // ms since election start
}

export interface CandidateResult {
  candidateId: string;
  candidateName: string;
  voteCount: number;
  percentage: number;
  rank: number;
  isWinner: boolean;
}

// ============================================================================
// Election Instance Type
// ============================================================================

export interface Election {
  id: string;
  name: string;
  description: string;
  scope: ElectionScope;
  voteType: VoteType;
  status: ElectionStatus;
  config: ElectionConfig;
  candidates: Candidate[];
  result?: ElectionResult;
  createdAt: number;
  startedAt?: number;
  endedAt?: number;
}

// ============================================================================
// Election Config Types
// ============================================================================

export interface ElectionConfig {
  name: string;
  description: string;
  scope: ElectionScope;
  voteType: VoteType;
  maxCandidates: number;
  minCandidates: number;
  votingDuration: number;           // ms
  nominationDuration: number;       // ms
  campaignDuration: number;        // ms
  requiredQuorum: number;           // Minimum turnout percentage
  enableAbstention: boolean;
  anonymousVoting: boolean;
  allowWriteIns: boolean;
  tieBreakMethod?: TieBreakMethod;   // How to resolve ties
}

export const DEFAULT_ELECTION_CONFIG: ElectionConfig = {
  name: 'P18 General Election',
  description: 'Multi-agent collaboration leader election',
  scope: 'session',
  voteType: 'simple',
  maxCandidates: 10,
  minCandidates: 2,
  votingDuration: 60000,           // 1 minute
  nominationDuration: 30000,       // 30 seconds
  campaignDuration: 30000,         // 30 seconds
  requiredQuorum: 50,              // 50% turnout
  enableAbstention: true,
  anonymousVoting: false,
  allowWriteIns: false,
};

// ============================================================================
// Election Event Types
// ============================================================================

export type ElectionEventType =
  | 'election_created'
  | 'nomination_started'
  | 'candidate_nominated'
  | 'candidate_withdrawn'
  | 'campaign_started'
  | 'voting_started'
  | 'vote_cast'
  | 'vote_changed'
  | 'counting_started'
  | 'counting_completed'
  | 'runoff_triggered'
  | 'election_completed'
  | 'election_cancelled';

export interface ElectionEvent {
  type: ElectionEventType;
  electionId: string;
  data?: unknown;
  timestamp: number;
}

// ============================================================================
// Tie-Breaking Types
// ============================================================================

export type TieBreakMethod = 
  | 'random'           // Random selection
  | 'coin_toss'
  | 'first_nominated'  // Earlier nomination wins
  | 'highest_weight'   // By voter weight sum
  | 'runoff';          // Immediate runoff

export interface TieBreakResult {
  method: TieBreakMethod;
  tiedCandidates: string[];
  winner: string;
  reason: string;
}
