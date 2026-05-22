import { fetchResources } from '../api/endpoints'
import ErrorMessage from '../components/ErrorMessage'
import LoadingSpinner from '../components/LoadingSpinner'
import StatusBadge from '../components/StatusBadge'
import { useFetch } from '../hooks/useFetch'

export default function Resources() {
  const { data, loading, error, reload } = useFetch(fetchResources, [])

  return (
    <div className="p-6">
      <header className="mb-6">
        <h2 className="text-2xl font-bold text-white">Resources</h2>
        <p className="text-sm text-slate-400">Fleet and equipment status</p>
      </header>

      {loading && <LoadingSpinner />}
      {error && <ErrorMessage message={error} onRetry={reload} />}

      {!loading && !error && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {(data ?? []).map((resource) => (
            <article
              key={resource.id}
              className="rounded-xl border border-slate-700 bg-gradient-to-br from-slate-800/80 to-slate-900/80 p-5 transition hover:border-orange-500/40"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold capitalize text-white">
                  {resource.type.replace(/_/g, ' ')}
                </h3>
                <span className="text-xs text-slate-500">#{resource.id}</span>
              </div>
              <div className="mt-3">
                <StatusBadge status={resource.status} />
              </div>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Zone</dt>
                  <dd className="text-slate-200">{resource.location_zone}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Fuel</dt>
                  <dd className="text-slate-200">
                    {resource.fuel_level != null ? `${resource.fuel_level}%` : '—'}
                  </dd>
                </div>
              </dl>
              {resource.fuel_level != null && (
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-700">
                  <div
                    className={`h-full rounded-full ${
                      resource.fuel_level < 30
                        ? 'bg-red-500'
                        : resource.fuel_level < 60
                          ? 'bg-orange-500'
                          : 'bg-emerald-500'
                    }`}
                    style={{ width: `${resource.fuel_level}%` }}
                  />
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {!loading && !error && data?.length === 0 && (
        <p className="text-center text-slate-500">No resources available.</p>
      )}
    </div>
  )
}
