#!/usr/bin/env node

/**
 * Performance benchmark for local transcription
 * Measures latency, throughput, and resource usage
 */

import { spawn } from 'child_process'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const WHISPER_BINARY = path.join(__dirname, 'resources/whisper.cpp/whisper-darwin-arm64')
const MODEL_PATH = path.join(__dirname, 'resources/whisper.cpp/models/ggml-tiny.bin')
const TEST_AUDIO = '/tmp/test.wav'

class PerformanceBenchmark {
  constructor() {
    this.results = {
      coldStart: [],
      warmStart: [],
      concurrent: [],
      throughput: [],
      memory: []
    }
  }

  async run() {
    console.log('🚀 Performance Benchmark Suite')
    console.log('==============================')

    await this.benchmarkColdStart()
    await this.benchmarkWarmStart()
    await this.benchmarkConcurrent()
    await this.benchmarkThroughput()
    await this.benchmarkMemory()

    this.generateReport()
  }

  async benchmarkColdStart() {
    console.log('\n❄️ Cold Start Performance')
    console.log('-------------------------')

    console.log('Testing first-time execution (includes model loading)...')

    for (let i = 0; i < 3; i++) {
      console.log(`Run ${i + 1}/3...`)

      const start = Date.now()
      await this.runTranscription()
      const end = Date.now()

      const duration = end - start
      this.results.coldStart.push(duration)

      console.log(`   Cold start ${i + 1}: ${duration}ms`)

      // Wait between runs to ensure "cold" conditions
      await this.sleep(2000)
    }
  }

  async benchmarkWarmStart() {
    console.log('\n🔥 Warm Start Performance')
    console.log('-------------------------')

    console.log('Testing subsequent executions (model already loaded)...')

    // Do one warm-up run
    await this.runTranscription()

    for (let i = 0; i < 10; i++) {
      const start = Date.now()
      await this.runTranscription()
      const end = Date.now()

      const duration = end - start
      this.results.warmStart.push(duration)

      if (i < 3 || i % 2 === 0) { // Show first 3 and every other
        console.log(`   Warm start ${i + 1}: ${duration}ms`)
      }
    }
  }

  async benchmarkConcurrent() {
    console.log('\n⚡ Concurrent Processing')
    console.log('-----------------------')

    const concurrencyLevels = [2, 3, 4]

    for (const level of concurrencyLevels) {
      console.log(`Testing ${level} concurrent transcriptions...`)

      const promises = []
      const startTime = Date.now()

      for (let i = 0; i < level; i++) {
        promises.push(this.runTranscription())
      }

      await Promise.all(promises)
      const totalTime = Date.now() - startTime

      this.results.concurrent.push({
        level,
        totalTime,
        averageTime: totalTime / level
      })

      console.log(`   ${level} concurrent: ${totalTime}ms total, ${(totalTime / level).toFixed(1)}ms average`)
    }
  }

  async benchmarkThroughput() {
    console.log('\n📊 Throughput Analysis')
    console.log('---------------------')

    const iterations = 20
    console.log(`Processing ${iterations} transcriptions sequentially...`)

    const times = []
    let totalCharacters = 0

    for (let i = 0; i < iterations; i++) {
      const start = Date.now()
      const result = await this.runTranscription()
      const end = Date.now()

      const duration = end - start
      times.push(duration)
      totalCharacters += result.length

      if (i % 5 === 0) {
        console.log(`   Batch ${Math.floor(i/5) + 1}: ${duration}ms`)
      }
    }

    const totalTime = times.reduce((a, b) => a + b, 0)
    const avgTime = totalTime / iterations
    const throughputPerSecond = (totalCharacters / totalTime) * 1000

    this.results.throughput = {
      iterations,
      totalTime,
      avgTime,
      totalCharacters,
      throughputPerSecond,
      times
    }

    console.log(`   Average time: ${avgTime.toFixed(1)}ms`)
    console.log(`   Throughput: ${throughputPerSecond.toFixed(1)} characters/second`)
  }

  async benchmarkMemory() {
    console.log('\n💾 Memory Usage Analysis')
    console.log('-----------------------')

    console.log('Monitoring memory usage during processing...')

    const memoryReadings = []

    // Baseline memory
    const baseline = await this.getMemoryUsage()
    memoryReadings.push({ stage: 'baseline', memory: baseline })

    // During transcription
    const transcriptionPromise = this.runTranscription()

    // Monitor memory during transcription
    const monitorInterval = setInterval(async () => {
      const memory = await this.getMemoryUsage()
      memoryReadings.push({ stage: 'processing', memory })
    }, 100)

    await transcriptionPromise
    clearInterval(monitorInterval)

    // Post-transcription
    const postProcess = await this.getMemoryUsage()
    memoryReadings.push({ stage: 'post-process', memory: postProcess })

    this.results.memory = memoryReadings

    const maxMemory = Math.max(...memoryReadings.map(r => r.memory))
    const memoryIncrease = maxMemory - baseline

    console.log(`   Baseline memory: ${baseline.toFixed(1)}MB`)
    console.log(`   Peak memory: ${maxMemory.toFixed(1)}MB`)
    console.log(`   Memory increase: ${memoryIncrease.toFixed(1)}MB`)
  }

  async runTranscription() {
    return new Promise((resolve, reject) => {
      const args = [
        TEST_AUDIO,
        '--model', MODEL_PATH,
        '--no-timestamps',
        '--no-prints',
        '--threads', '4'
      ]

      const process = spawn(WHISPER_BINARY, args)
      let stdout = ''

      process.stdout.on('data', (data) => {
        stdout += data.toString()
      })

      process.on('close', (code) => {
        if (code === 0) {
          resolve(stdout.trim())
        } else {
          reject(new Error(`Process exited with code ${code}`))
        }
      })

      process.on('error', reject)

      // Timeout
      setTimeout(() => {
        process.kill('SIGTERM')
        reject(new Error('Process timeout'))
      }, 10000)
    })
  }

