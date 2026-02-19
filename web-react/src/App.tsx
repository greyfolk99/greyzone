import { Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect, createContext, useContext } from 'react'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Requests from './pages/Requests'
import Tokens from './pages/Tokens'
import Devices from './pages/Devices'
import Settings from './pages/Settings'
import Setup from './pages/Setup'
import SecretInput from './pages/SecretInput'

interface AppContextType {
  hasDevices: boolean
  refreshDevices: () => Promise<void>
}

const AppContext = createContext<AppContextType>({
  hasDevices: false,
  refreshDevices: async () => {}
})

export const useApp = () => useContext(AppContext)

export default function App() {
  const [hasDevices, setHasDevices] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

  async function checkDevices() {
    try {
      const res = await fetch('/api/devices')
      const devices = await res.json()
      setHasDevices(devices.length > 0)
    } catch (err) {
      console.error('Failed to check devices:', err)
      setHasDevices(false)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    checkDevices()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-xl">로딩 중...</div>
      </div>
    )
  }

  // 디바이스 없으면 Setup 페이지로
  if (hasDevices === false) {
    return (
      <AppContext.Provider value={{ hasDevices: false, refreshDevices: checkDevices }}>
        <Routes>
          <Route path="/setup" element={<Setup />} />
          <Route path="*" element={<Navigate to="/setup" replace />} />
        </Routes>
      </AppContext.Provider>
    )
  }

  return (
    <AppContext.Provider value={{ hasDevices: true, refreshDevices: checkDevices }}>
      <Routes>
        <Route path="/setup" element={<Navigate to="/" replace />} />
        <Route path="/secrets/new" element={<SecretInput />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="requests" element={<Requests />} />
          <Route path="tokens" element={<Tokens />} />
          <Route path="devices" element={<Devices />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </AppContext.Provider>
  )
}
