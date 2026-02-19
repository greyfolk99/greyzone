import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Shield, Key, Smartphone, Settings } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

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
        pendingRequests: Array.isArray(requests) ? requests.length : 0,
        totalSecrets: Array.isArray(secrets) ? secrets.length : 0,
        registeredDevices: Array.isArray(devices) ? devices.length : 0,
      })
    } catch (err) {
      console.error('Failed to fetch stats:', err)
    }
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          value={stats.pendingRequests}
          label="대기"
          color="yellow"
        />
        <StatCard
          value={stats.totalSecrets}
          label="시크릿"
          color="green"
        />
        <StatCard
          value={stats.registeredDevices}
          label="기기"
          color="blue"
        />
      </div>

      {/* Quick Actions */}
      <Card>
        <CardContent className="p-4">
          <h2 className="text-sm font-medium text-greyzone-400 mb-3">빠른 작업</h2>
          <div className="grid grid-cols-2 gap-3">
            <QuickAction to="/requests" icon={Shield} label="요청 승인" />
            <QuickAction to="/secrets" icon={Key} label="시크릿" />
            <QuickAction to="/devices" icon={Smartphone} label="기기 등록" />
            <QuickAction to="/settings" icon={Settings} label="설정" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({ value, label, color }: {
  value: number
  label: string
  color: 'yellow' | 'green' | 'blue'
}) {
  const colorClasses = {
    yellow: 'text-yellow-400',
    green: 'text-green-400',
    blue: 'text-blue-400',
  }

  return (
    <Card>
      <CardContent className="p-3 text-center">
        <div className={cn("text-2xl font-bold", colorClasses[color])}>
          {value}
        </div>
        <div className="text-xs text-greyzone-500">{label}</div>
      </CardContent>
    </Card>
  )
}

function QuickAction({ to, icon: Icon, label }: {
  to: string
  icon: React.ElementType
  label: string
}) {
  return (
    <Link
      to={to}
      className="flex flex-col items-center gap-2 p-3 rounded-lg bg-greyzone-800/50 hover:bg-greyzone-800 transition-colors"
    >
      <Icon className="w-5 h-5 text-greyzone-400" />
      <span className="text-xs text-greyzone-300">{label}</span>
    </Link>
  )
}