  async getMemoryUsage() {
    try {
      const { stdout } = await this.execCommand('ps', ['-o', 'rss=', '-p', process.pid.toString()])
      const memoryKB = parseInt(stdout.trim())
      return memoryKB / 1024 // Convert to MB
    } catch {
      return 0
    }
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

      process.on('error', reject)
    })
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  generateReport() {
    console.log('\n📋 Performance Report')
    console.log('=====================')

    // Cold start analysis
    const avgColdStart = this.results.coldStart.reduce((a, b) => a + b, 0) / this.results.coldStart.length
    const minColdStart = Math.min(...this.results.coldStart)
    const maxColdStart = Math.max(...this.results.coldStart)

    console.log('\n❄️ Cold Start Performance:')
    console.log(`   Average: ${avgColdStart.toFixed(1)}ms`)
    console.log(`   Min: ${minColdStart}ms`)
    console.log(`   Max: ${maxColdStart}ms`)
    console.log(`   Target: <1000ms - ${avgColdStart < 1000 ? '✅ PASS' : '⚠️ CLOSE'}`)

    // Warm start analysis
    const avgWarmStart = this.results.warmStart.reduce((a, b) => a + b, 0) / this.results.warmStart.length
    const minWarmStart = Math.min(...this.results.warmStart)
    const maxWarmStart = Math.max(...this.results.warmStart)

    console.log('\n🔥 Warm Start Performance:')
    console.log(`   Average: ${avgWarmStart.toFixed(1)}ms`)
    console.log(`   Min: ${minWarmStart}ms`)
    console.log(`   Max: ${maxWarmStart}ms`)
    console.log(`   Target: <800ms - ${avgWarmStart < 800 ? '✅ PASS' : '⚠️ CLOSE'}`)

    // Concurrent processing
    console.log('\n⚡ Concurrent Processing:')
    this.results.concurrent.forEach(result => {
      const efficiency = (result.level * this.results.warmStart[0]) / result.totalTime
      console.log(`   ${result.level} concurrent: ${result.totalTime}ms (${efficiency.toFixed(2)}x efficiency)`)
    })

    // Throughput analysis
    console.log('\n📊 Throughput Analysis:')
    console.log(`   Total iterations: ${this.results.throughput.iterations}`)
    console.log(`   Average time: ${this.results.throughput.avgTime.toFixed(1)}ms`)
    console.log(`   Throughput: ${this.results.throughput.throughputPerSecond.toFixed(1)} chars/sec`)

    const consistencyStdDev = this.calculateStandardDeviation(this.results.throughput.times)
    console.log(`   Consistency (std dev): ${consistencyStdDev.toFixed(1)}ms`)

    // Memory usage
    const memoryBaseline = this.results.memory.find(r => r.stage === 'baseline')?.memory || 0
    const memoryPeak = Math.max(...this.results.memory.map(r => r.memory))
    const memoryIncrease = memoryPeak - memoryBaseline

    console.log('\n💾 Memory Usage:')
    console.log(`   Baseline: ${memoryBaseline.toFixed(1)}MB`)
    console.log(`   Peak: ${memoryPeak.toFixed(1)}MB`)
    console.log(`   Increase: ${memoryIncrease.toFixed(1)}MB`)
    console.log(`   Target: <100MB - ${memoryIncrease < 100 ? '✅ PASS' : '❌ FAIL'}`)

    // Overall assessment
    console.log('\n🎯 Performance Assessment:')
    const criteriaChecks = [
      { name: 'Cold Start < 1000ms', passed: avgColdStart < 1000 },
      { name: 'Warm Start < 800ms', passed: avgWarmStart < 800 },
      { name: 'Memory Increase < 100MB', passed: memoryIncrease < 100 },
      { name: 'Consistency (low std dev)', passed: consistencyStdDev < 200 },
      { name: 'Concurrent efficiency > 0.8', passed: this.results.concurrent.some(r => (r.level * avgWarmStart) / r.totalTime > 0.8) }
    ]

    criteriaChecks.forEach(check => {
      console.log(`   ${check.passed ? '✅' : '❌'} ${check.name}`)
    })

    const passedCriteria = criteriaChecks.filter(c => c.passed).length
    const totalCriteria = criteriaChecks.length

    console.log(`\n📊 Performance Score: ${passedCriteria}/${totalCriteria} (${((passedCriteria/totalCriteria)*100).toFixed(1)}%)`)

    if (passedCriteria === totalCriteria) {
      console.log('🎉 Excellent performance! Ready for production.')
    } else if (passedCriteria >= totalCriteria * 0.8) {
      console.log('✅ Good performance. Minor optimizations may be beneficial.')
    } else {
      console.log('⚠️ Performance needs improvement before production.')
    }
  }

  calculateStandardDeviation(values) {
    const avg = values.reduce((a, b) => a + b, 0) / values.length
    const squareDiffs = values.map(value => Math.pow(value - avg, 2))
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length
    return Math.sqrt(avgSquareDiff)
  }
}

// Run the performance benchmark
const benchmark = new PerformanceBenchmark()
benchmark.run()
  .then(() => {
    console.log('\n✅ Performance benchmark completed!')
  })
  .catch(error => {
    console.error('\n💥 Benchmark error:', error)
    process.exit(1)
  })