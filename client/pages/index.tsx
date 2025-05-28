import type { NextPage } from 'next'
import { useRouter } from 'next/router'
import { useCallback, useState, useEffect } from 'react'
import { MdGroups, MdGroup, MdMeetingRoom, MdExitToApp } from 'react-icons/md'
import Particles from 'react-tsparticles'

import Navbar from 'components/Navbar'
import IconCardButton from 'components/IconCardButton'
import Footer from 'components/Footer'
import { useRoom } from 'context/RoomContext'

const Homepage: NextPage = () => {
  const router = useRouter()
  const roomContext = useRoom()
  
  const [roomInput, setRoomInput] = useState('')
  const [displayNameInput, setDisplayNameInput] = useState('')
  const [showJoinForm, setShowJoinForm] = useState(false)

  const handleJoinRoom = useCallback(async () => {
    if (!roomContext || !roomInput.trim()) {
      return
    }

    const success = await roomContext.joinRoomAsGuest(roomInput.trim(), displayNameInput.trim() || undefined)
    if (success) {
      router.push('/p2p')
    }
  }, [roomInput, displayNameInput, roomContext])

  const handleLeaveRoom = useCallback(async () => {
    if (!roomContext) return
    await roomContext.leaveCurrentRoom()
  }, [roomContext])

  useEffect(() => {
    if (!roomContext?.isAuthenticated) {
      return
    }
  }, [roomContext?.isAuthenticated])

  const handleP2PClick = useCallback(() => {
    if (!roomContext?.isAuthenticated) {
      alert('Please join a room first to access P2P features')
      return
    }
    router.push('/p2p')
  }, [roomContext?.isAuthenticated, router])

  if (!roomContext) {
    return <div>Loading...</div>
  }

  const { user, currentRoomId, isAuthenticated, isLoading } = roomContext

  return (
    <main className="min-h-screen justify-center bg-[#18181b] p-5">
      {/* @ts-ignore */}
      <Particles
        style={{ zIndex: -1, opacity: '0.5' }}
        id="tsparticles"
        url="https://raw.githubusercontent.com/VincentGarreau/particles.js/master/demo/particles.json"
      />

      <Navbar />
      <div className="absolute w-[95vw]">
        <div className="flex min-h-[80vh] flex-col items-center justify-center">
          
          {/* Current Room Status */}
          {isAuthenticated && currentRoomId && (
            <div className="mb-8 p-6 bg-green-900/30 border border-green-500/50 rounded-lg text-center">
              <h2 className="text-2xl font-bold text-green-400 mb-2">Active Session</h2>
              <p className="text-green-300 mb-2">Room ID: <span className="font-mono text-green-200">{currentRoomId}</span></p>
              <p className="text-green-300 mb-4">Welcome, <span className="font-semibold">{user?.displayName}</span>!</p>
              <div className="flex gap-4 justify-center">
                <button
                  onClick={() => router.push('/p2p')}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                  Go to P2P
                </button>
                <button
                  onClick={handleLeaveRoom}
                  disabled={isLoading}
                  className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  <MdExitToApp />
                  Leave Room
                </button>
              </div>
            </div>
          )}

          {/* Room Join Form */}
          {!isAuthenticated && (
            <div className="mb-8 w-full max-w-md">
              {!showJoinForm ? (
                <div className="text-center">
                  <h1 className="text-4xl font-bold text-white mb-4">P2P Share</h1>
                  <p className="text-gray-300 mb-6">Join a room to start sharing files securely</p>
                  <button
                    onClick={() => setShowJoinForm(true)}
                    className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2 mx-auto"
                  >
                    <MdMeetingRoom size={24} />
                    Join Room
                  </button>
                </div>
              ) : (
                <div className="bg-gray-800 p-6 rounded-lg">
                  <h2 className="text-2xl font-bold text-white mb-4 text-center">Join Room</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Room ID *
                      </label>
                      <input
                        type="text"
                        value={roomInput}
                        onChange={(e) => setRoomInput(e.target.value)}
                        placeholder="Enter room ID"
                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        disabled={isLoading}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Display Name (optional)
                      </label>
                      <input
                        type="text"
                        value={displayNameInput}
                        onChange={(e) => setDisplayNameInput(e.target.value)}
                        placeholder="Your name"
                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        disabled={isLoading}
                      />
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={handleJoinRoom}
                        disabled={isLoading || !roomInput.trim()}
                        className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                      >
                        {isLoading ? 'Joining...' : 'Join Room'}
                      </button>
                      <button
                        onClick={() => setShowJoinForm(false)}
                        disabled={isLoading}
                        className="px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Main Action Cards */}
          <div className="flex flex-col items-center justify-center sm:flex-row gap-6">
            <IconCardButton
              onClick={handleP2PClick}
              text="Connect Peer 2 Peer"
              subtext={isAuthenticated ? "Fast & Secure" : "Join room first"}
              icon={<MdGroup style={{ display: 'unset' }} fontSize={100} />}
            />
            {/* Future group feature */}
            {/* <IconCardButton
              onClick={() => redirectToPage('/room')}
              text="Connect Group"
              subtext="Slower"
              icon={<MdGroups style={{ display: 'unset' }} fontSize={100} />}
            /> */}
          </div>

          {!isAuthenticated && (
            <p className="text-gray-400 text-sm mt-4 text-center">
              You need to join a room to access P2P features
            </p>
          )}
        </div>

        <Footer />
      </div>
    </main>
  )
}

export default Homepage
