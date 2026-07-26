'use client'

import { useRef, useState, useEffect } from 'react'
import { Eraser, Check } from 'lucide-react'

export function SignaturePad({ onSign }: { onSign: (signed: boolean) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [hasInk, setHasInk] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ratio = window.devicePixelRatio || 1
    canvas.width = canvas.offsetWidth * ratio
    canvas.height = canvas.offsetHeight * ratio
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(ratio, ratio)
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.strokeStyle = getComputedStyle(document.documentElement)
      .getPropertyValue('--primary')
      .trim() || '#7CFC00'
  }, [])

  function pos(e: React.PointerEvent) {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function start(e: React.PointerEvent) {
    drawing.current = true
    const ctx = canvasRef.current!.getContext('2d')!
    const { x, y } = pos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  function move(e: React.PointerEvent) {
    if (!drawing.current) return
    const ctx = canvasRef.current!.getContext('2d')!
    const { x, y } = pos(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    if (!hasInk) {
      setHasInk(true)
      onSign(true)
    }
  }

  function end() {
    drawing.current = false
  }

  function clear() {
    const canvas = canvasRef.current!
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height)
    setHasInk(false)
    onSign(false)
  }

  return (
    <div>
      <div className="relative overflow-hidden rounded-2xl border border-border bg-background">
        <canvas
          ref={canvasRef}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          className="h-40 w-full touch-none"
        />
        {!hasInk && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            Firme aquí con el dedo
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <button
          onClick={clear}
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
        >
          <Eraser className="size-3.5" /> Limpiar
        </button>
        {hasInk && (
          <span className="flex items-center gap-1 text-xs font-medium text-primary">
            <Check className="size-3.5" /> Firma capturada
          </span>
        )}
      </div>
    </div>
  )
}
