import { spawn, ChildProcess } from 'child_process'
import path from 'path'
import fs from 'fs/promises'
import { app } from 'electron'
import { randomUUID } from 'crypto'

export interface TranscriptionOptions {
  language?: string
  modelSize?: 'tiny' | 'base' | 'small' | 'medium'
  sourceType: 'microphone' | 'system'
  enableNoiseFiltering?: boolean
  energyThreshold?: number
  minSpeechConfidence?: number
}

export interface TranscriptionResult {
  text: string
  confidence?: number
  language?: string
  sourceType: 'microphone' | 'system'
  processingTime: number
}

export interface ModelInfo {
  name: string
  size: string
  downloaded: boolean
  path?: string
}

/**
 * Local transcription service using whisper.cpp
 * Handles audio processing, model management, and binary execution
 */
export class LocalTranscriptionService {
  private whisperBinaryPath: string
  private modelsPath: string
  private tempPath: string
  private isInitialized = false
  private activeProcesses = new Map<string, ChildProcess>()
  private downloadPromises = new Map<string, Promise<boolean>>()

  constructor() {
    // Platform-specific binary paths
    const platform = process.platform
    const arch = process.arch

    let binaryName = 'whisper'
    if (platform === 'win32') {
      binaryName = 'whisper.exe'
    }

    // For development, use resources path; for production, resources are unpacked to app.asar.unpacked
    const isDev = !app.isPackaged
    const resourcesPath = isDev
      ? path.join(__dirname, '../../resources')
      : path.join(process.resourcesPath, 'app.asar.unpacked', 'resources')

    this.whisperBinaryPath = path.join(resourcesPath, 'whisper.cpp', `${binaryName}-${platform}-${arch}`)
    this.modelsPath = path.join(app.getPath('userData'), 'whisper-models')
    this.tempPath = path.join(app.getPath('temp'), 'knovy-transcription')

    console.log('[LocalTranscription] Initialized with paths:', {
      binary: this.whisperBinaryPath,
      models: this.modelsPath,
      temp: this.tempPath
    })

    console.log(`[LocalTranscription] 🎵 WAV files will be saved to: ${this.tempPath}`)
  }

  /**
   * Initialize the transcription service
   * Creates necessary directories and validates binary
   */
  async initialize(): Promise<boolean> {
    try {
      console.log('[LocalTranscription] Initializing service...')

      console.log('[LocalTranscription] Step 1: Creating directories...')
      // Create necessary directories
      await this.ensureDirectories()
      console.log('[LocalTranscription] Directories created successfully')

      console.log('[LocalTranscription] Step 2: Validating binary...')
      // Validate whisper.cpp binary
      const binaryExists = await this.validateBinary()
      if (!binaryExists) {
        console.error('[LocalTranscription] whisper.cpp binary validation failed')
        return false
      }
      console.log('[LocalTranscription] Binary validation passed')

      console.log('[LocalTranscription] Step 3: Ensuring default model...')
      // Ensure default model is available
      await this.ensureDefaultModel()
      console.log('[LocalTranscription] Default model ensured')

      this.isInitialized = true
      console.log('[LocalTranscription] Service initialized successfully')
      return true
    } catch (error) {
      console.error('[LocalTranscription] Failed to initialize service:', error)
      return false
    }
  }

