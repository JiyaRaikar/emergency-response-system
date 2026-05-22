import { useState } from 'react'
import { createIncident, fetchIncidents } from '../api/endpoints'
import ErrorMessage from '../components/ErrorMessage'
import LoadingSpinner from '../components/LoadingSpinner'
import SeverityBadge from '../components/SeverityBadge'
import StatusBadge from '../components/StatusBadge'
import { useFetch } from '../hooks/useFetch'

const SEVERITIES = ['low', 'medium', 'high', 'critical']
const STATUSES = ['open', 'assigned', 'in_progress', 'resolved', 'closed']
const ZONES = ['north', 'east', 'central', 'south', 'west']

const emptyForm = {
  type: '',
  severity: 'medium',
  location_zone: 'central',
  status: 'open',
}

export default function Incidents() {
  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  const { data, loading, error, reload } = useFetch(fetchIncidents, [])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setSubmitError(null)
    try {
      await createIncident(form)
      setForm(emptyForm)
      reload()
    } catch (err) {
      setSubmitError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-6">
      <header className="mb-6">
        <h2 className="text-2xl font-bold text-white">Incidents</h2>
        <p className="text-sm text-slate-400">Manage and report incidents</p>
      </header>

      <div className="mb-8 rounded-xl border border-slate-700 bg-slate-800/50 p-5">
        <h3 className="mb-4 font-semibold text-orange-400">Create New Incident</h3>
        {submitError && <ErrorMessage message={submitError} />}
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-sm">
            <span className="text-slate-400">Type</span>
            <input
              name="type"
              value={form.type}
              onChange={handleChange}
              required
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white"
              placeholder="e.g. wildfire"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-400">Severity</span>
            <select
              name="severity"
              value={form.severity}
              onChange={handleChange}
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white"
            >
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-slate-400">Zone</span>
            <select
              name="location_zone"
              value={form.location_zone}
              onChange={handleChange}
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white"
            >
              {ZONES.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-slate-400">Status</span>
            <select
              name="status"
              value={form.status}
              onChange={handleChange}
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-2 lg:col-span-4">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-gradient-to-r from-red-600 to-orange-500 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Incident'}
            </button>
          </div>
        </form>
      </div>

      {loading && <LoadingSpinner />}
      {error && <ErrorMessage message={error} onRetry={reload} />}

      {!loading && !error && (
        <div className="overflow-x-auto rounded-xl border border-slate-700">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-slate-700 bg-slate-800/80 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">Zone</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-slate-700/50 hover:bg-slate-800/40"
                >
                  <td className="px-4 py-3 text-slate-300">#{row.id}</td>
                  <td className="px-4 py-3 font-medium text-white">{row.type}</td>
                  <td className="px-4 py-3">
                    <SeverityBadge severity={row.severity} />
                  </td>
                  <td className="px-4 py-3 text-slate-300">{row.location_zone}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {row.created_at
                      ? new Date(row.created_at).toLocaleString()
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data?.length === 0 && (
            <p className="p-6 text-center text-slate-500">No incidents found.</p>
          )}
        </div>
      )}
    </div>
  )
}
