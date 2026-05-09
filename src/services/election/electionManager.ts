/**
 * Election Manager - P18 Election System
 * 
 * Core election management service handling the full election lifecycle:
 * - Election initialization and configuration
 * - Candidate nomination
 * - Campaign phase
 * - Voting and ballot collection
 * - Vote counting and result determination
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  Election,
  ElectionConfig,
  ElectionStatus,
  ElectionResult,
  Candidate,
  Voter,
  Ballot,
  VoteEntry,
  ElectionEvent,
  ElectionEventType,
  TieBreakResult,
  TieBreakMethod,
  VoteType,
} from './electionTypes';
import { DEFAULT_ELECTION_CONFIG } from './electionTypes';
import { countVotes, determineWinner, checkForTie, resolveTie } from './voteCounter';
import { createBallotValidator, validateVoteEntry } from './ballotValidator';

// ============================================================================
// Event Handlers
// ============================================================================

type ElectionEventHandler = (event: ElectionEvent) => void;

export class ElectionManager {
  private election: Election;
  private voters: Map<string, Voter>;
  private ballots: Map<string, Ballot>;
  private eventHandlers: Set<ElectionEventHandler>;
  private timers: {
    nomination?: ReturnType<typeof setTimeout>;
    campaign?: ReturnType<typeof setTimeout>;
    voting?: ReturnType<typeof setTimeout>;
  };

  constructor(config?: Partial<ElectionConfig>, electionId?: string) {
    const finalConfig = { ...DEFAULT_ELECTION_CONFIG, ...config };
    
    this.election = {
      id: electionId || uuidv4(),
      name: finalConfig.name,
      description: finalConfig.description,
      scope: finalConfig.scope,
      voteType: finalConfig.voteType,
      status: 'initialized',
      config: finalConfig,
      candidates: [],
      createdAt: Date.now(),
      startedAt: undefined,
      endedAt: undefined,
    };
    
    this.voters = new Map();
    this.ballots = new Map();
    this.eventHandlers = new Set();
    this.timers = {};
  }

  // ============================================================================
  // Event Management
  // ============================================================================

  onEvent(handler: ElectionEventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  private emit(type: ElectionEventType, data?: unknown): void {
    const event: ElectionEvent = {
      type,
      electionId: this.election.id,
      data,
      timestamp: Date.now(),
    };
    this.eventHandlers.forEach(handler => handler(event));
  }

  // ============================================================================
  // Election Lifecycle
  // ============================================================================

  startNomination(): boolean {
    if (this.election.status !== 'initialized') {
      return false;
    }
    this.election.status = 'nominating';
    this.election.startedAt = Date.now();
    this.emit('nomination_started');
    
    // Auto-advance after nomination duration
    if (this.election.config.nominationDuration > 0) {
      this.timers.nomination = setTimeout(() => {
        this.startCampaign();
      }, this.election.config.nominationDuration);
    }
    
    return true;
  }

  startCampaign(): boolean {
    if (this.election.status !== 'nominating') {
      // Allow manual transition from voting if needed
      if (this.election.status !== 'voting') {
        return false;
      }
    }
    
    // Ensure we have minimum candidates
    if (this.election.candidates.length < this.election.config.minCandidates) {
      this.emit('election_cancelled');
      this.election.status = 'cancelled';
      return false;
    }
    
    this.election.status = 'campaigning';
    this.emit('campaign_started');
    
    if (this.election.config.campaignDuration > 0) {
      this.timers.campaign = setTimeout(() => {
        this.startVoting();
      }, this.election.config.campaignDuration);
    }
    
    return true;
  }

  startVoting(): boolean {
    if (this.election.status !== 'campaigning' && this.election.status !== 'nominating') {
      return false;
    }
    
    this.election.status = 'voting';
    this.emit('voting_started');
    
    if (this.election.config.votingDuration > 0) {
      this.timers.voting = setTimeout(() => {
        this.endVoting();
      }, this.election.config.votingDuration);
    }
    
    return true;
  }

  endVoting(): boolean {
    if (this.election.status !== 'voting') {
      return false;
    }
    
    this.election.status = 'counting';
    this.emit('counting_started');
    
    // Process results synchronously
    const result = this.countBallots();
    this.election.result = result;
    this.election.status = 'completed';
    this.election.endedAt = Date.now();
    
    this.emit('counting_completed');
    this.emit('election_completed', result);
    
    return true;
  }

  cancelElection(): boolean {
    if (this.election.status === 'completed' || this.election.status === 'cancelled') {
      return false;
    }
    
    this.clearTimers();
    this.election.status = 'cancelled';
    this.election.endedAt = Date.now();
    this.emit('election_cancelled');
    
    return true;
  }

  // ============================================================================
  // Candidate Management
  // ============================================================================

  addCandidate(personaId: string, role: string, nominationScore = 1): Candidate {
    const candidate: Candidate = {
      id: uuidv4(),
      personaId,
      role,
      nominationScore,
      status: 'nominated',
      voteCount: 0,
      rankedVotes: new Map(),
    };
    
    if (this.election.candidates.length >= this.election.config.maxCandidates) {
      throw new Error('Maximum candidates reached');
    }
    
    this.election.candidates.push(candidate);
    this.emit('candidate_nominated', { candidateId: candidate.id, personaId, role });
    
    return candidate;
  }

  removeCandidate(candidateId: string): boolean {
    const index = this.election.candidates.findIndex(c => c.id === candidateId);
    if (index === -1) return false;
    
    const candidate = this.election.candidates[index];
    candidate.status = 'withdrawn';
    
    this.emit('candidate_withdrawn', { candidateId, personaId: candidate.personaId });
    return true;
  }

  getCandidates(): Candidate[] {
    return this.election.candidates.filter(c => c.status !== 'withdrawn');
  }

  setCampaignStatement(candidateId: string, statement: string): boolean {
    const candidate = this.election.candidates.find(c => c.id === candidateId);
    if (!candidate) return false;
    
    candidate.campaignStatement = statement;
    return true;
  }

  // ============================================================================
  // Voter Management
  // ============================================================================

  registerVoter(personaId: string, role: string, weight = 1.0): Voter {
    const voter: Voter = {
      id: uuidv4(),
      personaId,
      role,
      weight,
      hasVoted: false,
      votedFor: [],
    };
    
    this.voters.set(voter.id, voter);
    return voter;
  }

  getVoter(voterId: string): Voter | undefined {
    return this.voters.get(voterId);
  }

  getVoters(): Voter[] {
    return Array.from(this.voters.values());
  }

  updateVoterWeight(voterId: string, weight: number): boolean {
    const voter = this.voters.get(voterId);
    if (!voter) return false;
    
    voter.weight = weight;
    return true;
  }

  // ============================================================================
  // Voting
  // ============================================================================

  castVote(voterId: string, votes: VoteEntry[]): Ballot | null {
    const voter = this.voters.get(voterId);
    if (!voter) {
      console.error(`Voter not found: ${voterId}`);
      return null;
    }
    
    if (this.election.status !== 'voting') {
      console.error('Voting is not open');
      return null;
    }
    
    if (voter.hasVoted) {
      console.error('Voter has already voted');
      return null;
    }
    
    // Validate votes
    const validator = createBallotValidator(this.election.config.voteType);
    const candidateIds = this.election.candidates
      .filter(c => c.status !== 'withdrawn')
      .map(c => c.id);
    
    for (const vote of votes) {
      const validation = validateVoteEntry(vote, candidateIds, this.election.config.allowWriteIns);
      if (!validation.valid) {
        console.error(`Invalid vote: ${validation.reason}`);
        return null;
      }
    }
    
    // Create ballot
    const ballot: Ballot = {
      id: uuidv4(),
      electionId: this.election.id,
      voterId,
      votes,
      timestamp: Date.now(),
      isValid: true,
    };
    
    // Update voter
    voter.hasVoted = true;
    voter.votedFor = votes.map(v => v.candidateId);
    voter.voteTimestamp = Date.now();
    
    // Store ballot
    this.ballots.set(ballot.id, ballot);
    this.emit('vote_cast', { voterId, ballotId: ballot.id, votes });
    
    return ballot;
  }

  changeVote(voterId: string, newVotes: VoteEntry[]): Ballot | null {
    const voter = this.voters.get(voterId);
    if (!voter || !voter.hasVoted) {
      return null;
    }
    
    if (this.election.status !== 'voting') {
      return null;
    }
    
    // Find existing ballot
    let existingBallot: Ballot | undefined;
    for (const ballot of this.ballots.values()) {
      if (ballot.voterId === voterId) {
        existingBallot = ballot;
        break;
      }
    }
    
    if (!existingBallot) {
      return null;
    }
    
    // Create new ballot with same ID (replacing old one)
    const newBallot: Ballot = {
      ...existingBallot,
      votes: newVotes,
      timestamp: Date.now(),
    };
    
    // Update voter
    voter.votedFor = newVotes.map(v => v.candidateId);
    voter.voteTimestamp = Date.now();
    
    // Replace ballot
    this.ballots.set(newBallot.id, newBallot);
    this.emit('vote_changed', { voterId, ballotId: newBallot.id, votes: newVotes });
    
    return newBallot;
  }

  getBallot(voterId: string): Ballot | undefined {
    for (const ballot of this.ballots.values()) {
      if (ballot.voterId === voterId) {
        return ballot;
      }
    }
    return undefined;
  }

  // ============================================================================
  // Vote Counting & Results
  // ============================================================================

  countBallots(): ElectionResult {
    const startTime = Date.now();
    
    const validBallots = Array.from(this.ballots.values())
      .filter(b => b.isValid);
    
    const candidateResults = countVotes(
      validBallots,
      this.election.candidates,
      this.election.config.voteType
    );
    
    // Determine winner(s)
    const tieCheck = checkForTie(candidateResults);
    let finalResults = candidateResults;
    let winnerId: string | null = null;
    let winnerName: string | null = null;
    let runoff: ElectionResult['runoff'] | undefined;
    
    if (tieCheck.isTied) {
      const tieResult = resolveTie(
        tieCheck.tiedCandidates,
        tieCheck.tiedCandidateIds,
        this.election.config.tieBreakMethod || 'runoff'
      );
      winnerId = tieResult.winner;
      
      if (this.election.config.tieBreakMethod === 'runoff') {
        runoff = {
          candidateIds: tieCheck.tiedCandidateIds,
          reason: `Tie between ${tieCheck.tiedCandidates.length} candidates resolved by ${tieResult.method}`,
        };
      }
    } else {
      const winner = determineWinner(finalResults);
      winnerId = winner?.candidateId || null;
      winnerName = winner?.candidateName || null;
      
      if (winner) {
        finalResults = finalResults.map(r => ({
          ...r,
          isWinner: r.candidateId === winner.candidateId,
        }));
      }
    }
    
    // Get winner name
    if (!winnerName && winnerId) {
      const winnerCandidate = this.election.candidates.find(c => c.id === winnerId);
      winnerName = winnerCandidate?.personaId || null;
    }
    
    // Update candidate statuses
    for (const result of finalResults) {
      const candidate = this.election.candidates.find(c => c.id === result.candidateId);
      if (candidate) {
        candidate.voteCount = result.voteCount;
        candidate.status = result.isWinner ? 'elected' : 'defeated';
      }
    }
    
    const totalVotes = validBallots.reduce((sum, b) => 
      sum + b.votes.reduce((vSum, v) => vSum + v.weight, 0), 0);
    
    const turnout = this.voters.size > 0 
      ? (validBallots.length / this.voters.size) * 100 
      : 0;
    
    return {
      electionId: this.election.id,
      winner: winnerId,
      winnerName,
      totalVotes,
      turnout,
      results: finalResults,
      runoff,
      timestamp: Date.now(),
      duration: Date.now() - startTime,
    };
  }

  getElection(): Readonly<Election> {
    return this.election;
  }

  getStatus(): ElectionStatus {
    return this.election.status;
  }

  getResult(): ElectionResult | undefined {
    return this.election.result;
  }

  getTurnout(): number {
    const totalVoters = this.voters.size;
    const votedCount = Array.from(this.voters.values()).filter(v => v.hasVoted).length;
    return totalVoters > 0 ? (votedCount / totalVoters) * 100 : 0;
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private clearTimers(): void {
    if (this.timers.nomination) clearTimeout(this.timers.nomination);
    if (this.timers.campaign) clearTimeout(this.timers.campaign);
    if (this.timers.voting) clearTimeout(this.timers.voting);
    this.timers = {};
  }

  destroy(): void {
    this.clearTimers();
    this.eventHandlers.clear();
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createElection(config?: Partial<ElectionConfig>): ElectionManager {
  return new ElectionManager(config);
}

export function createElectionWithCandidates(
  candidates: Array<{ personaId: string; role: string }>,
  config?: Partial<ElectionConfig>
): ElectionManager {
  const manager = new ElectionManager(config);
  for (const c of candidates) {
    manager.addCandidate(c.personaId, c.role);
  }
  return manager;
}
