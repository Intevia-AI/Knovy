# Audio Processing Architecture Analysis & Implementation Plan

## 1. Current Implementation Analysis (COMPLETED ✅)

### useSegmentRecorder.ts Implementation Analysis

How it works:

- **SEGMENT_MS (20,000ms = 20 seconds)**: This is the segment duration - how long each audio chunk should be before dispatching it for transcription
- **CHUNK_MS (1,000ms = 1 second)**: This is the MediaRecorder timeslice - how frequently the MediaRecorder creates internal data chunks

The implementation uses a continuous recording pattern:

1. Starts MediaRecorder with 1-second timeslices
2. Accumulates chunks in chunksRef.current array
3. Every 20 seconds (via setInterval), calls makeBlobAndDispatch() to create a segment
4. Dispatches custom event 'mic_segment' with the audio blob

Why stop/restart is NOT happening:

Looking at the code, there's no stop/restart cycle. The comments suggest this was an older approach that was refactored. The current implementation:

- Keeps MediaRecorder running continuously
- Uses setInterval to create segments from accumulated chunks without stopping the recorder
- Line 124: makeBlobAndDispatch() creates segments while recorder keeps running

Alignment with whisper.cpp:

Partially aligned but suboptimal:

- ✅ Produces 20-second segments (reasonable for whisper.cpp)
- ❌ Fixed 20-second chunks may split sentences awkwardly
- ❌ No voice activity detection integration
- ❌ No context passing between segments

Silence handling and VAD:

The implementation has basic client-side VAD in the worklets:

- **Worklet VAD**: silenceThreshold = 0.01, only sends data when !this.isSilent
- **Whisper.cpp VAD**: Yes, whisper.cpp has VAD capabilities but they're not being utilized

Current redundancy: You have VAD in both places, but they serve different purposes:

- **Worklet VAD**: Prevents sending silent audio over IPC (performance optimization)
- **Whisper.cpp VAD**: Could provide better speech detection and segment boundaries

---

# IMPLEMENTATION PLAN

## Phase 1: Core Audio Processing Refactoring ⏳

### Task 1.1: Remove Fixed Chunking - Replace with VAD-based Segmentation
**Status**: ✅ Completed
**Files to modify**:
- `apps/app/src/renderer/src/hooks/useSegmentRecorder.ts`
- `apps/app/src/renderer/public/worklets/mic-audio-processor.js`
- `apps/app/src/renderer/public/worklets/system-audio-processor.js`

**Changes**:
1. **Remove fixed timing constants**:
   - ❌ Delete `SEGMENT_MS = 20_000`
   - ❌ Delete `CHUNK_MS = 1_000`
   - ❌ Remove `setInterval(makeBlobAndDispatch, SEGMENT_MS)`

2. **Implement VAD-based triggering**:
   - ✅ Add speech detection in worklets
   - ✅ Trigger `makeBlobAndDispatch()` on speech end detection
   - ✅ Add minimum/maximum segment length safeguards (3-45 seconds)

3. **Enhanced worklet VAD**:
   ```javascript
   // In mic-audio-processor.js
   class MicAudioProcessor extends AudioWorkletProcessor {
     constructor(options) {
       super()
       this.silenceThreshold = 0.01
       this.speechTimeout = 2000  // 2 seconds of silence = speech end
       this.minSegmentLength = 3000  // Minimum 3 seconds
       this.maxSegmentLength = 45000 // Maximum 45 seconds
       this.speechStartTime = null
       this.lastSpeechTime = null
       this.isInSpeech = false
     }
   }
   ```

### Task 1.2: Add Context Preservation System
**Status**: ✅ Completed
**Files to modify**:
- `apps/app/src/main/whisperBackend.ts`
- `apps/app/src/renderer/src/services/transcription.ts`

**Changes**:
1. **Add context storage**:
   ```typescript
   // In whisperBackend.ts
   private segmentContext = new Map<string, string>() // sessionId -> last sentence

   private extractLastSentence(text: string): string {
     const sentences = text.split(/[.!?]+/).filter(s => s.trim())
     return sentences[sentences.length - 1]?.trim() || ''
   }
   ```

2. **Update executeWhisper to use context**:
   ```typescript
   const previousContext = this.segmentContext.get(sessionId) || ''
   const contextPrompt = previousContext ?
     `Previous context: "${previousContext}". Continue naturally.` : ''
   ```

### Task 1.3: Enhance whisper.cpp Command Arguments
**Status**: ✅ Completed
**Files to modify**:
- `apps/app/src/main/whisperBackend.ts` (line 649-681)

**Current args**:
```javascript
const args = [
  audioFilePath,
  '--model', modelPath,
  '--no-timestamps',
  '--no-prints',
  '--threads', '4'
]
```

