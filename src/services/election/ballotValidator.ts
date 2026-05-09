/**
 * Ballot Validator - P18 Election System
 * 
 * Validates ballots and vote entries according to election rules:
 * - Checks for valid candidate IDs
 * - Validates vote weights
 * - Validates ranked choice requirements
 * - Handles write-in candidate validation
 */

import type {
  Ballot,
  VoteEntry,
  VoteType,
  ElectionConfig,
  Candidate,
} from './electionTypes';

// ============================================================================
// Validation Result
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  reason?: string;
  errors?: string[];
}

// ============================================================================
// Vote Entry Validation
// ============================================================================

export function validateVoteEntry(
  vote: VoteEntry,
  validCandidateIds: string[],
  allowWriteIns: boolean
): ValidationResult {
  const errors: string[] = [];
  
  // Check candidate ID
  if (!vote.candidateId) {
    errors.push('Missing candidate ID');
  } else if (!allowWriteIns && !validCandidateIds.includes(vote.candidateId)) {
    errors.push(`Invalid candidate ID: ${vote.candidateId}`);
  }
  
  // Check weight
  if (typeof vote.weight !== 'number') {
    errors.push('Missing vote weight');
  } else if (vote.weight <= 0) {
    errors.push('Vote weight must be positive');
  } else if (vote.weight > 100) {
    errors.push('Vote weight exceeds maximum allowed');
  }
  
  // Check rank if provided
  if (vote.rank !== undefined) {
    if (typeof vote.rank !== 'number' || vote.rank < 1) {
      errors.push('Rank must be a positive integer');
    }
  }
  
  return {
    valid: errors.length === 0,
    reason: errors.length > 0 ? errors.join('; ') : undefined,
    errors: errors.length > 0 ? errors : undefined,
  };
}

// ============================================================================
// Ballot Validator Factory
// ============================================================================

export function createBallotValidator(voteType: VoteType): BallotValidator {
  switch (voteType) {
    case 'simple':
      return new SimpleBallotValidator();
    case 'ranked':
      return new RankedBallotValidator();
    case 'weighted':
      return new WeightedBallotValidator();
    case 'delegated':
      return new DelegatedBallotValidator();
    default:
      return new SimpleBallotValidator();
  }
}

// ============================================================================
// Base Ballot Validator
// ============================================================================

export interface BallotValidator {
  validate(ballot: Ballot, candidates: Candidate[]): ValidationResult;
  validateVotes(votes: VoteEntry[], candidates: Candidate[]): ValidationResult;
}

// ============================================================================
// Simple Ballot Validator
// ============================================================================

