const STYLES = {
  critical: 'bg-red-500/20 text-red-300 border-red-500/40',
  high: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  warning: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  medium: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
  info: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  low: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
}

export default function SeverityBadge({ severity }) {
  const key = (severity || 'info').toLowerCase()
  const style = STYLES[key] ?? STYLES.info

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase ${style}`}
    >
      {severity}
    </span>
  )
}
