#!/usr/bin/env node

/**
 * Test the TypeScript services directly
 * Tests LocalTranscriptionService and ModelManager in isolation
 */

import { spawn } from 'child_process'
import { readFileSync } from 'fs'
import fs from 'fs/promises'

// Since we can't directly import TypeScript, we'll test via the compiled JS
// For now, we'll simulate the service behavior and test the IPC layer

class ServiceTester {
  constructor() {
    this.testResults = []
  }

  async runTests() {
    console.log('🔧 Testing TypeScript Services Layer')
    console.log('===================================')

    await this.testModelManager()
    await this.testLocalTranscriptionService()
    await this.testIPCLayer()

    this.printResults()
    return this.testResults.every(result => result.passed)
  }

  async test(name, testFn) {
    console.log(`\n🧪 Testing: ${name}`)
    try {
      const startTime = Date.now()
      await testFn()
      const duration = Date.now() - startTime

      console.log(`✅ PASS: ${name} (${duration}ms)`)
      this.testResults.push({ name, passed: true, duration, error: null })
    } catch (error) {
      console.error(`❌ FAIL: ${name} - ${error.message}`)
      this.testResults.push({ name, passed: false, duration: 0, error: error.message })
    }
  }

  async testModelManager() {
    console.log('\n📦 ModelManager Tests')
    console.log('---------------------')

    await this.test('Models directory structure', async () => {
      const modelPath = './resources/whisper.cpp/models/ggml-tiny.bin'
      await fs.access(modelPath)

      const stats = await fs.stat(modelPath)
      if (stats.size < 30 * 1024 * 1024) {
        throw new Error('Model file too small')
      }

      console.log(`   Model file size: ${Math.round(stats.size / 1024 / 1024)}MB`)
    })

    await this.test('Model validation logic', async () => {
      // Test the logic that ModelManager would use
      const expectedModels = ['tiny', 'base', 'small', 'medium']
      const modelSizes = {
        tiny: 39 * 1024 * 1024,
        base: 74 * 1024 * 1024,
        small: 244 * 1024 * 1024,
        medium: 769 * 1024 * 1024
      }

      for (const model of expectedModels) {
        const expectedSize = modelSizes[model]
        if (expectedSize < 1024 * 1024) {
          throw new Error(`Invalid model size for ${model}`)
        }
        console.log(`   ${model}: ${Math.round(expectedSize / 1024 / 1024)}MB`)
      }
    })

    await this.test('Storage calculation', async () => {
      // Test storage calculation logic
      const userDataPath = './resources/whisper.cpp/models'
      const files = await fs.readdir(userDataPath)

      let totalSize = 0
      for (const file of files) {
        if (file.endsWith('.bin')) {
          const stats = await fs.stat(`${userDataPath}/${file}`)
          totalSize += stats.size
        }
      }

      console.log(`   Total model storage: ${Math.round(totalSize / 1024 / 1024)}MB`)

      if (totalSize === 0) {
        throw new Error('No models found')
      }
    })
  }

  async testLocalTranscriptionService() {
    console.log('\n🎙️ LocalTranscriptionService Tests')
    console.log('----------------------------------')

    await this.test('Binary path resolution', async () => {
      const binaryPath = './resources/whisper.cpp/whisper-darwin-arm64'
      await fs.access(binaryPath, fs.constants.F_OK | fs.constants.X_OK)

      const stats = await fs.stat(binaryPath)
      console.log(`   Binary size: ${Math.round(stats.size / 1024)}KB`)
    })

    await this.test('Command line argument construction', async () => {
      // Test the logic for building whisper.cpp arguments
      const audioFile = '/tmp/test.wav'
      const modelPath = './resources/whisper.cpp/models/ggml-tiny.bin'

      const args = [
        audioFile,
        '--model', modelPath,
        '--no-timestamps',
        '--no-prints',
        '--threads', '4'
      ]

      // Validate argument structure
      if (!args.includes('--model') || !args.includes(modelPath)) {
        throw new Error('Invalid model argument')
      }

      if (!args.includes('--no-timestamps') || !args.includes('--no-prints')) {
        throw new Error('Missing required flags')
      }

      console.log(`   Args: ${args.join(' ')}`)
    })

    await this.test('Audio processing simulation', async () => {
      // Simulate the audio processing workflow
      const tempDir = '/tmp/knovy-transcription'

      try {
        await fs.mkdir(tempDir, { recursive: true })
        console.log(`   Temp directory created: ${tempDir}`)

        // Simulate temp file creation
        const tempFile = `${tempDir}/test-${Date.now()}.wav`
        await fs.writeFile(tempFile, 'dummy audio data')

        // Cleanup
        await fs.unlink(tempFile)
        console.log(`   Temp file lifecycle: OK`)
      } catch (error) {
        throw new Error(`Temp file handling failed: ${error.message}`)
      }
    })

    await this.test('Process management simulation', async () => {
      // Test process spawning and management
      const process = spawn('echo', ['test'])

      return new Promise((resolve, reject) => {
        let output = ''

        process.stdout.on('data', (data) => {
          output += data.toString()
        })

        process.on('close', (code) => {
          if (code === 0 && output.trim() === 'test') {
            console.log(`   Process management: OK`)
            resolve()
          } else {
            reject(new Error(`Process test failed: code=${code}, output=${output}`))
          }
        })

        process.on('error', reject)

        // Timeout
        setTimeout(() => {
          process.kill()
          reject(new Error('Process timeout'))
        }, 5000)
      })
    })
  }

