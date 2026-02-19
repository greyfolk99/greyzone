import { useEffect, useState } from 'react'
import { startRegistration } from '@simplewebauthn/browser'
import { Smartphone, Plus, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Device {
  id: string
  name: string
  registered_at: string
  last_used_at?: string
}

export default function Devices() {
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [registering, setRegistering] = useState(false)

  useEffect(() => {
    fetchDevices()
  }, [])

  async function fetchDevices() {
    try {
      const res = await fetch('/api/devices')
      const data = await res.json()
      setDevices(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to fetch devices:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister() {
    if (!newName.trim()) return
    setRegistering(true)
    try {
      const startRes = await fetch('/api/devices/register/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      })
      const { challengeId, options } = await startRes.json()
      const credential = await startRegistration(options)
      
      await fetch('/api/devices/register/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId,
          response: credential,
          deviceName: newName,
          userAgent: navigator.userAgent,
        }),
      })
      
      setNewName('')
      setShowForm(false)
      fetchDevices()
    } catch (err) {
      console.error('Registration failed:', err)
      alert('등록 실패')
    } finally {
      setRegistering(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('삭제?')) return
    try {
      await fetch(`/api/devices/${id}`, { method: 'DELETE' })
      fetchDevices()
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">기기</h1>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="w-4 h-4 mr-1" /> 등록
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <Input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="기기 이름"
            />
            <Button 
              variant="approve" 
              className="w-full" 
              onClick={handleRegister}
              disabled={registering}
            >
              {registering ? '등록 중...' : '🔑 등록하기'}
            </Button>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="text-center text-greyzone-500 py-12">로딩 중...</div>
      ) : devices.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Smartphone className="w-12 h-12 mx-auto mb-3 text-greyzone-600" />
            <p className="text-greyzone-500">등록된 기기 없음</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {devices.map(device => (
            <Card key={device.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-greyzone-800 rounded-lg flex items-center justify-center">
                      <Smartphone className="w-5 h-5 text-greyzone-400" />
                    </div>
                    <div>
                      <div className="font-medium">{device.name}</div>
                      <div className="text-xs text-greyzone-500">
                        {new Date(device.registered_at).toLocaleDateString('ko-KR')}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-greyzone-500 hover:text-red-400"
                    onClick={() => handleDelete(device.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
