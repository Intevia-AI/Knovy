import { useState, useEffect, useCallback } from 'react'
import { Bot, Download, Trash2, ExternalLink, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from '@/components/ui/select'

interface OllamaModel {
  name: string
  size: number
  modifiedAt: string
  digest: string
}

type OllamaStatus = 'disconnected' | 'connected' | 'pulling' | 'ready' | 'error'

const RECOMMENDED_MODEL = 'gemma3:4b'
const PULLABLE_MODELS = [
  { name: 'qwen2.5:1.5b', label: 'Qwen 2.5 1.5B', description: 'Lightweight, faster' },
  { name: 'qwen2.5:3b', label: 'Qwen 2.5 3B', description: 'Good balance of speed and quality' },
  { name: 'gemma3:1b', label: 'Gemma 3 1B', description: 'Google, very fast (no vision)' },
  { name: 'gemma3:4b', label: 'Gemma 3 4B', description: 'Recommended - vision + quality' }
]

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function StatusIndicator({ status }: { status: OllamaStatus }) {
  switch (status) {
    case 'ready':
      return (
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 text-green-500" />
          <span className="text-sm text-green-600">Ready</span>
        </div>
      )
    case 'connected':
      return (
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 text-yellow-500" />
          <span className="text-sm text-yellow-600">Connected (no model)</span>
        </div>
      )
    case 'pulling':
      return (
        <div className="flex items-center gap-1.5">
          <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
          <span className="text-sm text-blue-600">Downloading model...</span>
        </div>
      )
    case 'error':
      return (
        <div className="flex items-center gap-1.5">
          <XCircle className="w-4 h-4 text-red-500" />
          <span className="text-sm text-red-600">Error</span>
        </div>
      )
    default:
      return (
        <div className="flex items-center gap-1.5">
          <XCircle className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Not connected</span>
        </div>
      )
  }
}

export function OllamaSettings() {
  const [status, setStatus] = useState<OllamaStatus>('disconnected')
  const [models, setModels] = useState<OllamaModel[]>([])
  const [activeModel, setActiveModel] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [isPulling, setIsPulling] = useState(false)
  const [pullProgress, setPullProgress] = useState<number>(0)
  const [pullStatus, setPullStatus] = useState<string>('')
  const [modelToPull, setModelToPull] = useState<string>(RECOMMENDED_MODEL)

  const refreshStatus = useCallback(async () => {
    try {
      const result = await window.electronAPI.invoke('ollama:get-status')
      setStatus(result.status)
      setActiveModel(result.activeModel || '')
    } catch {
      setStatus('disconnected')
    }
  }, [])

  const refreshModels = useCallback(async () => {
    try {
      const result = await window.electronAPI.invoke('ollama:get-models')
      setModels(result || [])
    } catch {
      setModels([])
    }
  }, [])

  useEffect(() => {
    const init = async () => {
      await refreshStatus()
      await refreshModels()
      setIsLoading(false)
    }
    init()

    // Listen for status changes
    const unsubStatus = window.electronAPI.on('ollama:status-changed', (data: any) => {
      setStatus(data.newStatus)
    })

    // Listen for pull progress
    const unsubProgress = window.electronAPI.on('ollama:pull-progress', (data: any) => {
      if (data.percentage !== undefined) {
        setPullProgress(data.percentage)
      }
      if (data.status) {
        setPullStatus(data.status)
      }
    })

    return () => {
      unsubStatus()
      unsubProgress()
    }
  }, [refreshStatus, refreshModels])

  const handlePullModel = async () => {
    if (!modelToPull) return
    setIsPulling(true)
    setPullProgress(0)
    setPullStatus('Starting download...')

    try {
      const result = await window.electronAPI.invoke('ollama:pull-model', modelToPull)
      if (result.success) {
        await refreshModels()
        await refreshStatus()
      }
    } catch (error) {
      console.error('[OllamaSettings] Pull failed:', error)
    } finally {
      setIsPulling(false)
      setPullProgress(0)
      setPullStatus('')
    }
  }

  const handleDeleteModel = async (modelName: string) => {
    try {
      const result = await window.electronAPI.invoke('ollama:delete-model', modelName)
      if (result.success) {
        await refreshModels()
        await refreshStatus()
      }
    } catch (error) {
      console.error('[OllamaSettings] Delete failed:', error)
    }
  }

  const handleSetActiveModel = async (modelName: string) => {
    try {
      await window.electronAPI.invoke('ollama:set-model', modelName)
      setActiveModel(modelName)
      await refreshStatus()
    } catch (error) {
      console.error('[OllamaSettings] Set model failed:', error)
    }
  }

  const handleCheckConnection = async () => {
    await window.electronAPI.invoke('ollama:check-connection')
    await refreshStatus()
    await refreshModels()
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Card className="bg-background/50 backdrop-blur-sm">
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground mb-2">AI Models</h2>
        <p className="text-sm text-muted-foreground">
          Manage local AI models for transcription enhancement via Ollama.
        </p>
      </div>

      {/* Connection Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-medium">Ollama Connection</h3>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Label className="text-sm font-medium">Status</Label>
              <div className="mt-1">
                <StatusIndicator status={status} />
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleCheckConnection}>
              Check Connection
            </Button>
          </div>

          {status === 'disconnected' && (
            <div className="rounded-lg bg-muted/50 p-4 space-y-2">
              <p className="text-sm text-muted-foreground">
                Ollama is not detected. Install it to enable local AI transcription enhancement.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.electronAPI.openExternal('https://ollama.com/download')}
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                Install Ollama
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Model Selection Card */}
      {status !== 'disconnected' && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-medium">Active Model</h3>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {models.length > 0 ? (
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <Label className="text-sm font-medium">Select model for enhancement</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Choose which installed model to use for transcription correction.
                  </p>
                </div>
                <Select value={activeModel} onValueChange={handleSetActiveModel}>
                  <SelectTrigger className="w-[220px] bg-background/50">
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((model) => (
                      <SelectItem key={model.name} value={model.name}>
                        <div className="flex items-center gap-2">
                          <span>{model.name}</span>
                          {model.name === RECOMMENDED_MODEL && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              Recommended
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No models installed. Pull a model below to get started.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Installed Models Card */}
      {status !== 'disconnected' && models.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-medium">Installed Models</h3>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {models.map((model) => (
                <div
                  key={model.name}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{model.name}</span>
                        {model.name === activeModel && (
                          <Badge variant="default" className="text-[10px] px-1.5 py-0">
                            Active
                          </Badge>
                        )}
                        {model.name === RECOMMENDED_MODEL && model.name !== activeModel && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            Recommended
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{formatBytes(model.size)}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteModel(model.name)}
                    disabled={model.name === activeModel}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pull Model Card */}
      {status !== 'disconnected' && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Download className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-medium">Download Model</h3>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Select value={modelToPull} onValueChange={setModelToPull} disabled={isPulling}>
                <SelectTrigger className="flex-1 bg-background/50">
                  <SelectValue placeholder="Select a model to download" />
                </SelectTrigger>
                <SelectContent>
                  {PULLABLE_MODELS.map((m) => (
                    <SelectItem key={m.name} value={m.name}>
                      <div className="flex items-center gap-2">
                        <span>{m.label}</span>
                        <span className="text-xs text-muted-foreground">- {m.description}</span>
                        {m.name === RECOMMENDED_MODEL && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            Recommended
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handlePullModel} disabled={isPulling || !modelToPull} size="sm">
                {isPulling ? (
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-1.5" />
                )}
                {isPulling ? 'Downloading...' : 'Pull'}
              </Button>
            </div>

            {isPulling && (
              <div className="space-y-2">
                <Progress value={pullProgress} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {pullStatus} {pullProgress > 0 && `(${pullProgress}%)`}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