class SimpleBallotValidator implements BallotValidator {
  validate(ballot: Ballot, candidates: Candidate[]): ValidationResult {
    const errors: string[] = [];
    const validCandidateIds = candidates.map(c => c.id);
    
    // Must have at least one vote
    if (!ballot.votes || ballot.votes.length === 0) {
      errors.push('Ballot must contain at least one vote');
    }
    
    // Can only have one vote for simple voting
    if (ballot.votes.length > 1) {
      errors.push('Simple voting allows only one vote per ballot');
    }
    
    // Validate each vote
    for (let i = 0; i < ballot.votes.length; i++) {
      const vote = ballot.votes[i];
      const result = validateVoteEntry(vote, validCandidateIds, false);
      if (!result.valid) {
        errors.push(`Vote ${i + 1}: ${result.reason}`);
      }
    }
    
    return {
      valid: errors.length === 0,
      reason: errors.length > 0 ? errors.join('; ') : undefined,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  validateVotes(votes: VoteEntry[], candidates: Candidate[]): ValidationResult {
    if (votes.length > 1) {
      return {
        valid: false,
        reason: 'Simple voting allows only one vote per ballot',
      };
    }
    return this.validate({ votes } as Ballot, candidates);
  }
}

// ============================================================================
// Ranked Ballot Validator
// ============================================================================

class RankedBallotValidator implements BallotValidator {
  validate(ballot: Ballot, candidates: Candidate[]): ValidationResult {
    const errors: string[] = [];
    const validCandidateIds = candidates.map(c => c.id);
    const usedRanks = new Set<number>();
    const usedCandidates = new Set<string>();
    
    // Must have votes
    if (!ballot.votes || ballot.votes.length === 0) {
      errors.push('Ballot must contain at least one vote');
    }
    
    // Validate each vote entry
    for (let i = 0; i < ballot.votes.length; i++) {
      const vote = ballot.votes[i];
      
      // Validate candidate
      const candidateResult = validateVoteEntry(vote, validCandidateIds, false);
      if (!candidateResult.valid) {
        errors.push(`Vote ${i + 1}: ${candidateResult.reason}`);
      } else {
        // Check for duplicate candidates
        if (usedCandidates.has(vote.candidateId)) {
          errors.push(`Vote ${i + 1}: Duplicate candidate ${vote.candidateId}`);
        }
        usedCandidates.add(vote.candidateId);
      }
      
      // Validate rank
      if (vote.rank !== undefined) {
        if (usedRanks.has(vote.rank)) {
          errors.push(`Vote ${i + 1}: Duplicate rank ${vote.rank}`);
        }
        usedRanks.add(vote.rank);
      }
    }
    
    // Check for consecutive ranks (if ranks are provided)
    if (usedRanks.size > 0) {
      const sortedRanks = Array.from(usedRanks).sort((a, b) => a - b);
      for (let i = 1; i < sortedRanks.length; i++) {
        if (sortedRanks[i] !== sortedRanks[i - 1] + 1) {
          errors.push('Ranks must be consecutive');
          break;
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      reason: errors.length > 0 ? errors.join('; ') : undefined,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  validateVotes(votes: VoteEntry[], candidates: Candidate[]): ValidationResult {
    // Convert to ballot-like object for validation
    return this.validate({ votes } as Ballot, candidates);
  }
}

// ============================================================================
// Weighted Ballot Validator
// ============================================================================

class WeightedBallotValidator implements BallotValidator {
  validate(ballot: Ballot, candidates: Candidate[]): ValidationResult {
    const errors: string[] = [];
    const validCandidateIds = candidates.map(c => c.id);
    
    // Must have at least one vote
    if (!ballot.votes || ballot.votes.length === 0) {
      errors.push('Ballot must contain at least one vote');
    }
    
    // Weight limit for weighted voting
    const maxWeight = 10; // Configurable in real implementation
    
    // Validate each vote
    for (let i = 0; i < ballot.votes.length; i++) {
      const vote = ballot.votes[i];
      
      const result = validateVoteEntry(vote, validCandidateIds, false);
      if (!result.valid) {
        errors.push(`Vote ${i + 1}: ${result.reason}`);
      }
      
      // Additional weight validation
      if (vote.weight > maxWeight) {
        errors.push(`Vote ${i + 1}: Weight exceeds maximum of ${maxWeight}`);
      }
    }
    
    // Total weight check
    const totalWeight = ballot.votes.reduce((sum, v) => sum + v.weight, 0);
    if (totalWeight > 100) {
      errors.push(`Total weight (${totalWeight}) exceeds maximum of 100`);
    }
    
    return {
      valid: errors.length === 0,
      reason: errors.length > 0 ? errors.join('; ') : undefined,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  validateVotes(votes: VoteEntry[], candidates: Candidate[]): ValidationResult {
    return this.validate({ votes } as Ballot, candidates);
  }
}

// ============================================================================
// Delegated Ballot Validator
// ============================================================================

class DelegatedBallotValidator implements BallotValidator {
  validate(ballot: Ballot, candidates: Candidate[]): ValidationResult {
    const errors: string[] = [];
    
    // Must have at least one vote
    if (!ballot.votes || ballot.votes.length === 0) {
      errors.push('Ballot must contain at least one vote');
    }
    
    // Validate each vote
    for (let i = 0; i < ballot.votes.length; i++) {
      const vote = ballot.votes[i];
      
      // For delegation, first vote is special
      if (i === 0) {
        // Can either vote for a candidate or delegate
        if (!vote.candidateId) {
          errors.push(`Vote ${i + 1}: Missing candidate or delegation target`);
        }
      } else {
        // Subsequent votes must be for candidates (not delegation)
        if (vote.candidateId.startsWith('delegate:')) {
          errors.push(`Vote ${i + 1}: Multiple delegations not allowed`);
        }
      }
      
      // Weight validation
      if (vote.weight !== 1) {
        errors.push(`Vote ${i + 1}: Delegated votes must have weight of 1`);
      }
    }
    
    return {
      valid: errors.length === 0,
      reason: errors.length > 0 ? errors.join('; ') : undefined,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  validateVotes(votes: VoteEntry[], candidates: Candidate[]): ValidationResult {
    return this.validate({ votes } as Ballot, candidates);
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

export function validateElectionConfig(config: ElectionConfig): ValidationResult {
  const errors: string[] = [];
  
  if (!config.name || config.name.trim().length === 0) {
    errors.push('Election name is required');
  }
  
  if (config.minCandidates < 2) {
    errors.push('Minimum 2 candidates required');
  }
  
  if (config.maxCandidates < config.minCandidates) {
    errors.push('Max candidates must be >= min candidates');
  }
  
  if (config.votingDuration <= 0) {
    errors.push('Voting duration must be positive');
  }
  
  if (config.requiredQuorum < 0 || config.requiredQuorum > 100) {
    errors.push('Quorum must be between 0 and 100');
  }
  
  return {
    valid: errors.length === 0,
    reason: errors.length > 0 ? errors.join('; ') : undefined,
    errors: errors.length > 0 ? errors : undefined,
  };
}

export function sanitizeBallot(ballot: Ballot): Ballot {
  // Remove any potentially malicious content
  return {
    ...ballot,
    id: ballot.id.replace(/[^a-zA-Z0-9-]/g, ''),
    electionId: ballot.electionId.replace(/[^a-zA-Z0-9-]/g, ''),
    voterId: ballot.voterId.replace(/[^a-zA-Z0-9-]/g, ''),
    votes: ballot.votes.map(v => ({
      ...v,
      candidateId: v.candidateId.replace(/[^a-zA-Z0-9-:]/g, ''),
      weight: Math.max(0, Math.min(100, v.weight || 1)),
      rank: v.rank !== undefined ? Math.max(1, Math.floor(v.rank)) : undefined,
    })),
  };
}
