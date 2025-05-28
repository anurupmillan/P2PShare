import React, { useState } from 'react'
import ReactPlayer from 'react-player'
import { AiFillHeart, AiOutlineClose, AiFillMessage, AiFillFileText, AiOutlineUser, AiFillPhone } from 'react-icons/ai'
import { BsShareFill, BsCameraVideoFill, BsCameraVideoOffFill, BsCameraFill } from 'react-icons/bs'
import { IoMdMic, IoMdMicOff, IoMdSettings } from 'react-icons/io'
import { MdScreenShare, MdStopScreenShare, MdFlip, MdRotateRight, MdVideocam } from 'react-icons/md'
import { FiMove } from 'react-icons/fi'
import FileTransfer, { AvailableFiles } from './FileTransfer'
import WhiteboardOverlay from './WhiteboardOverlay'
import Chat from './Chat'
import { MediaStreamContext, ProviderProps } from 'context/MediaStream'
import {
  MediaScreenStreamContext,
  ProviderScreenProps,
} from 'context/ScreenStream'

interface DashboardProps {
  onFileTransfer?: (file: File) => Promise<void>
  startAudioVideoStreams?: () => void
  startScreenShareStreams?: () => void
  stopScreenShareStreams?: () => void
  availableFiles?: AvailableFiles[]
  remoteSocketId?: string
  whiteboardID?: string | null
}