  /**
   * Process audio data and return transcription
   */
  async transcribeAudio(
    audioBuffer: ArrayBuffer,
    options: TranscriptionOptions
  ): Promise<TranscriptionResult> {
    if (!this.isInitialized) {
      throw new Error('LocalTranscriptionService not initialized')
    }

    const startTime = Date.now()
    const sessionId = randomUUID()

    try {
      console.log(`[LocalTranscription] Starting transcription ${sessionId}`, {
        bufferSize: audioBuffer.byteLength,
        durationSeconds: (audioBuffer.byteLength / 2 / 16000).toFixed(2), // 16-bit samples at 16kHz
        sourceType: options.sourceType,
        modelSize: options.modelSize || 'tiny',
        noiseFilteringEnabled: options.enableNoiseFiltering !== false
      })

      // Pre-process audio for noise filtering (enabled by default)
      if (options.enableNoiseFiltering !== false) {
        const audioMetrics = this.analyzeAudioEnergy(audioBuffer)
        const energyThreshold = options.energyThreshold || (options.sourceType === 'microphone' ? 0.01 : 0.005)

        console.log(`[LocalTranscription] Audio analysis for ${sessionId}:`, {
          averageEnergy: audioMetrics.averageEnergy.toFixed(6),
          maxEnergy: audioMetrics.maxEnergy.toFixed(6),
          energyThreshold: energyThreshold.toFixed(6),
          silentFrameRatio: (audioMetrics.silentFrames / audioMetrics.totalFrames * 100).toFixed(1) + '%',
          passesEnergyCheck: audioMetrics.averageEnergy > energyThreshold
        })

        // Skip transcription if audio is too quiet (likely just noise)
        if (audioMetrics.averageEnergy < energyThreshold) {
          console.log(`[LocalTranscription] Skipping transcription ${sessionId} - audio energy too low (${audioMetrics.averageEnergy.toFixed(6)} < ${energyThreshold.toFixed(6)})`)
          return {
            text: '',
            sourceType: options.sourceType,
            processingTime: Date.now() - startTime,
            language: options.language,
            confidence: 0
          }
        }

        // Additional check for mostly silent audio
        const silentRatio = audioMetrics.silentFrames / audioMetrics.totalFrames
        if (silentRatio > 0.85) { // If more than 85% of frames are silent
          console.log(`[LocalTranscription] Skipping transcription ${sessionId} - audio mostly silent (${(silentRatio * 100).toFixed(1)}% silent frames)`)
          return {
            text: '',
            sourceType: options.sourceType,
            processingTime: Date.now() - startTime,
            language: options.language,
            confidence: 0
          }
        }
      }

      // Write audio to temporary file
      const tempAudioFile = await this.writeAudioToTempFile(audioBuffer, sessionId)

      // Get model path
      const modelPath = await this.getModelPath(options.modelSize || 'tiny')

      // Execute whisper.cpp
      const transcriptionText = await this.executeWhisper(tempAudioFile, modelPath, options)

      // Post-process transcription result for noise filtering
      const filteredText = options.enableNoiseFiltering !== false
        ? this.filterTranscriptionResult(transcriptionText, options)
        : transcriptionText

      // Keep WAV file for debugging (comment out cleanup)
      // await this.cleanupTempFile(tempAudioFile)
      console.log(`[LocalTranscription] 🔍 WAV file preserved for inspection: ${tempAudioFile}`)

      const processingTime = Date.now() - startTime

      console.log(`[LocalTranscription] Completed transcription ${sessionId}`, {
        originalText: `"${transcriptionText}"`,
        filteredText: `"${filteredText}"`,
        wasFiltered: transcriptionText !== filteredText,
        processingTime: `${processingTime}ms`,
        sourceType: options.sourceType
      })

      return {
        text: filteredText,
        sourceType: options.sourceType,
        processingTime,
        language: options.language
      }
    } catch (error) {
      console.error(`[LocalTranscription] Failed transcription ${sessionId}:`, error)
      throw error
    }
  }

  /**
   * Get available models information
   */
  async getAvailableModels(): Promise<ModelInfo[]> {
    const models: ModelInfo[] = [
      { name: 'tiny', size: '39MB', downloaded: false },
      { name: 'base', size: '74MB', downloaded: false },
      { name: 'small', size: '244MB', downloaded: false },
      { name: 'medium', size: '769MB', downloaded: false }
    ]

    for (const model of models) {
      const modelPath = path.join(this.modelsPath, `ggml-${model.name}.bin`)
      try {
        await fs.access(modelPath)
        model.downloaded = true
        model.path = modelPath
      } catch {
        model.downloaded = false
      }
    }

    return models
  }

  /**
   * Download a specific model with progress tracking
   */
  async downloadModel(modelName: string, onProgress?: (progress: { downloaded: number; total: number; percentage: number }) => void): Promise<boolean> {
    // Check if there's already a download in progress for this model
    const existingPromise = this.downloadPromises.get(modelName)
    if (existingPromise) {
      console.log(`[LocalTranscription] Download already in progress for model: ${modelName}, waiting for completion...`)
      return existingPromise
    }

    // Create a new download promise and store it
    const downloadPromise = this._performDownload(modelName, onProgress)
    this.downloadPromises.set(modelName, downloadPromise)

    // Clean up the promise when done
    downloadPromise.finally(() => {
      this.downloadPromises.delete(modelName)
    })

    return downloadPromise
  }

