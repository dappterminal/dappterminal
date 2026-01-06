"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { ReactNode } from "react"

type WindowState = {
  x: number
  y: number
  width: number
  height: number
  zIndex: number
}

type DraggableWindowProps = {
  id: string
  title?: string
  scale: number
  defaultPosition: { x: number; y: number }
  defaultSize: { width: number; height: number }
  minSize?: { width: number; height: number }
  showChrome?: boolean
  children: ReactNode
}

const STORAGE_KEY = "dappterminal_windows"

const clamp = (value: number, min: number) => Math.max(min, value)

const isInteractiveElement = (target: EventTarget | null) => {
  const element = target instanceof Element ? target : null
  if (!element) return false
  if (element.closest("[data-no-drag]")) return true
  if (element.closest("button, a, input, textarea, select")) return true
  if (element instanceof HTMLElement && element.isContentEditable) return true
  return false
}

export function DraggableWindow({
  id,
  title,
  scale,
  defaultPosition,
  defaultSize,
  minSize = { width: 520, height: 320 },
  showChrome = true,
  children,
}: DraggableWindowProps) {
  const [position, setPosition] = useState(defaultPosition)
  const [size, setSize] = useState(defaultSize)
  const [zIndex] = useState(10)
  const dragStateRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    originX: number
    originY: number
  } | null>(null)
  const resizeStateRef = useRef<{
    pointerId: number
    direction: string
    startX: number
    startY: number
    originX: number
    originY: number
    originWidth: number
    originHeight: number
  } | null>(null)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) return
      const parsed = JSON.parse(stored) as Record<string, WindowState>
      const saved = parsed[id]
      if (saved) {
        setPosition({ x: saved.x, y: saved.y })
        setSize({ width: saved.width, height: saved.height })
      }
    } catch {
      // Ignore invalid persisted state.
    }
  }, [id])

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      const parsed = stored ? (JSON.parse(stored) as Record<string, WindowState>) : {}
      parsed[id] = { ...position, ...size, zIndex }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))
    } catch {
      // Ignore write errors (storage full or blocked).
    }
  }, [id, position, size, zIndex])

  const handleDragPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    if (!showChrome && isInteractiveElement(event.target)) return
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: position.x,
      originY: position.y,
    }
  }

  const handleDragPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStateRef.current) return
    if (dragStateRef.current.pointerId !== event.pointerId) return
    const dx = (event.clientX - dragStateRef.current.startX) / scale
    const dy = (event.clientY - dragStateRef.current.startY) / scale
    setPosition({
      x: dragStateRef.current.originX + dx,
      y: dragStateRef.current.originY + dy,
    })
  }

  const handleDragPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStateRef.current) return
    if (dragStateRef.current.pointerId !== event.pointerId) return
    dragStateRef.current = null
  }

  const handleResizePointerDown = (event: React.PointerEvent<HTMLDivElement>, direction: string) => {
    if (event.button !== 0) return
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    resizeStateRef.current = {
      pointerId: event.pointerId,
      direction,
      startX: event.clientX,
      startY: event.clientY,
      originX: position.x,
      originY: position.y,
      originWidth: size.width,
      originHeight: size.height,
    }
  }

  const handleResizePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!resizeStateRef.current) return
    if (resizeStateRef.current.pointerId !== event.pointerId) return
    const dx = (event.clientX - resizeStateRef.current.startX) / scale
    const dy = (event.clientY - resizeStateRef.current.startY) / scale

    let nextX = resizeStateRef.current.originX
    let nextY = resizeStateRef.current.originY
    let nextWidth = resizeStateRef.current.originWidth
    let nextHeight = resizeStateRef.current.originHeight

    if (resizeStateRef.current.direction.includes("e")) {
      nextWidth = clamp(resizeStateRef.current.originWidth + dx, minSize.width)
    }
    if (resizeStateRef.current.direction.includes("s")) {
      nextHeight = clamp(resizeStateRef.current.originHeight + dy, minSize.height)
    }
    if (resizeStateRef.current.direction.includes("w")) {
      nextWidth = clamp(resizeStateRef.current.originWidth - dx, minSize.width)
      nextX = resizeStateRef.current.originX + (resizeStateRef.current.originWidth - nextWidth)
    }
    if (resizeStateRef.current.direction.includes("n")) {
      nextHeight = clamp(resizeStateRef.current.originHeight - dy, minSize.height)
      nextY = resizeStateRef.current.originY + (resizeStateRef.current.originHeight - nextHeight)
    }

    setPosition({ x: nextX, y: nextY })
    setSize({ width: nextWidth, height: nextHeight })
  }

  const handleResizePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!resizeStateRef.current) return
    if (resizeStateRef.current.pointerId !== event.pointerId) return
    resizeStateRef.current = null
  }

  const resizeHandles = useMemo(
    () => [
      { dir: "n", className: "left-0 top-[-6px] h-4 w-full cursor-n-resize" },
      { dir: "s", className: "left-0 bottom-[-6px] h-4 w-full cursor-s-resize" },
      { dir: "e", className: "right-[-6px] top-0 h-full w-4 cursor-e-resize" },
      { dir: "w", className: "left-[-6px] top-0 h-full w-4 cursor-w-resize" },
      { dir: "ne", className: "right-[-6px] top-[-6px] h-6 w-6 cursor-ne-resize" },
      { dir: "nw", className: "left-[-6px] top-[-6px] h-6 w-6 cursor-nw-resize" },
      { dir: "se", className: "right-[-6px] bottom-[-6px] h-6 w-6 cursor-se-resize" },
      { dir: "sw", className: "left-[-6px] bottom-[-6px] h-6 w-6 cursor-sw-resize" },
    ],
    []
  )

  return (
    <div
      data-draggable-window
      className={`absolute rounded-xl shadow-2xl ${showChrome ? "border border-[#262626] bg-[#111111]" : "bg-transparent"}`}
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
        width: size.width,
        height: size.height,
        zIndex,
      }}
      onPointerDown={showChrome ? (event) => event.stopPropagation() : handleDragPointerDown}
      onPointerMove={showChrome ? undefined : handleDragPointerMove}
      onPointerUp={showChrome ? undefined : handleDragPointerUp}
      onPointerCancel={showChrome ? undefined : handleDragPointerUp}
    >
      {showChrome ? (
        <div
          className="flex h-8 items-center justify-between rounded-t-xl border-b border-[#262626] bg-[#1a1a1a] px-3 text-xs uppercase tracking-wide text-[#E5E5E5]"
          onPointerDown={handleDragPointerDown}
          onPointerMove={handleDragPointerMove}
          onPointerUp={handleDragPointerUp}
          onPointerCancel={handleDragPointerUp}
          style={{ touchAction: "none" }}
        >
          <span className="font-semibold">{title}</span>
        </div>
      ) : null}
      <div className={`${showChrome ? "h-[calc(100%-2rem)]" : "h-full"} w-full overflow-hidden`} data-window-content>
        {children}
      </div>
      {resizeHandles.map((handle) => (
        <div
          key={handle.dir}
          className={`absolute ${handle.className}`}
          onPointerDown={(event) => handleResizePointerDown(event, handle.dir)}
          onPointerMove={handleResizePointerMove}
          onPointerUp={handleResizePointerUp}
          onPointerCancel={handleResizePointerUp}
          style={{ touchAction: "none" }}
        />
      ))}
    </div>
  )
}
