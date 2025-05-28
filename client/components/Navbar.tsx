import React from 'react'
import { SiAirplayaudio } from 'react-icons/si'
import {
  useRoom,
  RoomContext,
} from 'context/RoomContext'

interface NavbarProps {
  remoteUser?: string
  remoteSocketId?: string
}

const Navbar: React.FC<NavbarProps> = (props) => {
  const { remoteUser, remoteSocketId } = props
  const { user: currentUser, leaveCurrentRoom } = useRoom() as RoomContext

  const handleLogout = async () => {
    try {
      await leaveCurrentRoom()
    } catch (error) {
      console.error('Error leaving room:', error)
    }
  }

  return (
    <nav className="bg-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center">
              <SiAirplayaudio className="h-8 w-8 text-blue-600" />
              <span className="ml-2 text-xl font-bold text-gray-900">P2PShare</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {currentUser && (
              <>
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    {currentUser.avatar ? (
                      <img
                        className="h-8 w-8 rounded-full"
                        src={currentUser.avatar}
                        alt={currentUser.displayName}
                      />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center">
                        <span className="text-white text-sm font-medium">
                          {currentUser.displayName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <span className="text-sm font-medium text-gray-700">
                      {currentUser.displayName}
                    </span>
                  </div>
                  
                  {remoteUser && (
                    <div className="flex items-center space-x-2 text-sm text-gray-500">
                      <span>Connected to:</span>
                      <span className="font-medium">{remoteUser}</span>
                    </div>
                  )}
                </div>
                
                <button
                  onClick={handleLogout}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Leave Room
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}

export default Navbar
