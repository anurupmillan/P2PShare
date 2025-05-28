class WebRTCSerice {
  public _peer: RTCPeerConnection

  constructor() {
    this._peer = new RTCPeerConnection({
      //@ts-ignore
      // sdpSemantics: 'unified-plan',
      iceServers: [
        {
          urls: [
            'stun:stun.l.google.com:19302',
            'stun:global.stun.twilio.com:3478',
          ],
        },
        {
          urls: 'turn:turn.p2pshare.tech:3478',
          username: 'admin',
          credential: 'admin1',
        },
      ],
    })
  }
}

class PeerService {
  private _webRtc: WebRTCSerice | undefined

  public myDataChanel: RTCDataChannel | undefined
  public remoteDataChanel: RTCDataChannel | undefined

  public remoteSocketId: string | undefined

  // Add state tracking to prevent concurrent operations
  private _isCreatingOffer: boolean = false
  private _isProcessingAnswer: boolean = false

  public init() {
    if (!this._webRtc) {
      this._webRtc = new WebRTCSerice()
      this.myDataChanel = this.peer?.createDataChannel(
        `file-transfer-${Date.now()}`
      )
      
      // Add connection state change listener to reset flags
      if (this._webRtc._peer) {
        this._webRtc._peer.addEventListener('connectionstatechange', () => {
          console.log('Connection state changed:', this._webRtc?._peer?.connectionState)
          if (this._webRtc?._peer?.connectionState === 'connected') {
            console.log('Peer connection established successfully')
            this._resetOperationFlags()
          }
          if (this._webRtc?._peer?.connectionState === 'failed' || 
              this._webRtc?._peer?.connectionState === 'disconnected') {
            console.log('Peer connection failed or disconnected')
            this._resetOperationFlags()
          }
        })
        
        this._webRtc._peer.addEventListener('signalingstatechange', () => {
          console.log('Signaling state changed:', this._webRtc?._peer?.signalingState)
          if (this._webRtc?._peer?.signalingState === 'stable') {
            console.log('Signaling state is stable, resetting operation flags')
            this._resetOperationFlags()
          }
        })
        
        this._webRtc._peer.addEventListener('iceconnectionstatechange', () => {
          console.log('ICE connection state changed:', this._webRtc?._peer?.iceConnectionState)
        })
        
        this._webRtc._peer.addEventListener('icegatheringstatechange', () => {
          console.log('ICE gathering state changed:', this._webRtc?._peer?.iceGatheringState)
        })
      }
      
      return this
    }
  }

  // Reset operation flags to prevent stuck states
  private _resetOperationFlags() {
    this._isCreatingOffer = false
    this._isProcessingAnswer = false
  }

  // Method to reset the entire peer connection
  public reset() {
    console.log('Resetting peer connection')
    if (this._webRtc && this._webRtc._peer) {
      // Close existing connection
      this._webRtc._peer.close()
    }
    
    // Clear the webRTC instance to force reinitialization
    this._webRtc = undefined
    this.myDataChanel = undefined
    this.remoteDataChanel = undefined
    this._resetOperationFlags()
    
    // Reinitialize
    return this.init()
  }

  public async setRemoteDesc(offer: RTCSessionDescriptionInit) {
    if (this._webRtc && this._webRtc._peer) {
      try {
        console.log('Setting remote desc, current state:', this._webRtc._peer.signalingState)
        
        // Check if we can set remote description
        if (this._webRtc._peer.signalingState === 'stable' && offer.type === 'answer') {
          console.log('Peer connection is in stable state, cannot set remote answer')
          return
        }
        
        if (this._webRtc._peer.signalingState === 'have-remote-offer' && offer.type === 'offer') {
          console.log('Already have remote offer, cannot set another offer')
          return
        }
        
        await this._webRtc._peer.setRemoteDescription(new RTCSessionDescription(offer))
        console.log('Remote description set successfully')
      } catch (error) {
        console.error('Error setting remote description:', error)
        throw error
      }
    }
  }

  public async getAnswer(offer: RTCSessionDescriptionInit) {
    if (this._webRtc && this._webRtc._peer) {
      try {
        console.log('Getting answer, current state:', this._webRtc._peer.signalingState)
        
        // Prevent concurrent answer operations
        if (this._isProcessingAnswer) {
          console.log('Already processing an answer, skipping')
          return null
        }
        
        if (this._webRtc._peer.signalingState !== 'stable') {
          console.log('Peer connection not in stable state, cannot process offer')
          return null
        }
        
        this._isProcessingAnswer = true
        
        await this._webRtc._peer.setRemoteDescription(new RTCSessionDescription(offer))
        const answer = await this._webRtc._peer.createAnswer()
        await this._webRtc._peer.setLocalDescription(new RTCSessionDescription(answer))
        
        this._isProcessingAnswer = false
        return answer
      } catch (error) {
        console.error('Error getting answer:', error)
        this._isProcessingAnswer = false
        throw error
      }
    }
    return null
  }

  public async getOffer() {
    if (this._webRtc && this._webRtc._peer) {
      try {
        console.log('Getting offer, current state:', this._webRtc._peer.signalingState)
        
        // Prevent concurrent offer operations
        if (this._isCreatingOffer) {
          console.log('Already creating an offer, skipping')
          return null
        }
        
        if (this._webRtc._peer.signalingState !== 'stable') {
          console.log('Peer connection not in stable state, cannot create offer')
          return null
        }
        
        this._isCreatingOffer = true
        
        const offer = await this._webRtc._peer.createOffer()
        await this._webRtc._peer.setLocalDescription(new RTCSessionDescription(offer))
        
        this._isCreatingOffer = false
        return offer
      } catch (error) {
        console.error('Error getting offer:', error)
        this._isCreatingOffer = false
        throw error
      }
    }
    return null
  }

  public get peer() {
    return this._webRtc?._peer
  }
}

export default new PeerService()