const Dashboard: React.FC<DashboardProps> = (props) => {
  const {
    onFileTransfer,
    startAudioVideoStreams,
    startScreenShareStreams,
    stopScreenShareStreams,
    availableFiles,
    remoteSocketId,
    whiteboardID,
  } = props

  const { userStream, remoteStreams, setUserMediaStream } = React.useContext(
    MediaStreamContext
  ) as ProviderProps

  const { userScreenStream } = React.useContext(
    MediaScreenStreamContext
  ) as ProviderScreenProps

  const [fileTransferOpen, setFileTransferOpen] = useState<boolean>(false)
  const [chatOpen, setChatOpen] = useState<boolean>(false)
  const [whiteboardVisible, setWhiteboardVisible] = useState<boolean>(true)
  const [micEnabled, setMicEnabled] = useState<boolean>(true)
  const [videoEnabled, setVideoEnabled] = useState<boolean>(true)
  const [isStreamLoading, setIsStreamLoading] = useState<boolean>(false)
  
  // PiP video controls
  const [pipPosition, setPipPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [isMirrored, setIsMirrored] = useState(true)
  const [rotation, setRotation] = useState(0)
  const [showCameraOptions, setShowCameraOptions] = useState(false)
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([])
  const [currentCameraId, setCurrentCameraId] = useState<string>('')
  const [pipVisible, setPipVisible] = useState(true)
  
  // Debug userStream changes
  React.useEffect(() => {
    console.log('🔍 UserStream changed:', {
      hasStream: !!userStream,
      streamId: userStream?.id,
      tracks: userStream?.getTracks().length || 0,
      videoTracks: userStream?.getVideoTracks().length || 0,
      audioTracks: userStream?.getAudioTracks().length || 0,
      videoEnabled,
      pipVisible
    })
    
    if (userStream) {
      userStream.getTracks().forEach((track, index) => {
        console.log(`🎵/🎥 Track ${index}:`, track.kind, 'enabled:', track.enabled, 'state:', track.readyState)
      })
    }
  }, [userStream, videoEnabled, pipVisible])

  // Debug remote streams changes
  React.useEffect(() => {
    console.log('🌐 RemoteStreams changed:', {
      count: remoteStreams?.length || 0,
      streams: remoteStreams?.map(s => ({
        id: s.id,
        active: s.active,
        tracks: s.getTracks().length,
        videoTracks: s.getVideoTracks().length,
        audioTracks: s.getAudioTracks().length
      })) || []
    })
    
    if (remoteStreams && remoteStreams.length > 0) {
      remoteStreams.forEach((stream, index) => {
        console.log(`🌐 Remote Stream ${index}:`, stream.id, 'active:', stream.active)
        stream.getTracks().forEach((track, trackIndex) => {
          console.log(`  🎵/🎥 Track ${trackIndex}:`, track.kind, 'enabled:', track.enabled, 'state:', track.readyState)
        })
      })
    } else {
      console.log('❌ No remote streams available')
    }
  }, [remoteStreams])

  // Expose debugging info globally
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).dashboardDebug = {
        userStream,
        remoteStreams,
        remoteSocketId,
        videoEnabled,
        micEnabled,
        isStreamLoading,
        debugPeerConnection,
        testCamera
      }
    }
  }, [userStream, remoteStreams, remoteSocketId, videoEnabled, micEnabled, isStreamLoading])
  
  // Initialize PiP position
  React.useEffect(() => {
    if (pipPosition.x === 0 && pipPosition.y === 0) {
      setPipPosition({
        x: window.innerWidth - 160, // 128px width + 32px margin
        y: 80 // Below the top user info
      })
    }
  }, [pipPosition.x, pipPosition.y])

  // Get available cameras
  React.useEffect(() => {
    const getCameras = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const cameras = devices.filter(device => device.kind === 'videoinput')
        setAvailableCameras(cameras)
        if (cameras.length > 0 && !currentCameraId) {
          setCurrentCameraId(cameras[0].deviceId)
        }
      } catch (error) {
        console.error('Error getting cameras:', error)
      }
    }
    getCameras()
  }, [currentCameraId])

  // Drag handlers for PiP
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    const startX = e.clientX - pipPosition.x
    const startY = e.clientY - pipPosition.y

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return
      const newX = e.clientX - startX
      const newY = e.clientY - startY
      
      // Constrain to viewport
      const maxX = window.innerWidth - 128 // PiP width
      const maxY = window.innerHeight - 176 // PiP height
      
      setPipPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY))
      })
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  // Touch handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true)
    const touch = e.touches[0]
    const startX = touch.clientX - pipPosition.x
    const startY = touch.clientY - pipPosition.y

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging) return
      e.preventDefault()
      const touch = e.touches[0]
      const newX = touch.clientX - startX
      const newY = touch.clientY - startY
      
      // Constrain to viewport
      const maxX = window.innerWidth - 128 // PiP width
      const maxY = window.innerHeight - 176 // PiP height
      
      setPipPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY))
      })
    }

    const handleTouchEnd = () => {
      setIsDragging(false)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
    }

    document.addEventListener('touchmove', handleTouchMove, { passive: false })
    document.addEventListener('touchend', handleTouchEnd)
  }

  // Rotate camera (mobile)
  const rotateCamera = () => {
    setRotation(prev => (prev + 90) % 360)
  }

  // Toggle microphone
  const toggleMicrophone = async () => {
    if (!userStream) {
      // If no stream exists, start it
      setIsStreamLoading(true)
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: videoEnabled
        })
        if (setUserMediaStream) setUserMediaStream(stream)
        setMicEnabled(true)
      } catch (error) {
        console.error('Error starting microphone:', error)
      } finally {
        setIsStreamLoading(false)
      }
      return
    }

    // Toggle existing audio tracks
    const audioTracks = userStream.getAudioTracks()
    audioTracks.forEach(track => {
      track.enabled = !micEnabled
    })
    setMicEnabled(!micEnabled)
  }

  // Toggle camera
  const toggleCamera = async () => {
    if (!videoEnabled) {
      // Turn on camera
      setIsStreamLoading(true)
      try {
        console.log('🎥 Starting camera...')
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: micEnabled,
          video: currentCameraId ? { deviceId: { exact: currentCameraId } } : true
        })
        
        console.log('🎥 Camera stream obtained:', stream.id, 'tracks:', stream.getTracks().length)
        stream.getTracks().forEach((track, index) => {
          console.log(`Track ${index}:`, track.kind, track.enabled, track.readyState)
        })
        
        if (setUserMediaStream) {
          // Stop existing video tracks
          if (userStream) {
            console.log('🛑 Stopping existing stream tracks')
            const videoTracks = userStream.getVideoTracks()
            videoTracks.forEach(track => track.stop())
          }
          console.log('📝 Setting new stream in context')
          setUserMediaStream(stream)
        }
        
        setVideoEnabled(true)
        console.log('✅ Camera enabled, calling startAudioVideoStreams')
        startAudioVideoStreams?.()
      } catch (error) {
        console.error('❌ Error starting camera:', error)
      } finally {
        setIsStreamLoading(false)
      }
    } else {
      // Turn off camera
      console.log('🔴 Turning off camera')
      if (userStream) {
        const videoTracks = userStream.getVideoTracks()
        videoTracks.forEach(track => {
          track.enabled = false
          track.stop()
        })
      }
      setVideoEnabled(false)
    }
  }

  // Enhanced camera switching with stream update
  const switchCamera = async (deviceId: string) => {
    if (!videoEnabled) return
    
    setIsStreamLoading(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } },
        audio: micEnabled
      })
      
      if (setUserMediaStream) {
        // Stop existing tracks
        if (userStream) {
          userStream.getTracks().forEach(track => track.stop())
        }
        setUserMediaStream(stream)
      }
      
      setCurrentCameraId(deviceId)
      startAudioVideoStreams?.()
      console.log('Camera switched to:', deviceId)
    } catch (error) {
      console.error('Error switching camera:', error)
    } finally {
      setIsStreamLoading(false)
    }
  }

  // Direct camera test (bypasses peer connection)
  const testCamera = async () => {
    console.log('🧪 Testing camera directly...')
    setIsStreamLoading(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true
      })
      
      console.log('🧪 Test stream obtained:', stream.id, 'tracks:', stream.getTracks().length)
      if (setUserMediaStream) {
        setUserMediaStream(stream)
      }
      setVideoEnabled(true)
      console.log('🧪 Test complete - stream should be visible now')
    } catch (error) {
      console.error('🧪 Test failed:', error)
    } finally {
      setIsStreamLoading(false)
    }
  }

  // Debug peer connection and streams
  const debugPeerConnection = () => {
    console.log('🔍 === PEER CONNECTION DEBUG ===')
    console.log('Remote Socket ID:', remoteSocketId)
    console.log('User Stream:', userStream ? userStream.id : 'null')
    console.log('Remote Streams Count:', remoteStreams?.length || 0)
    console.log('Remote Streams:', remoteStreams?.map(s => s.id) || [])
    
    // Check if we can access peer service
    if (typeof window !== 'undefined' && (window as any).peerService) {
      const peerService = (window as any).peerService
      console.log('Peer Connection State:', peerService.peer?.connectionState)
      console.log('Signaling State:', peerService.peer?.signalingState)
      console.log('ICE Connection State:', peerService.peer?.iceConnectionState)
      console.log('ICE Gathering State:', peerService.peer?.iceGatheringState)
    }
    
    console.log('=== END DEBUG ===')
  }

  // Mock user data - in real app this would come from props or context
  const remoteUser = {
    name: "Jessica",
    age: 28,
    location: "New York, NY",
    bio: "Coffee enthusiast, dog lover, and avid hiker. Looking for someone to share adventures with!",
    interests: ["Hiking", "Photography", "Travel", "Coffee"]
  }

  const ActionButton: React.FC<{
    icon: React.ReactNode
    onClick: () => void
    active?: boolean
    color?: string
    size?: 'sm' | 'md' | 'lg'
  }> = ({ icon, onClick, active = false, color = 'white', size = 'md' }) => {
    const sizeClasses = {
      sm: 'w-12 h-12 text-lg',
      md: 'w-16 h-16 text-xl',
      lg: 'w-20 h-20 text-2xl'
    }

    return (
      <button
        onClick={onClick}
        className={`
          ${sizeClasses[size]} rounded-full flex items-center justify-center
          transition-all duration-200 transform hover:scale-110 active:scale-95
          backdrop-blur-sm border border-white/20 shadow-lg
          ${active 
            ? 'bg-gradient-to-r from-pink-500 to-red-500 text-white' 
            : 'bg-white/10 text-white hover:bg-white/20'
          }
        `}
      >
        {icon}
      </button>
    )
  }

  return (
    <div className="relative h-screen w-full overflow-hidden bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      {/* Main Video Area */}
      <div className="relative h-full w-full">
        {/* Remote Video Stream */}
        {remoteStreams && remoteStreams.length > 0 ? (
          <div className="relative w-full h-full">
            {/* Display the first remote stream as main video */}
            <ReactPlayer
              key={remoteStreams[0].id}
              url={remoteStreams[0]}
              width="100%"
              height="100%"
              playing
              muted={false}
              className="object-cover"
              onReady={() => console.log('📺 Remote ReactPlayer ready for stream:', remoteStreams[0].id)}
              onStart={() => console.log('▶️ Remote ReactPlayer started for stream:', remoteStreams[0].id)}
              onError={(error) => console.error('❌ Remote ReactPlayer error:', error)}
              onPlay={() => console.log('▶️ Remote video playing')}
              onPause={() => console.log('⏸️ Remote video paused')}
            />
            
            {/* Additional remote streams (if any) shown as thumbnails */}
            {remoteStreams.length > 1 && (
              <div className="absolute bottom-20 left-4 flex space-x-2 z-30">
                {remoteStreams.slice(1).map((stream, index) => (
                  <div key={stream.id} className="w-24 h-16 rounded-lg overflow-hidden border border-white/20">
                    <ReactPlayer
                      url={stream}
                      width="100%"
                      height="100%"
                      playing
                      muted
                      className="object-cover"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Loading/Waiting Screen */
          <div className="flex h-full w-full items-center justify-center">
            <div className="text-center">
              {isStreamLoading ? (
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20">
                  <div className="flex flex-col items-center space-y-4">
                    <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
                    <h2 className="text-white text-xl font-light">Starting video stream...</h2>
                    <p className="text-white/80">Please wait while we connect your camera</p>
                  </div>
                </div>
              ) : remoteSocketId ? (
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20">
                  <div className="flex flex-col items-center space-y-4">
                    <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                      <BsCameraVideoOffFill className="text-white text-2xl" />
                    </div>
                    <h2 className="text-white text-xl font-light">No Remote Video</h2>
                    <p className="text-white/80">Connected but no video stream received</p>
                    <div className="mt-4 text-sm text-white/60 space-y-1">
                      <div>Remote Socket ID: {remoteSocketId}</div>
                      <div>Remote Streams: {remoteStreams?.length || 0}</div>
                      <div>User Stream: {userStream ? 'Available' : 'None'}</div>
                    </div>
                    <button 
                      onClick={debugPeerConnection}
                      className="mt-2 px-4 py-2 bg-blue-500/20 text-blue-300 rounded-lg text-sm hover:bg-blue-500/30 transition-colors"
                    >
                      Debug Connection
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20">
                  <h2 className="text-white text-2xl font-light mb-4">Ready to Connect!</h2>
                  <p className="text-white/80 text-lg">Waiting for someone special to join...</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Whiteboard Overlay */}
        {whiteboardVisible && whiteboardID && (
          <WhiteboardOverlay 
            isVisible={whiteboardVisible}
            remoteSocketId={remoteSocketId}
          />
        )}
      </div>

      {/* User Info - Top Left */}
      {remoteSocketId && (
        <div className="absolute top-6 left-6 z-30">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-r from-pink-500 to-violet-500 rounded-full flex items-center justify-center">
                <span className="text-white font-semibold text-lg">{remoteUser.name[0]}</span>
              </div>
              <div>
                <h3 className="text-white font-medium">{remoteUser.name}</h3>
                <p className="text-white/70 text-sm">{remoteUser.location}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Picture-in-Picture User Video */}
      {pipVisible && (
        <div
          className="absolute z-40 w-32 h-44 bg-black rounded-xl overflow-hidden border-2 border-white/20 shadow-2xl cursor-move"
          style={{
            left: `${pipPosition.x}px`,
            top: `${pipPosition.y}px`,
            transform: `rotate(${rotation}deg) ${isMirrored ? 'scaleX(-1)' : ''}`
          }}
        >
          {/* Drag Handle */}
          <div
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            className="absolute top-0 left-0 right-0 h-6 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 cursor-grab active:cursor-grabbing touch-none"
          >
            <FiMove className="text-white text-xs" />
          </div>

          {/* Video Stream */}
          <div className="w-full h-full relative">
            {videoEnabled && userStream && userStream.getVideoTracks().length > 0 ? (
              <ReactPlayer
                url={userStream}
                width="100%"
                height="100%"
                playing
                muted
                className="object-cover"
                onReady={() => console.log('📺 PiP ReactPlayer ready')}
                onStart={() => console.log('▶️ PiP ReactPlayer started')}
                onError={(error) => console.error('❌ PiP ReactPlayer error:', error)}
              />
            ) : (
              <div className="w-full h-full bg-gray-800 flex items-center justify-center pt-6">
                <div className="text-center">
                  {isStreamLoading ? (
                    <div className="flex flex-col items-center space-y-2">
                      <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                      <span className="text-white text-xs">Loading...</span>
                    </div>
                  ) : !videoEnabled ? (
                    <div className="flex flex-col items-center space-y-2">
                      <BsCameraVideoOffFill className="text-white text-xl" />
                      <span className="text-white text-xs">Camera Off</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center space-y-2">
                      <BsCameraVideoOffFill className="text-white text-xl" />
                      <span className="text-white text-xs">No Stream</span>
                      <button 
                        onClick={toggleCamera}
                        className="text-xs text-blue-400 hover:text-blue-300"
                      >
                        Start Camera
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Controls Overlay */}
          <div className="absolute bottom-0 left-0 right-0 bg-black/50 backdrop-blur-sm p-2 flex items-center justify-between">
            {/* Mirror Toggle */}
            <button
              onClick={() => setIsMirrored(!isMirrored)}
              className={`p-1 rounded text-xs transition-colors ${
                isMirrored ? 'bg-blue-500 text-white' : 'bg-white/20 text-white hover:bg-white/30'
              }`}
              title="Toggle Mirror"
            >
              <MdFlip />
            </button>

            {/* Rotate (Mobile) */}
            <button
              onClick={rotateCamera}
              className="p-1 rounded text-xs bg-white/20 text-white hover:bg-white/30 transition-colors"
              title="Rotate Camera"
            >
              <MdRotateRight />
            </button>

            {/* Camera Selection */}
            <button
              onClick={() => setShowCameraOptions(!showCameraOptions)}
              className={`p-1 rounded text-xs transition-colors ${
                showCameraOptions ? 'bg-green-500 text-white' : 'bg-white/20 text-white hover:bg-white/30'
              }`}
              title="Select Camera"
            >
              <MdVideocam />
            </button>
          </div>

          {/* Camera Selection Dropdown */}
          {showCameraOptions && availableCameras.length > 1 && (
            <div className="absolute bottom-12 right-0 bg-white rounded-lg shadow-xl border border-gray-200 min-w-48 z-40">
              <div className="p-2 border-b border-gray-200">
                <p className="text-sm font-medium text-gray-800">Select Camera</p>
              </div>
              <div className="max-h-32 overflow-y-auto">
                {availableCameras.map((camera, index) => (
                  <button
                    key={camera.deviceId}
                    onClick={() => {
                      switchCamera(camera.deviceId)
                      setShowCameraOptions(false)
                    }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 transition-colors ${
                      currentCameraId === camera.deviceId ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                    }`}
                  >
                    {camera.label || `Camera ${index + 1}`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Close Button */}
          <button
            onClick={() => setPipVisible(false)}
            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-xs transition-colors shadow-lg"
          >
            ×
          </button>
        </div>
      )}

      {/* Bottom Control Bar */}
      <div className="absolute bottom-0 left-0 right-0 p-6 z-20">
        <div className="flex items-center justify-center space-x-4">
          {/* Reject/End Call */}
          <ActionButton
            icon={<AiOutlineClose />}
            onClick={() => window.location.reload()}
            color="red"
            size="lg"
          />

          {/* File Transfer */}
          <ActionButton
            icon={<AiFillFileText />}
            onClick={() => setFileTransferOpen(true)}
            active={fileTransferOpen}
          />

          {/* Microphone Toggle */}
          <ActionButton
            icon={micEnabled ? <IoMdMic /> : <IoMdMicOff />}
            onClick={toggleMicrophone}
            active={micEnabled}
          />

          {/* Video Toggle */}
          <ActionButton
            icon={videoEnabled ? <BsCameraVideoFill /> : <BsCameraVideoOffFill />}
            onClick={toggleCamera}
            active={videoEnabled}
          />

          {/* Screen Share */}
          <ActionButton
            icon={userScreenStream ? <MdStopScreenShare /> : <MdScreenShare />}
            onClick={userScreenStream ? (stopScreenShareStreams || (() => {})) : (startScreenShareStreams || (() => {}))}
            active={!!userScreenStream}
          />

          {/* Chat */}
          <ActionButton
            icon={<AiFillMessage />}
            onClick={() => setChatOpen(true)}
            active={chatOpen}
          />

          {/* Accept/Like */}
          <ActionButton
            icon={<AiFillHeart />}
            onClick={() => console.log('Liked!')}
            color="green"
            size="lg"
          />

          {/* Test Camera (Debug) */}
          <ActionButton
            icon={<BsCameraFill />}
            onClick={testCamera}
            active={false}
            size="sm"
          />

          {/* Debug Peer Connection */}
          <ActionButton
            icon={<IoMdSettings />}
            onClick={debugPeerConnection}
            active={false}
            size="sm"
          />

          {/* PiP Toggle */}
          {!pipVisible && (
            <ActionButton
              icon={<BsCameraVideoFill />}
              onClick={() => setPipVisible(true)}
              active={false}
            />
          )}
        </div>

        {/* Connection Status */}
        <div className="text-center mt-4">
          <div className="inline-flex items-center space-x-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full border border-white/20">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-white text-sm">Connected</span>
          </div>
        </div>
      </div>

      {/* File Transfer Modal */}
      {fileTransferOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-md max-h-[80vh] overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-800">File Transfer</h2>
              <button
                onClick={() => setFileTransferOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <AiOutlineClose className="text-gray-500" />
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto">
              <FileTransfer
                onFileTransfer={onFileTransfer}
                availableFiles={availableFiles}
              />
            </div>
          </div>
        </div>
      )}

      {/* Chat Modal */}
      {chatOpen && remoteSocketId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end justify-center z-50 p-4">
          <div className="bg-white rounded-t-3xl w-full max-w-md h-[70vh] overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800">Chat with {remoteUser.name}</h2>
              <button
                onClick={() => setChatOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <AiOutlineClose className="text-gray-500" />
              </button>
            </div>
            <div className="h-full">
              <Chat remoteSocketId={remoteSocketId} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard