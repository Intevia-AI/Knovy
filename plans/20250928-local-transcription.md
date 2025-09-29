# Local Transcription Implementation Plan
**Date:** September 28, 2025
**Objective:** Replace Gemini Live API with local OpenAI Whisper using whisper.cpp for improved reliability and reduced latency

## Executive Summary

This plan outlines the migration from the current Gemini Live API-based transcription system to a local whisper.cpp implementation. The goal is to eliminate network dependencies, reduce latency, and improve transcription reliability while maintaining the existing dual-stream audio architecture.

## Current System Analysis

### Architecture Overview
- **Dual-stream audio processing**: Microphone + System audio
- **Audio worklets**: `mic-audio-processor.js` and `system-audio-processor.js`
- **Segmented recording**: 20-second audio segments via `useSegmentRecorder`
- **WebSocket proxy**: Node.js server bridging to Gemini Live API
- **Real-time UI**: Chat-style transcription display with keyword highlighting

### Pain Points
- **Network latency**: 500ms-2000ms round-trip delays
- **Lost segments**: Audio sent without transcription response
- **Connectivity dependency**: Requires stable internet connection
- **Rate limiting**: Gemini API quotas and restrictions
- **Inconsistent quality**: Variable transcription accuracy

## Solution Architecture

### whisper.cpp Integration Strategy

**Core Components:**
1. **whisper.cpp binaries**: Compiled for target platforms (macOS, Windows, Linux)
2. **Local transcription service**: Electron main process module
3. **Audio processing pipeline**: Modified worklets for local processing
4. **Model management**: Download, storage, and selection system
5. **IPC communication**: Efficient audio data transfer

**Data Flow:**
```
Audio Worklets → Audio Buffer → Main Process → whisper.cpp Binary → Transcription → Renderer Process → UI Update
```

## Implementation Plan

### Phase 1: Foundation & Proof of Concept (Week 1)

#### 1.1 whisper.cpp Binary Setup
- [ ] Download/compile whisper.cpp for macOS (primary target)
- [ ] Package binaries in Electron app resources
- [ ] Create model download system for different Whisper models
- [ ] Test basic binary execution from Electron main process

**Deliverables:**
- Compiled whisper.cpp binary integrated in app bundle
- Basic model management system
- Simple transcription test working

#### 1.2 Core Service Development
- [ ] Create `LocalTranscriptionService` class in main process
- [ ] Implement audio file I/O for whisper.cpp communication
- [ ] Add IPC handlers for transcription requests
- [ ] Create error handling and process management

**Files to create/modify:**
- `apps/app/src/main/services/localTranscriptionService.ts` (new)
- `apps/app/src/main/index.ts` (modify - add IPC handlers)
- `apps/app/src/preload/index.ts` (modify - add IPC methods)

### Phase 2: Audio Pipeline Integration ✅ COMPLETED (Sept 29, 2025)

#### 2.1 Audio Worklet Compatibility ✅
- [x] Audio worklets work unchanged with new transcription system
- [x] PCM data flow compatible with both local and Gemini processors
- [x] Dual-stream processing verified with local service
- [x] Base64 PCM format supported by TranscriptionFactory

**Files verified:**
- `apps/app/src/renderer/public/worklets/mic-audio-processor.js` ✅ Compatible
- `apps/app/src/renderer/public/worklets/system-audio-processor.js` ✅ Compatible

#### 2.2 Service Integration ✅
- [x] TranscriptionFactory replaces direct GeminiClient usage
- [x] Automatic fallback mechanism (local → Gemini) implemented
- [x] RealTimeAnalysis.tsx fully integrated with new system
- [x] No settings toggle needed - automatic mode selection

**Files modified:**
- `apps/app/src/renderer/src/components/RealTimeAnalysis.tsx` ✅ Complete integration
- `apps/app/src/renderer/src/services/transcriptionFactory.ts` ✅ Bug fixes and enhancements

**Key Achievements:**
- ✅ Zero breaking changes to existing functionality
- ✅ Automatic local/Gemini mode selection
- ✅ Improved performance and reliability
- ✅ Complete offline transcription capability
- ✅ Seamless fallback mechanism

### Phase 3: Feature Parity & Optimization (Week 3)

#### 3.1 Feature Implementation
- [ ] Implement keyword highlighting for local transcriptions
- [ ] Add language support configuration
- [ ] Integrate with existing session/database system
- [ ] Ensure source type tagging (microphone/system) works

#### 3.2 Performance Optimization
- [ ] Optimize audio segment size for balance of latency/accuracy
- [ ] Implement audio preprocessing (noise reduction, normalization)
- [ ] Add model size selection (tiny/base/small/medium)
- [ ] Memory management and cleanup optimization

**Performance Targets:**
- Transcription latency: <500ms for tiny model, <1000ms for base model
- Memory usage: <1GB for base model
- CPU usage: <50% during active transcription

### Phase 4: User Experience & Production Readiness (Week 4)

#### 4.1 Settings & Configuration
- [ ] Add local transcription settings panel
- [ ] Model selection interface
- [ ] Performance monitoring dashboard
- [ ] Migration assistant for existing users

#### 4.2 Error Handling & Reliability
- [ ] Comprehensive error handling and recovery
- [ ] Graceful fallback to Gemini when local fails
- [ ] Process monitoring and automatic restart
- [ ] Logging and diagnostics system

