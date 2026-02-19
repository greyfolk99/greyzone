import { useEffect, useState } from 'react'
import { Key, Trash2, Cloud, Database } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface Secret {
  project: string
  config: string
  key: string
  value?: string
  source?: 'local' | 'doppler'
}

interface Config {
  storage: 'local' | 'doppler'
  doppler?: {
    project?: string
    config?: string
  }
}

export default function Secrets() {
  const [secrets, setSecrets] = useState<Secret[]>([])
  const [loading, setLoading] = useState(true)
  const [config, setConfig] = useState<Config>({ storage: 'local' })

  useEffect(() => {
    fetchConfig()
  }, [])

  async function fetchConfig() {
    try {
      const res = await fetch('/api/config')
      if (res.ok) {
        const data = await res.json()
        setConfig(data)
        if (data.storage === 'doppler') {
          fetchDopplerSecrets()
        } else {
          fetchLocalSecrets()
        }
      } else {
        fetchLocalSecrets()
      }
    } catch (err) {
      fetchLocalSecrets()
    }
  }

  async function fetchDopplerSecrets() {
    try {
      const res = await fetch('/api/doppler/secrets')
      const data = await res.json()
      
      if (data.error) {
        console.error('Doppler error:', data.error)
        setSecrets([])
        return
      }

      const secretList: Secret[] = Object.values(data).map((s: any) => ({
        project: config.doppler?.project || 'doppler',
        config: config.doppler?.config || 'dev',
        key: s.key,
        value: s.value,
        source: 'doppler' as const,
      }))
      
      setSecrets(secretList)
    } catch (err) {
      console.error('Failed to fetch Doppler secrets:', err)
      setSecrets([])
    } finally {
      setLoading(false)
    }
  }

  async function fetchLocalSecrets() {
    try {
      const projectsRes = await fetch('/api/secrets')
      const projects = await projectsRes.json()
      
      if (!Array.isArray(projects)) {
        setSecrets([])
        return
      }

      const allSecrets: Secret[] = []
      
      for (const project of projects) {
        const configsRes = await fetch(`/api/secrets/${project}`)
        const configs = await configsRes.json()
        
        if (!Array.isArray(configs)) continue
        
        for (const cfg of configs) {
          const secretsRes = await fetch(`/api/secrets/${project}/${cfg}`)
          const secretsData = await secretsRes.json()
          
          for (const [key, value] of Object.entries(secretsData)) {
            allSecrets.push({ 
              project, 
              config: cfg, 
              key, 
              value: value as string,
              source: 'local' 
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

  async function handleDelete(project: string, cfg: string, key: string) {
    if (!confirm(`${key} 삭제?`)) return
    try {
      await fetch(`/api/secrets/${project}/${cfg}/${key}`, { method: 'DELETE' })
      fetchLocalSecrets()
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }

  function maskValue(value: string) {
    if (!value) return '••••••••'
    if (value.length <= 8) return '••••••••'
    return value.slice(0, 4) + '••••' + value.slice(-4)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">시크릿</h1>
        <Badge variant="secondary" className="flex items-center gap-1">
          {config.storage === 'doppler' ? (
            <><Cloud className="w-3 h-3" /> Doppler</>
          ) : (
            <><Database className="w-3 h-3" /> Local</>
          )}
        </Badge>
      </div>

      {loading ? (
        <div className="text-center text-greyzone-500 py-12">로딩 중...</div>
      ) : secrets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Key className="w-12 h-12 mx-auto mb-3 text-greyzone-600" />
            <p className="text-greyzone-500">
              {config.storage === 'doppler' 
                ? 'Doppler 시크릿 없음 (설정 확인 필요)'
                : '등록된 시크릿 없음'
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {secrets.map((secret, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    {/* Tags */}
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <Badge variant="secondary">{secret.project}</Badge>
                      <Badge variant="outline">{secret.config}</Badge>
                      {secret.source === 'doppler' && (
                        <Badge className="bg-purple-500/20 text-purple-400">doppler</Badge>
                      )}
                    </div>
                    
                    {/* Key */}
                    <div className="font-mono text-sm text-white mb-1 truncate">
                      {secret.key}
                    </div>
                    
                    {/* Value (masked) */}
                    <div className="font-mono text-xs text-greyzone-500">
                      {maskValue(secret.value || '')}
                    </div>
                  </div>
                  
                  {secret.source !== 'doppler' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-greyzone-500 hover:text-red-400"
                      onClick={() => handleDelete(secret.project, secret.config, secret.key)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
