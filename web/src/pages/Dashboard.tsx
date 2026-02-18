import { useEffect, useState } from 'react'

interface Stats {
  pendingRequests: number
  totalTokens: number
  registeredDevices: number
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    pendingRequests: 0,
    totalTokens: 0,
    registeredDevices: 0
  })

  useEffect(() => {
    // TODO: Fetch real stats
    fetchStats()
  }, [])

  async function fetchStats() {
    try {
      const [requests, tokens, devices] = await Promise.all([
        fetch('/api/requests?status=pending').then(r => r.json()),
        fetch('/api/tokens').then(r => r.json()),
        fetch('/api/devices').then(r => r.json()),
      ])
      setStats({
        pendingRequests: requests.length || 0,
        totalTokens: tokens.length || 0,
        registeredDevices: devices.length || 0,
      })
    } catch (err) {
      console.error('Failed to fetch stats:', err)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">대시보드</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard
          icon="🔐"
          label="대기 중인 요청"
          value={stats.pendingRequests}
          color="yellow"
        />
        <StatCard
          icon="🔑"
          label="등록된 토큰"
          value={stats.totalTokens}
          color="green"
        />
        <StatCard
          icon="📱"
          label="등록된 디바이스"
          value={stats.registeredDevices}
          color="blue"
        />
      </div>

      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">빠른 작업</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <QuickAction href="/requests" icon="✅" label="요청 승인" />
          <QuickAction href="/tokens" icon="➕" label="토큰 추가" />
          <QuickAction href="/devices" icon="📱" label="디바이스 등록" />
          <QuickAction href="/settings" icon="⚙️" label="설정" />
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
    <div className="bg-gray-800 rounded-lg p-6">
      <div className={`w-12 h-12 rounded-lg ${colorClasses[color]} flex items-center justify-center text-2xl mb-4`}>
        {icon}
      </div>
      <div className="text-3xl font-bold mb-1">{value}</div>
      <div className="text-gray-400">{label}</div>
    </div>
  )
}

function QuickAction({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <a
      href={href}
      className="bg-gray-700 hover:bg-gray-600 rounded-lg p-4 text-center transition"
    >
      <div className="text-2xl mb-2">{icon}</div>
      <div className="text-sm">{label}</div>
    </a>
  )
}
