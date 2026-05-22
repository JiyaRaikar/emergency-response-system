import { useMemo } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { Bar, Doughnut, Line } from 'react-chartjs-2'
import {
  fetchAlerts,
  fetchIncidents,
  fetchResources,
  fetchShelters,
} from '../api/endpoints'
import ErrorMessage from '../components/ErrorMessage'
import LoadingSpinner from '../components/LoadingSpinner'
import { useFetch } from '../hooks/useFetch'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
)

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: { color: '#94a3b8' },
    },
  },
  scales: {
    x: {
      ticks: { color: '#94a3b8' },
      grid: { color: 'rgba(51, 65, 85, 0.5)' },
    },
    y: {
      ticks: { color: '#94a3b8' },
      grid: { color: 'rgba(51, 65, 85, 0.5)' },
    },
  },
}

const doughnutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'right',
      labels: { color: '#94a3b8' },
    },
  },
}

function countBy(items, keyFn) {
  const counts = {}
  for (const item of items) {
    const key = keyFn(item)
    counts[key] = (counts[key] || 0) + 1
  }
  return counts
}

export default function Analytics() {
  const loadAll = useMemo(
    () => async () => {
      const [incidents, resources, alerts, shelters] = await Promise.all([
        fetchIncidents(),
        fetchResources(),
        fetchAlerts({ limit: 200 }),
        fetchShelters(),
      ])
      return { incidents, resources, alerts, shelters }
    },
    [],
  )

  const { data, loading, error, reload } = useFetch(loadAll, [loadAll])

  const charts = useMemo(() => {
    if (!data) return null

    const typeCounts = countBy(data.incidents, (i) => i.type.replace(/_/g, ' '))
    const statusCounts = countBy(data.resources, (r) => r.status.replace(/_/g, ' '))

    const alertsByDay = {}
    for (const alert of data.alerts) {
      if (!alert.created_at) continue
      const day = new Date(alert.created_at).toLocaleDateString()
      alertsByDay[day] = (alertsByDay[day] || 0) + 1
    }
    const alertDays = Object.keys(alertsByDay).sort(
      (a, b) => new Date(a) - new Date(b),
    )

    const shelterLabels = data.shelters.map((s) => s.name)
    const shelterOccupancy = data.shelters.map((s) =>
      Math.round((s.current_occupancy / s.capacity) * 100),
    )

    return {
      incidentTypes: {
        labels: Object.keys(typeCounts),
        datasets: [
          {
            label: 'Incidents',
            data: Object.values(typeCounts),
            backgroundColor: [
              'rgba(239, 68, 68, 0.8)',
              'rgba(249, 115, 22, 0.8)',
              'rgba(251, 146, 60, 0.8)',
              'rgba(234, 88, 12, 0.8)',
              'rgba(220, 38, 38, 0.8)',
            ],
          },
        ],
      },
      resourceStatus: {
        labels: Object.keys(statusCounts),
        datasets: [
          {
            data: Object.values(statusCounts),
            backgroundColor: [
              '#22c55e',
              '#f97316',
              '#eab308',
              '#3b82f6',
              '#64748b',
              '#ef4444',
            ],
          },
        ],
      },
      alertsOverTime: {
        labels: alertDays,
        datasets: [
          {
            label: 'Alerts',
            data: alertDays.map((d) => alertsByDay[d]),
            borderColor: '#f97316',
            backgroundColor: 'rgba(249, 115, 22, 0.15)',
            fill: true,
            tension: 0.3,
          },
        ],
      },
      shelterOccupancy: {
        labels: shelterLabels,
        datasets: [
          {
            label: 'Occupancy %',
            data: shelterOccupancy,
            backgroundColor: 'rgba(239, 68, 68, 0.7)',
          },
        ],
      },
    }
  }, [data])

  return (
    <div className="p-6">
      <header className="mb-6">
        <h2 className="text-2xl font-bold text-white">Analytics</h2>
        <p className="text-sm text-slate-400">Operational metrics and trends</p>
      </header>

      {loading && <LoadingSpinner />}
      {error && <ErrorMessage message={error} onRetry={reload} />}

      {!loading && !error && charts && (
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Incident Types">
            <Bar data={charts.incidentTypes} options={chartOptions} />
          </ChartCard>
          <ChartCard title="Resource Status">
            <Doughnut data={charts.resourceStatus} options={doughnutOptions} />
          </ChartCard>
          <ChartCard title="Alerts Over Time">
            <Line data={charts.alertsOverTime} options={chartOptions} />
          </ChartCard>
          <ChartCard title="Shelter Occupancy %">
            <Bar data={charts.shelterOccupancy} options={chartOptions} />
          </ChartCard>
        </div>
      )}
    </div>
  )
}

function ChartCard({ title, children }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
      <h3 className="mb-3 text-sm font-semibold text-orange-400">{title}</h3>
      <div className="h-64">{children}</div>
    </div>
  )
}
