const STYLES = {
  available: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  dispatched: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  en_route: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  on_scene: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  maintenance: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
  offline: 'bg-red-500/20 text-red-300 border-red-500/40',
  open: 'bg-red-500/20 text-red-300 border-red-500/40',
  assigned: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  in_progress: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  resolved: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  closed: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
}

export default function StatusBadge({ status }) {
  const key = (status || 'unknown').toLowerCase().replace(/\s+/g, '_')
  const style = STYLES[key] ?? 'bg-slate-500/20 text-slate-300 border-slate-500/40'

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${style}`}
    >
      {(status || 'unknown').replace(/_/g, ' ')}
    </span>
  )
}