  /**
   * Internal method to perform the actual download
   */
  private async _performDownload(modelName: string, onProgress?: (progress: { downloaded: number; total: number; percentage: number }) => void): Promise<boolean> {
    console.log(`[LocalTranscription] Starting download for model: ${modelName}`)

    const modelUrl = `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-${modelName}.bin`
    const modelPath = path.join(this.modelsPath, `ggml-${modelName}.bin`)
    const tempPath = `${modelPath}.download`

    try {
      // Check if model already exists
      try {
        await fs.access(modelPath)
        console.log(`[LocalTranscription] Model ${modelName} already exists, skipping download`)
        return true
      } catch {
        // Model doesn't exist, proceed with download
      }

      console.log(`[LocalTranscription] Starting download from: ${modelUrl}`)
      console.log(`[LocalTranscription] Saving to: ${modelPath}`)

      // Clean up any existing temp file from previous failed downloads
      try {
        await fs.access(tempPath)
        console.log(`[LocalTranscription] Found existing temp file, removing: ${tempPath}`)
        await fs.unlink(tempPath)
      } catch {
        // Temp file doesn't exist, which is expected
      }

      // Use fetch to download with progress tracking
      const response = await fetch(modelUrl)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const totalSize = parseInt(response.headers.get('content-length') || '0', 10)
      let downloadedSize = 0

      if (!response.body) {
        throw new Error('Response body is null')
      }

      // Create write stream
      const writeStream = (await import('fs')).createWriteStream(tempPath)
      const reader = response.body.getReader()

      try {
        while (true) {
          const { done, value } = await reader.read()

          if (done) break

          downloadedSize += value.length
          writeStream.write(Buffer.from(value))

          // Report progress
          if (onProgress && totalSize > 0) {
            const percentage = Math.round((downloadedSize / totalSize) * 100)
            onProgress({
              downloaded: downloadedSize,
              total: totalSize,
              percentage
            })
          }
        }

        writeStream.end()

        // Wait for write stream to finish
        await new Promise((resolve, reject) => {
          writeStream.on('finish', resolve)
          writeStream.on('error', reject)
        })

        // Move from temp to final location
        await fs.rename(tempPath, modelPath)

        console.log(`[LocalTranscription] Successfully downloaded model ${modelName} (${downloadedSize} bytes)`)
        return true

      } catch (error) {
        // Cleanup temp file on error
        try {
          await fs.unlink(tempPath)
        } catch {}
        throw error
      }

    } catch (error) {
      console.error(`[LocalTranscription] Failed to download model ${modelName}:`, error)
      return false
    }
  }

  /**
   * Delete a downloaded model
   */
  async deleteModel(modelName: string): Promise<boolean> {
    console.log(`[LocalTranscription] Deleting model: ${modelName}`)

    const modelPath = path.join(this.modelsPath, `ggml-${modelName}.bin`)

    try {
      await fs.access(modelPath)
      await fs.unlink(modelPath)
      console.log(`[LocalTranscription] Successfully deleted model: ${modelName}`)
      return true
    } catch (error) {
      console.error(`[LocalTranscription] Failed to delete model ${modelName}:`, error)
      return false
    }
  }

  /**
   * Get storage usage information
   */
  async getStorageUsage(): Promise<{ totalBytes: number; models: Array<{ name: string; sizeBytes: number }> }> {
    try {
      const models = await this.getAvailableModels()
      const modelSizes: Array<{ name: string; sizeBytes: number }> = []
      let totalBytes = 0

      for (const model of models) {
        if (model.downloaded && model.path) {
          try {
            const stats = await fs.stat(model.path)
            const sizeBytes = stats.size
            modelSizes.push({ name: model.name, sizeBytes })
            totalBytes += sizeBytes
          } catch (error) {
            console.warn(`[LocalTranscription] Could not get size for model ${model.name}:`, error)
          }
        }
      }

      return { totalBytes, models: modelSizes }
    } catch (error) {
      console.error('[LocalTranscription] Failed to get storage usage:', error)
      return { totalBytes: 0, models: [] }
    }
  }

