import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { startRegistration } from '@simplewebauthn/browser'
import { useApp } from '../App'

export default function Setup() {
  const [deviceName, setDeviceName] = useState('')
  const [registering, setRegistering] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const { refreshDevices } = useApp()

  async function handleRegister() {
    if (!deviceName.trim()) {
      setError('디바이스 이름을 입력하세요')
      return
    }

    setRegistering(true)
    setError('')

    try {
      const startRes = await fetch('/api/devices/register/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: deviceName }),
      })
      
      if (!startRes.ok) throw new Error('등록 시작 실패')
      
      const { challengeId, options } = await startRes.json()
      const credential = await startRegistration(options)

      const completeRes = await fetch('/api/devices/register/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId,
          response: credential,
          deviceName,
          userAgent: navigator.userAgent,
        }),
      })

      if (!completeRes.ok) {
        const data = await completeRes.json()
        throw new Error(data.error || '등록 완료 실패')
      }

      await refreshDevices()
      navigate('/')
    } catch (err) {
      console.error('Registration failed:', err)
      setError((err as Error).message || '등록 실패')
    } finally {
      setRegistering(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">🔐</div>
          <h1 className="text-2xl font-bold">Greyzone</h1>
          <p className="text-sm text-gray-400 mt-1">민감한 작업 승인 & 시크릿 관리</p>
        </div>

        {/* Form */}
        <div className="bg-gray-800 rounded-xl p-5">
          <h2 className="text-lg font-semibold mb-2">디바이스 등록</h2>
          <p className="text-sm text-gray-400 mb-5">
            Face ID, Touch ID, 또는 보안 키로 인증합니다.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">디바이스 이름</label>
              <input
                type="text"
                value={deviceName}
                onChange={e => setDeviceName(e.target.value)}
                placeholder="예: iPhone, MacBook"
                className="w-full px-4 py-3 bg-gray-700 rounded-lg text-base outline-none focus:ring-2 focus:ring-blue-500"
                disabled={registering}
              />
            </div>

            {error && (
              <div className="text-red-400 text-sm bg-red-500/10 p-3 rounded-lg">
                {error}
              </div>
            )}

            <button
              onClick={handleRegister}
              disabled={registering}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-lg font-semibold text-base disabled:opacity-50 transition"
            >
              {registering ? '등록 중...' : '🔑 디바이스 등록'}
            </button>
          </div>
        </div>

        <p className="text-center text-gray-500 text-xs mt-5 px-4">
          등록된 디바이스만 sudo 명령을 승인할 수 있습니다.
        </p>
      </div>
    </div>
  )
}
