import { useCallback, useState } from 'react'
import {
  fetchAlerts,
  fetchIncidents,
  fetchResources,
  fetchShelters,
} from '../api/endpoints'
import ErrorMessage from '../components/ErrorMessage'
import IncidentMap from '../components/IncidentMap'
import LoadingSpinner from '../components/LoadingSpinner'
import SeverityBadge from '../components/SeverityBadge'
import StatCard from '../components/StatCard'
import { useFetch } from '../hooks/useFetch'
import { useWebSocket } from '../hooks/useWebSocket'

function feedLabel(event) {
  if (event.event === 'connected') return event.message
  if (event.event === 'incident') {
    const d = event.data
    return `Incident ${event.action}: ${d?.type} (${d?.severity}) in ${d?.location_zone}`
  }
  if (event.event === 'alert') return `Alert [${event.severity}]: ${event.message}`
  if (event.event === 'dispatch') {
    return `Dispatch: ${event.action} — incident #${event.incident_id}`
  }
  return JSON.stringify(event)
}

export default function Dashboard() {
  const [feed, setFeed] = useState([])

  const loadAll = useCallback(async () => {
    const [incidents, resources, alerts, shelters] = await Promise.all([
      fetchIncidents(),
      fetchResources(),
      fetchAlerts({ limit: 200 }),
      fetchShelters(),
    ])
    return { incidents, resources, alerts, shelters }
  }, [])

  const { data, loading, error, reload } = useFetch(loadAll, [loadAll])

  const onWsMessage = useCallback((event) => {
    setFeed((prev) => [
      { id: Date.now() + Math.random(), time: new Date(), event },
      ...prev.slice(0, 49),
    ])
    if (event.event === 'incident' || event.event === 'alert' || event.event === 'dispatch') {
      reload()
    }
  }, [reload])

  const { status: wsStatus, error: wsError, reconnect } = useWebSocket(onWsMessage)

  const wsStatusLabel =
    wsStatus === 'connected'
      ? '● Live'
      : wsStatus === 'reconnecting'
        ? '○ Reconnecting...'
        : wsStatus === 'connecting'
          ? '○ Connecting...'
          : '○ Disconnected'

  const wsStatusClass =
    wsStatus === 'connected'
      ? 'text-emerald-400'
      : wsStatus === 'reconnecting' || wsStatus === 'connecting'
        ? 'text-amber-400'
        : 'text-red-400'

  const incidents = data?.incidents ?? []
  const resources = data?.resources ?? []
  const alerts = data?.alerts ?? []
  const shelters = data?.shelters ?? []

  const activeResources = resources.filter(
    (r) => !['offline', 'maintenance'].includes(r.status),
  ).length

  return (
    <div className="p-6">
      <header className="mb-6">
        <h2 className="text-2xl font-bold text-white">Operations Dashboard</h2>
        <p className="text-sm text-slate-400">Real-time situational overview</p>
      </header>

      {loading && <LoadingSpinner label="Loading dashboard..." />}
      {error && <ErrorMessage message={error} onRetry={reload} />}

      {!loading && !error && data && (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total Incidents" value={incidents.length} icon="🚨" accent="red" />
            <StatCard label="Active Resources" value={activeResources} icon="🚑" />
            <StatCard label="Alerts" value={alerts.length} icon="⚠️" accent="red" />
            <StatCard label="Shelters" value={shelters.length} icon="🏠" />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold text-white">Live Incident Feed</h3>
                <span className={`text-xs font-medium ${wsStatusClass}`}>
                  {wsStatusLabel}
                </span>
              </div>
              {wsError && (
                <p className="mb-2 text-xs text-red-300">
                  {wsError}{' '}
                  <button type="button" onClick={reconnect} className="underline">
                    Reconnect
                  </button>
                </p>
              )}
              <ul className="max-h-80 space-y-2 overflow-y-auto">
                {feed.length === 0 && (
                  <li className="text-sm text-slate-500">
                    Waiting for WebSocket events...
                  </li>
                )}
                {feed.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm"
                  >
                    <span className="text-xs text-slate-500">
                      {item.time.toLocaleTimeString()}
                    </span>
                    <p className="mt-0.5 text-slate-200">{feedLabel(item.event)}</p>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
              <h3 className="mb-3 font-semibold text-white">Operations Map</h3>
              <div className="h-80">
                <IncidentMap incidents={incidents} resources={resources} />
              </div>
              <div className="mt-2 flex gap-4 text-xs text-slate-400">
                <span>
                  <span className="inline-block h-2 w-2 rounded-full bg-red-500" /> Incidents
                </span>
                <span>
                  <span className="inline-block h-2 w-2 rounded-full bg-blue-500" /> Resources
                </span>
              </div>
            </section>
          </div>

          <section className="mt-6 rounded-xl border border-slate-700 bg-slate-800/50 p-4">
            <h3 className="mb-3 font-semibold text-white">Recent Alerts</h3>
            <ul className="space-y-2">
              {alerts.slice(0, 5).map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-slate-900/50 px-3 py-2 text-sm"
                >
                  <span className="text-slate-200">{a.message}</span>
                  <SeverityBadge severity={a.severity} />
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  )
}
