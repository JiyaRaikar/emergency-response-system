import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import CommandBox from '../CommandBox'

/** Reserve space for the fixed command bar (portaled to body). */
const COMMAND_BAR_PADDING = '5.5rem'

export default function Layout() {
  return (
    <div className="min-h-screen bg-[#0f172a]">
      <Sidebar />
      <main
        className="ml-64 min-h-screen"
        style={{ paddingBottom: COMMAND_BAR_PADDING }}
      >
        <Outlet />
      </main>
      <CommandBox />
    </div>
  )
}
