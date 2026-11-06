import { Building2, ClipboardList, TrendingUp, Users } from 'lucide-react'

const TABS = [
  { key: 'projects', label: 'Projects', Icon: Building2 },
  { key: 'board', label: 'Board', Icon: ClipboardList },
  { key: 'crew', label: 'Crew', Icon: Users },
  { key: 'overview', label: 'Overview', Icon: TrendingUp },
]

export default function BottomNav({ active, onChange, boardDisabled = false }) {
  return (
    <nav className="relative z-20 shrink-0 border-t border-black/[0.07] bg-white/95 backdrop-blur pb-safe">
      <div className="flex items-stretch justify-around px-1.5 pt-1.5">
        {TABS.map(({ key, label, Icon }) => {
          const isActive = active === key
          const disabled = key === 'board' && boardDisabled
          return (
            <button
              key={key}
              type="button"
              onClick={() => !disabled && onChange(key)}
              aria-current={isActive ? 'page' : undefined}
              disabled={disabled}
              className={`flex flex-1 flex-col items-center gap-1 rounded-xl px-1 py-1.5 transition ${
                isActive ? 'bg-maroon-tint' : 'active:bg-black/[0.04]'
              } ${disabled ? 'opacity-40' : ''}`}
            >
              <Icon
                size={19}
                strokeWidth={isActive ? 2.3 : 1.8}
                className={isActive ? 'text-maroon' : 'text-steel'}
              />
              <span
                className={`text-[10px] font-semibold tracking-[0.01em] ${
                  isActive ? 'text-maroon' : 'text-steel'
                }`}
              >
                {label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
