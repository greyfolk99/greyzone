import { useEffect, useState } from 'react'

interface Config {
  storage: 'local' | 'doppler'
  doppler?: {
    project: string
    config: string
  }
}

export default function Settings() {
  const [config, setConfig] = useState<Config>({
    storage: 'local',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchConfig()
  }, [])

  async function fetchConfig() {
    try {
      const res = await fetch('/api/config')
      const data = await res.json()
      setConfig(data)
    } catch (err) {
      console.error('Failed to fetch config:', err)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      alert('설정 저장 완료!')
    } catch (err) {
      console.error('Save failed:', err)
      alert('저장 실패')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">설정</h1>

      <div className="space-y-6">
        {/* Storage Settings */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">저장소 설정</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">저장소 타입</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="storage"
                    value="local"
                    checked={config.storage === 'local'}
                    onChange={() => setConfig({ ...config, storage: 'local' })}
                    className="w-4 h-4"
                  />
                  <span>Local (SQLite)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="storage"
                    value="doppler"
                    checked={config.storage === 'doppler'}
                    onChange={() => setConfig({ ...config, storage: 'doppler' })}
                    className="w-4 h-4"
                  />
                  <span>Doppler</span>
                </label>
              </div>
            </div>

            {config.storage === 'doppler' && (
              <div className="grid grid-cols-2 gap-4 mt-4 p-4 bg-gray-700/50 rounded-lg">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Doppler 프로젝트</label>
                  <input
                    type="text"
                    value={config.doppler?.project || ''}
                    onChange={e => setConfig({
                      ...config,
                      doppler: { ...config.doppler, project: e.target.value, config: config.doppler?.config || 'dev' }
                    })}
                    placeholder="friend-picks"
                    className="w-full px-4 py-2 bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Doppler 환경</label>
                  <input
                    type="text"
                    value={config.doppler?.config || ''}
                    onChange={e => setConfig({
                      ...config,
                      doppler: { ...config.doppler, project: config.doppler?.project || '', config: e.target.value }
                    })}
                    placeholder="dev"
                    className="w-full px-4 py-2 bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Server Info */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">서버 정보</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">버전</span>
              <span>1.0.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">상태</span>
              <span className="text-green-400">● 정상</span>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg disabled:opacity-50"
          >
            {saving ? '저장 중...' : '설정 저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
