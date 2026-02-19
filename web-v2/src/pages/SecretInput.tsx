import { useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Key, Check } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export default function SecretInput() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  
  const project = searchParams.get('project') || ''
  const config = searchParams.get('config') || 'dev'
  const key = searchParams.get('key') || ''
  const desc = searchParams.get('desc') || ''
  
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
        body: JSON.stringify({ key, value, description: desc }),
      })

      if (!res.ok) throw new Error('저장 실패')
      setSuccess(true)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (!project || !key) {
    return (
      <div className="min-h-screen bg-greyzone-950 flex items-center justify-center p-4">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-greyzone-500">잘못된 요청</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-greyzone-950 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-500/20 rounded-full mx-auto mb-4 flex items-center justify-center">
            <Check className="w-8 h-8 text-green-400" />
          </div>
          <h1 className="text-xl font-bold mb-2">저장 완료</h1>
          <p className="text-greyzone-500 mb-6">{key}</p>
          <Button onClick={() => navigate('/secrets')}>
            시크릿 목록
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-greyzone-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-greyzone-800 rounded-xl mx-auto mb-3 flex items-center justify-center">
            <Key className="w-6 h-6 text-greyzone-400" />
          </div>
          <h1 className="text-xl font-bold">시크릿 입력</h1>
        </div>

        <Card>
          <CardContent className="p-5 space-y-4">
            {/* Info */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-greyzone-500">프로젝트</span>
                <Badge variant="secondary">{project}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-greyzone-500">환경</span>
                <Badge variant="outline">{config}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-greyzone-500">키</span>
                <span className="font-mono text-green-400">{key}</span>
              </div>
            </div>

            {/* Input */}
            <div>
              <label className="text-sm text-greyzone-500 block mb-2">값</label>
              <textarea
                value={value}
                onChange={e => setValue(e.target.value)}
                placeholder="값을 붙여넣으세요..."
                rows={4}
                className="w-full px-4 py-3 bg-greyzone-800 border border-greyzone-700 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-greyzone-500 resize-none"
                autoFocus
              />
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-500/10 p-3 rounded-lg">
                {error}
              </p>
            )}

            <Button
              className="w-full"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? '저장 중...' : '💾 저장'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
