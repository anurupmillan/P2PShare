import { createSlice, PayloadAction } from '@reduxjs/toolkit';

// Define a guest user object for room-based sessions
export interface GuestUser {
  guestId: string;
  displayName: string;
  roomId: string | null;
  joinedAt: string;
  avatar?: string;
}

// Define the auth state interface for guest sessions
interface AuthState {
  user: GuestUser | null;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  currentRoomId: string | null;
  messageCount: number;
}

// Initial state
const initialState: AuthState = {
  user: null,
  isLoading: false,
  error: null,
  isAuthenticated: false,
  currentRoomId: null,
  messageCount: 0
};

// Helper function to generate guest ID
const generateGuestId = (): string => {
  return `guest_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
};

// Helper function to generate random display name
const generateGuestName = (): string => {
  const adjectives = ['Cool', 'Smart', 'Fast', 'Bright', 'Happy', 'Quick', 'Bold', 'Calm'];
  const nouns = ['User', 'Guest', 'Visitor', 'Friend', 'Player', 'Member'];
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const number = Math.floor(Math.random() * 1000);
  return `${adjective}${noun}${number}`;
};

// Create the auth slice
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    // Set loading state during operations
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    
    // Join room as guest user
    joinRoom: (state, action: PayloadAction<{ roomId: string; displayName?: string }>) => {
      const { roomId, displayName } = action.payload;
      const guestUser: GuestUser = {
        guestId: generateGuestId(),
        displayName: displayName || generateGuestName(),
        roomId,
        joinedAt: new Date().toISOString()
      };
      
      state.user = guestUser;
      state.currentRoomId = roomId;
      state.isAuthenticated = true;
      state.isLoading = false;
      state.error = null;
    },
    
    // Leave current room
    leaveRoom: (state) => {
      if (state.user) {
        state.user.roomId = null;
      }
      state.currentRoomId = null;
      state.isAuthenticated = false;
    },
    
    // Update user display name
    updateDisplayName: (state, action: PayloadAction<string>) => {
      if (state.user) {
        state.user.displayName = action.payload;
      }
    },
    
    // Set error state
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.isLoading = false;
    },
    
    // Clear all auth state
    clearAuth: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.isLoading = false;
      state.error = null;
      state.currentRoomId = null;
    },

    // Increment message count
    incrementMessageCount: (state) => {
      state.messageCount += 1;
    },

    // Reset message count
    resetMessageCount: (state) => {
      state.messageCount = 0;
    }
  }
});

// Export actions and reducer
export const { 
  setLoading, 
  joinRoom,
  leaveRoom,
  updateDisplayName,
  setError, 
  clearAuth,
  incrementMessageCount,
  resetMessageCount
} = authSlice.actions;

export default authSlice.reducer; 