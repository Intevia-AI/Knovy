#!/usr/bin/env node

/**
 * Quick performance benchmark
 */

import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const WHISPER_BINARY = path.join(__dirname, 'resources/whisper.cpp/whisper-darwin-arm64')
const MODEL_PATH = path.join(__dirname, 'resources/whisper.cpp/models/ggml-tiny.bin')
const TEST_AUDIO = '/tmp/test.wav'

async function quickBenchmark() {
  console.log('⚡ Quick Performance Benchmark')
  console.log('=============================')

  // Test 5 runs to get average
  const times = []

  for (let i = 0; i < 5; i++) {
    console.log(`Run ${i + 1}/5...`)

    const start = Date.now()
    await runTranscription()
    const end = Date.now()

    const duration = end - start
    times.push(duration)
    console.log(`   ${duration}ms`)
  }

  const avg = times.reduce((a, b) => a + b, 0) / times.length
  const min = Math.min(...times)
  const max = Math.max(...times)

  console.log('\n📊 Results:')
  console.log(`   Average: ${avg.toFixed(1)}ms`)
  console.log(`   Min: ${min}ms`)
  console.log(`   Max: ${max}ms`)
  console.log(`   Target: <1000ms - ${avg < 1000 ? '✅ PASS' : '⚠️ CLOSE'}`)

  // Performance grade
  if (avg < 800) {
    console.log('🏆 Excellent performance!')
  } else if (avg < 1000) {
    console.log('✅ Good performance!')
  } else if (avg < 1500) {
    console.log('⚠️ Acceptable performance')
  } else {
    console.log('❌ Needs optimization')
  }
}

function runTranscription() {
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
    }, 5000)
  })
}

quickBenchmark().catch(console.error)