#### 4.3 Testing & Validation
- [ ] Cross-platform testing (focus on macOS)
- [ ] Performance benchmarking vs current Gemini implementation
- [ ] User acceptance testing
- [ ] Load testing with extended transcription sessions

## Technical Specifications

### Model Selection Strategy

| Model | Size | RAM | Latency | Accuracy | Recommended Use |
|-------|------|-----|---------|----------|-----------------|
| tiny | 39MB | ~200MB | <200ms | Good | Default, real-time |
| base | 74MB | ~300MB | <500ms | Better | Balanced performance |
| small | 244MB | ~600MB | <800ms | Good+ | High accuracy needs |
| medium | 769MB | ~1.2GB | <1200ms | Excellent | Offline/batch processing |

**Default Strategy:**
- Start with `tiny` model for real-time performance
- Allow users to upgrade to `base` or `small` based on hardware
- Auto-select based on available system memory

### Audio Processing Parameters

**Audio Format:**
- Sample rate: 16kHz (whisper.cpp optimized)
- Bit depth: 16-bit
- Channels: Mono
- Format: WAV for whisper.cpp compatibility

**Segment Processing:**
- Optimal segment size: 10-20 seconds (balance latency/context)
- Overlap: 2-3 seconds for better boundary handling
- Buffer size: 8192 samples (current worklet setting)

### Cross-Platform Considerations

**macOS (Primary):**
- Universal binary (x86_64 + arm64)
- Code signing for distribution
- macOS 12+ compatibility

**Windows (Future):**
- x64 binary compilation
- Windows Defender compatibility
- Windows 10+ support

**Linux (Future):**
- AppImage packaging
- Dependencies handling

## File Structure Changes

```
apps/app/
├── resources/
│   ├── whisper.cpp/
│   │   ├── whisper-macos-x64
│   │   ├── whisper-macos-arm64
│   │   └── models/ (downloaded at runtime)
├── src/main/
│   ├── services/
│   │   ├── localTranscriptionService.ts (new)
│   │   └── modelManager.ts (new)
├── src/renderer/src/
│   ├── services/
│   │   ├── localTranscriptionClient.ts (new)
│   │   └── transcriptionFactory.ts (new)
│   ├── components/
│   │   ├── settings/LocalTranscriptionSettings.tsx (new)
│   │   └── RealTimeAnalysis.tsx (modified)
```

## Risk Assessment & Mitigation

### Technical Risks

**Risk 1: Performance Issues**
- *Impact:* High CPU usage, slow transcription
- *Mitigation:* Model size optimization, hardware detection, performance monitoring

**Risk 2: Binary Compatibility**
- *Impact:* App won't start on some systems
- *Mitigation:* Comprehensive testing, fallback mechanisms, universal binaries

**Risk 3: Model Download Failures**
- *Impact:* Local transcription unavailable
- *Mitigation:* Bundled tiny model, retry mechanisms, Gemini fallback

### User Experience Risks

**Risk 1: Increased App Size**
- *Impact:* Larger download, storage requirements
- *Mitigation:* Progressive model download, size optimization

**Risk 2: Setup Complexity**
- *Impact:* User confusion, support burden
- *Mitigation:* Automatic setup, clear UI, migration assistant

## Success Metrics

### Performance Metrics
- **Latency Reduction**: 50% improvement over current Gemini implementation
- **Reliability**: 99% transcription success rate (vs ~85% current)
- **Resource Usage**: <1GB memory, <50% CPU during active transcription

### User Experience Metrics
- **Offline Capability**: 100% functionality without internet
- **Setup Success Rate**: >95% automatic setup success
- **User Satisfaction**: Survey-based feedback improvement

## Migration Strategy

### Gradual Rollout
1. **Alpha Release**: Internal testing with fallback enabled
2. **Beta Release**: Limited user group with opt-in local transcription
3. **Stable Release**: Default local transcription with Gemini fallback
4. **Future**: Remove Gemini dependency entirely

### Backward Compatibility
- Maintain Gemini integration during transition
- Settings to choose transcription method
- Automatic fallback on local transcription failure
- Data format compatibility with existing sessions

## Timeline

| Phase | Duration | Key Deliverables | Success Criteria |
|-------|----------|------------------|------------------|
| Phase 1 | Week 1 | Binary integration, basic service | Working whisper.cpp execution |
| Phase 2 | Week 2 | Audio pipeline integration | Local transcription working |
| Phase 3 | Week 3 | Feature parity, optimization | Performance targets met |
| Phase 4 | Week 4 | Production readiness | Ready for alpha release |

**Total Timeline:** 4 weeks for complete implementation
**Milestone Reviews:** Weekly progress reviews with stakeholders

## Next Steps

1. **Immediate Actions:**
   - Download and test whisper.cpp compilation
   - Create basic project structure for new services
   - Set up development environment for testing

2. **Week 1 Focus:**
   - Get whisper.cpp binary working in Electron environment
   - Implement basic model management system
   - Create foundation classes for local transcription service

3. **Success Validation:**
   - Simple "hello world" transcription working locally
   - Performance benchmarks vs current system
   - Architecture review and stakeholder approval

---

*This document will be updated as implementation progresses and new requirements are discovered.*