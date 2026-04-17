import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { Message, MemoryPointer, ExecutionPlan, PlanStep, ToolCallMode } from '../types'

interface AppState {
  // Messages
  messages: Message[]
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void
  updateMessage: (id: string, updates: Partial<Message>) => void
  clearMessages: () => void

  // Execution mode
  mode: ToolCallMode
  setMode: (mode: ToolCallMode) => void

  // Planning
  currentPlan: ExecutionPlan | null
  setPlan: (plan: ExecutionPlan | null) => void
  updatePlanStep: (stepId: string, updates: Partial<PlanStep>) => void

  // Memory pointers
  memory: MemoryPointer[]
  addMemory: (pointer: Omit<MemoryPointer, 'id'>) => void
  getMemory: () => MemoryPointer[]

  // UI State
  isLoading: boolean
  setLoading: (loading: boolean) => void
  currentInput: string
  setCurrentInput: (input: string) => void

  // Context management
  totalTokens: number
  setTotalTokens: (tokens: number) => void
  contextFull: boolean
  setContextFull: (full: boolean) => void

  // Verification warnings
  verificationWarnings: VerificationWarning[]
  addWarning: (warning: Omit<VerificationWarning, 'id' | 'timestamp'>) => void
  clearWarnings: () => void
}

interface VerificationWarning {
  id: string
  toolName: string
  message: string
  severity: 'warning' | 'error'
  timestamp: number
}

export const useAppStore = create<AppState>((set, get) => ({
  // Messages
  messages: [],
  addMessage: (message) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          ...message,
          id: uuidv4(),
          timestamp: Date.now()
        }
      ]
    })),
  updateMessage: (id, updates) =>
    set((state) => ({
      messages: state.messages.map((m) => (m.id === id ? { ...m, ...updates } : m))
    })),
  clearMessages: () => set({ messages: [] }),

  // Execution mode
  mode: 'execution',
  setMode: (mode) => set({ mode }),

  // Planning
  currentPlan: null,
  setPlan: (plan) => set({ currentPlan: plan }),
  updatePlanStep: (stepId, updates) =>
    set((state) => {
      if (!state.currentPlan) return state
      return {
        currentPlan: {
          ...state.currentPlan,
          steps: state.currentPlan.steps.map((s) =>
            s.id === stepId ? { ...s, ...updates } : s
          )
        }
      }
    }),

  // Memory
  memory: [],
  addMemory: (pointer) =>
    set((state) => ({
      memory: [
        ...state.memory,
        {
          ...pointer,
          id: uuidv4()
        }
      ]
    })),
  getMemory: () => get().memory,

  // UI State
  isLoading: false,
  setLoading: (loading) => set({ isLoading: loading }),
  currentInput: '',
  setCurrentInput: (input) => set({ currentInput: input }),

  // Context
  totalTokens: 0,
  setTotalTokens: (tokens) => set({ totalTokens: tokens }),
  contextFull: false,
  setContextFull: (full) => set({ contextFull: full }),

  // Verification
  verificationWarnings: [],
  addWarning: (warning) =>
    set((state) => ({
      verificationWarnings: [
        ...state.verificationWarnings,
        { ...warning, id: uuidv4(), timestamp: Date.now() }
      ]
    })),
  clearWarnings: () => set({ verificationWarnings: [] })
}))
