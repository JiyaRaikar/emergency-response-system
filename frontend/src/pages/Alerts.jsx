import { fetchAlerts } from '../api/endpoints'
import ErrorMessage from '../components/ErrorMessage'
import LoadingSpinner from '../components/LoadingSpinner'
import SeverityBadge from '../components/SeverityBadge'
import { useFetch } from '../hooks/useFetch'

const SEVERITY_BORDER = {
  critical: 'border-l-red-500',
  warning: 'border-l-amber-500',
  info: 'border-l-sky-500',
}

export default function Alerts() {
  const { data, loading, error, reload } = useFetch(
    () => fetchAlerts({ limit: 200 }),
    [],
  )

  return (
    <div className="p-6">
      <header className="mb-6">
        <h2 className="text-2xl font-bold text-white">Alerts</h2>
        <p className="text-sm text-slate-400">System and operator notifications</p>
      </header>

      {loading && <LoadingSpinner />}
      {error && <ErrorMessage message={error} onRetry={reload} />}

      {!loading && !error && (
        <ul className="space-y-3">
          {(data ?? []).map((alert) => (
            <li
              key={alert.id}
              className={`rounded-xl border border-slate-700 border-l-4 bg-slate-800/50 px-5 py-4 ${
                SEVERITY_BORDER[alert.severity] ?? 'border-l-slate-500'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium uppercase text-slate-500">
                      {alert.type}
                    </span>
                    {alert.auto_generated && (
                      <span className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-400">
                        AUTO
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-white">{alert.message}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    {alert.created_at
                      ? new Date(alert.created_at).toLocaleString()
                      : '—'}
                  </p>
                </div>
                <SeverityBadge severity={alert.severity} />
              </div>
            </li>
          ))}
        </ul>
      )}

      {!loading && !error && data?.length === 0 && (
        <p className="text-center text-slate-500">No alerts at this time.</p>
      )}
    </div>
  )
}
