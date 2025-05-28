import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
} from 'react'
import { useRouter } from 'next/router'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { 
  setLoading, 
  joinRoom,
  leaveRoom,
  updateDisplayName,
  setError, 
  clearAuth,
  incrementMessageCount,
  resetMessageCount,
  type GuestUser 
} from '../store/authSlice'

export interface RoomContext {
  user: GuestUser | null
  isLoading: boolean
  error: string | null
  isAuthenticated: boolean
  currentRoomId: string | null
  messageCount: number
  joinRoomAsGuest: (roomId: string, displayName?: string) => Promise<boolean>
  leaveCurrentRoom: () => Promise<void>
  updateGuestName: (name: string) => void
  incrementMessageCount: () => void
  resetMessageCount: () => void
  setError: (error: string | null) => void
  setLoading: (loading: boolean) => void
}

const RoomContext = createContext<RoomContext | null>(null)

export const useRoom = () => {
  const state = useContext(RoomContext)
  if (state !== null && !state)
    throw new Error('Wrap useRoom hook inside RoomProvider')
  return state
}

// Backward compatibility export
export const useFirebase = useRoom

export const RoomProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = useRouter()
  const dispatch = useAppDispatch()
  
  // Get auth state from Redux store
  const { user, isLoading, error, isAuthenticated, currentRoomId, messageCount } = useAppSelector(
    (state) => state.auth
  )

  // Redux action dispatchers
  const setLoadingState = useCallback((loading: boolean) => {
    dispatch(setLoading(loading))
  }, [dispatch])

  const setErrorState = useCallback((error: string | null) => {
    dispatch(setError(error))
  }, [dispatch])

  const incrementCount = useCallback(() => {
    dispatch(incrementMessageCount())
  }, [dispatch])

  const resetCount = useCallback(() => {
    dispatch(resetMessageCount())
  }, [dispatch])

  const updateGuestName = useCallback((name: string) => {
    dispatch(updateDisplayName(name))
  }, [dispatch])

  const joinRoomAsGuest = useCallback(
    async (roomId: string, displayName?: string): Promise<boolean> => {
      try {
        dispatch(setLoading(true))
        dispatch(setError(null))
        
        // Validate room ID
        if (!roomId || !roomId.trim()) {
          dispatch(setError('Room ID is required'))
          return false
        }

        console.log(`Joining room: ${roomId}`)
        
        // Join room in Redux state (this creates the guest user)
        dispatch(joinRoom({ roomId, displayName }))
        
        console.log(`Successfully joined room: ${roomId}`)
        return true
        
      } catch (error) {
        console.error('Error joining room:', error)
        const errorMessage = error instanceof Error ? error.message : 'Failed to join room'
        dispatch(setError(errorMessage))
        return false
      } finally {
        dispatch(setLoading(false))
      }
    },
    [dispatch]
  )

  const leaveCurrentRoom = useCallback(async () => {
    try {
      dispatch(setLoading(true))
      dispatch(setError(null))
      
      if (user && currentRoomId) {
        console.log(`Leaving room: ${currentRoomId}`)
        
        // Update Redux state
        dispatch(leaveRoom())
        
        console.log('Successfully left room')
      }
      
    } catch (error) {
      console.error('Error leaving room:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to leave room'
      dispatch(setError(errorMessage))
    } finally {
      dispatch(setLoading(false))
    }
  }, [dispatch, user, currentRoomId])

  const contextValue: RoomContext = {
    user,
    isLoading,
    error,
    isAuthenticated,
    currentRoomId,
    messageCount,
    joinRoomAsGuest,
    leaveCurrentRoom,
    updateGuestName,
    incrementMessageCount: incrementCount,
    resetMessageCount: resetCount,
    setError: setErrorState,
    setLoading: setLoadingState
  }

  return (
    <RoomContext.Provider value={contextValue}>
      {children}
    </RoomContext.Provider>
  )
}

// Backward compatibility exports
export const FirebaseProvider = RoomProvider
export type FirebaseContext = RoomContext

// Export for compatibility
export type { GuestUser } from '../store/authSlice'
