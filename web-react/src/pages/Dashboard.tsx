import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

interface Stats {
  pendingRequests: number
  totalSecrets: number
  registeredDevices: number
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    pendingRequests: 0,
    totalSecrets: 0,
    registeredDevices: 0
  })

  useEffect(() => {
    fetchStats()
  }, [])

  async function fetchStats() {
    try {
      const [requests, secrets, devices] = await Promise.all([
        fetch('/api/requests?status=pending').then(r => r.json()),
        fetch('/api/secrets').then(r => r.json()),
        fetch('/api/devices').then(r => r.json()),
      ])
      setStats({
        pendingRequests: requests.length || 0,
        totalSecrets: secrets.length || 0,
        registeredDevices: devices.length || 0,
      })
    } catch (err) {
      console.error('Failed to fetch stats:', err)
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">대시보드</h1>

      <div className="grid grid-cols-3 gap-3">
        <StatCard
          icon="🔐"
          label="대기"
          value={stats.pendingRequests}
          color="yellow"
        />
        <StatCard
          icon="🔑"
          label="시크릿"
          value={stats.totalSecrets}
          color="green"
        />
        <StatCard
          icon="📱"
          label="기기"
          value={stats.registeredDevices}
          color="blue"
        />
      </div>

      <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="font-semibold mb-3">빠른 작업</h2>
        <div className="grid grid-cols-2 gap-3">
          <QuickAction to="/requests" icon="✅" label="요청 승인" />
          <QuickAction to="/tokens" icon="🔑" label="시크릿" />
          <QuickAction to="/devices" icon="📱" label="기기 등록" />
          <QuickAction to="/settings" icon="⚙️" label="설정" />
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, color }: {
  icon: string
  label: string
  value: number
  color: 'yellow' | 'green' | 'blue'
}) {
  const colorClasses = {
    yellow: 'bg-yellow-500/20 text-yellow-400',
    green: 'bg-green-500/20 text-green-400',
    blue: 'bg-blue-500/20 text-blue-400',
  }

  return (
    <div className="bg-gray-800 rounded-lg p-3 text-center">
      <div className={`w-10 h-10 mx-auto rounded-lg ${colorClasses[color]} flex items-center justify-center text-xl mb-2`}>
        {icon}
      </div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-gray-400">{label}</div>
    </div>
  )
}

function QuickAction({ to, icon, label }: { to: string; icon: string; label: string }) {
  return (
    <Link
      to={to}
      className="bg-gray-700 hover:bg-gray-600 rounded-lg p-3 text-center transition"
    >
      <div className="text-xl mb-1">{icon}</div>
      <div className="text-xs">{label}</div>
    </Link>
  )
}
