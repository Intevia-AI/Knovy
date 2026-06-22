import {
  Bot,
  Download,
  Trash2,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle
} from 'lucide-react'
import { useState } from 'react'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from '@/components/ui/select'
import { useI18n } from '@/hooks/useI18n'
import { useOllamaModelState } from '@/hooks/useOllamaModelState'

const RECOMMENDED_MODEL = 'gemma4:e2b'
const PULLABLE_MODELS = [
  { name: 'qwen3.5:2b', label: 'Qwen 3.5 2B', description: 'Lightweight, fastest, lowest memory' },
  {
    name: 'qwen3.5:4b',
    label: 'Qwen 3.5 4B',
    description: 'Balanced speed and quality (text + vision)'
  },
  { name: 'gemma4:e2b', label: 'Gemma 4 E2B', description: 'Recommended - fast, low memory' },
  { name: 'gemma4:e4b', label: 'Gemma 4 E4B', description: 'Higher quality, more memory (vision)' }
]

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export function OllamaSettings() {
  const { t } = useI18n()
  const {
    state,
    models,
    aiCorrection,
    thinkEnabled,
    selectModel,
    cancelPull,
    deleteModel,
    checkConnection,
    setAiCorrection,
    setThink
  } = useOllamaModelState()
  const [modelToDownload, setModelToDownload] = useState<string>(RECOMMENDED_MODEL)

  const isBusy = state.phase === 'downloading' || state.phase === 'verifying'

  const phaseLabel = () => {
    switch (state.phase) {
      case 'downloading':
        return t('modelDownloading')
      case 'verifying':
        return t('modelVerifying')
      case 'ready':
        return t('modelReady')
      case 'error':
        return t('modelError')
      default:
        return state.reachable ? t('aiCorrectionOn') : ''
    }
  }

  const errorMessage = () => {
    if (!state.error) return t('gateErrorGeneric')
    switch (state.error.kind) {
      case 'disk-full':
        return t('gateErrorDiskFull')
      case 'network':
        return t('gateErrorNetwork')
      default:
        return t('gateErrorGeneric')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground mb-2">{t('aiModelsTab')}</h2>
        <p className="text-sm text-muted-foreground">
          Manage local AI models for transcription enhancement via Ollama.
        </p>
      </div>

      {/* AI Auto-Correction toggle */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-medium">{t('aiCorrectionTitle')}</h3>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground flex-1">{t('aiCorrectionDescription')}</p>
            <div className="flex items-center gap-2">
              <span className="text-sm">
                {aiCorrection === 'on' ? t('aiCorrectionOn') : t('aiCorrectionOff')}
              </span>
              <Switch
                checked={aiCorrection === 'on'}
                onCheckedChange={(checked) => setAiCorrection(checked ? 'on' : 'off')}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Thinking mode toggle */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-medium">{t('thinkModeTitle')}</h3>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground flex-1">{t('thinkModeDescription')}</p>
            <div className="flex items-center gap-2">
              <span className="text-sm">
                {thinkEnabled ? t('thinkModeOn') : t('thinkModeOff')}
              </span>
              <Switch
                checked={thinkEnabled}
                onCheckedChange={(checked) => setThink(checked)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Connection status */}
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
              <div className="mt-1 flex items-center gap-1.5">
                {!state.reachable ? (
                  <>
                    <XCircle className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Not connected</span>
                  </>
                ) : state.phase === 'ready' ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span className="text-sm text-green-600">{t('modelReady')}</span>
                  </>
                ) : (
                  <span className="text-sm text-yellow-600">{phaseLabel()}</span>
                )}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={checkConnection}>
              Check Connection
            </Button>
          </div>

          {!state.reachable && (
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
                {t('btnStartOllama')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active model: choose among INSTALLED models only (instant switch, never downloads) */}
      {state.reachable && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-medium">Active Model</h3>
            </div>
          </CardHeader>
          <CardContent>
            {models.length > 0 ? (
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1">
                  <Label className="text-sm font-medium">Select model for enhancement</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Choose which installed model to use. Switching is instant.
                  </p>
                </div>
                <Select value={state.model} onValueChange={selectModel} disabled={isBusy}>
                  <SelectTrigger className="w-[240px] bg-background/50">
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((m) => (
                      <SelectItem key={m.name} value={m.name}>
                        <div className="flex items-center gap-2">
                          <span>{m.name}</span>
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
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No models installed. Download one below to enable AI correction.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Download model: explicit, separate from selection */}
      {state.reachable && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Download className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-medium">Download Model</h3>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Select value={modelToDownload} onValueChange={setModelToDownload} disabled={isBusy}>
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
              <Button
                onClick={() => selectModel(modelToDownload)}
                disabled={isBusy || !modelToDownload}
                size="sm"
              >
                {isBusy ? (
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-1.5" />
                )}
                {isBusy ? phaseLabel() : 'Download'}
              </Button>
            </div>

            {state.pendingModel && (
              <p className="text-xs text-yellow-600">
                {t('pendingSwitchNotice')}: {state.pendingModel}
              </p>
            )}

            {isBusy && (
              <div className="space-y-2">
                <Progress value={state.progress} className="h-2" />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {phaseLabel()} {state.progress > 0 && `(${state.progress}%)`}
                  </p>
                  <Button variant="ghost" size="sm" onClick={cancelPull}>
                    {t('btnCancelDownload')}
                  </Button>
                </div>
              </div>
            )}

            {state.phase === 'error' && (
              <div className="rounded-lg bg-destructive/10 p-3 space-y-2">
                <div className="flex items-center gap-1.5 text-destructive text-sm">
                  <AlertTriangle className="w-4 h-4" />
                  {errorMessage()}
                </div>
                <Button variant="outline" size="sm" onClick={() => selectModel(state.model)}>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5" />
                  {t('btnRetry')}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Installed models */}
      {state.reachable && models.length > 0 && (
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
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{model.name}</span>
                    {model.name === state.model && (
                      <Badge variant="default" className="text-[10px] px-1.5 py-0">
                        Active
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">{formatBytes(model.size)}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteModel(model.name)}
                    disabled={model.name === state.model}
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
    </div>
  )
}
