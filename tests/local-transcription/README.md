# Local Transcription Test Suite

This directory contains comprehensive tests for the local transcription implementation using whisper.cpp.

## Test Files

### Basic Testing

- **`test-transcription.js`** - Basic functionality validation
  - Tests binary execution, model loading, and basic transcription
  - Quick smoke test to verify everything is working
  - Run with: `node test-transcription.js`

### Comprehensive Testing

- **`test-comprehensive.js`** - Advanced test suite with 17 test cases
  - Basic setup validation (binary, model, architecture)
  - Binary execution tests (help, transcription, parameters)
  - Performance benchmarking (5 iterations)
  - Error handling and edge cases
  - Memory usage analysis
  - Concurrent processing tests
  - Language support validation
  - Run with: `node test-comprehensive.js`

### Service Layer Testing

- **`test-services.mjs`** - TypeScript service validation
  - ModelManager functionality tests
  - LocalTranscriptionService logic validation
  - IPC layer and API structure tests
  - Data serialization verification
  - Run with: `node test-services.mjs`

### Performance Testing

- **`benchmark-performance.js`** - Comprehensive performance analysis
  - Cold start vs warm start benchmarking
  - Concurrent processing analysis
  - Throughput measurement
  - Memory usage monitoring
  - Run with: `node benchmark-performance.js`

- **`quick-benchmark.js`** - Simple performance test
  - Quick 5-iteration latency test
  - Basic performance validation
  - Run with: `node quick-benchmark.js`

## Prerequisites

Before running tests, ensure:

1. **Test audio file exists:**

   ```bash
   curl -L -o /tmp/test.wav https://cdn.openai.com/whisper/draft-20220913a/micro-machines.wav
   ```

2. **Whisper binary and model are available:**
   - Binary: `../../resources/whisper.cpp/whisper-darwin-arm64`
   - Model: `../../resources/whisper.cpp/models/ggml-tiny.bin`

3. **Node.js 18+ with ES modules support**

## Running All Tests

### Quick Validation

```bash
# Run basic functionality test
node test-transcription.js
```

### Full Test Suite

```bash
# Run comprehensive tests
node test-comprehensive.js

# Run service layer tests
node test-services.mjs

# Run performance benchmark
node quick-benchmark.js
```

### Expected Results

All tests should pass with 100% success rate:

- **Basic validation:** ✅ Binary, model, and audio file checks
- **Functionality:** ✅ Transcription working correctly
- **Performance:** ⚠️ Average ~1200ms (target: <1000ms, acceptable for production)
- **Memory:** ✅ <200MB usage, no leaks detected
- **Error handling:** ✅ Graceful error recovery
- **Concurrency:** ✅ Multiple simultaneous transcriptions

## Test Results Interpretation

### Performance Metrics

- **Target latency:** <1000ms
- **Acceptable latency:** <1500ms
- **Current average:** ~1200ms (⚠️ above target, but acceptable)

### Success Criteria

- All functional tests pass: ✅ Required
- Memory usage <1GB: ✅ Required
- Error handling works: ✅ Required
- Performance <1500ms: ✅ Required (⚠️ optimization opportunity exists)

## Troubleshooting

### Common Issues

1. **Binary not found**

   ```bash
   ls -la ../../resources/whisper.cpp/whisper-darwin-arm64
   chmod +x ../../resources/whisper.cpp/whisper-darwin-arm64
   ```

2. **Model not found**

   ```bash
   # Download tiny model
   mkdir -p ../../resources/whisper.cpp/models
   cd ../../resources/whisper.cpp/models
   curl -L -o ggml-tiny.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin
   ```

3. **Test audio not found**

   ```bash
   curl -L -o /tmp/test.wav https://cdn.openai.com/whisper/draft-20220913a/micro-machines.wav
   ```

4. **ES module errors**
   - Ensure Node.js 18+
   - Check package.json has `"type": "module"`

## Contributing

When adding new tests:

1. Follow the existing naming convention
2. Include comprehensive error handling
3. Add progress logging for long-running tests
4. Update this README with new test descriptions
5. Ensure all tests can run independently

## Related Documentation

- **Whisper Architecture:** `../../docs/architecture/whisper.md`
- **Architecture Overview:** `../../docs/architecture/overview.md`
- **Implementation Plan:** `../../plans/20250928-local-transcription.md`
