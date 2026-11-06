import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

export default function Sheet({ title, subtitle, onClose, children, footer }) {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const host = typeof document === 'undefined' ? null : document.getElementById('app-shell')
  if (!host) return null

  return createPortal(
    <div className="absolute inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-[#241B1C]/45 backdrop-blur-[1px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="sheet-panel relative flex max-h-[90%] flex-col overflow-hidden rounded-t-[26px] bg-white shadow-lift"
      >
        <div className="shrink-0 border-b border-black/[0.05] bg-white px-5 pb-3 pt-2.5">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-black/15" />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate font-serif text-[19px] leading-tight text-ink">{title}</h2>
              {subtitle ? <p className="mt-1 text-xs text-steel">{subtitle}</p> : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close sheet"
              className="-mr-1 shrink-0 rounded-full p-1.5 text-steel transition active:bg-black/5"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
        {footer ? (
          <div className="shrink-0 border-t border-black/[0.05] bg-white px-5 pb-safe pt-3">{footer}</div>
        ) : null}
      </div>
    </div>,
    host
  )
}
