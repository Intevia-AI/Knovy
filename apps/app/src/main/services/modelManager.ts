import fs from 'fs/promises'
import path from 'path'
import { app, BrowserWindow } from 'electron'
import { createWriteStream } from 'fs'
import { pipeline } from 'stream/promises'

export interface ModelDownloadProgress {
  modelName: string
  downloaded: number
  total: number
  percentage: number
  speed?: number // bytes per second
}

export interface WhisperModel {
  name: string
  size: string
  sizeBytes: number
  url: string
  description: string
  recommended: boolean
}

/**
 * Manages Whisper model downloads, validation, and storage
 */
export class ModelManager {
  private modelsPath: string
  private downloadInProgress = new Set<string>()

  // Model definitions with download URLs
  private readonly MODELS: WhisperModel[] = [
    {
      name: 'tiny',
      size: '74MB',
      sizeBytes: 77691713, // Actual size of bundled model
      url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin',
      description: 'Fastest model, good for real-time transcription',
      recommended: true
    },
    {
      name: 'base',
      size: '74MB',
      sizeBytes: 74 * 1024 * 1024,
      url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
      description: 'Balanced speed and accuracy',
      recommended: false
    },
    {
      name: 'small',
      size: '244MB',
      sizeBytes: 244 * 1024 * 1024,
      url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin',
      description: 'Higher accuracy, slower processing',
      recommended: false
    },
    {
      name: 'medium',
      size: '769MB',
      sizeBytes: 769 * 1024 * 1024,
      url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin',
      description: 'Best accuracy, requires significant resources',
      recommended: false
    }
  ]

  constructor() {
    this.modelsPath = path.join(app.getPath('userData'), 'whisper-models')
  }

  /**
   * Initialize model manager and create necessary directories
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.modelsPath, { recursive: true })
      console.log(`[ModelManager] Initialized with models path: ${this.modelsPath}`)
    } catch (error) {
      console.error('[ModelManager] Failed to initialize:', error)
      throw error
    }
  }

  /**
   * Get information about all available models
   */
  async getAllModels(): Promise<(WhisperModel & { downloaded: boolean; path?: string })[]> {
    const models = []

    for (const model of this.MODELS) {
      const modelPath = this.getModelPath(model.name)
      let downloaded = false

      try {
        const stats = await fs.stat(modelPath)
        // Verify file size is reasonable (at least 50% of expected size)
        downloaded = stats.size > model.sizeBytes * 0.5
      } catch {
        downloaded = false
      }

      models.push({
        ...model,
        downloaded,
        path: downloaded ? modelPath : undefined
      })
    }

    return models
  }

  /**
   * Check if a specific model is downloaded and valid
   */
  async isModelDownloaded(modelName: string): Promise<boolean> {
    const modelPath = this.getModelPath(modelName)
    const expectedModel = this.MODELS.find(m => m.name === modelName)

    if (!expectedModel) {
      return false
    }

    try {
      const stats = await fs.stat(modelPath)
      // Verify file size is reasonable
      return stats.size > expectedModel.sizeBytes * 0.5
    } catch {
      return false
    }
  }

  /**
   * Download a specific model with progress tracking
   */
  async downloadModel(modelName: string): Promise<boolean> {
    if (this.downloadInProgress.has(modelName)) {
      console.warn(`[ModelManager] Download already in progress for model: ${modelName}`)
      return false
    }

    const model = this.MODELS.find(m => m.name === modelName)
    if (!model) {
      throw new Error(`Unknown model: ${modelName}`)
    }

    if (await this.isModelDownloaded(modelName)) {
      console.log(`[ModelManager] Model ${modelName} already downloaded`)
      return true
    }

    this.downloadInProgress.add(modelName)

    try {
      console.log(`[ModelManager] Starting download for model: ${modelName}`)
      console.log(`[ModelManager] Download URL: ${model.url}`)

      const success = await this.downloadModelFile(model)

      if (success) {
        console.log(`[ModelManager] Successfully downloaded model: ${modelName}`)

        // Notify renderer about successful download
        this.notifyDownloadComplete(modelName, true)
      } else {
        console.error(`[ModelManager] Failed to download model: ${modelName}`)
        this.notifyDownloadComplete(modelName, false)
      }

      return success
    } catch (error) {
      console.error(`[ModelManager] Error downloading model ${modelName}:`, error)
      this.notifyDownloadComplete(modelName, false)
      return false
    } finally {
      this.downloadInProgress.delete(modelName)
    }
  }

  /**
   * Get the recommended model for first-time setup
   */
  getRecommendedModel(): WhisperModel {
    return this.MODELS.find(m => m.recommended) || this.MODELS[0]
  }

  /**
   * Get path to a specific model file
   */
  getModelPath(modelName: string): string {
    return path.join(this.modelsPath, `ggml-${modelName}.bin`)
  }

  /**
   * Delete a downloaded model
   */
  async deleteModel(modelName: string): Promise<boolean> {
    if (this.downloadInProgress.has(modelName)) {
      console.warn(`[ModelManager] Cannot delete model ${modelName} - download in progress`)
      return false
    }

    const modelPath = this.getModelPath(modelName)

    try {
      await fs.unlink(modelPath)
      console.log(`[ModelManager] Deleted model: ${modelName}`)
      return true
    } catch (error) {
      console.error(`[ModelManager] Failed to delete model ${modelName}:`, error)
      return false
    }
  }

