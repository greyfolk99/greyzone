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
      // Start registration
      const startRes = await fetch('/api/devices/register/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newDeviceName }),
      })
      const { challengeId, options } = await startRes.json()

      // WebAuthn registration
      const credential = await startRegistration(options)

      // Complete registration
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
      fetchDevices()
      alert('디바이스 등록 완료!')
    } catch (err) {
      console.error('Registration failed:', err)
      alert('등록 실패: ' + (err as Error).message)
    } finally {
      setRegistering(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('정말 삭제하시겠습니까?')) return
    
    try {
      await fetch(`/api/devices/${id}`, { method: 'DELETE' })
      fetchDevices()
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">디바이스 관리</h1>

      {/* Register new device */}
      <div className="bg-gray-800 rounded-lg p-4 mb-6">
        <h2 className="text-lg font-semibold mb-3">새 디바이스 등록</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={newDeviceName}
            onChange={e => setNewDeviceName(e.target.value)}
            placeholder="디바이스 이름 (예: iPhone, MacBook)"
            className="flex-1 px-4 py-2 bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <button
            onClick={handleRegister}
            disabled={registering}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg disabled:opacity-50"
          >
            {registering ? '등록 중...' : '등록'}
          </button>
        </div>
        <p className="text-sm text-gray-400 mt-2">
          Face ID, Touch ID, 또는 보안 키를 사용하여 디바이스를 등록합니다.
        </p>
      </div>

      {/* Device list */}
      {loading ? (
        <div className="text-center text-gray-400 py-12">로딩 중...</div>
      ) : devices.length === 0 ? (
        <div className="text-center text-gray-400 py-12">
          등록된 디바이스가 없습니다
        </div>
      ) : (
        <div className="space-y-4">
          {devices.map(device => (
            <div key={device.id} className="bg-gray-800 rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">📱</span>
                    <span className="font-semibold">{device.name}</span>
                  </div>
                  <div className="text-sm text-gray-400 space-y-1">
                    <div>등록: {new Date(device.registered_at).toLocaleString('ko-KR')}</div>
                    {device.last_used_at && (
                      <div>마지막 사용: {new Date(device.last_used_at).toLocaleString('ko-KR')}</div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(device.id)}
                  className="px-3 py-1 bg-red-600 hover:bg-red-500 rounded text-sm"
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
