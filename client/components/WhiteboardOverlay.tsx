import React, { useRef, useEffect, useState, useCallback } from 'react'

interface Point {
  x: number
  y: number
  timestamp: number
  opacity: number
}

interface Stroke {
  points: Point[]
  id: string
  createdAt: number
}

interface WhiteboardOverlayProps {
  isVisible?: boolean
  remoteSocketId?: string
}

const WhiteboardOverlay: React.FC<WhiteboardOverlayProps> = ({ isVisible = true, remoteSocketId }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [currentStroke, setCurrentStroke] = useState<Point[]>([])
  const animationFrameRef = useRef<number>()

  // Auto-disappear settings
  const FADE_DURATION = 3000 // 3 seconds
  const FADE_START_DELAY = 1000 // Start fading after 1 second

  const getPointFromEvent = useCallback((e: MouseEvent | TouchEvent): Point => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0, timestamp: Date.now(), opacity: 1 }

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    let clientX: number, clientY: number

    if (e.type.startsWith('touch')) {
      const touch = (e as TouchEvent).touches[0] || (e as TouchEvent).changedTouches[0]
      clientX = touch.clientX
      clientY = touch.clientY
    } else {
      clientX = (e as MouseEvent).clientX
      clientY = (e as MouseEvent).clientY
    }

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
      timestamp: Date.now(),
      opacity: 1
    }
  }, [])

  const startDrawing = useCallback((e: MouseEvent | TouchEvent) => {
    e.preventDefault()
    setIsDrawing(true)
    const point = getPointFromEvent(e)
    setCurrentStroke([point])
  }, [getPointFromEvent])

  const draw = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDrawing) return
    e.preventDefault()
    
    const point = getPointFromEvent(e)
    setCurrentStroke(prev => [...prev, point])
  }, [isDrawing, getPointFromEvent])

  const stopDrawing = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDrawing) return
    e.preventDefault()
    
    setIsDrawing(false)
    if (currentStroke.length > 0) {
      const newStroke: Stroke = {
        points: currentStroke,
        id: `stroke_${Date.now()}_${Math.random()}`,
        createdAt: Date.now()
      }
      setStrokes(prev => [...prev, newStroke])
    }
    setCurrentStroke([])
  }, [isDrawing, currentStroke])

  // Animation loop for fading effect
  const animate = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const currentTime = Date.now()

    // Update and draw strokes
    const updatedStrokes = strokes.map(stroke => {
      const age = currentTime - stroke.createdAt
      let opacity = 1

      if (age > FADE_START_DELAY) {
        const fadeAge = age - FADE_START_DELAY
        opacity = Math.max(0, 1 - (fadeAge / FADE_DURATION))
      }

      // Update opacity for all points in this stroke
      const updatedPoints = stroke.points.map(point => ({
        ...point,
        opacity
      }))

      return {
        ...stroke,
        points: updatedPoints
      }
    }).filter(stroke => stroke.points[0]?.opacity > 0) // Remove fully faded strokes

    setStrokes(updatedStrokes)

    // Draw all strokes
    const allStrokes = [...updatedStrokes]
    if (currentStroke.length > 0) {
      allStrokes.push({
        points: currentStroke,
        id: 'current',
        createdAt: Date.now()
      })
    }

    allStrokes.forEach(stroke => {
      if (stroke.points.length < 2) return

      const opacity = stroke.points[0]?.opacity || 1

      // Red glowing highlighter effect
      ctx.globalCompositeOperation = 'source-over'
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      // Outer glow
      ctx.strokeStyle = `rgba(255, 0, 0, ${opacity * 0.3})`
      ctx.lineWidth = 12
      ctx.shadowColor = 'rgba(255, 0, 0, 0.8)'
      ctx.shadowBlur = 20

      ctx.beginPath()
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y)
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y)
      }
      ctx.stroke()

      // Inner stroke
      ctx.shadowBlur = 0
      ctx.strokeStyle = `rgba(255, 100, 100, ${opacity * 0.8})`
      ctx.lineWidth = 6

      ctx.beginPath()
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y)
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y)
      }
      ctx.stroke()

      // Core bright line
      ctx.strokeStyle = `rgba(255, 150, 150, ${opacity})`
      ctx.lineWidth = 2

      ctx.beginPath()
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y)
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y)
      }
      ctx.stroke()
    })

    animationFrameRef.current = requestAnimationFrame(animate)
  }, [strokes, currentStroke, FADE_START_DELAY, FADE_DURATION])

  // Set up canvas event listeners
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Mouse events
    canvas.addEventListener('mousedown', startDrawing)
    canvas.addEventListener('mousemove', draw)
    canvas.addEventListener('mouseup', stopDrawing)
    canvas.addEventListener('mouseout', stopDrawing)

    // Touch events
    canvas.addEventListener('touchstart', startDrawing, { passive: false })
    canvas.addEventListener('touchmove', draw, { passive: false })
    canvas.addEventListener('touchend', stopDrawing, { passive: false })

    return () => {
      canvas.removeEventListener('mousedown', startDrawing)
      canvas.removeEventListener('mousemove', draw)
      canvas.removeEventListener('mouseup', stopDrawing)
      canvas.removeEventListener('mouseout', stopDrawing)
      canvas.removeEventListener('touchstart', startDrawing)
      canvas.removeEventListener('touchmove', draw)
      canvas.removeEventListener('touchend', stopDrawing)
    }
  }, [startDrawing, draw, stopDrawing])

  // Start animation loop
  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(animate)
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [animate])

  // Resize canvas to match container
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * window.devicePixelRatio
      canvas.height = rect.height * window.devicePixelRatio
      
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
      }
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)
    
    return () => {
      window.removeEventListener('resize', resizeCanvas)
    }
  }, [])

  if (!isVisible) return null

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-auto z-10"
      style={{
        background: 'transparent',
        touchAction: 'none'
      }}
    />
  )
}

export default WhiteboardOverlay 