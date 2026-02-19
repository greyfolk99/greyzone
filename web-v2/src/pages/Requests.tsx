import { useEffect, useState } from 'react'
import { startAuthentication } from '@simplewebauthn/browser'
import { Check, X, Clock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface Request {
  id: string
  command: string
  reason?: string
  agent?: string
  priority: string
  status: string
  created_at: string
  expires_at: string
}

export default function Requests() {
  const [requests, setRequests] = useState<Request[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'pending' | 'all'>('pending')

  useEffect(() => {
    fetchRequests()
    const interval = setInterval(fetchRequests, 5000)
    return () => clearInterval(interval)
  }, [filter])

  async function fetchRequests() {
    try {
      const url = filter === 'pending' ? '/api/requests?status=pending' : '/api/requests'
      const res = await fetch(url)
      const data = await res.json()
      setRequests(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to fetch requests:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleApprove(id: string) {
    try {
      const authRes = await fetch('/api/auth/start', { method: 'POST' })
      const { challengeId, options } = await authRes.json()
      const credential = await startAuthentication(options)
      
      await fetch(`/api/requests/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId, response: credential }),
      })
      fetchRequests()
    } catch (err) {
      console.error('Approval failed:', err)
      alert('승인 실패: ' + (err as Error).message)
    }
  }

  async function handleDeny(id: string) {
    if (!confirm('거부하시겠습니까?')) return
    try {
      await fetch(`/api/requests/${id}/deny`, { method: 'POST' })
      fetchRequests()
    } catch (err) {
      console.error('Deny failed:', err)
    }
  }

  const pendingCount = requests.filter(r => r.status === 'pending').length

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">요청</h1>
        <div className="flex gap-1">
          <Button
            variant={filter === 'pending' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setFilter('pending')}
          >
            대기 ({pendingCount})
          </Button>
          <Button
            variant={filter === 'all' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            전체
          </Button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center text-greyzone-500 py-12">로딩 중...</div>
      ) : requests.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Clock className="w-12 h-12 mx-auto mb-3 text-greyzone-600" />
            <p className="text-greyzone-500">
              {filter === 'pending' ? '대기 중인 요청 없음' : '요청 없음'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map(request => (
            <RequestCard
              key={request.id}
              request={request}
              onApprove={() => handleApprove(request.id)}
              onDeny={() => handleDeny(request.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function RequestCard({ request, onApprove, onDeny }: {
  request: Request
  onApprove: () => void
  onDeny: () => void
}) {
  const statusVariant: Record<string, "pending" | "approved" | "denied" | "secondary"> = {
    pending: 'pending',
    running: 'pending',
    completed: 'approved',
    failed: 'denied',
    denied: 'denied',
    expired: 'secondary',
  }

  return (
    <Card>
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <Badge variant={statusVariant[request.status] || 'secondary'}>
            {request.status}
          </Badge>
          {request.agent && (
            <span className="text-xs text-greyzone-500">{request.agent}</span>
          )}
          {request.priority === 'high' && (
            <Badge variant="denied">긴급</Badge>
          )}
        </div>

        {/* Command */}
        <div className="font-mono text-sm bg-greyzone-950 rounded-lg p-3 mb-3 overflow-x-auto no-scrollbar">
          {request.command}
        </div>

        {/* Reason */}
        {request.reason && (
          <p className="text-sm text-greyzone-400 mb-3">{request.reason}</p>
        )}

        {/* Actions */}
        {request.status === 'pending' && (
          <div className="flex gap-2">
            <Button variant="approve" className="flex-1" onClick={onApprove}>
              <Check className="w-4 h-4 mr-1" /> 승인
            </Button>
            <Button variant="deny" className="flex-1" onClick={onDeny}>
              <X className="w-4 h-4 mr-1" /> 거부
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