  /**
   * Ensure at least one model is available, downloading if necessary
   */
  async ensureModelAvailable(onProgress?: (modelName: string, progress: { downloaded: number; total: number; percentage: number }) => void): Promise<boolean> {
    console.log('[LocalTranscription] Ensuring model availability...')

    try {
      const models = await this.getAvailableModels()
      const downloadedModels = models.filter(m => m.downloaded)

      if (downloadedModels.length > 0) {
        console.log(`[LocalTranscription] Found ${downloadedModels.length} existing models:`, downloadedModels.map(m => m.name))
        return true
      }

      console.log('[LocalTranscription] No models found, downloading tiny model...')

      const success = await this.downloadModel('tiny', (progress) => {
        onProgress?.('tiny', progress)
      })

      if (success) {
        console.log('[LocalTranscription] Tiny model downloaded successfully')
        return true
      } else {
        console.error('[LocalTranscription] Failed to download tiny model')
        return false
      }

    } catch (error) {
      console.error('[LocalTranscription] Error ensuring model availability:', error)
      return false
    }
  }

  /**
   * Cleanup service and terminate active processes
   */
  async cleanup(): Promise<void> {
    console.log('[LocalTranscription] Cleaning up service...')

    // Terminate any active whisper processes
    for (const [sessionId, process] of this.activeProcesses) {
      console.log(`[LocalTranscription] Terminating active process: ${sessionId}`)
      process.kill('SIGTERM')
    }
    this.activeProcesses.clear()

    // Cleanup temporary files
    try {
      await this.cleanupTempDirectory()
    } catch (error) {
      console.warn('[LocalTranscription] Error cleaning temp directory:', error)
    }

    this.isInitialized = false
    console.log('[LocalTranscription] Service cleanup completed')
  }

  // Private helper methods

  private async ensureDirectories(): Promise<void> {
    await fs.mkdir(this.modelsPath, { recursive: true })
    await fs.mkdir(this.tempPath, { recursive: true })
  }

  private async validateBinary(): Promise<boolean> {
    try {
      console.log(`[LocalTranscription] Checking binary at: ${this.whisperBinaryPath}`)

      // Check if file exists
      await fs.access(this.whisperBinaryPath, fs.constants.F_OK)
      console.log(`[LocalTranscription] Binary file exists`)

      // Check if file is executable
      await fs.access(this.whisperBinaryPath, fs.constants.X_OK)
      console.log(`[LocalTranscription] Binary is executable`)

      // Get file stats for debugging
      const stats = await fs.stat(this.whisperBinaryPath)
      console.log(`[LocalTranscription] Binary stats:`, {
        size: stats.size,
        mode: stats.mode.toString(8),
        isFile: stats.isFile()
      })

      return true
    } catch (error) {
      console.error(`[LocalTranscription] Binary validation failed:`, error)
      return false
    }
  }

  private async ensureDefaultModel(): Promise<void> {
    const tinyModelPath = path.join(this.modelsPath, 'ggml-tiny.bin')
    try {
      await fs.access(tinyModelPath)
      console.log('[LocalTranscription] Default tiny model already exists')
    } catch {
      console.log('[LocalTranscription] Default tiny model not found, will be downloaded on first use via ensureModelAvailable()')
      // Note: Model will be downloaded automatically when ensureModelAvailable() is called
      // by the renderer process during initialization
    }
  }

  private async writeAudioToTempFile(audioBuffer: ArrayBuffer, sessionId: string): Promise<string> {
    const tempFileName = `audio-${sessionId}.wav`
    const tempFilePath = path.join(this.tempPath, tempFileName)

    // Convert ArrayBuffer to proper WAV file
    const wavBuffer = this.createWavFile(audioBuffer)
    await fs.writeFile(tempFilePath, wavBuffer)

    console.log(`[LocalTranscription] 💾 Created WAV file: ${tempFilePath} (${wavBuffer.length} bytes)`)

    return tempFilePath
  }

