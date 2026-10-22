"use client"

import * as React from "react"
import { createPortal } from "react-dom"

import { cn } from "@/lib/utils"

interface TooltipProps {
  /** Tooltip text. When empty/null/false, children render untouched (no wrapper). */
  content?: React.ReactNode | null | false
  children: React.ReactNode
  /**
   * Set when the child is a disabled control. Disabled buttons emit no pointer
   * events, so the child is wrapped in a focusable span that owns the tooltip.
   */
  disabled?: boolean
  side?: "top" | "bottom"
  /** Classes for the wrapper span (e.g. "w-full" / "block" for full-width buttons). */
  className?: string
}

/**
 * Dependency-free tooltip. Shows on hover and keyboard focus; on touch, a tap
 * toggles it and it auto-hides. Rendered in a portal so overflow clipping
 * never hides it.
 */
function Tooltip({ content, children, disabled = false, side = "top", className }: TooltipProps) {
  const id = React.useId()
  const wrapperRef = React.useRef<HTMLSpanElement>(null)
  const [open, setOpen] = React.useState(false)
  const [pos, setPos] = React.useState<{ x: number; y: number; below: boolean } | null>(null)
  const hideTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const place = React.useCallback(() => {
    const el = wrapperRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const below = side === "bottom" || r.top < 64
    const half = 130
    const x = Math.min(Math.max(r.left + r.width / 2, half + 8), window.innerWidth - half - 8)
    setPos({ x, y: below ? r.bottom + 8 : r.top - 8, below })
  }, [side])

  const show = React.useCallback(() => {
    place()
    setOpen(true)
  }, [place])
  const hide = React.useCallback(() => setOpen(false), [])

  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    window.addEventListener("keydown", onKey)
    window.addEventListener("scroll", hide, true)
    window.addEventListener("resize", hide)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("scroll", hide, true)
      window.removeEventListener("resize", hide)
    }
  }, [open, hide])

  React.useEffect(() => () => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
  }, [])

  if (!content) return <>{children}</>

  const onTouch = (e: React.PointerEvent) => {
    if (e.pointerType !== "touch") return
    show()
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(hide, 3500)
  }

  return (
    <span
      ref={wrapperRef}
      className={cn("inline-flex", className)}
      tabIndex={disabled ? 0 : undefined}
      aria-describedby={open ? id : undefined}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onPointerDown={onTouch}
    >
      {children}
      {open && pos && typeof document !== "undefined"
        ? createPortal(
            <span
              id={id}
              role="tooltip"
              style={{ left: pos.x, top: pos.y }}
              className={cn(
                "pointer-events-none fixed z-[100] w-max max-w-[260px] -translate-x-1/2 rounded-md bg-foreground px-3 py-1.5 text-center text-xs font-medium leading-snug text-background shadow-lg",
                pos.below ? "" : "-translate-y-full"
              )}
            >
              {content}
            </span>,
            document.body
          )
        : null}
    </span>
  )
}

export { Tooltip }
