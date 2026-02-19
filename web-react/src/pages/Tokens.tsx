import { useEffect, useState } from 'react'

interface Secret {
  project: string
  config: string
  key: string
  value?: string
  description?: string
}

export default function Tokens() {
  const [secrets, setSecrets] = useState<Secret[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSecrets()
  }, [])

  async function fetchSecrets() {
    try {
      // 프로젝트 목록 가져오기
      const projectsRes = await fetch('/api/secrets')
      const projects = await projectsRes.json()
      
      const allSecrets: Secret[] = []
      
      for (const project of projects) {
        // 각 프로젝트의 config 목록
        const configsRes = await fetch(`/api/secrets/${project}`)
        const configs = await configsRes.json()
        
        for (const config of configs) {
          // 각 config의 secrets
          const secretsRes = await fetch(`/api/secrets/${project}/${config}`)
          const secretsData = await secretsRes.json()
          
          for (const [key, value] of Object.entries(secretsData)) {
            allSecrets.push({
              project,
              config,
              key,
              value: value as string,
            })
          }
        }
      }
      
      setSecrets(allSecrets)
    } catch (err) {
      console.error('Failed to fetch secrets:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(project: string, config: string, key: string) {
    if (!confirm(`${key} 삭제하시겠습니까?`)) return
    
    try {
      await fetch(`/api/secrets/${project}/${config}/${key}`, { method: 'DELETE' })
      fetchSecrets()
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }

  function maskValue(value: string) {
    if (value.length <= 8) return '••••••••'
    return value.slice(0, 4) + '••••' + value.slice(-4)
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">시크릿 관리</h1>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-8">로딩 중...</div>
      ) : secrets.length === 0 ? (
        <div className="text-center text-gray-400 py-8">
          등록된 시크릿이 없습니다
        </div>
      ) : (
        <div className="space-y-3">
          {secrets.map((secret, i) => (
            <div key={i} className="bg-gray-800 rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs">
                      {secret.project}
                    </span>
                    <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs">
                      {secret.config}
                    </span>
                  </div>
                  <div className="font-mono text-sm text-white mb-1 break-all">
                    {secret.key}
                  </div>
                  <div className="font-mono text-xs text-gray-500">
                    {maskValue(secret.value || '')}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(secret.project, secret.config, secret.key)}
                  className="ml-2 px-3 py-1 bg-red-600 hover:bg-red-500 rounded text-xs flex-shrink-0"
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