  /**
   * Create a proper WAV file from raw PCM data
   */
  private createWavFile(pcmData: ArrayBuffer): Buffer {
    const pcmBuffer = Buffer.from(pcmData)
    const sampleRate = 16000  // 16kHz as expected by whisper.cpp
    const numChannels = 1     // Mono
    const bitsPerSample = 16  // 16-bit PCM
    const bytesPerSample = bitsPerSample / 8
    const blockAlign = numChannels * bytesPerSample
    const byteRate = sampleRate * blockAlign

    // WAV file header (44 bytes)
    const header = Buffer.alloc(44)
    let offset = 0

    // RIFF header
    header.write('RIFF', offset); offset += 4
    header.writeUInt32LE(36 + pcmBuffer.length, offset); offset += 4  // File size - 8
    header.write('WAVE', offset); offset += 4

    // Format chunk
    header.write('fmt ', offset); offset += 4
    header.writeUInt32LE(16, offset); offset += 4  // Format chunk size
    header.writeUInt16LE(1, offset); offset += 2   // Audio format (PCM)
    header.writeUInt16LE(numChannels, offset); offset += 2  // Number of channels
    header.writeUInt32LE(sampleRate, offset); offset += 4   // Sample rate
    header.writeUInt32LE(byteRate, offset); offset += 4     // Byte rate
    header.writeUInt16LE(blockAlign, offset); offset += 2   // Block align
    header.writeUInt16LE(bitsPerSample, offset); offset += 2 // Bits per sample

    // Data chunk
    header.write('data', offset); offset += 4
    header.writeUInt32LE(pcmBuffer.length, offset)  // Data size

    // Combine header and PCM data
    return Buffer.concat([header, pcmBuffer])
  }

  private async getModelPath(modelSize: string): Promise<string> {
    const modelPath = path.join(this.modelsPath, `ggml-${modelSize}.bin`)

    try {
      await fs.access(modelPath)
      return modelPath
    } catch {
      // Fallback to tiny model if requested model not available
      const tinyModelPath = path.join(this.modelsPath, 'ggml-tiny.bin')
      try {
        await fs.access(tinyModelPath)
        console.warn(`[LocalTranscription] Model ${modelSize} not found, falling back to tiny`)
        return tinyModelPath
      } catch {
        throw new Error(`No whisper models available. Please download at least the tiny model.`)
      }
    }
  }

