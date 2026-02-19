import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'

export default function SecretInput() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  
  const project = searchParams.get('project') || ''
  const config = searchParams.get('config') || 'dev'
  const key = searchParams.get('key') || ''
  const description = searchParams.get('desc') || ''
  
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    if (!value.trim()) {
      setError('값을 입력하세요')
      return
    }

    setSaving(true)
    setError('')

    try {
      const res = await fetch(`/api/secrets/${project}/${config}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value, description }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '저장 실패')
      }

      setSuccess(true)
      setValue('')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (!project || !key) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-4xl mb-4">❌</div>
          <h1 className="text-xl font-bold mb-2">잘못된 요청</h1>
          <p className="text-gray-400">project와 key 파라미터가 필요합니다</p>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-2xl font-bold mb-2">저장 완료!</h1>
          <p className="text-gray-400 mb-6">
            <span className="text-blue-400">{key}</span> 저장됨
          </p>
          <button
            onClick={() => navigate('/tokens')}
            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
          >
            토큰 목록으로
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🔑</div>
          <h1 className="text-2xl font-bold">시크릿 입력</h1>
        </div>

        <div className="bg-gray-800 rounded-lg p-6">
          {/* Info */}
          <div className="space-y-3 mb-6 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">프로젝트</span>
              <span className="text-blue-400">{project}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">환경</span>
              <span>{config}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">키</span>
              <span className="font-mono text-green-400">{key}</span>
            </div>
            {description && (
              <div className="flex justify-between">
                <span className="text-gray-400">설명</span>
                <span>{description}</span>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">값</label>
            <textarea
              value={value}
              onChange={e => setValue(e.target.value)}
              placeholder="값을 붙여넣으세요..."
              rows={4}
              className="w-full px-4 py-3 bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
              disabled={saving}
              autoFocus
            />
          </div>

          {error && (
            <div className="text-red-400 text-sm bg-red-500/10 p-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold disabled:opacity-50 transition"
          >
            {saving ? '저장 중...' : '💾 저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
