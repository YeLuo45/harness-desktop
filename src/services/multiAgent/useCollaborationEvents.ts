/**
 * useCollaborationEvents - Bridge CollaborationManager events to React state
 * 
 * Subscribes to CollaborationManager events and syncs them to appStore.
 */

import { useEffect } from 'react'
import { collaborationManager } from './collaborationManager'
import { useAppStore } from '../../store/appStore'
import type { CollaborationEvent } from './types'

export function useCollaborationEvents() {
  const { setCollaborationActive, addCollaborationResult, updateAgentInCollaboration } = useAppStore()

  useEffect(() => {
    // Sync CollaborationManager events → appStore updates
    const unsubscribe = collaborationManager.onEvent((event: CollaborationEvent) => {
      switch (event.type) {
        case 'session_started':
          setCollaborationActive(true)
          break

        case 'session_completed':
          // Session completed, collaboration may end
          break

        case 'session_failed':
          // Log failure but keep UI showing
          console.warn('[Collaboration] Session failed:', event.data)
          break

        case 'agent_registered': {
          // Agent registered to session - update if tracked
          break
        }

        case 'agent_completed': {
          if (event.agentId) {
            updateAgentInCollaboration(event.agentId, { status: 'completed' })
          }
          break
        }

        case 'task_completed': {
          if (event.agentId) {
            // Agent completed a task - may want to track progress
          }
          break
        }

        default:
          break
      }
    })

    return () => {
      unsubscribe()
    }
  }, [setCollaborationActive, addCollaborationResult, updateAgentInCollaboration])
}