  private async executeWhisper(
    audioFilePath: string,
    modelPath: string,
    options: TranscriptionOptions
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const args = [
        audioFilePath,
        '--model', modelPath,
        '--no-timestamps',
        '--no-prints',
        '--threads', '4'
      ]

      // Add language if specified, converting to whisper.cpp format
      if (options.language) {
        const whisperLanguage = this.convertToWhisperLanguage(options.language)
        if (whisperLanguage) {
          args.push('--language', whisperLanguage)
          console.log(`[LocalTranscription] Converted language '${options.language}' to '${whisperLanguage}' for whisper.cpp`)
        } else {
          console.log(`[LocalTranscription] Skipping unsupported language '${options.language}', using auto-detection`)
        }
      }

      console.log(`[LocalTranscription] Executing whisper.cpp:`, {
        binary: this.whisperBinaryPath,
        args: args.join(' '),
        audioFile: audioFilePath
      })

      const process = spawn(this.whisperBinaryPath, args)
      const sessionId = path.basename(audioFilePath, '.wav')
      this.activeProcesses.set(sessionId, process)

      let stdout = ''
      let stderr = ''

      process.stdout.on('data', (data) => {
        stdout += data.toString()
      })

      process.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      process.on('close', (code) => {
        this.activeProcesses.delete(sessionId)

        console.log(`[LocalTranscription] whisper.cpp finished with code ${code}`, {
          stdout: stdout ? `"${stdout.trim()}"` : '(empty)',
          stderr: stderr ? `"${stderr.trim()}"` : '(empty)',
          stdoutLength: stdout.length,
          stderrLength: stderr.length
        })

        if (code === 0) {
          const transcription = stdout.trim()
          resolve(transcription)
        } else {
          console.error(`[LocalTranscription] whisper.cpp exited with code ${code}`)
          console.error(`[LocalTranscription] stderr:`, stderr)
          reject(new Error(`Whisper process failed with exit code ${code}: ${stderr}`))
        }
      })

      process.on('error', (error) => {
        this.activeProcesses.delete(sessionId)
        console.error(`[LocalTranscription] Process error:`, error)
        reject(error)
      })

      // Set timeout for long-running processes
      setTimeout(() => {
        if (this.activeProcesses.has(sessionId)) {
          console.warn(`[LocalTranscription] Process timeout, killing: ${sessionId}`)
          process.kill('SIGTERM')
          this.activeProcesses.delete(sessionId)
          reject(new Error('Transcription process timeout'))
        }
      }, 30000) // 30 second timeout
    })
  }

  private async cleanupTempFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath)
    } catch (error) {
      console.warn(`[LocalTranscription] Could not delete temp file ${filePath}:`, error)
    }
  }

  private async cleanupTempDirectory(): Promise<void> {
    try {
      const files = await fs.readdir(this.tempPath)
      const oldFiles = []

      for (const file of files) {
        const filePath = path.join(this.tempPath, file)
        const stats = await fs.stat(filePath)
        const ageMs = Date.now() - stats.mtime.getTime()

        // Remove files older than 1 hour
        if (ageMs > 60 * 60 * 1000) {
          oldFiles.push(filePath)
        }
      }

      await Promise.all(oldFiles.map(file => fs.unlink(file).catch(console.warn)))

      if (oldFiles.length > 0) {
        console.log(`[LocalTranscription] Cleaned up ${oldFiles.length} old temp files`)
      }
    } catch (error) {
      console.warn('[LocalTranscription] Error during temp directory cleanup:', error)
    }
  }

  /**
   * Analyze audio energy to detect speech vs noise
   */
  private analyzeAudioEnergy(audioBuffer: ArrayBuffer): {
    averageEnergy: number
    maxEnergy: number
    silentFrames: number
    totalFrames: number
  } {
    const samples = new Int16Array(audioBuffer)
    const frameSize = 1024 // Analyze in 1024-sample frames
    const silenceThreshold = 500 // Absolute amplitude threshold for silence

    let totalEnergy = 0
    let maxEnergy = 0
    let silentFrames = 0
    let totalFrames = 0

    for (let i = 0; i < samples.length; i += frameSize) {
      const frameEnd = Math.min(i + frameSize, samples.length)
      let frameEnergy = 0
      let maxFrameAmplitude = 0

      // Calculate RMS energy for this frame
      for (let j = i; j < frameEnd; j++) {
        const amplitude = Math.abs(samples[j])
        frameEnergy += amplitude * amplitude
        maxFrameAmplitude = Math.max(maxFrameAmplitude, amplitude)
      }

      const frameLength = frameEnd - i
      const rmsEnergy = Math.sqrt(frameEnergy / frameLength) / 32768 // Normalize to 0-1

      totalEnergy += rmsEnergy
      maxEnergy = Math.max(maxEnergy, rmsEnergy)
      totalFrames++

      // Count as silent frame if max amplitude is below threshold
      if (maxFrameAmplitude < silenceThreshold) {
        silentFrames++
      }
    }

    return {
      averageEnergy: totalFrames > 0 ? totalEnergy / totalFrames : 0,
      maxEnergy,
      silentFrames,
      totalFrames
    }
  }

  /**
   * Filter transcription results to remove hallucinations and noise artifacts
   */
  private filterTranscriptionResult(text: string, options: TranscriptionOptions): string {
    if (!text || !text.trim()) {
      return ''
    }

    const originalText = text.trim()

    // Pattern detection for common Whisper hallucinations
    const hallucination_patterns = [
      // Single or few Chinese/Japanese/Korean characters (common noise hallucination)
      /^[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]{1,3}$/,
      // Parenthetical expressions that are likely noise
      /^\([^)]*\)$/,
      // Bracket expressions
      /^\[[^\]]*\]$/,
      // Single words that are clearly not speech in expected language
      /^(Thanks for watching|Thank you|Thanks|Bye|Hello)$/i,
      // Very short nonsensical text
      /^[^a-zA-Z0-9\s]{1,5}$/,
      // Repeated characters or patterns
      /^(..)\1{3,}$/,
      // Only punctuation
      /^[\s\p{P}]+$/u
    ]

    // Check for hallucination patterns
    for (const pattern of hallucination_patterns) {
      if (pattern.test(originalText)) {
        console.log(`[LocalTranscription] Filtered hallucination: "${originalText}" (matched pattern: ${pattern})`)
        return ''
      }
    }

    // Language-specific filtering
    if (options.language && options.language.startsWith('en')) {
      // If English is expected, filter out mostly non-Latin text
      const latinChars = originalText.match(/[a-zA-Z0-9\s\p{P}]/gu)?.length || 0
      const totalChars = originalText.length
      const latinRatio = latinChars / totalChars

      if (latinRatio < 0.7 && totalChars < 50) { // Less than 70% Latin chars in short text
        console.log(`[LocalTranscription] Filtered non-English text: "${originalText}" (${(latinRatio * 100).toFixed(1)}% Latin characters)`)
        return ''
      }
    }

    // Length-based filtering for very short results
    if (originalText.length <= 2) {
      console.log(`[LocalTranscription] Filtered very short text: "${originalText}"`)
      return ''
    }

    // Check for repetitive content (likely noise artifacts)
    const words = originalText.toLowerCase().split(/\s+/)
    if (words.length > 1) {
      const uniqueWords = new Set(words)
      const repetitionRatio = words.length / uniqueWords.size
      if (repetitionRatio > 3) { // Same words repeated more than 3 times on average
        console.log(`[LocalTranscription] Filtered repetitive text: "${originalText}" (repetition ratio: ${repetitionRatio.toFixed(1)})`)
        return ''
      }
    }

    // Text passes all filters
    return originalText
  }

  /**
   * Convert locale-style language codes to whisper.cpp supported language codes
   */
  private convertToWhisperLanguage(language: string): string | null {
    // Language code mapping for whisper.cpp compatibility
    const languageMap: Record<string, string> = {
      // Chinese variants
      'zh': 'chinese',
      'zh-cn': 'chinese',
      'zh-tw': 'chinese',
      'zh-hk': 'chinese',

      // Common languages
      'en': 'english',
      'en-us': 'english',
      'en-gb': 'english',
      'es': 'spanish',
      'fr': 'french',
      'de': 'german',
      'it': 'italian',
      'pt': 'portuguese',
      'ru': 'russian',
      'ja': 'japanese',
      'ko': 'korean',
      'ar': 'arabic',
      'hi': 'hindi',
      'th': 'thai',
      'vi': 'vietnamese',
      'nl': 'dutch',
      'tr': 'turkish',
      'pl': 'polish',
      'sv': 'swedish',
      'da': 'danish',
      'no': 'norwegian',
      'fi': 'finnish',
      'hu': 'hungarian',
      'cs': 'czech',
      'sk': 'slovak',
      'sl': 'slovenian',
      'hr': 'croatian',
      'bg': 'bulgarian',
      'ro': 'romanian',
      'uk': 'ukrainian',
      'el': 'greek',
      'he': 'hebrew',
      'fa': 'persian',
      'ur': 'urdu',
      'bn': 'bengali',
      'ta': 'tamil',
      'te': 'telugu',
      'ml': 'malayalam',
      'kn': 'kannada',
      'gu': 'gujarati',
      'pa': 'punjabi',
      'mr': 'marathi',
      'ne': 'nepali',
      'si': 'sinhala',
      'my': 'burmese',
      'km': 'khmer',
      'lo': 'lao',
      'ka': 'georgian',
      'am': 'amharic',
      'sw': 'swahili',
      'yo': 'yoruba',
      'zu': 'zulu',
      'af': 'afrikaans',
      'sq': 'albanian',
      'az': 'azerbaijani',
      'be': 'belarusian',
      'bs': 'bosnian',
      'ca': 'catalan',
      'cy': 'welsh',
      'et': 'estonian',
      'eu': 'basque',
      'fo': 'faroese',
      'gl': 'galician',
      'is': 'icelandic',
      'ga': 'irish',
      'lv': 'latvian',
      'lt': 'lithuanian',
      'lb': 'luxembourgish',
      'mk': 'macedonian',
      'mt': 'maltese',
      'mn': 'mongolian',
      'sr': 'serbian',
      'tl': 'tagalog',
      'tt': 'tatar',
      'uz': 'uzbek'
    }

    const normalizedLanguage = language.toLowerCase()

    // Direct match
    if (languageMap[normalizedLanguage]) {
      return languageMap[normalizedLanguage]
    }

    // Try base language (e.g., 'en' from 'en-us')
    const baseLanguage = normalizedLanguage.split('-')[0]
    if (languageMap[baseLanguage]) {
      return languageMap[baseLanguage]
    }

    // No mapping found
    return null
  }
}

// Singleton instance
let localTranscriptionService: LocalTranscriptionService | null = null

export function getLocalTranscriptionService(): LocalTranscriptionService {
  if (!localTranscriptionService) {
    localTranscriptionService = new LocalTranscriptionService()
  }
  return localTranscriptionService
}