  /**
   * Get total disk space used by downloaded models
   */
  async getStorageUsage(): Promise<{ totalBytes: number; models: Array<{ name: string; sizeBytes: number }> }> {
    const models = await this.getAllModels()
    let totalBytes = 0
    const modelSizes = []

    for (const model of models) {
      if (model.downloaded && model.path) {
        try {
          const stats = await fs.stat(model.path)
          modelSizes.push({ name: model.name, sizeBytes: stats.size })
          totalBytes += stats.size
        } catch (error) {
          console.warn(`[ModelManager] Could not get size for model ${model.name}:`, error)
        }
      }
    }

    return { totalBytes, models: modelSizes }
  }

  // Private helper methods

  private async downloadModelFile(model: WhisperModel): Promise<boolean> {
    const modelPath = this.getModelPath(model.name)
    const tempPath = `${modelPath}.tmp`

    try {
      // Use Node.js fetch (available in Node 18+) or fallback to https
      const response = await this.fetchWithProgress(model.url, model.name)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      if (!response.body) {
        throw new Error('No response body')
      }

      // Create write stream
      const fileStream = createWriteStream(tempPath)

      // Track download progress
      const contentLength = response.headers.get('content-length')
      const total = contentLength ? parseInt(contentLength) : model.sizeBytes
      let downloaded = 0
      const startTime = Date.now()

      // Stream response to file with progress tracking
      const reader = response.body.getReader()

      while (true) {
        const { done, value } = await reader.read()

        if (done) break

        fileStream.write(value)
        downloaded += value.length

        // Send progress update every 100KB or 1%
        if (downloaded % (100 * 1024) === 0 || downloaded / total >= 0.01) {
          const elapsed = Date.now() - startTime
          const speed = elapsed > 0 ? (downloaded / elapsed) * 1000 : 0

          this.notifyDownloadProgress({
            modelName: model.name,
            downloaded,
            total,
            percentage: Math.round((downloaded / total) * 100),
            speed
          })
        }
      }

      fileStream.end()

      // Wait for file to be written
      await new Promise((resolve, reject) => {
        fileStream.on('finish', resolve)
        fileStream.on('error', reject)
      })

      // Verify file size
      const stats = await fs.stat(tempPath)
      if (stats.size < model.sizeBytes * 0.9) { // Allow 10% variance
        throw new Error(`Downloaded file size (${stats.size}) is significantly smaller than expected (${model.sizeBytes})`)
      }

      // Move temp file to final location
      await fs.rename(tempPath, modelPath)

      return true
    } catch (error) {
      console.error(`[ModelManager] Download failed for ${model.name}:`, error)

      // Cleanup temp file
      try {
        await fs.unlink(tempPath)
      } catch {
        // Ignore cleanup errors
      }

      throw error
    }
  }

  private async fetchWithProgress(url: string, modelName: string): Promise<Response> {
    // Use native fetch in Node.js 18+
    if (typeof fetch !== 'undefined') {
      return fetch(url)
    }

    // Fallback for older Node.js versions
    const https = await import('https')

    return new Promise((resolve, reject) => {
      const request = https.get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          // Handle redirect
          const redirectUrl = response.headers.location
          if (redirectUrl) {
            this.fetchWithProgress(redirectUrl, modelName).then(resolve).catch(reject)
            return
          }
        }

        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`))
          return
        }

        // Create a Response-like object for compatibility
        const body = new ReadableStream({
          start(controller) {
            response.on('data', (chunk) => {
              controller.enqueue(new Uint8Array(chunk))
            })
            response.on('end', () => {
              controller.close()
            })
            response.on('error', (error) => {
              controller.error(error)
            })
          }
        })

        const mockResponse = {
          ok: true,
          status: response.statusCode!,
          statusText: response.statusMessage || '',
          headers: {
            get: (name: string) => response.headers[name.toLowerCase()] as string
          },
          body
        } as Response

        resolve(mockResponse)
      })

      request.on('error', reject)
      request.setTimeout(30000, () => {
        request.destroy()
        reject(new Error('Download timeout'))
      })
    })
  }

  private notifyDownloadProgress(progress: ModelDownloadProgress): void {
    // Send progress to all renderer windows
    BrowserWindow.getAllWindows().forEach(window => {
      if (!window.isDestroyed()) {
        window.webContents.send('model:download-progress', progress)
      }
    })
  }

  private notifyDownloadComplete(modelName: string, success: boolean): void {
    // Send completion status to all renderer windows
    BrowserWindow.getAllWindows().forEach(window => {
      if (!window.isDestroyed()) {
        window.webContents.send('model:download-complete', { modelName, success })
      }
    })
  }
}

// Singleton instance
let modelManager: ModelManager | null = null

export function getModelManager(): ModelManager {
  if (!modelManager) {
    modelManager = new ModelManager()
  }
  return modelManager
}