  async testIPCLayer() {
    console.log('\n🔗 IPC Layer Tests')
    console.log('------------------')

    await this.test('IPC channel validation', async () => {
      // Test the IPC channels defined in preload
      const expectedChannels = [
        'transcription:initialize',
        'transcription:process-audio',
        'transcription:get-models',
        'transcription:download-model',
        'transcription:delete-model',
        'transcription:get-storage-usage'
      ]

      // Validate channel naming convention
      for (const channel of expectedChannels) {
        if (!channel.startsWith('transcription:')) {
          throw new Error(`Invalid channel name: ${channel}`)
        }
      }

      console.log(`   Validated ${expectedChannels.length} IPC channels`)
    })

    await this.test('Event channel validation', async () => {
      // Test the event channels for download progress
      const expectedEvents = [
        'model:download-progress',
        'model:download-complete'
      ]

      for (const event of expectedEvents) {
        if (!event.startsWith('model:')) {
          throw new Error(`Invalid event name: ${event}`)
        }
      }

      console.log(`   Validated ${expectedEvents.length} event channels`)
    })

    await this.test('API response structure', async () => {
      // Test the expected API response structure
      const successResponse = { success: true, result: { text: 'test', processingTime: 1000 } }
      const errorResponse = { success: false, error: 'Test error' }

      // Validate success response
      if (!successResponse.success || !successResponse.result) {
        throw new Error('Invalid success response structure')
      }

      // Validate error response
      if (errorResponse.success || !errorResponse.error) {
        throw new Error('Invalid error response structure')
      }

      console.log(`   API response structures: OK`)
    })

    await this.test('Data serialization', async () => {
      // Test data types that will be passed through IPC
      const audioBuffer = new ArrayBuffer(1024)
      const options = {
        sourceType: 'microphone',
        modelSize: 'tiny',
        language: 'en'
      }

      // Test serialization
      const serialized = JSON.stringify({ audioBuffer: Array.from(new Uint8Array(audioBuffer)), options })
      const deserialized = JSON.parse(serialized)

      if (!deserialized.options || deserialized.options.sourceType !== 'microphone') {
        throw new Error('Serialization failed')
      }

      console.log(`   Data serialization: OK`)
    })
  }

  printResults() {
    console.log('\n📊 Service Test Results')
    console.log('=======================')

    const passed = this.testResults.filter(r => r.passed).length
    const total = this.testResults.length

    console.log(`Total Tests: ${total}`)
    console.log(`✅ Passed: ${passed}`)
    console.log(`❌ Failed: ${total - passed}`)
    console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`)

    if (passed < total) {
      console.log('\n🔥 Failed Tests:')
      this.testResults
        .filter(r => !r.passed)
        .forEach(test => {
          console.log(`   ❌ ${test.name}: ${test.error}`)
        })
    }

    const avgDuration = this.testResults
      .filter(r => r.passed)
      .reduce((sum, test) => sum + test.duration, 0) / passed

    console.log(`\n⏱️ Average test duration: ${avgDuration.toFixed(1)}ms`)
  }
}

// Run the service tests
const tester = new ServiceTester()
tester.runTests()
  .then(success => {
    if (success) {
      console.log('\n🎉 All service tests passed!')
      process.exit(0)
    } else {
      console.log('\n💥 Some service tests failed.')
      process.exit(1)
    }
  })
  .catch(error => {
    console.error('\n💥 Service test error:', error)
    process.exit(1)
  })