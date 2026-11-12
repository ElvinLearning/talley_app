import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

/**
 * A dialog: slides up from the bottom on phones, centred on larger screens.
 * Keeps keyboard focus inside while open and returns it to where it was on close.
 */
export default function Sheet({ title, subtitle, onClose, children, footer }) {
  const panel = useRef(null)
  const close = useRef(onClose)
  close.current = onClose

  useEffect(() => {
    const opener = document.activeElement
    const node = panel.current
    // Honour an explicit autoFocus inside the sheet; otherwise start at the top.
    if (node && !node.contains(document.activeElement)) {
      const first = node.querySelector('[data-autofocus]') || node.querySelector('input,select,textarea') || node
      first.focus()
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        close.current()
        return
      }
      if (event.key !== 'Tab' || !node) return
      const items = [...node.querySelectorAll(FOCUSABLE)].filter((element) => element.offsetParent !== null)
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && (document.activeElement === first || !node.contains(document.activeElement))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      if (opener instanceof HTMLElement && document.contains(opener)) opener.focus()
    }
  }, [])

  const host = typeof document === 'undefined' ? null : document.getElementById('app-shell')
  if (!host) return null

  return createPortal(
    <div className="no-print absolute inset-0 z-50 flex flex-col justify-end md:justify-center md:p-6">
      <div aria-hidden="true" onClick={onClose} className="fade-in absolute inset-0 bg-ink/45" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="sheet-panel relative flex max-h-[92%] flex-col overflow-hidden rounded-t-2xl bg-white shadow-lift outline-none md:rounded-2xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate font-serif text-xl leading-tight text-ink">{title}</h2>
            {subtitle ? <p className="mt-1 text-sm text-steel">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 -mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-steel hover:bg-sand"
          >
            <X size={19} aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
        {footer ? <div className="shrink-0 border-t border-line bg-white px-5 pb-safe pt-3 md:pb-3">{footer}</div> : null}
      </div>
    </div>,
    host
  )
}
