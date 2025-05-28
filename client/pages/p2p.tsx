import React from 'react'
import type { NextPage } from 'next'
import { createHmac } from 'crypto'
import { Socket } from 'socket.io-client'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import { useRouter } from 'next/router'

import { useRoom, RoomContext } from 'context/RoomContext'

import Navbar from 'components/Navbar'
import UserAvatar from 'components/UserAvatar'

import Dashboard from 'components/Dashboard'

import { serverInstance, SuperHero } from 'api'

import peerService from 'services/peer'
import { AvailableFiles } from 'components/FileTransfer'

import { MediaStreamContext, ProviderProps } from 'context/MediaStream'
import {
  MediaScreenStreamContext,
  ProviderScreenProps,
} from 'context/ScreenStream'
import { SocketContext } from 'context/SocketContext'
import { IncomingCall, User } from 'types'

const Home: NextPage = () => {
  const { setUserMediaStream, setRemoteMediaStream, remoteStreams } =
    React.useContext(MediaStreamContext) as ProviderProps

  const {
    userScreenStream,
    setUserMediaScreenStream,
    setScreenRemoteMediaStream,
  } = React.useContext(MediaScreenStreamContext) as ProviderScreenProps

  const { user: currentUser } = useRoom() as RoomContext

  const socket = React.useContext(SocketContext) as Socket

  // Create a ref to track the latest remote streams for the track event handler
  const remoteStreamsRef = React.useRef<MediaStream[]>([])

  const [users, setUsers] = React.useState<User[] | undefined | null>()
  const [self, setSelf] = React.useState<SuperHero | undefined | null>()

  const [whiteboardID, setWhiteboardID] = React.useState<string | null>(null)

  const [avilableFiles, setAvailableFiles] = React.useState<AvailableFiles[]>(
    []
  )

  const [calledToUserId, setCalledToUserId] = React.useState<
    string | undefined
  >()

  const [remoteSocketId, setRemoteSocketId] = React.useState<
    string | undefined
  >()

  const [remoteUser, setRemoteUser] = React.useState<undefined | null | User>()

  const [incommingCallData, setIncommingCallData] = React.useState<
    IncomingCall | undefined
  >()

  const isCallModalOpened = React.useMemo(
    () => Boolean(incommingCallData !== undefined),
    [incommingCallData]
  )

  const secret = React.useMemo(() => '$3#Ia', [])

  const router = useRouter()

  const loadUsers = React.useCallback(async () => {
    const { data } = await serverInstance.get('/users')
    if (data.users) {
      setUsers(data.users)
    }
  }, [])

  const joinRoom = React.useCallback(async () => {
    try {
      if (currentUser && currentUser.displayName && currentUser.guestId) {
        socket.emit('room:join', {
          username: `${currentUser?.displayName} (${currentUser?.guestId})`,
          displayPicture: currentUser?.avatar || null,
          platform: 'web',
        })
      }
    } catch (error) {
      joinRoom()
    }
  }, [currentUser])

  const handleClickUser = React.useCallback(async (user: User) => {
    try {
      // Reset peer connection state if it's not stable
      if (peerService.peer) {
        console.log('Current peer connection state:', peerService.peer.signalingState)
        if (peerService.peer.signalingState !== 'stable') {
          console.log('Peer connection not in stable state, reinitializing...')
          // Reinitialize the peer service to get a fresh connection
          peerService.reset()
          
          // Re-establish event listeners after reset
          if (peerService.peer) {
            console.log('Re-establishing event listeners after reset')
            
            // Re-establish remote track handler
            const handleRemoteTrack = (ev: RTCTrackEvent) => {
              console.log('Received remote track after reset:', ev.track.kind, 'from streams:', ev.streams.length)
              
              if (ev.streams && ev.streams.length > 0 && setRemoteMediaStream) {
                const currentStreams = remoteStreamsRef.current
                const newStreams = ev.streams.filter(stream => 
                  !currentStreams.some(existing => existing.id === stream.id)
                )
                
                if (newStreams.length > 0) {
                  console.log('Adding new remote streams after reset:', newStreams.length)
                  const updatedStreams = [...currentStreams, ...newStreams]
                  setRemoteMediaStream(updatedStreams)
                  remoteStreamsRef.current = updatedStreams
                }
              }
            }
            
            peerService.peer.addEventListener('track', handleRemoteTrack)
          }
        }
      }

      // Start video stream before making the call to ensure tracks are available
      console.log('Starting video stream before making call')
      
      // Start video stream directly here
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      })

      if (stream && setUserMediaStream) setUserMediaStream(stream)

      console.log('Adding media tracks to peer connection:', stream.getTracks().length)
      for (const track of stream.getTracks()) {
        if (peerService.peer) {
          console.log('Adding track:', track.kind, 'to peer connection')
          peerService.peer?.addTrack(track, stream)
        }
      }
      
      // Small delay to ensure tracks are properly added
      await new Promise(resolve => setTimeout(resolve, 100))
      
      console.log('Creating offer for user:', user.username)
      const offer = await peerService.getOffer()
      if (offer) {
        socket.emit('peer:call', { to: user.socketId, offer })
        setCalledToUserId(user.socketId)
        console.log('Call initiated successfully')
      } else {
        console.log('Failed to create offer, peer connection not ready')
      }
    } catch (error) {
      console.error('Error during call initiation:', error)
    }
  }, [setRemoteMediaStream, setUserMediaStream])

  const handleIncommingCall = React.useCallback(async (data: IncomingCall) => {
    if (data) {
      setIncommingCallData(data)
    }
  }, [])

  const handleCallAccepted = React.useCallback(async (data) => {
    const { offer, from, user } = data

    try {
      console.log('*** CALL ACCEPTED - CALLER SIDE ***')
      console.log('Peer connection state before setting remote desc:', peerService.peer?.signalingState)
      console.log('Peer connection ICE state:', peerService.peer?.iceConnectionState)
      
      await peerService.setRemoteDesc(offer)
      
      console.log('Remote description set successfully')
      console.log('Peer connection state after setting remote desc:', peerService.peer?.signalingState)
      console.log('Local tracks on peer connection:', peerService.peer?.getSenders()?.length || 0)
      
      peerService.peer?.getSenders()?.forEach((sender, index) => {
        console.log(`Sender ${index}:`, sender.track?.kind, sender.track?.enabled, sender.track?.readyState)
      })
      
      setRemoteUser({
        displayPicture: user.displayPicture,
        username: user.username,
        isConnected: true,
        joinedAt: new Date(),
        platform: 'macos',
        socketId: from,
      })
      setRemoteSocketId(from)
      setCalledToUserId(undefined) // Clear the calling state
    } catch (error) {
      console.error('Failed to handle call acceptance:', error)
    }
  }, [])

  const handleAcceptIncommingCall = React.useCallback(async () => {
    if (!incommingCallData) return
    const { from, user, offer } = incommingCallData
    if (offer) {
      try {
        // Start video stream before accepting the call
        console.log('Starting video stream before accepting call')
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true,
        })

        if (stream && setUserMediaStream) setUserMediaStream(stream)

        console.log('Adding media tracks to peer connection before accepting:', stream.getTracks().length)
        for (const track of stream.getTracks()) {
          if (peerService.peer) {
            console.log('Adding track:', track.kind, 'to peer connection before accepting')
            peerService.peer?.addTrack(track, stream)
          }
        }

        console.log('*** ANSWERING CALL - CALLEE SIDE ***')
        console.log('Peer connection state before getAnswer:', peerService.peer?.signalingState)
        console.log('Local tracks added:', peerService.peer?.getSenders()?.length || 0)
        
        const answer = await peerService.getAnswer(offer)
        if (answer) {
          console.log('Answer created successfully')
          console.log('Peer connection state after creating answer:', peerService.peer?.signalingState)
          
          socket.emit('peer:call:accepted', { to: from, offer: answer })
          setRemoteUser({
            displayPicture: user.displayPicture,
            username: user.username,
            isConnected: true,
            joinedAt: new Date(),
            platform: 'macos',
            socketId: from,
          })
          setRemoteSocketId(from)
        } else {
          console.log('Failed to create answer, peer connection not ready')
        }
      } catch (error) {
        console.error('Error accepting call:', error)
      }
    }
  }, [incommingCallData, setUserMediaStream])

  const handleRejectIncommingCall = React.useCallback(
    () => setIncommingCallData(undefined),
    []
  )

  React.useEffect(() => {
    if (remoteSocketId) setIncommingCallData(undefined)
  }, [remoteSocketId])

  React.useEffect(() => {
    peerService.remoteSocketId = remoteSocketId
  }, [remoteSocketId])

  const handleFileTransfer = React.useCallback(
    (file: File): Promise<void> => {
      return new Promise(async (resolve, reject) => {
        if (peerService.myDataChanel) {
          let buffer = await file.arrayBuffer()

          const bufferString = JSON.stringify(buffer)
          const hash = createHmac('md5', secret)
            .update(bufferString)
            .digest('hex')
          try {
            peerService.myDataChanel.send(
              JSON.stringify({
                name: file.name,
                size: file.size,
                checksum: hash,
              })
            )
          } catch (error) {
            reject()
          }

          let offset = 0
          let maxChunkSize = 1024 * 26

          peerService.myDataChanel.binaryType = 'arraybuffer'
          try {
            const send = () => {
              while (buffer.byteLength) {
                if (
                  peerService &&
                  peerService.myDataChanel &&
                  peerService?.myDataChanel?.bufferedAmount >
                    peerService?.myDataChanel?.bufferedAmountLowThreshold
                ) {
                  peerService.myDataChanel.onbufferedamountlow = () => {
                    if (peerService && peerService.myDataChanel)
                      peerService.myDataChanel.onbufferedamountlow = null
                    send()
                  }
                  return
                }
                const chunk = buffer.slice(0, maxChunkSize)
                buffer = buffer.slice(maxChunkSize, buffer.byteLength)
                if (peerService && peerService.myDataChanel)
                  peerService?.myDataChanel.send(chunk)
              }
              resolve()
            }
            send()
          } catch (err) {
            reject()
          }
        }
      })
    },
    [secret]
  )

  const handleNegosiation = React.useCallback(
    async (ev: Event) => {
      if (!remoteSocketId) {
        console.log('No remote socket ID, skipping negotiation')
        return
      }
      
      if (calledToUserId || incommingCallData) {
        console.log('In initial call setup phase, skipping negotiation')
        return
      }
      
      console.log('Handling negotiation needed event')
      const offer = await peerService.getOffer()
      if (offer) {
        socket.emit('peer:negotiate', {
          to: peerService.remoteSocketId,
          offer,
        })
      } else {
        console.log('Failed to create negotiation offer')
      }
    },
    [remoteSocketId, calledToUserId, incommingCallData]
  )

  const handleRequiredPeerNegotiate = React.useCallback(async (data) => {
    const { from, offer } = data
    if (offer) {
      const answer = await peerService.getAnswer(offer)
      if (answer) {
        socket.emit('peer:negosiate:result', { to: from, offer: answer })
      } else {
        console.log('Failed to create negotiation answer')
      }
    }
  }, [])

  const handleRequiredPeerNegotiateFinalResult = React.useCallback(
    async (data) => {
      const { from, offer } = data
      if (offer) {
        try {
          await peerService.setRemoteDesc(offer)
        } catch (error) {
          console.error('Failed to set remote description during negotiation:', error)
        }
      }
    },
    []
  )

  const handleStartAudioVideoStream = React.useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    })

    if (stream && setUserMediaStream) setUserMediaStream(stream)

    console.log('Adding media tracks to peer connection:', stream.getTracks().length)
    for (const track of stream.getTracks()) {
      if (peerService.peer) {
        console.log('Adding track:', track.kind, 'to peer connection')
        peerService.peer?.addTrack(track, stream)
      }
    }
  }, [])

  const handleStartScreenShareStream = React.useCallback(async () => {
    const stream = await navigator.mediaDevices.getDisplayMedia({})

    if (stream && setUserMediaScreenStream) setUserMediaScreenStream(stream)

    const track = stream.getTracks()[0]
    if (peerService.peer) {
      peerService.peer?.addTrack(track, stream)
    }
  }, [])

  const handleStopScreenShareStream = React.useCallback(async () => {
    if (userScreenStream) {
      const tracks = userScreenStream.getTracks()
      tracks.forEach((track) => track.stop())

      if (setUserMediaScreenStream) {
        setUserMediaScreenStream(null)
      }
    }
  }, [userScreenStream, setUserMediaScreenStream])

  React.useEffect(() => {
    joinRoom()
  }, [currentUser])

  // Keep the ref in sync with the latest remote streams
  React.useEffect(() => {
    remoteStreamsRef.current = remoteStreams || []
    console.log('Remote streams updated:', remoteStreams?.length || 0, remoteStreams?.map(s => s.id))
  }, [remoteStreams])

  // Automatically start video stream when connection is established
  React.useEffect(() => {
    if (remoteSocketId) {
      console.log('Connection established, starting video stream after delay')
      // Add a small delay to ensure the WebRTC connection is fully established
      const timer = setTimeout(async () => {
        try {
          await handleStartAudioVideoStream()
          console.log('Video stream started successfully')
        } catch (error) {
          console.error('Error starting video stream:', error)
        }
      }, 1000) // 1 second delay
      
      return () => clearTimeout(timer)
    }
  }, [remoteSocketId, handleStartAudioVideoStream])

  React.useEffect(() => {
    loadUsers()
    const peerServiceInit = peerService.init()

    peerService?.peer?.addEventListener('negotiationneeded', handleNegosiation)

    // Create a callback to handle remote tracks
    const handleRemoteTrack = (ev: RTCTrackEvent) => {
      console.log('*** REMOTE TRACK EVENT ***')
      console.log('Track kind:', ev.track.kind)
      console.log('Track ID:', ev.track.id)
      console.log('Track enabled:', ev.track.enabled)
      console.log('Track readyState:', ev.track.readyState)
      console.log('Number of streams:', ev.streams.length)
      ev.streams.forEach((stream, index) => {
        console.log(`Stream ${index} ID:`, stream.id)
        console.log(`Stream ${index} tracks:`, stream.getTracks().length)
        stream.getTracks().forEach((track, trackIndex) => {
          console.log(`  Track ${trackIndex}:`, track.kind, track.enabled, track.readyState)
        })
      })
      
      if (ev.streams && ev.streams.length > 0 && setRemoteMediaStream) {
        // Get the current streams from ref to avoid stale closure
        const currentStreams = remoteStreamsRef.current
        console.log('Current remote streams count:', currentStreams.length)
        
        // Add new streams that aren't already in the list
        const newStreams = ev.streams.filter(stream => 
          !currentStreams.some(existing => existing.id === stream.id)
        )
        
        if (newStreams.length > 0) {
          console.log('*** ADDING NEW REMOTE STREAMS ***')
          console.log('New streams count:', newStreams.length)
          const updatedStreams = [...currentStreams, ...newStreams]
          console.log('Total remote streams after update:', updatedStreams.length)
          
          setRemoteMediaStream(updatedStreams)
          remoteStreamsRef.current = updatedStreams // Keep ref in sync
          
          // Additional verification
          setTimeout(() => {
            console.log('*** VERIFICATION AFTER 1 SECOND ***')
            console.log('Remote streams in context:', remoteStreams?.length || 0)
            remoteStreams?.forEach((stream, i) => {
              console.log(`Context stream ${i}:`, stream.id, 'active:', stream.active)
            })
          }, 1000)
        } else {
          console.log('No new streams to add (duplicates filtered out)')
        }
      } else {
        console.log('*** WARNING: No streams or setRemoteMediaStream not available ***')
        console.log('ev.streams:', !!ev.streams)
        console.log('ev.streams.length:', ev.streams?.length || 0)
        console.log('setRemoteMediaStream:', !!setRemoteMediaStream)
      }
    }

    let temp = {
      filename: '',
      size: 0,
      checksum: null,
    }

    let receivedSize = 0
    let receiveBuffer: Buffer[] = []

    if (peerService.peer) {
      peerService.peer.addEventListener('track', handleRemoteTrack)
      peerService.peer.addEventListener('ended', async (ev) => {})
    }

    if (peerService.peer)
      //@ts-ignore
      peerService.peer.ondatachannel = (e) => {
        peerService.remoteDataChanel = e.channel
        peerService.remoteDataChanel.onmessage = (e) => {
          const { data } = e

          if (typeof data === 'string') {
            const { name, size, checksum } = JSON.parse(data)
            temp.filename = name
            temp.size = size
            temp.checksum = checksum

            setAvailableFiles((e) => [
              {
                name: temp.filename,
                size: temp.size,
                recievedSize: 0,
                checksum: temp.checksum,
                checksumMatched: false,
              },
              ...e,
            ])
          } else {
            try {
              if (data && receivedSize < temp.size) {
                receiveBuffer.push(data)
                receivedSize += data.byteLength
                setAvailableFiles((e) =>
                  e.map((e) =>
                    e.name === temp.filename
                      ? {
                          name: temp.filename,
                          size: temp.size,
                          recievedSize: receivedSize,
                          checksum: temp.checksum,
                          checksumMatched: false,
                        }
                      : e
                  )
                )
              }
              if (data && receivedSize === temp.size) {
                const blob = new Blob(receiveBuffer)

                ;(async () => {
                  const arraybuffer = await blob.arrayBuffer()
                  const bufferString = JSON.stringify(arraybuffer)
                  const hash = createHmac('md5', secret)
                    .update(bufferString)
                    .digest('hex')

                  if (temp.checksum !== hash) {
                    setAvailableFiles((e) =>
                      e.map((e) =>
                        e.name === temp.filename
                          ? {
                              name: temp.filename,
                              size: temp.size,
                              recievedSize: receivedSize,
                              blob,
                              checksumMatched: false,
                              checksum: temp.checksum,
                            }
                          : e
                      )
                    )
                  } else {
                    setAvailableFiles((e) =>
                      e.map((e) =>
                        e.name === temp.filename
                          ? {
                              name: temp.filename,
                              size: temp.size,
                              recievedSize: receivedSize,
                              blob,
                              checksum: temp.checksum,
                              checksumMatched: true,
                            }
                          : e
                      )
                    )
                    temp = {
                      filename: '',
                      size: 0,
                      checksum: null,
                    }
                    receivedSize = 0
                    receiveBuffer = []
                  }
                })()
              }
            } catch (error) {}
          }
        }
        peerService.remoteDataChanel.onopen = (e) =>
          console.log('Data Chanel Created!')
      }

    return () => {
      peerService?.peer?.removeEventListener(
        'negotiationneeded',
        handleNegosiation
      )
      peerService?.peer?.removeEventListener('track', handleRemoteTrack)
    }
  }, [handleNegosiation])

  const handleUserDisconnection = React.useCallback(
    (payload) => {
      const { socketId = null } = payload

      if (socketId) {
        if (remoteSocketId == socketId) {
          setRemoteUser(undefined)
        }
      }
    },
    [remoteSocketId]
  )

  const handleSetWhiteboardID = React.useCallback((payload) => {
    if (payload.whiteboardID) {
      setWhiteboardID(payload.whiteboardID)
    }
  }, [])

  React.useEffect(() => {
    if (remoteSocketId) {
      socket.off('refresh:user-list', loadUsers)
      socket.on('user-disconnected', handleUserDisconnection)
    }

    return () => {
      socket.on('refresh:user-list', loadUsers)
      socket.off('user-disconnected', handleUserDisconnection)
    }
  }, [remoteSocketId])

  React.useEffect(() => {
    socket.on('refresh:user-list', loadUsers)
    socket.on('peer:incomming-call', handleIncommingCall)
    socket.on('peer:call:accepted', handleCallAccepted)
    socket.on('peer:negotiate', handleRequiredPeerNegotiate)
    socket.on('peer:negosiate:result', handleRequiredPeerNegotiateFinalResult)
    socket.on('whiteboard:id', handleSetWhiteboardID)

    return () => {
      socket.off('refresh:user-list', loadUsers)
      socket.off('peer:incomming-call', handleIncommingCall)
      socket.off('peer:call:accepted', handleCallAccepted)
      socket.off('peer:negotiate', handleRequiredPeerNegotiate)
      socket.off(
        'peer:negosiate:result',
        handleRequiredPeerNegotiateFinalResult
      )
    }
  }, [handleStartAudioVideoStream])

  if (!currentUser) {
    return (
      <div className="min-h-screen justify-center bg-[#18181b] p-5">
        <Navbar />
        <div className="flex min-h-[80vh] w-full items-center justify-center text-white">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Please Join a Room First</h2>
            <p className="text-gray-300 mb-6">You need to join a room to access P2P features.</p>
            <button
              onClick={() => router.push('/')}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Go to Home Page
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen justify-center bg-[#18181b] p-5">
      <Navbar remoteSocketId={remoteSocketId} remoteUser={remoteUser?.username} />
      {remoteSocketId && (
        <Dashboard
          availableFiles={avilableFiles}
          startAudioVideoStreams={handleStartAudioVideoStream}
          startScreenShareStreams={handleStartScreenShareStream}
          stopScreenShareStreams={handleStopScreenShareStream}
          onFileTransfer={handleFileTransfer}
          remoteSocketId={remoteSocketId}
          whiteboardID={whiteboardID}
        />
      )}
      {!remoteSocketId && (
        <div className="flex min-h-[80vh] w-full items-center justify-center text-white">
          {users &&
            users
              .filter(
                (e) =>
                  e.username !==
                  `${currentUser?.displayName} (${currentUser?.guestId})`
              )
              .map((user, index) => (
                <div
                  key={`${user.username}-${index}`}
                  onClick={() => handleClickUser(user)}
                  className={
                    calledToUserId && calledToUserId === user.socketId
                      ? `border-collapse rounded-3xl border-0 border-dashed border-sky-400 motion-safe:animate-bounce`
                      : ''
                  }
                >
                  <UserAvatar
                    src={user.displayPicture}
                    username={user.username}
                  />
                </div>
              ))}
          {(!users ||
            users.filter(
              (e) =>
                e.username !==
                `${currentUser?.displayName} (${currentUser?.guestId})`
            ).length <= 0) && (
            <Typography className="font-sans text-slate-400 opacity-70 motion-safe:animate-bounce">
              Join by opening this on other tab
            </Typography>
          )}
        </div>
      )}

      {!remoteSocketId && (
        <div className="flex items-center justify-center">
          <Typography variant="h6" className="font-sans text-slate-400">
            Tip: Click on user to make call
          </Typography>
        </div>
      )}

      <Dialog
        open={isCallModalOpened}
        onClose={() => {}}
        aria-labelledby="responsive-dialog-title"
      >
        <DialogTitle id="responsive-dialog-title">
          Incomming Call From {incommingCallData?.user?.username}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>You have an incomming call</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleRejectIncommingCall}>Reject</Button>
          <Button onClick={handleAcceptIncommingCall} autoFocus>
            Accept
          </Button>
        </DialogActions>
      </Dialog>
      {/* <Footer /> */}
    </div>
  )
}

export default Home
