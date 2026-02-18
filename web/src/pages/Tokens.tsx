import { useEffect, useState } from 'react'

interface Token {
  id: string
  service: string
  project: string
  profile?: string
  description?: string
  created_at: string
  updated_at: string
}

export default function Tokens() {
  const [tokens, setTokens] = useState<Token[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editToken, setEditToken] = useState<Token | null>(null)

  useEffect(() => {
    fetchTokens()
  }, [])

  async function fetchTokens() {
    try {
      const res = await fetch('/api/tokens')
      const data = await res.json()
      setTokens(data)
    } catch (err) {
      console.error('Failed to fetch tokens:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('정말 삭제하시겠습니까?')) return
    
    try {
      await fetch(`/api/tokens/${id}`, { method: 'DELETE' })
      fetchTokens()
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">토큰 관리</h1>
        <button
          onClick={() => { setEditToken(null); setShowModal(true) }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg"
        >
          ➕ 토큰 추가
        </button>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-12">로딩 중...</div>
      ) : tokens.length === 0 ? (
        <div className="text-center text-gray-400 py-12">
          등록된 토큰이 없습니다
        </div>
      ) : (
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-700">
              <tr>
                <th className="text-left px-4 py-3">서비스</th>
                <th className="text-left px-4 py-3">프로젝트</th>
                <th className="text-left px-4 py-3">프로필</th>
                <th className="text-left px-4 py-3">설명</th>
                <th className="text-left px-4 py-3">수정일</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {tokens.map(token => (
                <tr key={token.id} className="hover:bg-gray-700/50">
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-sm">
                      {token.service}
                    </span>
                  </td>
                  <td className="px-4 py-3">{token.project}</td>
                  <td className="px-4 py-3 text-gray-400">{token.profile || '-'}</td>
                  <td className="px-4 py-3 text-gray-400 text-sm">{token.description || '-'}</td>
                  <td className="px-4 py-3 text-gray-400 text-sm">
                    {new Date(token.updated_at).toLocaleDateString('ko-KR')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => { setEditToken(token); setShowModal(true) }}
                        className="px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded text-sm"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => handleDelete(token.id)}
                        className="px-3 py-1 bg-red-600 hover:bg-red-500 rounded text-sm"
                      >
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <TokenModal
          token={editToken}
          onClose={() => setShowModal(false)}
          onSave={() => { setShowModal(false); fetchTokens() }}
        />
      )}
    </div>
  )
}

function TokenModal({ token, onClose, onSave }: {
  token: Token | null
  onClose: () => void
  onSave: () => void
}) {
  const [form, setForm] = useState({
    service: token?.service || '',
    project: token?.project || '',
    profile: token?.profile || '',
    description: token?.description || '',
    token: '',
  })
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    try {
      await fetch('/api/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      onSave()
    } catch (err) {
      console.error('Save failed:', err)
      alert('저장 실패')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">
          {token ? '토큰 수정' : '토큰 추가'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">서비스</label>
            <input
              type="text"
              value={form.service}
              onChange={e => setForm({ ...form, service: e.target.value })}
              placeholder="supabase, openai, etc."
              className="w-full px-4 py-2 bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">프로젝트</label>
            <input
              type="text"
              value={form.project}
              onChange={e => setForm({ ...form, project: e.target.value })}
              placeholder="friend-picks"
              className="w-full px-4 py-2 bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">프로필</label>
            <input
              type="text"
              value={form.profile}
              onChange={e => setForm({ ...form, profile: e.target.value })}
              placeholder="dev, staging, prod"
              className="w-full px-4 py-2 bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">설명</label>
            <input
              type="text"
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Supabase anon key"
              className="w-full px-4 py-2 bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">토큰</label>
            <textarea
              value={form.token}
              onChange={e => setForm({ ...form, token: e.target.value })}
              placeholder="토큰 값 입력..."
              rows={3}
              className="w-full px-4 py-2 bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
              required
            />
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg disabled:opacity-50"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
