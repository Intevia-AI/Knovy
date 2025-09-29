import { spawn, ChildProcess } from 'child_process'
import path from 'path'
import fs from 'fs/promises'
import { app } from 'electron'
import { randomUUID } from 'crypto'

export interface TranscriptionOptions {
  language?: string
  modelSize?: 'tiny' | 'base' | 'small' | 'medium'
  sourceType: 'microphone' | 'system'
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

  constructor() {
    // Platform-specific binary paths
    const platform = process.platform
    const arch = process.arch

    let binaryName = 'whisper'
    if (platform === 'win32') {
      binaryName = 'whisper.exe'
    }

    // For development, use resources path; for production, use app.asar
    const isDev = !app.isPackaged
    const resourcesPath = isDev
      ? path.join(__dirname, '../../resources')
      : path.join(process.resourcesPath)

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

      // Create necessary directories
      await this.ensureDirectories()

      // Validate whisper.cpp binary
      const binaryExists = await this.validateBinary()
      if (!binaryExists) {
        console.error('[LocalTranscription] whisper.cpp binary not found:', this.whisperBinaryPath)
        return false
      }

      // Ensure default model is available
      await this.ensureDefaultModel()

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
        modelSize: options.modelSize || 'tiny'
      })

      // Write audio to temporary file
      const tempAudioFile = await this.writeAudioToTempFile(audioBuffer, sessionId)

      // Get model path
      const modelPath = await this.getModelPath(options.modelSize || 'tiny')

      // Execute whisper.cpp
      const transcriptionText = await this.executeWhisper(tempAudioFile, modelPath, options)

      // Keep WAV file for debugging (comment out cleanup)
      // await this.cleanupTempFile(tempAudioFile)
      console.log(`[LocalTranscription] 🔍 WAV file preserved for inspection: ${tempAudioFile}`)

      const processingTime = Date.now() - startTime

      console.log(`[LocalTranscription] Completed transcription ${sessionId}`, {
        text: `"${transcriptionText}"`,
        processingTime: `${processingTime}ms`,
        sourceType: options.sourceType
      })

      return {
        text: transcriptionText,
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
   * Download a specific model
   */
  async downloadModel(modelName: string): Promise<boolean> {
    console.log(`[LocalTranscription] Downloading model: ${modelName}`)

    const modelUrl = `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-${modelName}.bin`
    const modelPath = path.join(this.modelsPath, `ggml-${modelName}.bin`)

    try {
      // Note: In production, implement proper download with progress tracking
      // For now, this is a placeholder for the download logic
      console.log(`[LocalTranscription] Model download URL: ${modelUrl}`)
      console.log(`[LocalTranscription] Model will be saved to: ${modelPath}`)

      // TODO: Implement actual download logic
      // - Use fetch/axios for download
      // - Show progress to user
      // - Verify checksum
      // - Handle resume/retry

      return true
    } catch (error) {
      console.error(`[LocalTranscription] Failed to download model ${modelName}:`, error)
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
      await fs.access(this.whisperBinaryPath, fs.constants.F_OK | fs.constants.X_OK)
      return true
    } catch {
      return false
    }
  }

  private async ensureDefaultModel(): Promise<void> {
    const tinyModelPath = path.join(this.modelsPath, 'ggml-tiny.bin')
    try {
      await fs.access(tinyModelPath)
      console.log('[LocalTranscription] Default tiny model already exists')
    } catch {
      console.log('[LocalTranscription] Default tiny model not found, copying from resources...')

      // Try to copy bundled model from resources
      const isDev = !app.isPackaged
      const resourcesPath = isDev
        ? path.join(__dirname, '../../resources')
        : path.join(process.resourcesPath)

      const bundledModelPath = path.join(resourcesPath, 'whisper.cpp', 'models', 'ggml-tiny.bin')

      try {
        await fs.access(bundledModelPath)
        await fs.copyFile(bundledModelPath, tinyModelPath)
        console.log('[LocalTranscription] Successfully copied bundled tiny model')
      } catch (copyError) {
        console.warn('[LocalTranscription] No bundled model found, user will need to download:', copyError.message)
      }
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