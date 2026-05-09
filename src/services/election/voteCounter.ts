/**
 * Vote Counter - P18 Election System
 * 
 * Handles vote counting algorithms for different voting methods:
 * - Simple majority voting
 * - Ranked choice voting (instant runoff)
 * - Weighted voting
 * - Delegated/liquid democracy voting
 */

import type {
  Candidate,
  CandidateResult,
  Ballot,
  VoteEntry,
  VoteType,
  TieBreakResult,
  TieBreakMethod,
} from './electionTypes';

// ============================================================================
// Main Vote Counting
// ============================================================================

export function countVotes(
  ballots: Ballot[],
  candidates: Candidate[],
  voteType: VoteType
): CandidateResult[] {
  switch (voteType) {
    case 'simple':
      return countSimpleVotes(ballots, candidates);
    case 'ranked':
      return countRankedVotes(ballots, candidates);
    case 'weighted':
      return countWeightedVotes(ballots, candidates);
    case 'delegated':
      return countDelegatedVotes(ballots, candidates);
    default:
      return countSimpleVotes(ballots, candidates);
  }
}

export function determineWinner(results: CandidateResult[]): CandidateResult | null {
  if (results.length === 0) return null;
  
  const sorted = [...results].sort((a, b) => b.voteCount - a.voteCount);
  return sorted[0];
}

export function checkForTie(results: CandidateResult[]): {
  isTied: boolean;
  tiedCandidates: string[];
  tiedCandidateIds: string[];
  topVoteCount: number;
} {
  if (results.length < 2) {
    return { isTied: false, tiedCandidates: [], tiedCandidateIds: [], topVoteCount: 0 };
  }
  
  const sorted = [...results].sort((a, b) => b.voteCount - a.voteCount);
  const topVoteCount = sorted[0].voteCount;
  
  // Find all candidates with the top vote count
  const tied = sorted.filter(r => r.voteCount === topVoteCount);
  
  if (tied.length > 1) {
    return {
      isTied: true,
      tiedCandidates: tied.map(t => t.candidateName),
      tiedCandidateIds: tied.map(t => t.candidateId),
      topVoteCount,
    };
  }
  
  return { isTied: false, tiedCandidates: [], tiedCandidateIds: [], topVoteCount };
}

export function resolveTie(
  tiedCandidates: string[],
  tiedCandidateIds: string[],
  method: TieBreakMethod
): TieBreakResult {
  switch (method) {
    case 'random':
    case 'coin_toss':
      const randomIndex = Math.floor(Math.random() * tiedCandidates.length);
      return {
        method,
        tiedCandidates,
        winner: tiedCandidateIds[randomIndex],
        reason: `Random selection (${method}) decided the tie`,
      };
    
    case 'first_nominated':
      // Winner is first in the original order (already sorted by nomination order)
      return {
        method,
        tiedCandidates,
        winner: tiedCandidateIds[0],
        reason: 'Earlier nomination order determined the winner',
      };
    
    case 'highest_weight':
      // For now, just pick first - would need voter data for actual weight calculation
      return {
        method,
        tiedCandidates,
        winner: tiedCandidateIds[0],
        reason: 'First candidate selected in weight-based tiebreak',
      };
    
    case 'runoff':
      // This should trigger a runoff in the election manager
      return {
        method,
        tiedCandidates,
        winner: tiedCandidateIds[0],
        reason: 'Runoff election required for tied candidates',
      };
    
    default:
      return {
        method: 'random',
        tiedCandidates,
        winner: tiedCandidateIds[Math.floor(Math.random() * tiedCandidateIds.length)],
        reason: 'Default random selection for tiebreak',
      };
  }
}

// ============================================================================
// Simple Majority Voting
// ============================================================================

