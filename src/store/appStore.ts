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
  toggleMode: () => void  // Toggle between planning and execution

  // Planning
  currentPlan: ExecutionPlan | null
  setPlan: (plan: ExecutionPlan | null) => void
  updatePlanStep: (stepId: string, updates: Partial<PlanStep>) => void
  getPlanStep: (stepId: string) => PlanStep | undefined
  getCurrentExecutingStep: () => PlanStep | undefined
  getNextPendingStep: () => PlanStep | undefined
  getSortedSteps: () => PlanStep[]
  getCompletedStepsCount: () => number
  getFailedStepsCount: () => number
  getPendingStepsCount: () => number
  isPlanFullyExecuted: () => boolean
  confirmPlan: () => void  // Mark plan as confirmed and switch to execution mode
  cancelPlan: () => void  // Clear plan and reset to execution mode
  skipStep: (stepId: string) => void  // Mark a step as skipped
  resetPlan: () => void  // Reset all steps to pending status
  abortPlan: () => void  // Abort execution - skip all pending/executing steps

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
  toggleMode: () => set((state) => ({
    mode: state.mode === 'planning' ? 'execution' : 'planning'
  })),

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
  getPlanStep: (stepId) => {
    const state = get()
    return state.currentPlan?.steps.find((s) => s.id === stepId)
  },
  getCurrentExecutingStep: () => {
    const state = get()
    return state.currentPlan?.steps.find((s) => s.status === 'executing')
  },
  getNextPendingStep: () => {
    const state = get()
    if (!state.currentPlan) return undefined
    // Get sorted steps by order, find first pending
    return [...state.currentPlan.steps]
      .sort((a, b) => a.order - b.order)
      .find((s) => s.status === 'pending')
  },
  getSortedSteps: () => {
    const state = get()
    if (!state.currentPlan) return []
    return [...state.currentPlan.steps].sort((a, b) => a.order - b.order)
  },
  getCompletedStepsCount: () => {
    const state = get()
    return state.currentPlan?.steps.filter((s) => s.status === 'completed').length ?? 0
  },
  getFailedStepsCount: () => {
    const state = get()
    return state.currentPlan?.steps.filter((s) => s.status === 'failed').length ?? 0
  },
  getPendingStepsCount: () => {
    const state = get()
    return state.currentPlan?.steps.filter((s) => s.status === 'pending').length ?? 0
  },
  isPlanFullyExecuted: () => {
    const state = get()
    if (!state.currentPlan) return false
    return state.currentPlan.steps.every(
      (s) => s.status === 'completed' || s.status === 'failed' || s.status === 'skipped'
    )
  },
  confirmPlan: () => set((state) => {
    if (!state.currentPlan) return state
    return {
      mode: 'execution' as ToolCallMode,
      currentPlan: {
        ...state.currentPlan,
        confirmed: true
      }
    }
  }),
  cancelPlan: () => set({
    mode: 'execution' as ToolCallMode,
    currentPlan: null
  }),
  skipStep: (stepId) =>
    set((state) => {
      if (!state.currentPlan) return state
      return {
        currentPlan: {
          ...state.currentPlan,
          steps: state.currentPlan.steps.map((s) =>
            s.id === stepId ? { ...s, status: 'skipped' as const } : s
          )
        }
      }
    }),
  resetPlan: () =>
    set((state) => {
      if (!state.currentPlan) return state
      return {
        currentPlan: {
          ...state.currentPlan,
          confirmed: false,
          steps: state.currentPlan.steps.map((s) => ({
            ...s,
            status: 'pending' as const,
            result: undefined,
            error: undefined
          }))
        }
      }
    }),
  abortPlan: () =>
    set((state) => {
      if (!state.currentPlan) return state
      return {
        currentPlan: {
          ...state.currentPlan,
          steps: state.currentPlan.steps.map((s) => {
            if (s.status === 'executing' || s.status === 'pending') {
              return { ...s, status: 'skipped' as const }
            }
            return s
          })
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
