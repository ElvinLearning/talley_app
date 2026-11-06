export function LogoMark({ size = 34, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label="A.E. Talley Construction"
    >
      <rect width="100" height="100" rx="20" fill="#6D2431" />
      <rect x="23" y="19" width="17" height="35" fill="#9C9C9C" />
      <rect x="42" y="12" width="19" height="42" fill="#808080" />
      <rect x="62" y="23" width="14" height="31" fill="#9C9C9C" />
      <g stroke="#FFFFFF" fill="none" strokeLinecap="square">
        <path d="M15 66 L50 46 L85 66" strokeWidth="4.5" />
        <path d="M22 73 L50 57 L78 73" strokeWidth="3.2" opacity="0.9" />
        <path d="M30 80 L50 68 L70 80" strokeWidth="3" opacity="0.72" />
      </g>
    </svg>
  )
}

export function Wordmark({ className = '', tone = 'text-ink' }) {
  return (
    <div className={`select-none leading-none ${className}`}>
      <p className={`font-serif text-[13px] tracking-[0.3em] ${tone}`}>A E TALLEY</p>
      <p className={`mt-[3px] text-[7.5px] font-semibold tracking-[0.28em] ${tone} opacity-70`}>
        CONSTRUCTION
      </p>
    </div>
  )
}

export default function Logo({ size = 34, wordmark = true, tone = 'text-ink', className = '' }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      {wordmark ? <Wordmark tone={tone} /> : null}
    </div>
  )
}