function countSimpleVotes(ballots: Ballot[], candidates: Candidate[]): CandidateResult[] {
  const voteCounts = new Map<string, number>();
  
  // Initialize all candidates with 0 votes
  for (const candidate of candidates) {
    voteCounts.set(candidate.id, 0);
  }
  
  // Count first-choice votes only
  for (const ballot of ballots) {
    if (!ballot.isValid) continue;
    
    // For simple voting, only count the first vote entry
    if (ballot.votes.length > 0) {
      const firstVote = ballot.votes[0];
      const current = voteCounts.get(firstVote.candidateId) || 0;
      voteCounts.set(firstVote.candidateId, current + 1);
    }
  }
  
  const totalVotes = ballots.length;
  
  return candidates.map((candidate, index) => {
    const voteCount = voteCounts.get(candidate.id) || 0;
    const percentage = totalVotes > 0 ? (voteCount / totalVotes) * 100 : 0;
    
    return {
      candidateId: candidate.id,
      candidateName: candidate.personaId,
      voteCount,
      percentage,
      rank: index + 1,
      isWinner: false,
    };
  }).sort((a, b) => b.voteCount - a.voteCount)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

// ============================================================================
// Ranked Choice Voting (Instant Runoff)
// ============================================================================

function countRankedVotes(ballots: Ballot[], candidates: Candidate[]): CandidateResult[] {
  const activeCandidates = new Set(candidates.map(c => c.id));
  const voteCounts = new Map<string, number>();
  const roundResults: Map<string, number[]> = new Map();
  
  // Initialize
  for (const candidate of candidates) {
    voteCounts.set(candidate.id, 0);
    roundResults.set(candidate.id, []);
  }
  
  // Get current rankings for a ballot
  function getCurrentVote(ballot: Ballot): string | null {
    for (const vote of ballot.votes) {
      if (vote.rank !== undefined && activeCandidates.has(vote.candidateId)) {
        return vote.candidateId;
      }
    }
    // If no ranked votes, use first vote
    if (ballot.votes.length > 0 && activeCandidates.has(ballot.votes[0].candidateId)) {
      return ballot.votes[0].candidateId;
    }
    return null;
  }
  
  // Count current round
  function countRound(round: number): Map<string, number> {
    const counts = new Map<string, number>();
    for (const id of activeCandidates) {
      counts.set(id, 0);
    }
    
    for (const ballot of ballots) {
      if (!ballot.isValid) continue;
      const votedFor = getCurrentVote(ballot);
      if (votedFor && activeCandidates.has(votedFor)) {
        counts.set(votedFor, (counts.get(votedFor) || 0) + 1);
      }
    }
    
    return counts;
  }
  
  // Run instant runoff
  let round = 0;
  while (activeCandidates.size > 2) {
    const counts = countRound(round);
    
    // Record this round
    for (const [id, count] of counts) {
      roundResults.get(id)!.push(count);
    }
    
    // Find lowest
    let lowest = Infinity;
    let lowestId: string | null = null;
    for (const [id, count] of counts) {
      if (count < lowest) {
        lowest = count;
        lowestId = id;
      }
    }
    
    // Check for tie at bottom
    const tied = Array.from(counts.entries())
      .filter(([, count]) => count === lowest);
    
    if (tied.length === activeCandidates.size) {
      // Everyone tied - all eliminated
      break;
    }
    
    // Eliminate lowest (or random among tied)
    if (lowestId) {
      activeCandidates.delete(lowestId);
    }
    
    round++;
    
    if (round > candidates.length) break; // Safety
  }
  
  // Final count with remaining candidates
  const finalCounts = countRound(round);
  const totalVotes = Array.from(finalCounts.values()).reduce((a, b) => a + b, 0);
  
  return candidates.map(candidate => {
    const voteCount = finalCounts.get(candidate.id) || 0;
    const percentage = totalVotes > 0 ? (voteCount / totalVotes) * 100 : 0;
    const roundsData = roundResults.get(candidate.id) || [];
    
    return {
      candidateId: candidate.id,
      candidateName: candidate.personaId,
      voteCount,
      percentage,
      rank: 0,
      isWinner: false,
    };
  }).sort((a, b) => b.voteCount - a.voteCount)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

// ============================================================================
// Weighted Voting
// ============================================================================

function countWeightedVotes(ballots: Ballot[], candidates: Candidate[]): CandidateResult[] {
  const voteCounts = new Map<string, number>();
  
  // Initialize
  for (const candidate of candidates) {
    voteCounts.set(candidate.id, 0);
  }
  
  // Count weighted votes
  for (const ballot of ballots) {
    if (!ballot.isValid) continue;
    
    // First vote gets full weight
    if (ballot.votes.length > 0) {
      const firstVote = ballot.votes[0];
      const current = voteCounts.get(firstVote.candidateId) || 0;
      voteCounts.set(firstVote.candidateId, current + firstVote.weight);
    }
  }
  
  const totalWeight = ballots.reduce((sum, b) => {
    if (!b.isValid || b.votes.length === 0) return sum;
    return sum + b.votes[0].weight;
  }, 0);
  
  return candidates.map(candidate => {
    const voteCount = voteCounts.get(candidate.id) || 0;
    const percentage = totalWeight > 0 ? (voteCount / totalWeight) * 100 : 0;
    
    return {
      candidateId: candidate.id,
      candidateName: candidate.personaId,
      voteCount,
      percentage,
      rank: 0,
      isWinner: false,
    };
  }).sort((a, b) => b.voteCount - a.voteCount)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

// ============================================================================
// Delegated Voting (Liquid Democracy)
// ============================================================================

function countDelegatedVotes(ballots: Ballot[], candidates: Candidate[]): CandidateResult[] {
  // Build delegation graph
  const delegations = new Map<string, string>(); // voterId -> delegateVoterId
  
  for (const ballot of ballots) {
    if (!ballot.isValid) continue;
    
    // For delegated voting, check if vote has delegation info
    if (ballot.votes.length > 0) {
      const vote = ballot.votes[0];
      if (vote.candidateId.startsWith('delegate:')) {
        // This is a delegation
        const delegateId = vote.candidateId.replace('delegate:', '');
        delegations.set(ballot.voterId, delegateId);
      }
    }
  }
  
  // Resolve delegations (follow chain to find ultimate vote)
  function resolveVote(voterId: string, depth = 0): string | null {
    if (depth > 100) return null; // Prevent cycles
    const delegate = delegations.get(voterId);
    if (!delegate) return null;
    return resolveVote(delegate, depth + 1) || delegate;
  }
  
  // Count votes with delegation resolution
  const voteCounts = new Map<string, number>();
  
  for (const candidate of candidates) {
    voteCounts.set(candidate.id, 0);
  }
  
  for (const ballot of ballots) {
    if (!ballot.isValid) continue;
    if (ballot.votes.length === 0) continue;
    
    let targetVoterId = ballot.voterId;
    
    // Check for delegation
    const delegate = delegations.get(ballot.voterId);
    if (delegate) {
      targetVoterId = delegate;
    }
    
    // The delegate's ballot votes count
    const delegateBallot = ballots.find(b => b.voterId === targetVoterId);
    if (delegateBallot && delegateBallot.votes.length > 0) {
      const firstVote = delegateBallot.votes[0];
      const current = voteCounts.get(firstVote.candidateId) || 0;
      voteCounts.set(firstVote.candidateId, current + 1);
    }
  }
  
  const totalVotes = ballots.length;
  
  return candidates.map(candidate => {
    const voteCount = voteCounts.get(candidate.id) || 0;
    const percentage = totalVotes > 0 ? (voteCount / totalVotes) * 100 : 0;
    
    return {
      candidateId: candidate.id,
      candidateName: candidate.personaId,
      voteCount,
      percentage,
      rank: 0,
      isWinner: false,
    };
  }).sort((a, b) => b.voteCount - a.voteCount)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

// ============================================================================
// Utility Functions
// ============================================================================

export function calculateQuorum(requiredQuorum: number, totalVoters: number, votesCast: number): boolean {
  if (totalVoters === 0) return true; // No voters = passes
  const turnoutPercentage = (votesCast / totalVoters) * 100;
  return turnoutPercentage >= requiredQuorum;
}

export function isMajorityReached(voteCount: number, totalVotes: number): boolean {
  if (totalVotes === 0) return false;
  return (voteCount / totalVotes) > 0.5;
}

export function getTopCandidates(results: CandidateResult[], count: number): CandidateResult[] {
  return [...results]
    .sort((a, b) => b.voteCount - a.voteCount)
    .slice(0, count);
}

export function formatVotePercentage(percentage: number, decimals = 1): string {
  return `${percentage.toFixed(decimals)}%`;
}
