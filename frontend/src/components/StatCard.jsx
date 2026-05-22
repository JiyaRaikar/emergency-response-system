export default function StatCard({ label, value, icon, accent = 'orange' }) {
  const accentClass =
    accent === 'red'
      ? 'from-red-600/20 to-red-900/10 border-red-500/30 text-red-400'
      : 'from-orange-600/20 to-orange-900/10 border-orange-500/30 text-orange-400'

  return (
    <div
      className={`rounded-xl border bg-gradient-to-br p-5 ${accentClass}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
            {label}
          </p>
          <p className="mt-2 text-3xl font-bold text-white">{value ?? '—'}</p>
        </div>
        {icon && <span className="text-2xl opacity-80">{icon}</span>}
      </div>
    </div>
  )
}
