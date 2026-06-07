#!/usr/bin/env node

/**
 * Simple test script for local transcription functionality
 * This tests the core whisper.cpp integration without Electron
 */

import { spawn } from 'child_process'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Test configuration
const WHISPER_BINARY = path.join(__dirname, '../../resources/whisper.cpp/whisper-darwin-arm64')
const MODEL_PATH = path.join(__dirname, '../../resources/whisper.cpp/models/ggml-tiny.bin')
const TEST_AUDIO = '/tmp/test.wav'

async function testWhisperBinary() {
  console.log('🧪 Testing Local Transcription Service')
  console.log('=====================================')

  // Check if binary exists
  try {
    await fs.access(WHISPER_BINARY, fs.constants.F_OK | fs.constants.X_OK)
    console.log('✅ Whisper binary found and executable')
  } catch (error) {
    console.error('❌ Whisper binary not found or not executable:', WHISPER_BINARY)
    return false
  }

  // Check if model exists
  try {
    await fs.access(MODEL_PATH)
    console.log('✅ Tiny model found')
  } catch (error) {
    console.error('❌ Tiny model not found:', MODEL_PATH)
    return false
  }

  // Check if test audio exists
  try {
    await fs.access(TEST_AUDIO)
    console.log('✅ Test audio file found')
  } catch (error) {
    console.error('❌ Test audio file not found:', TEST_AUDIO)
    console.log('💡 Download test audio with:')
    console.log(
      '   curl -L -o /tmp/test.wav https://cdn.openai.com/whisper/draft-20220913a/micro-machines.wav'
    )
    return false
  }

  // Test transcription
  console.log('\n🎯 Running transcription test...')
  const startTime = Date.now()

  try {
    const result = await runTranscription(TEST_AUDIO, MODEL_PATH)
    const endTime = Date.now()
    const duration = endTime - startTime

    console.log('\n✅ Transcription completed successfully!')
    console.log(`⏱️  Processing time: ${duration}ms`)
    console.log(`📝 Result: "${result.trim()}"`)
    console.log(`📊 Length: ${result.length} characters`)

    return true
  } catch (error) {
    console.error('❌ Transcription failed:', error.message)
    return false
  }
}

function runTranscription(audioPath, modelPath) {
  return new Promise((resolve, reject) => {
    const args = [
      audioPath,
      '--model',
      modelPath,
      '--no-timestamps',
      '--no-prints',
      '--threads',
      '4'
    ]

    console.log(`🚀 Executing: ${WHISPER_BINARY} ${args.join(' ')}`)

    const process = spawn(WHISPER_BINARY, args)
    let stdout = ''
    let stderr = ''

    process.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    process.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    process.on('close', (code) => {
      if (code === 0) {
        resolve(stdout)
      } else {
        reject(new Error(`Process exited with code ${code}. stderr: ${stderr}`))
      }
    })

    process.on('error', (error) => {
      reject(error)
    })

    // Set timeout
    setTimeout(() => {
      process.kill('SIGTERM')
      reject(new Error('Process timeout after 30 seconds'))
    }, 30000)
  })
}

// Run the test
testWhisperBinary()
  .then((success) => {
    if (success) {
      console.log('\n All tests passed! Local transcription is ready.')
      process.exit(0)
    } else {
      console.log('\n💥 Tests failed. Please check the setup.')
      process.exit(1)
    }
  })
  .catch((error) => {
    console.error('\n💥 Test runner error:', error)
    process.exit(1)
  })
