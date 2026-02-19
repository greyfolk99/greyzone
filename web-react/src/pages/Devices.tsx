import { useEffect, useState } from 'react'
import { startRegistration } from '@simplewebauthn/browser'

interface Device {
  id: string
  name: string
  user_agent?: string
  registered_at: string
  last_used_at?: string
}

export default function Devices() {
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [registering, setRegistering] = useState(false)
  const [newDeviceName, setNewDeviceName] = useState('')
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    fetchDevices()
  }, [])

  async function fetchDevices() {
    try {
      const res = await fetch('/api/devices')
      const data = await res.json()
      setDevices(data)
    } catch (err) {
      console.error('Failed to fetch devices:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister() {
    if (!newDeviceName.trim()) {
      alert('디바이스 이름을 입력하세요')
      return
    }

    setRegistering(true)
    try {
      const startRes = await fetch('/api/devices/register/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newDeviceName }),
      })
      const { challengeId, options } = await startRes.json()

      const credential = await startRegistration(options)

      await fetch('/api/devices/register/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId,
          response: credential,
          deviceName: newDeviceName,
          userAgent: navigator.userAgent,
        }),
      })

      setNewDeviceName('')
      setShowForm(false)
      fetchDevices()
    } catch (err) {
      console.error('Registration failed:', err)
      alert('등록 실패: ' + (err as Error).message)
    } finally {
      setRegistering(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('삭제하시겠습니까?')) return
    
    try {
      await fetch(`/api/devices/${id}`, { method: 'DELETE' })
      fetchDevices()
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold">기기 관리</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm"
        >
          {showForm ? '취소' : '+ 등록'}
        </button>
      </div>

      {/* Register Form */}
      {showForm && (
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="space-y-3">
            <input
              type="text"
              value={newDeviceName}
              onChange={e => setNewDeviceName(e.target.value)}
              placeholder="디바이스 이름"
              className="w-full px-4 py-3 bg-gray-700 rounded-lg text-base outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleRegister}
              disabled={registering}
              className="w-full py-3 bg-green-600 hover:bg-green-500 rounded-lg font-medium disabled:opacity-50"
            >
              {registering ? '등록 중...' : '🔑 등록하기'}
            </button>
          </div>
        </div>
      )}

      {/* Device List */}
      {loading ? (
        <div className="text-center text-gray-400 py-8">로딩 중...</div>
      ) : devices.length === 0 ? (
        <div className="text-center text-gray-400 py-8">
          등록된 기기가 없습니다
        </div>
      ) : (
        <div className="space-y-3">
          {devices.map(device => (
            <div key={device.id} className="bg-gray-800 rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">📱</span>
                    <span className="font-medium truncate">{device.name}</span>
                  </div>
                  <div className="text-xs text-gray-400 space-y-0.5">
                    <div>등록: {new Date(device.registered_at).toLocaleDateString('ko-KR')}</div>
                    {device.last_used_at && (
                      <div>최근: {new Date(device.last_used_at).toLocaleDateString('ko-KR')}</div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(device.id)}
                  className="px-3 py-1 bg-red-600 hover:bg-red-500 rounded text-xs flex-shrink-0"
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
