#!/usr/bin/env node

/**
 * Comprehensive test suite for local transcription
 * Tests all components and edge cases
 */

import { spawn } from 'child_process'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Test configuration
const WHISPER_BINARY = path.join(__dirname, 'resources/whisper.cpp/whisper-darwin-arm64')
const MODEL_PATH = path.join(__dirname, 'resources/whisper.cpp/models/ggml-tiny.bin')
const TEST_AUDIO = '/tmp/test.wav'

class TestSuite {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      tests: []
    }
  }

  async run() {
    console.log('🧪 Comprehensive Local Transcription Test Suite')
    console.log('================================================')

    await this.testBasicSetup()
    await this.testBinaryExecution()
    await this.testPerformance()
    await this.testErrorHandling()
    await this.testMemoryUsage()
    await this.testLanguageSupport()

    this.printSummary()
    return this.results.failed === 0
  }

  async test(name, testFn) {
    console.log(`\n🔍 Testing: ${name}`)
    try {
      const startTime = Date.now()
      const result = await testFn()
      const duration = Date.now() - startTime

      if (result === false) {
        throw new Error('Test returned false')
      }

      console.log(`✅ PASS: ${name} (${duration}ms)`)
      this.results.passed++
      this.results.tests.push({ name, status: 'PASS', duration, error: null })
    } catch (error) {
      console.error(`❌ FAIL: ${name} - ${error.message}`)
      this.results.failed++
      this.results.tests.push({ name, status: 'FAIL', duration: 0, error: error.message })
    }
  }

  async testBasicSetup() {
    console.log('\n📋 Basic Setup Tests')
    console.log('--------------------')

    await this.test('Binary file exists and is executable', async () => {
      await fs.access(WHISPER_BINARY, fs.constants.F_OK | fs.constants.X_OK)
      return true
    })

    await this.test('Model file exists and has correct size', async () => {
      const stats = await fs.stat(MODEL_PATH)
      // Tiny model should be around 75MB
      if (stats.size < 30 * 1024 * 1024 || stats.size > 100 * 1024 * 1024) {
        throw new Error(`Model size ${Math.round(stats.size / 1024 / 1024)}MB seems incorrect`)
      }
      console.log(`   Model size: ${Math.round(stats.size / 1024 / 1024)}MB`)
      return true
    })

    await this.test('Test audio file exists', async () => {
      await fs.access(TEST_AUDIO)
      const stats = await fs.stat(TEST_AUDIO)
      console.log(`   Audio size: ${Math.round(stats.size / 1024)}KB`)
      return true
    })

    await this.test('Binary architecture is correct', async () => {
      const { stdout } = await this.execCommand('file', [WHISPER_BINARY])
      if (!stdout.includes('arm64')) {
        throw new Error(`Expected ARM64 binary, got: ${stdout}`)
      }
      console.log(`   Architecture: ARM64 ✅`)
      return true
    })
  }

  async testBinaryExecution() {
    console.log('\n⚡ Binary Execution Tests')
    console.log('-------------------------')

    await this.test('Help command works', async () => {
      const { stdout, stderr } = await this.execCommand(WHISPER_BINARY, ['--help'])
      if (!stdout.includes('usage:') && !stderr.includes('usage:')) {
        throw new Error('Help output not found')
      }
      return true
    })

    await this.test('Basic transcription works', async () => {
      const result = await this.runTranscription(TEST_AUDIO, MODEL_PATH)
      if (!result || result.length < 100) {
        throw new Error(`Transcription too short: ${result.length} chars`)
      }
      console.log(`   Transcription length: ${result.length} characters`)
      return true
    })

    await this.test('Transcription with language parameter', async () => {
      const result = await this.runTranscription(TEST_AUDIO, MODEL_PATH, { language: 'en' })
      if (!result || result.length < 100) {
        throw new Error('Language-specific transcription failed')
      }
      return true
    })

    await this.test('Transcription with thread parameter', async () => {
      const result = await this.runTranscription(TEST_AUDIO, MODEL_PATH, { threads: '2' })
      if (!result || result.length < 100) {
        throw new Error('Multi-threaded transcription failed')
      }
      return true
    })
  }

  async testPerformance() {
    console.log('\n🚀 Performance Tests')
    console.log('--------------------')

    await this.test('Performance benchmark (5 iterations)', async () => {
      const iterations = 5
      const times = []

      for (let i = 0; i < iterations; i++) {
        const start = Date.now()
        await this.runTranscription(TEST_AUDIO, MODEL_PATH)
        const end = Date.now()
        times.push(end - start)
      }

      const avg = times.reduce((a, b) => a + b) / times.length
      const min = Math.min(...times)
      const max = Math.max(...times)

      console.log(`   Average: ${avg.toFixed(1)}ms`)
      console.log(`   Min: ${min}ms`)
      console.log(`   Max: ${max}ms`)

      // Performance should be under 2 seconds on average
      if (avg > 2000) {
        throw new Error(`Performance too slow: ${avg}ms average`)
      }

      return true
    })

    await this.test('Memory usage during transcription', async () => {
      // Get memory usage before
      const memBefore = await this.getMemoryUsage()

      // Run transcription
      await this.runTranscription(TEST_AUDIO, MODEL_PATH)

      // Get memory usage after
      const memAfter = await this.getMemoryUsage()

      const memDiff = memAfter - memBefore
      console.log(`   Memory delta: ${memDiff}MB`)

      // Should not leak significant memory
      if (memDiff > 100) {
        throw new Error(`Potential memory leak: ${memDiff}MB increase`)
      }

      return true
    })
  }

  async testErrorHandling() {
    console.log('\n🛡️ Error Handling Tests')
    console.log('-----------------------')

    await this.test('Invalid audio file handling', async () => {
      try {
        await this.runTranscription('/nonexistent/file.wav', MODEL_PATH)
        throw new Error('Should have failed with invalid file')
      } catch (error) {
        if (error.message.includes('Should have failed')) {
          throw error
        }
        // Expected error
        return true
      }
    })

    await this.test('Invalid model file handling', async () => {
      try {
        await this.runTranscription(TEST_AUDIO, '/nonexistent/model.bin')
        throw new Error('Should have failed with invalid model')
      } catch (error) {
        if (error.message.includes('Should have failed')) {
          throw error
        }
        // Expected error
        return true
      }
    })

    await this.test('Process timeout handling', async () => {
      try {
        // Set very short timeout
        await this.runTranscription(TEST_AUDIO, MODEL_PATH, {}, 100) // 100ms timeout
        throw new Error('Should have timed out')
      } catch (error) {
        if (error.message.includes('timeout') || error.message.includes('SIGTERM')) {
          return true
        }
        throw error
      }
    })
  }

  async testMemoryUsage() {
    console.log('\n💾 Memory Usage Tests')
    console.log('--------------------')

    await this.test('Multiple concurrent transcriptions', async () => {
      const promises = []
      for (let i = 0; i < 3; i++) {
        promises.push(this.runTranscription(TEST_AUDIO, MODEL_PATH))
      }

      const results = await Promise.all(promises)

      // All should succeed
      for (const result of results) {
        if (!result || result.length < 100) {
          throw new Error('Concurrent transcription failed')
        }
      }

      console.log(`   Concurrent transcriptions: ${results.length} succeeded`)
      return true
    })

    await this.test('Sequential transcriptions (memory stability)', async () => {
      const iterations = 10
      let totalMemory = 0

      for (let i = 0; i < iterations; i++) {
        const memBefore = await this.getMemoryUsage()
        await this.runTranscription(TEST_AUDIO, MODEL_PATH)
        const memAfter = await this.getMemoryUsage()
        totalMemory += memAfter - memBefore
      }

      const avgMemoryDelta = totalMemory / iterations
      console.log(`   Average memory delta: ${avgMemoryDelta.toFixed(1)}MB`)

      // Should not accumulate memory over time
      if (avgMemoryDelta > 10) {
        throw new Error(`Memory accumulation detected: ${avgMemoryDelta}MB per iteration`)
      }

      return true
    })
  }

  async testLanguageSupport() {
    console.log('\n🌍 Language Support Tests')
    console.log('-------------------------')

    const languages = ['en', 'auto']

    for (const lang of languages) {
      await this.test(`Language support: ${lang}`, async () => {
        const result = await this.runTranscription(TEST_AUDIO, MODEL_PATH, { language: lang })
        if (!result || result.length < 50) {
          throw new Error(`Language ${lang} transcription failed`)
        }
        console.log(`   ${lang}: ${result.substring(0, 50)}...`)
        return true
      })
    }
  }

  async runTranscription(audioPath, modelPath, options = {}, timeoutMs = 30000) {
    const args = [
      audioPath,
      '--model',
      modelPath,
      '--no-timestamps',
      '--no-prints',
      '--threads',
      options.threads || '4'
    ]

    if (options.language) {
      args.push('--language', options.language)
    }

    return new Promise((resolve, reject) => {
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
          resolve(stdout.trim())
        } else {
          reject(new Error(`Process exited with code ${code}. stderr: ${stderr}`))
        }
      })

      process.on('error', (error) => {
        reject(error)
      })

      // Set timeout
      const timeout = setTimeout(() => {
        process.kill('SIGTERM')
        reject(new Error(`Process timeout after ${timeoutMs}ms`))
      }, timeoutMs)

      process.on('close', () => {
        clearTimeout(timeout)
      })
    })
  }

  async execCommand(command, args) {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args)
      let stdout = ''
      let stderr = ''

      process.stdout.on('data', (data) => {
        stdout += data.toString()
      })

      process.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      process.on('close', (code) => {
        resolve({ stdout, stderr, code })
      })

      process.on('error', (error) => {
        reject(error)
      })
    })
  }

  async getMemoryUsage() {
    try {
      const { stdout } = await this.execCommand('ps', ['-o', 'rss=', '-p', process.pid.toString()])
      const memoryKB = parseInt(stdout.trim())
      return memoryKB / 1024 // Convert to MB
    } catch {
      return 0 // Fallback if ps command fails
    }
  }

  printSummary() {
    console.log('\n📊 Test Summary')
    console.log('===============')
    console.log(`Total Tests: ${this.results.passed + this.results.failed}`)
    console.log(`✅ Passed: ${this.results.passed}`)
    console.log(`❌ Failed: ${this.results.failed}`)
    console.log(
      `Success Rate: ${((this.results.passed / (this.results.passed + this.results.failed)) * 100).toFixed(1)}%`
    )

    if (this.results.failed > 0) {
      console.log('\n🔥 Failed Tests:')
      this.results.tests
        .filter((test) => test.status === 'FAIL')
        .forEach((test) => {
          console.log(`   ❌ ${test.name}: ${test.error}`)
        })
    }

    console.log('\n⏱️ Performance Summary:')
    const passedTests = this.results.tests.filter((test) => test.status === 'PASS')
    const avgDuration =
      passedTests.reduce((sum, test) => sum + test.duration, 0) / passedTests.length
    console.log(`   Average test duration: ${avgDuration.toFixed(1)}ms`)

    const transcriptionTests = passedTests.filter((test) => test.name.includes('transcription'))
    if (transcriptionTests.length > 0) {
      const avgTranscription =
        transcriptionTests.reduce((sum, test) => sum + test.duration, 0) / transcriptionTests.length
      console.log(`   Average transcription time: ${avgTranscription.toFixed(1)}ms`)
    }
  }
}

// Run the comprehensive test suite
const testSuite = new TestSuite()
testSuite
  .run()
  .then((success) => {
    if (success) {
      console.log('\n All tests passed! System is ready for production.')
      process.exit(0)
    } else {
      console.log('\n💥 Some tests failed. Please check the issues above.')
      process.exit(1)
    }
  })
  .catch((error) => {
    console.error('\n💥 Test suite error:', error)
    process.exit(1)
  })
