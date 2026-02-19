import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { startRegistration } from '@simplewebauthn/browser'
import { Shield } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useApp } from '@/App'

export default function Setup() {
  const [name, setName] = useState('')
  const [registering, setRegistering] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const { refreshDevices } = useApp()

  async function handleRegister() {
    if (!name.trim()) {
      setError('기기 이름을 입력하세요')
      return
    }

    setRegistering(true)
    setError('')

    try {
      const startRes = await fetch('/api/devices/register/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
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
          deviceName: name,
          userAgent: navigator.userAgent,
        }),
      })

      if (!completeRes.ok) {
        const data = await completeRes.json()
        throw new Error(data.error || '등록 실패')
      }

      await refreshDevices()
      navigate('/')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setRegistering(false)
    }
  }

  return (
    <div className="min-h-screen bg-greyzone-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-greyzone-800 rounded-2xl mx-auto mb-4 flex items-center justify-center">
            <Shield className="w-8 h-8 text-greyzone-400" />
          </div>
          <h1 className="text-2xl font-bold">Greyzone</h1>
          <p className="text-sm text-greyzone-500 mt-1">승인 & 시크릿 관리</p>
        </div>

        {/* Form */}
        <Card>
          <CardContent className="p-5 space-y-4">
            <div>
              <h2 className="font-semibold mb-1">기기 등록</h2>
              <p className="text-xs text-greyzone-500">
                Face ID, Touch ID, 또는 보안 키로 인증합니다.
              </p>
            </div>

            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="기기 이름 (예: iPhone)"
              disabled={registering}
            />

            {error && (
              <p className="text-sm text-red-400 bg-red-500/10 p-3 rounded-lg">
                {error}
              </p>
            )}

            <Button
              className="w-full"
              onClick={handleRegister}
              disabled={registering}
            >
              {registering ? '등록 중...' : '🔑 기기 등록'}
            </Button>
          </CardContent>
        </Card>

        <p className="text-center text-greyzone-600 text-xs mt-6">
          등록된 기기만 sudo 명령을 승인할 수 있습니다.
        </p>
      </div>
    </div>
  )
}