**Enhanced args**:
```javascript
const DOMAIN_PROMPTS = {
  technical: "Technical discussion about software development, programming, and technology.",
  meeting: "Business meeting with multiple speakers discussing projects and decisions.",
  casual: "Casual conversation with natural speech patterns.",
  default: "Clear conversation with proper punctuation and grammar."
}

const args = [
  audioFilePath,
  '--model', modelPath,
  '--no-timestamps',
  '--no-prints',
  '--threads', '4',
  // Quality improvements
  '--temperature', '0.0',
  '--best-of', '2',
  '--beam-size', '5',
  // VAD options
  '--vad-thold', '0.6',
  '--vad-freq-thold', '100',
  // Context and prompting
  '--initial-prompt', DOMAIN_PROMPTS.default,
  '--prompt', contextPrompt,
  // Word-level features
  '--word-timestamps',
  '--word-thold', '0.01',
  // Language detection (keep current)
  '--language', 'auto'
]
```

## Phase 2: Advanced Features ⏳

### Task 2.1: Implement Gemini Post-Processing Pipeline
**Status**: 🔴 Not Started
**Files to create/modify**:
- `apps/app/src/main/geminiEnhancer.ts` (new file)
- `apps/app/src/main/whisperBackend.ts` (integrate enhancer)

**Pipeline flow**:
```
Raw Audio → whisper.cpp → Raw Transcription → Gemini Enhancement → Final Output
```

**Gemini enhancer implementation**:
```typescript
export class GeminiEnhancer {
  async enhanceTranscription(rawText: string, options: {
    context?: string
    sourceType: 'microphone' | 'system'
    corrections: string[]
  }): Promise<string> {
    // Grammar and punctuation correction
    // Speaker identification
    // Keyword extraction
    // Intent detection
  }
}
```

### Task 2.2: Add Real-time Quality Metrics
**Status**: 🔴 Not Started
**Files to modify**:
- `apps/app/src/main/whisperBackend.ts`

**Features**:
- Confidence scoring for each segment
- Audio quality assessment
- Retry logic for low-confidence transcriptions
- Performance metrics logging

## Phase 3: Testing and Validation ⏳

### Task 3.1: Create Test Audio Samples
**Status**: 🔴 Not Started
**Deliverables**:
- Various length speech samples (3-45 seconds)
- Mixed language samples
- Technical discussion samples
- Noisy environment samples

### Task 3.2: Performance Benchmarking
**Status**: 🔴 Not Started
**Metrics to track**:
- Transcription accuracy improvement
- Processing latency changes
- Memory usage optimization
- Context preservation effectiveness

### Task 3.3: User Experience Testing
**Status**: 🔴 Not Started
**Focus areas**:
- Natural speech boundary detection
- Reduced sentence fragmentation
- Improved punctuation and grammar
- Better speaker identification

## Progress Tracking

### Completed Tasks ✅
- [x] Audio processing analysis
- [x] Technical architecture review
- [x] Implementation plan creation
- [x] **Phase 1 - Core Audio Processing Refactoring**
  - [x] Task 1.1: VAD-based segmentation (removed fixed chunking)
    - [x] Removed SEGMENT_MS (20_000) and CHUNK_MS (1_000) constants
    - [x] Enhanced worklet VAD with speech detection and timeout logic
    - [x] Added minimum/maximum segment length safeguards (3-45 seconds)
  - [x] Task 1.2: Context preservation system
    - [x] Added segmentContext Map for session continuity
    - [x] Implemented context extraction and storage
  - [x] Task 1.3: Enhanced whisper.cpp arguments
    - [x] Added quality improvement flags (temperature, best-of, beam-size)
    - [x] Removed unsupported arguments for compatibility
- [x] **Critical Bug Fixes**
  - [x] Discovered and fixed TranscriptionProcessor fixed timer override
  - [x] Removed BUFFER_DURATION_MS = 5000 that was blocking VAD
  - [x] Implemented proper VAD event listening for 'mic_segment' and 'system_segment'
  - [x] Fixed import errors and compilation issues
  - [x] Validated actual VAD-based processing (no more fixed timing)

### Current Status 🟢
**Phase 1 Complete**: True VAD-based audio processing with context preservation
- ✅ VAD system working correctly (confirmed no fixed timing)
- ✅ Context preservation between segments
- ✅ Enhanced whisper.cpp quality settings
- ⚠️ Language preference (zh-tw vs zh-cn) - deferred for future implementation

### Pending Tasks 🔴
- [ ] Phase 2: Gemini post-processing pipeline
- [ ] Phase 2: Real-time quality metrics
- [ ] Phase 3: Performance benchmarking
- [ ] Phase 3: User experience testing

## Breaking Changes Summary

1. **Removed Constants**: `SEGMENT_MS`, `CHUNK_MS`
2. **New Dependencies**: Enhanced VAD logic, context management
3. **API Changes**: Modified transcription events (variable timing)
4. **Performance Impact**: Potentially better accuracy, similar or improved latency

This approach eliminates fixed chunking complexity while providing superior transcription quality through natural speech boundaries and context preservation.