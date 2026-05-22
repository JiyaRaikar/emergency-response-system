import { NavLink } from 'react-router-dom'
import { API_URL } from '../../config'

const NAV = [
  { to: '/', label: 'Dashboard', icon: '📊' },
  { to: '/incidents', label: 'Incidents', icon: '🚨' },
  { to: '/resources', label: 'Resources', icon: '🚑' },
  { to: '/alerts', label: 'Alerts', icon: '⚠️' },
  { to: '/analytics', label: 'Analytics', icon: '📈' },
]

export default function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 z-50 flex h-full w-64 flex-col border-r border-slate-700 bg-slate-900">
      <div className="border-b border-slate-700 px-5 py-6">
        <h1 className="text-lg font-bold tracking-tight text-white">
          <span className="text-red-500">EMERGENCY</span>
          <span className="text-orange-400"> OPS</span>
        </h1>
        <p className="mt-1 text-xs text-slate-500">Operations Center</p>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {NAV.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                isActive
                  ? 'bg-gradient-to-r from-red-600/30 to-orange-500/20 text-orange-300 border border-orange-500/30'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <span>{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-slate-700 p-4 text-xs text-slate-500">
        API: {API_URL}
      </div>
    </aside>
  )
}
