import { useState, useEffect } from 'react'
import { Save } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Config {
  storage: 'local' | 'doppler'
  doppler?: {
    token?: string
    project?: string
    config?: string
  }
}

export default function Settings() {
  const [config, setConfig] = useState<Config>({ storage: 'local' })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetchConfig()
  }, [])

  async function fetchConfig() {
    try {
      const res = await fetch('/api/config')
      if (res.ok) {
        const data = await res.json()
        setConfig(data)
      }
    } catch (err) {
      console.error('Failed to fetch config:', err)
    }
  }

  async function handleSave() {
    setSaving(true)
    setMessage('')
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (res.ok) {
        setMessage('저장 완료!')
      } else {
        setMessage('저장 실패')
      }
    } catch (err) {
      setMessage('저장 실패')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">설정</h1>

      {/* Storage Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">저장소</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button
              variant={config.storage === 'local' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setConfig({ ...config, storage: 'local' })}
            >
              Local
            </Button>
            <Button
              variant={config.storage === 'doppler' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setConfig({ ...config, storage: 'doppler', doppler: config.doppler || {} })}
            >
              Doppler
            </Button>
          </div>

          {config.storage === 'doppler' && (
            <div className="space-y-3 pt-2">
              <div>
                <label className="text-xs text-greyzone-500 block mb-1">Doppler Token</label>
                <Input
                  type="password"
                  value={config.doppler?.token || ''}
                  onChange={e => setConfig({
                    ...config,
                    doppler: { ...config.doppler, token: e.target.value }
                  })}
                  placeholder="dp.st.xxx"
                />
              </div>
              <div>
                <label className="text-xs text-greyzone-500 block mb-1">Project</label>
                <Input
                  value={config.doppler?.project || ''}
                  onChange={e => setConfig({
                    ...config,
                    doppler: { ...config.doppler, project: e.target.value }
                  })}
                  placeholder="friend-picks"
                />
              </div>
              <div>
                <label className="text-xs text-greyzone-500 block mb-1">Config</label>
                <Input
                  value={config.doppler?.config || ''}
                  onChange={e => setConfig({
                    ...config,
                    doppler: { ...config.doppler, config: e.target.value }
                  })}
                  placeholder="dev"
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button onClick={handleSave} disabled={saving}>
              <Save className="w-4 h-4 mr-1" />
              {saving ? '저장 중...' : '저장'}
            </Button>
            {message && (
              <span className={`text-sm ${message.includes('완료') ? 'text-green-400' : 'text-red-400'}`}>
                {message}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Server Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">서버 정보</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-greyzone-500">버전</span>
            <span>1.0.0</span>
          </div>
          <div className="flex justify-between">
            <span className="text-greyzone-500">상태</span>
            <span className="text-green-400">● 정상</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
