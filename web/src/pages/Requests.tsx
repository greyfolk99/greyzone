import { useEffect, useState } from 'react'
import { startAuthentication } from '@simplewebauthn/browser'

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
      setRequests(data)
    } catch (err) {
      console.error('Failed to fetch requests:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleApprove(id: string) {
    try {
      // Start WebAuthn authentication
      const authRes = await fetch('/api/auth/start', { method: 'POST' })
      const { challengeId, options } = await authRes.json()

      const credential = await startAuthentication(options)

      // Approve with credential
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
    if (!confirm('정말 거부하시겠습니까?')) return
    
    try {
      await fetch(`/api/requests/${id}/deny`, { method: 'POST' })
      fetchRequests()
    } catch (err) {
      console.error('Deny failed:', err)
    }
  }

  const pendingRequests = requests.filter(r => r.status === 'pending')

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">요청 관리</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('pending')}
            className={`px-4 py-2 rounded-lg ${filter === 'pending' ? 'bg-blue-600' : 'bg-gray-700'}`}
          >
            대기 중 ({pendingRequests.length})
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg ${filter === 'all' ? 'bg-blue-600' : 'bg-gray-700'}`}
          >
            전체
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-12">로딩 중...</div>
      ) : requests.length === 0 ? (
        <div className="text-center text-gray-400 py-12">
          {filter === 'pending' ? '대기 중인 요청이 없습니다' : '요청이 없습니다'}
        </div>
      ) : (
        <div className="space-y-4">
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
  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400',
    running: 'bg-blue-500/20 text-blue-400',
    completed: 'bg-green-500/20 text-green-400',
    failed: 'bg-red-500/20 text-red-400',
    denied: 'bg-gray-500/20 text-gray-400',
    expired: 'bg-gray-500/20 text-gray-400',
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`px-2 py-1 rounded text-xs ${statusColors[request.status]}`}>
              {request.status}
            </span>
            {request.priority === 'high' && (
              <span className="px-2 py-1 rounded text-xs bg-red-500/20 text-red-400">
                높음
              </span>
            )}
          </div>
          <code className="text-sm text-gray-300 bg-gray-900 px-2 py-1 rounded">
            {request.command}
          </code>
        </div>
        {request.status === 'pending' && (
          <div className="flex gap-2">
            <button
              onClick={onApprove}
              className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm"
            >
              ✅ 승인
            </button>
            <button
              onClick={onDeny}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-sm"
            >
              ❌ 거부
            </button>
          </div>
        )}
      </div>
      
      <div className="text-sm text-gray-400">
        {request.reason && <div>사유: {request.reason}</div>}
        {request.agent && <div>에이전트: {request.agent}</div>}
        <div>생성: {new Date(request.created_at).toLocaleString('ko-KR')}</div>
      </div>
    </div>
  )
}
