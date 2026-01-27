"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { ReactNode } from "react"

type CanvasTransform = {
  scale: number
}

type CanvasSurfaceProps = {
  children: (transform: CanvasTransform) => ReactNode
  overlay?: ReactNode
}

type CanvasState = {
  panX: number
  panY: number
  scale: number
}

const STORAGE_KEY = "dappterminal_canvas"
const MIN_SCALE = 0.6
const MAX_SCALE = 1.6

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const isEditableElement = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName.toLowerCase()
  return tag === "input" || tag === "textarea" || target.isContentEditable
}

export function CanvasSurface({ children, overlay }: CanvasSurfaceProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [scale, setScale] = useState(1)
  const [isPanning, setIsPanning] = useState(false)
  const [isPanHotkey, setIsPanHotkey] = useState(false)
  const panStateRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    originX: number
    originY: number
  } | null>(null)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) return
      const parsed = JSON.parse(stored) as CanvasState
      if (typeof parsed.panX === "number" && typeof parsed.panY === "number") {
        setPan({ x: parsed.panX, y: parsed.panY })
      }
      if (typeof parsed.scale === "number") {
        setScale(clamp(parsed.scale, MIN_SCALE, MAX_SCALE))
      }
    } catch {
      // Ignore invalid persisted state.
    }
  }, [])

  useEffect(() => {
    const payload: CanvasState = { panX: pan.x, panY: pan.y, scale }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    } catch {
      // Ignore write errors (storage full or blocked).
    }
  }, [pan.x, pan.y, scale])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        if (!isEditableElement(event.target)) {
          event.preventDefault()
          setIsPanHotkey(true)
        }
      }

      if ((event.metaKey || event.ctrlKey) && event.key === "0") {
        event.preventDefault()
        setPan({ x: 0, y: 0 })
        setScale(1)
      }

      if (event.metaKey || event.ctrlKey) {
        if (event.key === "=" || event.key === "+") {
          event.preventDefault()
          setScale((current) => clamp(current + 0.1, MIN_SCALE, MAX_SCALE))
        }
        if (event.key === "-" || event.key === "_") {
          event.preventDefault()
          setScale((current) => clamp(current - 0.1, MIN_SCALE, MAX_SCALE))
        }
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        setIsPanHotkey(false)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [])

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return

      const target = event.target as HTMLElement | null
      const inWindow = target?.closest("[data-draggable-window]")
      const inOverlay = target?.closest("[data-canvas-overlay]")
      if (!isPanHotkey && (inWindow || inOverlay)) return

      event.currentTarget.setPointerCapture(event.pointerId)
      panStateRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: pan.x,
        originY: pan.y,
      }
      setIsPanning(true)
    },
    [isPanHotkey, pan.x, pan.y]
  )

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!panStateRef.current) return
    if (panStateRef.current.pointerId !== event.pointerId) return
    const dx = event.clientX - panStateRef.current.startX
    const dy = event.clientY - panStateRef.current.startY
    setPan({
      x: panStateRef.current.originX + dx,
      y: panStateRef.current.originY + dy,
    })
  }, [])

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!panStateRef.current) return
    if (panStateRef.current.pointerId !== event.pointerId) return
    panStateRef.current = null
    setIsPanning(false)
  }, [])

  const handleWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement | null
      const inWindow = target?.closest("[data-draggable-window]")
      if (inWindow && !event.ctrlKey && !event.metaKey) return

      const container = containerRef.current
      if (!container) return

      event.preventDefault()
      const rect = container.getBoundingClientRect()
      const cursorX = event.clientX - rect.left
      const cursorY = event.clientY - rect.top
      const zoomFactor = -event.deltaY * 0.0015
      const nextScale = clamp(scale * (1 + zoomFactor), MIN_SCALE, MAX_SCALE)

      const worldX = (cursorX - pan.x) / scale
      const worldY = (cursorY - pan.y) / scale
      const nextPan = {
        x: cursorX - worldX * nextScale,
        y: cursorY - worldY * nextScale,
      }

      setScale(nextScale)
      setPan(nextPan)
    },
    [pan.x, pan.y, scale]
  )

  const handleDoubleClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null
    const inWindow = target?.closest("[data-draggable-window]")
    const inOverlay = target?.closest("[data-canvas-overlay]")
    if (inWindow || inOverlay) return
    setPan({ x: 0, y: 0 })
    setScale(1)
  }, [])

  const majorGrid = 64 * scale
  const minorGrid = 16 * scale
  const gridStyle = {
    backgroundColor: "#0A0A0A",
    backgroundImage: `
      linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px),
      linear-gradient(to right, rgba(255, 255, 255, 0.025) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(255, 255, 255, 0.025) 1px, transparent 1px),
      radial-gradient(circle, rgba(255, 255, 255, 0.04) 1px, transparent 1px)
    `,
    backgroundSize: `${majorGrid}px ${majorGrid}px, ${majorGrid}px ${majorGrid}px, ${minorGrid}px ${minorGrid}px, ${minorGrid}px ${minorGrid}px, ${minorGrid}px ${minorGrid}px`,
    backgroundPosition: `${pan.x}px ${pan.y}px`,
  }

  return (
    <div
      ref={containerRef}
      className={`relative h-full w-full overflow-hidden ${isPanning || isPanHotkey ? "cursor-grab" : ""}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
      onDoubleClick={handleDoubleClick}
    >
      <div
        className="absolute inset-0"
        style={{
          ...gridStyle,
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          transformOrigin: "0 0",
        }}
      >
        {children({ scale })}
      </div>
      {overlay}
      <div className="absolute bottom-4 right-4 rounded-full border border-[#262626] bg-[#141414]/80 px-3 py-1 text-xs text-[#E5E5E5]">
        {Math.round(scale * 100)}%
      </div>
    </div>
  )
}
