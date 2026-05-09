/**
 * Election Services - P18 Multi-Agent Election System
 * 
 * Barrel export for all election-related services.
 * Implements multi-agent voting and election protocols.
 * 
 * @example
 * import { 
 *   ElectionManager,
 *   createElection,
 *   createElectionWithCandidates,
 *   countVotes,
 *   checkForTie,
 *   ElectionConfig,
 *   DEFAULT_ELECTION_CONFIG,
 * } from '@/services/collaboration/election';
 */

// Types
export * from './electionTypes';

// Core Components
export { ElectionManager, createElection, createElectionWithCandidates } from './electionManager';
export { 
  countVotes, 
  determineWinner, 
  checkForTie, 
  resolveTie,
  calculateQuorum,
  isMajorityReached,
  getTopCandidates,
  formatVotePercentage,
} from './voteCounter';
export { 
  createBallotValidator, 
  validateVoteEntry,
  validateElectionConfig,
  sanitizeBallot,
  type ValidationResult,
} from './ballotValidator';

// ============================================================================
// Quick Start Example
// ============================================================================

/**
 * Quick Start: Run a simple election
 * 
 * ```typescript
 * import { createElection } from '@/services/collaboration/election';
 * 
 * async function main() {
 *   // Create election with default config
 *   const election = createElection({
 *     name: 'Team Leader Election',
 *     voteType: 'simple',
 *     votingDuration: 60000, // 1 minute
 *   });
 * 
 *   // Listen to events
 *   election.onEvent((event) => {
 *     console.log(`[${event.type}]`, event.data);
 *   });
 * 
 *   // Start nomination phase
 *   election.startNomination();
 * 
 *   // Add candidates
 *   election.addCandidate('persona_1', 'MemoryExpert');
 *   election.addCandidate('persona_2', 'EmotionAnalyst');
 *   election.addCandidate('persona_3', 'Advisor');
 * 
 *   // Auto-advance to campaign then voting (or manual)
 *   // election.startCampaign();
 *   // election.startVoting();
 * 
 *   // Register voters
 *   const voter1 = election.registerVoter('voter_persona_1', 'MemoryExpert', 1.0);
 *   const voter2 = election.registerVoter('voter_persona_2', 'EmotionAnalyst', 1.0);
 * 
 *   // Wait for voting to start, then cast votes
 *   election.castVote(voter1.id, [{ candidateId: '...', weight: 1 }]);
 *   election.castVote(voter2.id, [{ candidateId: '...', weight: 1 }]);
 * 
 *   // Get results
 *   election.endVoting();
 *   const result = election.getResult();
 *   console.log('Winner:', result?.winnerName);
 * 
 *   // Cleanup
 *   election.destroy();
 * }
 * 
 * main();
 * ```
 */

/**
 * Quick Start: Ranked Choice Voting
 * 
 * ```typescript
 * import { createElection } from '@/services/collaboration/election';
 * 
 * async function rankedExample() {
 *   const election = createElection({
 *     name: 'President Election',
 *     voteType: 'ranked',
 *     votingDuration: 120000,
 *   });
 * 
 *   election.startNomination();
 *   // ... add candidates
 *   election.startCampaign();
 *   election.startVoting();
 * 
 *   // Cast ranked votes (rank 1 = first choice, 2 = second choice, etc.)
 *   election.castVote(voterId, [
 *     { candidateId: 'candidate_1', rank: 1, weight: 1 },
 *     { candidateId: 'candidate_2', rank: 2, weight: 1 },
 *     { candidateId: 'candidate_3', rank: 3, weight: 1 },
 *   ]);
 * 
 *   election.endVoting();
 *   const result = election.getResult();
 *   console.log('Winner by ranked choice:', result?.winnerName);
 * }
 * ```
 */

// ============================================================================
// Default Export
// ============================================================================

import { createElection, ElectionManager } from './electionManager';
import { DEFAULT_ELECTION_CONFIG } from './electionTypes';
import type { ElectionConfig, ElectionResult, Ballot, VoteEntry } from './electionTypes';

export default {
  createElection: (config?: Partial<ElectionConfig>) => createElection(config),
  ElectionManager,
  DEFAULT_ELECTION_CONFIG,
};
